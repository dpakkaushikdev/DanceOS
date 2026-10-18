import { redirect } from "next/navigation";
import { EarningsDesk } from "@/features/payouts/components/EarningsDesk";
import { EarningsScreen } from "@/features/payouts/components/EarningsScreen";
import { asRange } from "@/features/payouts/earningsRange";
import { asPeriod } from "@/lib/format/period";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findBusinessEarnings } from "@/repositories/earnings";
import { findBusinessIncome } from "@/repositories/income";
import { findMyMemberships, runsTheBusiness } from "@/repositories/businesses";

/* the clock lives outside the component — this repo's lint refuses an impure
   call during render (react-hooks/purity), even in a server component */
const stampNowIso = (): string => new Date().toISOString();

export default async function BusinessEarningsPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { businessId } = await params;
  const sp = await searchParams;
  const period = asPeriod(sp.period);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  /* ⚠ the seat has to RUN the business before any of this is even reachable
     (28 Sep 2026) — and the role rides that read, so the separate one is gone */
  const seat = (await findMyMemberships(supabase)).find((m) => m.business.id === businessId);
  if (!seat || !runsTheBusiness(seat.memberRole)) {
    redirect("/business");
  }
  const business = seat.business;

  /* ⚠ owner-only, checked on the server and not merely hidden in the UI: the
     prototype's settings footnote is explicit that payout approval is the
     owner's alone and cannot be granted (18434), and it gates the earnings
     screen itself on `isMine`. RLS backs the pay half up — the payouts table
     admits the owner and the person paid, nobody else. The income half is a
     PRESENTATION gate only: Step 9 admits every member of the business to the
     payments and refunds it sums, which the proof script asserts on purpose.
     ⚠ A MANAGER IS DELIBERATELY NOT ADMITTED: running the place is not the same
     as being handed its money, and the footnote says so of the owner's alone. */
  const role = seat.memberRole;
  if (role !== "owner") {
    redirect(`/business/${businessId}`);
  }

  const now = stampNowIso();
  const range = asRange(sp.from, sp.to);
  const [report, income] = await Promise.all([
    findBusinessEarnings(supabase, [businessId], period, now, range),
    findBusinessIncome(supabase, businessId, now),
  ]);

  /* ⚠ NO "OWED" LINE (18 Oct 2026, the user: "remove both of them from
     earnings"): what this business has PAID its people and its studios is in
     EXPENSES, the rent it was paid in REVENUE; what is not settled is the Team
     section's, where the amount is set. The desk below keeps the month
     statements and their CSV. */
  return (
    <EarningsScreen
      report={report}
      title="Earnings"
      sub={`${business.name} · ${business.type === "artist_page" ? "Artist" : "Studio"}`}
      basePath={`/business/${businessId}/earnings`}
    >
      <EarningsDesk businessName={business.name} income={income} />
    </EarningsScreen>
  );
}
