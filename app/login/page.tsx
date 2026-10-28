import Link from "next/link";
import { DosMark } from "@/components/ui/DosMark";
import { AuthShell } from "@/features/auth/components/AuthShell";
import { GoogleButton } from "@/features/auth/components/GoogleButton";
import { SkipToDiscover } from "@/features/auth/components/SkipToDiscover";
import { WelcomeReel } from "@/features/auth/components/WelcomeReel";
import { WELCOME_CLIPS } from "@/features/auth/welcomeClips";
import { leaveIfSignedIn } from "@/lib/auth/leaveIfSignedIn";
import { safeNext } from "@/lib/auth/safeNext";
import { DOS_DISPLAY, INK, LINE, SUB } from "@/lib/design/tokens";

/** Welcome screen — THE REEL (28 Oct 2026, the user, with Cult's sign-up screen
 *  in hand: "I need my sign up page look exactly like this … 3 videos of 5-7
 *  seconds which play one after another … logo in top left and skip in top
 *  right … the signup options at the lower side … at around 60 percent from the
 *  top the video is smoothly blending with the bottom dark background").
 *
 *  So the top two thirds are a full-bleed video stage: the three clips in
 *  `features/auth/welcomeClips.ts` (replaceable files under `public/welcome/`),
 *  the mark at the top left and Skip at the top right over them, the caption
 *  and the three progress bars over the clip's lower part, and a gradient that
 *  is the app's dark by the stage's bottom edge. Under it, within the shell's
 *  gutters: the one sign-in there is (Google, 27 Oct 2026) and the legal line.
 *
 *  WHAT WENT, and why: the centred mark, the wordmark, the 5·6·7·8 count-in,
 *  the eight dashes and the LEARN · TEACH · CONNECT band (3-18 Oct 2026). They
 *  were the screen when it had no picture; with a picture they fought it for the
 *  same space, and the user asked for Cult's screen, which has none of them. The
 *  taglines live on — "The Stage is yours." and "Dance First, Think Later!" are
 *  two of the three captions.
 *
 *  The earlier departures from the prototype (email + password, two stacked
 *  buttons, deviation row A9) are history: one button since 27 Oct 2026. */
