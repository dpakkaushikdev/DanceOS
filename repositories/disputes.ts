import type { SupabaseClient } from "@supabase/supabase-js";

/** DISPUTES, ONE PER PAYMENT ENTRY (19 Oct 2026, the user: "find proper
 *  mechanisms for dispute against these payments as well entry wise", and
 *  "should give total properly while paying or disputing").
 *
 *  An entry is a class line or an enquiry line of a team payment, a class line of
 *  a rent payment, or — for a lump sum, which has no lines — the payment itself.
 *  Raised by whoever was paid, answered by the payer's owner. RLS lets the two
 *  ends read it; every query here still says which payments it wants. */

export type DisputeKind = "payout_line" | "payout_enquiry_line" | "payout" | "rent_line" | "rent_payment";
export type DisputeStatus = "open" | "accepted" | "rejected" | "withdrawn";

export interface PaymentDispute {
  id: string;
  kind: DisputeKind;
  targetId: string;
  payoutId: string | null;
  rentPaymentId: string | null;
  amountInr: number;
  claimedInr: number | null;
  reason: string;
  status: DisputeStatus;
  response: string | null;
  raisedBy: string;
  createdAt: string;
  answeredAt: string | null;
}

const SELECT = "id, kind, target_id, payout_id, rent_payment_id, amount_inr, claimed_inr, reason, status, response, raised_by, created_at, answered_at";

type Row = {
  id: string;
  kind: DisputeKind;
  target_id: string;
  payout_id: string | null;
  rent_payment_id: string | null;
  amount_inr: number;
  claimed_inr: number | null;
  reason: string;
  status: DisputeStatus;
  response: string | null;
  raised_by: string;
  created_at: string;
  answered_at: string | null;
};

const toDispute = (r: Row): PaymentDispute => ({
  id: r.id,
  kind: r.kind,
  targetId: r.target_id,
  payoutId: r.payout_id,
  rentPaymentId: r.rent_payment_id,
  amountInr: r.amount_inr,
  claimedInr: r.claimed_inr,
  reason: r.reason,
  status: r.status,
  response: r.response,
  raisedBy: r.raised_by,
  createdAt: r.created_at,
  answeredAt: r.answered_at,
});

/** Every dispute on these team payments or rent payments, newest first. A read
 *  that degrades to none: a page must never fail over its disputes (and until
 *  the migration is applied the table is not there). */
export async function findDisputesFor(
  supabase: SupabaseClient,
  ids: { payoutIds?: readonly string[]; rentPaymentIds?: readonly string[] }
): Promise<PaymentDispute[]> {
  const out: PaymentDispute[] = [];
  const reads: Array<PromiseLike<{ data: unknown; error: unknown }>> = [];
  if (ids.payoutIds?.length) {
    reads.push(supabase.from("payment_disputes").select(SELECT).in("payout_id", [...ids.payoutIds]).is("deleted_at", null).order("created_at", { ascending: false }).limit(1000));
  }
  if (ids.rentPaymentIds?.length) {
    reads.push(supabase.from("payment_disputes").select(SELECT).in("rent_payment_id", [...ids.rentPaymentIds]).is("deleted_at", null).order("created_at", { ascending: false }).limit(1000));
  }
  for (const res of await Promise.all(reads)) {
    if (res.error) continue;
    out.push(...((res.data ?? []) as Row[]).map(toDispute));
  }
  return out;
}

/** An OPEN dispute as the Earnings screen lists it (28 Oct 2026): the amounts,
 *  who raised it, and the detail page of the entry it is about. */
export interface OpenDisputeRow {
  id: string;
  kind: DisputeKind;
  paidInr: number;
  claimedInr: number | null;
  reason: string;
  raisedByName: string;
  /** what the entry is — "Team pay to Asha", "Rent to Rhythm Studio" */
  about: string;
  /** the detail page of the entry: Member Detail's Money column, Other Team
   *  Detail's Rent or Paid column, or the renter's page */
  href: string;
  createdAt: string;
}

const MAX_OPEN = 400;

/** Open disputes on what this business paid its people (payouts) and on rent it
 *  paid or received. Every read says which business it wants — RLS is a ceiling,
 *  not a scope. Degrades to none: an Earnings page never fails over disputes. */
