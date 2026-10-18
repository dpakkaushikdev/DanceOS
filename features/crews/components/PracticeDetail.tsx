import Link from "next/link";
import type { ReactNode } from "react";
import { ToolFace } from "@/components/ui/ToolCard";
import { DOS_DISPLAY, MUTED, SUB } from "@/lib/design/tokens";
import { DOS_TOOLS } from "@/features/businesses/components/biz-kit";
import { practiceClock } from "@/types/crewPractice";
import type { PracticeTileKind } from "./practice-card";

/* ⚠ declared HERE, not imported from `practice-card`: that module is "use
   client", and a value exported from one is a client REFERENCE on the server
   (the 11 Oct `isClassAsk` lesson). Same words and colours as its chip. */
const PRACTICE_KIND_LOOK: Record<PracticeTileKind, { word: string; tint: string }> = {
  crew: { word: "CREW", tint: DOS_TOOLS.crews.c },
  job: { word: "JOB", tint: DOS_TOOLS.enquiries.c },
};
const IST_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
const practiceDayKey = (iso: string): string => IST_DAY.format(new Date(iso));

/** A PRACTICE'S OWN PAGE, ONE LAYOUT FOR BOTH KINDS (18 Oct 2026, the user:
 *  "better looking practice detail page, handle buttons better").
 *
 *  Three blocks, in the order a practice is read:
 *   1. THE HERO — the day at display size, the hours, the place and the note, on
 *      a wash of the kind's own colour, with its kind and its state as chips;
 *   2. WHOSE IT IS — the crew, or the business running the job, and what you are
 *      to it;
 *   3. THE DOORS — every link a full-width row with its own words and a chevron,
 *      and the one destructive act (Call off) apart at the foot, so a press for
 *      "the crew" can never land on "call it off".
 *  The register (or "you") is the page's own body, under it.
 *
 *  ⚠ No hooks, no state: both pages are server components. The Call off control
 *  arrives as a node (it is the client's `PracticeCallOff`). */

export interface PracticeDoor {
  href: string;
  word: string;
  /** the accessible name — the old buttons' names, so every locator still finds them */
  label: string;
  sub?: string;
}

const dayWords = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));

