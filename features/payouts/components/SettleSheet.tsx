"use client";

import { useMemo, useState } from "react";
import { SheetHandle, sheetBody, sheetWrap } from "@/features/businesses/components/biz-kit";
import { money as rupees } from "@/features/payouts/components/earnings-kit";
import { ToolFace } from "@/components/ui/ToolCard";
import { FORM_TITLE } from "@/components/ui/formTitle";
import { INK, MUTED, SUB } from "@/lib/design/tokens";
import { useCloseOnBack } from "@/lib/hooks/useCloseOnBack";
import type { PayLine, PayoutMethod, PayoutStatus } from "@/types/payout";

/** ONE SETTLE SHEET for paying a team member and paying a studio rent (18 Oct
 *  2026, the user: *"no other way to set price from somewhere else it should
 *  happen only from the team section when going to pay"*, and then *"should give
 *  total properly while paying"*).
 *
 *  Every line is a class session or an enquiry, ticked or not, with its OWN
 *  amount; "Same ₹ for each" fills every ticked line at once. The TOTAL is the
 *  sum of the ticked lines, printed under the list in figure type and again on
 *  the button, so what is recorded is what was read.
 *
 *  ⚠ DanceOS records the payment — it does not move the money. "Pay through
 *  Cashfree" is drawn and disabled with its reason (the user's answer: switched
 *  on later). */

export interface SettleItem {
  /** session id or enquiry id */
  id: string;
  kind: "session" | "enquiry";
  title: string;
  sub: string;
}

export interface SettleMeta {
  method: PayoutMethod;
  status: PayoutStatus;
  providerRef: string | null;
  paidOn: string | null;
  note: string | null;
}

const CARD = "var(--card)";
const EL = "var(--el)";

const METHODS: ReadonlyArray<readonly [PayoutMethod, string]> = [
  ["upi", "UPI"],
  ["bank_transfer", "Bank transfer"],
  ["cash", "Cash"],
  ["other", "Other"],
];
const STATES: ReadonlyArray<readonly [PayoutStatus, string]> = [
  ["done", "Paid"],
  ["in_transit", "In transit"],
  ["on_hold", "On hold"],
];

const input: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: CARD,
  border: `1.5px solid ${EL}`,
  borderRadius: 12,
  padding: "11px 12px",
  fontSize: 13,
  color: INK,
  outline: "none",
  fontFamily: "inherit",
};

const chip = (on: boolean): React.CSSProperties => ({
  fontSize: 11.5,
  fontWeight: 800,
  padding: "7px 12px",
  borderRadius: 999,
  cursor: "pointer",
  background: on ? "var(--text)" : CARD,
  color: on ? "var(--solid)" : SUB,
  border: `1.5px solid ${on ? "var(--text)" : EL}`,
  fontFamily: "inherit",
});

const label: React.CSSProperties = { fontSize: 12, color: SUB, margin: "12px 0 4px" };
const digits = (s: string) => s.replace(/[^0-9]/g, "").slice(0, 7);

