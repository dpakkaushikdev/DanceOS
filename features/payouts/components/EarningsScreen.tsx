"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties, type ReactNode } from "react";
import { columnTab, columnTrack } from "@/components/ui/ColumnTabs";
import { FigureHead } from "@/components/ui/FigureHead";
import { DeskBody, DeskMiddle, DeskTop } from "@/components/ui/DeskSections";
import { Portal } from "@/components/ui/Portal";
import { DOS_TOOLS, DeskHero, SHEET_ANIMATION } from "@/features/businesses/components/biz-kit";
import { EarningsChart } from "@/features/payouts/components/EarningsChart";
import { money } from "@/features/payouts/components/earnings-kit";
import {
  Donut,
  GREEN,
  Legend,
  MiniBars,
  RED,
  RankBars,
  SplitBar,
  Trend,
  deltaOf,
  itemsOf,
  methodSplit,
  topGroups,
} from "@/features/payouts/components/earnings-charts";
import { rangeLabel, rangeQuery, shiftRange } from "@/features/payouts/earningsRange";
import { useCloseOnBack } from "@/lib/hooks/useCloseOnBack";
import { DOS_UI, INK, LILAC, SUB } from "@/lib/design/tokens";
import { PERIODS, addDays, bucketLabelOf, dayKeyOf } from "@/lib/format/month";
import { EARNING_TINT, sumLines, type EarningsReport, type MoneyItem, type MoneyLine } from "@/types/earnings";

/** EARNINGS — ONE SCREEN FOR EVERY KIND OF PROFILE (21 Sep 2026), RE-CUT
 *  18 Oct 2026 (the user: "earnings can be better for all profiles shorter and
 *  crisp wordings . better collapseible tiles with data taking to exact place .
 *  should open a prompt box to deep dive further into earnings for each section .
 *  better date filter with custom controls . more graphs and reports").
 *
 *  The order is still the sentence — the period, its shape, what came IN, what
 *  went OUT, what is LEFT — and now:
 *  • the period is Day · Week · Month · Year OR a custom range (`?from=&to=`),
 *    with ‹ › to step either;
 *  • three figure tiles say how this bucket compares with the one before;
 *  • REVENUE and EXPENSES are collapsible sections, every line opens onto its
 *    rows, and every row is a link to the exact place it came from;
 *  • each section has a DETAILS sheet — its shape over the window, its biggest
 *    subjects, every row;
 *  • REPORTS — the trend, where the money came from, where it went, the top
 *    earners and how people paid.
 *
 *  ⚠ What is NOT yet settled with a team or a studio is not here at all (18 Oct
 *  2026) — it is the Team section's, where the amount is set. Paid team pay and
 *  rent are ordinary lines. And this screen is DATA: a row is a door only inside
 *  the Details sheet. */

const card: CSSProperties = { background: "var(--card)", border: "1.5px solid var(--el)", borderRadius: 16, padding: "13px 14px", marginBottom: 10 };
const eyebrow: CSSProperties = { fontSize: 9.5, fontWeight: 900, letterSpacing: 0.9, color: "var(--muted)" };
const chipBtn: CSSProperties = {
  border: "1.5px solid var(--el)",
  background: "var(--card)",
  color: INK,
  borderRadius: 999,
  padding: "6px 11px",
  fontSize: 11,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily: DOS_UI,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
};


/** "2 Oct" in IST */
const dayWords = (iso: string): string => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

/** lines merged across buckets — a custom range's figures describe all of it */
function mergeLines(sets: MoneyLine[][]): MoneyLine[] {
  const out = new Map<string, MoneyLine>();
  for (const set of sets) {
    for (const l of set) {
      const have = out.get(l.key);
      if (have) {
        have.amountInr += l.amountInr;
        have.items = [...(have.items ?? []), ...(l.items ?? [])];
      } else out.set(l.key, { ...l, items: [...(l.items ?? [])] });
    }
  }
  return [...out.values()].map((l) => ({ ...l, items: (l.items ?? []).sort((a, b) => b.at.localeCompare(a.at)) }));
}

