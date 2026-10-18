"use client";

import { DOS_DISPLAY } from "@/lib/design/tokens";
import { DOS_TOOLS } from "@/features/businesses/components/biz-kit";
import { GLYPH } from "@/features/home/components/tool-grid";
import type { PassForSession } from "@/repositories/memberships";
import { PayOption, PAY_LABEL } from "@/features/payments/components/PayOption";

/** the Memberships tool's own colour — the tile, the desk and this option read one vocabulary */
export const MEMBERSHIP_TINT = DOS_TOOLS.memberships.c;
const MC = MEMBERSHIP_TINT;

/** PAY WITH YOUR MEMBERSHIP — OPTIONS ON "HOW ARE YOU PAYING?" (18 Oct 2026).
 *
 *  ⚠ ONE STEP, NO DIALOG (18 Oct 2026, the user: "How are you paying section
 *  should look better, membership usage prompt dialog box and confirm payment -
 *  should all be in How are you paying, lets reduce one step for payment and
 *  handle it from this page directly"). A pass is a RADIO row now; picking it
 *  draws what it will take (`PassSummary`) under the options on the same sheet,
 *  and the sheet's one button — "Use membership" — is what spends. It still
 *  never spends on the press of the row. A pass without enough left is shown,
 *  disabled. */

export const unitWord = (unit: PassForSession["unit"], n: number) =>
  unit === "hours" ? `${n} ${n === 1 ? "hour" : "hours"}` : `${n} ${n === 1 ? "class" : "classes"}`;

export function UseMembership({
  passes,
  selectedId,
  onSelect,
  busy = false,
}: {
  passes: PassForSession[];
  selectedId: string | null;
  onSelect: (p: PassForSession) => void;
  busy?: boolean;
}) {
  if (passes.length === 0) return null;
  return (
    <div data-testid="pass-strip" style={{ marginBottom: 6 }}>
      <div style={PAY_LABEL}>MEMBERSHIP</div>
      {passes.map((p) => {
        const left = Math.max(0, p.unitsTotal - p.unitsUsed);
        const leftPct = Math.min(100, (left / Math.max(1, p.unitsTotal)) * 100);
        return (
          <PayOption
            key={p.passId}
            testId="pass-row"
            tint={MC}
            icon={GLYPH.memberships}
            title={p.membershipName}
            sub={p.enough ? `${unitWord(p.unit, left)} left · this class takes ${unitWord(p.unit, p.unitsNeeded)}` : `${unitWord(p.unit, left)} left · not enough for this class`}
            ariaLabel={p.enough ? `Use ${p.membershipName}` : `${p.membershipName} — not enough left for this class`}
            disabled={!p.enough || busy}
            meter={leftPct}
            selected={p.enough ? selectedId === p.passId : false}
            onPick={() => onSelect(p)}
          />
        );
      })}
    </div>
  );
}

/** what the chosen pass will take, drawn on the sheet itself where the dialog was */
export function PassSummary({ pass, classTitle, whenText, refundWindowHours }: { pass: PassForSession; classTitle: string; whenText: string; refundWindowHours: number }) {
  const left = Math.max(0, pass.unitsTotal - pass.unitsUsed);
  const after = Math.max(0, left - pass.unitsNeeded);
  return (
    <div data-testid="pass-confirm" style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "10px", borderRadius: 12, background: `linear-gradient(160deg, ${MC}24, ${MC}0c)` }}>
        <b style={{ fontSize: 20, fontFamily: DOS_DISPLAY, color: "var(--text)" }}>{left}</b>
        <span style={{ fontSize: 13, fontWeight: 900, color: MC }}>− {pass.unitsNeeded} →</span>
        <b style={{ fontSize: 20, fontFamily: DOS_DISPLAY, color: "var(--text)" }}>{after}</b>
        <span style={{ fontSize: 11, fontWeight: 800, color: "var(--sub)" }}>{pass.unit === "hours" ? "hours" : "classes"}</span>
      </div>
      {[
        ["Class", classTitle],
        ["When", whenText],
        ["Uses", unitWord(pass.unit, pass.unitsNeeded)],
        ["Left after", `${unitWord(pass.unit, after)} of ${unitWord(pass.unit, pass.unitsTotal)}`],
      ].map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "4px 2px", fontSize: 12 }}>
          <span style={{ color: "var(--sub)" }}>{k}</span>
          <b style={{ textAlign: "right", overflowWrap: "anywhere" }}>{v}</b>
        </div>
      ))}
      <div style={{ fontSize: 10.5, color: "var(--muted)", lineHeight: 1.45, marginTop: 2 }}>
        Cancel {refundWindowHours} h before it starts and {pass.unit === "hours" ? "the hours come" : "the class comes"} back.
      </div>
    </div>
  );
}
