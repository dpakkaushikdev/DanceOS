"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { answerDispute, raiseDispute, withdrawDispute } from "@/repositories/disputes";
import { recordTeamPayment } from "@/repositories/payouts";
import { recordRentAmount } from "@/repositories/rent";

/** ⚠ Money-adjacent. A dispute RECORDS a disagreement about a payment entry; since
 *  19 Oct 2026 accepting an underpayment may also RECORD the difference as a
 *  payment (still a record — DanceOS moves no money, Step 13). Who may raise, answer and withdraw is the database's to decide
 *  (raise/answer/withdraw_payment_dispute) — this only checks the shape. */

export interface DisputeActionResult {
  error: string | null;
}

const KIND = z.enum(["payout_line", "payout_enquiry_line", "payout", "rent_line", "rent_payment"]);

const raiseSchema = z.object({
  kind: KIND,
  targetId: z.string().uuid(),
  reason: z.string().trim().min(3, "Say what is wrong").max(300, "Keep it under 300 characters"),
  claimedInr: z.number().int().min(0).max(100000000).nullable(),
});
const answerSchema = z.object({
  id: z.string().uuid(),
  accept: z.boolean(),
  response: z.string().trim().max(300).nullable(),
  /** ⚠ accepting an UNDERPAYMENT may record the difference in the same press
   *  (19 Oct 2026 — "disputes are a record only" was the open gap). Only ever the
   *  difference the database already holds (claimed − paid), never a client figure. */
  settleMethod: z.enum(["bank_transfer", "upi", "cash", "other"]).nullable().optional(),
});
const idSchema = z.object({ id: z.string().uuid() });

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return supabase;
}

/* the two ends of every payment: the payer's desk and the payee's own pages */
function revalidateDisputeSurfaces() {
  revalidatePath("/business/[businessId]/staff", "page");
  revalidatePath("/business/[businessId]/staff/[userId]", "page");
  revalidatePath("/team", "layout");
  revalidatePath("/business/[businessId]/earnings", "page");
  revalidatePath("/earnings");
}

const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

export async function raiseDisputeAction(input: z.input<typeof raiseSchema>): Promise<DisputeActionResult> {
  const parsed = raiseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid dispute" };
  const supabase = await requireUser();
  try {
    await raiseDispute(supabase, parsed.data);
    revalidateDisputeSurfaces();
    return { error: null };
  } catch (e) {
    return { error: message(e, "Could not raise that dispute") };
  }
}

export async function answerDisputeAction(input: z.input<typeof answerSchema>): Promise<DisputeActionResult> {
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid answer" };
  const supabase = await requireUser();
  const { id, accept, response, settleMethod } = parsed.data;
  try {
    await answerDispute(supabase, { id, accept, response: response || null });
  } catch (e) {
    return { error: message(e, "Could not answer that dispute") };
  }
  /* ⚠ THE DIFFERENCE, RECORDED (Rule 9). Read back under the caller's own RLS —
     the payer just answered it, so they can read it — and the amount is the row's
     claimed − paid. A team payment goes through `record_team_payment`, rent through
     `record_rent_amount`; both re-check that the caller is the payer's owner. The
     note carries the dispute's id, so a second press finds it and records nothing. */
  if (accept && settleMethod) {
    try {
      const { data: d } = await supabase
        .from("payment_disputes")
        .select("id, payout_id, rent_payment_id, amount_inr, claimed_inr, status")
        .eq("id", id)
        .maybeSingle();
      const gap = d && d.claimed_inr !== null ? d.claimed_inr - d.amount_inr : 0;
      if (d && d.status === "accepted" && gap > 0) {
        const marker = `[dispute ${d.id.slice(0, 8)}]`;
        const note = `Settles an accepted dispute ${marker}`;
        if (d.payout_id) {
          const { data: p } = await supabase.from("payouts").select("business_id, user_id").eq("id", d.payout_id).maybeSingle();
          if (!p) throw new Error("That payment could not be read");
          const { data: dup } = await supabase.from("payouts").select("id").eq("business_id", p.business_id).eq("user_id", p.user_id).is("deleted_at", null).like("note", `%${marker}%`).limit(1);
          if (!dup?.length) await recordTeamPayment(supabase, { businessId: p.business_id, userId: p.user_id, amountInr: gap, method: settleMethod, status: "done", note });
        } else if (d.rent_payment_id) {
          const { data: r } = await supabase.from("rent_payments").select("payer_business_id, venue_business_id").eq("id", d.rent_payment_id).maybeSingle();
          if (!r) throw new Error("That rent payment could not be read");
          const { data: dup } = await supabase.from("rent_payments").select("id").eq("payer_business_id", r.payer_business_id).eq("venue_business_id", r.venue_business_id).is("deleted_at", null).like("note", `%${marker}%`).limit(1);
          if (!dup?.length) await recordRentAmount(supabase, { payerBusinessId: r.payer_business_id, venueBusinessId: r.venue_business_id, amountInr: gap, method: settleMethod, status: "done", note });
        }
      }
    } catch (e) {
      revalidateDisputeSurfaces();
      return { error: `Accepted — but the difference was not recorded: ${message(e, "try recording it as a payment")}` };
    }
  }
  revalidateDisputeSurfaces();
  return { error: null };
}

export async function withdrawDisputeAction(input: { id: string }): Promise<DisputeActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request" };
  const supabase = await requireUser();
  try {
    await withdrawDispute(supabase, parsed.data.id);
    revalidateDisputeSurfaces();
    return { error: null };
  } catch (e) {
    return { error: message(e, "Could not withdraw that dispute") };
  }
}
