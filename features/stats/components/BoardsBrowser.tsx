"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { columnTab, columnTrack } from "@/components/ui/ColumnTabs";
import { SectionCard } from "@/components/ui/SectionCard";
import { CitySelect } from "@/features/geo/components/CitySelect";
import { photoUrl } from "@/lib/media/photo";
import { CARD, DOS_DISPLAY, INK, LILAC, LINE, MUTED, SUB } from "@/lib/design/tokens";
import { CHART_METRICS, CHART_SEGMENTS, CREW_POINT_RULES, POINT_RULES, type ChartMetric, type ChartRow, type ChartSegment } from "@/types/stats";

/** BROWSE THE BOARDS — lifted out of `StatsScreen` (29 Oct 2026, the user:
 *  "overall rankings should take to page with just browse the boards … pulse
 *  page — where you stand should be browse the board"). ONE board card for the
 *  stats screen's Rankings column, Pulse and `/rankings`, so the three cannot
 *  drift. Every control is URL state: `basePath` + `baseQuery` + the board's own
 *  `seg` / `city` / `metric`, and a change REPLACES the address in place. */

const DOS_MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
const shelf: React.CSSProperties = { fontSize: 17, fontWeight: 900, letterSpacing: -0.5, fontFamily: DOS_DISPLAY };
const figure: React.CSSProperties = { fontFamily: DOS_MONO, fontWeight: 700, fontVariantNumeric: "tabular-nums", letterSpacing: -0.3 };
const initialsOf = (name: string) => name.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "D";
const BOARDS_COL = "#7C3AED";
const BOARDS_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={BOARDS_COL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
);

/** A face on the board — the profile's own picture, initials on the gradient
 *  when there is none. */
export function BoardFace({ row, size, ring }: { row: ChartRow; size: number; ring?: string }) {
  const src = photoUrl(row.photoPath ?? null);
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        overflow: "hidden",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg,#7C3AED,#EC4899)",
        color: "#fff",
        fontWeight: 900,
        fontFamily: DOS_DISPLAY,
        fontSize: Math.round(size * 0.33),
        boxShadow: ring ? `0 0 0 3px ${ring}` : undefined,
      }}
    >
      {src ? <Image src={src} alt="" width={size} height={size} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : initialsOf(row.name)}
    </span>
  );
}