export default async function LoginWelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ left?: string; next?: string; error?: string }>;
}) {
  await leaveIfSignedIn();
  const sp = await searchParams;
  /* AN ACCOUNT CLOSED FROM SETTINGS LANDS HERE (6 Oct 2026, decision 6) — said
     once, so the person is not left wondering whether the press did anything */
  const left = sp.left === "1";
  /* ⚠ `next` (11 Oct 2026, B21): "Sign in to book" on a class page comes back
     to that class. Since 27 Oct it arrives HERE rather than at /login/email,
     because this is the only door left. Only an in-app path survives. */
  const next = safeNext(sp.next);
  /* what /auth/callback bounces back with when Google refuses or is cancelled */
  const failed = typeof sp.error === "string" && sp.error.trim() ? sp.error.slice(0, 300) : null;
  return (
    <AuthShell toast={failed}>
      {/* the screen's name, for a screen reader — the caption changes with the clip */}
      <h1 className="sr-only">Welcome to DanceOS</h1>

      {/* THE STAGE: full-bleed, cancelling the shell's 22px gutters and its 24px
          top pad; two thirds of the screen on a phone, capped on a tall one */}
      <div
        data-testid="welcome-stage"
        style={{
          position: "relative",
          marginLeft: -22,
          marginRight: -22,
          marginTop: "calc(-1.5rem - var(--dos-safe-top))",
          height: "min(66svh, 660px)",
          minHeight: 380,
          overflow: "hidden",
          background: "#0A0A0A",
        }}
      >
        <WelcomeReel clips={WELCOME_CLIPS} />
        {/* the mark top left, Skip top right, over the picture */}
        <div style={{ position: "absolute", top: "calc(14px + var(--dos-safe-top))", left: 22, right: 22, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ display: "inline-flex", lineHeight: 0, filter: "drop-shadow(0 2px 10px rgba(0,0,0,.5))" }}>
            <DosMark size={38} />
          </span>
          <SkipToDiscover />
        </div>
      </div>

      {left ? (
        <div role="status" data-testid="account-closed" style={{ marginTop: 14, padding: "11px 13px", borderRadius: 14, border: `1.5px solid ${LINE}`, background: "var(--card)", fontSize: 12.5, lineHeight: 1.5, color: SUB }}>
          <b style={{ color: INK }}>Your account is closed.</b> DanceOS will erase it and reply to your address — you cannot sign in to it meanwhile.
        </div>
      ) : null}

      {/* ⚠ ONE BUTTON SINCE 27 OCT 2026 (the user: "i need only google signup"):
          Google decides whether this is a new account or a return, and the app
          learns the answer from whether a `profiles` row exists when the
          callback lands. The password screens still answer on their own
          addresses (Rule 14); nothing in the app links them. */}
      {/* the slack goes ABOVE the button, so the sign-in sits in the lower part
          of the screen the way Cult's does, with the legal line under it */}
      <div style={{ flex: 1, minHeight: 14 }} />

      {/* THE COUNT-IN IS BACK (29 Oct 2026, the user: "add 5678 back on start page
          above signin from google") — every class starts on it; the beats lift
          one after another (`dosBeat`), and reduced motion stills them */}
      <div
        aria-hidden="true"
        data-testid="count-in"
        style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, margin: "0 0 18px", fontSize: "clamp(32px, 10vw, 44px)", fontWeight: 900, letterSpacing: 0.5, lineHeight: 1, fontFamily: DOS_DISPLAY, fontVariantNumeric: "tabular-nums", color: INK, animation: "dosRise .6s .05s ease both" }}
      >
        {["5", "6", "7", "8"].map((n, i, all) => (
          <span key={n} style={{ display: "inline-flex", alignItems: "center", gap: 14, animation: `dosBeat 2.4s ease ${i * 0.3}s infinite` }}>
            {n}
            {i < all.length - 1 && <span style={{ color: LINE, fontSize: 30 }}>·</span>}
          </span>
        ))}
      </div>

      <div style={{ animation: "dosRise .6s .15s ease both" }}>
        <GoogleButton next={next} />
      </div>

      {/* THE EMAIL DOOR IS BACK (28 Oct 2026, the user: "our earlier login
          through email is still there but hidden — can we activate that too").
          The password screens never stopped answering (Rule 14); this is the
          link to them, under Google the way Cult puts its other ways in under
          the phone number. /login/email carries `next` like the Google button,
          and links on to Start Dancing (/login/signup) and Forgot password. */}
      {/* Cult's arrangement exactly (the user, with the screenshot: "instead of
          mobile the current google signup, below that OR and an email icon"):
          a plain OR, then a square icon tile — one, since email is the only
          other way in — where Cult has its row of three */}
      <div aria-hidden="true" style={{ textAlign: "center", margin: "16px 0 14px", color: INK, fontSize: 12, fontWeight: 900, letterSpacing: 1.5 }}>
        OR
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Link
          href={next ? `/login/email?next=${encodeURIComponent(next)}` : "/login/email"}
          data-testid="email-sign-in"
          aria-label="Continue with email"
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 50, height: 50, borderRadius: 13, background: "var(--card)", border: `1.5px solid ${LINE}`, color: INK, textDecoration: "none" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2.5" />
            <path d="M3.5 7l8.5 6 8.5-6" />
          </svg>
        </Link>
      </div>

      <p style={{ margin: "16px 0 0", textAlign: "center", fontSize: 11, lineHeight: 1.5, color: SUB }}>
        By continuing you agree to the{" "}
        <Link href="/legal/terms" style={{ color: INK, fontWeight: 700, textDecoration: "none" }}>
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/legal/privacy" style={{ color: INK, fontWeight: 700, textDecoration: "none" }}>
          Privacy Policy
        </Link>
        .
      </p>
    </AuthShell>
  );
}
