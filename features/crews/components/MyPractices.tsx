"use client";

import { useState, type ReactNode } from "react";
import { DeskBody, DeskTop } from "@/components/ui/DeskSections";
import { ColumnCount, columnTab, columnTrack } from "@/components/ui/ColumnTabs";
import { MUTED, SUB } from "@/lib/design/tokens";
import type { CrewPractice } from "@/types/crewPractice";
import type { MyEnquiryPractice } from "@/types/enquiry";
import { EnquiryPracticeCard } from "@/features/enquiries/components/EnquiryPracticeCard";
import { PRACTICE_HEAD, PracticeCard, practiceDayKey } from "./practice-card";

/** ⚠⚠ PRACTICE, HANDLED THE WAY CLASSES ARE (18 Oct 2026, the user: *"handle
 *  practice like classes as well"*). One screen, two columns — UPCOMING (Today ·
 *  This week · Later) and PAST (newest first) — and one chip row, All · Crew ·
 *  Job, every chip always drawn with its count, 0 included.
 *
 *  ⚠ NO To do COLUMN: nobody answers a practice (11 Oct 2026), so nothing ever
 *  waits on the reader, and a column that can only be empty is a door onto an
 *  empty room.
 *
 *  ⚠ No register and no buttons on a card: each card opens the practice's own
 *  page, which holds the register for whoever runs it.
 *
 *  The tab and the chip are the ADDRESS (`?tab=` · `?kind=`), REPLACED rather
 *  than pushed — a setting of a page replaces, so back still leaves. */

export type PracticeTab = "upcoming" | "past";
export type PracticeChip = "all" | "crew" | "job";

type Group = "today" | "week" | "later" | "past";
const GROUP_WORD: Record<Group, string> = { today: "Today", week: "This week", later: "Later", past: "Past" };
const TAB_WORD: Record<PracticeTab, string> = { upcoming: "Upcoming", past: "Past" };
const CHIP_WORD: Record<PracticeChip, string> = { all: "All", crew: "Crew", job: "Job" };

type Item = { key: string; kind: "crew" | "job"; startsAt: string; tab: PracticeTab; group: Group; node: ReactNode };

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

export function PracticeHome({
  top,
  crew,
  job,
  todayIso,
  initialTab,
  initialChip,
  basePath = "/practice",
  showChips = true,
}: {
  /* a job practice opens at `${basePath}/job/{id}` — a studio's under the studio */
  /** the page's own heading — a server node */
  top: ReactNode;
  crew: CrewPractice[];
  job: MyEnquiryPractice[];
  todayIso: string;
  initialTab: PracticeTab;
  initialChip: PracticeChip;
  /** the address the tab and chip are written to — a studio's desk is its own */
  basePath?: string;
  /** a studio's desk has job practices only, so no Crew · Job chips */
  showChips?: boolean;
}) {
  const [tab, setTab] = useState<PracticeTab>(initialTab);
  const [pick, setPick] = useState<PracticeChip>(initialChip);
  const now = new Date(todayIso).getTime();
  const todayKey = practiceDayKey(todayIso);
  const weekEnd = now + 7 * 24 * 3600_000;

  const placeOf = (startsAt: string, endsAt: string, cancelled: boolean): { tab: PracticeTab; group: Group } => {
    if (cancelled || new Date(endsAt).getTime() < now) return { tab: "past", group: "past" };
    if (practiceDayKey(startsAt) <= todayKey) return { tab: "upcoming", group: "today" };
    return { tab: "upcoming", group: new Date(startsAt).getTime() < weekEnd ? "week" : "later" };
  };

  const items: Item[] = [
    ...crew.map((p) => ({ key: `c-${p.id}`, kind: "crew" as const, startsAt: p.startsAt, ...placeOf(p.startsAt, p.endsAt, p.status === "cancelled"), node: <PracticeCard practice={p} now={now} /> })),
    ...job.map((p) => ({ key: `j-${p.id}`, kind: "job" as const, startsAt: p.startsAt, ...placeOf(p.startsAt, p.endsAt, p.status === "cancelled"), node: <EnquiryPracticeCard practice={p} now={now} hrefBase={`${basePath}/job`} /> })),
  ];

  const write = (t: PracticeTab, c: PracticeChip) => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams();
    q.set("tab", t);
    if (c !== "all") q.set("kind", c);
    window.history.replaceState(window.history.state, "", `${basePath}?${q.toString()}`);
  };

  const inTab = (t: PracticeTab) => items.filter((i) => i.tab === t);
  const takes = (i: Item, c: PracticeChip) => c === "all" || i.kind === c;
  const shown = inTab(tab)
    .filter((i) => takes(i, pick))
    .sort((a, b) => (tab === "past" ? b.startsAt.localeCompare(a.startsAt) : a.startsAt.localeCompare(b.startsAt)));

  const tabs = (
    <div role="tablist" aria-label="Practice" style={{ ...columnTrack(), marginTop: 12 }}>
      {(["upcoming", "past"] as PracticeTab[]).map((t) => {
        const on = tab === t;
        return (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={on}
            data-testid={`practice-tab-${t}`}
            onClick={() => {
              setTab(t);
              write(t, pick);
            }}
            style={columnTab(on)}
          >
            {TAB_WORD[t]}
            <ColumnCount n={inTab(t).length} on={on} />
          </button>
        );
      })}
    </div>
  );

  const chips = (
    <div role="group" aria-label="Show" data-testid="practice-chips" style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 2, marginTop: 10 }}>
      {(["all", "crew", "job"] as PracticeChip[]).map((c) => {
        const n = inTab(tab).filter((i) => takes(i, c)).length;
        return (
          <button
            key={c}
            type="button"
            aria-pressed={pick === c}
            data-testid={`practice-chip-${c}`}
            onClick={() => {
              setPick(c);
              write(tab, c);
            }}
            style={chip(pick === c, n === 0)}
          >
            {CHIP_WORD[c]} · {n}
          </button>
        );
      })}
    </div>
  );

  const groups = (tab === "past" ? (["past"] as Group[]) : (["today", "week", "later"] as Group[])).map((g) => ({ g, rows: shown.filter((i) => i.group === g) })).filter((x) => x.rows.length > 0);

  return (
    <>
      <DeskTop style={{ margin: 0, marginBottom: 12 }}>
        {top}
        {tabs}
        {showChips ? chips : null}
      </DeskTop>
      <DeskBody>
        <div data-testid="my-practices" data-tab={tab} data-kind={pick}>
          {groups.length === 0 ? (
            <div data-testid="practice-empty" style={{ textAlign: "center", padding: "30px 18px", color: SUB, border: "1.5px dashed var(--el)", borderRadius: 20, fontSize: 13, marginTop: 4 }}>
              {tab === "past" ? "Nothing yet." : "Nothing coming up."}
            </div>
          ) : null}
          {groups.map(({ g, rows }) => (
            <section key={g} data-testid={`practice-group-${g}`}>
              {tab === "upcoming" ? (
                <h2 style={PRACTICE_HEAD}>
                  {GROUP_WORD[g]} · {rows.length}
                </h2>
              ) : null}
              {rows.map((i) => (
                <div key={i.key}>{i.node}</div>
              ))}
            </section>
          ))}
        </div>
      </DeskBody>
    </>
  );
}
