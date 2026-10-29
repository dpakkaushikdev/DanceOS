"use client";

import { useState, type CSSProperties } from "react";
import { dosStyleColor } from "@/lib/constants/styles";
import { columnTab, columnTrack } from "@/components/ui/ColumnTabs";
import { Portal } from "@/components/ui/Portal";
import { SectionCard } from "@/components/ui/SectionCard";
import { BTN_RESET } from "@/components/ui/buttonReset";
import { SHEET_ANIMATION } from "@/features/businesses/components/biz-kit";
import { useCloseOnBack } from "@/lib/hooks/useCloseOnBack";
import { CARD, DOS_DISPLAY, DOS_UI, INK, LILAC, LINE, MUTED, SUB } from "@/lib/design/tokens";
import { addDays, dayKeyOf } from "@/lib/format/month";
import { SIDE_TINT, type HistoryRow, type Side } from "@/types/stats";

/** THE WHOLE RECORD (10194) — lifted out of `StatsScreen` on 29 Oct 2026 so
 *  Pulse can draw the same section (the user: *"replace the numbers section with
 *  the whole record on pulse"*), and given the Earnings screen's periods:
 *  Day · Week · Month · Year · Custom (*"the whole record should also have year
 *  and custom filters with day week month how we have done for earnings"*).
 *
 *  ⚠ THE PERIOD IS A WINDOW, NOT ONLY A CHART SCALE: the side tiles, the chart
 *  and the group-by bars all count the sessions inside it, so the three can
 *  never disagree. Local state, not the URL — Pulse and a stats page share it,
 *  and neither has a period of its own to keep in the address.
 *
 *  Days are IST day keys throughout (`dayKeyOf`), so a 23:30 class on the 31st
 *  is the 31st's, never the 1st's. */

type Period = "day" | "week" | "month" | "year" | "custom";
type Dim = "style" | "artist" | "studio";
type SortKey = "sessions" | "hours" | "key";

const SIDES: Side[] = ["conducted", "assisted", "attended"];
const SIDE_PAST: Record<Side, string> = { conducted: "Taught", assisted: "Assisted", attended: "Trained" };
const micro: CSSProperties = { fontSize: 9.5, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PERIODS: Array<[Period, string]> = [
  ["day", "Day"],
  ["week", "Week"],
  ["month", "Month"],
  ["year", "Year"],
];

type Bucket = { start: string; end: string; label: string };

const dayLabel = (k: string) => `${Number(k.slice(8))} ${MONTHS[Number(k.slice(5, 7)) - 1]}`;
const monthStart = (k: string) => `${k.slice(0, 7)}-01`;
const monthEnd = (k: string) => {
  const [y, m] = k.split("-").map(Number);
  const t = new Date(Date.UTC(y, m, 0));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
};
const prevMonth = (k: string) => addDays(monthStart(k), -1);
const daysBetween = (a: string, b: string) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8))) / 86_400_000);

function bucketsFor(period: Period, today: string, firstKey: string | null, range: { from: string; to: string } | null): Bucket[] {
  if (period === "custom" && range) {
    const span = daysBetween(range.from, range.to);
    if (span <= 31) {
      return Array.from({ length: span + 1 }, (_, i) => {
        const d = addDays(range.from, i);
        return { start: d, end: d, label: dayLabel(d) };
      });
    }
    if (span <= 182) {
      const out: Bucket[] = [];
      for (let s = range.from; s <= range.to; s = addDays(s, 7)) {
        const e = addDays(s, 6) > range.to ? range.to : addDays(s, 6);
        out.push({ start: s, end: e, label: dayLabel(s) });
      }
      return out;
    }
    const out: Bucket[] = [];
    for (let m = monthStart(range.from); m <= range.to; m = addDays(monthEnd(m), 1)) {
      out.push({ start: m < range.from ? range.from : m, end: monthEnd(m) > range.to ? range.to : monthEnd(m), label: MONTHS[Number(m.slice(5, 7)) - 1] });
    }
    return out;
  }
  if (period === "day") {
    return Array.from({ length: 14 }, (_, i) => {
      const d = addDays(today, i - 13);
      return { start: d, end: d, label: dayLabel(d) };
    });
  }
  if (period === "week") {
    /* eight seven-day bins, the last one ending today */
    return Array.from({ length: 8 }, (_, i) => {
      const end = addDays(today, -7 * (7 - i));
      return { start: addDays(end, -6), end, label: dayLabel(addDays(end, -6)) };
    });
  }
  if (period === "month") {
    const out: Bucket[] = [];
    let m = monthStart(today);
    for (let i = 0; i < 6; i += 1) {
      out.unshift({ start: m, end: monthEnd(m), label: MONTHS[Number(m.slice(5, 7)) - 1] });
      m = monthStart(prevMonth(m));
    }
    return out;
  }
  /* year: from the first session's year (at most six back) to this one */
  const thisYear = Number(today.slice(0, 4));
  const firstYear = Math.max(thisYear - 5, firstKey ? Number(firstKey.slice(0, 4)) : thisYear);
  return Array.from({ length: thisYear - firstYear + 1 }, (_, i) => {
    const y = firstYear + i;
    return { start: `${y}-01-01`, end: `${y}-12-31`, label: String(y) };
  });
}

