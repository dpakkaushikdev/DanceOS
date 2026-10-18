import { DOS_UI, SUB } from "@/lib/design/tokens";
import { money } from "@/features/payouts/components/earnings-kit";
import { DisputeControl } from "@/features/payouts/components/DisputeControl";
import { sessionDayLabel as formatSessionDate } from "@/lib/format/session";
import type { PaymentDispute } from "@/repositories/disputes";

/** WHAT ONE PAYMENT COVERED (18 Oct 2026, the user: "should also show history of
 *  payments what is already settled"): each class session and each enquiry, at
 *  the amount it was paid at. One component for the payer's history and the
 *  payee's, so the two cannot describe one payment differently. */
type Covers = {
  sessions: Array<{ sessionId: string; classTitle: string; startsAt: string; rateInr: number; lineId?: string }>;
  enquiries?: Array<{ enquiryId: string; label: string; rateInr: number; lineId?: string }>;
};

/** A DISPUTE PER ENTRY (19 Oct 2026): when given, every line carries its own
 *  control, and a payment with no lines (a lump sum) carries one for itself. */
export type CoversDispute = {
  side: "paid" | "payer";
  /** a team payment or a rent payment */
  of: "payout" | "rent";
  paymentId: string;
  amountInr: number;
  /** the latest dispute per entry, keyed by the entry's id */
  byTarget: Record<string, PaymentDispute>;
};

export const coveredWords = (p: Covers): string => {
  const s = p.sessions.length;
  const e = p.enquiries?.length ?? 0;
  if (s === 0 && e === 0) return "lump sum";
  const parts = [];
  if (s) parts.push(`${s} class${s === 1 ? "" : "es"}`);
  if (e) parts.push(`${e} enquir${e === 1 ? "y" : "ies"}`);
  return parts.join(" · ");
};

const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: SUB, padding: "2px 0", flexWrap: "wrap" };
const name: React.CSSProperties = { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

export function PaidCovers({ sessions, enquiries = [], dispute }: Covers & { dispute?: CoversDispute }) {
  if (sessions.length === 0 && enquiries.length === 0) {
    if (!dispute) return null;
    const kind = dispute.of === "rent" ? "rent_payment" : "payout";
    const d = dispute.byTarget[dispute.paymentId] ?? null;
    if (dispute.side === "payer" && !d) return null;
    return (
      <div data-testid="paid-covers" style={{ ...row, margin: "0 0 8px", paddingLeft: 10, fontFamily: DOS_UI }}>
        <span style={name}>Lump sum</span>
        <DisputeControl kind={kind} targetId={dispute.paymentId} label="Lump sum" paidInr={dispute.amountInr} dispute={d} side={dispute.side} />
      </div>
    );
  }
  const control = (lineId: string | undefined, kind: "payout_line" | "payout_enquiry_line" | "rent_line", label: string, paid: number) => {
    if (!dispute || !lineId) return null;
    const d = dispute.byTarget[lineId] ?? null;
    if (dispute.side === "payer" && !d) return null;
    return <DisputeControl kind={kind} targetId={lineId} label={label} paidInr={paid} dispute={d} side={dispute.side} />;
  };
  return (
    <ul data-testid="paid-covers" style={{ listStyle: "none", margin: "0 0 8px", padding: "0 0 0 10px", fontFamily: DOS_UI }}>
      {sessions.map((s) => {
        const label = `${s.classTitle}${s.startsAt ? ` · ${formatSessionDate(s.startsAt)}` : ""}`;
        return (
          <li key={s.sessionId} style={row}>
            <span style={name}>{label}</span>
            <b>{money(s.rateInr)}</b>
            {control(s.lineId, dispute?.of === "rent" ? "rent_line" : "payout_line", label, s.rateInr)}
          </li>
        );
      })}
      {enquiries.map((e) => (
        <li key={e.enquiryId} style={row}>
          <span style={name}>{e.label}</span>
          <b>{money(e.rateInr)}</b>
          {control(e.lineId, "payout_enquiry_line", e.label, e.rateInr)}
        </li>
      ))}
    </ul>
  );
}
