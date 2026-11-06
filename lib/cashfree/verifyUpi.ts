import { SecureIdError, isSecureIdConfigured, secureIdFetch, secureIdPublicKeyPem } from "@/lib/cashfree/secureId";
import { normaliseUpiId } from "@/lib/upi/link";

/** DOES THIS UPI ID EXIST, AND WHOSE IS IT? (6 Nov 2026) — asked of Cashfree
 *  Secure ID when a person saves their id, so the owner paying them later can
 *  read the name the bank holds and match it to the person BEFORE the money
 *  goes. Until today the only check was the id's shape.
 *
 *  TWO ROUTES, ONE STRATEGY SWITCH. Cashfree's current catalogue documents
 *  `POST /upi/penny-drop` (v2): synchronous, returns `status` VALID|INVALID and
 *  `name_at_bank`, and it does so by SENDING ONE RUPEE to the id — a real
 *  transfer with a fee, and it wants a `user_consent` block. The older plain
 *  `POST /upi` answers the same question without moving money, with
 *  `account_exists` YES|NO beside `name_at_bank`; it is no longer in the
 *  catalogue, and whether this merchant still has it is only known by asking.
 *  So the route is chosen by CASHFREE_UPI_VERIFY — `plain` (default) or
 *  `penny-drop` — and a plain call that Cashfree says it does not have is
 *  reported as exactly that, never silently swapped for a route that spends.
 *  Both response shapes are read, because the two share most field names.
 *
 *  ⚠ WHAT A FAILURE MEANS, and why the three are kept apart:
 *    `invalid`      — Cashfree looked and the id does not exist. The id is
 *                     REFUSED; nothing is stored.
 *    `unavailable`  — Cashfree could not be asked (second factor not passing,
 *                     the route not on this account, a network fault). The id
 *                     is STORED UNVERIFIED and the reason is said, so a person
 *                     is never locked out of being paid by a configuration
 *                     problem on our side. The owner's sheet then shows it as
 *                     unverified and tells them to read the name in their app.
 *    `verified`     — stored, with the name and Cashfree's reference.
 *
 *  Sandbox fixtures (Cashfree's own list): success@upi · valid@upi · valid@ybl
 *  are VALID; invalid@upi · incorrect@upi · invalid@ybl are INVALID;
 *  expired@upi and friends answer EXPIRED. Any other id FAILS in sandbox — so
 *  a real id typed against sandbox keys reads as unavailable, not as valid. */

export type UpiVerification =
  | { outcome: "verified"; nameAtBank: string | null; reference: string | null }
  | { outcome: "invalid"; reason: string }
  | { outcome: "unavailable"; reason: string; code: string | null };

type Strategy = "plain" | "penny-drop";

export function upiVerifyStrategy(): Strategy {
  return process.env.CASHFREE_UPI_VERIFY === "penny-drop" ? "penny-drop" : "plain";
}

/** Cashfree's two shapes, read as one. Field names are theirs. */
interface CashfreeUpiAnswer {
  status?: string; // VALID | INVALID | SUCCESS | EXPIRED …
  account_exists?: string; // YES | NO (the plain route)
  name_at_bank?: string | null;
  vpa?: string;
  reference_id?: number | string;
  ref_id?: number | string;
  verification_id?: string;
  message?: string;
}

/** Cashfree's `verification_id` grammar: ≤50 of [A-Za-z0-9._-]. Ours names the
 *  person and the second, so a retry is a new lookup and a dispute can find it. */
const verificationIdFor = (userId: string): string => `upi-${userId.replace(/-/g, "").slice(0, 24)}-${Math.floor(Date.now() / 1000)}`;

export async function verifyUpiId(input: { userId: string; upiId: string; expectedName?: string | null }): Promise<UpiVerification> {
  const upiId = normaliseUpiId(input.upiId);
  if (!upiId) return { outcome: "invalid", reason: "That is not a UPI id — it looks like name@bank" };
  if (!isSecureIdConfigured()) {
    return { outcome: "unavailable", reason: "UPI verification is not set up on this server", code: "not_configured" };
  }

  const strategy = upiVerifyStrategy();
  const body: Record<string, unknown> =
    strategy === "penny-drop"
      ? {
          verification_id: verificationIdFor(input.userId),
          vpa: upiId,
          ...(input.expectedName ? { name: input.expectedName.slice(0, 100) } : {}),
          user_consent: {
            obtained: true,
            type: "EXPLICIT",
            timestamp: new Date().toISOString(),
            purpose: "Verify the UPI id a studio may pay this person on, at their request",
          },
        }
      : { vpa: upiId, ...(input.expectedName ? { name: input.expectedName.slice(0, 100) } : {}) };

  let answer: CashfreeUpiAnswer;
  try {
    answer = await secureIdFetch<CashfreeUpiAnswer>(strategy === "penny-drop" ? "/upi/penny-drop" : "/upi", body);
  } catch (error: unknown) {
    if (error instanceof SecureIdError) {
      /* the refusals a person can act on, in our words rather than Cashfree's */
      if (error.code === "ip_validation_failed") {
        return {
          outcome: "unavailable",
          code: error.code,
          reason: secureIdPublicKeyPem()
            ? "Cashfree refused this server's signature — the public key may have been rotated"
            : "Cashfree needs this server whitelisted or a signing key before it will check UPI ids",
        };
      }
      if (error.status === 404 || /not found|no such|does not exist/i.test(error.message)) {
        return {
          outcome: "unavailable",
          code: error.code ?? "route_not_found",
          reason:
            strategy === "plain"
              ? "The plain UPI check is not on this Cashfree account — set CASHFREE_UPI_VERIFY=penny-drop to use the one-rupee check"
              : "Cashfree does not offer UPI penny drop on this account",
        };
      }
      if (error.status === 401 || error.status === 403) {
        return { outcome: "unavailable", code: error.code, reason: "Cashfree refused the verification keys" };
      }
      /* a 4xx with a VPA-shaped complaint is Cashfree saying the id itself is bad */
      if (error.status >= 400 && error.status < 500 && /vpa|upi/i.test(error.message)) {
        return { outcome: "invalid", reason: "Cashfree does not recognise that UPI id" };
      }
      return { outcome: "unavailable", code: error.code, reason: `Cashfree could not check the id (${error.status})` };
    }
    return { outcome: "unavailable", code: null, reason: "Cashfree could not be reached" };
  }

  const status = (answer.status ?? "").toUpperCase();
  const exists = (answer.account_exists ?? "").toUpperCase();
  const name = typeof answer.name_at_bank === "string" && answer.name_at_bank.trim() ? answer.name_at_bank.trim() : null;
  const reference = answer.reference_id != null ? String(answer.reference_id) : answer.ref_id != null ? String(answer.ref_id) : answer.verification_id ?? null;

  if (status === "VALID" || status === "SUCCESS" || exists === "YES") {
    return { outcome: "verified", nameAtBank: name, reference };
  }
  if (status === "INVALID" || exists === "NO") {
    return { outcome: "invalid", reason: "That UPI id does not exist — check it with your UPI app" };
  }
  if (status === "EXPIRED" || status === "PENDING") {
    return { outcome: "unavailable", code: status.toLowerCase(), reason: "Cashfree could not finish checking the id — try again in a minute" };
  }
  return { outcome: "unavailable", code: "unreadable", reason: "Cashfree answered in a shape this app does not read" };
}
