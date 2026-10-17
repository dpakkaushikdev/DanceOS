import Link from "next/link";
import { DOS_LEVEL_LABEL } from "@/lib/constants/styles";
import { INK, SUB } from "@/lib/design/tokens";
import type { PassUse } from "@/repositories/memberships";

/** THE PIECES EVERY MEMBERSHIP SCREEN DRAWS — the bar and where a pass went.
 *
 *  ⚠ A PLAIN MODULE, NOT "use client" (3 Oct 2026): the usage page and the
 *  student page are server components and the Memberships desk is a client one,
 *  and all three draw the same bar. No state and no hooks here, so it renders on
 *  either side. */

export type MembershipUnit = "classes" | "hours";

/** a unit count in words; hours may be a half (numeric(6,1)) */
export const unitWord = (unit: MembershipUnit, n: number) => {
  const v = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return unit === "hours" ? `${v} ${n === 1 ? "hour" : "hours"}` : `${v} ${n === 1 ? "class" : "classes"}`;
};

const numWord = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** HOW LONG IT LASTS, in one phrase (3 Oct 2026) — "valid 30 days" on a
 *  membership, and since 4 Oct 2026 "until used up" when it never expires (the
 *  user's Unlimited: "active till full consumed") rather than nothing */
export const validityWords = (days: number | null | undefined) => (days ? `valid ${days} days` : "until used up");

const shortDate = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(iso));

/** what a PASS says about its own expiry — "valid till 2 Nov 2026", "expired 2
 *  Nov 2026", or before payment "valid 30 days from payment"; null when it never
 *  expires. "Expired" comes from the date — there is no status for it. */
export function expiryWords(p: { validityDays: number | null; expiresAt: string | null; expired: boolean }): string | null {
  if (p.expiresAt) return p.expired ? `expired ${shortDate(p.expiresAt)}` : `valid till ${shortDate(p.expiresAt)}`;
  if (p.validityDays) return `valid ${p.validityDays} days from payment`;
  /* unlimited (4 Oct 2026): it never expires — said, rather than left blank */
  return "valid until used up";
}

const dayWords = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso));

/* the clock, read outside any component body (react-hooks/purity) */
const nowMs = () => Date.now();
/** whole days from now until `iso`, rounded up — 0 on the last day */
export const daysLeftOf = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - nowMs()) / 86_400_000));

/** HOW LONG A PASS LASTS, AS A STRIP (18 Oct 2026, the user: "better valid … with
 *  details written in short but upto the point"). The date on the left, how many
 *  days are left as a pill on the right — green, amber in the last week, red once
 *  gone. An unpaid pass says how long it WILL last; an unlimited one says so. */
export function PassValidity({ validityDays, expiresAt, expired, testId = "pass-validity" }: { validityDays: number | null; expiresAt: string | null; expired: boolean; testId?: string }) {
  let words: string;
  let pill: string | null = null;
  let tone = "#22C55E";
  if (expiresAt && expired) {
    words = `Expired ${shortDate(expiresAt)}`;
    pill = "Ended";
    tone = "#F87171";
  } else if (expiresAt) {
    const d = daysLeftOf(expiresAt);
    words = `Valid till ${shortDate(expiresAt)}`;
    pill = d === 0 ? "Last day" : `${d} ${d === 1 ? "day" : "days"} left`;
    tone = d <= 7 ? "#F59E0B" : "#22C55E";
  } else if (validityDays) {
    words = `Valid ${validityDays} days from payment`;
    tone = SUB;
  } else {
    words = "No expiry";
    pill = "Until used up";
    tone = SUB;
  }
  return (
    <div data-testid={testId} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, padding: "8px 10px", borderRadius: 12, background: "var(--el)" }}>
      <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={tone} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 800, color: expired ? tone : INK }}>{words}</span>
      {pill ? (
        <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 900, letterSpacing: 0.3, padding: "3px 8px", borderRadius: 999, color: tone, background: tone === SUB ? "var(--card)" : `${tone}1f` }}>{pill}</span>
      ) : null}
    </div>
  );
}

/** HOW FAR THROUGH — the one thing a membership is for (the user: "progress bar
 *  for completion"). Drawn from two real numbers, never a stored percentage.
 *
 *  ⚠⚠ RE-CUT 3 Oct 2026 (the user: *"better progress bar … price and classes
 *  should not be repeated"*). It was a 6px line with "3 of 10 used · 7 left"
 *  under it — while the card above already printed Size, Used and Left as tiles,
 *  so every number on a pass was said twice. Now the BAR IS the figure: what is
 *  LEFT at figure size on the left (the number somebody holding a pass actually
 *  wants), the share used on the right, and a 10px bar under them. A class pack
 *  of up to 20 is drawn as SEGMENTS, one per class, with a 2px surface gap
 *  between them, so "3 of 10" is seen rather than read; hours and big packs are
 *  one continuous fill.
 *
 *  ⚠ The `aria-label` keeps its exact old words ("3 of 10 used") and `data-pct`
 *  is unchanged — the e2e and two shoot scripts read both. */
