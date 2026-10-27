import type { SupabaseClient } from "@supabase/supabase-js";
import { dosClassLabel } from "@/lib/constants/styles";
import { enquiryTypeOf } from "@/types/enquiry";
import type {
  MyEarnings,
  PayableEnquiry,
  PayableSession,
  PayLine,
  PayoutMethod,
  PayoutStatus,
  PersonPayHistory,
  PersonPayLedger,
  PayoutWithSessions,
  StudioEarning,
  BusinessPayLedger,
} from "@/types/payout";

/** TEAM PAY. ⚠ PAY IS SET WHEN PAYING (18 Oct 2026, the user: "no other way to
 *  set price from somewhere else it should happen only from the team section when
 *  going to pay that particular person or studio"). So nothing here reads a rate:
 *  these queries say WHICH classes and enquiries are not yet settled, and what has
 *  been paid; the amount for each is typed in the pay sheet and written by
 *  `record_session_payment`.
 *
 *  Reads are plain RLS-shaped queries: `payouts`, `payout_lines` and
 *  `payout_enquiry_lines` admit the studio's OWNER and the person paid, and nobody
 *  else. */

/** Sessions are only "taken" once they have ended, and a classPerson stops
 *  accruing the moment it is closed: somebody taken off the team is still to be
 *  settled for the sessions they actually took, not for the ones run afterwards. */
const accrualCutoff = (classPersonDeletedAt: string | null, nowIso: string): string =>
  classPersonDeletedAt && classPersonDeletedAt < nowIso ? classPersonDeletedAt : nowIso;

const MAX_CLAIMS = 500;
const MAX_SESSIONS = 2000;
const MAX_LINES = 4000;
/** ⚠ a runaway guard, not a page size — the totals are SUMMED off this read */
const MAX_PAYOUTS = 4000;

const single = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null));
const enquiryLabel = (typeKey: string | null | undefined, who: string | null | undefined) =>
  `${enquiryTypeOf(typeKey ?? "")?.label ?? "Enquiry"}${who ? ` — ${who}` : ""}`;

interface ClassPersonRow {
  id: string;
  class_id: string;
  user_id: string;
  kind: "artist" | "assistant";
  created_at: string;
  deleted_at: string | null;
  profiles: { full_name: string } | null;
  classes: { style: string; level: string } | null;
}

interface SessionRow {
  id: string;
  class_id: string;
  starts_at: string;
  ends_at: string;
}

interface PayoutRow {
  id: string;
  user_id: string;
  amount_inr: number;
  status: PayoutStatus;
  method: PayoutMethod;
  provider_ref: string | null;
  paid_on: string;
  note: string | null;
  profiles: { full_name: string } | null;
}

const CLAIM_SELECT = "id, class_id, user_id, kind, created_at, deleted_at, profiles (full_name), classes (style, level)";
const PAYOUT_SELECT = "id, user_id, amount_inr, status, method, provider_ref, paid_on, note, profiles (full_name)";

type Lines = {
  sessions: Map<string, PayoutWithSessions["sessions"]>;
  enquiries: Map<string, PayoutWithSessions["enquiries"]>;
  /** `${session_id}:${user_id}` and `${enquiry_id}:${user_id}` already settled */
  settled: Set<string>;
  complete: boolean;
};

/** WHO A LINES READ IS FOR — at least one of the two, enforced by the type.
 *  Both optional read as "either, or neither", and neither is the unscoped read
 *  `audit:reads` refuses; this shape makes `{}` a compile error. */
type LinesScope = { businessId: string; userId?: string } | { userId: string; businessId?: string };

