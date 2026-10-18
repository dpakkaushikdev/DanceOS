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
