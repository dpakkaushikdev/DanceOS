"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Portal } from "@/components/ui/Portal";
import { FORM_TITLE } from "@/components/ui/formTitle";
import { SheetHandle, sheetBody, sheetWrap } from "@/features/businesses/components/biz-kit";
import { money as rupees } from "@/features/payouts/components/earnings-kit";
import { answerDisputeAction, raiseDisputeAction, withdrawDisputeAction } from "@/features/payouts/server-actions/disputes";
import { INK, MUTED, SUB } from "@/lib/design/tokens";
import { useCloseOnBack } from "@/lib/hooks/useCloseOnBack";
import type { DisputeKind, PaymentDispute } from "@/repositories/disputes";
import type { PayoutMethod } from "@/types/payout";

/** ONE ENTRY'S DISPUTE (19 Oct 2026, the user: "find proper mechanisms for
 *  dispute against these payments as well entry wise", and "should give total
 *  properly while paying or disputing").
 *
 *  Drawn beside one entry of a payment — a class, an enquiry, or a lump sum. Two
 *  sides, one control:
 *  - **the person paid** (or the studio paid rent): "Dispute" opens a sheet with
 *    what was paid, what it should have been, the DIFFERENCE as a total, and a
 *    reason; while open they may withdraw it;
 *  - **the payer**: an open dispute shows its reason and the difference, with
 *    Accept · Reject and an answer in words.
 *  Either side reads the outcome as a pill. Accepting an underpayment can record
 *  the difference as paid in the same press (19 Oct 2026). */

const RED = "#DC2626";
const AMBER = "#D97706";
const GREEN = "#16A34A";

const PILL: Record<PaymentDispute["status"], [string, string]> = {
  open: ["Disputed", AMBER],
  accepted: ["Dispute accepted", GREEN],
  rejected: ["Dispute rejected", RED],
  withdrawn: ["Dispute withdrawn", MUTED],
};

const input: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "var(--card)",
  border: "1.5px solid var(--el)",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 13,
  color: INK,
  outline: "none",
  fontFamily: "inherit",
};
const small: React.CSSProperties = { fontSize: 11, fontWeight: 800, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" };
const digits = (s: string) => s.replace(/[^0-9]/g, "").slice(0, 9);

const gapOf = (d: { amountInr: number; claimedInr: number | null }) => (d.claimedInr === null ? d.amountInr : Math.abs(d.claimedInr - d.amountInr));

export function DisputeControl({
  kind,
  targetId,
  label,
  paidInr,
  dispute,
  side,
}: {
  kind: DisputeKind;
  targetId: string;
  /** what the entry is, e.g. "Bollywood · All levels · 8 Oct" or "Lump sum" */
  label: string;
  paidInr: number;
  /** the latest dispute on this entry, if any */
  dispute: PaymentDispute | null;
  /** "paid" — the person or studio that received it; "payer" — who paid */
  side: "paid" | "payer";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const live = dispute?.status === "open" ? dispute : null;

  const act = async (run: () => Promise<{ error: string | null }>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const out = await run();
    setBusy(false);
    if (out.error) setError(out.error);
    else {
      setOpen(false);
      router.refresh();
    }
  };

  return (
    <span data-testid="dispute-control" style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {dispute ? (
        <span
          data-testid="dispute-pill"
          title={dispute.response ? `${dispute.reason} — ${dispute.response}` : dispute.reason}
          style={{ fontSize: 10, fontWeight: 900, letterSpacing: 0.4, padding: "2px 8px", borderRadius: 999, color: PILL[dispute.status][1], border: `1.5px solid ${PILL[dispute.status][1]}55`, background: `${PILL[dispute.status][1]}14` }}
        >
          {PILL[dispute.status][0]}
          {dispute.status === "open" ? ` · ${rupees(gapOf(dispute))}` : ""}
        </span>
      ) : null}
      {side === "paid" && !live ? (
        <button type="button" onClick={() => setOpen(true)} aria-label={`Dispute ${label}`} style={{ ...small, color: RED }}>
          Dispute
        </button>
      ) : null}
      {side === "paid" && live ? (
        <button type="button" disabled={busy} onClick={() => act(() => withdrawDisputeAction({ id: live.id }))} aria-label={`Withdraw the dispute on ${label}`} style={{ ...small, color: SUB }}>
          Withdraw
        </button>
      ) : null}
      {side === "payer" && live ? (
        <button type="button" onClick={() => setOpen(true)} aria-label={`Answer the dispute on ${label}`} style={{ ...small, color: AMBER }}>
          Answer
        </button>
      ) : null}
      {error && !open ? (
        <span role="alert" style={{ fontSize: 11, color: RED, fontWeight: 700 }}>
          {error}
        </span>
      ) : null}
      {open ? (
        side === "paid" ? (
          <RaiseSheet label={label} paidInr={paidInr} busy={busy} error={error} onClose={() => setOpen(false)} onRaise={(reason, claimedInr) => act(() => raiseDisputeAction({ kind, targetId, reason, claimedInr }))} />
        ) : live ? (
          <AnswerSheet label={label} d={live} busy={busy} error={error} onClose={() => setOpen(false)} onAnswer={(accept, response, settleMethod) => act(() => answerDisputeAction({ id: live.id, accept, response, settleMethod }))} />
        ) : null
      ) : null}
    </span>
  );
}

function Totals({ paidInr, claimedInr }: { paidInr: number; claimedInr: number | null }) {
  const gap = claimedInr === null ? paidInr : Math.abs(claimedInr - paidInr);
  return (
    <div data-testid="dispute-total" style={{ marginTop: 12, padding: "12px 14px", borderRadius: 14, background: `${AMBER}12`, border: `1.5px solid ${AMBER}55` }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: SUB }}>
        <span>Paid</span>
        <b style={{ color: INK }}>{rupees(paidInr)}</b>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: SUB, marginTop: 4 }}>
        <span>Should be</span>
        <b style={{ color: INK }}>{claimedInr === null ? "—" : rupees(claimedInr)}</b>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8, paddingTop: 8, borderTop: "1.5px solid var(--el)" }}>
        <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, color: SUB }}>DISPUTED</span>
        <b data-testid="dispute-total-figure" style={{ fontSize: 20, color: INK, fontVariantNumeric: "tabular-nums" }}>
          {rupees(gap)}
        </b>
      </div>
    </div>
  );
}

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useCloseOnBack(onClose, true);
  return (
    <Portal>
      <div onClick={onClose} style={sheetWrap}>
        <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} style={{ ...sheetBody, maxHeight: "90vh", overflowY: "auto" }}>
          <SheetHandle />
          <b style={FORM_TITLE}>{title}</b>
          {children}
        </div>
      </div>
    </Portal>
  );
}

