"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { DOS_UI, LILAC, MUTED, SUB, TAB_SUB, TAB_TITLE } from "@/lib/design/tokens";
import { BeatText } from "@/components/ui/BeatText";
import { ColumnCount, columnTab, columnTrack } from "@/components/ui/ColumnTabs";
import { InvertedPanel } from "@/components/ui/InvertedPanel";
import { TopPanel } from "@/components/ui/TopPanel";
import { ENQ_CLOSED, enquiryStage, type Enquiry, type EnquiryJobAsk } from "@/types/enquiry";
import { EnquiryJobsList } from "@/features/enquiries/components/EnquiryJobsList";
import { DOS_MONO } from "./inbox-kit";
import { EnquiryDeskCard, enquiryMove } from "./EnquiryDeskCard";
import { SIDE_PARAM, type EnquiriesSide, type EnquiriesTab } from "@/features/inbox/enquiriesAddress";

/** ⚠⚠ THE ENQUIRIES TOOL, HANDLED THE WAY CLASSES IS (18 Oct 2026, the user:
 *  "handle enquiries like how we handle classes kinda messed up right now … can
 *  remove break up from enquiries … right wordings at right places and
 *  shorter"). The Classes screen is the pattern, part for part:
 *
 *   TO DO    — what waits on THIS profile: a new enquiry to accept, a quote to
 *              send or to answer, an addition, a completion, ending terms, and
 *              the jobs somebody asked you onto ("Asked to work on"). The tab's
 *              count is this column, amber.
 *   ONGOING  — open or running, but the other end's move.
 *   PAST     — completed, declined, withdrawn, called off.
 *
 *  One chip row narrows any column — All · Received · Sent — every chip always
 *  drawn, a 0 included; a studio's desk has no Sent side, so no chips at all.
 *  The column and the chip are the ADDRESS (`?tab=`, `?side=`), replaced rather
 *  than pushed. Each card carries its one move on its own bar.
 *
 *  ⚠ GONE: Received · Sent · Completed as columns, the three figures, the
 *  Breakup, the filter sheet and the Enquiries · Jobs switch — the jobs are a
 *  group inside the columns now. The pointer lines stay (11 Oct 2026): they say
 *  what waits on you on another tile. */

/** one line saying how many of something wait elsewhere, and where (11 Oct 2026) */
export interface InboxPointer {
  testId: string;
  n: number;
  href: string;
  /** singular / plural noun — "class request" / "class requests" */
  one: string;
  many: string;
  /** where it is answered, in words */
  where: string;
  /** the tile's accent, for the count badge */
  tint: string;
}

const TAB_WORD: Record<EnquiriesTab, string> = { todo: "To do", ongoing: "Ongoing", past: "Past" };
const SIDE_WORD: Record<EnquiriesSide, string> = { all: "All", in: "Received", out: "Sent" };
type Group = "jobsAsked" | "move" | "running" | "waiting" | "jobsOn" | "past";
const GROUP_WORD: Record<Group, string> = {
  jobsAsked: "Asked to work on",
  move: "Your move",
  running: "Running",
  waiting: "Waiting on them",
  jobsOn: "Jobs you're on",
  past: "",
};
const GROUP_TAB: Record<Group, EnquiriesTab> = { jobsAsked: "todo", move: "todo", running: "ongoing", waiting: "ongoing", jobsOn: "ongoing", past: "past" };
const GROUP_ORDER: Group[] = ["jobsAsked", "move", "running", "waiting", "jobsOn", "past"];

interface Row {
  key: string;
  id: string;
  side: "in" | "out";
  group: Group;
  at: string;
  e?: Enquiry;
  move?: string | null;
}

const RUNNING = new Set(["ongoing", "advance_paid", "paid", "completing"]);

const chip = (on: boolean, quiet: boolean): React.CSSProperties => ({
  flexShrink: 0,
  padding: "8px 13px",
  borderRadius: 999,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 800,
  fontFamily: "inherit",
  border: `1.5px solid ${on ? "var(--text)" : "var(--el)"}`,
  background: on ? "var(--text)" : "var(--card)",
  color: on ? "var(--solid)" : quiet ? MUTED : "var(--text)",
  whiteSpace: "nowrap",
});
const head: React.CSSProperties = { fontSize: 10, fontWeight: 900, letterSpacing: 1, color: SUB, textTransform: "uppercase", margin: "4px 2px 9px" };

