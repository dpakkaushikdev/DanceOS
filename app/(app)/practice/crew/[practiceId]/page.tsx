import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DeskBody, DeskTop } from "@/components/ui/DeskSections";
import { DOS_TOOLS, DeskHero } from "@/features/businesses/components/biz-kit";
import { PracticeBodyHead, PracticeDetail, type PracticeDoor } from "@/features/crews/components/PracticeDetail";
import { PracticeCallOff, PracticeRegister, type RegisterRow } from "@/features/crews/components/PracticeRegister";
import { DOS_UI, INK, LILAC } from "@/lib/design/tokens";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findMyCrewPractices, findPracticePeople } from "@/repositories/crewPractices";
import { PRACTICE_TINT, PRACTICE_WORD, practiceWhen } from "@/types/crewPractice";

export const metadata: Metadata = { title: "Practice — DanceOS" };

const stampNowIso = (): string => new Date().toISOString();
/* a crew practice wears the Crews tool's colour, as its card's kind chip does */
const TINT = DOS_TOOLS.crews.c;

/** A CREW'S PRACTICE, ON ITS OWN PAGE (18 Oct 2026; re-cut the same day on
 *  `PracticeDetail` — the user: "better looking practice detail page, handle
 *  buttons better"). Where it is, when, the note — and for the person who LEADS
 *  the crew, the register. A member reads the details and nothing to press.
 *
 *  ⚠ THE GATE IS THE READ: `my_crew_practices` is scoped to `auth.uid()` inside
 *  its own SQL, so a practice of a crew the reader is not on is simply not in the
 *  answer and the page is "not found" — the address is never an authority. The
 *  register is drawn only for `iLead`, and `check_in_practice` refuses anybody
 *  else in words on every press. */
export default async function CrewPracticePage({ params }: { params: Promise<{ practiceId: string }> }) {
  const { practiceId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const all = await findMyCrewPractices(supabase);
  const p = all.find((x) => x.id === practiceId);
  if (!p) {
    notFound();
  }
  const people = p.iLead ? await findPracticePeople(supabase, p.id) : [];
  const rows: RegisterRow[] = people.map((m) => ({
    userId: m.userId,
    fullName: m.fullName,
    avatarPath: m.avatarPath,
    sub: m.isLeader ? "Leader" : PRACTICE_WORD[m.status],
    subTint: PRACTICE_TINT[m.status],
    present: m.present,
  }));
  const nowIso = stampNowIso();
  const now = new Date(nowIso).getTime();
  /* no door rows (18 Oct 2026, the user: "practice detail should not show this
     crew and practice desk option for crew practice") */
  const doors: PracticeDoor[] = [];
  const mayCallOff = p.iLead && p.status !== "cancelled" && new Date(p.endsAt).getTime() >= now;

  return (
    <div style={{ background: LILAC, color: INK, maxWidth: 430, margin: "0 auto", fontFamily: DOS_UI, padding: "0 var(--dos-gutter)", boxSizing: "border-box", paddingBottom: "var(--dos-foot)" }}>
      <DeskTop>
        <DeskHero tool="practice" as="h1" margin="0 0 12px" />
        <div data-testid="practice-detail" data-kind="crew">
          <PracticeDetail
            kind="crew"
            name={p.crewName}
            photoPath={p.crewPhotoPath}
            label={p.crewStyle || null}
            role={PRACTICE_WORD[p.myStatus]}
            startsAt={p.startsAt}
            endsAt={p.endsAt}
            place={p.place}
            placeUrl={p.placeUrl ?? null}
            note={p.note}
            cancelled={p.status === "cancelled"}
            now={now}
            doors={doors}
            danger={mayCallOff ? <PracticeCallOff practiceId={p.id} crewId={p.crewId} when={practiceWhen(p.startsAt)} /> : null}
          />
        </div>
      </DeskTop>
      {p.iLead ? (
        <DeskBody>
          <PracticeBodyHead>REGISTER</PracticeBodyHead>
          <PracticeRegister rows={rows} target={{ kind: "crew", practiceId: p.id, crewId: p.crewId }} tint={TINT} locked={p.status === "cancelled"} />
        </DeskBody>
      ) : null}
    </div>
  );
}
