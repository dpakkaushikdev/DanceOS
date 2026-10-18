"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PosterBlock } from "@/features/classes/components/poster";
import { dosKey } from "@/features/classes/components/ShareSheet";
import {
  enrollAction,
  type EnrollActionState,
} from "@/features/classBookings/server-actions/classBookings";
import {
  confirmCheckoutAction,
  startCheckoutAction,
} from "@/features/payments/server-actions/payments";
import { openCashfreeCheckout, preloadCheckout, type CashfreeCheckoutResult } from "@/lib/cashfree/checkout-client";
import { DOS_DISPLAY, DOS_UI, SKY } from "@/lib/design/tokens";
import { UseMembership } from "@/features/memberships/components/UseMembership";
import type { PassForSession } from "@/repositories/memberships";
import { PayOption, PAY_LABEL } from "@/features/payments/components/PayOption";

/** HOW YOU ARE PAYING — the two-step booking flow lifted from prototype S_class
 *  (DanceOSApp.jsx:12456-12573): choose how you're paying, then see exactly what
 *  is being charged and agree to it. The prototype's saved methods (DOSDB.methods)
 *  are Cashfree Checkout here — one method row until passes arrive; a free class
 *  skips straight to the confirm sheet ({how:"free"}, 12439). Sheets wear the
 *  repo's corrected role="dialog" pattern, not the prototype's aria-hidden one. */

const DOS_MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

/* the Cashfree JS SDK v3 loader lives in lib/cashfree/checkout-client, shared
   with the subscription button since 10 Sep 2026 */

const sheetBackdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.6)",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  zIndex: 610,
};

const sheetBody: React.CSSProperties = {
  background: "var(--solid)",
  borderRadius: "24px 24px 0 0",
  padding: "18px var(--dos-gutter) 30px",
  width: "100%",
  maxWidth: 430,
  boxSizing: "border-box",
  color: "var(--text)",
  fontFamily: DOS_UI,
};

const grabber = (
  <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--el)", margin: "0 auto 12px" }} />
);

export interface PayFlowProps {
  sessionId: string;
  isFree: boolean;
  priceInr: number;
  /** poster kit inputs — the same poster the card showed you (12464) */
  posterItem: { title: string; style: string; styleColor: string };
  posterK: string;
  /** the class's colour — Razorpay's modal wore it; Cashfree's modal wears its own theme, so the prop is kept for the call sites and unused here */
  col: string;
  /** "style · time" and "room, city" lines under the sheet titles */
  metaTop: string;
  metaBottom: string;
  businessName: string;
  classLabel: string;
  onClose: () => void;
  /** booked/refund outcome — parent fires the toast */
  onDone: (message: string) => void;
  /** the memberships this class takes from this viewer — offered as ways to pay
   *  on the same sheet (18 Oct 2026); the spend returns an error sentence or null */
  passes?: PassForSession[];
  whenText?: string;
  refundWindowHours?: number;
  onSpendPass?: (p: PassForSession) => Promise<string | null>;
}

const initialEnrollState: EnrollActionState = { error: null, outcome: null };

