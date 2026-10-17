"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DOS_UI } from "@/lib/design/tokens";
import type { PassForSession } from "@/repositories/memberships";

/** PAY WITH YOUR MEMBERSHIP (18 Oct 2026, the user: "use membership to be
 *  handled better with ui ux in mind and should ask before using membership for
 *  a class"). One card on the class page's booking bar: each pass this class
 *  admits as a row — what it is, a bar of what is left with THIS class's share
 *  marked on it, and one "Use" pill. Pressing it ASKS first: what the class is,
 *  when, what it takes, what will be left, and that the hours come back on a
 *  cancel inside the studio's window. Only "Use membership" spends anything —
 *  the seat and the units still go in one RPC, under the class's lock. */

const unitWord = (unit: PassForSession["unit"], n: number) =>
  unit === "hours" ? `${n} ${n === 1 ? "hour" : "hours"}` : `${n} ${n === 1 ? "class" : "classes"}`;

export function UseMembership({
  passes,
  col,
  classTitle,
  whenText,
  refundWindowHours,
  onSpend,
}: {
  passes: PassForSession[];
  col: string;
  classTitle: string;
  whenText: string;
  refundWindowHours: number;
  /** the spend — returns an error sentence to keep the question open */
  onSpend: (p: PassForSession) => Promise<string | null>;
}) {
  const [asking, setAsking] = useState<PassForSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (passes.length === 0) return null;
  const usable = passes.filter((p) => p.enough).length;

  return (
    <div
      data-testid="pass-strip"
      style={{ marginBottom: 10, borderRadius: 16, border: `1.5px solid ${col}55`, background: `linear-gradient(180deg, ${col}1c, ${col}08)`, padding: "11px 12px 12px" }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: 0.9, color: "var(--sub)" }}>PAY WITH YOUR MEMBERSHIP</span>
        <span style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)" }}>
          {usable === 0 ? "none covers this" : `${usable} can cover this`}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {passes.map((p) => {
          const left = Math.max(0, p.unitsTotal - p.unitsUsed);
          const total = Math.max(1, p.unitsTotal);
          const leftPct = Math.min(100, (left / total) * 100);
          const takePct = p.enough ? Math.min(leftPct, (p.unitsNeeded / total) * 100) : 0;
          return (
            <div
              key={p.passId}
              data-testid="pass-row"
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 11px", borderRadius: 13, background: "var(--card)", border: "1.5px solid var(--el)", opacity: p.enough ? 1 : 0.6 }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.membershipName}</div>
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.businessName}</div>
                {/* what is left, with this class's share of it marked */}
                <div aria-hidden="true" style={{ position: "relative", height: 6, borderRadius: 999, background: "var(--el)", marginTop: 7, overflow: "hidden" }}>
                  <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${leftPct}%`, background: `${col}66`, borderRadius: 999 }} />
                  {takePct > 0 ? <span style={{ position: "absolute", left: `${leftPct - takePct}%`, top: 0, bottom: 0, width: `${takePct}%`, background: col, borderRadius: 999 }} /> : null}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 4 }}>
                  {unitWord(p.unit, left)} left · this class takes {unitWord(p.unit, p.unitsNeeded)}
                </div>
              </div>
              <button
                type="button"
                disabled={!p.enough || busy}
                aria-disabled={!p.enough}
                aria-label={p.enough ? `Use ${p.membershipName}` : `${p.membershipName} — not enough left for this class`}
                onClick={() => {
                  if (!p.enough) return;
                  setErr(null);
                  setAsking(p);
                }}
                style={{
                  flexShrink: 0,
                  minHeight: 36,
                  padding: "0 14px",
                  borderRadius: 999,
                  border: p.enough ? "none" : "1.5px solid var(--el)",
                  background: p.enough ? "var(--text)" : "transparent",
                  color: p.enough ? "var(--solid)" : "var(--muted)",
                  fontFamily: DOS_UI,
                  fontSize: 11.5,
                  fontWeight: 900,
                  cursor: p.enough ? "pointer" : "not-allowed",
                  whiteSpace: "nowrap",
                }}
              >
                {p.enough ? "Use" : "Not enough left"}
              </button>
            </div>
          );
        })}
      </div>
      {asking ? (
        <ConfirmDialog
          tone="go"
          title={`Use ${asking.membershipName} for this class?`}
          keepWord="Not now"
          goWord="Use membership"
          busy={busy}
          err={err}
          body={
            <div data-testid="pass-confirm" style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
              {[
                ["Class", classTitle],
                ["When", whenText],
                ["Takes", unitWord(asking.unit, asking.unitsNeeded)],
                ["Left after", `${unitWord(asking.unit, Math.max(0, asking.unitsTotal - asking.unitsUsed - asking.unitsNeeded))} of ${unitWord(asking.unit, asking.unitsTotal)}`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 10px", borderRadius: 10, background: "var(--el)" }}>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: "var(--muted)" }}>{k}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 900, color: "var(--text)", textAlign: "right", overflowWrap: "anywhere" }}>{v}</span>
                </div>
              ))}
              <div style={{ fontSize: 10.5, color: "var(--sub)", lineHeight: 1.45, marginTop: 2 }}>
                Cancel {refundWindowHours} h or more before it starts and the {asking.unit === "hours" ? "hours come" : "class comes"} back to your membership.
              </div>
            </div>
          }
          onKeep={() => (busy ? undefined : setAsking(null))}
          onGo={async () => {
            if (busy) return;
            setBusy(true);
            setErr(null);
            const out = await onSpend(asking);
            setBusy(false);
            if (out) return setErr(out);
            setAsking(null);
          }}
        />
      ) : null}
    </div>
  );
}