const footer = (busy: boolean, primary: string, disabled: boolean, onClose: () => void, onGo: () => void, danger = false) => (
  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
    <button type="button" onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 999, background: "var(--card)", border: "1.5px solid var(--el)", fontWeight: 800, fontSize: 12.5, cursor: "pointer", color: INK, fontFamily: "inherit" }}>
      Cancel
    </button>
    <button
      type="button"
      disabled={busy || disabled}
      onClick={onGo}
      style={{ flex: 1.6, padding: 12, borderRadius: 999, border: "none", fontWeight: 900, fontSize: 12.5, fontFamily: "inherit", cursor: disabled ? "default" : "pointer", background: disabled ? "var(--el)" : danger ? RED : "var(--text)", color: disabled ? "var(--muted)" : danger ? "#fff" : "var(--solid)" }}
    >
      {busy ? "Saving…" : primary}
    </button>
  </div>
);

function RaiseSheet({ label, paidInr, busy, error, onClose, onRaise }: { label: string; paidInr: number; busy: boolean; error: string | null; onClose: () => void; onRaise: (reason: string, claimedInr: number | null) => void }) {
  const [claimed, setClaimed] = useState("");
  const [reason, setReason] = useState("");
  const claimedInr = claimed === "" ? null : Number(claimed);
  const blocker = reason.trim().length < 3 ? "Say what is wrong" : null;
  return (
    <Shell title={`Dispute ${label}`} onClose={onClose}>
      <div style={{ fontSize: 12, color: SUB, margin: "6px 0 10px" }}>{label}</div>
      <div style={{ fontSize: 12, color: SUB, margin: "10px 0 4px" }}>Should have been — optional</div>
      <input value={claimed} onChange={(e) => setClaimed(digits(e.target.value))} inputMode="numeric" placeholder={`₹ e.g. ${paidInr * 2 || 500}`} aria-label="What it should have been" style={input} />
      <Totals paidInr={paidInr} claimedInr={claimedInr} />
      <div style={{ fontSize: 12, color: SUB, margin: "12px 0 4px" }}>What is wrong</div>
      <textarea value={reason} onChange={(e) => setReason(e.target.value.slice(0, 300))} rows={3} aria-label="What is wrong" placeholder="e.g. The class ran two hours" style={{ ...input, resize: "vertical" }} />
      {error ? (
        <div role="alert" style={{ fontSize: 11.5, color: RED, fontWeight: 700, marginTop: 8 }}>
          {error}
        </div>
      ) : null}
      {footer(busy, blocker ?? "Raise dispute", Boolean(blocker), onClose, () => onRaise(reason.trim(), claimedInr), true)}
    </Shell>
  );
}

