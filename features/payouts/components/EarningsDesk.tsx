"use client";

import { useState } from "react";
import { DOS_UI, INK, LINE, GREEN } from "@/lib/design/tokens";
import type { BusinessIncome } from "@/types/income";
import { MonthStatements, PeriodChips } from "./StudioIncome";

/** THE STUDIO'S MONTH STATEMENTS, under `EarningsScreen` (re-cut 18 Oct 2026).
 *
 *  ⚠ WHAT LEFT THIS DESK, AND WHERE IT WENT. What the studio owes its people,
 *  what it has settled and recording a payment are the TEAM section's now
 *  (`TeamPayLedger` on `/business/{id}/staff`) — the user: "what you owe should
 *  be handled from teams not here". The earnings screen keeps one line pointing
 *  there. HOW STUDENTS PAID went too: the screen's own HOW THEY PAID report says
 *  the same split, of the period you picked rather than of this month alone.
 *
 *  What stays is the one job nothing else does: a past month's STATEMENT, with
 *  its deductions and its CSV. */
export function EarningsDesk({ businessName, income }: { businessName: string; income: BusinessIncome }) {
  const [eview, setEview] = useState<"now" | "hist">("now");
  const [eopen, setEopen] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fire = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2200);
  };

  return (
    <div style={{ color: INK, fontFamily: DOS_UI, marginTop: 6 }} data-testid="earn-statements">
      <PeriodChips
        months={income.previous}
        view={eview}
        openKey={eopen}
        onNow={() => setEview("now")}
        onMonth={(key) => {
          setEview("hist");
          setEopen(key);
        }}
      />
      {eview === "hist" ? (
        <MonthStatements
          businessName={businessName}
          months={income.previous}
          openKey={eopen}
          onToggle={(key) => setEopen(eopen === key ? null : key)}
          onDownloaded={(label) => fire(`📄 ${label} statement downloaded`)}
        />
      ) : null}
      {toast ? (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 26,
            left: "50%",
            transform: "translateX(-50%)",
            background: LINE,
            border: `1.5px solid ${GREEN}`,
            color: INK,
            padding: "11px 18px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 700,
            maxWidth: 390,
            textAlign: "center",
            zIndex: 800,
          }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
