"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordSessionPayment, setPayoutStatus, voidPayout } from "@/repositories/payouts";
import { recordRentPayment, voidRentPayment } from "@/repositories/rent";

/** ⚠ Money. Team pay and rent are RECORDS of a settlement already made — DanceOS
 *  moves no money (Step 13), and Cashfree Payouts is "switched on later" (the
 *  user's answer, 18 Oct 2026).
 *
 *  ⚠ PAY IS SET WHEN PAYING (18 Oct 2026): the amount for each class or enquiry
 *  is typed in the pay sheet, so it IS taken from the client — bounded here and
 *  again in the RPC (a whole rupee, at most ₹10,00,000 a line). What the client
 *  cannot choose is WHAT it pays for: the RPCs refuse a class the person was not
 *  on, one that has not happened, an enquiry they were not on the team of, and
 *  anything already settled; and only the payer's OWNER may record at all. */

export interface PayoutActionResult {
  error: string | null;
}

const METHOD = z.enum(["bank_transfer", "upi", "cash", "other"]);
const STATUS = z.enum(["done", "in_transit", "on_hold", "failed"]);
const AMOUNT = z.number().int().min(0).max(1_000_000);
const meta = {
  method: METHOD,
  status: STATUS,
  /* a UTR, a UPI id or a Cashfree reference — the studio's own note */
  providerRef: z.string().trim().max(120).optional().nullable(),
  paidOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "not a date")
    .optional()
    .nullable(),
  note: z.string().trim().max(500).optional().nullable(),
};

const lineSchema = z.union([
  z.object({ sessionId: z.string().uuid(), rateInr: AMOUNT }),
  z.object({ enquiryId: z.string().uuid(), rateInr: AMOUNT }),
]);

const sessionPaySchema = z
  .object({
    businessId: z.string().uuid(),
    userId: z.string().uuid(),
    lines: z.array(lineSchema).min(1).max(200),
    ...meta,
  })
  .refine((v) => v.lines.some((l) => l.rateInr > 0), { message: "Enter an amount for at least one" });

const rentSchema = z
  .object({
    payerBusinessId: z.string().uuid(),
    venueBusinessId: z.string().uuid(),
    lines: z.array(z.object({ sessionId: z.string().uuid(), rateInr: AMOUNT })).min(1).max(200),
    ...meta,
  })
  .refine((v) => v.lines.some((l) => l.rateInr > 0), { message: "Enter an amount for at least one" });

const statusSchema = z.object({
  payoutId: z.string().uuid(),
  status: STATUS,
  providerRef: z.string().trim().max(120).optional().nullable(),
});

const idSchema = z.object({ id: z.string().uuid() });
const payoutIdSchema = z.object({ payoutId: z.string().uuid() });

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  return supabase;
}

/** Both sides of the ledger change at once: the payer's desk, the payee's Other
 *  Teams, and both Earnings screens. */
function revalidateMoneySurfaces(businessId?: string) {
  if (businessId) {
    revalidatePath(`/business/${businessId}/earnings`);
    revalidatePath(`/business/${businessId}/staff`);
  }
  revalidatePath("/business/[businessId]/earnings", "page");
  revalidatePath("/business/[businessId]/staff", "page");
  revalidatePath("/business/[businessId]/staff/[userId]", "page");
  revalidatePath("/team");
  revalidatePath("/earnings");
  revalidatePath("/");
}

const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Something went wrong — please try again.";

/** PAY ONE PERSON for the classes and enquiries ticked, at the amounts typed. */
export async function recordSessionPaymentAction(input: z.input<typeof sessionPaySchema>): Promise<PayoutActionResult> {
  const parsed = sessionPaySchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }
  /* a line at ₹0 is a class settled for nothing — allowed (a favour is a real
     answer), but only beside at least one paid line, said above */
  const supabase = await requireUser();
  try {
    await recordSessionPayment(supabase, parsed.data);
    revalidateMoneySurfaces(parsed.data.businessId);
    return { error: null };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Could not record that payment" };
  }
}

/** PAY A STUDIO RENT for the classes ticked — past or still to run. */
export async function recordRentPaymentAction(input: z.input<typeof rentSchema>): Promise<PayoutActionResult> {
  const parsed = rentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: firstIssue(parsed.error) };
  }
  const supabase = await requireUser();
  try {
    await recordRentPayment(supabase, parsed.data);
    revalidateMoneySurfaces(parsed.data.payerBusinessId);
    revalidateMoneySurfaces(parsed.data.venueBusinessId);
    return { error: null };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Could not record that rent" };
  }
}

/* ⚠ NO LUMP-SUM RENT (19 Oct 2026, the user: "remove lump sump for studio rent")
   — `recordRentAmountAction` is deleted so nothing in the app can send one; the
   RPC stays in the database, and a lump sum recorded before today still reads as
   one ("Lump sum" in its payment row). */

export async function voidRentPaymentAction(input: { id: string }): Promise<PayoutActionResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Something went wrong — please try again." };
  }
  const supabase = await requireUser();
  try {
    await voidRentPayment(supabase, parsed.data.id);
    revalidateMoneySurfaces();
    return { error: null };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Could not void that rent" };
  }
}

export async function setPayoutStatusAction(input: {
  payoutId: string;
  status: "done" | "in_transit" | "on_hold" | "failed";
  providerRef?: string | null;
}): Promise<PayoutActionResult> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Something went wrong — please try again." };
  }
  const supabase = await requireUser();
  try {
    await setPayoutStatus(supabase, parsed.data.payoutId, parsed.data.status, parsed.data.providerRef);
    revalidateMoneySurfaces();
    return { error: null };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Could not update that payment" };
  }
}

/** Voiding releases the payout's classes AND enquiries so they can be settled
 *  again — for a payment recorded by mistake. Soft-deleted, so the mistake stays
 *  readable. */
export async function voidPayoutAction(input: { payoutId: string }): Promise<PayoutActionResult> {
  const parsed = payoutIdSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Something went wrong — please try again." };
  }
  const supabase = await requireUser();
  try {
    await voidPayout(supabase, parsed.data.payoutId);
    revalidateMoneySurfaces();
    return { error: null };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Could not void that payment" };
  }
}
