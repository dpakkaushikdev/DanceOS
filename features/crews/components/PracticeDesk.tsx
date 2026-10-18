"use client";

import { useState } from "react";
import { DeskAddButton } from "@/features/settings/components/settings-kit";
import { DeskHero } from "@/features/businesses/components/biz-kit";
import { cancelCrewPracticeAction } from "@/features/crews/server-actions/practices";
import { DeskBody, DeskTop } from "@/components/ui/DeskSections";
import { DOS_UI, INK, LILAC } from "@/lib/design/tokens";
import { practiceWhen, type CrewPractice } from "@/types/crewPractice";
import { Toast, bizCard } from "./crew-kit";
import { DeleteIconButton } from "@/components/ui/DeleteIconButton";
import { PRACTICE_HEAD, PracticeCard, splitPractices } from "./practice-card";

/** THE PRACTICE DESK (27 Sep 2026) — behind the Practice tile on a crew's own
 *  home: what is coming, what is over, and the leader's Arrange.
 *
 *  ⚠ NO REGISTER HERE ANY MORE (18 Oct 2026, the user: *"register button not
 *  required outside, only while clicking inside that practice"*). Each card opens
 *  the practice's own page (`/practice/crew/{id}`), which holds the register; the
 *  desk keeps only Call off on a practice still to come. The database asks again
 *  on every write, which is where the rule lives. */
/* `crewName` is still passed and no longer drawn — the line under the heading
   went on 4 Oct 2026 */
export function PracticeDesk({ crewId, practices, todayIso }: { crewId: string; crewName: string; practices: CrewPractice[]; todayIso: string }) {
  const [toast, setToast] = useState<string | null>(null);
  const now = new Date(todayIso).getTime();
  const { coming, over } = splitPractices(practices, now);

  const say = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  };

  const callOff = async (practiceId: string): Promise<string | null> => {
    const r = await cancelCrewPracticeAction({ practiceId, crewId });
    if (r.error) return r.error;
    say("Called off — everyone is told");
    return null;
  };

  const card = (p: CrewPractice, live: boolean) => (
    <PracticeCard
      key={p.id}
      practice={p}
      now={now}
      actions={
        live && p.iLead ? (
          <DeleteIconButton
            label={`Call off ${practiceWhen(p.startsAt)}`}
            title="Call off this practice?"
            body={`${practiceWhen(p.startsAt)} — the crew is told.`}
            goWord="Call it off"
            word="Call off"
            onConfirm={() => callOff(p.id)}
          />
        ) : null
      }
    />
  );

  return (
    <div style={{ background: LILAC, color: INK, maxWidth: 430, margin: "0 auto", fontFamily: DOS_UI, padding: "0 var(--dos-gutter)", boxSizing: "border-box", paddingBottom: "var(--dos-foot)" }}>
      <DeskTop style={{ paddingBottom: 2 }}>
        <DeskHero tool="practice" as="h1" margin="0 0 12px" />
        {/* ＋ ON TOP (20 Sep 2026's rule for every desk) — opens the form as a sheet */}
        <DeskAddButton label="Arrange a practice" href="?new=1" />
      </DeskTop>

      <DeskBody>
        {coming.length === 0 && over.length === 0 ? (
          <div style={{ ...bizCard, textAlign: "center", fontSize: 12, color: "var(--sub)", border: "1.5px dashed var(--el)" }}>Nothing arranged yet.</div>
        ) : null}

        {coming.length ? (
          <>
            <div style={PRACTICE_HEAD}>Upcoming · {coming.length}</div>
            {coming.map((p) => card(p, true))}
          </>
        ) : null}

        {over.length ? (
          <>
            <div style={PRACTICE_HEAD}>Past · {over.length}</div>
            {[...over].sort((a, b) => b.startsAt.localeCompare(a.startsAt)).map((p) => card(p, false))}
          </>
        ) : null}
      </DeskBody>

      <Toast msg={toast} />
    </div>
  );
}