export async function findOpenDisputesForBusiness(supabase: SupabaseClient, businessId: string): Promise<OpenDisputeRow[]> {
  try {
    const [pay, rentOut, rentIn] = await Promise.all([
      supabase.from("payouts").select("id, user_id, profiles (full_name)").eq("business_id", businessId).is("deleted_at", null).limit(4000),
      supabase.from("rent_payments").select("id, venue_business_id, venue:businesses!rent_payments_venue_business_id_fkey (name)").eq("payer_business_id", businessId).is("deleted_at", null).limit(2000),
      supabase.from("rent_payments").select("id, payer_business_id, payer:businesses!rent_payments_payer_business_id_fkey (name)").eq("venue_business_id", businessId).is("deleted_at", null).limit(2000),
    ]);
    type P = { id: string; user_id: string; profiles: unknown };
    type RO = { id: string; venue_business_id: string; venue: unknown };
    type RI = { id: string; payer_business_id: string; payer: unknown };
    const one = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null));
    const payouts = new Map(((pay.error ? [] : pay.data ?? []) as P[]).map((p) => [p.id, p]));
    const out = new Map(((rentOut.error ? [] : rentOut.data ?? []) as RO[]).map((r) => [r.id, r]));
    const inn = new Map(((rentIn.error ? [] : rentIn.data ?? []) as RI[]).map((r) => [r.id, r]));
    const rentIds = [...out.keys(), ...inn.keys()];
    const reads: Array<PromiseLike<{ data: unknown; error: unknown }>> = [];
    if (payouts.size) reads.push(supabase.from("payment_disputes").select(SELECT).in("payout_id", [...payouts.keys()]).eq("status", "open").is("deleted_at", null).limit(MAX_OPEN));
    if (rentIds.length) reads.push(supabase.from("payment_disputes").select(SELECT).in("rent_payment_id", rentIds).eq("status", "open").is("deleted_at", null).limit(MAX_OPEN));
    const disputes: PaymentDispute[] = [];
    for (const res of await Promise.all(reads)) {
      if (!res.error) disputes.push(...((res.data ?? []) as Row[]).map(toDispute));
    }
    const names = await raiserNames(supabase, disputes);
    const rows: OpenDisputeRow[] = [];
    for (const d of disputes) {
      const base = { id: d.id, kind: d.kind, paidInr: d.amountInr, claimedInr: d.claimedInr, reason: d.reason, raisedByName: names.get(d.raisedBy) ?? "Somebody", createdAt: d.createdAt };
      if (d.payoutId && payouts.has(d.payoutId)) {
        const p = payouts.get(d.payoutId)!;
        const who = one(p.profiles as { full_name: string | null } | null)?.full_name ?? "a team member";
        rows.push({ ...base, about: `Team pay to ${who}`, href: `/business/${businessId}/staff/${p.user_id}?show=money` });
      } else if (d.rentPaymentId && out.has(d.rentPaymentId)) {
        const r = out.get(d.rentPaymentId)!;
        const venue = one(r.venue as { name: string } | null)?.name ?? "a studio";
        rows.push({ ...base, about: `Rent to ${venue}`, href: `/team/other/business/${r.venue_business_id}?show=rent` });
      } else if (d.rentPaymentId && inn.has(d.rentPaymentId)) {
        const r = inn.get(d.rentPaymentId)!;
        const payer = one(r.payer as { name: string } | null)?.name ?? "an artist";
        rows.push({ ...base, about: `Rent from ${payer}`, href: `/business/${businessId}/renters/${r.payer_business_id}` });
      }
    }
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

/** Open disputes this PERSON raised — on a team payment they received. Scoped to
 *  `raised_by = me` out loud. A rent dispute is raised as a business's owner and
 *  is listed on that business's Earnings instead. */
export async function findMyOpenDisputes(supabase: SupabaseClient, userId: string): Promise<OpenDisputeRow[]> {
  try {
    const { data, error } = await supabase
      .from("payment_disputes")
      .select(SELECT)
      .eq("raised_by", userId)
      .eq("status", "open")
      .not("payout_id", "is", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(MAX_OPEN);
    if (error) return [];
    const disputes = ((data ?? []) as Row[]).map(toDispute);
    const payoutIds = [...new Set(disputes.map((d) => d.payoutId).filter((x): x is string => Boolean(x)))];
    if (payoutIds.length === 0) return [];
    const { data: pays } = await supabase.from("payouts").select("id, business_id, businesses (name)").in("id", payoutIds).eq("user_id", userId);
    const one = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null));
    const byId = new Map(((pays ?? []) as Array<{ id: string; business_id: string; businesses: unknown }>).map((p) => [p.id, p]));
    return disputes.flatMap((d) => {
      const p = d.payoutId ? byId.get(d.payoutId) : undefined;
      if (!p) return [];
      const name = one(p.businesses as { name: string } | null)?.name ?? "a team";
      return [
        {
          id: d.id,
          kind: d.kind,
          paidInr: d.amountInr,
          claimedInr: d.claimedInr,
          reason: d.reason,
          raisedByName: "You",
          about: `Pay from ${name}`,
          href: `/team/other/business/${p.business_id}?show=paid`,
          createdAt: d.createdAt,
        },
      ];
    });
  } catch {
    return [];
  }
}

async function raiserNames(supabase: SupabaseClient, ds: readonly PaymentDispute[]): Promise<Map<string, string>> {
  const ids = [...new Set(ds.map((d) => d.raisedBy))];
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  if (error) return new Map();
  return new Map(((data ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [p.id, p.full_name ?? "Somebody"]));
}

/** The latest dispute per entry — what an entry's control shows. */
export const latestByTarget = (ds: readonly PaymentDispute[]): Map<string, PaymentDispute> => {
  const m = new Map<string, PaymentDispute>();
  for (const d of ds) {
    const was = m.get(d.targetId);
    if (!was || was.createdAt < d.createdAt) m.set(d.targetId, d);
  }
  return m;
};

/** The disputed total: the gap between what was paid and what is claimed on
 *  every OPEN dispute (the whole entry when no amount was claimed). */
export const disputedInr = (ds: readonly PaymentDispute[]): number =>
  ds.filter((d) => d.status === "open").reduce((n, d) => n + (d.claimedInr === null ? d.amountInr : Math.abs(d.claimedInr - d.amountInr)), 0);

export async function raiseDispute(
  supabase: SupabaseClient,
  input: { kind: DisputeKind; targetId: string; reason: string; claimedInr: number | null }
): Promise<string> {
  const { data, error } = await supabase.rpc("raise_payment_dispute", {
    p_kind: input.kind,
    p_target_id: input.targetId,
    p_reason: input.reason,
    p_claimed_inr: input.claimedInr,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function answerDispute(supabase: SupabaseClient, input: { id: string; accept: boolean; response: string | null }): Promise<void> {
  const { error } = await supabase.rpc("answer_payment_dispute", { p_id: input.id, p_accept: input.accept, p_response: input.response });
  if (error) throw new Error(error.message);
}

export async function withdrawDispute(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.rpc("withdraw_payment_dispute", { p_id: id });
  if (error) throw new Error(error.message);
}
