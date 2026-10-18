import { DOS_TOOLS } from "@/features/businesses/components/biz-kit";
import { ToolBody, ToolCard, ToolFacts, ToolHead } from "@/components/ui/ToolCard";
import { FigureHead } from "@/components/ui/FigureHead";
import { INK, MUTED } from "@/lib/design/tokens";

/** THE ARTISTS WHO RENT THIS STUDIO'S ROOMS, AS CARDS WITH NO MONEY (19 Oct 2026,
 *  the user: "rent received for studio team section should be inside team detail
 *  for that specific person … payments should not be visible outside"). One card
 *  per artist page that holds classes here and is NOT on this team — a renter on
 *  the team is their own Team card, whose Member Detail page carries a Rent
 *  column. The card says how many classes, never rupees; the rent itself is on
 *  the page it opens (`/business/{id}/renters/{payer}`). */

export interface RenterSummary {
  payerBusinessId: string;
  /** the artist page's name */
  payerName: string;
  /** the person who owns that page, when it could be read */
  ownerName: string | null;
  photoPath: string | null;
  /** accepted classes this page holds in our rooms */
  classes: number;
  /** where the rent lives */
  href: string;
}

const TINT = DOS_TOOLS.rooms.c;

export function RentersOnDesk({ renters }: { renters: RenterSummary[] }) {
  if (renters.length === 0) return null;
  return (
    <section data-testid="rent-renters" style={{ marginBottom: 16 }}>
      <FigureHead
        align="center"
        margin="2px 0 7px"
        title={
          <>
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 4, background: TINT, flexShrink: 0 }} />
            <span style={{ fontSize: 10.5, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: INK }}>Renting your rooms</span>
          </>
        }
        figure={<span style={{ fontSize: 10.5, fontWeight: 800, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{renters.length}</span>}
      />
      {renters.map((r) => (
        <ToolCard key={r.payerBusinessId} href={r.href} hrefLabel={`Rent from ${r.payerName}`}>
          <ToolHead tint={TINT} name={r.ownerName ?? r.payerName} photoPath={r.photoPath} eyebrow="ARTIST · RENTS YOUR ROOMS" sub={r.ownerName && r.ownerName !== r.payerName ? r.payerName : null} />
          <ToolBody>
            <ToolFacts tint={TINT} items={[{ label: r.classes === 1 ? "Class here" : "Classes here", value: r.classes, testId: "renter-classes" }]} />
          </ToolBody>
        </ToolCard>
      ))}
    </section>
  );
}
