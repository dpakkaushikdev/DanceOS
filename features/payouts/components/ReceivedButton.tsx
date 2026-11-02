"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmPayoutReceivedAction } from "@/features/payouts/server-actions/payouts";

/** THE PERSON PAID TAPS RECEIVED (2 Nov 2026). Drawn under a payment that is
 *  in transit or on hold on the payee's own Earnings; the RPC moves it to done
 *  and tells the payer. Their door alone — the payer keeps `set_payout_status`
 *  for failed and on hold. */
export function ReceivedButton({ payoutId }: { payoutId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div style={{ margin: "4px 0 6px" }}>
      <button
        type="button"
        disabled={busy}
        data-testid="payout-received"
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          setError(null);
          const out = await confirmPayoutReceivedAction({ payoutId });
          setBusy(false);
          if (out.error) setError(out.error);
          else router.refresh();
        }}
        style={{
          fontSize: 11.5,
          fontWeight: 800,
          padding: "7px 12px",
          borderRadius: 999,
          cursor: busy ? "default" : "pointer",
          background: "var(--text)",
          color: "var(--solid)",
          border: "1.5px solid var(--text)",
          fontFamily: "inherit",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? "Marking…" : "Received"}
      </button>
      {error ? (
        <div role="alert" style={{ fontSize: 11.5, color: "#F87171", fontWeight: 700, marginTop: 6 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
