"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { answerDispute, raiseDispute, withdrawDispute } from "@/repositories/disputes";

/** ⚠ Money-adjacent. A dispute RECORDS a disagreement about a payment entry; it
 *  moves no money. Who may raise, answer and withdraw is the database's to decide
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
  try {
    await answerDispute(supabase, { ...parsed.data, response: parsed.data.response || null });
    revalidateDisputeSurfaces();
    return { error: null };
  } catch (e) {
    return { error: message(e, "Could not answer that dispute") };
  }
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
