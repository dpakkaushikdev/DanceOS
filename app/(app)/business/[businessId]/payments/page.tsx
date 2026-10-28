import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PaymentsScreen } from "@/features/settings/components/PaymentsScreen";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findBusinessInvoices, methodUsesOf } from "@/repositories/invoices";
import { findMyMemberships, runsTheBusiness } from "@/repositories/businesses";
import { findRefundWindowHours } from "@/repositories/refundWindow";

export const metadata: Metadata = { title: "Payments — DanceOS" };

/** /business/{id}/payments — Payments (S_payments 16531): how students paid
 *  and the ACCEPTED FROM STUDENTS switches (the owner's to flip, through the
 *  one owner-only door). Members read it; the switches move for the owner alone.
 *  ⚠ NO VERIFICATION TAB (28 Oct 2026): a studio's verification is its own page,
 *  the Settings tile's. An address asking for the old tab (`?tab=` / `?show=`
 *  verification) lands there for a studio (Rule 14), and on this page otherwise. */
export default async function BusinessPaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ tab?: string; show?: string }>;
}) {
  const { businessId } = await params;
  const sp = await searchParams;
  const wantsVerification = [sp.tab, sp.show].some((v) => v === "ver" || v === "verification");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  /* ⚠ the seat has to RUN the business (28 Sep 2026) — one read, not two: the
     seat carries the business AND the role this page was fetching separately */
  const seat = (await findMyMemberships(supabase)).find((m) => m.business.id === businessId);
  if (!seat || !runsTheBusiness(seat.memberRole)) redirect("/business");
  const { business, memberRole: role } = seat;
  if (wantsVerification) {
    redirect(business.type === "studio" && role === "owner" ? `/business/${businessId}/verification` : `/business/${businessId}/payments`);
  }
  /* the studio's own refund window (11 Oct 2026) rides beside the ledger read —
     it answers 12 on any failure, so it can never take the page down */
  const [rows, refundWindowHours] = await Promise.all([findBusinessInvoices(supabase, businessId), findRefundWindowHours(supabase, businessId)]);
  return <PaymentsScreen side="business" methods={methodUsesOf(rows)} business={business} canEdit={role === "owner"} refundWindowHours={refundWindowHours} />;
}
