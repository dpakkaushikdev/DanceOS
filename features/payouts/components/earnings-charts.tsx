"use client";

import Link from "next/link";
import { SUB } from "@/lib/design/tokens";
import { money } from "@/features/payouts/components/earnings-kit";
import type { MoneyItem, MoneyLine } from "@/types/earnings";

/** THE EARNINGS PAGE'S SMALL CHARTS (18 Oct 2026, the user: "more graphs and
 *  reports in this section"). Inline SVG on the theme's own tokens, no library:
 *  a donut for a breakup, a trend line across the window, bars for a ranking and
 *  one split bar. Every one is drawn from rows the page already holds, so a chart
 *  and the figures beside it cannot disagree. */

export const GREEN = "#22C55E";
export const RED = "#F87171";

/** a share of a whole, as a donut — the slices are the breakup's lines */
export function Donut({ slices, size = 104, label, testId }: { slices: Array<{ key: string; value: number; tint: string; label: string }>; size?: number; label: string; testId?: string }) {
  const total = slices.reduce((n, s) => n + Math.max(0, s.value), 0);
  const r = 38;
  const c = 2 * Math.PI * r;
  /* the offset each slice starts at — computed up front, never mutated in render */
  const starts = slices.map((_, i) => slices.slice(0, i).reduce((n, s) => n + Math.max(0, s.value), 0));
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={label} data-testid={testId} style={{ flexShrink: 0 }}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--el)" strokeWidth="13" />
      {total > 0
        ? slices.map((s, i) => {
            const len = (Math.max(0, s.value) / total) * c;
            if (len <= 0) return null;
            return (
              <circle
                key={s.key}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={s.tint}
                strokeWidth="13"
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-(starts[i] / total) * c}
                transform="rotate(-90 50 50)"
              />
            );
          })
        : null}
      <text x="50" y="47" textAnchor="middle" fontSize="9" fontWeight="800" fill="var(--muted)">
        TOTAL
      </text>
      <text x="50" y="60" textAnchor="middle" fontSize="11.5" fontWeight="900" fill="var(--text)">
        {total >= 100000 ? `₹${Math.round(total / 1000)}k` : money(total)}
      </text>
    </svg>
  );
}

/** the legend beside a donut — a share per line */
export function Legend({ slices }: { slices: Array<{ key: string; value: number; tint: string; label: string }> }) {
  const total = slices.reduce((n, s) => n + Math.max(0, s.value), 0);
  return (
    <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 5 }}>
      {slices.map((s) => (
        <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800 }}>
          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: s.tint, flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: s.value > 0 ? "var(--text)" : SUB }}>{s.label}</span>
          <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{total > 0 ? `${Math.round((s.value / total) * 100)}%` : "—"}</span>
        </div>
      ))}
    </div>
  );
}

