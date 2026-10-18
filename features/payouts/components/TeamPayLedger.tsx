"use client";

import { useState } from "react";
import { Pick } from "@/components/ui/PickSheet";
import { recordPayoutAction, setPayoutStatusAction, voidPayoutAction } from "@/features/payouts/server-actions/payouts";
import { CARD, DOS_UI, GOLD, GREEN, INK, LILAC, LINE, RED, SUB } from "@/lib/design/tokens";
import { FORM_TITLE } from "@/components/ui/formTitle";
import { sessionDayLabel } from "@/lib/format/session";
import { useCloseOnBack } from "@/lib/hooks/useCloseOnBack";
import {
  PAYOUT_METHOD_LABEL,
  PAYOUT_STATUS_LABEL,
  payoutTone,
  type BusinessPayLedger,
  type PayoutMethod,
  type PayoutStatus,
  type PersonPayLedger,
} from "@/types/payout";
import { DOS_MONO, LedgerBlock, SectionLabel, SettlementRow, barColour, money, type LedgerRow } from "./earnings-kit";

/** WHAT YOU OWE YOUR PEOPLE, ON THE TEAM DESK (18 Oct 2026, the user: "what
 *  you owe should be handled from teams not here").
 *
 *  This is the money-out half that lived under Earnings since Step 13, moved
 *  whole: who is owed for which sessions, recording a payment against them, and
 *  what has been settled (with its state and Void). What it is NOT is still a
 *  payroll desk — a studio settles by bank or UPI and RECORDS it here; DanceOS
 *  does not move this money, and the desk says so in one line. */

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: CARD,
  border: `1.5px solid ${LINE}`,
  borderRadius: 12,
  padding: "11px 12px",
  fontSize: 13,
  color: INK,
  outline: "none",
  fontFamily: "inherit",
};

const METHODS: PayoutMethod[] = ["bank_transfer", "upi", "cash", "other"];
const STATUSES: PayoutStatus[] = ["done", "in_transit", "on_hold"];

function Sheet({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: React.ReactNode }) {
  useCloseOnBack(onClose);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 700, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{ background: LILAC, color: INK, width: "100%", maxWidth: 430, borderRadius: "22px 22px 0 0", padding: "18px 16px 26px", maxHeight: "88vh", overflowY: "auto", fontFamily: DOS_UI, boxSizing: "border-box" }}
      >
        <b style={FORM_TITLE}>{title}</b>
        {sub ? <div style={{ fontSize: 12, color: SUB, margin: "5px 0 14px" }}>{sub}</div> : <div style={{ height: 12 }} />}
        {children}
      </div>
    </div>
  );
}

