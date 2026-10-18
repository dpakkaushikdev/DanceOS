import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ColumnCount, columnTab, columnTrack } from "@/components/ui/ColumnTabs";
import { DeskBody, DeskTop } from "@/components/ui/DeskSections";
import { DeskHero } from "@/features/businesses/components/biz-kit";
import { MyPractices } from "@/features/crews/components/MyPractices";
import { MyEnquiryPractices } from "@/features/enquiries/components/EnquiryPracticeCard";
import { SegmentedPanels } from "@/features/shell/components/SegmentedNav";
import { DOS_UI, INK, LILAC } from "@/lib/design/tokens";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findMyCrewPractices } from "@/repositories/crewPractices";
import { findMyEnquiryPractices } from "@/repositories/enquiryTeam";

export const metadata: Metadata = { title: "Practice — DanceOS" };

const stampNow = (): number => Date.now();
const DAY = 24 * 60 * 60 * 1000;

/** PRACTICE, ON ITS OWN (29 Sep 2026, the user: *"practice should be seprate tab
 *  in home tab not in crew"*).
 *
 *  Every practice of every crew you are on — what is coming, what is over, the
 *  crew's page on anything you dance in, and Register › on anything you
 *  lead. It was a section stacked under both crew lists (27 Sep), then a segment
 *  of the Crews hub (28 Sep); it is a tile on Home now, because "what am I
 *  rehearsing this week" is not a question about crews.
 *
 *  ⚠⚠ TWO TYPES SINCE 18 Oct 2026 — CREW · ENQUIRY (`?type=`). An enquiry job's
 *  practices (`my_enquiry_practices`: a job you run, are on the team of, or are a
 *  confirmed participant in) are rehearsals too, so they live here beside the
 *  crew's, on the one practice card, and each opens its own page
 *  (`/practice/job/{id}`). Both types are always drawn with their counts. A link
 *  naming a type wins; a crew column (`?show=`) means Crew; otherwise the page
 *  opens on Crew unless only the enquiry side has anything.
 *
 *  ⚠ `my_crew_practices` and `my_enquiry_practices` are scoped to `auth.uid()`
 *  inside their own SQL — neither takes a person to aim at — and both answer an
 *  empty list rather than throwing, so this screen never fails over either.
 *
 *  ⚠ A LEADER GETS A LINK, NOT A SECOND REGISTER: their desk at
 *  `/crews/{id}/manage/practice` has the roster, the check-in and Call it off,
 *  and two doors to one subject is the shape this repo has paid for twice. */
export default async function PracticePage({ searchParams }: { searchParams: Promise<{ show?: string | string[]; type?: string | string[] }> }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const params = await searchParams;
  const rawShow = Array.isArray(params.show) ? params.show[0] : params.show;
  const rawType = Array.isArray(params.type) ? params.type[0] : params.type;
  const now = stampNow();
  const [practices, jobPractices] = await Promise.all([
    findMyCrewPractices(supabase),
    findMyEnquiryPractices(supabase, { from: new Date(now - 60 * DAY).toISOString(), to: new Date(now + 180 * DAY).toISOString() }).catch(() => []),
  ]);
  /* ⚠ TWO COLUMNS, THE CREWS HUB'S OWN TWO (1 Oct 2026, the user: *"practice also
     in 2 columns"*): the practices of crews you LEAD — the ones you arranged and
     run the register for — and the ones of crews you are IN, where you were
     asked. It is the same split Crews and Studios wear since 30 Sep, so the
     three hubs read one way. Each column keeps its own Coming up / Over. */
  const led = practices.filter((p) => p.iLead);
  const member = practices.filter((p) => !p.iLead);
  const type: "crew" | "enquiry" =
    rawType === "enquiry" ? "enquiry" : rawType === "crew" || rawShow ? "crew" : practices.length === 0 && jobPractices.length > 0 ? "enquiry" : "crew";
  /* a link naming a column wins; otherwise open on the one that has something,
     leading first — the person who arranged a practice came here to run it */
  const show = rawShow === "in" ? "in" : rawShow === "led" ? "led" : led.length === 0 && member.length > 0 ? "in" : "led";
  const todayIso = new Date(now).toISOString();

  /* ⚠ THE TWO TYPES, ALWAYS DRAWN, EACH WITH ITS COUNT (18 Oct 2026) — links,
     because each is a different read and the address is the state */
  const types = (
    <div data-testid="practice-types" role="group" aria-label="Practice type" style={{ ...columnTrack(), marginTop: 12 }}>
      {(
        [
          ["crew", "Crew", practices.length, "Crew practices"],
          ["enquiry", "Enquiry", jobPractices.length, "Enquiry practices"],
        ] as const
      ).map(([k, l, n, aria]) => (
        <Link key={k} href={`/practice?type=${k}`} replace scroll={false} aria-label={aria} aria-current={type === k ? "page" : undefined} style={columnTab(type === k)}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{l}</span>
          <ColumnCount n={n} on={type === k} />
        </Link>
      ))}
    </div>
  );

  return (
    <div style={{ background: LILAC, color: INK, maxWidth: 430, margin: "0 auto", fontFamily: DOS_UI, minHeight: "100vh", paddingBottom: 40 }}>
      <div style={{ padding: "14px var(--dos-gutter) 0" }}>
        {type === "enquiry" ? (
          <>
            <DeskTop style={{ margin: 0, marginBottom: 12 }}>
              <DeskHero tool="practice" as="h1" margin="0" />
              {types}
            </DeskTop>
            <DeskBody>
              <MyEnquiryPractices practices={jobPractices} todayIso={todayIso} />
            </DeskBody>
          </>
        ) : (
          /* ⚠ SECTIONS (3 Oct 2026, C116): the heading, the types and the two
             column pills in the TOP squircle, the shown column's practices in the
             LOWER one */
          <SegmentedPanels
            /* the key is the SERVER's answer, so a link carrying `?show=` wins */
            key={show}
            initial={show}
            label="Show"
            sections
            top={
              <>
                <DeskHero tool="practice" as="h1" margin="0" />
                {types}
              </>
            }
            segments={[
              { key: "led", href: "/practice?show=led", label: "Yours", n: led.length, aria: "Practices of the crews you lead" },
              { key: "in", href: "/practice?show=in", label: "You are in", n: member.length, aria: "Practices of the crews you are a part of" },
            ]}
            panels={[
              {
                key: "led",
                node: <MyPractices practices={led} todayIso={todayIso} bare empty="Nothing arranged yet — practices you arrange for a crew you lead land here." />,
              },
              {
                key: "in",
                node: <MyPractices practices={member} todayIso={todayIso} bare empty="Nothing yet — when a crew you are on arranges one, it shows up here." />,
              },
            ]}
          />
        )}
      </div>
    </div>
  );
}
