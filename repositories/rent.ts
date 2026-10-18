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
  "id, payer_business_id, venue_business_id, amount_inr, status, method, provider_ref, paid_on, note, payer:businesses!rent_payments_payer_business_id_fkey (name), venue:businesses!rent_payments_venue_business_id_fkey (name), rent_lines (session_id, rate_inr, deleted_at, class_sessions (starts_at, classes (style, level)))";

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
  rent_lines: Array<{ session_id: string; rate_inr: number; deleted_at: string | null; class_sessions: unknown }> | null;
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
      return { sessionId: l.session_id, classTitle: cl ? dosClassLabel(cl.style, cl.level) : "Class", startsAt: cs?.starts_at ?? "", rateInr: l.rate_inr };
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

export async function voidRentPayment(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.rpc("void_rent_payment", { p_id: id });
  if (error) throw new Error(error.message);
}
