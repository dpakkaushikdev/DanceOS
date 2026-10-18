"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DOS_DISPLAY } from "@/lib/design/tokens";
import { DOS_TOOLS } from "@/features/businesses/components/biz-kit";
import { GLYPH } from "@/features/home/components/tool-grid";
import type { PassForSession } from "@/repositories/memberships";
import { PayOption, PAY_LABEL } from "@/features/payments/components/PayOption";

/** the Memberships tool's own colour — the tile, the desk and this option read one vocabulary */
const MC = DOS_TOOLS.memberships.c;

/** PAY WITH YOUR MEMBERSHIP — AN OPTION ON "HOW ARE YOU PAYING?" (18 Oct 2026,
 *  the user: "pay with membership on class detail should come on the screen which
 *  says How are you paying … make sure memberships and upi cards etc are similar
 *  in size … shorter text and written properly").
 *
 *  It used to be a card of its own on the booking bar, above Book Now — so a
 *  person deciding how to pay met two places to decide it. Now every way to pay
 *  is one `PayOption` in one sheet, the same size: each pass this class admits,
 *  then UPI · Card · Netbanking. Pressing a pass still ASKS first (what it takes,
 *  what stays), and only "Use membership" spends — the seat and the units in one
 *  RPC under the class's lock. A pass without enough left is shown, disabled. */

const unitWord = (unit: PassForSession["unit"], n: number) =>
  unit === "hours" ? `${n} ${n === 1 ? "hour" : "hours"}` : `${n} ${n === 1 ? "class" : "classes"}`;

export function UseMembership({
  passes,
  classTitle,
  whenText,
  refundWindowHours,
  onSpend,
}: {
  passes: PassForSession[];
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

  return (
    <div data-testid="pass-strip" style={{ marginBottom: 12 }}>
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
            onPick={() => {
              setErr(null);
              setAsking(p);
            }}
          />
        );
      })}
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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "12px 10px", borderRadius: 14, background: `linear-gradient(160deg, ${MC}24, ${MC}0c)`, marginBottom: 4 }}>
                <b style={{ fontSize: 20, fontFamily: DOS_DISPLAY, color: "var(--text)" }}>{Math.max(0, asking.unitsTotal - asking.unitsUsed)}</b>
                <span style={{ fontSize: 13, fontWeight: 900, color: MC }}>− {asking.unitsNeeded} →</span>
                <b style={{ fontSize: 20, fontFamily: DOS_DISPLAY, color: "var(--text)" }}>{Math.max(0, asking.unitsTotal - asking.unitsUsed - asking.unitsNeeded)}</b>
                <span style={{ fontSize: 11, fontWeight: 800, color: "var(--sub)" }}>{asking.unit === "hours" ? "hours" : "classes"}</span>
              </div>
              {[
                ["Class", classTitle],
                ["When", whenText],
                ["Uses", unitWord(asking.unit, asking.unitsNeeded)],
                ["Left after", `${unitWord(asking.unit, Math.max(0, asking.unitsTotal - asking.unitsUsed - asking.unitsNeeded))} of ${unitWord(asking.unit, asking.unitsTotal)}`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 10px", borderRadius: 10, background: "var(--el)" }}>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: "var(--muted)" }}>{k}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 900, color: "var(--text)", textAlign: "right", overflowWrap: "anywhere" }}>{v}</span>
                </div>
              ))}
              <div style={{ fontSize: 10.5, color: "var(--sub)", lineHeight: 1.45, marginTop: 2 }}>
                Cancel {refundWindowHours} h before it starts and {asking.unit === "hours" ? "the hours come" : "the class comes"} back.
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