const METHODS: Array<[PayoutMethod, string]> = [
  ["upi", "UPI"],
  ["bank_transfer", "Bank"],
  ["cash", "Cash"],
  ["other", "Other"],
];

function AnswerSheet({ label, d, busy, error, onClose, onAnswer }: { label: string; d: PaymentDispute; busy: boolean; error: string | null; onClose: () => void; onAnswer: (accept: boolean, response: string | null, settleMethod: PayoutMethod | null) => void }) {
  const [response, setResponse] = useState("");
  const [accept, setAccept] = useState<boolean | null>(null);
  /* ⚠ ACCEPTING AN UNDERPAYMENT CAN SETTLE IT (19 Oct 2026): the difference is
     recorded as a payment in the same press — on by default, and switchable off
     for somebody who will pay it some other way */
  const short = d.claimedInr !== null && d.claimedInr > d.amountInr ? d.claimedInr - d.amountInr : 0;
  const [settle, setSettle] = useState(true);
  const [method, setMethod] = useState<PayoutMethod>("upi");
  const settling = accept === true && short > 0 && settle;
  return (
    <Shell title={`Answer the dispute on ${label}`} onClose={onClose}>
      <div style={{ fontSize: 12.5, color: INK, margin: "8px 0 0", lineHeight: 1.5 }}>“{d.reason}”</div>
      <Totals paidInr={d.amountInr} claimedInr={d.claimedInr} />
      <div role="radiogroup" aria-label="Your answer" style={{ display: "flex", gap: 6, marginTop: 12 }}>
        {(
          [
            [true, "Accept"],
            [false, "Reject"],
          ] as const
        ).map(([v, w]) => (
          <button key={w} type="button" role="radio" aria-checked={accept === v} onClick={() => setAccept(v)} style={{ flex: 1, padding: "9px", borderRadius: 999, fontWeight: 800, fontSize: 12, fontFamily: "inherit", cursor: "pointer", background: accept === v ? "var(--text)" : "var(--card)", color: accept === v ? "var(--solid)" : SUB, border: `1.5px solid ${accept === v ? "var(--text)" : "var(--el)"}` }}>
            {w}
          </button>
        ))}
      </div>
      {accept === true && short > 0 ? (
        <div data-testid="dispute-settle" style={{ marginTop: 12, padding: "11px 12px", borderRadius: 14, border: "1.5px solid var(--el)", background: "var(--card)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, fontWeight: 800, color: INK, cursor: "pointer" }}>
            <input type="checkbox" checked={settle} onChange={(e) => setSettle(e.target.checked)} aria-label={`Record the ${rupees(short)} difference as paid`} />
            Record the {rupees(short)} difference as paid
          </label>
          {settle ? (
            <div role="radiogroup" aria-label="Paid by" style={{ display: "flex", gap: 6, marginTop: 9, flexWrap: "wrap" }}>
              {METHODS.map(([m, w]) => (
                <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)} style={{ padding: "6px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 800, fontFamily: "inherit", cursor: "pointer", background: method === m ? "var(--text)" : "transparent", color: method === m ? "var(--solid)" : SUB, border: `1.5px solid ${method === m ? "var(--text)" : "var(--el)"}` }}>
                  {w}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: SUB, marginTop: 6 }}>Record it later from Pay as an amount.</div>
          )}
        </div>
      ) : null}
      <div style={{ fontSize: 12, color: SUB, margin: "12px 0 4px" }}>Your answer — optional</div>
      <textarea value={response} onChange={(e) => setResponse(e.target.value.slice(0, 300))} rows={2} aria-label="A note with your answer" placeholder="e.g. Paying the rest on Friday" style={{ ...input, resize: "vertical" }} />
      {error ? (
        <div role="alert" style={{ fontSize: 11.5, color: RED, fontWeight: 700, marginTop: 8 }}>
          {error}
        </div>
      ) : null}
      {footer(
        busy,
        accept === null ? "Accept or reject" : accept ? (settling ? `Accept · record ${rupees(short)}` : "Accept dispute") : "Reject dispute",
        accept === null,
        onClose,
        () => onAnswer(Boolean(accept), response.trim() || null, settling ? method : null)
      )}
    </Shell>
  );
}
