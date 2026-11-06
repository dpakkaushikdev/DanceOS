import { createPublicKey, publicEncrypt, constants as cryptoConstants } from "node:crypto";

/** CASHFREE SECURE ID — the verification suite, server-side only (6 Nov 2026).
 *
 *  A different product from the Payment Gateway (`api.ts`) and a different key
 *  pair: the PG keys answer 404 "something went wrong" on every verification
 *  route, while the PAYOUT client id and secret — which begin `CF`, the Secure
 *  ID shape — are accepted and refused only on second-factor grounds. So the
 *  payout pair is the Secure ID pair on this merchant, and that is what is
 *  read here.
 *
 *  ⚠ TWO-FACTOR IS MANDATORY AND CANNOT BE SWITCHED OFF, in sandbox too
 *  ("Because of product architecture limitations, you can't disable 2FA in
 *  any environment, including sandbox"). The two factors Cashfree offers:
 *    · IP whitelisting — up to 25 static IPv4 addresses, no CIDR. Useless for
 *      Vercel, whose functions have no fixed egress address.
 *    · A PUBLIC-KEY SIGNATURE — the merchant generates a key pair in the
 *      dashboard (Secure ID → Developers → Two-Factor Authentication),
 *      downloads the public .pem ONCE, and every request carries
 *      `X-Cf-Signature` = base64( RSA-OAEP-SHA1( "<clientId>.<unix seconds>" ) ).
 *      Valid for about five minutes; a fresh one is minted per request.
 *  This file implements the second, because it is the only one that works
 *  from a serverless host. The PEM arrives through CASHFREE_SECURE_ID_PUBLIC_KEY;
 *  when it is unset the request goes without a signature and Cashfree answers
 *  `ip_validation_failed`, which is mapped to a sentence rather than hidden.
 *
 *  Hosts: `https://sandbox.cashfree.com/verification` and
 *  `https://api.cashfree.com/verification`, picked by CASHFREE_ENV exactly as
 *  `api.ts` picks the PG host. */

const API_VERSION = "2022-09-13";

export type SecureIdMode = "sandbox" | "production";

export function secureIdMode(): SecureIdMode {
  return process.env.CASHFREE_ENV === "production" ? "production" : "sandbox";
}

export const secureIdBase = (): string =>
  secureIdMode() === "production" ? "https://api.cashfree.com/verification" : "https://sandbox.cashfree.com/verification";

function clientId(): string {
  const id = process.env.CASHFREE_PAYOUT_CLIENT_ID;
  if (!id) throw new Error("CASHFREE_PAYOUT_CLIENT_ID is not configured");
  return id;
}

function clientSecret(): string {
  const s = process.env.CASHFREE_PAYOUT_CLIENT_SECRET;
  if (!s) throw new Error("CASHFREE_PAYOUT_CLIENT_SECRET is not configured");
  return s;
}

/** The Secure ID product is usable at all — the keys exist. Whether the second
 *  factor will pass is only known by asking. */
export function isSecureIdConfigured(): boolean {
  return Boolean(process.env.CASHFREE_PAYOUT_CLIENT_ID && process.env.CASHFREE_PAYOUT_CLIENT_SECRET);
}

/** The public key, as the dashboard hands it out. An env file cannot hold a
 *  real newline, so the PEM is usually stored with `\n` sequences; both shapes
 *  are accepted. Null when no key is configured. */
export function secureIdPublicKeyPem(): string | null {
  const raw = process.env.CASHFREE_SECURE_ID_PUBLIC_KEY?.trim();
  if (!raw) return null;
  const pem = raw.replace(/\\n/g, "\n").replace(/^"|"$/g, "");
  return pem.includes("-----BEGIN") ? pem : null;
}

/** `X-Cf-Signature` for one request: RSA-OAEP with SHA-1 over
 *  "<clientId>.<unix seconds>", base64. SHA-1 is what Cashfree's verifier
 *  expects — it is OAEP's mask/label hash here, not a signature over user data,
 *  so the choice is theirs to make and ours to match.
 *
 *  Exported with the pieces injectable so the self-test can prove the crypto
 *  path with a throwaway key pair, without a merchant key on this machine. */
export function secureIdSignature(input: { clientId: string; publicKeyPem: string; unixSeconds?: number }): string {
  const ts = input.unixSeconds ?? Math.floor(Date.now() / 1000);
  const key = createPublicKey(input.publicKeyPem);
  const encrypted = publicEncrypt(
    { key, padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha1" },
    Buffer.from(`${input.clientId}.${ts}`, "utf8")
  );
  return encrypted.toString("base64");
}

/** Every header a Secure ID call carries. The signature is added only when a
 *  public key is configured; without it the call still goes, so the refusal
 *  Cashfree answers with (`ip_validation_failed`) reaches the caller as a
 *  diagnosable error instead of a silent "not configured". */
export function secureIdHeaders(): Record<string, string> {
  const id = clientId();
  const headers: Record<string, string> = {
    "x-client-id": id,
    "x-client-secret": clientSecret(),
    "x-api-version": API_VERSION,
    "Content-Type": "application/json",
    "User-Agent": "DanceOS/1.0 (+https://danceos-sigma.vercel.app)",
  };
  const pem = secureIdPublicKeyPem();
  if (pem) headers["X-Cf-Signature"] = secureIdSignature({ clientId: id, publicKeyPem: pem });
  return headers;
}

/** Cashfree's refusal, kept whole: the `code` is what decides the sentence
 *  shown, the `message` is what goes in a log. */
export class SecureIdError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | null,
    message: string
  ) {
    super(message);
    this.name = "SecureIdError";
  }
}

export async function secureIdFetch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${secureIdBase()}${path}`, {
    method: "POST",
    headers: secureIdHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* a non-JSON body: the status is the story */
  }
  if (!res.ok) {
    const j = (json ?? {}) as { code?: string; message?: string; type?: string };
    throw new SecureIdError(res.status, j.code ?? null, j.message ?? `HTTP ${res.status}`);
  }
  return json as T;
}
