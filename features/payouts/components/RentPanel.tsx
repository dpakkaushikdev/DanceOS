"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bizCard } from "@/features/crews/components/crew-kit";
import { money as rupees } from "@/features/payouts/components/earnings-kit";
import { PaidCovers, coveredWords } from "@/features/payouts/components/PaidCovers";
import { SettleSheet } from "@/features/payouts/components/SettleSheet";
import { recordRentPaymentAction, voidRentPaymentAction } from "@/features/payouts/server-actions/payouts";
import { DOS_TOOLS } from "@/features/businesses/components/biz-kit";
import { ToolChip, ToolFacts, toolBtn } from "@/components/ui/ToolCard";
import { INK, MUTED, SUB } from "@/lib/design/tokens";
import { sessionDayLabel } from "@/lib/format/session";
import { PAYOUT_METHOD_LABEL, type RentPayment, type RentVenue } from "@/types/payout";
import type { PaymentDispute } from "@/repositories/disputes";

/** RENT — the studios an artist's page holds classes in (18 Oct 2026, the user:
 *  "when an artist making class and adding studio should get option to pay that
 *  studio rent in same way from other team"). The amount is typed when paying, in
 *  the same settle sheet a team member is paid from, with its total; rent may be
 *  paid ahead, so a class still to run is on the list too. */

const TINT = DOS_TOOLS.rooms.c;
const STATE_WORD: Record<RentPayment["status"], string> = { done: "Paid", in_transit: "In transit", on_hold: "On hold", failed: "Failed" };

