"use client";

import { useState } from "react";
import { toast } from "@/components/ui/Toast";
import { DOS_UI, INK } from "@/lib/design/tokens";
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
          onDownloaded={(label) => toast(`${label} statement downloaded`)}
        />
      ) : null}
    </div>
  );
}
