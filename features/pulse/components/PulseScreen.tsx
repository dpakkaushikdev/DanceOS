import Link from "next/link";
import { BeatText } from "@/components/ui/BeatText";
import { InvertedPanel } from "@/components/ui/InvertedPanel";
import { SectionCard } from "@/components/ui/SectionCard";
import { TopPanel } from "@/components/ui/TopPanel";
import { SearchBox } from "@/features/discovery/components/SearchBox";
import { TodayShelf } from "@/features/home/components/TodayShelf";
import { BoardsBrowser } from "@/features/stats/components/BoardsBrowser";
import { DOS_DISPLAY, DOS_UI, GOLD, INK, LINE, MUTED, SUB, TAB_SUB, TAB_TITLE } from "@/lib/design/tokens";
import type { DeckItem } from "@/types/home";
import { SIDE_TINT, SIDE_VERB, hoursWords, type ChartMetric, type ChartRow, type ChartSegment, type DanceStats, type Side } from "@/types/stats";

/** PULSE (29 Oct 2026) — the second tab: your day, your numbers and where you
 *  stand, on one screen. Every part is one the app already draws elsewhere
 *  (Discover's search box, Home's Today's schedule, the record's figures, the
 *  boards), put together; "Overall rankings" opens the full boards. Row C189. */

export const PULSE_TINT = "#F43F5E";

const micro: React.CSSProperties = { fontSize: 9.5, fontWeight: 800, letterSpacing: 0.7, textTransform: "uppercase" };

function dayLine(nowIso: string): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "short" })
    .format(new Date(nowIso));
}

const PulseIcon = ({ c = "#fff" }: { c?: string }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />
  </svg>
);
const SIDES: Side[] = ["conducted", "assisted", "attended"];

export function PulseScreen({
  me,
  deck,
  stats,
  board,
  nowIso,
}: {
  me: { id: string; name: string; photoPath: string | null; city: string | null; kind: string };
  deck: DeckItem[];
  stats: DanceStats;
  board: { chart: ChartRow[]; segment: ChartSegment; metric: ChartMetric; city: string | null; cities: string[] };
  nowIso: string;
}) {
  const sessions: Record<Side, number> = { conducted: stats.sessionsConducted, assisted: stats.sessionsAssisted, attended: stats.sessionsAttended };
  const hours: Record<Side, number> = { conducted: stats.hoursConducted, assisted: stats.hoursAssisted, attended: stats.hoursAttended };
  const statsHref = `/person/${me.id}/stats`;

  return (
    <div style={{ background: "var(--bg)", color: INK, maxWidth: 430, margin: "0 auto", fontFamily: DOS_UI, minHeight: "100vh", padding: "16px var(--dos-gutter) 40px", boxSizing: "border-box" }}>
      <TopPanel tint={PULSE_TINT}>
        {/* no picture on the heading (30 Oct 2026, the user: "remove the profile pic on right from the heading on pulse page") */}
        <div style={{ minWidth: 0 }}>
          <h1 data-testid="pulse-title" style={{ ...TAB_TITLE, color: INK, marginTop: 4 }}>
            <BeatText text="Pulse" />
          </h1>
          <div data-testid="pulse-day" style={{ ...TAB_SUB, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dayLine(nowIso)}</div>
        </div>
        <SearchBox city={me.city ?? ""} margin="14px 0 2px" placeholder="Search studios, artists, styles, people" />
      </TopPanel>

      <InvertedPanel ground="page" style={{ marginTop: 12 }}>
        <TodayShelf deck={deck} />

        <SectionCard
          icon={<PulseIcon />}
          label="YOUR NUMBERS"
          col={PULSE_TINT}
          testId="pulse-numbers"
          right={
            <Link href={statsHref} style={{ fontSize: 11.5, fontWeight: 800, color: PULSE_TINT, textDecoration: "none" }}>
              Full stats ›
            </Link>
          }
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
            {SIDES.map((s) => (
              <div key={s} data-testid={`pulse-side-${s}`} style={{ border: `1.5px solid ${LINE}`, borderRadius: 14, padding: "11px 10px", background: `linear-gradient(160deg, ${SIDE_TINT[s]}22, transparent 70%)` }}>
                <div style={{ ...micro, color: SIDE_TINT[s] }}>{SIDE_VERB[s]}</div>
                <div style={{ fontFamily: DOS_DISPLAY, fontSize: 28, fontWeight: 900, lineHeight: 1.05, marginTop: 4 }}>{sessions[s]}</div>
                <div style={{ fontSize: 10.5, color: SUB, marginTop: 2 }}>{hoursWords(hours[s])}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${LINE}` }}>
            {[
              ["Points", stats.points.toLocaleString("en-IN")],
              ["Styles", String(stats.styles)],
              ["Studios", String(stats.studios)],
            ].map(([k, v]) => (
              <div key={k} style={{ textAlign: "center", flex: 1 }}>
                <div style={{ fontFamily: DOS_DISPLAY, fontSize: 18, fontWeight: 900 }}>{v}</div>
                <div style={{ ...micro, color: MUTED, marginTop: 2 }}>{k}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <div style={{ height: 12 }} />

        <BoardsBrowser
          chart={board.chart}
          segment={board.segment}
          metric={board.metric}
          city={board.city}
          cities={board.cities}
          basePath="/pulse"
          youId={me.id}
          label="BROWSE THE BOARD"
          footer={
            <Link
              href="/rankings"
              data-testid="pulse-overall-rankings"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14, padding: "13px 14px", borderRadius: 14, background: GOLD, color: "#1a1206", fontWeight: 900, fontSize: 14, textDecoration: "none" }}
            >
              <span aria-hidden="true">🏆</span> Overall rankings ›
            </Link>
          }
        />
      </InvertedPanel>
    </div>
  );
}
