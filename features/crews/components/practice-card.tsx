"use client";

import type { ReactNode } from "react";
import { MUTED, SUB } from "@/lib/design/tokens";
import { PRACTICE_WORD, practiceClock, type CrewPractice } from "@/types/crewPractice";
import { DOS_TOOLS } from "@/features/businesses/components/biz-kit";
import { ToolActions, ToolCard, ToolChip, ToolHead } from "@/components/ui/ToolCard";

/** ONE PRACTICE, DRAWN ONCE (27 Sep 2026, the user: *"no way to check practices
 *  you have been a part of fix that"*), and since 18 Oct 2026 ONE CARD FOR BOTH
 *  KINDS — a crew's rehearsal and an enquiry job's (the user: *"better practice
 *  card"*, *"handle practice like classes as well"*).
 *
 *  ⚠ THERE IS NO REGISTER ON A CARD (18 Oct 2026, the user: *"register button not
 *  required outside, only while clicking inside that practice"*). The whole card
 *  is the door to the practice's own page (`/practice/crew/{id}` or
 *  `/practice/job/{id}`), and the register lives there and nowhere else — the
 *  two-doors-to-one-subject shape this repo has paid for twice.
 *
 *  ⚠ THERE ARE NO ANSWER BUTTONS (11 Oct 2026): a practice is a notice, and the
 *  runner's register is the only attendance there is. */

export type PracticeTileKind = "crew" | "job";

/** the kind chip — each kind wears the colour of the place it came from, the
 *  calendar's own two practice calendars read the same two tools */
export const PRACTICE_KIND_LOOK: Record<PracticeTileKind, { word: string; tint: string }> = {
  crew: { word: "CREW", tint: DOS_TOOLS.crews.c },
  job: { word: "ENQUIRY", tint: DOS_TOOLS.enquiries.c },
};

const IST_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
/** "2026-10-18" in IST */
export const practiceDayKey = (iso: string): string => IST_DAY.format(new Date(iso));

/** a practice's map link, only if it is a web address — the database's CHECK says
 *  the same, and an href is the one place a `javascript:` link would bite (11 Sep) */
export const safeLink = (u: string | null | undefined): string | null => (u && /^https?:\/\/\S+$/i.test(u) ? u : null);

/** THE ONE PRACTICE CARD. A practice is the same shape whatever it is for — who
 *  it is with, when, where, and how full the register was — so the card is drawn
 *  from those facts alone; what a caller knows about its own kind arrives as
 *  words. The order is the order it is read: the date, then the hour and the
 *  place, then whose it is. */