export function WholeRecord({
  history,
  nowIso,
  subjectKind,
  isArtist,
}: {
  /** the rows the record counts — already filtered by the caller */
  history: HistoryRow[];
  /** the server's clock; never a clock read during render */
  nowIso: string;
  subjectKind: "person" | "studio" | "crew";
  isArtist: boolean;
}) {
  const isStudioSubject = subjectKind === "studio";
  const allSides: Side[] = isStudioSubject ? ["conducted"] : SIDES;
  /* ALL THREE ON BY DEFAULT (30 Oct 2026, the user: "the whole record graph
   * should always have all selected together … and should be able to unselect
   * them which removes them from graph"). A side switched off leaves the chart,
   * the total and the group bars; the last one left cannot be switched off,
   * because an empty record reads as a measured zero. */
  const [offSides, setOffSides] = useState<Side[]>([]);
  const shownSides: Side[] = allSides.filter((s) => !offSides.includes(s));
  const toggleSide = (k: Side) =>
    setOffSides((cur) => (cur.includes(k) ? cur.filter((s) => s !== k) : allSides.length - cur.length > 1 ? [...cur, k] : cur));
  const pastOf = (k: Side) => (isStudioSubject && k === "conducted" ? "Held" : SIDE_PAST[k]);
  const today = dayKeyOf(nowIso);

  const [period, setPeriod] = useState<Period>("week");
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [dim, setDim] = useState<Dim>("style");
  const [sortKey, setSortKey] = useState<SortKey>("sessions");
  const [asc, setAsc] = useState(false);

  const keyed = history.map((r) => ({ r, k: dayKeyOf(r.startsAt) }));
  const firstKey = keyed.reduce<string | null>((m, x) => (m === null || x.k < m ? x.k : m), null);
  const buckets = bucketsFor(period, today, firstKey, range);
  const winFrom = buckets[0]?.start ?? today;
  const winTo = buckets[buckets.length - 1]?.end ?? today;
  const inWindow = keyed.filter((x) => x.k >= winFrom && x.k <= winTo);
  const rows = inWindow.map((x) => x.r);

  const counts = buckets.map((b) => {
    const c = { conducted: 0, assisted: 0, attended: 0 };
    inWindow.forEach((x) => {
      if (x.k >= b.start && x.k <= b.end) c[x.r.side] += 1;
    });
    return c;
  });
  const top = Math.max(1, ...counts.map((c) => shownSides.reduce((s, k) => s + c[k], 0)));
  const bySide = (s: Side) => rows.filter((r) => r.side === s);
  const shownRows = rows.filter((r) => shownSides.includes(r.side));
  const totalHours = Math.round((shownRows.reduce((s, r) => s + r.minutes, 0) / 60) * 10) / 10;
  const windowWords =
    period === "custom" && range
      ? `${dayLabel(range.from)} – ${dayLabel(range.to)}`
      : period === "day"
        ? "last 14 days"
        : period === "week"
          ? "last 8 weeks"
          : period === "month"
            ? "last 6 months"
            : buckets.length === 1
              ? buckets[0].label
              : `${buckets[0].label} – ${buckets[buckets.length - 1].label}`;

  /* the lower half, unchanged — grouped and sorted, inside the window */
  const keyOf = (r: HistoryRow) =>
    dim === "style" ? r.style : dim === "artist" ? (r.artistName ?? "—") : isStudioSubject ? (r.room ?? "No room") : (r.businessName ?? r.room ?? "—");
  const groups = (() => {
    const g = new Map<string, { key: string; sessions: number; hours: number }>();
    shownRows.forEach((r) => {
      const k = keyOf(r);
      const cur = g.get(k) ?? { key: k, sessions: 0, hours: 0 };
      cur.sessions += 1;
      cur.hours += r.minutes / 60;
      g.set(k, cur);
    });
    const out = [...g.values()].map((x) => ({ ...x, hours: Math.round(x.hours * 10) / 10 }));
    out.sort((a, b) => (sortKey === "key" ? (asc ? a.key.localeCompare(b.key) : b.key.localeCompare(a.key)) : asc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]));
    return out;
  })();
  const mx = Math.max(1, ...groups.map((x) => x[sortKey === "key" ? "sessions" : sortKey]));
  const DIMS: Array<[Dim, string]> = [
    ["style", "Dance style"],
    ["artist", isStudioSubject ? "Faculty" : isArtist ? "Artist" : "Faculty"],
    ["studio", isStudioSubject ? "Room" : "Studio"],
  ];
  const dense = buckets.length > 8;

  return (
    <SectionCard
      icon={
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 17l6-6 4 4 8-8M14 7h7v7" />
        </svg>
      }
      label="THE WHOLE RECORD"
      col="#0EA5E9"
    >
      <div data-testid="whole-record">
        {/* DAY · WEEK · MONTH · YEAR · CUSTOM — the Earnings screen's own track */}
        <div role="group" aria-label="Period" data-testid="record-period" style={{ ...columnTrack(), marginBottom: 12 }}>
          {PERIODS.map(([p, label]) => {
            const on = period === p;
            return (
              <button type="button" key={p} aria-pressed={on} aria-label={`By ${p}`} onClick={() => setPeriod(p)} style={{ ...BTN_RESET, ...columnTab(on) }}>
                {label}
              </button>
            );
          })}
          <button type="button" aria-pressed={period === "custom"} aria-haspopup="dialog" data-testid="record-custom" onClick={() => setCustomOpen(true)} style={{ ...BTN_RESET, ...columnTab(period === "custom") }}>
            Custom
          </button>
        </div>

        {/* THE WINDOW AT A GLANCE — what is counted, said once */}
        {/* sessions AND hours at one size (30 Oct 2026, the user: "session and hrs
            count above graph in same big font"), both following the side toggles */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          <span style={{ fontFamily: DOS_DISPLAY, fontWeight: 900, fontSize: 30, letterSpacing: -1, lineHeight: 1, fontVariantNumeric: "tabular-nums" }} data-testid="record-total">
            {shownRows.length}
          </span>
          <span style={{ fontSize: 12, fontWeight: 800, color: SUB, marginRight: 8 }}>session{shownRows.length === 1 ? "" : "s"}</span>
          <span style={{ fontFamily: DOS_DISPLAY, fontWeight: 900, fontSize: 30, letterSpacing: -1, lineHeight: 1, fontVariantNumeric: "tabular-nums" }} data-testid="record-hours">
            {totalHours}
          </span>
          <span style={{ fontSize: 12, fontWeight: 800, color: SUB }}>hours</span>
          <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 800, color: MUTED, whiteSpace: "nowrap" }} data-testid="record-window">
            {windowWords}
          </span>
        </div>

        {/* THE CHART — the three sides stacked; the side you picked stays bright */}
        <div style={{ background: "var(--solid)", border: `1.5px solid ${LINE}`, borderRadius: 16, padding: "14px 12px 10px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: dense ? 3 : 7, height: 118 }}>
            {counts.map((c, i) => {
              const tot = shownSides.reduce((s, k) => s + c[k], 0);
              return (
                <span key={i} title={`${buckets[i].label} · ${tot} session${tot === 1 ? "" : "s"}`} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "stretch", height: "100%", gap: 1.5 }}>
                  <span style={{ display: "block", textAlign: "center", fontSize: dense ? 8 : 10, fontWeight: 900, lineHeight: 1, marginBottom: 3, fontVariantNumeric: "tabular-nums", color: tot ? INK : "transparent" }}>{tot || "0"}</span>
                  {shownSides.map((k) =>
                    c[k] ? (
                      <span key={k} style={{ display: "block", width: "100%", borderRadius: 4, transition: "height .22s cubic-bezier(.22,.9,.34,1), opacity .18s", height: `${Math.max(4, Math.round((84 * c[k]) / top))}px`, background: SIDE_TINT[k] }} />
                    ) : null
                  )}
                  {tot === 0 ? <span style={{ display: "block", width: "100%", height: 3, borderRadius: 2, background: LINE }} /> : null}
                </span>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: dense ? 3 : 7, marginTop: 6 }}>
            {buckets.map((b, i) => (
              <span key={i} style={{ flex: 1, minWidth: 0, textAlign: "center", fontSize: 8.5, fontWeight: 800, color: MUTED, whiteSpace: "nowrap", overflow: "hidden" }}>
                {dense && i % 2 === 1 && i !== buckets.length - 1 ? "" : b.label}
              </span>
            ))}
          </div>
        </div>

        {/* WHICH SIDES OF THE FLOOR (10225) — all on by default, each a toggle */}
        {allSides.length > 1 ? (
          <div role="group" aria-label="Side" style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {allSides.map((k) => {
              const on = shownSides.includes(k);
              const col = SIDE_TINT[k];
              const n = bySide(k).length;
              return (
                <button type="button" key={k} data-testid={`record-side-${k}`} aria-label={`${pastOf(k)} — ${n}`} aria-pressed={on} onClick={() => toggleSide(k)} style={{ ...BTN_RESET, ...({ flex: 1, display: "flex", alignItems: "center", gap: 7, padding: "9px 10px", borderRadius: 999, cursor: "pointer", boxSizing: "border-box", background: on ? `${col}22` : CARD, border: `1.5px solid ${on ? col : LINE}`, opacity: on ? 1 : 0.6, transition: "background .15s, border-color .15s, opacity .15s" }) }}>
                  <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 3, boxSizing: "border-box", background: on ? col : "transparent", border: `2px solid ${col}`, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 900, color: on ? INK : SUB, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pastOf(k)}</span>
                  <span style={{ fontFamily: DOS_DISPLAY, fontSize: 15, fontWeight: 900, fontVariantNumeric: "tabular-nums", color: on ? col : INK }}>{n}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {/* group by, and order by (10325) — kept as it was (the user: "the lower half is perfect") */}
        <div role="group" aria-label="Group classes by" style={{ ...columnTrack(), marginBottom: 8 }}>
          {DIMS.map(([k, l]) => (
            <button type="button" key={k} aria-label={`Group by ${l}`} aria-pressed={dim === k} onClick={() => setDim(k)} style={{ ...BTN_RESET, ...columnTab(dim === k) }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ ...micro, color: MUTED }}>SORT</span>
          <span style={{ marginLeft: "auto", display: "inline-flex", gap: 2, background: LINE, borderRadius: 999, padding: 2, flexShrink: 0 }}>
            {(
              [
                ["sessions", "sessions"],
                ["hours", "hours"],
                ["key", "name"],
              ] as Array<[SortKey, string]>
            ).map(([k, l]) => (
              <button
                type="button"
                key={k}
                aria-label={`Sort by ${l}`}
                aria-pressed={sortKey === k}
                onClick={() => {
                  if (sortKey === k) setAsc(!asc);
                  else {
                    setSortKey(k);
                    setAsc(false);
                  }
                }}
                style={{ ...BTN_RESET, ...({ padding: "5px 11px", borderRadius: 999, cursor: "pointer", fontSize: 10.5, fontWeight: 900, whiteSpace: "nowrap", textTransform: "capitalize", transition: "background .18s ease, color .18s ease", background: sortKey === k ? INK : "transparent", color: sortKey === k ? LILAC : SUB }) }}
              >
                {l}
                {sortKey === k ? (asc ? " ↑" : " ↓") : ""}
              </button>
            ))}
          </span>
        </div>
        <div style={{ padding: "0 0 2px" }}>
          {groups.length === 0 ? <div style={{ fontSize: 11.5, color: MUTED, padding: "10px 0" }}>No classes in this period.</div> : null}
          {groups.map((r, i) => {
            const c = dim === "style" ? dosStyleColor(r.key) : "#5AC8FA";
            const v = r[sortKey === "key" ? "sessions" : sortKey];
            return (
              <div key={r.key} style={{ padding: "9px 0", borderBottom: i === groups.length - 1 ? "none" : `1.5px solid ${LINE}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 16, fontSize: 10, fontWeight: 800, color: MUTED, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{i + 1}</span>
                  {dim === "style" ? <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 5, background: c, flexShrink: 0 }} /> : null}
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.key}</span>
                  {(
                    [
                      ["sessions", `${r.sessions} ${r.sessions === 1 ? "session" : "sessions"}`],
                      ["hours", `${r.hours}h`],
                    ] as Array<[SortKey, string]>
                  ).map(([k, t]) => {
                    const lit = sortKey === k || (sortKey === "key" && k === "sessions");
                    return (
                      <span key={k} style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 900, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", padding: "3px 9px", borderRadius: 999, minWidth: k === "hours" ? 44 : undefined, textAlign: "center", background: lit ? `${c}22` : "transparent", color: lit ? INK : SUB, border: `1.5px solid ${lit ? `${c}66` : LINE}` }}>
                        {t}
                      </span>
                    );
                  })}
                </div>
                <div style={{ height: 5, borderRadius: 3, background: LINE, marginTop: 6, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.round((100 * v) / mx)}%`, background: c, borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {customOpen ? (
        <CustomSheet
          range={range}
          today={today}
          onClose={() => setCustomOpen(false)}
          onApply={(from, to) => {
            setRange(from <= to ? { from, to } : { from: to, to: from });
            setPeriod("custom");
            setCustomOpen(false);
          }}
        />
      ) : null}
    </SectionCard>
  );
}

/** A CUSTOM RANGE — the Earnings screen's own sheet: presets, then two dates */
function CustomSheet({ range, today, onClose, onApply }: { range: { from: string; to: string } | null; today: string; onClose: () => void; onApply: (from: string, to: string) => void }) {
  useCloseOnBack(onClose, true, { spend: false });
  const [from, setFrom] = useState(range?.from ?? "");
  const [to, setTo] = useState(range?.to ?? "");
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to);
  const chip: CSSProperties = { ...BTN_RESET, padding: "7px 12px", borderRadius: 999, border: "1.5px solid var(--el)", background: "var(--card)", fontSize: 11.5, fontWeight: 900, cursor: "pointer" };
  const input: CSSProperties = { width: "100%", boxSizing: "border-box", padding: "10px 11px", borderRadius: 12, border: "1.5px solid var(--el)", background: "var(--card)", color: INK, fontSize: 14, fontFamily: DOS_UI, textTransform: "none" };
  const presets: Array<[string, () => void]> = [
    ["Last 7 days", () => onApply(addDays(today, -6), today)],
    ["Last 30 days", () => onApply(addDays(today, -29), today)],
    ["Last 90 days", () => onApply(addDays(today, -89), today)],
    ["This month", () => onApply(`${today.slice(0, 7)}-01`, today)],
    ["This year", () => onApply(`${today.slice(0, 4)}-01-01`, today)],
  ];
  return (
    <Portal>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 960, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Custom dates"
          data-testid="record-custom-sheet"
          onClick={(e) => e.stopPropagation()}
          style={{ width: "100%", maxWidth: 430, background: "var(--solid)", color: INK, borderRadius: "24px 24px 0 0", padding: "10px var(--dos-gutter) 28px", boxSizing: "border-box", animation: SHEET_ANIMATION, fontFamily: DOS_UI }}
        >
          <div aria-hidden="true" style={{ width: 40, height: 4, borderRadius: 999, background: "var(--el)", margin: "0 auto 12px" }} />
          <h2 style={{ margin: "0 0 12px", fontSize: 19, fontWeight: 900 }}>Custom dates</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {presets.map(([label, go]) => (
              <button key={label} type="button" onClick={go} style={chip}>
                {label}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label style={{ ...micro, color: MUTED, display: "grid", gap: 5 }}>
              FROM
              <input type="date" aria-label="From" value={from} max={today} onChange={(e) => setFrom(e.target.value)} style={input} />
            </label>
            <label style={{ ...micro, color: MUTED, display: "grid", gap: 5 }}>
              TO
              <input type="date" aria-label="To" value={to} max={today} onChange={(e) => setTo(e.target.value)} style={input} />
            </label>
          </div>
          <button
            type="button"
            disabled={!ok}
            onClick={() => ok && onApply(from, to)}
            style={{ width: "100%", marginTop: 14, padding: "13px", borderRadius: 14, border: 0, background: ok ? "var(--text)" : "var(--el)", color: ok ? "var(--solid)" : SUB, fontSize: 14, fontWeight: 900, cursor: ok ? "pointer" : "default", fontFamily: DOS_UI }}
          >
            {ok ? "Show these dates" : "Pick both dates"}
          </button>
        </div>
      </div>
    </Portal>
  );
}