/** Every live pay line behind a set of payouts, with what it was for — the
 *  settled HISTORY (18 Oct 2026, the user: "should also show history of payments
 *  what is already settled"). Filtered by business or by person, never by RLS
 *  alone (RLS is a ceiling, not a scope).
 *
 *  audit-ok: the scope is applied CONDITIONALLY below (`.eq("business_id")` or
 *  `.eq("user_id")`, or both), which the audit cannot see as a scope on the
 *  query's opening line. It is guaranteed all the same: `LinesScope` makes a
 *  call with neither a type error, so no caller can reach the database
 *  unscoped. This was CI's only red since `c8c29d0` (18 Oct 2026) — fixed
 *  27 Oct 2026. ⚠ Do not write the query-opening method name inside this
 *  comment: the audit bounds its search window at the previous occurrence of
 *  that token, and a mention here puts the marker outside the window. */
async function readLines(supabase: SupabaseClient, by: LinesScope): Promise<Lines> {
  let a = supabase
    .from("payout_lines")
    .select("id, payout_id, session_id, user_id, rate_inr, class_sessions (starts_at, classes (style, level))")
    .is("deleted_at", null);
  let b = supabase
    .from("payout_enquiry_lines")
    .select("id, payout_id, enquiry_id, user_id, rate_inr, enquiries (type_key, profiles (full_name))")
    .is("deleted_at", null);
  if (by.businessId) {
    a = a.eq("business_id", by.businessId);
    b = b.eq("business_id", by.businessId);
  }
  if (by.userId) {
    a = a.eq("user_id", by.userId);
    b = b.eq("user_id", by.userId);
  }
  const [sRes, eRes] = await Promise.all([a.limit(MAX_LINES), b.limit(MAX_LINES)]);
  if (sRes.error) throw new Error(`payouts.lines(sessions) failed: ${sRes.error.message}`);
  if (eRes.error) throw new Error(`payouts.lines(enquiries) failed: ${eRes.error.message}`);

  type SRow = { id: string; payout_id: string; session_id: string; user_id: string; rate_inr: number; class_sessions: unknown };
  type ERow = { id: string; payout_id: string; enquiry_id: string; user_id: string; rate_inr: number; enquiries: unknown };
  const sessions = new Map<string, PayoutWithSessions["sessions"]>();
  const enquiries = new Map<string, PayoutWithSessions["enquiries"]>();
  const settled = new Set<string>();
  for (const l of (sRes.data ?? []) as SRow[]) {
    const cs = single(l.class_sessions as { starts_at: string; classes: unknown } | null);
    const cl = single(cs?.classes as { style: string; level: string } | null);
    const list = sessions.get(l.payout_id) ?? [];
    list.push({ sessionId: l.session_id, classTitle: cl ? dosClassLabel(cl.style, cl.level) : "Class", startsAt: cs?.starts_at ?? "", rateInr: l.rate_inr, lineId: l.id });
    sessions.set(l.payout_id, list);
    settled.add(`${l.session_id}:${l.user_id}`);
  }
  for (const l of (eRes.data ?? []) as ERow[]) {
    const e = single(l.enquiries as { type_key: string; profiles: unknown } | null);
    const who = single(e?.profiles as { full_name: string | null } | null)?.full_name;
    const list = enquiries.get(l.payout_id) ?? [];
    list.push({ enquiryId: l.enquiry_id, label: e ? enquiryLabel(e.type_key, who) : "An enquiry", rateInr: l.rate_inr, lineId: l.id });
    enquiries.set(l.payout_id, list);
    settled.add(`${l.enquiry_id}:${l.user_id}`);
  }
  for (const list of sessions.values()) list.sort((x, y) => y.startsAt.localeCompare(x.startsAt));
  return {
    sessions,
    enquiries,
    settled,
    complete: (sRes.data?.length ?? 0) < MAX_LINES && (eRes.data?.length ?? 0) < MAX_LINES,
  };
}

const withLines = (p: PayoutRow, lines: Lines): PayoutWithSessions => {
  const sessions = lines.sessions.get(p.id) ?? [];
  const enquiries = lines.enquiries.get(p.id) ?? [];
  return {
    id: p.id,
    userId: p.user_id,
    personName: p.profiles?.full_name ?? "Someone",
    amountInr: p.amount_inr,
    status: p.status,
    method: p.method,
    providerRef: p.provider_ref,
    paidOn: p.paid_on,
    note: p.note,
    sessionCount: sessions.length + enquiries.length,
    sessions,
    enquiries,
  };
};

