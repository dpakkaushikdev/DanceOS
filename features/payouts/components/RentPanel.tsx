"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bizCard } from "@/features/crews/components/crew-kit";
import { money as rupees } from "@/features/payouts/components/earnings-kit";
import { PaidCovers, coveredWords } from "@/features/payouts/components/PaidCovers";
import { SettleSheet } from "@/features/payouts/components/SettleSheet";
import { recordRentAmountAction, recordRentPaymentAction, voidRentPaymentAction } from "@/features/payouts/server-actions/payouts";
import { DOS_TOOLS } from "@/features/businesses/components/biz-kit";
import { toolBtn } from "@/components/ui/ToolCard";
import { INK, MUTED, SUB } from "@/lib/design/tokens";
import { sessionDayLabel } from "@/lib/format/session";
import type { RentPayment, RentVenue } from "@/types/payout";
import type { PaymentDispute } from "@/repositories/disputes";

/** RENT — the studios an artist's page holds classes in (18 Oct 2026, the user:
 *  "when an artist making class and adding studio should get option to pay that
 *  studio rent in same way from other team"). The amount is typed when paying, in
 *  the same settle sheet a team member is paid from, with its total; rent may be
 *  paid ahead, so a class still to run is on the list too. */

const TINT = DOS_TOOLS.rooms.c;
const STATE_WORD: Record<RentPayment["status"], string> = { done: "Paid", in_transit: "In transit", on_hold: "On hold", failed: "Failed" };

const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 900, letterSpacing: 1, color: SUB, margin: "4px 0 8px", textTransform: "uppercase" };

function PaymentRow({ p, other, onVoid, dispute }: { p: RentPayment; other: string; onVoid?: () => void; dispute?: { side: "paid" | "payer"; byTarget: Record<string, PaymentDispute> } }) {
  return (
    <div data-testid="rent-payment" style={{ borderTop: "1.5px solid var(--el)", padding: "8px 0 2px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 800, color: INK }}>
          {other} · {coveredWords(p)}
        </span>
        <b style={{ fontSize: 13, color: INK }}>{rupees(p.amountInr)}</b>
      </div>
      <div style={{ fontSize: 10.5, color: SUB, margin: "2px 0 4px" }}>
        {STATE_WORD[p.status]} · {p.paidOn}
        {p.providerRef ? ` · Ref ${p.providerRef}` : ""}
        {p.note ? ` · ${p.note}` : ""}
      </div>
      <PaidCovers
        sessions={p.sessions}
        dispute={dispute ? { side: dispute.side, of: "rent", paymentId: p.id, amountInr: p.amountInr, byTarget: dispute.byTarget } : undefined}
      />
      {onVoid ? (
        <button type="button" onClick={onVoid} aria-label={`Void the ${rupees(p.amountInr)} rent to ${other}`} style={{ fontSize: 11, fontWeight: 800, color: "#DC2626", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>
          Void — recorded by mistake
        </button>
      ) : null}
    </div>
  );
}

/** The payer's side: one card per studio, Pay rent, and what has been paid. */
export function RentToPay({ payerBusinessId, venues, disputes }: { payerBusinessId: string; venues: RentVenue[]; disputes?: Record<string, PaymentDispute> }) {
  const router = useRouter();
  const [open, setOpen] = useState<RentVenue | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  if (venues.length === 0) return null;
  return (
    <section data-testid="rent-to-pay" style={{ marginBottom: 16 }}>
      <div style={head}>Studio rent · {venues.length}</div>
      {venues.map((v) => {
        const paid = v.payments.reduce((n, p) => n + (p.status === "done" ? p.amountInr : 0), 0);
        return (
          <div key={v.venueBusinessId} data-testid="rent-venue" style={{ ...bizCard, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: INK }}>{v.venueName}</div>
                <div style={{ fontSize: 11, color: SUB, marginTop: 2 }}>
                  {v.unpaid.length} class{v.unpaid.length === 1 ? "" : "es"} not paid for · {rupees(paid)} paid
                </div>
              </div>
              {/* always pressable (19 Oct 2026): with every class paid for, rent
                  can still go as a lump sum */}
              <button
                type="button"
                aria-label={`Pay rent to ${v.venueName}`}
                onClick={() => {
                  setMsg(null);
                  setOpen(v);
                }}
                style={{ ...toolBtn("primary", TINT), flex: "0 0 auto" }}
              >
                Pay rent
              </button>
            </div>
            {v.payments.length ? (
              <details style={{ marginTop: 8 }}>
                <summary style={{ fontSize: 11.5, fontWeight: 800, color: SUB, cursor: "pointer" }}>Rent paid · {v.payments.length}</summary>
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
            ) : null}
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
          onAmountOnly={async (amountInr, meta) => {
            const out = await recordRentAmountAction({ payerBusinessId, venueBusinessId: open.venueBusinessId, amountInr, ...meta });
            if (!out.error) {
              setMsg(`${rupees(amountInr)} rent recorded for ${open.venueName}`);
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