/** two lines over the window — what came in and what went out */
export function Trend({ points, selectedIndex, label }: { points: Array<{ revenue: number; expenses: number }>; selectedIndex: number; label: string }) {
  const W = 300;
  const H = 70;
  const top = Math.max(1, ...points.map((p) => Math.max(p.revenue, p.expenses)));
  const x = (i: number) => (points.length <= 1 ? W / 2 : (i / (points.length - 1)) * (W - 8) + 4);
  const y = (n: number) => H - 6 - (n / top) * (H - 14);
  const line = (k: "revenue" | "expenses") => points.map((p, i) => `${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(" ");
  const sel = points[selectedIndex];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label={label} data-testid="earn-trend">
      <line x1="0" x2={W} y1={H - 6} y2={H - 6} stroke="var(--el)" strokeWidth="1" />
      <polyline points={line("expenses")} fill="none" stroke={RED} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <polyline points={line("revenue")} fill="none" stroke={GREEN} strokeWidth="2.4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {sel ? (
        <>
          <line x1={x(selectedIndex)} x2={x(selectedIndex)} y1="4" y2={H - 6} stroke="var(--muted)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          <circle cx={x(selectedIndex)} cy={y(sel.revenue)} r="3" fill={GREEN} />
        </>
      ) : null}
    </svg>
  );
}

/** one bar per bucket for a single series — the deep dive's own chart */
export function MiniBars({ values, selectedIndex, label }: { values: number[]; selectedIndex: number; label: string }) {
  const top = Math.max(1, ...values.map((v) => Math.abs(v)));
  const hasNeg = values.some((v) => v < 0);
  return (
    <div role="img" aria-label={label} style={{ display: "flex", alignItems: hasNeg ? "center" : "flex-end", gap: 3, height: 64 }}>
      {values.map((v, i) => {
        const h = Math.max(v !== 0 ? 3 : 0, Math.round((Math.abs(v) / top) * (hasNeg ? 30 : 60)));
        return (
          <div key={i} style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column", justifyContent: hasNeg ? "center" : "flex-end" }}>
            {hasNeg ? <div style={{ height: 30, display: "flex", alignItems: "flex-end" }}>{v > 0 ? <div style={{ width: "100%", height: h, borderRadius: "3px 3px 0 0", background: GREEN, opacity: i === selectedIndex ? 1 : 0.45 }} /> : null}</div> : null}
            {hasNeg ? (
              <div style={{ height: 30 }}>{v < 0 ? <div style={{ width: "100%", height: h, borderRadius: "0 0 3px 3px", background: RED, opacity: i === selectedIndex ? 1 : 0.45 }} /> : null}</div>
            ) : (
              <div style={{ width: "100%", height: h, borderRadius: "3px 3px 0 0", background: v < 0 ? RED : "var(--text)", opacity: i === selectedIndex ? 1 : 0.3 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** rows added up by what they are about — the biggest first */
export function topGroups(items: MoneyItem[], n = 5): Array<{ name: string; amountInr: number; count: number; href?: string }> {
  const by = new Map<string, { name: string; amountInr: number; count: number; href?: string }>();
  for (const it of items) {
    const name = it.group ?? it.label;
    const g = by.get(name);
    if (g) {
      g.amountInr += it.amountInr;
      g.count += 1;
    } else by.set(name, { name, amountInr: it.amountInr, count: 1, href: it.href });
  }
  return [...by.values()].filter((g) => g.amountInr > 0).sort((a, b) => b.amountInr - a.amountInr).slice(0, n);
}

/** a ranked list with a bar each, every row a door to its exact place */
export function RankBars({ rows, tint, testId }: { rows: Array<{ name: string; amountInr: number; count: number; href?: string }>; tint: string; testId?: string }) {
  const top = Math.max(1, ...rows.map((r) => r.amountInr));
  return (
    <div data-testid={testId} style={{ display: "grid", gap: 8 }}>
      {rows.map((r) => {
        const body = (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 11.5 }}>
              <span style={{ flex: 1, minWidth: 0, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
              <span style={{ color: "var(--muted)", fontSize: 10 }}>×{r.count}</span>
              <b>{money(r.amountInr)}</b>
              {r.href ? <span aria-hidden="true" style={{ color: SUB, fontSize: 11 }}>›</span> : null}
            </div>
            <div style={{ height: 4, borderRadius: 999, background: "var(--el)", marginTop: 4, overflow: "hidden" }}>
              <div style={{ width: `${Math.round((r.amountInr / top) * 100)}%`, height: "100%", background: tint, borderRadius: 999 }} />
            </div>
          </>
        );
        return r.href ? (
          <Link key={r.name} href={r.href} style={{ color: "var(--text)", textDecoration: "none" }}>
            {body}
          </Link>
        ) : (
          <div key={r.name}>{body}</div>
        );
      })}
    </div>
  );
}

const METHOD_WORDS: Record<string, string> = {
  upi: "UPI",
  card: "Card",
  credit_card: "Card",
  debit_card: "Card",
  netbanking: "Netbanking",
  net_banking: "Netbanking",
  wallet: "Wallet",
  cash: "Cash",
  bank_transfer: "Bank transfer",
  other: "Other",
};
const METHOD_TINTS = ["#0EA5E9", "#8B5CF6", "#F59E0B", "#22C55E", "#EC4899", "#64748B"];

export const methodWord = (m: string): string => METHOD_WORDS[m.toLowerCase()] ?? m.charAt(0).toUpperCase() + m.slice(1).replace(/_/g, " ");

/** how the money arrived — one bar split by method */
export function methodSplit(items: MoneyItem[]): Array<{ key: string; value: number; tint: string; label: string }> {
  const by = new Map<string, number>();
  for (const it of items) {
    if (!it.method || it.amountInr <= 0) continue;
    const w = methodWord(it.method);
    by.set(w, (by.get(w) ?? 0) + it.amountInr);
  }
  return [...by.entries()].sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ key: label, label, value, tint: METHOD_TINTS[i % METHOD_TINTS.length] }));
}

export function SplitBar({ parts, label }: { parts: Array<{ key: string; value: number; tint: string; label: string }>; label: string }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  return (
    <div>
      <div role="img" aria-label={label} style={{ display: "flex", height: 10, borderRadius: 999, overflow: "hidden", background: "var(--el)" }}>
        {total > 0 ? parts.map((p) => <div key={p.key} style={{ width: `${(p.value / total) * 100}%`, background: p.tint }} />) : null}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px", marginTop: 7 }}>
        {parts.map((p) => (
          <span key={p.key} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 800 }}>
            <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 2, background: p.tint }} />
            {p.label} · {money(p.value)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** "▲ 12%" against the bucket before — nothing when both are zero */
export function deltaOf(cur: number, prev: number | null): { words: string; tone: string } | null {
  if (prev === null) return null;
  if (cur === 0 && prev === 0) return null;
  if (prev === 0) return { words: "▲ new", tone: GREEN };
  const pct = Math.round(((cur - prev) / Math.abs(prev)) * 100);
  if (pct === 0) return { words: "= same", tone: SUB };
  return pct > 0 ? { words: `▲ ${pct}%`, tone: GREEN } : { words: `▼ ${Math.abs(pct)}%`, tone: RED };
}

/** every row behind a set of lines, newest first */
export const itemsOf = (lines: MoneyLine[]): MoneyItem[] => lines.flatMap((l) => l.items ?? []).sort((a, b) => b.at.localeCompare(a.at));