/** What this studio has not yet settled with its people, and what it has paid.
 *
 *  Confirmed classPeople are read WITHOUT the deleted_at filter on purpose: a
 *  removal closes a person's classPeople, and the work they did before that is
 *  still to be settled. `accrualCutoff` is what keeps that honest. */
export async function findBusinessPayLedger(
  supabase: SupabaseClient,
  businessId: string,
  nowIso: string
): Promise<BusinessPayLedger> {
  const [classPeopleRes, sessionsRes, teamRes, payoutsRes, lines] = await Promise.all([
    supabase
      .from("class_people")
      .select(CLAIM_SELECT)
      .eq("business_id", businessId)
      .eq("status", "confirmed")
      .order("created_at", { ascending: false })
      .limit(MAX_CLAIMS),
    supabase
      .from("class_sessions")
      .select("id, class_id, starts_at, ends_at")
      .eq("business_id", businessId)
      .lt("ends_at", nowIso)
      .is("deleted_at", null)
      .order("starts_at", { ascending: false })
      .limit(MAX_SESSIONS),
    /* ⚠ the enquiry TEAM, never participants (18 Oct 2026) */
    supabase
      .from("enquiry_people")
      .select("enquiry_id, user_id, role, created_at, profiles (full_name), enquiries!inner (business_id, type_key, created_at, deleted_at, profiles (full_name))")
      .eq("kind", "team")
      .eq("status", "confirmed")
      .is("deleted_at", null)
      .eq("enquiries.business_id", businessId)
      .is("enquiries.deleted_at", null)
      .limit(MAX_CLAIMS),
    supabase
      .from("payouts")
      .select(PAYOUT_SELECT)
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("paid_on", { ascending: false })
      .limit(MAX_PAYOUTS),
    readLines(supabase, { businessId }),
  ]);

  for (const [what, res] of [
    ["classPeople", classPeopleRes],
    ["sessions", sessionsRes],
    ["team", teamRes],
    ["payouts", payoutsRes],
  ] as const) {
    if (res.error) {
      throw new Error(`payouts.findBusinessLedger(${what}) failed: ${res.error.message}`);
    }
  }

  const classPeople = (classPeopleRes.data ?? []) as unknown as ClassPersonRow[];
  const sessions = (sessionsRes.data ?? []) as unknown as SessionRow[];
  const payoutRows = (payoutsRes.data ?? []) as unknown as PayoutRow[];

  const sessionsByClass = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    const list = sessionsByClass.get(s.class_id);
    if (list) list.push(s);
    else sessionsByClass.set(s.class_id, [s]);
  }

  const byPerson = new Map<string, PersonPayLedger>();
  const personOf = (userId: string, name: string | null | undefined, kind: PersonPayLedger["kind"], offTeam: boolean) => {
    let p = byPerson.get(userId);
    if (!p) {
      p = { userId, personName: name ?? "Someone", kind, unpaid: [], unpaidEnquiries: [], unsettledCount: 0, paidInr: 0, paidSessions: 0, offTeam };
      byPerson.set(userId, p);
    } else {
      p.offTeam = p.offTeam && offTeam;
    }
    return p;
  };

  const seen = new Set<string>();
  for (const classPerson of classPeople) {
    const person = personOf(classPerson.user_id, classPerson.profiles?.full_name, classPerson.kind, classPerson.deleted_at !== null);
    const cutoff = accrualCutoff(classPerson.deleted_at, nowIso);
    for (const s of sessionsByClass.get(classPerson.class_id) ?? []) {
      if (s.ends_at >= cutoff) continue;
      const key = `${s.id}:${classPerson.user_id}`;
      if (lines.settled.has(key) || seen.has(key)) continue;
      seen.add(key);
      person.unpaid.push({
        sessionId: s.id,
        classId: classPerson.class_id,
        classTitle: classPerson.classes ? dosClassLabel(classPerson.classes.style, classPerson.classes.level) : "Class",
        classStyle: classPerson.classes?.style ?? "",
        startsAt: s.starts_at,
      });
    }
  }

  type TeamRow = { enquiry_id: string; user_id: string; role: string | null; created_at: string; profiles: unknown; enquiries: unknown };
  for (const t of (teamRes.data ?? []) as TeamRow[]) {
    const key = `${t.enquiry_id}:${t.user_id}`;
    if (lines.settled.has(key)) continue;
    const e = single(t.enquiries as { type_key: string; created_at: string; profiles: unknown } | null);
    const who = single(e?.profiles as { full_name: string | null } | null)?.full_name;
    const person = personOf(t.user_id, single(t.profiles as { full_name: string } | null)?.full_name, "team", false);
    const item: PayableEnquiry = { enquiryId: t.enquiry_id, label: enquiryLabel(e?.type_key, who), role: t.role, at: e?.created_at ?? t.created_at };
    person.unpaidEnquiries.push(item);
  }

  const payouts = payoutRows.map((p) => withLines(p, lines));
  for (const p of payouts) {
    const person = byPerson.get(p.userId);
    if (!person || p.status !== "done") continue;
    person.paidInr += p.amountInr;
    person.paidSessions += p.sessionCount;
  }
  for (const p of byPerson.values()) {
    p.unpaid.sort((a, b) => b.startsAt.localeCompare(a.startsAt));
    p.unpaidEnquiries.sort((a, b) => b.at.localeCompare(a.at));
    p.unsettledCount = p.unpaid.length + p.unpaidEnquiries.length;
  }

  const people = [...byPerson.values()].sort(
    (a, b) => b.unsettledCount - a.unsettledCount || a.personName.localeCompare(b.personName)
  );

  return {
    people,
    unsettledCount: people.reduce((a, p) => a + p.unsettledCount, 0),
    paidTotal: payouts.filter((p) => p.status === "done").reduce((a, p) => a + p.amountInr, 0),
    inTransitTotal: payouts.filter((p) => p.status !== "done").reduce((a, p) => a + p.amountInr, 0),
    payouts,
    complete:
      (classPeopleRes.data?.length ?? 0) < MAX_CLAIMS &&
      (sessionsRes.data?.length ?? 0) < MAX_SESSIONS &&
      (teamRes.data?.length ?? 0) < MAX_CLAIMS &&
      (payoutsRes.data?.length ?? 0) < MAX_PAYOUTS &&
      lines.complete,
  };
}

