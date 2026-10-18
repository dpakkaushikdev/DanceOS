/** ONE WAY TO WRITE MONEY AND DATES (19 Oct 2026). At least twelve rupee
 *  helpers and thirty-odd date helpers had grown up, so one price read
 *  "₹1500" on a card and "₹1,500" on the page behind it. New code reads these;
 *  old helpers are moved onto them as their screens are touched. All dates are
 *  India time. */

/** "₹1,500" — Indian grouping, whole rupees */
export const rupees = (n: number | null | undefined) => `₹${Math.round(n ?? 0).toLocaleString("en-IN")}`;

/** "Free" for 0, else rupees */
export const priceWord = (n: number | null | undefined) => ((n ?? 0) > 0 ? rupees(n) : "Free");

const IST = "Asia/Kolkata";

/** "23 Sept" — the year only when it is not this one ("23 Sept 2025") */
export function dateWords(iso: string | Date | null | undefined, now: Date = new Date()): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  const year = d.toLocaleString("en-IN", { timeZone: IST, year: "numeric" });
  const thisYear = now.toLocaleString("en-IN", { timeZone: IST, year: "numeric" });
  return d.toLocaleString("en-IN", {
    timeZone: IST,
    day: "numeric",
    month: "short",
    ...(year === thisYear ? {} : { year: "numeric" }),
  });
}

/** "Wed, 23 Sept" */
export function dayDateWords(iso: string | Date | null | undefined, now: Date = new Date()): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  const day = d.toLocaleString("en-IN", { timeZone: IST, weekday: "short" });
  return `${day}, ${dateWords(d, now)}`;
}

/** "6:00 pm" */
export function timeWords(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
}

const METHOD: Record<string, string> = {
  upi: "UPI",
  card: "Card",
  credit_card: "Card",
  debit_card: "Card",
  netbanking: "Net banking",
  net_banking: "Net banking",
  nb: "Net banking",
  wallet: "Wallet",
  app: "Wallet",
  cash: "Cash",
  bank: "Bank transfer",
  bank_transfer: "Bank transfer",
  cardless_emi: "EMI",
  emi: "EMI",
  paylater: "Pay later",
  pass: "Membership",
  membership: "Membership",
  other: "Other",
};

/** a stored payment method as words — never "NET_BANKING" */
export function methodWord(m: string | null | undefined): string {
  if (!m) return "—";
  const k = m.toLowerCase().trim();
  return METHOD[k] ?? k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

const STATUS: Record<string, string> = {
  captured: "Paid",
  paid: "Paid",
  created: "Not paid",
  pending: "On its way",
  pending_payment: "Not paid yet",
  requested: "Asked for",
  processed: "Refunded",
  refunded: "Refunded",
  part_refunded: "Part refunded",
  failed: "Failed",
  declined: "Declined",
  done: "Paid",
  in_transit: "On its way",
  on_hold: "On hold",
  sent: "Sent",
  accepted: "Accepted",
  superseded: "Replaced",
  refused: "Refused",
  open: "Open",
  withdrawn: "Withdrawn",
  cancelled: "Cancelled",
  canceled: "Cancelled",
  active: "Active",
  expired: "Ended",
  used_up: "Used up",
};

/** a stored status as words */
export function statusWord(s: string | null | undefined): string {
  if (!s) return "—";
  const k = s.toLowerCase().trim();
  return STATUS[k] ?? k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
