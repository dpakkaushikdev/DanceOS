import { FigureHead } from "@/components/ui/FigureHead";
import { ToolChip } from "@/components/ui/ToolCard";
import { PaidCovers, coveredWords } from "@/features/payouts/components/PaidCovers";
import { money as rupees } from "@/features/payouts/components/earnings-kit";
import { GREEN, INK, MUTED, SUB } from "@/lib/design/tokens";
import { PAYOUT_METHOD_LABEL, payoutTone, type RentPayment } from "@/types/payout";
import { disputedInr, type PaymentDispute } from "@/repositories/disputes";

/** THE RENT ONE ARTIST PAGE PAID THIS STUDIO (19 Oct 2026, the user: "rent received
 *  in studio should also be handled inside the person whom it is received from").
 *  Drawn in ONE place per renter — their Member Detail page's Rent column when they
 *  are on this team, the renter page when they are not — and the Team desk keeps a
 *  one-line summary that opens it. Read-only: the payer records rent, the studio
 *  reads it. */

const panel: React.CSSProperties = { background: "var(--card)", border: "1.5px solid var(--el)", borderRadius: 18, padding: "13px 14px", marginBottom: 12 };
const head: React.CSSProperties = { fontSize: 10, fontWeight: 900, letterSpacing: 1, color: MUTED };
const TONE: Record<"done" | "transit" | "held", { word: string; ink: string; ground: string }> = {
  done: { word: "PAID", ink: GREEN, ground: "rgba(34,197,94,.16)" },
  transit: { word: "IN TRANSIT", ink: "#F59E0B", ground: "rgba(245,158,11,.16)" },
  held: { word: "ON HOLD", ink: "#F87171", ground: "rgba(248,113,113,.16)" },
};
const dayWords = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${iso.slice(0, 10)}T00:00:00+05:30`));

export function RentReceivedList({
  payments,
  payerName,
  disputes,
}: {
  payments: RentPayment[];
  payerName: string;
  /** the latest dispute per entry — the studio paid rent may dispute an entry (19 Oct 2026) */
  disputes?: Record<string, PaymentDispute>;
}) {
  const total = payments.reduce((n, p) => n + (p.status === "done" ? p.amountInr : 0), 0);
  const disputed = disputes ? disputedInr(Object.values(disputes).filter((d) => payments.some((p) => p.id === d.rentPaymentId))) : 0;
  return (
    <div style={panel} data-testid="rent-from-renter">
      <FigureHead
        margin="0 0 8px"
        title={<span style={head}>RENT FROM {payerName.toUpperCase()} · {payments.length}</span>}
        figure={<b style={{ fontSize: 14, color: INK, fontVariantNumeric: "tabular-nums" }}>{rupees(total)}</b>}
      />
      {disputed > 0 ? (
        <div data-testid="rent-from-disputed" style={{ fontSize: 11.5, fontWeight: 800, color: "#D97706", marginBottom: 6 }}>
          {rupees(disputed)} disputed
        </div>
      ) : null}
      {payments.length === 0 ? (
        <div style={{ fontSize: 11.5, color: SUB }}>No rent recorded yet.</div>
      ) : (
        payments.map((p) => {
          const tone = TONE[payoutTone(p.status)];
          return (
            <div key={p.id} data-testid="rent-from-payment" style={{ borderTop: "1.5px solid var(--el)", paddingTop: 8, marginTop: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: "block", fontSize: 14, fontWeight: 900, color: INK, fontVariantNumeric: "tabular-nums" }}>{rupees(p.amountInr)}</b>
                  <span style={{ display: "block", fontSize: 10.5, color: SUB, marginTop: 1 }}>
                    {dayWords(p.paidOn)} · {PAYOUT_METHOD_LABEL[p.method]} · {coveredWords(p)}
                  </span>
                </span>
                <ToolChip word={tone.word} fg={tone.ink} bg={tone.ground} />
              </div>
              {p.providerRef ? <div style={{ fontSize: 10.5, color: SUB, marginTop: 3 }}>Reference {p.providerRef}</div> : null}
              {p.note ? <div style={{ fontSize: 12, marginTop: 4 }}>{p.note}</div> : null}
              <div style={{ marginTop: 4 }}>
                <PaidCovers
                  sessions={p.sessions}
                  dispute={disputes ? { side: "paid", of: "rent", paymentId: p.id, amountInr: p.amountInr, byTarget: disputes } : undefined}
                />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
