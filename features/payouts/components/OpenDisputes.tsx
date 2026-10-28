import Link from "next/link";
import { SectionCard } from "@/components/ui/SectionCard";
import { rupees } from "@/lib/format/money";
import { INK, SUB } from "@/lib/design/tokens";
import type { OpenDisputeRow } from "@/repositories/disputes";

const AMBER = "#F59E0B";

/** OPEN DISPUTES · N, ON EARNINGS (28 Oct 2026, the user's batch 4). Every open
 *  dispute on money this profile paid or received — what was paid against what
 *  is claimed, who raised it — each row the door to the detail page of the entry
 *  it is about, where it is answered. ⚠ Not drawn when there is none. */
export function OpenDisputes({ rows }: { rows: OpenDisputeRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <SectionCard icon={<span aria-hidden="true">⚑</span>} label={`Open disputes · ${rows.length}`} col={AMBER} testId="earn-open-disputes">
        {rows.map((d) => (
          <Link
            key={d.id}
            href={d.href}
            data-testid="earn-open-dispute"
            aria-label={`${d.about} — disputed by ${d.raisedByName}, open it`}
            style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderTop: "1.5px solid var(--el)", textDecoration: "none", color: INK, minHeight: 40 }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 12.5, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.about}</span>
              <span style={{ display: "block", fontSize: 11, color: SUB, marginTop: 2 }}>
                Raised by {d.raisedByName} · Paid {rupees(d.paidInr)}
                {d.claimedInr !== null ? ` · Claimed ${rupees(d.claimedInr)}` : " · The whole entry"}
              </span>
            </span>
            <span aria-hidden="true" style={{ fontSize: 14, color: SUB }}>
              ›
            </span>
          </Link>
        ))}
      </SectionCard>
    </div>
  );
}
