"use client";

import { useState } from "react";
import { CARD, DOS_UI, GOLD, GREEN, INK, LINE, SUB } from "@/lib/design/tokens";
import { PAYOUT_METHOD_LABEL, PAYOUT_STATUS_LABEL, payoutTone, type MyEarnings } from "@/types/payout";
import { SettlementRow, money } from "@/features/payouts/components/earnings-kit";
import { coveredWords, PaidCovers } from "@/features/payouts/components/PaidCovers";

/** PAID TO YOU — WHAT EACH STUDIO HAS PAID YOU AND WHAT IS NOT YET SETTLED
 *  (18 Oct 2026). One card per studio: the sessions you took there, how many
 *  classes and enquiries it has not settled yet, and what it has paid — its
 *  payments folded under the card, each saying what it covered.
 *
 *  ⚠ NO "DUE" IN RUPEES: the studio sets the amount when it pays (the user: "no
 *  other way to set price from somewhere else"), so what is unsettled is a COUNT
 *  until then. */
export function PaidToYou({ data }: { data: MyEarnings }) {
  const [open, setOpen] = useState<string | null>(null);
  if (data.studios.length === 0 && data.payouts.length === 0) return null;

  return (
    <section id="paid-to-you" data-testid="paid-to-you" style={{ fontFamily: DOS_UI, color: INK, margin: "4px 0 14px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "0 2px 8px" }}>
        <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: 0.7, color: "var(--muted)" }}>PAID TO YOU</span>
        <span aria-hidden="true" style={{ flex: 1, height: 1.5, background: "var(--el)" }} />
        <b style={{ fontSize: 15, color: GREEN }} data-testid="paid-to-you-total">
          {money(data.paidTotal)}
        </b>
      </div>
      {data.unsettledTotal > 0 ? (
        <div style={{ fontSize: 11.5, fontWeight: 800, color: GOLD, margin: "0 2px 8px" }} data-testid="paid-to-you-unsettled">
          {data.unsettledTotal} not settled yet
        </div>
      ) : null}

      {data.studios.map((s) => {
        const pays = data.payouts.filter((p) => p.businessId === s.businessId || (s.businessId.startsWith("name:") && p.businessName === s.businessName));
        const isOpen = open === s.businessId;
        return (
          <div key={s.businessId} id={`paid-${s.businessId}`} data-testid="paid-studio" style={{ background: CARD, border: `1.5px solid ${LINE}`, borderRadius: 16, padding: "12px 14px", marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : s.businessId)}
              aria-expanded={isOpen}
              style={{ display: "flex", width: "100%", alignItems: "baseline", gap: 8, background: "none", border: 0, padding: 0, color: INK, cursor: "pointer", fontFamily: DOS_UI, textAlign: "left" }}
            >
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.businessName}</span>
              <b style={{ fontSize: 13.5 }}>{money(s.paidInr + s.otherPaidInr)}</b>
              <span aria-hidden="true" style={{ color: SUB, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }}>
                ›
              </span>
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 9 }}>
              <Fact label="SESSIONS" value={String(s.sessions)} />
              <Fact label="NOT SETTLED" value={String(s.unsettled)} tone={s.unsettled > 0 ? GOLD : SUB} />
              <Fact label="PAID" value={money(s.paidInr + s.otherPaidInr)} tone={GREEN} />
            </div>
            {isOpen ? (
              <div style={{ marginTop: 10 }} data-testid="paid-history">
                {pays.length === 0 ? (
                  <div style={{ fontSize: 11.5, color: SUB }}>No payment recorded yet.</div>
                ) : (
                  pays.map((p) => (
                    <div key={p.id}>
                      <SettlementRow
                        title={PAYOUT_METHOD_LABEL[p.method]}
                        meta={`${p.paidOn}${p.providerRef ? ` · ${p.providerRef}` : ""} · ${coveredWords(p)} · ${PAYOUT_STATUS_LABEL[p.status]}`}
                        amount={p.amountInr}
                        tone={payoutTone(p.status)}
                      />
                      <PaidCovers sessions={p.sessions} enquiries={p.enquiries} />
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div style={{ background: "var(--el)", borderRadius: 10, padding: "6px 8px", minWidth: 0 }}>
      <div style={{ fontSize: 8.5, fontWeight: 900, letterSpacing: 0.8, color: "var(--muted)" }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 900, color: tone ?? INK, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
    </div>
  );
}
