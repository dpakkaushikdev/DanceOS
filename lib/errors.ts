/** PLAIN ERRORS (19 Oct 2026). Many refusals in this app are written in the
 *  database's own careful words and should reach the user as they are ("This
 *  class is full"). What must never reach them is a machine sentence — a
 *  constraint name, a PostgREST code, a raw SDK exception, or the internal
 *  nouns (tenant, claim, lead, register) the schema still uses.
 *
 *  `plainError` keeps a human sentence, rewrites the internal nouns, and
 *  replaces anything technical with one calm line. `toast.error` runs every
 *  message through it, so screens get this for free. */

export const GENERIC_ERROR = "Something went wrong — please try again.";

const TECHNICAL = [
  /violates\b/i,
  /\bconstraint\b/i,
  /\bcolumn\b/i,
  /\brelation\b/i,
  /\bfunction\b.*\b(does not exist|not found)/i,
  /\bPGRST\d+/i,
  /\bJWT\b/i,
  /\buuid\b/i,
  /syntax error/i,
  /null value/i,
  /permission denied/i,
  /row-level security/i,
  /duplicate key/i,
  /\bfetch failed\b/i,
  /failed to fetch/i,
  /network ?error/i,
  /\bECONN[A-Z]+\b/,
  /\bstack\b|\bat .+\.(t|j)sx?:\d+/i,
  /^invalid [a-z ]+$/i,
  /\bundefined\b|\bnull\b/,
  /\b(status|code) \d{3}\b/i,
  /\b[a-z]+_[a-z_]+\b/, // a snake_case identifier
];

const NOUNS: [RegExp, string][] = [
  [/\btenants\b/gi, "studios"],
  [/\btenant\b/gi, "studio"],
  [/\bbusinesses\b/gi, "studios"],
  [/\bbusiness\b/gi, "studio"],
  [/\bclaims\b/gi, "requests"],
  [/\bclaim\b/gi, "request"],
  [/\bthis register\b/gi, "this attendance list"],
  [/\bthe register\b/gi, "attendance"],
  [/\bregister\b/gi, "attendance"],
  [/\bseats\b/gi, "spots"],
  [/\bseat\b/gi, "spot"],
  [/\bthe rail\b/gi, "online payments"],
  [/\bsettled\b/gi, "paid"],
  [/\bsettle\b/gi, "pay"],
];

export function plainError(msg: string | null | undefined): string {
  const raw = (msg ?? "").trim();
  if (!raw) return GENERIC_ERROR;
  if (raw.length > 220) return GENERIC_ERROR;
  if (TECHNICAL.some((re) => re.test(raw))) return GENERIC_ERROR;
  let out = raw;
  for (const [re, word] of NOUNS) out = out.replace(re, word);
  out = out.charAt(0).toUpperCase() + out.slice(1);
  return out;
}

/** an upload failure is always the same sentence — Storage's own text
 *  ("The resource already exists", "mime type … is not supported") is not
 *  something a dancer can act on */
export const UPLOAD_ERROR = "That file could not be uploaded — try again.";
export const PAYMENT_ERROR = "The payment could not be started — try again.";
