"use client";

import Link from "next/link";
import { useState } from "react";
import { columnTab, columnTrack } from "@/components/ui/ColumnTabs";
import { DOS_DISPLAY } from "@/lib/design/tokens";
import { hoursWords, type ChartRow, type ChartSegment } from "@/types/stats";

/** COLUMN 3 OF A STYLE'S PAGE — who stands where in THIS style (2 Oct 2026, the
 *  user: "column-2 rankings for that particular dance style"). Every board is
 *  `dance_chart` with this style's name, read on the server in one pass, so
 *  switching board is client state and costs nothing. Each board says how many it
 *  ranked — a place is only honest with its denominator (Step 25).
 *
 *  ⚠ THE STATS SCREEN'S RANKINGS DESIGN (18 Oct 2026, the user: "dance style
 *  rankings to be similar in design"): a podium for the top three when the board
 *  starts at #1, then a card per row with the top-3 gradient numeral, the line
 *  under the name saying what the place is made of, and a bar of its points
 *  against the leader's. ⚠ No Crews board (the same day: "crew rankings to be
 *  removed for now"). */
const BOARDS: Array<[ChartSegment, string]> = [
  ["studio", "Studios"],
  ["artist", "Artists"],
  ["dancer", "Dancers"],
];

const hrefOf = (r: ChartRow): string => (r.kind === "studio" ? `/studio/${r.id}` : `/person/${r.id}`);
const initials = (n: string) => n.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
const lineOf = (r: ChartRow): string =>
  r.kind === "studio"
    ? `${r.conducted} session${r.conducted === 1 ? "" : "s"} held · ${hoursWords(r.hours)}`
    : r.kind === "artist"
      ? `${r.conducted} taught · ${r.assisted} assisted · ${hoursWords(r.hours)}`
      : `${r.attended} danced · ${hoursWords(r.hours)}`;

export function StyleBoards({ style, color, boards }: { style: string; color: string; boards: Partial<Record<ChartSegment, ChartRow[]>> }) {
  const [seg, setSeg] = useState<ChartSegment>(() => BOARDS.find(([k]) => (boards[k] ?? []).length > 0)?.[0] ?? "studio");
  const rows = boards[seg] ?? [];
  const population = rows[0]?.population ?? 0;
  const leader = Math.max(1, ...rows.map((r) => r.points));
  const podium = rows.length >= 3 && rows[0].place === 1 ? rows.slice(0, 3) : [];
  const list = podium.length ? rows.slice(3) : rows;
  const face = (r: ChartRow, size: number, ring?: string) => (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 900,
        fontFamily: DOS_DISPLAY,
        fontSize: Math.round(size * 0.32),
        background: `linear-gradient(135deg, ${color}, #7C3AED)`,
        boxShadow: ring ? `0 0 0 3px ${ring}` : undefined,
      }}
    >
      {initials(r.name)}
    </span>
  );
  return (
    <div>
      {/* the app's one column look (`ColumnTabs`, 11 Oct 2026) */}
      <div role="group" aria-label="Board" style={{ ...columnTrack(), marginBottom: 12 }}>
        {BOARDS.map(([k, word]) => {
          const on = seg === k;
          return (
            <button key={k} type="button" aria-pressed={on} onClick={() => setSeg(k)} style={columnTab(on)}>
              {word}
            </button>
          );
        })}
      </div>
      {rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "28px 16px", border: "1.5px dashed var(--el)", borderRadius: 16, fontSize: 12.5, color: "var(--sub)" }}>
          Nobody on this board for {style} yet — it fills as sessions in this style are danced.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--muted)", marginBottom: 6 }} data-testid="style-board-count">
            {population} ranked in {style}
          </div>
          {podium.length ? (
            <div data-testid="style-board-podium" style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr 1fr", alignItems: "end", gap: 8, margin: "4px 0 12px" }}>
              {[podium[1], podium[0], podium[2]].map((r) => {
                const medal = r.place === 1 ? "#F59E0B" : r.place === 2 ? "#94A3B8" : "#B45309";
                const tall = r.place === 1 ? 70 : r.place === 2 ? 52 : 40;
                return (
                  <Link key={`pod-${r.id}`} href={hrefOf(r)} aria-label={`${r.place}. ${r.name}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", textDecoration: "none", color: "var(--text)", minWidth: 0 }}>
                    <span style={{ marginBottom: 6, display: "inline-flex" }}>{face(r, r.place === 1 ? 54 : 44, medal)}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 900, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", marginBottom: 5 }}>{r.points} pts</span>
                    <span style={{ width: "100%", height: tall, borderRadius: "12px 12px 4px 4px", background: `linear-gradient(180deg, ${medal}, ${medal}55)`, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 6, color: "#fff", fontFamily: DOS_DISPLAY, fontWeight: 900, fontSize: 20 }}>
                      {r.place}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : null}
          {list.map((r) => {
            const top3 = r.place <= 3;
            return (
              <Link
                key={r.id}
                href={hrefOf(r)}
                aria-label={`${r.place}. ${r.name}`}
                style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--card)", border: "1.5px solid var(--el)", borderRadius: 14, padding: "10px 12px", marginBottom: 7, textDecoration: "none", color: "var(--text)" }}
              >
                <span style={{ width: 30, textAlign: "center", flexShrink: 0, fontFamily: DOS_DISPLAY, fontWeight: 900, fontSize: top3 ? 24 : 17, background: top3 ? "linear-gradient(120deg,#7C3AED,#EC4899)" : "none", WebkitBackgroundClip: top3 ? "text" : undefined, backgroundClip: top3 ? "text" : undefined, color: top3 ? "transparent" : "var(--muted)" }}>
                  {r.place}
                </span>
                {face(r, 38)}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                  <span style={{ display: "block", fontSize: 10, color: "var(--sub)", marginTop: 1 }}>{r.city ?? "—"}</span>
                  <span style={{ display: "block", fontSize: 9.5, color: "var(--muted)", marginTop: 2 }}>{lineOf(r)}</span>
                  <span aria-hidden="true" style={{ display: "block", height: 4, borderRadius: 999, background: "var(--el)", marginTop: 5, overflow: "hidden" }}>
                    <span style={{ display: "block", height: "100%", width: `${Math.max(4, (r.points / leader) * 100)}%`, borderRadius: 999, background: "linear-gradient(90deg,#7C3AED,#EC4899)" }} />
                  </span>
                </span>
                <span style={{ textAlign: "right", flexShrink: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{r.points}</span>
                  <span style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--muted)" }}>pts</span>
                </span>
              </Link>
            );
          })}
        </>
      )}
    </div>
  );
}
