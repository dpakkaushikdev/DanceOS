"use client";

import type { ReactNode } from "react";
import { PracticeTile, practiceWhenShort } from "@/features/crews/components/practice-card";
import { ENQ_PART_WORD, enquiryTypeLabel, type MyEnquiryPractice } from "@/types/enquiry";

/** AN ENQUIRY JOB'S PRACTICE, ON THE ONE PRACTICE CARD (18 Oct 2026, the user:
 *  *"better practice card"*). `PracticeTile` draws it; this adds only the words
 *  a job has — whose job it is, what kind of booking, and what the reader is to
 *  it. The whole card opens the practice's own page, where the register is; no
 *  card carries a register (the user: *"register button not required outside"*).
 *
 *  ⚠ `ENQ_PART_WORD` and `enquiryTypeLabel` live in `types/enquiry.ts`, a plain
 *  module: a value exported from a "use client" file is a client REFERENCE on the
 *  server (the 11 Oct `isClassAsk` lesson). */
export function EnquiryPracticeCard({
  practice: p,
  now,
  actions = null,
  foot = null,
  linked = true,
  hrefBase = "/practice/job",
}: {
  /** where the practice's own page lives — a studio's is under the studio
   *  (`/business/{id}/practice/job`), so opening one never switches profile */
  hrefBase?: string;
  practice: MyEnquiryPractice;
  now: number;
  actions?: ReactNode;
  /** anything that opens under the card's bar */
  foot?: ReactNode;
  /** false on the practice's own page, which the card would only link back to */
  linked?: boolean;
}) {
  const part = ENQ_PART_WORD[p.myPart];
  return (
    <PracticeTile
      kind="job"
      testId="enquiry-practice-card"
      href={linked ? `${hrefBase}/${p.id}` : undefined}
      hrefLabel={linked ? `Open the practice — ${p.hostName}, ${practiceWhenShort(p.startsAt)}` : undefined}
      name={p.hostName}
      photoPath={p.hostPhotoPath}
      label={enquiryTypeLabel(p.typeKey)}
      sub={part.sub}
      startsAt={p.startsAt}
      endsAt={p.endsAt}
      place={p.place}
      note={p.note}
      cancelled={p.status === "cancelled"}
      going={p.checkedIn}
      of={p.people}
      now={now}
      actions={actions}
      foot={foot}
    />
  );
}
