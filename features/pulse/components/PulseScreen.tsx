import Image from "next/image";
import Link from "next/link";
import { BeatText } from "@/components/ui/BeatText";
import { InvertedPanel } from "@/components/ui/InvertedPanel";
import { SectionCard } from "@/components/ui/SectionCard";
import { TopPanel } from "@/components/ui/TopPanel";
import { SearchBox } from "@/features/discovery/components/SearchBox";
import { TodayShelf } from "@/features/home/components/TodayShelf";
import { gradientOf } from "@/features/profiles/components/profile-kit";
import { DOS_DISPLAY, DOS_UI, GOLD, INK, LINE, MUTED, SUB, TAB_SUB, TAB_TITLE } from "@/lib/design/tokens";
import { photoUrl } from "@/lib/media/photo";
import type { DeckItem } from "@/types/home";
import { SEG_WORD, SIDE_TINT, SIDE_VERB, hoursWords, type ChartRow, type ChartSegment, type DanceStats, type Side, type Standing } from "@/types/stats";

/** PULSE (29 Oct 2026) — the second tab: your day, your numbers and where you
 *  stand, on one screen. Every part is one the app already draws elsewhere
 *  (Discover's search box, Home's Today's schedule, the record's figures, the
 *  boards), put together; "Overall rankings" opens the full boards. Row C189. */

export const PULSE_TINT = "#F43F5E";

const micro: React.CSSProperties = { fontSize: 9.5, fontWeight: 800, letterSpacing: 0.7, textTransform: "uppercase" };

function dayLine(nowIso: string): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "short" })
    .format(new Date(nowIso))
    .replace(",", " ·")
    .toUpperCase();
}

function Face({ name, path, size }: { name: string; path: string | null | undefined; size: number }) {
  const g = gradientOf(name);
  const src = photoUrl(path ?? null);
  const initials = name.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  return (
    <span style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, overflow: "hidden", background: `linear-gradient(135deg,${g[0]},${g[1]})`, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: Math.round(size * 0.34) }}>
      {src ? <Image src={src} alt="" width={size} height={size} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : initials}
    </span>
  );
}

const PulseIcon = ({ c = "#fff" }: { c?: string }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />
  </svg>
);
const TrophyIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />
  </svg>
);

const SIDES: Side[] = ["conducted", "assisted", "attended"];

export function PulseScreen({
  me,
  segment,
  deck,
  stats,
  standings,
  top,
  nowIso,
}: {
  me: { id: string; name: string; photoPath: string | null; city: string | null; kind: string };
  segment: ChartSegment;
  deck: DeckItem[];
  stats: DanceStats;
  standings: Standing[];
  top: ChartRow[];
  nowIso: string;
}) {
  const sessions: Record<Side, number> = { conducted: stats.sessionsConducted, assisted: stats.sessionsAssisted, attended: stats.sessionsAttended };
  const hours: Record<Side, number> = { conducted: stats.hoursConducted, assisted: stats.hoursAssisted, attended: stats.hoursAttended };
  const statsHref = `/person/${me.id}/stats`;
  const word = SEG_WORD[segment];

  return (
    <div style={{ background: "var(--bg)", color: INK, maxWidth: 430, margin: "0 auto", fontFamily: DOS_UI, minHeight: "100vh", padding: "16px var(--dos-gutter) 40px", boxSizing: "border-box" }}>
      <TopPanel tint={PULSE_TINT}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div data-testid="pulse-day" style={{ ...micro, color: PULSE_TINT, display: "flex", alignItems: "center", gap: 6 }}>
              <PulseIcon c={PULSE_TINT} />
              {dayLine(nowIso)}
            </div>
            <h1 data-testid="pulse-title" style={{ ...TAB_TITLE, color: INK, marginTop: 4 }}>
              <BeatText text="Pulse" />
            </h1>
            <div style={{ ...TAB_SUB, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Your day, your numbers, your place.</div>
          </div>
          <Link href={`/person/${me.id}`} aria-label={`${me.name} — your page`} style={{ borderRadius: "50%", padding: 2, background: `linear-gradient(135deg,${PULSE_TINT},#F59E0B)`, flexShrink: 0, display: "inline-flex" }}>
            <Face name={me.name} path={me.photoPath} size={52} />
          </Link>
        </div>
        <SearchBox city={me.city ?? ""} margin="14px 0 2px" placeholder="Search studios, artists, crews, people" />
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

        <SectionCard icon={<TrophyIcon />} label="WHERE YOU STAND" col={GOLD} testId="pulse-standing">
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${standings.length}, minmax(0,1fr))`, gap: 8 }}>
            {standings.map((st) => (
              <div key={st.scope} data-testid="pulse-place" style={{ border: `1.5px solid ${LINE}`, borderRadius: 14, padding: "12px 12px", background: `linear-gradient(160deg, ${GOLD}22, transparent 70%)` }}>
                <div style={{ ...micro, color: MUTED }}>{st.scope}</div>
                {st.row ? (
                  <>
                    <div style={{ fontFamily: DOS_DISPLAY, fontSize: 30, fontWeight: 900, lineHeight: 1.05, marginTop: 4, color: GOLD }}>#{st.row.place}</div>
                    <div style={{ fontSize: 11, color: SUB, marginTop: 2 }}>
                      of {st.row.population} {st.row.population === 1 ? word.one : word.many}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 12.5, color: SUB, marginTop: 8, lineHeight: 1.35 }}>Not on this board yet</div>
                )}
              </div>
            ))}
          </div>

          {top.length > 0 ? (
            <>
              <div style={{ ...micro, color: MUTED, margin: "14px 0 6px" }}>Top of the board · {word.many}</div>
              <div style={{ display: "grid", gap: 6 }}>
                {top.map((r) => {
                  const mine = r.id === me.id;
                  return (
                    <div key={r.id} data-testid="pulse-top-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 12, border: `1.5px solid ${mine ? GOLD : LINE}`, background: mine ? `${GOLD}1a` : "transparent" }}>
                      <span style={{ width: 22, textAlign: "center", fontFamily: DOS_DISPLAY, fontWeight: 900, fontSize: 15, color: r.place <= 3 ? GOLD : SUB }}>{r.place}</span>
                      <Face name={r.name} path={r.photoPath} size={30} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.name}
                        {mine ? <span style={{ color: GOLD, fontWeight: 800 }}> · You</span> : null}
                      </span>
                      <span style={{ fontSize: 11.5, fontWeight: 800, color: SUB, whiteSpace: "nowrap" }}>{r.points.toLocaleString("en-IN")} pts</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}

          <Link
            href={`${statsHref}?tab=charts`}
            data-testid="pulse-overall-rankings"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14, padding: "13px 14px", borderRadius: 14, background: GOLD, color: "#1a1206", fontWeight: 900, fontSize: 14, textDecoration: "none" }}
          >
            <span aria-hidden="true">🏆</span> Overall rankings ›
          </Link>
        </SectionCard>
      </InvertedPanel>
    </div>
  );
}