/** EVERY PAYMENT THIS BUSINESS HAS MADE TO ONE PERSON, with what each covered
 *  (29 Sep 2026; enquiries since 18 Oct 2026). `user_id` is said out loud —
 *  `payouts` admits the owner AND the payee. */
export async function findPersonPayHistory(
  supabase: SupabaseClient,
  businessId: string,
  userId: string
): Promise<PersonPayHistory> {
  const [payoutsRes, lines] = await Promise.all([
    supabase
      .from("payouts")
      .select(PAYOUT_SELECT)
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("paid_on", { ascending: false })
      .limit(MAX_PAYOUTS),
    readLines(supabase, { businessId, userId }),
  ]);
  if (payoutsRes.error) {
    throw new Error(`payouts.findPersonHistory(payouts) failed: ${payoutsRes.error.message}`);
  }
  const rows = (payoutsRes.data ?? []) as unknown as PayoutRow[];
  const payouts = rows.map((p) => withLines(p, lines));
  return {
    userId,
    personName: rows[0]?.profiles?.full_name ?? "",
    payouts,
    /* ⚠ SETTLED AND NOT-YET ARE TWO FIGURES, never one "paid" total */
    paidInr: payouts.filter((p) => p.status === "done").reduce((a, p) => a + p.amountInr, 0),
    pendingInr: payouts.filter((p) => p.status !== "done").reduce((a, p) => a + p.amountInr, 0),
    sessionsPaid: payouts.reduce((a, p) => a + p.sessionCount, 0),
    complete: rows.length < MAX_PAYOUTS && lines.complete,
  };
}