const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 900, letterSpacing: 1, color: SUB, margin: "4px 0 8px", textTransform: "uppercase" };
const dayWords = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${iso.slice(0, 10)}T00:00:00+05:30`));

/** ⚠ EVERY RENT PAYMENT IS A FOLD (19 Oct 2026, the user: "rent payments should
 *  be collapsible"): the head is what it was — the amount, the day, the method,
 *  what it covered, its state — and the classes it covered, the reference, the
 *  note, the dispute and Void open underneath. */
function PaymentRow({ p, other, onVoid, dispute }: { p: RentPayment; other: string; onVoid?: () => void; dispute?: { side: "paid" | "payer"; byTarget: Record<string, PaymentDispute> } }) {
  return (
    <details data-testid="rent-payment" className="dos-fold" style={{ borderTop: "1.5px solid var(--el)", padding: "8px 0 2px" }}>
      <summary data-testid="rent-payment-head" aria-label={`${rupees(p.amountInr)} rent on ${dayWords(p.paidOn)} — show what it covered`} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", listStyle: "none" }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: "block", fontSize: 14, fontWeight: 900, color: INK, fontVariantNumeric: "tabular-nums" }}>{rupees(p.amountInr)}</b>
          <span style={{ display: "block", fontSize: 10.5, color: SUB, marginTop: 1 }}>
            {dayWords(p.paidOn)} · {PAYOUT_METHOD_LABEL[p.method]} · {coveredWords(p)}
          </span>
        </span>
        <ToolChip word={STATE_WORD[p.status].toUpperCase()} fg={p.status === "done" ? "#16A34A" : p.status === "failed" ? "#DC2626" : "#D97706"} bg={p.status === "done" ? "rgba(34,197,94,.16)" : p.status === "failed" ? "rgba(220,38,38,.14)" : "rgba(245,158,11,.16)"} />
        <span aria-hidden="true" className="dos-fold-chev" style={{ fontSize: 12, color: SUB, flexShrink: 0 }}>▾</span>
      </summary>
      <div style={{ height: 6 }} aria-hidden="true" />
      {p.providerRef ? <div style={{ fontSize: 10.5, color: SUB, marginTop: 3 }}>Reference {p.providerRef}</div> : null}
      {p.note ? <div style={{ fontSize: 12, marginTop: 4 }}>{p.note}</div> : null}
      <div style={{ height: 4 }} aria-hidden="true" />
      <PaidCovers
        sessions={p.sessions}
        dispute={dispute ? { side: dispute.side, of: "rent", paymentId: p.id, amountInr: p.amountInr, byTarget: dispute.byTarget } : undefined}
      />
      {onVoid ? (
        <button type="button" onClick={onVoid} aria-label={`Void the ${rupees(p.amountInr)} rent to ${other}`} style={{ fontSize: 11, fontWeight: 800, color: "#DC2626", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>
          Void — recorded by mistake
        </button>
      ) : null}
    </details>
  );
}

/** The payer's side: one card per studio — what it adds up to, the classes not
 *  paid for yet, Pay rent, and every payment with the classes it covered.
 *  ⚠ NO LUMP SUM (19 Oct 2026, the user: "remove lump sump for studio rent"):
 *  rent is paid per class, so every rupee says which class it was for. */
export function RentToPay({ payerBusinessId, venues, disputes }: { payerBusinessId: string; venues: RentVenue[]; disputes?: Record<string, PaymentDispute> }) {
  const router = useRouter();
  const [open, setOpen] = useState<RentVenue | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  if (venues.length === 0) return null;
  return (
    <section data-testid="rent-to-pay" style={{ marginBottom: 16 }}>
      {venues.map((v) => {
        const paid = v.payments.reduce((n, p) => n + (p.status === "done" ? p.amountInr : 0), 0);
        const pending = v.payments.reduce((n, p) => n + (p.status !== "done" && p.status !== "failed" ? p.amountInr : 0), 0);
        const linesPaid = v.payments.reduce((n, p) => n + p.sessions.length, 0);
        const nothingDue = v.unpaid.length === 0;
        return (
          <div key={v.venueBusinessId} data-testid="rent-venue" style={{ ...bizCard, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...head, margin: 0 }}>Rent to</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: INK }}>{v.venueName}</div>
              </div>
              <button
                type="button"
                aria-label={`Pay rent to ${v.venueName}`}
                disabled={nothingDue}
                title={nothingDue ? "Every class here is paid for" : undefined}
                onClick={() => {
                  setMsg(null);
                  setOpen(v);
                }}
                style={{ ...toolBtn("primary", TINT), flex: "0 0 auto", opacity: nothingDue ? 0.45 : 1, cursor: nothingDue ? "default" : "pointer" }}
              >
                Pay rent
              </button>
            </div>
            <ToolFacts
              tint={TINT}
              style={{ marginTop: 10 }}
              items={[
                { label: "Paid", value: rupees(paid), testId: "rent-paid-total" },
                { label: linesPaid === 1 ? "Class paid for" : "Classes paid for", value: linesPaid },
                { label: "Not paid for", value: v.unpaid.length, testId: "rent-unpaid-count" },
              ]}
            />
            {pending > 0 ? <div style={{ fontSize: 11.5, fontWeight: 800, color: "#F59E0B", marginTop: 6 }}>{rupees(pending)} on its way</div> : null}

            <div style={{ ...head, margin: "12px 0 2px" }}>Not paid for yet · {v.unpaid.length}</div>
            {nothingDue ? (
              <div style={{ fontSize: 11.5, color: SUB }}>Every class here is paid for.</div>
            ) : (
              v.unpaid.map((s) => (
                <div key={s.sessionId} data-testid="rent-unpaid" style={{ display: "flex", gap: 8, borderTop: "1.5px solid var(--el)", padding: "6px 0", alignItems: "baseline" }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 800, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.classTitle}</span>
                  <span style={{ flexShrink: 0, fontSize: 11, color: SUB }}>{sessionDayLabel(s.startsAt)}</span>
                </div>
              ))
            )}

            {v.payments.length === 0 ? (
              <>
                <div style={{ ...head, margin: "12px 0 2px" }}>Payments · 0</div>
                <div style={{ fontSize: 11.5, color: SUB }}>No rent paid yet.</div>
              </>
            ) : (
              <details data-testid="rent-payments" className="dos-fold" style={{ marginTop: 12 }}>
                <summary aria-label={`Rent payments to ${v.venueName} — ${v.payments.length}`} style={{ ...head, margin: "0 0 2px", cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ flex: 1 }}>Payments · {v.payments.length}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{rupees(paid)}</span>
                  <span aria-hidden="true" className="dos-fold-chev">▾</span>
                </summary>
                {v.payments.map((p) => (
                  <PaymentRow
                    key={p.id}
                    p={p}
                    other={v.venueName}
                    dispute={disputes ? { side: "payer", byTarget: disputes } : undefined}
                    onVoid={async () => {
                      if (!window.confirm(`Void the ${rupees(p.amountInr)} rent to ${v.venueName}? Its classes go back on the list.`)) return;
                      const out = await voidRentPaymentAction({ id: p.id });
                      setMsg(out.error ?? "Voided");
                      router.refresh();
                    }}
                  />
                ))}
              </details>
            )}
          </div>
        );
      })}
      {msg ? (
        <div role="status" style={{ fontSize: 11.5, color: MUTED, marginTop: 4 }}>
          {msg}
        </div>
      ) : null}
      {open ? (
        <SettleSheet
          title={`Pay rent to ${open.venueName}`}
          face={{ name: open.venueName, photoPath: null }}
          tint={TINT}
          itemsHead="CLASSES IN THEIR ROOMS"
          emptyWords="Every class here is paid for."
          items={open.unpaid.map((s) => ({ id: s.sessionId, kind: "session" as const, title: s.classTitle, sub: sessionDayLabel(s.startsAt) }))}
          onClose={() => setOpen(null)}
          onSettle={async (lines, meta) => {
            const out = await recordRentPaymentAction({
              payerBusinessId,
              venueBusinessId: open.venueBusinessId,
              lines: lines.flatMap((l) => ("sessionId" in l ? [{ sessionId: l.sessionId, rateInr: l.rateInr }] : [])),
              ...meta,
            });
            if (!out.error) {
              setMsg(`${rupees(lines.reduce((n, l) => n + l.rateInr, 0))} rent recorded for ${open.venueName}`);
              setOpen(null);
              router.refresh();
            }
            return out;
          }}
        />
      ) : null}
    </section>
  );
}

/** The venue's side: the rent artists have paid this studio. Read only. */
export function RentReceived({ payments }: { payments: RentPayment[] }) {
  if (payments.length === 0) return null;
  const total = payments.reduce((n, p) => n + (p.status === "done" ? p.amountInr : 0), 0);
  return (
    <section data-testid="rent-received" style={{ ...bizCard, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <div style={{ ...head, flex: 1, margin: 0 }}>Rent received · {payments.length}</div>
        <b style={{ fontSize: 14, color: INK }}>{rupees(total)}</b>
      </div>
      {payments.map((p) => (
        <PaymentRow key={p.id} p={p} other={p.payerName} />
      ))}
    </section>
  );
}
