import type { SupabaseClient } from "@supabase/supabase-js";
import { dosClassLabel } from "@/lib/constants/styles";
import type { PayableSession, PayoutMethod, PayoutStatus, RentPayment, RentVenue } from "@/types/payout";

/** RENT (18 Oct 2026, the user: "when an artist making class and adding studio
 *  should get option to pay that studio rent in same way from other team").
 *
 *  An artist's page holds a class in a studio's room once the studio ACCEPTED
 *  the request; that class's sessions are what rent is paid for, at an amount the
 *  artist types when paying. Rent may be paid AHEAD (the user's answer), so a
 *  session still to run is payable too. `rent_payments` / `rent_lines` admit the
 *  people who run either side; every query here still says which side it wants
 *  (RLS is a ceiling, not a scope). */

const MAX = 2000;
const single = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null));

const PAY_SELECT =
  "id, payer_business_id, venue_business_id, amount_inr, status, method, provider_ref, paid_on, note, payer:businesses!rent_payments_payer_business_id_fkey (name), venue:businesses!rent_payments_venue_business_id_fkey (name), rent_lines (id, session_id, rate_inr, deleted_at, class_sessions (starts_at, classes (style, level)))";

type PayRow = {
  id: string;
  payer_business_id: string;
  venue_business_id: string;
  amount_inr: number;
  status: PayoutStatus;
  method: PayoutMethod;
  provider_ref: string | null;
  paid_on: string;
  note: string | null;
  payer: unknown;
  venue: unknown;
  rent_lines: Array<{ id: string; session_id: string; rate_inr: number; deleted_at: string | null; class_sessions: unknown }> | null;
};

