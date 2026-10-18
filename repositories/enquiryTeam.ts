import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalendarPracticeEntry } from "@/types/calendar";
import { ENQ_PART_WORD, enquiryTypeLabel } from "@/types/enquiry";
import type {
  EnquiryFile,
  EnquiryFileKind,
  EnquiryJob,
  EnquiryJobAsk,
  EnquiryPerson,
  EnquiryPersonKind,
  EnquiryPractice,
  MyEnquiryPractice,
} from "@/types/enquiry";

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

/** a person on an enquiry job, with who put them there */
export type EnquiryJobPerson = EnquiryPerson & { addedBy: string | null };

export const NOT_SWITCHED_ON ="Team and practices are not switched on yet";

export async function findEnquiryJob(supabase: SupabaseClient, enquiryId: string): Promise<EnquiryJob> {
  const empty: EnquiryJob = { available: false, people: [], practices: [] };

  const [peopleRes, practiceRes] = await Promise.all([
    supabase
      .from("enquiry_people")
      .select("id, user_id, kind, role, status, created_at, created_by")
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

  const rows = (peopleRes.data ?? []) as Array<{ id: string; user_id: string; kind: EnquiryPersonKind; role: string | null; status: string | null; created_by: string | null }>;
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

  /* ⚠ `addedBy` rides beside the shared type (18 Oct 2026): the sender may take
     off a participant THEY added (`20261026090000`), so the panel needs to know
     who added each row. Read as `EnquiryJobPerson`. */
  const people: EnquiryJobPerson[] = rows.map((r) => {
    const p = byId.get(r.user_id);
    return {
      addedBy: r.created_by,
      id: r.id,
      userId: r.user_id,
      kind: r.kind,
      role: r.role,
      name: p?.full_name ?? "Somebody",
      photoPath: p?.profile_photo_path ?? null,
      city: p?.city ?? null,
      status: r.status === "asked" ? "asked" : "confirmed",
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

/* ── A JOB IS ASKED, FILES, AND MY PRACTICES (18 Oct 2026, `20261025090000`) ── */

/** the person's own answer to a job — the RPC is theirs alone and tells the owners */
export const respondToEnquiryJob = (supabase: SupabaseClient, personId: string, accept: boolean) =>
  call(supabase, "respond_to_enquiry_job", { p_person_id: personId, p_accept: accept });

interface JobRow {
  id: string;
  enquiry_id: string;
  kind: EnquiryPersonKind;
  role: string | null;
  status: string;
  created_at: string;
  host_name: string | null;
  host_photo_path: string | null;
  type_key: string | null;
  first_date: string | null;
}

/** every enquiry job the caller was put on, asked ones first — scoped to
 *  `auth.uid()` inside the function. A missing schema is an empty list. */
export async function findMyEnquiryJobs(supabase: SupabaseClient): Promise<EnquiryJobAsk[]> {
  const { data, error } = await supabase.rpc("my_enquiry_jobs");
  if (error) {
    if (isMissingSchema(error)) return [];
    throw new Error(`my_enquiry_jobs failed: ${error.message}`);
  }
  return ((data ?? []) as JobRow[]).map((r) => ({
    id: r.id,
    enquiryId: r.enquiry_id,
    kind: r.kind,
    role: r.role,
    status: r.status === "asked" ? "asked" : "confirmed",
    createdAt: r.created_at,
    hostName: r.host_name ?? "A business",
    hostPhotoPath: r.host_photo_path,
    typeKey: r.type_key,
    firstDate: r.first_date,
  }));
}

interface MyPracticeRow {
  id: string;
  enquiry_id: string;
  starts_at: string;
  ends_at: string;
  place: string;
  note: string | null;
  status: string;
  host_name: string | null;
  host_photo_path: string | null;
  type_key: string | null;
  my_part: string | null;
  people: number | null;
  checked_in: number | null;
}

const toMyPractice = (r: MyPracticeRow): MyEnquiryPractice => ({
  id: r.id,
  enquiryId: r.enquiry_id,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  place: r.place,
  note: r.note,
  status: r.status === "cancelled" ? "cancelled" : "scheduled",
  hostName: r.host_name ?? "A business",
  hostPhotoPath: r.host_photo_path,
  typeKey: r.type_key,
  myPart: r.my_part === "runs" ? "runs" : r.my_part === "team" ? "team" : r.my_part === "sender" ? "sender" : "participant",
  people: Number(r.people ?? 0),
  checkedIn: Number(r.checked_in ?? 0),
});

/** every enquiry practice the caller runs or is confirmed on, in a window —
 *  ⚠ a failed read is an empty list: a practice is a section of a page that has
 *  other things on it (the calendar), the same rule `findMyCrewPractices` keeps */
export async function findMyEnquiryPractices(supabase: SupabaseClient, opts: { from: string; to: string }): Promise<MyEnquiryPractice[]> {
  const { data, error } = await supabase.rpc("my_enquiry_practices", { p_from: opts.from, p_to: opts.to });
  if (error) return [];
  return ((data ?? []) as MyPracticeRow[]).map(toMyPractice);
}

export interface EnquiryPracticeDetail {
  practice: MyEnquiryPractice;
  /** the job's confirmed people and who is checked in — the runner's register */
  people: EnquiryPerson[];
  checkedIn: string[];
  /** the person who SENT the enquiry — on the register beside the team and the
   *  participants (18 Oct 2026). Null when the reader may not see the enquiry
   *  row (a team member or a participant reads only the practice). */
  sender: { userId: string; name: string; photoPath: string | null } | null;
}

/** ONE enquiry practice, for its own page. The row is read under RLS (members and
 *  the job's confirmed people), then `my_enquiry_practices` over that practice's
 *  own minutes says what the caller is to it — so somebody who is neither the
 *  runner nor confirmed on the job gets null, and the page says not found. */
export async function findEnquiryPracticeDetail(supabase: SupabaseClient, practiceId: string): Promise<EnquiryPracticeDetail | null> {
  const { data: row, error } = await supabase.from("enquiry_practices").select("id, enquiry_id, starts_at, ends_at").eq("id", practiceId).is("deleted_at", null).maybeSingle();
  if (error || !row) return null;
  const r = row as { id: string; enquiry_id: string; starts_at: string; ends_at: string };
  const from = new Date(new Date(r.starts_at).getTime() - 60_000).toISOString();
  const to = new Date(new Date(r.ends_at).getTime() + 60_000).toISOString();
  const mine = (await findMyEnquiryPractices(supabase, { from, to })).find((p) => p.id === practiceId);
  if (!mine) return null;
  const [job, senderRes] = await Promise.all([
    findEnquiryJob(supabase, r.enquiry_id).catch(() => null),
    supabase.from("enquiries").select("from_user_id").eq("id", r.enquiry_id).maybeSingle(),
  ]);
  const practice = job?.practices.find((p) => p.id === practiceId);
  const senderId = (senderRes.data as { from_user_id: string | null } | null)?.from_user_id ?? null;
  let sender: EnquiryPracticeDetail["sender"] = null;
  if (senderId) {
    const { data: prof } = await supabase.from("profiles").select("full_name, profile_photo_path").eq("id", senderId).maybeSingle();
    const pr = prof as { full_name: string | null; profile_photo_path: string | null } | null;
    sender = { userId: senderId, name: pr?.full_name ?? "The sender", photoPath: pr?.profile_photo_path ?? null };
  }
  return {
    practice: mine,
    people: (job?.people ?? []).filter((p) => p.status === "confirmed" && p.userId !== senderId),
    checkedIn: practice?.checkedIn ?? [],
    sender,
  };
}

/** ⚠ A PERSON'S OWN JOB PRACTICES, AND NOT A STUDIO'S (18 Oct 2026, the user:
 *  "studio and person enquiry and practice are getting crossed should not be
 *  happening"). `my_enquiry_practices` answers every job the caller RUNS — which
 *  for a studio owner includes the studio's jobs, and those are the studio's,
 *  on the studio's own Practice tool. So a "runs" row stays on a person's tools
 *  only when the enquiry was put to their own artist page (or a crew); a team,
 *  participant or sender row is always theirs. A failed narrowing read keeps
 *  only the rows that are certainly theirs. */
export async function findMyPersonalEnquiryPractices(supabase: SupabaseClient, opts: { from: string; to: string }): Promise<MyEnquiryPractice[]> {
  const mine = await findMyEnquiryPractices(supabase, opts);
  const runIds = [...new Set(mine.filter((p) => p.myPart === "runs").map((p) => p.enquiryId))];
  if (runIds.length === 0) return mine;
  const { data, error } = await supabase.from("enquiries").select("id, business_id").in("id", runIds);
  if (error || !data) return mine.filter((p) => p.myPart !== "runs");
  const rows = data as { id: string; business_id: string | null }[];
  const bizIds = [...new Set(rows.map((r) => r.business_id).filter((x): x is string => Boolean(x)))];
  const { data: biz } = bizIds.length ? await supabase.from("businesses").select("id, type").in("id", bizIds) : { data: [] };
  const studios = new Set(((biz ?? []) as { id: string; type: string }[]).filter((b) => b.type === "studio").map((b) => b.id));
  const studioEnquiries = new Set(rows.filter((r) => r.business_id && studios.has(r.business_id)).map((r) => r.id));
  return mine.filter((p) => p.myPart !== "runs" || !studioEnquiries.has(p.enquiryId));
}

/** ⚠ AN ENQUIRY JOB'S PRACTICE ON A PERSON'S CALENDAR (18 Oct 2026) — the crew
 *  row's shape (`practiceToCalendar`), IST day and hour computed once here, the
 *  host's name where the crew's would be, and the row opening the practice's own
 *  page. `standing` is "member" only so the shape holds; `standingWord` is what
 *  the row prints. */
export function enquiryPracticeToCalendar(p: MyEnquiryPractice): CalendarPracticeEntry {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false });
  const parts = Object.fromEntries(f.formatToParts(new Date(p.startsAt)).map((x) => [x.type, x.value]));
  return {
    practiceId: p.id,
    crewId: p.enquiryId,
    crewName: p.hostName,
    style: enquiryTypeLabel(p.typeKey) ?? "Enquiry",
    startsAt: p.startsAt,
    endsAt: p.endsAt,
    dayKey: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour === "24" ? "0" : parts.hour),
    place: p.place,
    note: p.note,
    cancelled: p.status === "cancelled",
    standing: "member",
    standingWord: ENQ_PART_WORD[p.myPart].sub,
    going: p.checkedIn,
    asked: p.people,
    href: `/practice/job/${p.id}`,
    kind: "job",
  };
}

/** ⚠ A STUDIO'S OWN PRACTICE DESK (18 Oct 2026, the user: "practice tool for
 *  studio as well"). A studio has no crew, so its practices are its enquiry
 *  jobs' — the caller's own `my_enquiry_practices` (which already holds every
 *  job they RUN), narrowed to the enquiries THIS studio works. The enquiry ids
 *  are read under the caller's RLS and scoped to the business out loud. */
export async function findBusinessEnquiryPractices(
  supabase: SupabaseClient,
  businessId: string,
  opts: { from: string; to: string }
): Promise<MyEnquiryPractice[]> {
  const [{ data, error }, mine] = await Promise.all([
    supabase.from("enquiries").select("id").eq("business_id", businessId).is("deleted_at", null).limit(2000),
    findMyEnquiryPractices(supabase, opts),
  ]);
  if (error || !data) return [];
  const ours = new Set((data as { id: string }[]).map((r) => r.id));
  return mine.filter((p) => ours.has(p.enquiryId));
}

/** an enquiry's links, newest last — either end reads them (RLS: `is_enquiry_end`) */
export async function findEnquiryFiles(supabase: SupabaseClient, enquiryId: string): Promise<{ available: boolean; files: EnquiryFile[] }> {
  const { data, error } = await supabase
    .from("enquiry_files")
    .select("id, kind, label, url, created_by, created_at")
    .eq("enquiry_id", enquiryId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) {
    if (isMissingSchema(error)) return { available: false, files: [] };
    throw new Error(`enquiry_files failed: ${error.message}`);
  }
  return {
    available: true,
    files: ((data ?? []) as Array<{ id: string; kind: EnquiryFileKind; label: string; url: string; created_by: string | null; created_at: string }>).map((f) => ({
      id: f.id,
      kind: f.kind,
      label: f.label,
      url: f.url,
      createdBy: f.created_by,
      createdAt: f.created_at,
    })),
  };
}

export const addEnquiryFile = (supabase: SupabaseClient, enquiryId: string, kind: EnquiryFileKind, label: string, url: string) =>
  call(supabase, "add_enquiry_file", { p_enquiry_id: enquiryId, p_kind: kind, p_label: label, p_url: url });

export const removeEnquiryFile = (supabase: SupabaseClient, fileId: string) => call(supabase, "remove_enquiry_file", { p_file_id: fileId });
