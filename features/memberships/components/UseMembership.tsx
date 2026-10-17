"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DOS_DISPLAY, DOS_UI } from "@/lib/design/tokens";
import { DOS_TOOLS } from "@/features/businesses/components/biz-kit";
import { GLYPH } from "@/features/home/components/tool-grid";
import type { PassForSession } from "@/repositories/memberships";

/** the Memberships tool's own colour — the tile, the desk and this card read one vocabulary */
const MC = DOS_TOOLS.memberships.c;

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
      style={{ marginBottom: 10, borderRadius: 18, border: `1.5px solid ${MC}55`, background: `linear-gradient(160deg, ${MC}22, ${MC}08 70%)`, padding: 12 }}
    >
      {/* ⚠ THE MEMBERSHIPS TOOL'S OWN MARK AND COLOUR (18 Oct 2026, the user:
          "pay with membership tile … better with membership icon logo from tools
          … similar to membership tile visible at studio profile pages") */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 11, display: "grid", placeItems: "center", background: MC, color: "#fff", flexShrink: 0, boxShadow: `0 6px 14px ${MC}55` }}>
          {GLYPH.memberships}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 900, fontFamily: DOS_DISPLAY, color: "var(--text)" }}>Pay with a membership</div>
          <div style={{ fontSize: 11, color: "var(--sub)", marginTop: 1 }}>
            {usable === 0 ? "None of yours covers this class" : usable === 1 ? "One of yours covers this class" : `${usable} of yours cover this class`}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {passes.map((p) => {
          const left = Math.max(0, p.unitsTotal - p.unitsUsed);
          const total = Math.max(1, p.unitsTotal);
          const leftPct = Math.min(100, (left / total) * 100);
          const takePct = p.enough ? Math.min(leftPct, (p.unitsNeeded / total) * 100) : 0;
          const after = Math.max(0, left - p.unitsNeeded);
          return (
            <div
              key={p.passId}
              data-testid="pass-row"
              style={{ padding: 12, borderRadius: 14, background: "var(--card)", border: "1.5px solid var(--el)", opacity: p.enough ? 1 : 0.62 }}
            >
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{p.membershipName}</span>
                <span style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0, maxWidth: "45%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.businessName}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 9 }}>
                {[
                  ["Left", unitWord(p.unit, left)],
                  ["This class", unitWord(p.unit, p.unitsNeeded)],
                  ["After", p.enough ? unitWord(p.unit, after) : "—"],
                ].map(([k, v]) => (
                  <div key={k} style={{ borderRadius: 10, background: `${MC}12`, padding: "6px 8px" }}>
                    <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 0.4, color: "var(--muted)", textTransform: "uppercase" }}>{k}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 900, color: "var(--text)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v}</div>
                  </div>
                ))}
              </div>
              {/* what is left, with this class's share of it marked */}
              <div aria-hidden="true" style={{ position: "relative", height: 6, borderRadius: 999, background: "var(--el)", marginTop: 9, overflow: "hidden" }}>
                <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${leftPct}%`, background: `${MC}66`, borderRadius: 999 }} />
                {takePct > 0 ? <span style={{ position: "absolute", left: `${leftPct - takePct}%`, top: 0, bottom: 0, width: `${takePct}%`, background: col, borderRadius: 999 }} /> : null}
              </div>
              <div style={{ fontSize: 11, color: "var(--sub)", marginTop: 5 }}>
                {unitWord(p.unit, left)} left · this class takes {unitWord(p.unit, p.unitsNeeded)}
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
                  width: "100%",
                  marginTop: 10,
                  minHeight: 40,
                  borderRadius: 999,
                  border: p.enough ? "none" : "1.5px solid var(--el)",
                  background: p.enough ? MC : "transparent",
                  color: p.enough ? "#fff" : "var(--muted)",
                  fontFamily: DOS_UI,
                  fontSize: 12.5,
                  fontWeight: 900,
                  cursor: p.enough ? "pointer" : "not-allowed",
                  boxShadow: p.enough ? `0 6px 14px ${MC}44` : "none",
                }}
              >
                {p.enough ? "Use it for this class" : "Not enough left"}
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
              {/* the spend at a glance: what you have → what this takes → what stays */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "12px 10px", borderRadius: 14, background: `linear-gradient(160deg, ${MC}24, ${MC}0c)`, marginBottom: 4 }}>
                <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 10, display: "grid", placeItems: "center", background: MC, color: "#fff" }}>
                  {GLYPH.memberships}
                </span>
                <b style={{ fontSize: 20, fontFamily: DOS_DISPLAY, color: "var(--text)" }}>{Math.max(0, asking.unitsTotal - asking.unitsUsed)}</b>
                <span style={{ fontSize: 13, fontWeight: 900, color: MC }}>− {asking.unitsNeeded} →</span>
                <b style={{ fontSize: 20, fontFamily: DOS_DISPLAY, color: "var(--text)" }}>{Math.max(0, asking.unitsTotal - asking.unitsUsed - asking.unitsNeeded)}</b>
                <span style={{ fontSize: 11, fontWeight: 800, color: "var(--sub)" }}>{asking.unit === "hours" ? "hours" : "classes"}</span>
              </div>
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