export function BoardsBrowser({
  chart,
  segment,
  metric,
  city,
  cities,
  basePath,
  baseQuery = "",
  boardPlace = null,
  youId = null,
  label = "BROWSE THE BOARDS",
  footer,
}: {
  chart: ChartRow[];
  segment: ChartSegment;
  metric: ChartMetric;
  city: string | null;
  cities: readonly string[];
  /** the address this board is read at */
  basePath: string;
  /** what the address carries besides the board's own state — `tab=charts` on a stats screen */
  baseQuery?: string;
  /** your own place on this board, when it is a people board (the stats screen) */
  boardPlace?: { place: number; population: number; points: number } | null;
  /** your id — your own row is marked on a people board (Pulse) */
  youId?: string | null;
  label?: string;
  footer?: React.ReactNode;
}) {
  const router = useRouter();
  const [rulesOpen, setRulesOpen] = useState(false);
  const isCrew = segment === "crew";
  const isStudio = segment === "studio";
  const peopleBoard = segment === "dancer" || segment === "artist";

  const chartHref = (over: { seg?: ChartSegment; city?: string | null; metric?: ChartMetric }) => {
    const seg = over.seg ?? segment;
    const c = over.city === undefined ? city : over.city;
    const m = over.metric ?? metric;
    const q = [baseQuery || null, `seg=${seg}`, c ? `city=${encodeURIComponent(c)}` : null, m !== "overall" ? `metric=${m}` : null].filter(Boolean).join("&");
    return `${basePath}?${q}`;
  };

  const valueOf = (r: ChartRow) => (metric === "overall" ? r.points : metric === "conducted" ? r.conducted : metric === "assisted" ? r.assisted : metric === "attended" ? r.attended : Math.round(r.hours * 10) / 10);
  const unit = CHART_METRICS.find((m) => m.k === metric)?.unit ?? "pts";
  const board = metric === "overall" ? chart : [...chart].sort((a, b) => valueOf(b) - valueOf(a)).map((r, i) => ({ ...r, place: i + 1 }));
  const leaderValue = Math.max(1, ...board.map((r) => valueOf(r)));
  const podiumRows = board.length >= 3 && board[0].place === 1 ? board.slice(0, 3) : [];
  const listRows = podiumRows.length ? board.slice(3) : board;
  const hrs = (h: number) => `${Math.round(h * 10) / 10}h`;
  const detailOf = (r: ChartRow) =>
    (r.kind === "crew"
      ? [`${r.extra} members`]
      : isStudio
        ? [`${r.conducted} held`, hrs(r.hours), `${r.extra} dancers`]
        : segment === "artist"
          ? [`${r.conducted} taught`, `${r.assisted} asst`, hrs(r.hours)]
          : [`${r.attended} danced`, hrs(r.hours)]
    ).join(" · ");
  const hrefOf = (r: ChartRow) => (r.kind === "crew" ? `/crew/${r.id}` : r.kind === "studio" ? `/studio/${r.id}` : `/person/${r.id}`);
  const isYouRow = (r: ChartRow) => peopleBoard && ((youId != null && r.id === youId) || (boardPlace != null && r.place === boardPlace.place));

  return (
    <SectionCard icon={BOARDS_ICON} label={label} col={BOARDS_COL} testId="boards-browser">
      <div role="group" aria-label="Board" style={{ ...columnTrack(), marginBottom: 9 }}>
        {CHART_SEGMENTS.filter((s) => s.k !== "crew").map((s) => {
          const on = segment === s.k;
          return (
            <Link key={s.k} href={chartHref({ seg: s.k })} replace scroll={false} aria-pressed={on} style={columnTab(on)}>
              {s.label}
            </Link>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", marginBottom: 8 }}>
        {CHART_METRICS.map((m) => {
          const on = metric === m.k;
          return (
            <Link key={m.k} href={chartHref({ metric: m.k })} replace scroll={false} aria-pressed={on} style={{ flexShrink: 0, padding: "7px 12px", borderRadius: 999, fontSize: 11, fontWeight: 800, whiteSpace: "nowrap", textDecoration: "none", background: on ? INK : CARD, color: on ? LILAC : SUB, border: `1.5px solid ${on ? INK : LINE}` }}>
              {m.label}
            </Link>
          );
        })}
      </div>
      <div style={{ marginBottom: 8 }}>
        {/* ⚠ `navigates` — picking replaces the address, so the sheet must not spend its history entry */}
        <CitySelect value={city} cities={cities} ariaLabel="City" allowNone noneLabel="Everywhere" placeholder="Everywhere" navigates onChange={(c) => router.replace(chartHref({ city: c }), { scroll: false })} />
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span style={shelf}>{CHART_SEGMENTS.find((s) => s.k === segment)?.label}</span>
        <button type="button" onClick={() => setRulesOpen((v) => !v)} aria-expanded={rulesOpen} style={{ marginLeft: "auto", fontSize: 10, fontWeight: 900, letterSpacing: 0.3, color: MUTED, background: "none", border: "none", padding: "2px 4px", cursor: "pointer", fontFamily: "inherit" }}>
          {rulesOpen ? "Hide points" : "Points"}
        </button>
        <span style={{ fontSize: 10.5, fontWeight: 800, color: MUTED }} data-testid="chart-population">
          {chart.length ? `${chart.length} of ${chart[0].population}` : "0"}
        </span>
      </div>
      {rulesOpen ? (
        <div style={{ background: CARD, border: `1.5px solid ${LINE}`, borderRadius: 14, padding: "4px 12px", marginBottom: 8 }}>
          {(isCrew ? CREW_POINT_RULES : POINT_RULES).map(([k, v, c]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1.5px solid ${LINE}` }}>
              <span style={{ fontSize: 12, color: SUB }}>{k}</span>
              <span style={{ fontSize: 11, fontWeight: 900, padding: "3px 10px", borderRadius: 999, background: `${c}1a`, color: c }}>{v}</span>
            </div>
          ))}
        </div>
      ) : null}
      {board.length === 0 ? (
        <div style={{ background: CARD, border: `1.5px dashed ${LINE}`, borderRadius: 18, padding: "36px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, fontFamily: DOS_DISPLAY }}>No board here yet</div>
          <div style={{ fontSize: 11.5, color: SUB, marginTop: 4 }}>Nobody in {city ?? "any city"} has finished a session on this board — a board of nobody is not a ranking.</div>
        </div>
      ) : (
        <>
          {podiumRows.length ? (
            <div data-testid="board-podium" style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr 1fr", alignItems: "end", gap: 8, margin: "4px 0 12px" }}>
              {[podiumRows[1], podiumRows[0], podiumRows[2]].map((r) => {
                const medal = r.place === 1 ? "#F59E0B" : r.place === 2 ? "#94A3B8" : "#B45309";
                const tall = r.place === 1 ? 70 : r.place === 2 ? 52 : 40;
                return (
                  <Link key={`pod-${r.kind}-${r.id}`} href={hrefOf(r)} aria-label={`${r.name} — place ${r.place} of ${r.population}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", textDecoration: "none", color: INK, minWidth: 0 }}>
                    <BoardFace row={r} size={r.place === 1 ? 54 : 44} ring={medal} />
                    <span style={{ height: 6 }} />
                    <span style={{ fontSize: 11.5, fontWeight: 900, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 900, padding: "2px 8px", borderRadius: 999, background: `${medal}26`, color: INK, marginTop: 3, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{valueOf(r)} {unit}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: MUTED, marginTop: 3, marginBottom: 5, maxWidth: "100%", textAlign: "center", lineHeight: 1.3 }}>{detailOf(r)}</span>
                    <span style={{ width: "100%", height: tall, borderRadius: "12px 12px 4px 4px", background: `linear-gradient(180deg, ${medal}, ${medal}55)`, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 6, color: "#fff", fontFamily: DOS_DISPLAY, fontWeight: 900, fontSize: 20 }}>
                      {r.place}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : null}
          {listRows.map((r) => {
            const top3 = r.place <= 3;
            const isYou = isYouRow(r);
            return (
              <Link key={`${r.kind}-${r.id}`} href={hrefOf(r)} aria-label={`${isYou ? "You — " : ""}${r.name} — place ${r.place} of ${r.population}`} style={{ position: "relative", overflow: "hidden", display: "flex", alignItems: "center", gap: 10, background: isYou ? "linear-gradient(120deg,#7C3AED22,#EC489922)" : CARD, border: `1.5px solid ${isYou ? "#7C3AED77" : LINE}`, borderRadius: 14, padding: "10px 12px 12px", marginBottom: 7, color: INK, textDecoration: "none" }}>
                <span style={{ ...figure, width: 28, height: 28, borderRadius: 9, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontFamily: DOS_DISPLAY, fontWeight: 900, background: top3 ? "linear-gradient(135deg,#7C3AED,#EC4899)" : LINE, color: top3 ? "#fff" : SUB }}>{r.place}</span>
                <BoardFace row={r} size={36} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.name}
                    {isYou ? <span style={{ marginLeft: 6, fontSize: 8.5, fontWeight: 900, letterSpacing: 0.6, padding: "2px 6px", borderRadius: 999, background: "#7C3AED", color: "#fff", verticalAlign: "middle" }}>YOU</span> : null}
                  </span>
                  <span style={{ display: "block", fontSize: 10, fontWeight: 700, color: MUTED, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detailOf(r)}</span>
                </span>
                <span aria-hidden="true" style={{ position: "absolute", left: 0, bottom: 0, height: 3, width: `${Math.max(4, (valueOf(r) / leaderValue) * 100)}%`, background: "linear-gradient(90deg,#7C3AED,#EC4899)" }} />
                <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 900, padding: "4px 10px", borderRadius: 999, border: `1.5px solid ${LINE}`, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                  {valueOf(r)} <span style={{ fontSize: 9, fontWeight: 800, color: MUTED }}>{unit}</span>
                </span>
              </Link>
            );
          })}
        </>
      )}
      {footer}
    </SectionCard>
  );
}