export function TeamPayLedger({ businessId, ledger }: { businessId: string; ledger: BusinessPayLedger }) {
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [payPerson, setPayPerson] = useState<PersonPayLedger | null>(null);
  const [openPayout, setOpenPayout] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [method, setMethod] = useState<PayoutMethod>("bank_transfer");
  const [status, setStatus] = useState<PayoutStatus>("done");
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");

  const fire = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2200);
  };

  const run = async (op: () => Promise<{ error: string | null }>, doneMsg: string) => {
    if (busy) return false;
    setBusy(true);
    setError(null);
    const out = await op();
    setBusy(false);
    if (out.error) {
      setError(out.error);
      return false;
    }
    fire(doneMsg);
    return true;
  };

  const openPaySheet = (person: PersonPayLedger) => {
    setChosen(new Set(person.unpaid.map((s) => s.sessionId)));
    setMethod("bank_transfer");
    setStatus("done");
    setRef("");
    setNote("");
    setError(null);
    setPayPerson(person);
  };

  const rows: LedgerRow[] = ledger.people.map((p, i) => ({
    key: p.userId,
    label: p.personName,
    amount: p.owedInr,
    colour: barColour(i),
    people: p.unpaid.map((s) => ({
      key: s.sessionId,
      label: sessionDayLabel(s.startsAt),
      meta: s.classTitle,
      status: s.rateInr > 0 ? money(s.rateInr) : "no rate",
      statusColour: s.rateInr > 0 ? GREEN : SUB,
    })),
  }));

  const chosenTotal = payPerson?.unpaid.filter((s) => chosen.has(s.sessionId)).reduce((a, s) => a + s.rateInr, 0) ?? 0;
  const openPayoutRow = ledger.payouts.find((p) => p.id === openPayout) ?? null;
  const settled = showAll ? ledger.payouts : ledger.payouts.slice(0, 5);

  return (
    <div data-testid="team-pay-ledger" style={{ color: INK, fontFamily: DOS_UI, marginTop: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginBottom: 8 }}>
        {(
          [
            ["OWED", ledger.owedTotal, RED, "team-pay-owed"],
            ["SETTLED", ledger.paidTotal, GREEN, "team-pay-settled"],
            ["IN TRANSIT", ledger.inTransitTotal, GOLD, "team-pay-transit"],
          ] as const
        ).map(([label, v, tone, id]) => (
          <div key={label} style={{ background: CARD, border: `1.5px solid ${LINE}`, borderRadius: 14, padding: "9px 10px" }}>
            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.8, color: "var(--muted)" }}>{label}</div>
            <div data-testid={id} style={{ fontSize: 15, fontWeight: 900, color: tone, marginTop: 2 }}>
              {money(v)}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: SUB, lineHeight: 1.5, margin: "2px 0 10px" }}>You pay by bank or UPI and record it here — DanceOS does not move this money.</div>

      {ledger.complete ? null : (
        <div role="status" style={{ background: CARD, border: `1.5px solid ${LINE}`, borderRadius: 16, padding: "12px 14px", fontSize: 11, color: GOLD, lineHeight: 1.5, marginBottom: 10 }}>
          Counting the most recent rows only — these pay totals are not the whole history.
        </div>
      )}

      {ledger.people.length === 0 ? (
        <div style={{ background: CARD, border: `1.5px solid ${LINE}`, borderRadius: 16, padding: "14px 15px", fontSize: 12.5, color: SUB, marginBottom: 10 }}>
          Nobody has taught a paid session yet.
        </div>
      ) : (
        <>
          <SectionLabel>WHAT YOU OWE</SectionLabel>
          <LedgerBlock rows={rows} openKey={openRow} onToggle={(k) => setOpenRow(openRow === k ? null : k)} whoLabel="SESSIONS" />
          {openRow
            ? (() => {
                const person = ledger.people.find((p) => p.userId === openRow);
                if (!person) return null;
                return (
                  <div style={{ marginTop: -4, marginBottom: 12 }}>
                    <button
                      type="button"
                      disabled={person.unpaid.length === 0 || person.owedInr <= 0}
                      onClick={() => openPaySheet(person)}
                      style={{
                        width: "100%",
                        background: person.owedInr > 0 ? GREEN : CARD,
                        color: person.owedInr > 0 ? "#fff" : SUB,
                        border: `1.5px solid ${person.owedInr > 0 ? GREEN : LINE}`,
                        borderRadius: 999,
                        padding: "11px 14px",
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: person.owedInr > 0 ? "pointer" : "default",
                        fontFamily: "inherit",
                      }}
                    >
                      {person.owedInr > 0 ? `Record a payment · ${money(person.owedInr)}` : "Nothing outstanding"}
                    </button>
                  </div>
                );
              })()
            : null}
        </>
      )}

      {ledger.payouts.length > 0 ? (
        <>
          <SectionLabel>SETTLED · {ledger.payouts.length}</SectionLabel>
          {settled.map((p) => (
            <SettlementRow
              key={p.id}
              title={`${p.personName} · ${PAYOUT_METHOD_LABEL[p.method]}`}
              meta={`${p.paidOn}${p.providerRef ? ` · ${p.providerRef}` : ""} · ${p.sessionCount} session${p.sessionCount === 1 ? "" : "s"} · ${PAYOUT_STATUS_LABEL[p.status]}`}
              amount={p.amountInr}
              tone={payoutTone(p.status)}
              onOpen={() => {
                setError(null);
                setOpenPayout(p.id);
              }}
            />
          ))}
          {!showAll && ledger.payouts.length > settled.length ? (
            <button type="button" onClick={() => setShowAll(true)} style={{ background: "none", border: 0, color: SUB, fontSize: 12, fontWeight: 800, cursor: "pointer", padding: "4px 0", fontFamily: "inherit" }}>
              Show all {ledger.payouts.length} ›
            </button>
          ) : null}
        </>
      ) : null}

      {payPerson ? (
        <Sheet title={`Pay ${payPerson.personName}`} onClose={() => setPayPerson(null)}>
          <div style={{ marginBottom: 12 }}>
            {payPerson.unpaid.map((s) => {
              const on = chosen.has(s.sessionId);
              return (
                <label key={s.sessionId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", marginBottom: 6, background: CARD, border: `1.5px solid ${on ? GREEN : LINE}`, borderRadius: 12, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => {
                      const next = new Set(chosen);
                      if (on) next.delete(s.sessionId);
                      else next.add(s.sessionId);
                      setChosen(next);
                    }}
                    style={{ accentColor: GREEN }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 800 }}>{sessionDayLabel(s.startsAt)}</span>
                    <span style={{ display: "block", fontSize: 10.5, color: SUB, marginTop: 1 }}>{s.classTitle}</span>
                  </span>
                  <b style={{ fontSize: 12.5, fontFamily: DOS_MONO }}>{money(s.rateInr)}</b>
                </label>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <Pick ariaLabel="Method" value={method} rows={METHODS.map((m) => ({ value: m, label: PAYOUT_METHOD_LABEL[m] }))} onPick={(v) => setMethod(v as PayoutMethod)} style={{ ...inputStyle, flex: 1 }} />
            <Pick ariaLabel="State" value={status} rows={STATUSES.map((s) => ({ value: s, label: PAYOUT_STATUS_LABEL[s] }))} onPick={(v) => setStatus(v as PayoutStatus)} style={{ ...inputStyle, flex: 1 }} />
          </div>
          <input aria-label="Reference" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="UTR or reference (optional)" style={{ ...inputStyle, marginBottom: 10 }} />
          <input aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" style={{ ...inputStyle, marginBottom: 14 }} />
          {error ? <div style={{ color: RED, fontSize: 12, marginBottom: 10 }}>{error}</div> : null}
          <button
            type="button"
            disabled={busy || chosen.size === 0 || chosenTotal <= 0}
            onClick={async () => {
              const ok = await run(
                () =>
                  recordPayoutAction({
                    businessId,
                    userId: payPerson.userId,
                    sessionIds: [...chosen],
                    method,
                    status,
                    providerRef: ref.trim() || null,
                    note: note.trim() || null,
                  }),
                `Recorded ${money(chosenTotal)} to ${payPerson.personName}`
              );
              if (ok) setPayPerson(null);
            }}
            style={{
              width: "100%",
              background: chosen.size > 0 && chosenTotal > 0 ? GREEN : CARD,
              color: chosen.size > 0 && chosenTotal > 0 ? "#fff" : SUB,
              border: "none",
              borderRadius: 999,
              padding: "13px 16px",
              fontSize: 14,
              fontWeight: 800,
              cursor: busy ? "wait" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {chosenTotal > 0 ? `Record ${money(chosenTotal)} · ${chosen.size} session${chosen.size === 1 ? "" : "s"}` : "Pick a session with a rate"}
          </button>
        </Sheet>
      ) : null}

      {openPayoutRow ? (
        <Sheet
          title={`${money(openPayoutRow.amountInr)} to ${openPayoutRow.personName}`}
          sub={`${openPayoutRow.paidOn} · ${PAYOUT_METHOD_LABEL[openPayoutRow.method]} · ${openPayoutRow.sessionCount} session${openPayoutRow.sessionCount === 1 ? "" : "s"}`}
          onClose={() => setOpenPayout(null)}
        >
          <SectionLabel>STATE</SectionLabel>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => run(() => setPayoutStatusAction({ payoutId: openPayoutRow.id, status: s }), `Marked ${PAYOUT_STATUS_LABEL[s]}`)}
                style={{
                  padding: "8px 13px",
                  borderRadius: 999,
                  fontSize: 11.5,
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  background: openPayoutRow.status === s ? INK : CARD,
                  color: openPayoutRow.status === s ? LILAC : SUB,
                  border: `1.5px solid ${LINE}`,
                }}
              >
                {PAYOUT_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          {error ? <div style={{ color: RED, fontSize: 12, marginBottom: 10 }}>{error}</div> : null}
          <div style={{ fontSize: 11.5, color: SUB, marginBottom: 10 }}>Voiding puts these sessions back on the owed list. The record stays.</div>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              const ok = await run(() => voidPayoutAction({ payoutId: openPayoutRow.id }), "Payment voided — those sessions are owed again");
              if (ok) setOpenPayout(null);
            }}
            style={{ width: "100%", background: CARD, color: RED, border: `1.5px solid ${RED}55`, borderRadius: 999, padding: "12px 16px", fontSize: 13, fontWeight: 800, cursor: busy ? "wait" : "pointer", fontFamily: "inherit" }}
          >
            Void this payment
          </button>
        </Sheet>
      ) : null}

      {toast ? (
        <div role="status" style={{ position: "fixed", bottom: 26, left: "50%", transform: "translateX(-50%)", background: LINE, border: `1.5px solid ${GREEN}`, color: INK, padding: "11px 18px", borderRadius: 999, fontSize: 13, fontWeight: 700, maxWidth: 390, textAlign: "center", zIndex: 800 }}>
          {toast}
        </div>
      ) : null}
    </div>
  );
}
