/* THE ONE LIST OF WHAT A PROOF, A SHOOT OR AN E2E RUN LEAVES BEHIND (10 Oct 2026).
 *
 * Until today cleanup-proof-leftovers.js and remove-accounts.js each carried their
 * own copy of these patterns, and the copies had drifted: remove-accounts knew 21
 * prefixes and the cleanup 37, and BOTH missed a dozen families the newer scripts
 * mint (refproof-, payproof-, earnproof-, memproof-, income-, ntf-, media-, p2-,
 * layoutproof-, tc-, sv-a-/sv-b-, pilot<stamp>, money., inbox., earn., hero-,
 * prac.), plus business names like "Col Studio", "P2 Studio", "Kappa Hall". And
 * `Zq)\b` never matched "Zq204512 Studio" - the digits sit between "Zq" and the
 * word boundary - so every search-proof leftover was invisible to the sweep.
 *
 * Every pattern here was read off the script that makes the row (grep
 * `@example.com`, `New-Studio`, `p_name`, `name:` across scripts/, scripts/shots/
 * and e2e/), not guessed. Add the next family HERE, in the same push as the
 * script that starts minting it.
 *
 * ⚠ THE RAIL: every throwaway account is `@example.com`, and a real person never
 * is, so however broad a prefix looks it cannot reach one. `demo.*` is anchored
 * separately by isDemo() and is never matched by JUNK_EMAIL.
 */
"use strict";

/* hyphenated families: the PowerShell proofs and the e2e suites */
const HYPHEN_PREFIXES = [
  "ev", "mng", "pp", "follow", "srch", "e2e", "prof", "st", "stats", "crew", "evt", "enq", "mgd",
  "pay", "rf", "wh", "inv", "cls", "near", "sl", "mod", "panel", "shots", "orghome", "proof", "att",
  "set", "rooms", "leads", "enroll", "ratecheck", "sv-admin", "sv-a", "sv-b", "staffproof", "em", "look",
  "refproof", "payproof", "earnproof", "memproof", "income", "ntf", "media", "p2", "layoutproof",
  "tc", "hero", "friend", "planted", "sneak", "prac",
];
/* dotted families: the browser shoot scripts */
const DOT_PREFIXES = ["shot", "tiles", "money", "inbox", "earn", "prac"];

const esc = (s) => s.replace(/[-.]/g, (c) => `\\${c}`);
const JUNK_EMAIL = new RegExp(
  `^((${HYPHEN_PREFIXES.map(esc).join("|")})-[^@]*|(${DOT_PREFIXES.map(esc).join("|")})\\.[^@]*|pilot\\d+)@example\\.com$`,
  "i"
);

/* profile names that mark a very early test account with no tell-tale email */
const JUNK_NAMES = new Set(["Studio Test", "Priya Test"]);

/* THE BUSINESSES THE SCRIPTS NAME, verbatim. A name match alone is never enough:
   a caller must also require a test owner (a junk email, a kept test phone or, for
   the sweep, a demo account), so a real business can never be caught by its name. */
