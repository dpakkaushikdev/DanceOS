import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DeskHero } from "@/features/businesses/components/biz-kit";
import { PracticeHome, type PracticeTab } from "@/features/crews/components/MyPractices";
import { DOS_UI, INK, LILAC } from "@/lib/design/tokens";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findMyMemberships, runsTheBusiness } from "@/repositories/businesses";
import { findBusinessEnquiryPractices } from "@/repositories/enquiryTeam";

export const metadata: Metadata = { title: "Practice — DanceOS" };

const stampNow = (): number => Date.now();
const DAY = 24 * 60 * 60 * 1000;

/** /business/{id}/practice — A STUDIO'S OWN PRACTICE DESK (18 Oct 2026, the user:
 *  "practice tool for studio as well"). A studio has no crew, so its practices
 *  are the practices of the enquiry jobs it works: the person's own Practice
 *  screen narrowed to this studio, Upcoming · Past, with no Crew · Job chips.
 *  Each card opens the practice's own page, where the register is.
 *  ⚠ The people who RUN it only (R55) — the same gate as every desk here. */
export default async function BusinessPracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { businessId } = await params;
  const { tab: rawTab } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const teams = await findMyMemberships(supabase).catch(() => []);
  const seat = teams.find((m) => m.business.id === businessId);
  if (!seat) {
    notFound();
  }
  if (!runsTheBusiness(seat.memberRole)) {
    redirect(`/business/${businessId}`);
  }
  const now = stampNow();
  const job = await findBusinessEnquiryPractices(supabase, businessId, {
    from: new Date(now - 90 * DAY).toISOString(),
    to: new Date(now + 180 * DAY).toISOString(),
  }).catch(() => []);
  const tab: PracticeTab = rawTab === "past" ? "past" : "upcoming";
  return (
    <div style={{ background: LILAC, color: INK, maxWidth: 430, margin: "0 auto", fontFamily: DOS_UI, minHeight: "100vh", paddingBottom: 40 }}>
      <div style={{ padding: "14px var(--dos-gutter) 0" }}>
        <PracticeHome
          top={<DeskHero tool="practice" as="h1" margin="0" />}
          crew={[]}
          job={job}
          todayIso={new Date(now).toISOString()}
          initialTab={tab}
          initialChip="all"
          basePath={`/business/${businessId}/practice`}
          showChips={false}
        />
      </div>
    </div>
  );
}
