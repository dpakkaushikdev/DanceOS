import type { SupabaseClient } from "@supabase/supabase-js";
import type { EnquiryJob, EnquiryPerson, EnquiryPersonKind, EnquiryPractice } from "@/types/enquiry";

/** AN ENQUIRY'S TEAM AND PRACTICES (18 Oct 2026, `20261024090000`).
 *
 *  ⚠ THE TABLES ARRIVE WITH THAT MIGRATION, AND THE APP SHIPS FIRST. So every
 *  read here catches "the relation does not exist" (Postgres 42P01, PostgREST
 *  PGRST205 / PGRST202) and answers `available: false` instead of throwing — the
 *  screen then says "Available once switched on" rather than a whole enquiry
 *  page failing over two new sections. Writes answer the same in words.
 *
 *  RLS decides what comes back: every member of the business reads the people,
 *  the practices and the register; an assigned person reads their own row and
 *  the practices. Every list here is bounded (a job has tens of people). */

const MISSING = new Set(["42P01", "PGRST205", "PGRST202", "42883"]);

/** was this error the schema not being there yet? */
export function isMissingSchema(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code && MISSING.has(error.code)) return true;
  return /does not exist|could not find the (table|function)|schema cache/i.test(error.message ?? "");
}

export const NOT_SWITCHED_ON = "Team and practices are not switched on yet";

export async function findEnquiryJob(supabase: SupabaseClient, enquiryId: string): Promise<EnquiryJob> {
  const empty: EnquiryJob = { available: false, people: [], practices: [] };

  const [peopleRes, practiceRes] = await Promise.all([
    supabase
      .from("enquiry_people")
      .select("id, user_id, kind, role, created_at")
      .eq("enquiry_id", enquiryId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(200),
    supabase
      .from("enquiry_practices")
      .select("id, starts_at, ends_at, place, note, status")
      .eq("enquiry_id", enquiryId)
      .is("deleted_at", null)
      .order("starts_at", { ascending: true })
      .limit(200),
  ]);

  if (isMissingSchema(peopleRes.error) || isMissingSchema(practiceRes.error)) {
    return empty;
  }
  if (peopleRes.error) {
    throw new Error(`enquiryTeam.people failed: ${peopleRes.error.message}`);
  }
  if (practiceRes.error) {
    throw new Error(`enquiryTeam.practices failed: ${practiceRes.error.message}`);
  }

  const rows = (peopleRes.data ?? []) as Array<{ id: string; user_id: string; kind: EnquiryPersonKind; role: string | null }>;
  const practices = (practiceRes.data ?? []) as Array<{ id: string; starts_at: string; ends_at: string; place: string; note: string | null; status: "scheduled" | "cancelled" }>;

  /* names and pictures: `enquiry_people.user_id` references profiles, but a
     second read keeps the embed unambiguous (two FKs elsewhere have bitten) */
  const ids = rows.map((r) => r.user_id);
  const [{ data: profiles }, attendance] = await Promise.all([
    ids.length
      ? supabase.from("profiles").select("id, full_name, profile_photo_path, city").in("id", ids)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; profile_photo_path: string | null; city: string | null }> }),
    practices.length
      ? supabase
          .from("enquiry_practice_attendance")
          .select("practice_id, user_id")
          .in(
            "practice_id",
            practices.map((p) => p.id),
          )
          .is("deleted_at", null)
          .limit(2000)
      : Promise.resolve({ data: [] as Array<{ practice_id: string; user_id: string }>, error: null }),
  ]);
  const byId = new Map(((profiles ?? []) as Array<{ id: string; full_name: string | null; profile_photo_path: string | null; city: string | null }>).map((p) => [p.id, p]));
  const inBy = new Map<string, string[]>();
  for (const a of ((attendance as { data: Array<{ practice_id: string; user_id: string }> | null }).data ?? [])) {
    inBy.set(a.practice_id, [...(inBy.get(a.practice_id) ?? []), a.user_id]);
  }

  const people: EnquiryPerson[] = rows.map((r) => {
    const p = byId.get(r.user_id);
    return {
      id: r.id,
      userId: r.user_id,
      kind: r.kind,
      role: r.role,
      name: p?.full_name ?? "Somebody",
      photoPath: p?.profile_photo_path ?? null,
      city: p?.city ?? null,
    };
  });
  const list: EnquiryPractice[] = practices.map((p) => ({
    id: p.id,
    startsAt: p.starts_at,
    endsAt: p.ends_at,
    place: p.place,
    note: p.note,
    status: p.status,
    checkedIn: inBy.get(p.id) ?? [],
  }));
  return { available: true, people, practices: list };
}

/** one RPC call, the schema's absence said in words rather than thrown */
async function call(supabase: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.rpc(fn, args);
  if (error) {
    throw new Error(isMissingSchema(error) ? NOT_SWITCHED_ON : error.message);
  }
}

export const addEnquiryPerson = (supabase: SupabaseClient, enquiryId: string, userId: string, kind: EnquiryPersonKind, role: string | null) =>
  call(supabase, "add_enquiry_person", { p_enquiry_id: enquiryId, p_user_id: userId, p_kind: kind, p_role: role });

export const removeEnquiryPerson = (supabase: SupabaseClient, personId: string) => call(supabase, "remove_enquiry_person", { p_person_id: personId });

export const saveEnquiryPractice = (
  supabase: SupabaseClient,
  input: { enquiryId: string; startsAt: string; endsAt: string; place: string; note: string | null; practiceId: string | null },
) =>
  call(supabase, "save_enquiry_practice", {
    p_enquiry_id: input.enquiryId,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_place: input.place,
    p_note: input.note,
    p_practice_id: input.practiceId,
  });

export const cancelEnquiryPractice = (supabase: SupabaseClient, practiceId: string) => call(supabase, "cancel_enquiry_practice", { p_practice_id: practiceId });

export const checkInEnquiryPractice = (supabase: SupabaseClient, practiceId: string, userId: string, on: boolean) =>
  call(supabase, on ? "check_in_enquiry_practice" : "undo_enquiry_practice_check_in", { p_practice_id: practiceId, p_user_id: userId });
