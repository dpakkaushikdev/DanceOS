"use client";

import { useState } from "react";
import { browserSupabase } from "@/lib/supabase/lazyClient";
import { BTN_STYLE } from "@/lib/design/tokens";

/** Google's mark, drawn rather than fetched — four paths, Google's own four
 *  colours, from their branding guidance. An <img> here would be a request on
 *  the first screen of the app for 1 KB of logo. */
function GoogleG({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18A13.2 13.2 0 0 1 11 24c0-1.45.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

/** CONTINUE WITH GOOGLE (27 Oct 2026) — the only way into DanceOS.
 *
 *  ONE BUTTON, NOT TWO. The welcome screen carried "Start Dancing" and
 *  "Log In", and the comment on it recorded why they were two: with a password,
 *  creating an account and proving an existing one are different acts. With
 *  Google they are the same act — Google decides which it is, and the app finds
 *  out afterwards by whether a `profiles` row exists. Two buttons here would be
 *  two names for one thing, which is the mistake that note was written about.
 *
 *  THE LIBRARY ARRIVES WITH THE PRESS (`browserSupabase`, 5 Oct 2026). A static
 *  import of the Supabase client would put 246 KB back into the first screen of
 *  the app, which is the thing `lazyClient` exists to stop.
 *
 *  ⚠ `redirectTo` IS BUILT FROM THE BROWSER'S OWN ORIGIN, not from
 *  `NEXT_PUBLIC_SITE_URL` — which is unset locally, so a pinned origin would
 *  send a developer signing in on `:3000` to the live site. Every origin this
 *  resolves to must be on Supabase's redirect allow-list, or the landing is
 *  refused with no clue as to why. */
export function GoogleButton({
  next = null,
  label = "Continue with Google",
  primary = true,
}: {
  /** an in-app path to return to once the person is through onboarding */
  next?: string | null;
  label?: string;
  primary?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setError(null);
    setBusy(true);
    try {
      const supabase = await browserSupabase();
      const back = new URL("/auth/callback", window.location.origin);
      if (next) back.searchParams.set("next", next);
      const { error: refused } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: back.toString(),
          /* ⚠ ALWAYS ASK WHICH ACCOUNT. Without this Google signs the person
             straight in as whoever it saw last, which on a shared phone is the
             wrong person and on a teacher's own phone is the wrong one of their
             two accounts — with no screen on which to notice. */
          queryParams: { prompt: "select_account" },
        },
      });
      if (refused) {
        setError("Google could not be reached — check your connection and try again.");
        setBusy(false);
      }
      /* no `setBusy(false)` on success: the browser is leaving for Google, and
         a button that springs back to life mid-navigation invites a second press */
    } catch {
      setError("Google could not be reached — check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={go}
        disabled={busy}
        data-testid="google-sign-in"
        style={{
          ...BTN_STYLE,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          /* Google's guidance: their mark on white, or on their own blue. White
             also makes this the brightest thing on a dark welcome screen, which
             is right for the only button on it. */
          background: primary ? "#FFFFFF" : "var(--card)",
          color: primary ? "#1F1F1F" : "inherit",
          fontWeight: 800,
          border: primary ? "1.5px solid #DADCE0" : undefined,
          boxShadow: primary ? "0 8px 22px rgba(66,133,244,.22)" : undefined,
          opacity: busy ? 0.72 : 1,
          cursor: busy ? "default" : "pointer",
        }}
      >
        <GoogleG />
        {busy ? "Taking you to Google…" : label}
      </button>
      {error ? (
        <div role="alert" style={{ marginTop: 10, textAlign: "center", fontSize: 12.5, color: "#F87171" }}>
          {error}
        </div>
      ) : null}
    </>
  );
}