export function InboxScreen({
  accent,
  enquiriesIn,
  enquiriesOut,
  nowIso,
  initialTab = null,
  initialSide = "all",
  detailBase = "/inbox/enquiries",
  deskSub = null,
  receivedOnly = false,
  settings = null,
  pointers = [],
  jobs = null,
}: {
  /** the profile-tinted wash the rest of the app opens on (5681) */
  accent: string;
  enquiriesIn: Enquiry[];
  enquiriesOut: Enquiry[];
  nowIso: string;
  /** the column the address asked for; null opens on To do while something
   *  waits on you, else Ongoing (the Classes rule) */
  initialTab?: EnquiriesTab | null;
  initialSide?: EnquiriesSide;
  /** where a card opens — a studio's desk keeps its own address */
  detailBase?: string;
  /** WHOSE DESK THIS IS, when it is a studio's (27 Sep 2026) */
  deskSub?: string | null;
  /** a studio's desk — what it was asked, and no Sent side */
  receivedOnly?: boolean;
  /** what you take — the enquiry settings' gear (27 Sep 2026) */
  settings?: ReactNode;
  /** the lines pointing at what moved to its own tile — each drawn only while n > 0 */
  pointers?: InboxPointer[];
  /** the jobs you were put on (`20261025090000`) — a person's desk only */
  jobs?: EnquiryJobAsk[] | null;
}) {
  /* ── every enquiry as one row, filed into its column ── */
  const rows: Row[] = [];
  const file = (e: Enquiry, side: "in" | "out") => {
    const stage = enquiryStage(e);
    const move = enquiryMove(e, side === "out", nowIso);
    const group: Group = ENQ_CLOSED.has(stage) ? "past" : move ? "move" : RUNNING.has(stage) ? "running" : "waiting";
    rows.push({ key: `${side}-${e.id}`, id: e.id, side, group, at: group === "past" ? (e.closedAt ?? e.createdAt) : e.createdAt, e, move });
  };
  enquiriesIn.forEach((e) => file(e, "in"));
  if (!receivedOnly) enquiriesOut.forEach((e) => file(e, "out"));
  const asked = (jobs ?? []).filter((j) => j.status === "asked");
  const on = (jobs ?? []).filter((j) => j.status !== "asked");

  const countsIn = (t: EnquiriesTab, s: EnquiriesSide) => {
    const enq = rows.filter((r) => GROUP_TAB[r.group] === t && (s === "all" || r.side === s));
    /* an enquiry sent to your own page is on both sides — "All" counts it once */
    const n = s === "all" ? new Set(enq.map((r) => r.id)).size : enq.length;
    const js = s === "out" ? 0 : t === "todo" ? asked.length : t === "ongoing" ? on.length : 0;
    return n + js;
  };
  const owed = countsIn("todo", "all");
  const live = pointers.filter((p) => p.n > 0);

  const [tab, setTab] = useState<EnquiriesTab>(initialTab ?? (owed > 0 ? "todo" : "ongoing"));
  const [side, setSide] = useState<EnquiriesSide>(receivedOnly ? "all" : initialSide);

  /* the column and the chip are the ADDRESS, REPLACED (the 19 Sep rule) — and the
     old `?show=` goes, so a reload lands on what is shown */
  const write = (t: EnquiriesTab, s: EnquiriesSide) => {
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete("show");
      u.searchParams.set("tab", t);
      if (SIDE_PARAM[s]) u.searchParams.set("side", SIDE_PARAM[s]);
      else u.searchParams.delete("side");
      window.history.replaceState(window.history.state, "", u.toString());
    } catch {
      /* the column still switches */
    }
  };
  const pickTab = (t: EnquiriesTab) => {
    setTab(t);
    write(t, side);
  };
  const pickSide = (s: EnquiriesSide) => {
    setSide(s);
    write(tab, s);
  };

  /* what this column shows, newest first, an enquiry drawn once under All */
  const shown = (() => {
    const seen = new Set<string>();
    return rows
      .filter((r) => GROUP_TAB[r.group] === tab && (side === "all" || r.side === side))
      .sort((a, b) => b.at.localeCompare(a.at))
      .filter((r) => {
        if (side !== "all") return true;
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      });
  })();
  const showJobs = side !== "out";

  const tabs = (
    <div role="group" aria-label="Enquiries" style={{ ...columnTrack(), marginTop: 4 }}>
      {(["todo", "ongoing", "past"] as EnquiriesTab[]).map((t) => {
        const n = countsIn(t, "all");
        return (
          <button key={t} type="button" aria-pressed={tab === t} aria-label={`${TAB_WORD[t]} enquiries`} data-testid={`enquiries-tab-${t}`} onClick={() => pickTab(t)} style={columnTab(tab === t)}>
            {TAB_WORD[t]}
            {n > 0 ? <ColumnCount n={n} on={tab === t} attention={t === "todo"} /> : null}
          </button>
        );
      })}
    </div>
  );

  /* ⚠ EVERY CHIP ALWAYS DRAWN, a 0 included (the Classes rule) — and none on a
     studio's desk, whose one chip would say what All says */
  const chips = receivedOnly ? null : (
    <div role="group" aria-label="Show" data-testid="enquiries-chips" style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 2, marginTop: 10 }}>
      {(["all", "in", "out"] as EnquiriesSide[]).map((s) => {
        const n = countsIn(tab, s);
        return (
          <button key={s} type="button" aria-pressed={side === s} aria-label={s === "all" ? "All enquiries" : `${SIDE_WORD[s]} enquiries`} data-testid={`enquiries-chip-${SIDE_PARAM[s] || "all"}`} onClick={() => pickSide(s)} style={chip(side === s, n === 0)}>
            {SIDE_WORD[s]} · {n}
          </button>
        );
      })}
    </div>
  );

  const groups = GROUP_ORDER.filter((g) => GROUP_TAB[g] === tab)
    .map((g) => {
      if (g === "jobsAsked") return { g, n: showJobs ? asked.length : 0, node: <EnquiryJobsList jobs={asked} bare /> };
      if (g === "jobsOn") return { g, n: showJobs ? on.length : 0, node: <EnquiryJobsList jobs={on} bare /> };
      const rs = shown.filter((r) => r.group === g);
      return {
        g,
        n: rs.length,
        node: rs.map((r) => <EnquiryDeskCard key={r.key} e={r.e!} out={r.side === "out"} nowIso={nowIso} href={`${detailBase}/${r.id}`} move={tab === "todo" ? (r.move ?? null) : null} />),
      };
    })
    .filter((x) => x.n > 0);

  const emptyWord = tab === "todo" ? "Nothing waiting on you." : tab === "ongoing" ? (side === "out" ? "Send one from any profile." : "Nothing on right now.") : "Nothing yet.";

  return (
    <div style={{ position: "relative", background: LILAC, color: "var(--text)", maxWidth: 430, margin: "0 auto", fontFamily: DOS_UI, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <TopPanel tint={accent} style={{ margin: "12px 16px 12px" }}>
        <div style={{ position: "relative" }}>
          <h1 data-testid="inbox-title" style={TAB_TITLE}>
            {/* ⚠ "Enquiries", not "Inbox" (18 Oct 2026, the user: "inbox to be renamed as Enquiries") */}
            <BeatText text="Enquiries" />
          </h1>
          {/* ⚠ no "N waiting on you" line under the heading (18 Oct 2026, the
              user) — the To do column's count says it. A studio's desk keeps
              whose desk it is. */}
          {deskSub ? (
            <div data-testid="inbox-sub" style={{ ...TAB_SUB, margin: "5px 0 12px" }}>
              {deskSub}
            </div>
          ) : (
            <div style={{ height: 12 }} />
          )}
          {/* the enquiry settings' gear, top right (12 Oct 2026) */}
          {settings}
        </div>
        {/* ⚠ WHAT WAITS ON ANOTHER TILE (11 Oct 2026) — one line each, only while something does */}
        {live.map((p) => (
          <Link
            key={p.testId}
            href={p.href}
            data-testid={p.testId}
            aria-label={`${p.n} ${p.n === 1 ? p.one : p.many} — ${p.where}`}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", marginBottom: 8, borderRadius: 16, background: "var(--card)", border: "1.5px solid var(--el)", color: "var(--text)", textDecoration: "none" }}
          >
            <span style={{ fontSize: 13, fontWeight: 900, flex: 1 }}>
              {`${p.n} ${p.n === 1 ? p.one : p.many} waiting`}
              <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "var(--sub)", marginTop: 2 }}>{p.where}</span>
            </span>
            <span style={{ fontSize: 10, fontWeight: 900, fontFamily: DOS_MONO, padding: "2px 8px", borderRadius: 999, background: p.tint, color: "#fff" }}>{p.n}</span>
            <span aria-hidden="true" style={{ fontWeight: 900 }}>
              ›
            </span>
          </Link>
        ))}
        {tabs}
        {chips}
      </TopPanel>

      <InvertedPanel ground="page" style={{ flex: 1, margin: "0 16px calc(var(--dos-foot, 96px) + 12px)", borderRadius: 22, padding: "16px 14px 18px" }}>
        <div data-testid="inbox-panel" data-tab={tab} style={{ position: "relative" }}>
          {groups.length === 0 ? (
            <div data-testid="enquiries-empty" style={{ textAlign: "center", padding: "30px 18px", color: SUB, border: "1.5px dashed var(--el)", borderRadius: 20, fontSize: 13, lineHeight: 1.5 }}>
              {emptyWord}
            </div>
          ) : (
            groups.map(({ g, n, node }) => (
              <section key={g} data-testid={`enquiries-${g}`} style={{ marginBottom: 6 }}>
                {GROUP_WORD[g] ? (
                  <h2 style={{ ...head, color: tab === "todo" ? "#F59E0B" : SUB }}>
                    {GROUP_WORD[g]} · {n}
                  </h2>
                ) : null}
                {node}
              </section>
            ))
          )}
        </div>
      </InvertedPanel>
    </div>
  );
}
