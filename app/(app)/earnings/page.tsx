import { redirect } from "next/navigation";
import { EarningsScreen } from "@/features/payouts/components/EarningsScreen";
import { asRange } from "@/features/payouts/earningsRange";
import { asPeriod } from "@/lib/format/period";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findPersonEarnings } from "@/repositories/earnings";
import { findMyMemberships } from "@/repositories/businesses";

/* the clock is read OUTSIDE the component — `react-hooks/purity` */
const stampNowIso = (): string => new Date().toISOString();

/** Your own teaching money — what OTHER businesses paid you, by period or by a
 *  custom range (`?from=&to=`).
 *
 *  ⚠ NO "STILL DUE" LINE (18 Oct 2026, the user: "remove both of them from
 *  earnings"): a studio sets what it pays when it pays, so until then nothing is
 *  "due" in rupees. What is not settled yet is in Team › Other Teams.
 *
 *  ⚠ A PERSON HAS NO EXPENSES, so "what is left" is what came in. */
export default async function MyEarningsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const period = asPeriod(sp.period);
  const range = asRange(sp.from, sp.to);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const now = stampNowIso();
  /* your own businesses are not "studios that paid you" (2 Oct 2026) */
  const owned = (await findMyMemberships(supabase).catch(() => []))
    .filter((m) => m.memberRole === "owner")
    .map((m) => m.business.id);
  const report = await findPersonEarnings(supabase, user.id, period, now, owned, range);

  return <EarningsScreen report={report} title="Earnings" sub="What studios have paid you" basePath="/earnings" noExpenses />;
}