const toPayment = (r: PayRow): RentPayment => ({
  id: r.id,
  payerBusinessId: r.payer_business_id,
  payerName: single(r.payer as { name: string } | null)?.name ?? "An artist",
  venueBusinessId: r.venue_business_id,
  venueName: single(r.venue as { name: string } | null)?.name ?? "A studio",
  amountInr: r.amount_inr,
  status: r.status,
  method: r.method,
  providerRef: r.provider_ref,
  paidOn: r.paid_on,
  note: r.note,
  sessions: (r.rent_lines ?? [])
    .filter((l) => l.deleted_at === null)
    .map((l) => {
      const cs = single(l.class_sessions as { starts_at: string; classes: unknown } | null);
      const cl = single(cs?.classes as { style: string; level: string } | null);
      return { sessionId: l.session_id, classTitle: cl ? dosClassLabel(cl.style, cl.level) : "Class", startsAt: cs?.starts_at ?? "", rateInr: l.rate_inr, lineId: l.id };
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
});

/** The studios this artist's page holds classes in, what is not yet paid for
 *  there, and what has been. */
export async function findRentVenues(supabase: SupabaseClient, payerBusinessId: string): Promise<RentVenue[]> {
  const [classesRes, paysRes] = await Promise.all([
    supabase
      .from("classes")
      .select("id, style, level, venue_business_id, venue:businesses!classes_venue_business_id_fkey (name), class_sessions (id, starts_at, deleted_at)")
      .eq("business_id", payerBusinessId)
      .eq("venue_status", "accepted")
      .not("venue_business_id", "is", null)
      .is("deleted_at", null)
      .limit(MAX),
    supabase
      .from("rent_payments")
      .select(PAY_SELECT)
      .eq("payer_business_id", payerBusinessId)
      .is("deleted_at", null)
      .order("paid_on", { ascending: false })
      .limit(MAX),
  ]);
  if (classesRes.error) throw new Error(`rent.venues(classes) failed: ${classesRes.error.message}`);
  if (paysRes.error) throw new Error(`rent.venues(payments) failed: ${paysRes.error.message}`);

  const payments = ((paysRes.data ?? []) as unknown as PayRow[]).map(toPayment);
  const paid = new Set(payments.flatMap((p) => p.sessions.map((s) => s.sessionId)));

  const byVenue = new Map<string, RentVenue>();
  const venueOf = (id: string, name: string | null | undefined) => {
    let v = byVenue.get(id);
    if (!v) {
      v = { venueBusinessId: id, venueName: name ?? "A studio", unpaid: [], payments: [], paidInr: 0 };
      byVenue.set(id, v);
    }
    return v;
  };

  type ClassRow = { id: string; style: string; level: string; venue_business_id: string; venue: unknown; class_sessions: Array<{ id: string; starts_at: string; deleted_at: string | null }> | null };
  for (const c of (classesRes.data ?? []) as unknown as ClassRow[]) {
    const v = venueOf(c.venue_business_id, single(c.venue as { name: string } | null)?.name);
    for (const s of c.class_sessions ?? []) {
      if (s.deleted_at !== null || paid.has(s.id)) continue;
      const item: PayableSession = { sessionId: s.id, classId: c.id, classTitle: dosClassLabel(c.style, c.level), classStyle: c.style, startsAt: s.starts_at };
      v.unpaid.push(item);
    }
  }
  for (const p of payments) {
    const v = venueOf(p.venueBusinessId, p.venueName);
    if (v.venueName === "A studio") v.venueName = p.venueName;
    v.payments.push(p);
    if (p.status === "done") v.paidInr += p.amountInr;
  }
  for (const v of byVenue.values()) v.unpaid.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return [...byVenue.values()].sort((a, b) => b.unpaid.length - a.unpaid.length || a.venueName.localeCompare(b.venueName));
}

/** Rent this studio has been paid, newest first — the venue's side. */
export async function findRentReceived(supabase: SupabaseClient, venueBusinessId: string): Promise<RentPayment[]> {
  const { data, error } = await supabase
    .from("rent_payments")
    .select(PAY_SELECT)
    .eq("venue_business_id", venueBusinessId)
    .is("deleted_at", null)
    .order("paid_on", { ascending: false })
    .limit(MAX);
  if (error) throw new Error(`rent.received failed: ${error.message}`);
  return ((data ?? []) as unknown as PayRow[]).map(toPayment);
}

/** RENT RECEIVED, WITH WHO RECORDED IT (19 Oct 2026, the user: "rent received in
 *  studio should also be handled inside the person whom it is received from").
 *  The payer is an artist PAGE; the person behind it is whoever recorded the
 *  payment — `rent_payments.created_by`, the page's owner. The venue's side,
 *  scoped to this venue out loud. A new read beside `findRentReceived`, which
 *  keeps its shape. */
export async function findRentReceivedByPerson(supabase: SupabaseClient, venueBusinessId: string): Promise<Array<RentPayment & { recordedBy: string | null }>> {
  const { data, error } = await supabase
    .from("rent_payments")
    .select(`${PAY_SELECT}, created_by`)
    .eq("venue_business_id", venueBusinessId)
    .is("deleted_at", null)
    .order("paid_on", { ascending: false })
    .limit(MAX);
  if (error) throw new Error(`rent.receivedByPerson failed: ${error.message}`);
  return ((data ?? []) as unknown as Array<PayRow & { created_by: string | null }>).map((r) => ({ ...toPayment(r), recordedBy: r.created_by ?? null }));
}

/** The classes one artist page holds in this studio's rooms (accepted), with how
 *  many sessions have run and are to come — the renter's page on the venue's
 *  side. The venue's team reads these through the 18 Sep venue policies. */
export async function findClassesHeldByRenter(
  supabase: SupabaseClient,
  venueBusinessId: string,
  payerBusinessId: string,
  nowIso: string
): Promise<Array<{ classId: string; title: string; held: number; upcoming: number; nextAt: string | null; lastAt: string | null }>> {
  const { data, error } = await supabase
    .from("classes")
    .select("id, style, level, class_sessions (id, starts_at, ends_at, deleted_at)")
    .eq("venue_business_id", venueBusinessId)
    .eq("business_id", payerBusinessId)
    .eq("venue_status", "accepted")
    .is("deleted_at", null)
    .limit(MAX);
  if (error) throw new Error(`rent.heldByRenter failed: ${error.message}`);
  type Row = { id: string; style: string; level: string; class_sessions: Array<{ id: string; starts_at: string; ends_at: string; deleted_at: string | null }> | null };
  return ((data ?? []) as unknown as Row[])
    .map((c) => {
      const live = (c.class_sessions ?? []).filter((s) => s.deleted_at === null);
      const past = live.filter((s) => s.ends_at <= nowIso).map((s) => s.starts_at).sort();
      const ahead = live.filter((s) => s.ends_at > nowIso).map((s) => s.starts_at).sort();
      return { classId: c.id, title: dosClassLabel(c.style, c.level), held: past.length, upcoming: ahead.length, nextAt: ahead[0] ?? null, lastAt: past[past.length - 1] ?? null };
    })
    .sort((a, b) => (b.nextAt ?? b.lastAt ?? "").localeCompare(a.nextAt ?? a.lastAt ?? ""));
}

/** EVERY ARTIST PAGE THAT HOLDS CLASSES IN THIS STUDIO'S ROOMS (19 Oct 2026, the
 *  user: "rent received for studio team section should be inside team detail for
 *  that specific person"). Who rents here, whether or not they have paid yet —
 *  the Team desk draws them as cards with NO money (money lives on the detail
 *  page), and Member Detail's Rent column reads the one whose owner it is.
 *  The venue's team reads these classes through the 18 Sep venue policies. */
export async function findRenters(
  supabase: SupabaseClient,
  venueBusinessId: string
): Promise<Array<{ payerBusinessId: string; payerName: string; classes: number; ownerUserId: string | null; ownerName: string | null; photoPath: string | null }>> {
  const { data, error } = await supabase
    .from("classes")
    .select("business_id, created_by, owner:businesses!classes_business_id_fkey (name)")
    .eq("venue_business_id", venueBusinessId)
    .eq("venue_status", "accepted")
    .neq("business_id", venueBusinessId)
    .is("deleted_at", null)
    .limit(MAX);
  if (error) throw new Error(`rent.renters failed: ${error.message}`);
  type G = { payerBusinessId: string; payerName: string; classes: number; ownerUserId: string | null; ownerName: string | null; photoPath: string | null };
  const by = new Map<string, G>();
  /* ⚠ THE PERSON BEHIND THE PAGE IS WHOEVER MADE ITS CLASSES — an artist page's
     classes are created by its owner, and a venue cannot read another business's
     seats, so `created_by` is the one fact both sides can see */
  for (const r of (data ?? []) as Array<{ business_id: string; created_by: string | null; owner: unknown }>) {
    const g = by.get(r.business_id) ?? { payerBusinessId: r.business_id, payerName: single(r.owner as { name: string } | null)?.name ?? "An artist", classes: 0, ownerUserId: r.created_by, ownerName: null, photoPath: null };
    g.classes += 1;
    by.set(r.business_id, g);
  }
  const ids = [...new Set([...by.values()].flatMap((g) => (g.ownerUserId ? [g.ownerUserId] : [])))];
  if (ids.length) {
    const { data: people } = await supabase.from("profiles").select("id, full_name, profile_photo_path").in("id", ids);
    const pm = new Map(((people ?? []) as Array<{ id: string; full_name: string | null; profile_photo_path: string | null }>).map((p) => [p.id, p]));
    for (const g of by.values()) {
      const p = g.ownerUserId ? pm.get(g.ownerUserId) : undefined;
      g.ownerName = p?.full_name ?? null;
      g.photoPath = p?.profile_photo_path ?? null;
    }
  }
  return [...by.values()].sort((a, b) => a.payerName.localeCompare(b.payerName));
}

/** Rent paid by or to these businesses, for the Earnings ledger: the payer's
 *  expense and the venue's revenue. */
export async function findRentForEarnings(
  supabase: SupabaseClient,
  businessIds: readonly string[]
): Promise<{ paid: RentPayment[]; received: RentPayment[]; complete: boolean }> {
  if (businessIds.length === 0) return { paid: [], received: [], complete: true };
  const ids = [...businessIds];
  const [a, b] = await Promise.all([
    supabase.from("rent_payments").select(PAY_SELECT).in("payer_business_id", ids).is("deleted_at", null).limit(MAX),
    supabase.from("rent_payments").select(PAY_SELECT).in("venue_business_id", ids).is("deleted_at", null).limit(MAX),
  ]);
  if (a.error) throw new Error(`rent.earnings(paid) failed: ${a.error.message}`);
  if (b.error) throw new Error(`rent.earnings(received) failed: ${b.error.message}`);
  return {
    paid: ((a.data ?? []) as unknown as PayRow[]).map(toPayment),
    received: ((b.data ?? []) as unknown as PayRow[]).map(toPayment),
    complete: (a.data?.length ?? 0) < MAX && (b.data?.length ?? 0) < MAX,
  };
}

export async function recordRentPayment(
  supabase: SupabaseClient,
  input: {
    payerBusinessId: string;
    venueBusinessId: string;
    lines: Array<{ sessionId: string; rateInr: number }>;
    method: PayoutMethod;
    status: PayoutStatus;
    providerRef?: string | null;
    paidOn?: string | null;
    note?: string | null;
  }
): Promise<void> {
  const { error } = await supabase.rpc("record_rent_payment", {
    p_payer_business_id: input.payerBusinessId,
    p_venue_business_id: input.venueBusinessId,
    p_lines: input.lines.map((l) => ({ session_id: l.sessionId, rate_inr: l.rateInr })),
    p_method: input.method,
    p_status: input.status,
    p_provider_ref: input.providerRef ?? null,
    p_paid_on: input.paidOn ?? null,
    p_note: input.note ?? null,
  });
  if (error) throw new Error(error.message);
}

/** Rent as a lump sum, against no class (19 Oct 2026). */
export async function recordRentAmount(
  supabase: SupabaseClient,
  input: {
    payerBusinessId: string;
    venueBusinessId: string;
    amountInr: number;
    method: PayoutMethod;
    status: PayoutStatus;
    providerRef?: string | null;
    paidOn?: string | null;
    note?: string | null;
  }
): Promise<void> {
  const { error } = await supabase.rpc("record_rent_amount", {
    p_payer_business_id: input.payerBusinessId,
    p_venue_business_id: input.venueBusinessId,
    p_amount_inr: input.amountInr,
    p_method: input.method,
    p_status: input.status,
    p_provider_ref: input.providerRef ?? null,
    p_paid_on: input.paidOn ?? null,
    p_note: input.note ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function voidRentPayment(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.rpc("void_rent_payment", { p_id: id });
  if (error) throw new Error(error.message);
}