export function PayFlow({
  sessionId,
  isFree,
  priceInr,
  posterItem,
  posterK,
  metaTop,
  metaBottom,
  businessName,
  classLabel,
  onClose,
  onDone,
  passes = [],
  whenText = "—",
  refundWindowHours = 12,
  onSpendPass,
}: PayFlowProps) {
  // free classes skip the how-are-you-paying step (prototype 12439)
  const [step, setStep] = useState<"how" | "confirm">(isFree ? "confirm" : "how");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* the order whose window is open — kept so a window that never reports back
     (a phone that went off to a UPI app) can be checked by hand, rather than
     leaving the sheet on "One moment…" for ever (2 Oct 2026) */
  const [openOrder, setOpenOrder] = useState<string | null>(null);
  const router = useRouter();
  // the SDK starts downloading while the person reads the sheet, not after the press
  useEffect(() => {
    if (!isFree) preloadCheckout();
  }, [isFree]);
  const priceText = `₹${priceInr.toLocaleString("en-IN")}`;

  const confirmFree = async () => {
    setBusy(true);
    setError(null);
    const formData = new FormData();
    formData.set("sessionId", sessionId);
    const out = await enrollAction(initialEnrollState, formData);
    setBusy(false);
    if (out.error) {
      setError(out.error);
      return;
    }
    onDone("🎉 Booked — your place is confirmed");
    router.refresh();
  };

  /* after the modal closes the SERVER asks Cashfree what happened on our order —
     the browser's word for it is never trusted */
  const confirmPaid = async (orderId: string) => {
    setBusy(true);
    setError(null);
    const out = await confirmCheckoutAction({ orderId });
    setBusy(false);
    setOpenOrder(null);
    if (out.error || !out.outcome) {
      setError(out.error ?? "Could not confirm the payment");
      return;
    }
    onDone(
      out.outcome === "booked"
        ? "🎉 Paid — booking confirmed"
        : out.outcome === "processing"
          ? "Payment received — confirming your seat…"
          : "The class filled up — your money is on its way back"
    );
    router.refresh();
  };

  const startPaid = async () => {
    setBusy(true);
    setError(null);
    const res = await startCheckoutAction({ sessionId, businessName, description: classLabel });
    if (!res.checkout) {
      setBusy(false);
      setError(res.error ?? "Could not start the payment");
      return;
    }
    const checkout = res.checkout;
    setOpenOrder(checkout.orderId);
    let result: CashfreeCheckoutResult;
    try {
      result = await openCashfreeCheckout(checkout.paymentSessionId, checkout.mode);
    } catch (openError: unknown) {
      setBusy(false);
      setOpenOrder(null);
      setError(openError instanceof Error ? openError.message : "Could not open the payment window");
      return;
    }
    if (result.redirect) return; // the page is leaving for /pay/return, which confirms it
    if (result.error) {
      /* closed without a payment the window saw — but ASK, rather than assume:
         a UPI payment finished in another app can land after the window gave up */
      void confirmPaid(checkout.orderId);
      return;
    }
    void confirmPaid(checkout.orderId);
  };

  const header = (title: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
      <PosterBlock item={posterItem} design={posterK} size={54} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <b style={{ fontSize: 16.5, fontFamily: DOS_DISPLAY }}>{title}</b>
        <div style={{ fontSize: 11.5, color: "var(--sub)", marginTop: 2 }}>
          {metaTop}
          <br />
          {metaBottom}
        </div>
      </div>
    </div>
  );

  if (step === "how") {
    return (
      <div onClick={onClose} style={sheetBackdrop}>
        <div role="dialog" aria-modal="true" aria-label="How are you paying?" onClick={(e) => e.stopPropagation()} style={sheetBody}>
          {grabber}
          {header("How are you paying?")}
          {/* ⚠ EVERY WAY TO PAY IS ONE `PayOption`, ONE SIZE (18 Oct 2026, the
              user: "pay with membership … should come on the screen which says How
              are you paying … memberships and upi cards etc are similar in size").
              The memberships this class takes come first, then the card. */}
          {passes.length > 0 && onSpendPass ? (
            <UseMembership
              passes={passes}
              classTitle={classLabel}
              whenText={whenText}
              refundWindowHours={refundWindowHours}
              onSpend={async (p) => {
                const out = await onSpendPass(p);
                if (!out) onClose();
                return out;
              }}
            />
          ) : null}
          <div style={PAY_LABEL}>{passes.length > 0 ? "OR PAY" : "PAY"}</div>
          <PayOption
            tint={SKY}
            icon={
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
                <path d="M3 10h18M7 15h4" />
              </svg>
            }
            title="UPI · Card · Netbanking"
            sub={`${priceText} · secure checkout`}
            ariaLabel="Pay by UPI, card or netbanking"
            onPick={() => setStep("confirm")}
          />
          <div
            role="button"
            tabIndex={0}
            onKeyDown={dosKey}
            onClick={onClose}
            style={{
              textAlign: "center",
              padding: "13px",
              borderRadius: 999,
              marginTop: 6,
              background: "var(--card)",
              border: "1.5px solid var(--el)",
              fontWeight: 700,
              fontSize: 13.5,
              cursor: "pointer",
            }}
          >
            Cancel
          </div>
        </div>
      </div>
    );
  }

  // ── the confirm sheet: what is actually being charged, itemised (12512-12573) ──
  return (
    <div onClick={busy ? undefined : onClose} style={sheetBackdrop}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isFree ? "Confirm — no payment" : "Confirm payment"}
        onClick={(e) => e.stopPropagation()}
        style={sheetBody}
      >
        {grabber}
        {header(isFree ? "Confirm — no payment" : "Confirm payment")}
        <div style={{ background: "var(--card)", border: "1.5px solid var(--el)", borderRadius: 16, padding: "11px 13px", marginBottom: 12 }}>
          {[
            ["Class", isFree ? "Free" : priceText],
            ["Paying by", isFree ? "—" : "UPI · Card · Netbanking"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", fontSize: 12.5 }}>
              <span style={{ color: "var(--sub)" }}>{k}</span>
              <b style={{ textAlign: "right" }}>{v}</b>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              borderTop: "1.5px solid var(--el)",
              marginTop: 6,
              paddingTop: 8,
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: 0.8, color: "var(--muted)" }}>TOTAL</span>
            <b style={{ fontSize: 19, fontFamily: DOS_MONO }}>{isFree ? "₹0" : priceText}</b>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div
            role="button"
            tabIndex={0}
            onKeyDown={dosKey}
            onClick={() => {
              if (busy) return;
              if (isFree) onClose();
              else setStep("how");
            }}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "13px",
              borderRadius: 999,
              background: "var(--card)",
              border: "1.5px solid var(--el)",
              fontWeight: 700,
              fontSize: 13.5,
              cursor: "pointer",
              opacity: busy ? 0.5 : 1,
            }}
          >
            Back
          </div>
          <div
            role="button"
            tabIndex={0}
            onKeyDown={dosKey}
            aria-disabled={busy}
            onClick={() => {
              if (busy) return;
              if (isFree) void confirmFree();
              else void startPaid();
            }}
            style={{
              flex: 1.3,
              textAlign: "center",
              padding: "13px",
              borderRadius: 999,
              background: "var(--text)",
              color: "var(--solid)",
              fontWeight: 900,
              fontSize: 13.5,
              cursor: "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "One moment…" : isFree ? "Confirm booking" : `Pay ${priceText}`}
          </div>
        </div>
        {/* ⚠ THE WAY OUT OF A WINDOW THAT NEVER REPORTS BACK (2 Oct 2026). On a
            phone the checkout can hand off to a UPI app and never resolve, which
            left this sheet on "One moment…" with nothing to press. Asking our
            server is always safe — it reads Cashfree, never the browser. */}
        {busy && openOrder ? (
          <button
            type="button"
            onClick={() => void confirmPaid(openOrder)}
            style={{ display: "block", margin: "12px auto 0", background: "none", border: "none", color: "var(--sub)", fontSize: 11.5, fontWeight: 800, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" }}
          >
            Already paid? Check status
          </button>
        ) : null}
        {error && (
          <div style={{ fontSize: 10.5, color: "#EF4444", fontWeight: 700, marginTop: 10, textAlign: "center" }}>{error}</div>
        )}
      </div>
    </div>
  );
}