export function ProgressBar({
  used,
  total,
  tint = "#22C55E",
  testId,
  unit = "classes",
  leftWord = "left",
  usedWord = "used",
}: {
  used: number;
  total: number;
  tint?: string;
  testId?: string;
  unit?: MembershipUnit;
  /** what the remainder IS to this reader — a holder's "left", a seller's "still owed" */
  leftWord?: string;
  /** what the used share IS — "used" for a holder, "danced" for a seller */
  usedWord?: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const left = Math.max(0, total - used);
  const done = total > 0 && left === 0;
  const segmented = unit === "classes" && Number.isInteger(total) && total > 1 && total <= 20;
  const fill = done ? "#22C55E" : tint;
  return (
    <div
      data-testid={testId}
      data-pct={pct}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={used}
      aria-label={`${used} of ${total} used`}
      style={{ marginTop: 10 }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <span style={{ minWidth: 0, fontSize: 11, color: SUB, fontWeight: 700 }}>
          <b style={{ fontSize: 20, fontWeight: 900, color: INK, letterSpacing: -0.4, fontVariantNumeric: "tabular-nums", marginRight: 5 }}>{numWord(left)}</b>
          {done ? "all done" : `${unitWord(unit, left).replace(/^\S+\s/, "")} ${leftWord}`}
        </span>
        {/* ⚠ THE COUNT, NOT ONLY A SHARE (18 Oct 2026): "1 of 3 used · 33%" says
            what was spent in the units it was bought in */}
        <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 900, color: INK, fontVariantNumeric: "tabular-nums" }}>
          {numWord(used)}/{numWord(total)} <span style={{ color: SUB, fontWeight: 700 }}>{usedWord} · {pct}%</span>
        </span>
      </div>
      {segmented ? (
        <div aria-hidden="true" style={{ display: "flex", gap: 2, marginTop: 7 }}>
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              style={{
                flex: 1,
                height: 10,
                borderRadius: i === 0 ? "999px 3px 3px 999px" : i === total - 1 ? "3px 999px 999px 3px" : 3,
                background: i < used ? fill : "var(--el)",
              }}
            />
          ))}
        </div>
      ) : (
        <div aria-hidden="true" style={{ height: 10, borderRadius: 999, background: "var(--el)", overflow: "hidden", marginTop: 7 }}>
          <div style={{ width: `${pct}%`, minWidth: used > 0 ? 10 : 0, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${fill}aa, ${fill})` }} />
        </div>
      )}
    </div>
  );
}

/** WHAT ONE PASS WAS SPENT ON (30 Sep 2026) — `pass_uses`, one line per seat,
 *  newest first. ⚠ Not drawn at all for a pass nothing has been spent on — an
 *  empty "Spent on" under a full bar would be the heading said twice. */
export function SpentOn({ uses, unit }: { uses: PassUse[]; unit: MembershipUnit }) {
  if (uses.length === 0) return null;
  return (
    <div data-testid="spent-on" style={{ marginTop: 12 }}>
      <div style={{ fontSize: 8.5, fontWeight: 900, letterSpacing: 0.9, color: "var(--muted)", marginBottom: 6 }}>SPENT ON · {uses.length}</div>
      {/* a row per seat: the date as a small block, the class, and what it took */}
      {uses.map((u) => {
        const [day, mon] = dayWords(u.startsAt).split(" ");
        return (
          <Link key={`${u.classId}-${u.startsAt}`} href={`/c/${u.shareSlug}`} aria-label={`Open ${u.style} · ${DOS_LEVEL_LABEL[u.level] ?? u.level}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderTop: "1.5px solid var(--el)", fontSize: 11.5, textDecoration: "none", color: INK, pointerEvents: "auto" }}>
            <span aria-hidden="true" style={{ flexShrink: 0, width: 34, textAlign: "center", borderRadius: 9, background: "var(--el)", padding: "3px 0", lineHeight: 1.05 }}>
              <b style={{ display: "block", fontSize: 13 }}>{day}</b>
              <span style={{ display: "block", fontSize: 8.5, fontWeight: 900, color: SUB, textTransform: "uppercase" }}>{mon}</span>
            </span>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <b>{u.style}</b> <span style={{ color: SUB }}>· {DOS_LEVEL_LABEL[u.level] ?? u.level}</span>
            </span>
            <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 900, padding: "3px 8px", borderRadius: 999, background: "var(--el)" }}>−{unitWord(unit, u.units)}</span>
          </Link>
        );
      })}
    </div>
  );
}
