import Link from "next/link";
import { BeatText } from "@/components/ui/BeatText";
import { InvertedPanel } from "@/components/ui/InvertedPanel";
import { TopPanel } from "@/components/ui/TopPanel";
import { ProfileShare } from "@/features/profiles/components/ProfileShare";
import { TodayShelf } from "@/features/home/components/TodayShelf";
import { BoardsBrowser } from "@/features/stats/components/BoardsBrowser";
import { WholeRecord } from "@/features/stats/components/WholeRecord";
import { RecordCards, personRecordCards } from "@/features/stats/components/RecordCards";
import { DOS_UI, GOLD, INK, TAB_SUB, TAB_TITLE } from "@/lib/design/tokens";
import type { DeckItem } from "@/types/home";
import type { ChartMetric, ChartRow, ChartSegment, DanceStats, HistoryRow } from "@/types/stats";

/** PULSE (29 Oct 2026) — the second tab: your day, your record and where you
 *  stand, on one screen. Every part is one the app already draws elsewhere
 *  (Discover's search box, Home's Today's schedule, the stats screen's WHOLE
 *  RECORD, the boards), put together; "Overall rankings" opens the full boards.
 *  Rows C189, C194.
 *
 *  ⚠ THE WHOLE RECORD REPLACED "YOUR NUMBERS" (the user: "replace the numbers
 *  section with the whole record on pulse"), and every section is its own
 *  squircle (the user: "give section dividers on pulse as well"). */

export const PULSE_TINT = "#F43F5E";

function dayLine(nowIso: string): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "short" })
    .format(new Date(nowIso));
}

const SECTION: React.CSSProperties = { marginTop: 12 };

export function PulseScreen({
  me,
  deck,
  history,
  stats,
  board,
  nowIso,
}: {
  stats: DanceStats;
  me: { id: string; name: string; photoPath: string | null; city: string | null; kind: string; isArtist: boolean };
  deck: DeckItem[];
  history: HistoryRow[];
  board: { chart: ChartRow[]; pinned: ChartRow[]; segment: ChartSegment; metric: ChartMetric; city: string | null; cities: string[] };
  nowIso: string;
}) {
  return (
    <div style={{ background: "var(--bg)", color: INK, maxWidth: 430, margin: "0 auto", fontFamily: DOS_UI, minHeight: "100vh", padding: "12px var(--dos-gutter) 40px", boxSizing: "border-box" }}>
      <TopPanel tint={PULSE_TINT}>
        {/* no picture on the heading (30 Oct 2026, the user: "remove the profile pic on right from the heading on pulse page") */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 data-testid="pulse-title" style={{ ...TAB_TITLE, color: INK, marginTop: 4 }}>
              <BeatText text="Pulse" />
            </h1>
            <div data-testid="pulse-day" style={{ ...TAB_SUB, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dayLine(nowIso)}</div>
          </div>
          {/* your own code, big, on the right (30 Oct 2026) — it watches for a
              check-in like the profile's own chip, so the door's answer shows on it */}
          <ProfileShare path={`/person/${me.id}`} name={me.name} watchCheckIn big />
        </div>
        {/* the DanceOS search moved to Discover, under the address (30 Oct 2026) */}
      </TopPanel>

      <InvertedPanel ground="page" style={SECTION}>
        <div data-testid="pulse-section-today">
          {/* Upcoming classes (29 Oct 2026): the next 10, the deck's cards and borders */}
          <TodayShelf deck={deck} title="Upcoming classes" unit="upcoming" emptyText="No Upcoming Classes" />
        </div>
      </InvertedPanel>

      <InvertedPanel ground="page" style={SECTION}>
        <div data-testid="pulse-section-record">
          {/* the three big tiles of THE NUMBERS, above the whole record (30 Oct 2026) */}
          <RecordCards cards={personRecordCards(stats, history)} testIdPrefix="pulse-stat" />
          {history.length > 0 ? (
            <WholeRecord history={history} nowIso={nowIso} subjectKind="person" isArtist={me.isArtist} />
          ) : (
            <div data-testid="pulse-record-empty" style={{ fontSize: 12.5, color: "var(--sub)", textAlign: "center", padding: "18px 8px" }}>
              Nothing on your record yet — it fills as you dance, teach and assist.
            </div>
          )}
          {/* the same button as Overall rankings (30 Oct 2026, the user: "full stats button on pulse should be like overall ranking. with icon") */}
          <Link
            href={`/person/${me.id}/stats`}
            data-testid="pulse-full-stats"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14, padding: "13px 14px", borderRadius: 14, background: GOLD, color: "#1a1206", fontWeight: 900, fontSize: 14, textDecoration: "none" }}
          >
            <span aria-hidden="true">📊</span> Full stats ›
          </Link>
        </div>
      </InvertedPanel>

      <InvertedPanel ground="page" style={SECTION}>
        <div data-testid="pulse-section-board">
          <BoardsBrowser
            chart={board.chart}
            segment={board.segment}
            metric={board.metric}
            city={board.city}
            cities={board.cities}
            basePath="/pulse"
            youId={me.id}
            pinned={board.pinned}
            limit={7}
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
        </div>
      </InvertedPanel>
    </div>
  );
}
