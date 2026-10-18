import { FigureHead } from "@/components/ui/FigureHead";
import { ToolChip, ToolFacts } from "@/components/ui/ToolCard";
import { PaidCovers, coveredWords } from "@/features/payouts/components/PaidCovers";
import { money as rupees } from "@/features/payouts/components/earnings-kit";
import { DOS_TOOLS } from "@/features/businesses/components/biz-kit";
import { GREEN, INK, MUTED, SUB } from "@/lib/design/tokens";
import { PAYOUT_METHOD_LABEL, payoutTone, type RentPayment } from "@/types/payout";
import { disputedInr, type PaymentDispute } from "@/repositories/disputes";

/** THE RENT ONE ARTIST PAGE PAYS THIS STUDIO, WRITTEN OUT (19 Oct 2026, the user:
 *  "rent received for studio team section should be inside team detail for that
 *  specific person … studio rent details should come properly and written better
 *  in detail"). Drawn in ONE place per renter — their Member Detail page's Rent
 *  column when they are on this team, the renter page when they are not; the Team
 *  desk shows no money. In reading order: what it adds up to, the classes held
 *  in our rooms, then every payment with the classes it paid for. Read-only: the
 *  payer records rent, the studio reads it — and may dispute an entry. */

export interface HeldClass {
  classId: string;
  title: string;
  held: number;
  upcoming: number;
  nextAt: string | null;
  lastAt: string | null;
}

const panel: React.CSSProperties = { background: "var(--card)", border: "1.5px solid var(--el)", borderRadius: 18, padding: "13px 14px", marginBottom: 12 };
const head: React.CSSProperties = { fontSize: 10, fontWeight: 900, letterSpacing: 1, color: MUTED };
const TONE: Record<"done" | "transit" | "held", { word: string; ink: string; ground: string }> = {
  done: { word: "PAID", ink: GREEN, ground: "rgba(34,197,94,.16)" },
  transit: { word: "IN TRANSIT", ink: "#F59E0B", ground: "rgba(245,158,11,.16)" },
  held: { word: "ON HOLD", ink: "#F87171", ground: "rgba(248,113,113,.16)" },
};
const TINT = DOS_TOOLS.rooms.c;
const dayWords = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${iso.slice(0, 10)}T00:00:00+05:30`));
const shortDay = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso));

export function RentReceivedList({
  payments,
  payerName,
  disputes,
  classes,
}: {
  payments: RentPayment[];
  payerName: string;
  /** the latest dispute per entry — the studio paid rent may dispute an entry (19 Oct 2026) */
  disputes?: Record<string, PaymentDispute>;
  /** the classes this page holds in our rooms, when read */
  classes?: HeldClass[];
}) {
  const total = payments.reduce((n, p) => n + (p.status === "done" ? p.amountInr : 0), 0);
  const pending = payments.reduce((n, p) => n + (p.status !== "done" && p.status !== "failed" ? p.amountInr : 0), 0);
  const linesPaid = payments.reduce((n, p) => n + p.sessions.length, 0);
  const disputed = disputes ? disputedInr(Object.values(disputes).filter((d) => payments.some((p) => p.id === d.rentPaymentId))) : 0;
  return (
    <div style={panel} data-testid="rent-from-renter">
      <FigureHead margin="0 0 10px" title={<span style={head}>RENT FROM {payerName.toUpperCase()}</span>} />
      <ToolFacts
        tint={TINT}
        items={[
          { label: "Received", value: rupees(total), testId: "rent-from-total" },
          { label: payments.length === 1 ? "Payment" : "Payments", value: payments.length },
          { label: linesPaid === 1 ? "Class paid for" : "Classes paid for", value: linesPaid },
        ]}
      />
      {pending > 0 || disputed > 0 ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11.5, fontWeight: 800, margin: "8px 0 0" }}>
          {pending > 0 ? <span style={{ color: "#F59E0B" }}>{rupees(pending)} on its way</span> : null}
          {disputed > 0 ? (
            <span data-testid="rent-from-disputed" style={{ color: "#D97706" }}>
              {rupees(disputed)} disputed
            </span>
          ) : null}
        </div>
      ) : null}

      {classes ? (
        <div data-testid="renter-classes" style={{ marginTop: 14 }}>
          <div style={{ ...head, marginBottom: 4 }}>CLASSES IN YOUR ROOMS · {classes.length}</div>
          {classes.length === 0 ? (
            <div style={{ fontSize: 11.5, color: SUB }}>No class held here now.</div>
          ) : (
            classes.map((c) => (
              <div key={c.classId} style={{ display: "flex", gap: 10, padding: "6px 0", borderTop: "1.5px solid var(--el)", alignItems: "baseline" }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 900, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
                <span style={{ flexShrink: 0, fontSize: 11, color: SUB }}>
                  {c.held} held · {c.upcoming} to come
                  {c.nextAt ? ` · next ${shortDay(c.nextAt)}` : c.lastAt ? ` · last ${shortDay(c.lastAt)}` : ""}
                </span>
              </div>
            ))
          )}
        </div>
      ) : null}

      <div style={{ ...head, margin: "14px 0 2px" }}>PAYMENTS · {payments.length}</div>
      {payments.length === 0 ? (
        <div style={{ fontSize: 11.5, color: SUB, marginTop: 4 }}>No rent recorded yet — the artist records it when they pay you.</div>
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
