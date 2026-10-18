"use client";

import type { ReactNode } from "react";
import { PracticeCardShell } from "@/features/crews/components/practice-card";
import { ENQ_PART_WORD, enquiryTypeLabel, type MyEnquiryPractice } from "@/types/enquiry";

/** AN ENQUIRY'S PRACTICE, ON THE ONE PRACTICE CARD (18 Oct 2026, the user:
 *  *"same better card for both practices"*). The shell is the crew card's; what
 *  this adds is only the words an enquiry job has — whose job it is, what kind
 *  of booking, and what the reader is to it. The whole card opens the practice's
 *  own page, where the register is.
 *
 *  ⚠ `ENQ_PART_WORD` and `enquiryTypeLabel` live in `types/enquiry.ts`, a plain
 *  module: a value exported from a "use client" file is a client REFERENCE on the
 *  server (the 11 Oct `isClassAsk` lesson), and the practice page and the
 *  calendar read both on the server. */

/** THE ENQUIRY HALF OF `/practice` (18 Oct 2026): every practice of every job you
 *  run, are on the team of, or are a confirmed participant in — coming first,
 *  then over. A client component because the card is; the split is here, not on
 *  the server, so no client export is called from a server module (the
 *  `isClassAsk` lesson of 11 Oct). */
export function MyEnquiryPractices({ practices, todayIso }: { practices: MyEnquiryPractice[]; todayIso: string }) {
  const now = new Date(todayIso).getTime();
  const coming = practices.filter((p) => new Date(p.endsAt).getTime() >= now && p.status !== "cancelled").sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const over = practices.filter((p) => new Date(p.endsAt).getTime() < now || p.status === "cancelled").sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const head: React.CSSProperties = { fontSize: 9.5, fontWeight: 900, letterSpacing: 0.9, color: "var(--muted)", margin: "14px 0 8px" };
  return (
    <div data-testid="my-enquiry-practices">
      {coming.length === 0 && over.length === 0 ? (
        <div style={{ background: "var(--card)", borderRadius: 16, padding: "16px 14px", textAlign: "center", fontSize: 12, color: "var(--sub)", border: "1.5px dashed var(--el)", lineHeight: 1.5 }}>
          Nothing yet — practices for the bookings you work on land here.
        </div>
      ) : null}
      {coming.length ? (
        <>
          <div style={head}>COMING UP</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {coming.map((p) => (
              <EnquiryPracticeCard key={p.id} practice={p} now={now} />
            ))}
          </div>
        </>
      ) : null}
      {over.length ? (
        <>
          <div style={head}>OVER</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {over.map((p) => (
              <EnquiryPracticeCard key={p.id} practice={p} now={now} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function EnquiryPracticeCard({
  practice: p,
  now,
  actions = null,
  linked = true,
}: {
  practice: MyEnquiryPractice;
  now: number;
  actions?: ReactNode;
  /** false on the practice's own page, which the card would only link back to */
  linked?: boolean;
}) {
  const kind = enquiryTypeLabel(p.typeKey);
  const part = ENQ_PART_WORD[p.myPart];
  const when = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(p.startsAt));
  return (
    <PracticeCardShell
      testId="enquiry-practice-card"
      href={linked ? `/practice/job/${p.id}` : undefined}
      hrefLabel={linked ? `Open the practice — ${p.hostName}, ${when}` : undefined}
      name={p.hostName}
      photoPath={p.hostPhotoPath}
      eyebrow={`Enquiry practice${kind ? ` · ${kind}` : ""}`}
      sub={part.sub}
      chipWord={part.chip}
      chipTint={part.tint}
      startsAt={p.startsAt}
      endsAt={p.endsAt}
      place={p.place}
      note={p.note}
      cancelled={p.status === "cancelled"}
      going={p.checkedIn}
      of={p.people}
      now={now}
      actions={actions}
    />
  );
}