interface MyClassPersonRow extends ClassPersonRow {
  business_id: string;
  businesses: { name: string } | null;
}

interface MyPayoutRow extends PayoutRow {
  business_id: string;
  businesses: { name: string } | null;
}

/** What each business has paid ME and what is not yet settled there — the
 *  payee's side, under Other Teams. ⚠ No rupee figure for what is owed: the
 *  amount is set by the studio when it pays (18 Oct 2026). */
export async function findMyEarnings(
  supabase: SupabaseClient,
  userId: string,
  nowIso: string,
  /** the businesses this person OWNS — their own money is their own desk's */
  excludeBusinessIds: readonly string[] = []
): Promise<MyEarnings> {
  const [classPeopleRes, payoutsRes, lines, jobsRes] = await Promise.all([
    supabase
      .from("class_people")
      .select(`${CLAIM_SELECT}, business_id, businesses (name)`)
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .order("created_at", { ascending: false })
      .limit(MAX_CLAIMS),
    supabase
      .from("payouts")
      .select(`${PAYOUT_SELECT}, business_id, businesses (name)`)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("paid_on", { ascending: false })
      .limit(MAX_PAYOUTS),
    readLines(supabase, { userId }),
    /* the enquiries I am on the team of — a definer read, because a team member
       does not read the enquiry row itself */
    supabase.rpc("my_enquiry_jobs"),
  ]);

  for (const [what, res] of [
    ["classPeople", classPeopleRes],
    ["payouts", payoutsRes],
  ] as const) {
    if (res.error) {
      throw new Error(`payouts.findMyEarnings(${what}) failed: ${res.error.message}`);
    }
  }

  const skip = new Set(excludeBusinessIds);
  const classPeople = ((classPeopleRes.data ?? []) as unknown as MyClassPersonRow[]).filter((c) => !skip.has(c.business_id));
  const payoutRows = ((payoutsRes.data ?? []) as unknown as MyPayoutRow[]).filter((p) => !skip.has(p.business_id));

  const classIds = [...new Set(classPeople.map((c) => c.class_id))];
  let sessions: SessionRow[] = [];
  if (classIds.length > 0) {
    const { data, error } = await supabase
      .from("class_sessions")
      .select("id, class_id, starts_at, ends_at")
      .in("class_id", classIds)
      .lt("ends_at", nowIso)
      .is("deleted_at", null)
      .order("starts_at", { ascending: false })
      .limit(MAX_SESSIONS);
    if (error) {
      throw new Error(`payouts.findMyEarnings(sessions) failed: ${error.message}`);
    }
    sessions = (data ?? []) as unknown as SessionRow[];
  }
  const sessionsByClass = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    const list = sessionsByClass.get(s.class_id);
    if (list) list.push(s);
    else sessionsByClass.set(s.class_id, [s]);
  }

  const byBusiness = new Map<string, StudioEarning>();
  const rowOf = (businessId: string, name: string | null | undefined) => {
    let r = byBusiness.get(businessId);
    if (!r) {
      r = { businessId, businessName: name ?? "A studio", sessions: 0, unsettled: 0, paidInr: 0, otherPaidInr: 0 };
      byBusiness.set(businessId, r);
    }
    return r;
  };

  const seen = new Set<string>();
  for (const classPerson of classPeople) {
    const cutoff = accrualCutoff(classPerson.deleted_at, nowIso);
    const row = rowOf(classPerson.business_id, classPerson.businesses?.name);
    for (const s of sessionsByClass.get(classPerson.class_id) ?? []) {
      if (s.ends_at >= cutoff || seen.has(s.id)) continue;
      seen.add(s.id);
      row.sessions += 1;
      if (!lines.settled.has(`${s.id}:${userId}`)) row.unsettled += 1;
    }
  }

  /* an unsettled enquiry is filed under its host by NAME — the definer read gives
     the host's name and not its id, which is all a payee is allowed to know */
  type Job = { enquiry_id: string; kind: string; status: string; host_name: string | null };
  const jobs = jobsRes.error ? [] : ((jobsRes.data ?? []) as Job[]);
  for (const j of jobs) {
    if (j.kind !== "team" || j.status !== "confirmed") continue;
    if (lines.settled.has(`${j.enquiry_id}:${userId}`)) continue;
    const name = j.host_name ?? "A studio";
    const match = [...byBusiness.values()].find((b) => b.businessName === name);
    const row = match ?? rowOf(`name:${name}`, name);
    row.unsettled += 1;
  }

  const payouts = payoutRows.map((p) => ({ ...withLines(p, lines), businessId: p.business_id, businessName: p.businesses?.name ?? "A studio" }));
  for (const p of payouts) {
    if (p.status !== "done") continue;
    const row = rowOf(p.businessId, p.businessName);
    if (p.sessionCount > 0) row.paidInr += p.amountInr;
    else row.otherPaidInr += p.amountInr;
  }

  const studios = [...byBusiness.values()].sort(
    (a, b) => b.unsettled - a.unsettled || b.paidInr + b.otherPaidInr - (a.paidInr + a.otherPaidInr) || a.businessName.localeCompare(b.businessName)
  );
  return {
    studios,
    paidTotal: studios.reduce((a, s) => a + s.paidInr + s.otherPaidInr, 0),
    unsettledTotal: studios.reduce((a, s) => a + s.unsettled, 0),
    payouts,
  };
}

