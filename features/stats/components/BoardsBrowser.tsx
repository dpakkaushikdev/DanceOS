"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { columnTab, columnTrack } from "@/components/ui/ColumnTabs";
import { SectionCard } from "@/components/ui/SectionCard";
import { CitySelect } from "@/features/geo/components/CitySelect";
import { photoUrl } from "@/lib/media/photo";
import { CARD, DOS_DISPLAY, INK, LILAC, LINE, MUTED, SUB } from "@/lib/design/tokens";
import { CHART_SEGMENTS, METRICS_FOR, metricFor, type ChartMetric, type ChartRow, type ChartSegment } from "@/types/stats";

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
  metric: metricAsked,
  city,
  cities,
  basePath,
  baseQuery = "",
  boardPlace = null,
  youId = null,
  label = "BROWSE THE BOARDS",
  footer,
  limit = null,
}: {
  /** at most this many rows (Pulse: 7) */
  limit?: number | null;
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
  const peopleBoard = segment === "dancer" || segment === "artist";

  /* ⚠ each board offers only what its rows carry (METRICS_FOR); a metric carried
     over from another board that this one cannot rank by falls back to Overall */
  const metrics = METRICS_FOR[segment];
  const metric = metricFor(segment, metricAsked);
  const chartHref = (over: { seg?: ChartSegment; city?: string | null; metric?: ChartMetric }) => {
    const seg = over.seg ?? segment;
    const c = over.city === undefined ? city : over.city;
    const m = metricFor(seg, over.metric ?? metric);
    const q = [baseQuery || null, `seg=${seg}`, c ? `city=${encodeURIComponent(c)}` : null, m !== "overall" ? `metric=${m}` : null].filter(Boolean).join("&");
    return `${basePath}?${q}`;
  };

  const valueOf = (r: ChartRow) =>
    metric === "overall" ? r.points : metric === "conducted" ? r.conducted : metric === "assisted" ? r.assisted : metric === "attended" ? r.attended : metric === "people" ? r.extra : Math.round(r.hours * 10) / 10;
  const unit = metrics.find((m) => m.k === metric)?.unit ?? "pts";
  const ranked = metric === "overall" ? chart : [...chart].sort((a, b) => valueOf(b) - valueOf(a)).map((r, i) => ({ ...r, place: i + 1 }));
  /* ⚠ Pulse shows at most 7 (29 Oct 2026, the user: "not more then 7 on browse
     the board on pulse") — the full board is Overall rankings, one press below */
  const board = limit != null ? ranked.slice(0, limit) : ranked;
  const leaderValue = Math.max(1, ...board.map((r) => valueOf(r)));
  const podiumRows = board.length >= 3 && board[0].place === 1 ? board.slice(0, 3) : [];
  const listRows = podiumRows.length ? board.slice(3) : board;
  /* ⚠ NO DETAIL LINE UNDER A NAME (30 Oct 2026, the user: "remove the subheading
     below every person or studio in browse the board which says taught asst
     etc"): the row is the place, the face, the name and the metric's own figure */
  const hrefOf = (r: ChartRow) => (r.kind === "crew" ? `/crew/${r.id}` : r.kind === "studio" ? `/studio/${r.id}` : `/person/${r.id}`);
  const isYouRow = (r: ChartRow) => peopleBoard && ((youId != null && r.id === youId) || (boardPlace != null && r.place === boardPlace.place));
  /* ⚠ YOUR OWN ROW IS EMERALD, BOLD, on the podium and below it (29 Oct 2026,
     the user: "should highlight your own profile with a bolder and different
     looking color when on podium or below") — no other row on a board is green */
  const YOU_COL = "#10B981";
  const youPill = <span style={{ fontSize: 8.5, fontWeight: 900, letterSpacing: 0.6, padding: "2px 7px", borderRadius: 999, background: YOU_COL, color: "#fff", whiteSpace: "nowrap" }}>YOU</span>;

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
        {metrics.map((m) => {
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

      {/* ⚠ only the board's name on this line (29 Oct 2026, the user: "remove
          points 6 of 6 on right side written in small text from browse the board") */}
      <div style={{ marginBottom: 6 }}>
        <span style={shelf}>{CHART_SEGMENTS.find((s) => s.k === segment)?.label}</span>
      </div>
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
                const you = isYouRow(r);
                return (
                  <Link key={`pod-${r.kind}-${r.id}`} href={hrefOf(r)} data-you={you ? "1" : undefined} aria-label={`${you ? "You — " : ""}${r.name} — place ${r.place} of ${r.population}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", textDecoration: "none", color: INK, minWidth: 0, borderRadius: 16, padding: you ? "6px 4px 0" : 0, background: you ? `${YOU_COL}22` : undefined, boxShadow: you ? `0 0 0 2px ${YOU_COL}` : undefined }}>
                    <BoardFace row={r} size={r.place === 1 ? 54 : 44} ring={you ? YOU_COL : medal} />
                    <span style={{ height: 6 }} />
                    {you ? <span style={{ marginBottom: 3 }}>{youPill}</span> : null}
                    <span style={{ fontSize: 11.5, fontWeight: 900, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 900, padding: "2px 8px", borderRadius: 999, background: `${medal}26`, color: INK, marginTop: 3, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{valueOf(r)} {unit}</span>
                    <span style={{ height: 6 }} />
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
              <Link key={`${r.kind}-${r.id}`} href={hrefOf(r)} data-you={isYou ? "1" : undefined} aria-label={`${isYou ? "You — " : ""}${r.name} — place ${r.place} of ${r.population}`} style={{ position: "relative", overflow: "hidden", display: "flex", alignItems: "center", gap: 10, background: isYou ? `linear-gradient(120deg,${YOU_COL}33,${YOU_COL}14)` : CARD, border: `${isYou ? 2.5 : 1.5}px solid ${isYou ? YOU_COL : LINE}`, borderRadius: 14, padding: "9px 12px 11px", marginBottom: 7, color: INK, textDecoration: "none" }}>
                <span style={{ ...figure, width: 28, height: 28, borderRadius: 9, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontFamily: DOS_DISPLAY, fontWeight: 900, background: isYou ? YOU_COL : top3 ? "linear-gradient(135deg,#7C3AED,#EC4899)" : LINE, color: isYou || top3 ? "#fff" : SUB }}>{r.place}</span>
                <BoardFace row={r} size={36} ring={isYou ? YOU_COL : undefined} />
                <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ minWidth: 0, fontSize: 13, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                  {isYou ? youPill : null}
                </span>
                <span aria-hidden="true" style={{ position: "absolute", left: 0, bottom: 0, height: 3, width: `${Math.max(4, (valueOf(r) / leaderValue) * 100)}%`, background: isYou ? YOU_COL : "linear-gradient(90deg,#7C3AED,#EC4899)" }} />
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
