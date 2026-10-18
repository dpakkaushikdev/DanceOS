import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DeskBody, DeskTop } from "@/components/ui/DeskSections";
import { toolBtn } from "@/components/ui/ToolCard";
import { DOS_TOOLS, DeskHero } from "@/features/businesses/components/biz-kit";
import { PracticeCard } from "@/features/crews/components/practice-card";
import { PracticeRegister, type RegisterRow } from "@/features/crews/components/PracticeRegister";
import { DOS_UI, INK, LILAC } from "@/lib/design/tokens";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findMyCrewPractices, findPracticePeople } from "@/repositories/crewPractices";
import { PRACTICE_TINT, PRACTICE_WORD } from "@/types/crewPractice";

export const metadata: Metadata = { title: "Practice — DanceOS" };

const stampNowIso = (): string => new Date().toISOString();
const TINT = DOS_TOOLS.practice.c;

/** A CREW'S PRACTICE, ON ITS OWN PAGE (18 Oct 2026). Where it is, when, the note
 *  — and for the person who LEADS the crew, the register. A member reads the
 *  details and nothing to press.
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

  return (
    <div style={{ background: LILAC, color: INK, maxWidth: 430, margin: "0 auto", fontFamily: DOS_UI, padding: "0 var(--dos-gutter)", boxSizing: "border-box", paddingBottom: "var(--dos-foot)" }}>
      <DeskTop>
        <DeskHero tool="practice" as="h1" margin="0 0 12px" />
        <div data-testid="practice-detail" data-kind="crew">
          <PracticeCard
            practice={p}
            now={now}
            actions={
              <>
                {p.iLead ? (
                  <Link href={`/crews/${p.crewId}/manage/practice`} aria-label={`The practice desk of ${p.crewName}`} style={toolBtn("secondary", TINT)}>
                    Practice desk ›
                  </Link>
                ) : null}
                <Link href={`/crew/${p.crewId}`} aria-label={`Open ${p.crewName}`} style={toolBtn("secondary", TINT)}>
                  The crew ›
                </Link>
              </>
            }
          />
        </div>
      </DeskTop>
      {p.iLead ? (
        <DeskBody>
          <div style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: 0.9, color: "var(--muted)", margin: "2px 0 8px" }}>REGISTER</div>
          <PracticeRegister rows={rows} target={{ kind: "crew", practiceId: p.id, crewId: p.crewId }} tint={TINT} locked={p.status === "cancelled"} />
        </DeskBody>
      ) : null}
    </div>
  );
}