/** PAY ONE PERSON, at the amount typed now per class or enquiry (18 Oct 2026). */
export async function recordSessionPayment(
  supabase: SupabaseClient,
  input: {
    businessId: string;
    userId: string;
    lines: PayLine[];
    method: PayoutMethod;
    status: PayoutStatus;
    providerRef?: string | null;
    paidOn?: string | null;
    note?: string | null;
  }
): Promise<void> {
  const { error } = await supabase.rpc("record_session_payment", {
    p_business_id: input.businessId,
    p_user_id: input.userId,
    p_lines: input.lines.map((l) =>
      "sessionId" in l ? { session_id: l.sessionId, rate_inr: l.rateInr } : { enquiry_id: l.enquiryId, rate_inr: l.rateInr }
    ),
    p_method: input.method,
    p_status: input.status,
    p_provider_ref: input.providerRef ?? null,
    p_paid_on: input.paidOn ?? null,
    p_note: input.note ?? null,
  });
  if (error) {
    throw new Error(error.message);
  }
}

/** A payment that is NOT for a class or an enquiry (19 Sep 2026, R35 — kept at
 *  the user's word, 18 Oct 2026): an amount the owner states, with no lines. */
export async function recordTeamPayment(
  supabase: SupabaseClient,
  input: {
    businessId: string;
    userId: string;
    amountInr: number;
    method: PayoutMethod;
    status: PayoutStatus;
    paidOn?: string | null;
    note?: string | null;
  }
): Promise<void> {
  const { error } = await supabase.rpc("record_team_payment", {
    p_business_id: input.businessId,
    p_user_id: input.userId,
    p_amount_inr: input.amountInr,
    p_method: input.method,
    p_status: input.status,
    p_paid_on: input.paidOn ?? null,
    p_note: input.note ?? null,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function setPayoutStatus(
  supabase: SupabaseClient,
  payoutId: string,
  status: PayoutStatus,
  providerRef?: string | null
): Promise<void> {
  const { error } = await supabase.rpc("set_payout_status", {
    p_payout_id: payoutId,
    p_status: status,
    p_provider_ref: providerRef ?? null,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function voidPayout(supabase: SupabaseClient, payoutId: string): Promise<void> {
  const { error } = await supabase.rpc("void_payout", { p_payout_id: payoutId });
  if (error) {
    throw new Error(error.message);
  }
}

export type { PayableSession };
