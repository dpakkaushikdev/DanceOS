import { SUB } from "@/lib/design/tokens";

const DOS_MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
import { SIDE_TINT, hoursWords, type DanceStats, type HistoryRow, type Side } from "@/types/stats";

/** THE THREE BIG TILES of THE NUMBERS — lifted out of `StatsScreen` on 30 Oct
 *  2026 so Pulse draws the same three above its whole record (the user: "the
 *  numbers section only top 3 big tiles should also be on pulse above the whole
 *  record"). One component, so the stats page and Pulse cannot disagree. */

export type RecordCard = { key: string; label: string; n: number; aria: string; colour: string };

const SIDES: Side[] = ["conducted", "assisted", "attended"];
const SIDE_CARD: Record<Side, string> = { conducted: "Classes taught", assisted: "Assisted on", attended: "Classes taken" };

/** A person's three cards — the three sides of the floor.
 *
 *  ⚠ WHEN THE RECORD'S OWN ROWS ARE HERE, THE CARDS COUNT THEM (30 Oct 2026, the
 *  user: "the whole record does not match with numbers above"). `DanceStats` is
 *  the database's arithmetic and counts a class with no faculty, which the record
 *  leaves off — so the tiles and the record below them disagreed. With `history`
 *  (the caller's own, already filtered) both read one list; `DanceStats` is only
 *  the fallback for somebody else's record, where no rows are readable. */
export function personRecordCards(stats: DanceStats, history?: HistoryRow[]): RecordCard[] {
  return SIDES.map((k) => {
    const rows = history && history.length > 0 ? history.filter((r) => r.side === k) : null;
    const n = rows ? rows.length : k === "conducted" ? stats.sessionsConducted : k === "assisted" ? stats.sessionsAssisted : stats.sessionsAttended;
    const h = hoursWords(
      rows
        ? Math.round((rows.reduce((s, r) => s + r.minutes, 0) / 60) * 10) / 10
        : k === "conducted"
          ? stats.hoursConducted
          : k === "assisted"
            ? stats.hoursAssisted
            : stats.hoursAttended
    );
    /* ⚠ the accessible name is the prototype's sentence — the suite reads a card by it */
    return { key: k, label: SIDE_CARD[k], n, aria: `${SIDE_CARD[k]} — ${n} session${n === 1 ? "" : "s"}, ${h}`, colour: SIDE_TINT[k] };
  });
}

export function RecordCards({ cards, testIdPrefix = "stat" }: { cards: RecordCard[]; testIdPrefix?: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cards.length}, 1fr)`, gap: 8, marginBottom: 9 }}>
      {cards.map((c) => (
        <div key={c.key} aria-label={c.aria} style={{ position: "relative", overflow: "hidden", background: `${c.colour}12`, border: `1.5px solid ${c.colour}55`, borderRadius: 14, padding: "12px 11px 13px" }}>
          <span aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 3, background: c.colour }} />
          <div style={{ fontFamily: DOS_MONO, fontWeight: 900, fontVariantNumeric: "tabular-nums", letterSpacing: -0.3, fontSize: 23, lineHeight: 1, color: c.colour }} data-testid={`${testIdPrefix}-${c.key}`}>
            {c.n}
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: 0.5, textTransform: "uppercase", color: SUB, marginTop: 5 }}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}