export function SettleSheet({
  title,
  face,
  tint,
  items,
  itemsHead,
  emptyWords,
  onSettle,
  onAmountOnly,
  onClose,
}: {
  title: string;
  face: { name: string; photoPath: string | null };
  tint: string;
  items: SettleItem[];
  /** "WHAT IS NOT SETTLED" or "CLASSES IN THEIR ROOMS" */
  itemsHead: string;
  emptyWords: string;
  onSettle: (lines: PayLine[], meta: SettleMeta) => Promise<{ error: string | null }>;
  /** a payment not for any class — offered on the Team desk only */
  onAmountOnly?: (amountInr: number, meta: SettleMeta) => Promise<{ error: string | null }>;
  onClose: () => void;
}) {
  useCloseOnBack(onClose, true);
  const [mode, setMode] = useState<"lines" | "amount">(items.length > 0 || !onAmountOnly ? "lines" : "amount");
  /* every line arrives ticked with no amount: the amount is the payer's to type */
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(items.map((i) => i.id)));
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [bulk, setBulk] = useState("");
  const [lump, setLump] = useState("");
  const [method, setMethod] = useState<PayoutMethod>("upi");
  const [status, setStatus] = useState<PayoutStatus>("done");
  const [ref, setRef] = useState("");
  const [paidOn, setPaidOn] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = useMemo(() => items.filter((i) => ticked.has(i.id)), [items, ticked]);
  const amountOf = (id: string) => Number(amounts[id] || 0);
  const total = mode === "amount" ? Number(lump || 0) : chosen.reduce((n, i) => n + amountOf(i.id), 0);
  const unpriced = mode === "lines" ? chosen.filter((i) => amountOf(i.id) <= 0).length : 0;
  const nSessions = chosen.filter((i) => i.kind === "session").length;
  const nEnquiries = chosen.length - nSessions;
  const countWords = [
    nSessions ? `${nSessions} class${nSessions === 1 ? "" : "es"}` : null,
    nEnquiries ? `${nEnquiries} enquir${nEnquiries === 1 ? "y" : "ies"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  /* what the button says when it cannot be pressed — the form's own grammar */
  const blocker =
    mode === "amount"
      ? total < 1
        ? "Enter an amount"
        : null
      : chosen.length === 0
        ? "Tick what you are paying for"
        : total < 1
          ? "Enter an amount"
          : null;

  const meta = (): SettleMeta => ({
    method,
    status,
    providerRef: ref.trim() || null,
    paidOn: paidOn || null,
    note: note.trim() || null,
  });

  const submit = async () => {
    if (busy || blocker) return;
    setBusy(true);
    setError(null);
    const out =
      mode === "amount" && onAmountOnly
        ? await onAmountOnly(total, meta())
        : await onSettle(
            chosen.map((i) => (i.kind === "session" ? { sessionId: i.id, rateInr: amountOf(i.id) } : { enquiryId: i.id, rateInr: amountOf(i.id) })),
            meta()
          );
    setBusy(false);
    if (out.error) setError(out.error);
  };

  return (
    <div onClick={onClose} style={sheetWrap}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} style={{ ...sheetBody, maxHeight: "92vh", overflowY: "auto" }}>
        <SheetHandle />
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 10 }}>
          <ToolFace name={face.name} photoPath={face.photoPath} tint={tint} size={44} />
          <b style={FORM_TITLE}>{title}</b>
        </div>
        <div style={{ fontSize: 11.5, color: SUB, margin: "0 0 12px", lineHeight: 1.5 }}>DanceOS records what you have paid — it does not move the money.</div>

        {onAmountOnly ? (
          <div role="tablist" aria-label="What you are paying for" style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <button type="button" role="tab" aria-selected={mode === "lines"} onClick={() => setMode("lines")} style={chip(mode === "lines")}>
              For classes &amp; enquiries
            </button>
            <button type="button" role="tab" aria-selected={mode === "amount"} onClick={() => setMode("amount")} style={chip(mode === "amount")}>
              Pay an amount (not for a class)
            </button>
          </div>
        ) : null}

        {mode === "lines" ? (
          <div data-testid="settle-lines">
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, color: SUB, margin: "0 0 6px" }}>
              {itemsHead} · {items.length}
            </div>
            {items.length === 0 ? (
              <div style={{ fontSize: 12, color: MUTED, padding: "10px 0" }}>{emptyWords}</div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                  <input
                    value={bulk}
                    onChange={(e) => setBulk(digits(e.target.value))}
                    placeholder="Same ₹ for each ticked"
                    inputMode="numeric"
                    aria-label="Same amount for each ticked"
                    style={{ ...input, flex: 1, padding: "9px 11px" }}
                  />
                  <button
                    type="button"
                    disabled={!bulk}
                    onClick={() => {
                      const next = { ...amounts };
                      for (const i of chosen) next[i.id] = bulk;
                      setAmounts(next);
                    }}
                    style={{ ...chip(Boolean(bulk)), padding: "9px 14px", opacity: bulk ? 1 : 0.5 }}
                  >
                    Apply
                  </button>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 4 }}>
                  <button type="button" onClick={() => setTicked(new Set(items.map((i) => i.id)))} style={{ fontSize: 11, fontWeight: 800, color: tint, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                    Tick all
                  </button>
                  <button type="button" onClick={() => setTicked(new Set())} style={{ fontSize: 11, fontWeight: 800, color: SUB, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                    Clear
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 260, overflowY: "auto" }}>
                  {items.map((it) => {
                    const on = ticked.has(it.id);
                    return (
                      <div
                        key={it.id}
                        data-testid="settle-line"
                        style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 9px", borderRadius: 12, background: on ? `${tint}14` : CARD, border: `1.5px solid ${on ? tint : EL}` }}
                      >
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          aria-label={`${it.title} · ${it.sub}`}
                          onClick={() => {
                            const next = new Set(ticked);
                            if (on) next.delete(it.id);
                            else next.add(it.id);
                            setTicked(next);
                          }}
                          style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, border: `2px solid ${on ? tint : EL}`, background: on ? tint : "transparent", color: "#fff", fontSize: 11, lineHeight: "12px", fontWeight: 900, cursor: "pointer", padding: 0 }}
                        >
                          {on ? "✓" : ""}
                        </button>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 12, fontWeight: 800, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {it.kind === "enquiry" ? "Enquiry · " : ""}
                            {it.title}
                          </span>
                          <span style={{ display: "block", fontSize: 10.5, color: SUB }}>{it.sub}</span>
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                          <span style={{ fontSize: 12, color: SUB, fontWeight: 800 }}>₹</span>
                          <input
                            value={amounts[it.id] ?? ""}
                            disabled={!on}
                            onChange={(e) => setAmounts({ ...amounts, [it.id]: digits(e.target.value) })}
                            placeholder="0"
                            inputMode="numeric"
                            aria-label={`Amount for ${it.title} · ${it.sub}`}
                            style={{ ...input, width: 78, padding: "7px 8px", textAlign: "right", opacity: on ? 1 : 0.45 }}
                          />
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <div style={label}>Amount</div>
            <input value={lump} onChange={(e) => setLump(digits(e.target.value))} placeholder="e.g. 9000" inputMode="numeric" aria-label="Amount in rupees" style={input} />
          </>
        )}

        {/* ── THE TOTAL (18 Oct 2026, the user: "should give total properly") ── */}
        <div
          data-testid="settle-total"
          style={{ marginTop: 12, padding: "12px 14px", borderRadius: 14, background: `${tint}12`, border: `1.5px solid ${tint}55`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, color: SUB }}>TOTAL</div>
            <div style={{ fontSize: 11, color: SUB, marginTop: 2 }}>
              {mode === "amount" ? "Not for a class" : chosen.length ? countWords : "Nothing ticked"}
              {unpriced > 0 ? ` · ${unpriced} at ₹0` : ""}
            </div>
          </div>
          <b data-testid="settle-total-figure" style={{ fontSize: 22, color: INK, fontVariantNumeric: "tabular-nums" }}>
            {rupees(total)}
          </b>
        </div>

        <div style={label}>How you paid</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {METHODS.map(([k, w]) => (
            <button key={k} type="button" aria-pressed={method === k} aria-label={w} onClick={() => setMethod(k)} style={chip(method === k)}>
              {w}
            </button>
          ))}
        </div>
        <div style={label}>Where it stands</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {STATES.map(([k, w]) => (
            <button key={k} type="button" aria-pressed={status === k} aria-label={w} onClick={() => setStatus(k)} style={chip(status === k)}>
              {w}
            </button>
          ))}
        </div>
        <div style={label}>Reference (UTR, UPI id) — optional</div>
        <input value={ref} onChange={(e) => setRef(e.target.value.slice(0, 120))} placeholder="e.g. 4321 8890 1123" aria-label="Payment reference" style={input} />
        <div style={label}>Paid on — optional</div>
        <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} aria-label="Paid on" style={input} />
        <div style={label}>Note — optional</div>
        <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} placeholder="e.g. September" aria-label="Note" style={input} />

        {error ? (
          <div role="alert" style={{ fontSize: 11.5, color: "#F87171", fontWeight: 700, marginTop: 10 }}>
            {error}
          </div>
        ) : null}

        <button
          type="button"
          disabled
          title="Paying through Cashfree is switched on later — record a payment you have made"
          style={{ width: "100%", marginTop: 14, padding: "11px", borderRadius: 999, background: CARD, border: `1.5px dashed ${EL}`, color: MUTED, fontWeight: 800, fontSize: 12, fontFamily: "inherit", cursor: "default" }}
        >
          Pay through Cashfree · coming soon
        </button>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 999, background: CARD, border: `1.5px solid ${EL}`, fontWeight: 800, fontSize: 12.5, cursor: "pointer", color: INK, fontFamily: "inherit" }}>
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || Boolean(blocker)}
            onClick={submit}
            data-testid="settle-record"
            style={{ flex: 1.6, padding: "12px", borderRadius: 999, background: blocker ? EL : "var(--text)", color: blocker ? "var(--muted)" : "var(--solid)", fontWeight: 900, fontSize: 12.5, cursor: blocker ? "default" : "pointer", border: "none", fontFamily: "inherit" }}
          >
            {busy ? "Recording…" : blocker ?? `Record ${rupees(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
