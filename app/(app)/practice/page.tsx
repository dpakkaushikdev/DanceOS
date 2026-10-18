import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DeskHero } from "@/features/businesses/components/biz-kit";
import { PracticeHome, type PracticeChip, type PracticeTab } from "@/features/crews/components/MyPractices";
import { DOS_UI, INK, LILAC } from "@/lib/design/tokens";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findMyCrewPractices } from "@/repositories/crewPractices";
import { findMyPersonalEnquiryPractices } from "@/repositories/enquiryTeam";

export const metadata: Metadata = { title: "Practice — DanceOS" };

const stampNow = (): number => Date.now();
const DAY = 24 * 60 * 60 * 1000;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** PRACTICE, ON ITS OWN (29 Sep 2026, the user: *"practice should be seprate tab
 *  in home tab not in crew"*), and since 18 Oct 2026 HANDLED THE WAY CLASSES ARE
 *  (the user: *"handle practice like classes as well"*): Upcoming · Past, chips
 *  All · Crew · Job, and every card opening its practice's own page.
 *
 *  Both kinds are read here: a crew's (`my_crew_practices`) and an enquiry job's
 *  (`my_enquiry_practices`: a job you run, are on the team of, or are a confirmed
 *  participant in). Both are scoped to `auth.uid()` inside their own SQL and
 *  neither takes a person to aim at; the job read answers an empty list rather
 *  than failing this screen.
 *
 *  ⚠ THE OLD ADDRESSES STILL LAND (Rule 14): `?show=led|in` (the two crew
 *  columns, 1 Oct 2026) and `?type=crew` mean the Crew chip; `?type=enquiry`
 *  means Job. `?tab=` and `?kind=` are the address now. */
export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[]; kind?: string | string[]; show?: string | string[]; type?: string | string[] }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const params = await searchParams;
  const rawTab = one(params.tab);
  const rawKind = one(params.kind);
  const rawShow = one(params.show);
  const rawType = one(params.type);
  const now = stampNow();
  const [crew, job] = await Promise.all([
    findMyCrewPractices(supabase),
    findMyPersonalEnquiryPractices(supabase, { from: new Date(now - 90 * DAY).toISOString(), to: new Date(now + 180 * DAY).toISOString() }).catch(() => []),
  ]);
  const tab: PracticeTab = rawTab === "past" ? "past" : "upcoming";
  const chip: PracticeChip =
    rawKind === "crew" || rawKind === "job"
      ? rawKind
      : rawType === "enquiry" || rawType === "job"
        ? "job"
        : rawType === "crew" || rawShow === "led" || rawShow === "in"
          ? "crew"
          : "all";

  return (
    <div style={{ background: LILAC, color: INK, maxWidth: 430, margin: "0 auto", fontFamily: DOS_UI, minHeight: "100vh", paddingBottom: 40 }}>
      <div style={{ padding: "14px var(--dos-gutter) 0" }}>
        <PracticeHome top={<DeskHero tool="practice" as="h1" margin="0" />} crew={crew} job={job} todayIso={new Date(now).toISOString()} initialTab={tab} initialChip={chip} />
      </div>
    </div>
  );
}
