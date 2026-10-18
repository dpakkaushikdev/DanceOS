/** Step 13 money. A payout is a RECORD of a settlement the studio already made,
 *  not a payment instrument — "a studio pays its faculty; DanceOS is not the
 *  thing that runs the payroll" (prototype, where S_payroll was deleted). What
 *  this data feeds is the earnings screen's own two halves: the studio's session
 *  pay ledger, and the artist's "WHO HAS PAID YOU" (S_earn dosEarnPayouts). */

export type PayoutStatus = "done" | "in_transit" | "on_hold" | "failed";
export type PayoutMethod = "bank_transfer" | "upi" | "cash" | "other";

/** The prototype paints a payout row by three states only (GREEN/GOLD/RED,
 *  S_earn 18196): done, transit, everything else. */
export const payoutTone = (status: PayoutStatus): "done" | "transit" | "held" =>
  status === "done" ? "done" : status === "in_transit" ? "transit" : "held";

export const PAYOUT_METHOD_LABEL: Record<PayoutMethod, string> = {
  bank_transfer: "Bank transfer",
  upi: "UPI",
  cash: "Cash",
  other: "Other",
};

export const PAYOUT_STATUS_LABEL: Record<PayoutStatus, string> = {
  done: "done",
  in_transit: "in transit",
  on_hold: "on hold",
  failed: "failed",
};

/** ⚠ PAY IS SET WHEN PAYING (18 Oct 2026, the user: "no other way to set price
 *  from somewhere else it should happen only from the team section when going to
 *  pay that particular person or studio"). Nothing here carries a rate any more:
 *  an item is a class session or an enquiry that is NOT YET SETTLED, and the
 *  amount for it is typed in the pay sheet. */

/** One class session somebody took and has not been settled for. */
export interface PayableSession {
  sessionId: string;
  classId: string;
  classTitle: string;
  classStyle: string;
  startsAt: string;
}

/** One enquiry somebody worked on as a TEAM member (never a participant) and has
 *  not been settled for (18 Oct 2026, the user: "should also show list of
 *  enquiries they have worked on in an enquiry as a team member"). */
export interface PayableEnquiry {
  enquiryId: string;
  label: string;
  /** their role on the job, when one was given */
  role: string | null;
  at: string;
}

/** What one person has done for one studio that is not settled, and what they
 *  have been paid. */
export interface PersonPayLedger {
  userId: string;
  personName: string;
  /** Their most recent job on this studio's classes. */
  kind: "artist" | "assistant" | "team";
  /** Ended, unsettled class sessions. */
  unpaid: PayableSession[];
  /** Enquiries they were on the team of, unsettled. */
  unpaidEnquiries: PayableEnquiry[];
  /** classes + enquiries still to settle */
  unsettledCount: number;
  paidInr: number;
  paidSessions: number;
  /** True once they are off the team: still to settle, but no longer accruing. */
  offTeam: boolean;
}

export interface PayoutRecord {
  id: string;
  userId: string;
  personName: string;
  amountInr: number;
  status: PayoutStatus;
  method: PayoutMethod;
  providerRef: string | null;
  paidOn: string;
  note: string | null;
  sessionCount: number;
}

/** The studio owner's side of the Team desk. */
export interface BusinessPayLedger {
  people: PersonPayLedger[];
  /** classes + enquiries not yet settled, across the team */
  unsettledCount: number;
  paidTotal: number;
  inTransitTotal: number;
  /** every payment, with what it covered — the settled history */
  payouts: PayoutWithSessions[];
  /** ⚠ false when one of this read's four guards was filled (21 Sep 2026): the
   *  totals above are then SHORT, and the desk says so rather than printing a
   *  figure that looks finished — the rule the income side has followed since
   *  28 Aug and this half did not. */
  complete: boolean;
}

/** ONE PAYMENT ON THE HISTORY PAGE (29 Sep 2026, the user: "Team payment
 *  history to be a button called History which should show all transactions
 *  with that particular person on a different page").
 *
 *  A `PayoutRecord` says a payment happened and how many sessions it covered;
 *  this says WHICH — because on a page whose whole job is one person's history,
 *  "3 sessions" is the number you would then go looking for the detail of. */
export interface PayoutWithSessions extends PayoutRecord {
  sessions: Array<{ sessionId: string; classTitle: string; startsAt: string; rateInr: number }>;
  /** the enquiries it covered (18 Oct 2026) */
  enquiries: Array<{ enquiryId: string; label: string; rateInr: number }>;
}

/** Everything one business has paid one person, for that person's own page. */
export interface PersonPayHistory {
  userId: string;
  personName: string;
  payouts: PayoutWithSessions[];
  /** settled — what the studio has actually handed over */
  paidInr: number;
  /** recorded but not yet landed (in transit / on hold / failed) */
  pendingInr: number;
  /** sessions covered across every payment */
  sessionsPaid: number;
  /** ⚠ false when the read's guard was filled — the totals are then SHORT, and
   *  the page says so rather than printing a figure that looks finished (the
   *  rule both earnings halves have followed since 21 Sep 2026). */
  complete: boolean;
}

/** One studio's line on a teacher's own Other Teams screen. ⚠ NO "DUE" FIGURE
 *  (18 Oct 2026): a rate is set only when the studio pays, so what is owed in
 *  rupees is not known until then — only HOW MANY classes are not yet settled. */
export interface StudioEarning {
  businessId: string;
  businessName: string;
  /** sessions taken there */
  sessions: number;
  /** sessions + enquiries there not yet settled */
  unsettled: number;
  /** what this studio has settled against classes or enquiries */
  paidInr: number;
  /** ⚠ WHAT IT PAID THAT WAS NOT FOR SESSIONS (20 Sep 2026) — `record_team_payment`
   *  writes a payout with an amount the owner states and NO session lines, which
   *  is the only kind a front-desk seat ever gets (19 Sep, R35). It used to be
   *  summed into `paidInr` with everything else, so a ₹2,500 salary silently
   *  cancelled ₹2,500 of teaching money the studio still owed — and if the person
   *  taught nothing there, the studio had no row at all and the payment vanished
   *  from the Settled tile while still showing in WHO HAS PAID YOU. Its own
   *  figure now, netted against nothing. */
  otherPaidInr: number;
}

/** The teacher's side of the same screen. */
export interface MyEarnings {
  studios: StudioEarning[];
  paidTotal: number;
  unsettledTotal: number;
  /** every payment to you, with what it covered — settled history */
  payouts: Array<PayoutWithSessions & { businessId: string; businessName: string }>;
}

/** ── RENT (18 Oct 2026): an artist's page paying the studio it holds classes in. */
export interface RentPayment {
  id: string;
  payerBusinessId: string;
  payerName: string;
  venueBusinessId: string;
  venueName: string;
  amountInr: number;
  status: PayoutStatus;
  method: PayoutMethod;
  providerRef: string | null;
  paidOn: string;
  note: string | null;
  sessions: Array<{ sessionId: string; classTitle: string; startsAt: string; rateInr: number }>;
}

/** One studio an artist's page holds classes in: what is not yet paid for, and
 *  what has been. Rent can be paid AHEAD (the user's answer), so `unpaid` holds
 *  past and upcoming sessions alike. */
export interface RentVenue {
  venueBusinessId: string;
  venueName: string;
  unpaid: PayableSession[];
  payments: RentPayment[];
  paidInr: number;
}

/** A pay line as the sheet sends it: a class session or an enquiry, at an amount. */
export type PayLine = { sessionId: string; rateInr: number } | { enquiryId: string; rateInr: number };