export function EarningsScreen({
  report,
  title,
  sub,
  basePath,
  noExpenses = false,
  children,
}: {
  report: EarningsReport;
  title: string;
  sub?: string;
  /** ⚠ THIS PAGE'S OWN ADDRESS, as a STRING — a server page cannot hand a
   *  client component a function (21 Sep 2026, React #441) */
  basePath: string;
  /** a person employs nobody, so "what is left" IS what came in */
  noExpenses?: boolean;
  children?: ReactNode;
}) {
  const router = useRouter();
  const range = report.range ?? null;
  const buckets = report.buckets;
  const lastIdx = buckets.length - 1;

  /* ⚠ THE PICKED BUCKET IS A PREFERENCE, NOT STATE (21 Sep 2026): honoured only
     while this window actually has it. In a custom range nothing picked means the
     WHOLE range; in a period it means the current bucket. */
  const [picked, setPicked] = useState<string | null>(null);
  const pickedOk = picked && report.lines[picked] ? picked : null;
  const selected = pickedOk ?? (range ? null : (buckets[lastIdx]?.key ?? null));
  const selIdx = selected ? buckets.findIndex((b) => b.key === selected) : -1;

  const [showRevenue, setShowRevenue] = useState(true);
  const [showExpenses, setShowExpenses] = useState(!noExpenses);
  const [openRev, setOpenRev] = useState(true);
  const [openExp, setOpenExp] = useState(true);
  const [dive, setDive] = useState<null | "revenue" | "expenses" | "left">(null);
  const [customOpen, setCustomOpen] = useState(false);

  const here = selected
    ? (report.lines[selected] ?? { revenue: [], expenses: [] })
    : {
        revenue: mergeLines(buckets.map((b) => report.lines[b.key]?.revenue ?? [])),
        expenses: mergeLines(buckets.map((b) => report.lines[b.key]?.expenses ?? [])),
      };
  const revenue = sumLines(here.revenue);
  const expenses = sumLines(here.expenses);
  const left = revenue - expenses;

  /* the bucket before, for the ▲▼ on the tiles — a period only */
  const prev = selIdx > 0 ? buckets[selIdx - 1] : null;
  const prevRev = prev ? prev.revenueInr : null;
  const prevExp = prev ? prev.expensesInr : null;
  const prevLeft = prev ? prev.revenueInr - prev.expensesInr : null;

  const windowWords = selected ? bucketLabelOf(selected, report.period) : range ? rangeLabel(range) : "";

  /* ‹ › — a period steps its buckets in place; a range moves by its own length */
  const stepBucket = (dir: -1 | 1) => {
    const base = selIdx >= 0 ? selIdx : dir < 0 ? buckets.length : -1;
    const next = Math.min(lastIdx, Math.max(0, base + dir));
    if (buckets[next]) setPicked(buckets[next].key);
  };

  const revItems = itemsOf(here.revenue);
  const slicesOf = (lines: MoneyLine[], tone: string) =>
    lines.map((l) => ({ key: l.key, label: l.label, value: l.amountInr, tint: EARNING_TINT[l.key] ?? tone }));
  const methods = methodSplit(revItems);
  const tops = topGroups(revItems, 5);

  return (
    <div style={{ background: LILAC, color: INK, maxWidth: 430, margin: "0 auto", fontFamily: DOS_UI, minHeight: "100vh", padding: "8px var(--dos-gutter) 40px", boxSizing: "border-box" }}>
      <DeskTop>
        {title === DOS_TOOLS.earn.name ? (
          <DeskHero tool="earn" as="h1" margin="0" />
        ) : (
          <h1 style={{ fontSize: 21, fontWeight: 900, letterSpacing: -0.4, margin: 0 }}>{title}</h1>
        )}
        {sub && title !== DOS_TOOLS.earn.name ? <div style={{ fontSize: 11.5, color: SUB, fontWeight: 800, marginTop: 6 }}>{sub}</div> : null}

        {/* DAY · WEEK · MONTH · YEAR · CUSTOM — every one is in the URL */}
        <div role="group" aria-label="Period" style={{ ...columnTrack(), marginTop: 12 }}>
          {PERIODS.map(([p, label]) => {
            const on = !range && report.period === p;
            return (
              <Link key={p} href={`${basePath}?period=${p}`} replace scroll={false} aria-current={on ? "true" : undefined} style={columnTab(on)}>
                {label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            aria-current={range ? "true" : undefined}
            aria-haspopup="dialog"
            data-testid="earn-custom"
            style={{ ...columnTab(Boolean(range)), border: 0, cursor: "pointer", fontFamily: DOS_UI }}
          >
            Custom
          </button>
        </div>

        {/* ‹ the window you are looking at › */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
          {range ? (
            <Link href={`${basePath}?${rangeQuery(shiftRange(range, -1))}`} replace scroll={false} aria-label="Earlier" style={{ ...chipBtn, padding: "6px 10px" }}>
              ‹
            </Link>
          ) : (
            <button type="button" onClick={() => stepBucket(-1)} disabled={selIdx <= 0} aria-label="Earlier" style={{ ...chipBtn, padding: "6px 10px", opacity: selIdx <= 0 ? 0.4 : 1 }}>
              ‹
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
            <div style={{ ...eyebrow, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} data-testid="earn-bucket">
              {windowWords.toUpperCase()}
            </div>
            {range && selected ? (
              <button type="button" onClick={() => setPicked(null)} style={{ background: "none", border: 0, padding: 0, marginTop: 2, fontSize: 10.5, fontWeight: 800, color: SUB, cursor: "pointer", fontFamily: DOS_UI }}>
                Whole range ›
              </button>
            ) : null}
          </div>
          {range ? (
            <Link href={`${basePath}?${rangeQuery(shiftRange(range, 1))}`} replace scroll={false} aria-label="Later" style={{ ...chipBtn, padding: "6px 10px" }}>
              ›
            </Link>
          ) : (
            <button type="button" onClick={() => stepBucket(1)} disabled={selIdx >= lastIdx} aria-label="Later" style={{ ...chipBtn, padding: "6px 10px", opacity: selIdx >= lastIdx ? 0.4 : 1 }}>
              ›
            </button>
          )}
        </div>
      </DeskTop>

      <DeskMiddle>
        <EarningsChart
          buckets={buckets.map((b) => ({ key: b.key, revenue: b.revenueInr, expenses: b.expensesInr }))}
          period={report.period}
          selected={selected ?? ""}
          onSelect={setPicked}
          showRevenue={showRevenue}
          showExpenses={showExpenses}
          onToggle={(which) => (which === "revenue" ? setShowRevenue((v) => !v) : setShowExpenses((v) => !v))}
        />

        {/* three figures, each against the bucket before */}
        <div style={{ display: "grid", gridTemplateColumns: noExpenses ? "1fr 1fr" : "1fr 1fr 1fr", gap: 7, margin: "10px 0" }}>
          <Kpi label="IN" value={revenue} tone={GREEN} delta={range ? null : deltaOf(revenue, prevRev)} onOpen={() => setDive("revenue")} testId="earn-kpi-in" />
          {noExpenses ? null : <Kpi label="OUT" value={expenses} tone={RED} delta={range ? null : deltaOf(expenses, prevExp)} invert onOpen={() => setDive("expenses")} testId="earn-kpi-out" />}
          <Kpi label="LEFT" value={left} tone={left < 0 ? RED : GREEN} delta={range ? null : deltaOf(left, prevLeft)} onOpen={() => setDive("left")} testId="earn-kpi-left" />
        </div>

        {/* WHAT IS LEFT — revenue minus expenses, nothing else is deducted */}
        <div style={{ ...card, marginBottom: 0, background: left < 0 ? "rgba(248,113,113,.10)" : "rgba(34,197,94,.10)", border: `1.5px solid ${left < 0 ? RED : GREEN}55` }}>
          <FigureHead
            title={<span style={{ fontSize: 11, fontWeight: 900, letterSpacing: 0.7, color: "var(--muted)" }}>WHAT IS LEFT</span>}
            figure={
              <b style={{ fontSize: 22, fontWeight: 900, color: left < 0 ? RED : GREEN }} data-testid="earn-left">
                {money(left)}
              </b>
            }
          />
        </div>

        {/* ⚠ NO "OWED" OR "STUDIO NEEDS TO PAY" LINES (18 Oct 2026, the user:
            "remove both of them from earnings"): a team payment and rent are in
            the lines below once they are PAID; what is not settled yet is the Team
            section's, where the amount is set */}
      </DeskMiddle>

      <DeskBody>
        <Section
          title="REVENUE"
          lines={here.revenue}
          total={revenue}
          tone={GREEN}
          empty="Nothing came in."
          open={openRev}
          onToggle={() => setOpenRev((o) => !o)}
          onDive={() => setDive("revenue")}
        />
        {noExpenses ? null : (
          <Section
            title="EXPENSES"
            lines={here.expenses}
            total={expenses}
            tone={RED}
            empty="Nothing went out."
            open={openExp}
            onToggle={() => setOpenExp((o) => !o)}
            onDive={() => setDive("expenses")}
          />
        )}

        {/* REPORTS — every chart is drawn from the rows above */}
        <div style={{ ...eyebrow, margin: "16px 2px 8px" }}>REPORTS</div>
        <div style={card} data-testid="earn-report-trend">
          <div style={{ ...eyebrow, marginBottom: 6 }}>TREND</div>
          <Trend
            points={buckets.map((b) => ({ revenue: b.revenueInr, expenses: noExpenses ? 0 : b.expensesInr }))}
            selectedIndex={selIdx}
            label="Money in and out over this window"
          />
          <div style={{ display: "flex", gap: 12, fontSize: 10.5, fontWeight: 800, color: SUB, marginTop: 5 }}>
            <span>
              <span style={{ color: GREEN }}>●</span> In {money(buckets.reduce((n, b) => n + b.revenueInr, 0))}
            </span>
            {noExpenses ? null : (
              <span>
                <span style={{ color: RED }}>●</span> Out {money(buckets.reduce((n, b) => n + b.expensesInr, 0))}
              </span>
            )}
            <span style={{ marginLeft: "auto" }}>{buckets.length} {report.period}s</span>
          </div>
        </div>

        <div style={card} data-testid="earn-report-sources">
          <div style={{ ...eyebrow, marginBottom: 8 }}>SOURCES</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Donut slices={slicesOf(here.revenue, GREEN)} label="Revenue by source" />
            <Legend slices={slicesOf(here.revenue, GREEN)} />
          </div>
        </div>

        {noExpenses ? null : (
          <div style={card} data-testid="earn-report-spend">
            <div style={{ ...eyebrow, marginBottom: 8 }}>SPEND</div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Donut slices={slicesOf(here.expenses, RED)} label="Expenses by kind" />
              <Legend slices={slicesOf(here.expenses, RED)} />
            </div>
          </div>
        )}

        {tops.length ? (
          <div style={card} data-testid="earn-report-top">
            <div style={{ ...eyebrow, marginBottom: 8 }}>TOP EARNERS</div>
            <RankBars rows={tops} tint={GREEN} />
          </div>
        ) : null}

        {methods.length ? (
          <div style={card} data-testid="earn-report-methods">
            <div style={{ ...eyebrow, marginBottom: 8 }}>HOW THEY PAID</div>
            <SplitBar parts={methods} label="Payments by method" />
          </div>
        ) : null}

        {report.complete ? null : (
          <div role="status" style={{ ...card, fontSize: 11, color: "#F59E0B", lineHeight: 1.5 }}>
            Counting the latest 4,000 rows only — older money is not in these totals.
          </div>
        )}

        {children}
      </DeskBody>

      {dive ? (
        <DiveSheet
          which={dive}
          report={report}
          selected={selected}
          windowWords={windowWords}
          revenueLines={here.revenue}
          expenseLines={here.expenses}
          noExpenses={noExpenses}
          onClose={() => setDive(null)}
        />
      ) : null}

      {customOpen ? (
        <CustomSheet
          range={range}
          onClose={() => setCustomOpen(false)}
          onApply={(from, to) => {
            setCustomOpen(false);
            setPicked(null);
            router.replace(`${basePath}?from=${from}&to=${to}`, { scroll: false });
          }}
        />
      ) : null}
    </div>
  );
}

function Kpi({ label, value, tone, delta, invert = false, onOpen, testId }: { label: string; value: number; tone: string; delta: { words: string; tone: string } | null; invert?: boolean; onOpen: () => void; testId: string }) {
  /* for money OUT, up is not good news — the arrow keeps its direction, the colour flips */
  const dTone = delta && invert ? (delta.tone === GREEN ? RED : delta.tone === RED ? GREEN : delta.tone) : delta?.tone;
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid={testId}
      aria-label={`${label} ${money(value)} — details`}
      style={{ ...card, marginBottom: 0, padding: "9px 10px", textAlign: "left", cursor: "pointer", fontFamily: DOS_UI, color: INK, minWidth: 0 }}
    >
      <div style={eyebrow}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 900, color: tone, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{money(value)}</div>
      <div style={{ fontSize: 9.5, fontWeight: 900, color: dTone ?? "var(--muted)", marginTop: 2 }}>{delta ? `${delta.words} vs before` : " "}</div>
    </button>
  );
}

/** A COLLAPSIBLE SECTION — the head folds the lines away; Details opens the sheet */
function Section({
  title,
  lines,
  total,
  tone,
  empty,
  open,
  onToggle,
  onDive,
}: {
  title: string;
  lines: MoneyLine[];
  total: number;
  tone: string;
  empty: string;
  open: boolean;
  onToggle: () => void;
  onDive: () => void;
}) {
  const max = Math.max(1, ...lines.map((l) => l.amountInr));
  const word = title.charAt(0) + title.slice(1).toLowerCase();
  return (
    <div style={card} data-testid={`earn-section-${title.toLowerCase()}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: open && lines.length ? 10 : 0 }}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={`${open ? "Fold" : "Unfold"} the ${word.toLowerCase()} lines`}
          style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, background: "none", border: 0, padding: 0, cursor: "pointer", fontFamily: DOS_UI, color: INK, textAlign: "left" }}
        >
          <span aria-hidden="true" style={{ fontSize: 11, color: SUB, transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }}>
            ›
          </span>
          <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: 0.7, color: "var(--muted)" }}>{title}</span>
          <span aria-hidden="true" style={{ flex: 1, height: 1.5, background: "var(--el)", borderRadius: 1 }} />
          <b style={{ fontSize: 17, fontWeight: 900, color: tone }} data-testid={`earn-${title.toLowerCase()}`}>
            {money(total)}
          </b>
        </button>
        <button type="button" onClick={onDive} aria-label={`Details of ${word.toLowerCase()}`} data-testid={`earn-dive-${title.toLowerCase()}`} style={chipBtn}>
          Details
        </button>
      </div>
      {open ? lines.map((l) => <BreakupLine key={l.key} line={l} max={max} tone={tone} />) : null}
      {open && lines.length === 0 ? <div style={{ fontSize: 11.5, color: SUB, marginTop: 6 }}>{empty}</div> : null}
    </div>
  );
}

/** ONE LINE AND THE ROWS BEHIND IT — every row a door to its exact place */
function BreakupLine({ line: l, max, tone }: { line: MoneyLine; max: number; tone: string }) {
  const [open, setOpen] = useState(false);
  const items = l.items ?? [];
  const tint = EARNING_TINT[l.key] ?? tone;
  return (
    <div style={{ marginBottom: 10 }} data-testid="earn-line">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`${l.label} — ${money(l.amountInr)}${items.length ? `, ${items.length} ${items.length === 1 ? "entry" : "entries"}` : ""}`}
        style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: 0, padding: 0, color: INK, cursor: "pointer", font: "inherit" }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: l.amountInr === 0 ? SUB : INK }}>
            {l.label}
            <span style={{ color: "var(--muted)", fontWeight: 700 }}> · {items.length}</span>
          </span>
          <b style={{ flexShrink: 0, fontSize: 12.5, color: l.amountInr === 0 ? SUB : INK }}>{money(l.amountInr)}</b>
          <span aria-hidden style={{ flexShrink: 0, fontSize: 11, color: SUB, transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }}>
            ›
          </span>
        </div>
        <div style={{ height: 5, borderRadius: 999, background: "var(--el)", overflow: "hidden", marginTop: 5 }}>
          <div style={{ width: `${Math.round((l.amountInr / max) * 100)}%`, height: "100%", borderRadius: 999, background: tint }} />
        </div>
      </button>
      {l.note ? <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 4 }}>{l.note}</div> : null}
      {open ? (
        <div data-testid="earn-items" style={{ marginTop: 7, paddingLeft: 9, borderLeft: `2px solid ${tint}` }}>
          {/* ⚠ DATA ONLY HERE (18 Oct 2026, the user: "earnings should just show
              data and not redirect to other pages from outside only when going
              deep in a specific earnings or expenses tab") — the rows are doors in
              the Details sheet and nowhere else on this screen */}
          {items.length === 0 ? <div style={{ fontSize: 11, color: SUB, padding: "3px 0" }}>Nothing in this period.</div> : items.map((it, i) => <ItemRow key={`${it.at}-${i}`} item={it} linked={false} />)}
        </div>
      ) : null}
    </div>
  );
}

function ItemRow({ item: raw, testId, linked = true }: { item: MoneyItem; testId?: string; linked?: boolean }) {
  const it = linked ? raw : { ...raw, href: undefined };
  const body = (
    <>
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
      <span style={{ flexShrink: 0, fontSize: 10, color: "var(--muted)" }}>{dayWords(it.at)}</span>
      <b style={{ flexShrink: 0, minWidth: 54, textAlign: "right" }}>{money(it.amountInr)}</b>
      {it.href ? (
        <span aria-hidden="true" style={{ color: SUB, fontSize: 11 }}>
          ›
        </span>
      ) : null}
    </>
  );
  const row: CSSProperties = { display: "flex", alignItems: "baseline", gap: 8, padding: "4px 0", fontSize: 11.5, color: INK, textDecoration: "none" };
  return it.href ? (
    <Link href={it.href} style={row} data-testid={testId}>
      {body}
    </Link>
  ) : (
    <div style={row} data-testid={testId}>
      {body}
    </div>
  );
}

/** THE DEEP DIVE — one section's shape over the window, its biggest subjects, every row */
function DiveSheet({
  which,
  report,
  selected,
  windowWords,
  revenueLines,
  expenseLines,
  noExpenses,
  onClose,
}: {
  which: "revenue" | "expenses" | "left";
  report: EarningsReport;
  selected: string | null;
  windowWords: string;
  revenueLines: MoneyLine[];
  expenseLines: MoneyLine[];
  noExpenses: boolean;
  onClose: () => void;
}) {
  useCloseOnBack(onClose, true);
  const [all, setAll] = useState(false);
  const buckets = report.buckets;
  const selIdx = selected ? buckets.findIndex((b) => b.key === selected) : -1;
  const values = buckets.map((b) => (which === "revenue" ? b.revenueInr : which === "expenses" ? b.expensesInr : b.revenueInr - (noExpenses ? 0 : b.expensesInr)));
  const lines = which === "revenue" ? revenueLines : which === "expenses" ? expenseLines : [...revenueLines, ...expenseLines];
  const items = which === "left" ? [] : itemsOf(lines);
  const total = which === "left" ? sumLines(revenueLines) - sumLines(expenseLines) : sumLines(lines);
  const tone = which === "expenses" ? RED : total < 0 ? RED : GREEN;
  const best = values.length ? Math.max(...values) : 0;
  const bestIdx = values.indexOf(best);
  const avg = values.length ? Math.round(values.reduce((n, v) => n + v, 0) / values.length) : 0;
  const tops = topGroups(items, 6);
  const shown = all ? items : items.slice(0, 30);
  const title = which === "revenue" ? "Revenue" : which === "expenses" ? "Expenses" : "What is left";

  return (
    <Portal>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 960, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} in detail`}
          data-testid="earn-dive"
          onClick={(e) => e.stopPropagation()}
          style={{ width: "100%", maxWidth: 430, maxHeight: "90vh", overflowY: "auto", background: "var(--solid)", color: INK, borderRadius: "24px 24px 0 0", padding: "10px var(--dos-gutter) 28px", boxSizing: "border-box", animation: SHEET_ANIMATION, fontFamily: DOS_UI }}
        >
          <div aria-hidden="true" style={{ width: 40, height: 4, borderRadius: 999, background: "var(--el)", margin: "0 auto 12px" }} />
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 900, flex: 1 }}>{title}</h2>
            <button type="button" onClick={onClose} style={chipBtn}>
              Done
            </button>
          </div>
          <div style={{ ...eyebrow, marginTop: 4 }}>{windowWords.toUpperCase()}</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: tone, margin: "6px 0 12px" }} data-testid="earn-dive-total">
            {money(total)}
          </div>

          <div style={card}>
            <div style={{ ...eyebrow, marginBottom: 8 }}>OVER THE WINDOW</div>
            <MiniBars values={values} selectedIndex={selIdx} label={`${title} by ${report.period}`} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 10, fontSize: 10.5 }}>
              <Stat label="TOTAL" value={money(values.reduce((n, v) => n + v, 0))} />
              <Stat label={`AVG / ${report.period.toUpperCase()}`} value={money(avg)} />
              <Stat label="BEST" value={best > 0 && buckets[bestIdx] ? bucketLabelOf(buckets[bestIdx].key, report.period) : "—"} />
            </div>
          </div>

          {which === "left" ? (
            <div style={card}>
              <div style={{ ...eyebrow, marginBottom: 8 }}>THE SUM</div>
              <Row label="Revenue" value={money(sumLines(revenueLines))} tone={GREEN} />
              {noExpenses ? null : <Row label="Expenses" value={`− ${money(sumLines(expenseLines))}`} tone={RED} />}
              <Row label="What is left" value={money(total)} tone={tone} bold />
            </div>
          ) : (
            <>
              <div style={card}>
                <div style={{ ...eyebrow, marginBottom: 8 }}>BY LINE</div>
                {lines.map((l) => (
                  <div key={l.key} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "3px 0", fontSize: 12 }}>
                    <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: EARNING_TINT[l.key] ?? tone, flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, fontWeight: 800 }}>{l.label}</span>
                    <span style={{ color: "var(--muted)", fontSize: 10.5 }}>{total > 0 ? `${Math.round((l.amountInr / total) * 100)}%` : "—"}</span>
                    <b>{money(l.amountInr)}</b>
                    {l.href ? (
                      <Link href={l.href} aria-label={`Open ${l.label}`} style={{ color: SUB, textDecoration: "none" }}>
                        ›
                      </Link>
                    ) : null}
                  </div>
                ))}
              </div>
              {tops.length ? (
                <div style={card}>
                  <div style={{ ...eyebrow, marginBottom: 8 }}>BIGGEST</div>
                  <RankBars rows={tops} tint={tone} />
                </div>
              ) : null}
              <div style={card}>
                <div style={{ ...eyebrow, marginBottom: 6 }}>EVERY ENTRY · {items.length}</div>
                {items.length === 0 ? <div style={{ fontSize: 11.5, color: SUB }}>Nothing in this period.</div> : shown.map((it, i) => <ItemRow key={`${it.at}-${i}`} item={it} testId="earn-dive-row" />)}
                {!all && items.length > shown.length ? (
                  <button type="button" onClick={() => setAll(true)} style={{ ...chipBtn, marginTop: 8 }}>
                    Show all {items.length}
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </Portal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--el)", borderRadius: 10, padding: "6px 8px", minWidth: 0 }}>
      <div style={{ ...eyebrow, fontSize: 8.5 }}>{label}</div>
      <div style={{ fontWeight: 900, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
    </div>
  );
}

function Row({ label, value, tone, bold = false }: { label: string; value: string; tone: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", padding: "4px 0", fontSize: bold ? 14 : 12.5, fontWeight: bold ? 900 : 800, borderTop: bold ? "1.5px solid var(--el)" : "none", marginTop: bold ? 4 : 0 }}>
      <span style={{ flex: 1 }}>{label}</span>
      <b style={{ color: tone }}>{value}</b>
    </div>
  );
}

/** A CUSTOM RANGE — two dates, or a preset; the dates are IST day keys */
function CustomSheet({ range, onClose, onApply }: { range: { from: string; to: string } | null; onClose: () => void; onApply: (from: string, to: string) => void }) {
  useCloseOnBack(onClose, true, { spend: false });
  const [from, setFrom] = useState(range?.from ?? "");
  const [to, setTo] = useState(range?.to ?? "");
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to);
  /* presets are worked out on the PRESS, never in render (react-hooks/purity) */
  const preset = (kind: "7" | "30" | "90" | "month" | "year") => {
    const today = dayKeyOf(new Date().toISOString());
    if (kind === "month") return onApply(`${today.slice(0, 7)}-01`, today);
    if (kind === "year") return onApply(`${today.slice(0, 4)}-01-01`, today);
    onApply(addDays(today, -(Number(kind) - 1)), today);
  };
  const input: CSSProperties = { width: "100%", boxSizing: "border-box", padding: "10px 11px", borderRadius: 12, border: "1.5px solid var(--el)", background: "var(--card)", color: INK, fontSize: 14, fontFamily: DOS_UI, textTransform: "none" };
  return (
    <Portal>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 960, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Custom dates"
          data-testid="earn-custom-sheet"
          onClick={(e) => e.stopPropagation()}
          style={{ width: "100%", maxWidth: 430, background: "var(--solid)", color: INK, borderRadius: "24px 24px 0 0", padding: "10px var(--dos-gutter) 28px", boxSizing: "border-box", animation: SHEET_ANIMATION, fontFamily: DOS_UI }}
        >
          <div aria-hidden="true" style={{ width: 40, height: 4, borderRadius: 999, background: "var(--el)", margin: "0 auto 12px" }} />
          <h2 style={{ margin: "0 0 12px", fontSize: 19, fontWeight: 900 }}>Custom dates</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {(
              [
                ["7", "Last 7 days"],
                ["30", "Last 30 days"],
                ["90", "Last 90 days"],
                ["month", "This month"],
                ["year", "This year"],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" onClick={() => preset(k)} style={chipBtn}>
                {label}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label style={{ ...eyebrow, display: "grid", gap: 5 }}>
              FROM
              <input type="date" aria-label="From" value={from} onChange={(e) => setFrom(e.target.value)} style={input} />
            </label>
            <label style={{ ...eyebrow, display: "grid", gap: 5 }}>
              TO
              <input type="date" aria-label="To" value={to} onChange={(e) => setTo(e.target.value)} style={input} />
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