export function PracticeTile({
  kind,
  testId = "practice-card",
  href,
  hrefLabel,
  name,
  photoPath,
  label,
  sub,
  startsAt,
  endsAt,
  place,
  placeUrl = null,
  note,
  cancelled,
  going,
  of,
  now,
  actions = null,
  foot = null,
}: {
  kind: PracticeTileKind;
  testId?: string;
  /** the practice's own page — the whole card is the door */
  href?: string;
  hrefLabel?: string;
  /** the crew's, or the business running the job — the card's face and name */
  name: string;
  photoPath: string | null;
  /** after the kind word on the eyebrow — the crew's style, the booking's kind */
  label?: string | null;
  /** what the reader is to it — "You arranged it", "Team" */
  sub: string;
  startsAt: string;
  endsAt: string;
  place: string;
  /** the place's map link, when the organiser gave one */
  placeUrl?: string | null;
  note: string | null;
  cancelled: boolean;
  /** checked in, of how many on the register */
  going: number;
  of: number;
  /** the clock, handed in — a component may not read it during render */
  now: number;
  actions?: ReactNode;
  foot?: ReactNode;
}) {
  const look = PRACTICE_KIND_LOOK[kind];
  const tint = look.tint;
  const startMs = new Date(startsAt).getTime();
  const past = new Date(endsAt).getTime() < now;
  const today = !past && practiceDayKey(startsAt) === practiceDayKey(new Date(now).toISOString());
  const live = !cancelled && !past && startMs <= now;
  const d = dateParts(startsAt);
  const share = of > 0 ? Math.min(1, going / of) : 0;
  const state = cancelled ? { word: "CALLED OFF", fg: SUB, bg: "var(--el)" } : live ? { word: "NOW", fg: "#15803D", bg: "#22C55E22" } : today ? { word: "TODAY", fg: "#B45309", bg: "#F59E0B22" } : past ? { word: "OVER", fg: MUTED, bg: "var(--el)" } : null;

  return (
    <ToolCard testId={testId} dim={cancelled} href={href} hrefLabel={hrefLabel}>
      <div data-practice-kind={kind} style={{ display: "flex", gap: 12, padding: "12px 14px", alignItems: "stretch" }}>
        {/* the date block — read down a list without parsing a sentence */}
        <div aria-hidden style={{ width: 52, flexShrink: 0, borderRadius: 13, background: cancelled ? "var(--el)" : `${tint}1f`, color: cancelled ? SUB : tint, textAlign: "center", padding: "6px 0", alignSelf: "flex-start" }}>
          <div style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: 0.8 }}>{d.weekday}</div>
          <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.05 }}>{d.day}</div>
          <div style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: 0.8 }}>{d.month}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <ToolChip word={look.word} fg={tint} bg={`${tint}1f`} testId="practice-kind" />
            {state ? <ToolChip word={state.word} fg={state.fg} bg={state.bg} testId="practice-state" /> : null}
          </div>
          <div data-testid="practice-time" style={{ fontSize: 15, fontWeight: 900, marginTop: 6, textDecoration: cancelled ? "line-through" : "none" }}>
            {practiceClock(startsAt)} – {practiceClock(endsAt)}
          </div>
          {/* ⚠ the place is a LINK when it has one (29 Oct 2026) — a sibling of the
              card's stretched link, never inside it, so it presses on its own */}
          {placeUrl ? (
            <a
              data-testid="practice-place-link"
              href={placeUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${place} in Maps`}
              style={{ display: "block", fontSize: 12, color: tint, fontWeight: 800, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "underline", pointerEvents: "auto", position: "relative", zIndex: 2 }}
            >
              📍 {place} ↗
            </a>
          ) : (
            <div style={{ fontSize: 12, color: SUB, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {place}</div>
          )}
          {note ? <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{note}</div> : null}
        </div>
      </div>

      {/* whose it is — the crew or the business running the job */}
      <div style={{ borderTop: "1.5px solid var(--el)" }}>
        <ToolHead tint={tint} size={40} name={name} photoPath={photoPath} eyebrow={label ? `${look.word} · ${label}` : look.word} sub={sub} />
      </div>

      {/* the turnout, once it has happened — a figure only the past has */}
      {past && !cancelled && of > 0 ? (
        <div data-testid="practice-turnout" style={{ padding: "0 14px 12px" }}>
          <div style={{ fontSize: 10.5, color: MUTED, fontWeight: 800 }}>
            {going} of {of} came
          </div>
          <div style={{ height: 5, borderRadius: 999, background: "var(--el)", overflow: "hidden", marginTop: 4 }}>
            <div style={{ width: `${Math.round(share * 100)}%`, height: "100%", borderRadius: 999, background: tint }} />
          </div>
        </div>
      ) : null}

      {actions ? <ToolActions>{actions}</ToolActions> : null}
      {foot}
    </ToolCard>
  );
}

/** A CREW'S PRACTICE on the one card */
export function PracticeCard({
  practice: p,
  now,
  actions = null,
  foot = null,
  linked = true,
}: {
  practice: CrewPractice;
  now: number;
  actions?: ReactNode;
  foot?: ReactNode;
  /** false on the practice's own page, which the card would only link back to */
  linked?: boolean;
}) {
  return (
    <PracticeTile
      kind="crew"
      testId="practice-card"
      href={linked ? `/practice/crew/${p.id}` : undefined}
      hrefLabel={linked ? `Open the practice — ${p.crewName}, ${practiceWhenShort(p.startsAt)}` : undefined}
      name={p.crewName}
      photoPath={p.crewPhotoPath}
      label={p.crewStyle || null}
      sub={PRACTICE_WORD[p.myStatus]}
      startsAt={p.startsAt}
      endsAt={p.endsAt}
      place={p.place}
      placeUrl={safeLink(p.placeUrl)}
      note={p.note}
      cancelled={p.status === "cancelled"}
      going={p.going}
      of={p.asked}
      now={now}
      actions={actions}
      foot={foot}
    />
  );
}

export const practiceWhenShort = (iso: string): string =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));

/** the date block's three lines, in IST like every other time on a practice */
const dateParts = (iso: string) => {
  const parts = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return { weekday: get("weekday").toUpperCase(), day: get("day"), month: get("month").toUpperCase() };
};

/** COMING UP, then OVER — the one split every practice list makes. A called-off
 *  practice is OVER whatever the clock says: nobody is going to it. */
export function splitPractices<T extends { endsAt: string; status: string }>(practices: T[], now: number): { coming: T[]; over: T[] } {
  return {
    coming: practices.filter((p) => new Date(p.endsAt).getTime() >= now && p.status !== "cancelled"),
    over: practices.filter((p) => new Date(p.endsAt).getTime() < now || p.status === "cancelled"),
  };
}

export const PRACTICE_HEAD: React.CSSProperties = { fontSize: 10, fontWeight: 900, letterSpacing: 1, color: "var(--sub)", textTransform: "uppercase", margin: "14px 2px 9px" };
