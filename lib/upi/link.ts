/** A UPI ID AND THE LINK THAT PAYS IT (2 Nov 2026, the user: "first fix the
 *  teams payment option").
 *
 *  The studio stays the payer. DanceOS builds the `upi://pay` link, the owner's
 *  own UPI app moves the money, and the payout DanceOS recorded a moment
 *  earlier is the link's transaction reference — so a bank statement and the
 *  DanceOS record name the same thing. No Cashfree, no vendor, no KYC. */

/** name@bank — NPCI's VPA grammar, case-insensitive; stored lower-case. The
 *  same expression as the database's CHECK; 255 is Postgres's repetition cap. */
export const UPI_ID_SHAPE = /^[a-z0-9.\-_]{2,255}@[a-z]{2,64}$/i;

export const UPI_ID_ERROR = "That is not a UPI id — it looks like name@bank";

/** The id as stored: trimmed and lower-cased, or null when it is not one. */
export function normaliseUpiId(raw: string): string | null {
  const id = raw.trim().toLowerCase();
  return UPI_ID_SHAPE.test(id) ? id : null;
}

const PAYEE_NAME_MAX = 50;
const NOTE = "DanceOS team pay";
/** `pn` is mandatory in NPCI's grammar: a name with no Latin letters strips to
 *  nothing, and some apps refuse a link without one */
const FALLBACK_PAYEE = "DanceOS team member";

/** The link a UPI app opens. `pn` is the payee's name limited to the characters
 *  every app accepts; `tr` is the payout id without its dashes.
 *  ⚠ PERCENT-ENCODED BY HAND, not URLSearchParams: that is form encoding, which
 *  writes a space as `+`, and iOS UPI apps do not read `+` back as a space — the
 *  note would arrive as "DanceOS+team+pay". `%20` reads the same everywhere. */
export function upiPayLink(p: { upiId: string; payeeName: string; amountInr: number; payoutId: string }): string {
  const name = p.payeeName.replace(/[^A-Za-z0-9 .]/g, "").trim().slice(0, PAYEE_NAME_MAX) || FALLBACK_PAYEE;
  const fields: Array<[string, string]> = [
    ["pa", p.upiId],
    ["pn", name],
    ["am", p.amountInr.toFixed(2)],
    ["cu", "INR"],
    ["tn", NOTE],
    ["tr", p.payoutId.replace(/-/g, "")],
  ];
  return `upi://pay?${fields.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}
