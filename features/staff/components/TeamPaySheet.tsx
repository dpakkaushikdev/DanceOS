"use client";

import { SettleSheet } from "@/features/payouts/components/SettleSheet";
import { recordSessionPaymentAction } from "@/features/payouts/server-actions/payouts";
import { payTeamMemberAction } from "@/features/staff/server-actions/staff";
import { money as rupees } from "@/features/payouts/components/earnings-kit";
import { sessionDayLabel } from "@/lib/format/session";
import type { PersonPayLedger } from "@/types/payout";

/** PAY ONE TEAM MEMBER — the Team desk card's Pay sheet, lifted out so the
 *  Member Detail page's To settle column opens the SAME flow (19 Oct 2026, the
 *  user: "handle team detail pages better with everything inside that"). One
 *  implementation, two doors: the unsettled sessions and enquiries arrive ticked,
 *  the amount is typed here, and a payment against no session is the amount-only
 *  path (`record_team_payment`, R35). */
export function TeamPaySheet({
  businessId,
  person,
  ledger,
  tint,
  onClose,
  onDone,
}: {
  businessId: string;
  person: { userId: string; name: string; avatarPath: string | null };
  /** what is not settled for this person — null reads as nothing */
  ledger: Pick<PersonPayLedger, "unpaid" | "unpaidEnquiries"> | null;
  tint: string;
  onClose: () => void;
  /** after a payment landed — the words to say, and the caller closes/refreshes */
  onDone: (words: string) => void;
}) {
  return (
    <SettleSheet
      title={`Pay ${person.name}`}
      face={{ name: person.name, photoPath: person.avatarPath }}
      tint={tint}
      itemsHead="NOT SETTLED YET"
      emptyWords="Nothing they taught or worked on is waiting to be settled."
      items={[
        ...(ledger?.unpaid ?? []).map((s) => ({ id: s.sessionId, kind: "session" as const, title: s.classTitle, sub: sessionDayLabel(s.startsAt) })),
        ...(ledger?.unpaidEnquiries ?? []).map((e) => ({ id: e.enquiryId, kind: "enquiry" as const, title: e.label, sub: e.role ? `As ${e.role}` : "On the team" })),
      ]}
      onClose={onClose}
      onSettle={async (lines, meta) => {
        const out = await recordSessionPaymentAction({ businessId, userId: person.userId, lines, ...meta });
        if (!out.error) onDone(`${rupees(lines.reduce((n, l) => n + l.rateInr, 0))} recorded for ${person.name}`);
        return out;
      }}
      onAmountOnly={async (amountInr, meta) => {
        const note = [meta.note, meta.providerRef ? `Ref ${meta.providerRef}` : null].filter(Boolean).join(" · ") || null;
        const out = await payTeamMemberAction({ businessId, userId: person.userId, amountInr, method: meta.method, status: meta.status, paidOn: meta.paidOn, note });
        if (!out.error) onDone(`${rupees(amountInr)} recorded for ${person.name}`);
        return out;
      }}
    />
  );
}