const JUNK_TENANT_NAME = new RegExp(
  "^(" +
    [
      "Webhook Proof Studio", "Enroll Studio", "Managed [AB]", "Near Studio", "Event Proof Studio",
      "Rival Studio", "Rooms Proof Studio", "Leads Proof Studio", "Class Studio", "Att Proof Studio",
      "Pay Proof Studio", "Refund Proof Studio", "Crew Proof Studio", "Follow Proof Studio", "Media Studio",
      "Notif Proof Studio", "Stat Proof Studio", "Income Proof Studio", "Settings Proof Studio",
      "Slug Proof Studio", "Enquiry Proof Studio", "Earn Proof Studio", "Staff Proof Studio",
      "PP (Listed|Private) Studio", "Private Studio", "Other Studio", "Artist Business", "Studio [AB]",
      "Mandate (Test|Proof)( Studio)?", "Mod (Studio|Org)", "E2E (Studio|Owner)",
      "Shot (Verify Studio|New Studio|Studio|Org|Owner)", "Timeline Test",
      "Col Studio", "P2 Studio", "MemProof( Rival)? Studio", "Prof Studio", "SV Studio",
      "Panel (Studio|Org|Bystander)", "Cls (Studio|Asker)", "Founder Studio", "Disc Studio",
      "(Omega|Kappa|Lambda) Hall", "Reg Studio", "Seat Studio", "Tiles( Own)? Studio", "Earn Studio",
      "Zq\\d*",
      /* the e2e names since NAME_MAX (19 Oct 2026, every name ≤ 15 characters) */
      "E2E S", "Mod St", "Panel [SOB]", "WH [SM]",
      /* the PowerShell proofs' studios since NAME_MAX: "<abbrev> Std <HHmmss>" */
      "(Cls|Att|Fin|Enrl|Earn|Rivl|Enq|Priv|Crew|Med|Lead|Ntf|Fol|Pay|Near|Mem|MemR|PPL|PPP|Prof|P2|Rfnd|Room|Othr|Slug|Stf|Set|Stat|SV|Inc|Col|BizA|BizB) Std2?",
      "Fin Page", "Art Biz",
      /* the browser shoots' studios since NAME_MAX */
      "(Seat|Shot|T|Fnd|Land|Ver|Disc|Reg) Std", "(Cls|T|Kap|Om|Mu|Lam|Job) Hall", "EEE (Hero|App) Studio",
    ].join("|") +
    ")\\b",
  "i"
);

/* ⚠ NAMES A SCRIPT USES THAT ARE ALSO A REAL DEMO-WORLD BUSINESS. shoot-hero and
   shoot-app create "EEE Dance Studio" - and so does demo-data.js. Only a JUNK-EMAIL
   owner (never a demo account, never a kept phone) makes one of these a leftover.
   19 Oct 2026 (NAME_MAX, every name ≤ 15 characters): the demo world's is "EEE
   Studio" under "EEE Dance Co" now, so the short forms are matched too. */
const JUNK_OWNER_ONLY_NAME = /^EEE (Dance (Studio|Company|Co)|Studio)\b/i;

const JUNK_CREW_NAME = new RegExp(
  "^(" +
    [
      "E2E Crew", "Proof Crew", "Crew Proof", "Shot Crew", "Shot Leave Crew", "Tiles Crew", "Media Crew",
      "PP Crew", "Prof Crew", "P2 Crew", "Stat Crew", "Disc Crew", "Founder Crew", "Mu Crew", "Prac Crew",
      "E2E C", /* the e2e crew since NAME_MAX (19 Oct 2026) */
      "Prf Crew", "Med Crew", "Stt Crew", "PrP Crew", /* the proofs' crews since NAME_MAX */
      "Fnd Crew", "Leave Cr", "Disc Cr", "P Crew", "Nu Crew", /* the shoots' crews since NAME_MAX */
      "Zq\\d*",
    ].join("|") +
    ")\\b",
  "i"
);

/* the two Supabase TEST PHONE numbers the phone-based proofs and paid-webhook.spec.ts
   sign in with. They are KEPT on purpose (scripts/ensure-test-phone-profiles.js
   shapes them); never a junk owner to delete. */
const KEEP_PHONES = new Set(["919999999999", "918888888888"]);
const isDemo = (email) => Boolean(email && /^demo\./i.test(email));
const isJunkEmail = (email) => Boolean(email && JUNK_EMAIL.test(email) && !isDemo(email));

module.exports = {
  JUNK_EMAIL,
  JUNK_NAMES,
  JUNK_TENANT_NAME,
  JUNK_OWNER_ONLY_NAME,
  JUNK_CREW_NAME,
  KEEP_PHONES,
  isDemo,
  isJunkEmail,
  HYPHEN_PREFIXES,
  DOT_PREFIXES,
};
