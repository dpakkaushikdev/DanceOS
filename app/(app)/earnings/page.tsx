import { redirect } from "next/navigation";
import { EarningsScreen } from "@/features/payouts/components/EarningsScreen";
import { asRange } from "@/features/payouts/earningsRange";
import { asPeriod } from "@/lib/format/period";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findPersonEarnings } from "@/repositories/earnings";
import { findMyEarnings } from "@/repositories/payouts";
import { findMyMemberships } from "@/repositories/businesses";

/* the clock is read OUTSIDE the component — `react-hooks/purity` */
const stampNowIso = (): string => new Date().toISOString();

/** Your own teaching money — what OTHER businesses paid you, by period or by a
 *  custom range (`?from=&to=`).
 *
 *  ⚠ THE STUDIO-BY-STUDIO LEDGER IS THE TEAM SECTION'S NOW (18 Oct 2026, the
 *  user: "what studios pay you should also be handled from team section"):
 *  `PaidToYou` on `/team`. This screen keeps one line pointing there — what is
 *  still due — so nothing about it is lost, only moved.
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
  const [report, mine] = await Promise.all([
    findPersonEarnings(supabase, user.id, period, now, owned, range),
    findMyEarnings(supabase, user.id, now, owned).catch(() => null),
  ]);

  const team =
    mine && (mine.studios.length > 0 || mine.payouts.length > 0)
      ? [{ label: "Still due from studios", amountInr: mine.dueTotal, href: "/team#paid-to-you", note: "Each studio's sessions and payments are in Team", side: "revenue" as const }]
      : [];

  return <EarningsScreen report={report} title="Earnings" sub="What studios have paid you" basePath="/earnings" noExpenses team={team} />;
}