export function PracticeDetail({
  kind,
  name,
  photoPath,
  label,
  role,
  startsAt,
  endsAt,
  place,
  note,
  cancelled,
  now,
  doors,
  danger = null,
  corner = null,
  children,
}: {
  /** a control on the hero's top right — the enquiry's own door on a job practice */
  corner?: ReactNode;
  kind: PracticeTileKind;
  name: string;
  photoPath: string | null;
  label: string | null;
  /** what the reader is to it — "You arranged it", "Team" */
  role: string;
  startsAt: string;
  endsAt: string;
  place: string;
  note: string | null;
  cancelled: boolean;
  now: number;
  doors: PracticeDoor[];
  danger?: ReactNode;
  children?: ReactNode;
}) {
  const look = PRACTICE_KIND_LOOK[kind];
  const tint = look.tint;
  const startMs = new Date(startsAt).getTime();
  const past = new Date(endsAt).getTime() < now;
  const today = !past && practiceDayKey(startsAt) === practiceDayKey(new Date(now).toISOString());
  const live = !cancelled && !past && startMs <= now;
  const state = cancelled
    ? { word: "CALLED OFF", c: "#94A3B8" }
    : live
      ? { word: "ON NOW", c: "#22C55E" }
      : today
        ? { word: "TODAY", c: "#F59E0B" }
        : past
          ? { word: "OVER", c: "#94A3B8" }
          : { word: "UPCOMING", c: tint };
  const mins = Math.max(0, Math.round((new Date(endsAt).getTime() - startMs) / 60000));
  const length = mins >= 60 ? `${Math.floor(mins / 60)} h${mins % 60 ? ` ${mins % 60} min` : ""}` : `${mins} min`;

  return (
    <div>
      {/* 1 · THE HERO */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 24,
          padding: "16px 16px 15px",
          background: cancelled ? "var(--card)" : `linear-gradient(150deg, ${tint}38 0%, ${tint}12 55%, var(--card) 100%)`,
          border: `1.5px solid ${cancelled ? "var(--el)" : `${tint}55`}`,
        }}
      >
        <span aria-hidden="true" style={{ position: "absolute", right: -40, top: -46, width: 150, height: 150, borderRadius: 75, background: `${tint}1c` }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span data-testid="practice-kind" style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: 0.8, padding: "4px 9px", borderRadius: 999, background: tint, color: "#fff" }}>
              {look.word} PRACTICE
            </span>
            <span data-testid="practice-state" style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: 0.8, padding: "4px 9px", borderRadius: 999, color: state.c, background: "var(--solid)", border: `1.5px solid ${state.c}55` }}>
              {live ? "● " : ""}
              {state.word}
            </span>
            {corner ? <span style={{ marginLeft: "auto" }}>{corner}</span> : null}
          </div>
          <div style={{ fontFamily: DOS_DISPLAY, fontSize: 25, fontWeight: 900, letterSpacing: -0.6, lineHeight: 1.1, marginTop: 12, textDecoration: cancelled ? "line-through" : "none" }}>{dayWords(startsAt)}</div>
          <div data-testid="practice-time" style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 17, fontWeight: 900 }}>
              {practiceClock(startsAt)} – {practiceClock(endsAt)}
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: MUTED }}>{length}</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 12, padding: "10px 12px", borderRadius: 14, background: "var(--solid)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tint} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
              <circle cx="12" cy="9.5" r="2.4" />
            </svg>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, overflowWrap: "anywhere" }}>{place}</div>
              {note ? <div style={{ fontSize: 11.5, color: SUB, marginTop: 3, lineHeight: 1.45, overflowWrap: "anywhere" }}>{note}</div> : null}
            </div>
          </div>
        </div>
      </div>

      {/* 2 · WHOSE IT IS */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, padding: "12px 14px", borderRadius: 18, background: "var(--card)", border: "1.5px solid var(--el)" }}>
        <ToolFace name={name} photoPath={photoPath} tint={tint} size={46} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: 0.8, color: tint }}>{label ? `${look.word} · ${label.toUpperCase()}` : look.word}</div>
          <div style={{ fontSize: 15.5, fontWeight: 900, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
          <div style={{ fontSize: 11.5, color: SUB, marginTop: 1 }}>{role}</div>
        </div>
      </div>

      {/* 3 · THE DOORS — one row each, and the one destructive act apart */}
      {doors.length ? (
        <div style={{ marginTop: 10, borderRadius: 18, background: "var(--card)", border: "1.5px solid var(--el)", overflow: "hidden" }}>
          {doors.map((d, i) => (
            <Link
              key={d.href}
              href={d.href}
              aria-label={d.label}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 14px", color: "var(--text)", textDecoration: "none", borderTop: i ? "1.5px solid var(--el)" : "none" }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 4, background: tint, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 900 }}>{d.word}</span>
                {d.sub ? <span style={{ display: "block", fontSize: 11, color: MUTED, marginTop: 1 }}>{d.sub}</span> : null}
              </span>
              <span aria-hidden="true" style={{ fontSize: 18, fontWeight: 900, color: MUTED }}>
                ›
              </span>
            </Link>
          ))}
        </div>
      ) : null}
      {danger ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, padding: "11px 14px", borderRadius: 18, border: "1.5px dashed color-mix(in srgb, #EF4444 45%, transparent)" }}>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 800, color: SUB }}>Not happening? Calling it off tells everybody on it.</span>
          {danger}
        </div>
      ) : null}

      {children}
    </div>
  );
}

/** the heading over the page's body — the register, or what you are to it */
export function PracticeBodyHead({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, color: "var(--muted)", margin: "2px 2px 10px" }}>{children}</div>;
}
