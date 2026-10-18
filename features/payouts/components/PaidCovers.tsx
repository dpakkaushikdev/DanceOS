import { DOS_UI, SUB } from "@/lib/design/tokens";
import { money } from "@/features/payouts/components/earnings-kit";
import { sessionDayLabel as formatSessionDate } from "@/lib/format/session";

/** WHAT ONE PAYMENT COVERED (18 Oct 2026, the user: "should also show history of
 *  payments what is already settled"): each class session and each enquiry, at
 *  the amount it was paid at. One component for the payer's history and the
 *  payee's, so the two cannot describe one payment differently. */
type Covers = {
  sessions: Array<{ sessionId: string; classTitle: string; startsAt: string; rateInr: number }>;
  enquiries?: Array<{ enquiryId: string; label: string; rateInr: number }>;
};

export const coveredWords = (p: Covers): string => {
  const s = p.sessions.length;
  const e = p.enquiries?.length ?? 0;
  if (s === 0 && e === 0) return "not for a class";
  const parts = [];
  if (s) parts.push(`${s} class${s === 1 ? "" : "es"}`);
  if (e) parts.push(`${e} enquir${e === 1 ? "y" : "ies"}`);
  return parts.join(" · ");
};

export function PaidCovers({ sessions, enquiries = [] }: Covers) {
  if (sessions.length === 0 && enquiries.length === 0) return null;
  return (
    <ul data-testid="paid-covers" style={{ listStyle: "none", margin: "0 0 8px", padding: "0 0 0 10px", fontFamily: DOS_UI }}>
      {sessions.map((s) => (
        <li key={s.sessionId} style={{ display: "flex", gap: 8, fontSize: 11.5, color: SUB, padding: "2px 0" }}>
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {s.classTitle}
            {s.startsAt ? ` · ${formatSessionDate(s.startsAt)}` : ""}
          </span>
          <b>{money(s.rateInr)}</b>
        </li>
      ))}
      {enquiries.map((e) => (
        <li key={e.enquiryId} style={{ display: "flex", gap: 8, fontSize: 11.5, color: SUB, padding: "2px 0" }}>
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.label}</span>
          <b>{money(e.rateInr)}</b>
        </li>
      ))}
    </ul>
  );
}
