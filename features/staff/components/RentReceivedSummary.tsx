import Link from "next/link";
import { bizCard } from "@/features/crews/components/crew-kit";
import { money as rupees } from "@/features/payouts/components/earnings-kit";
import { DOS_TOOLS } from "@/features/businesses/components/biz-kit";
import { toolBtn } from "@/components/ui/ToolCard";
import { FigureHead } from "@/components/ui/FigureHead";
import { INK, SUB } from "@/lib/design/tokens";

/** RENT RECEIVED, AS A SUMMARY (19 Oct 2026, the user: "rent received in studio
 *  should also be handled inside the person whom it is received from", and
 *  "make sure things aren't repeated"). The Team desk says how many payments and
 *  how much, one line per renter, and a door — the payments themselves are on the
 *  renter's own page (their Member Detail page's Rent column when they are on the
 *  team, else `/business/{id}/renters/{payer}`). Never the list a second time. */

export interface RenterSummary {
  payerBusinessId: string;
  /** the artist page's name */
  payerName: string;
  /** rent payments recorded (any state) */
  count: number;
  /** settled rupees */
  paidInr: number;
  /** where the full list lives */
  href: string;
}

const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 900, letterSpacing: 1, color: SUB, textTransform: "uppercase" };

export function RentReceivedSummary({ renters }: { renters: RenterSummary[] }) {
  if (renters.length === 0) return null;
  const count = renters.reduce((n, r) => n + r.count, 0);
  const total = renters.reduce((n, r) => n + r.paidInr, 0);
  const tint = DOS_TOOLS.rooms.c;
  return (
    <section data-testid="rent-received" style={{ ...bizCard, marginBottom: 16 }}>
      <FigureHead
        margin="0 0 6px"
        title={<span style={head}>Rent received · {count}</span>}
        figure={<b style={{ fontSize: 14, color: INK, fontVariantNumeric: "tabular-nums" }}>{rupees(total)}</b>}
      />
      {renters.map((r) => (
        <div key={r.payerBusinessId} data-testid="rent-renter" style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "1.5px solid var(--el)", padding: "8px 0 2px" }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 12.5, fontWeight: 900, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.payerName}</span>
            <span style={{ display: "block", fontSize: 10.5, color: SUB, marginTop: 1 }}>
              {r.count} {r.count === 1 ? "payment" : "payments"} · {rupees(r.paidInr)}
            </span>
          </span>
          <Link href={r.href} aria-label={`Rent from ${r.payerName}`} style={{ ...toolBtn("tinted", tint), flex: "0 0 auto" }}>
            Detail ›
          </Link>
        </div>
      ))}
    </section>
  );
}
