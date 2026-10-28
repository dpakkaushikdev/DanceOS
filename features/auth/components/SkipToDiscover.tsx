"use client";

import { useRouter } from "next/navigation";
import { BROWSE_COOKIE, BROWSE_MAX_AGE_S } from "@/lib/auth/browseFirst";
import { INK, LINE } from "@/lib/design/tokens";

/** SKIP, THE WAY CULT HAS IT (28 Oct 2026). Discover has answered a signed-out
 *  visitor since 11 Sep 2026 (the page reads `user` as optional) — what was
 *  missing was a door to it that is not Google. The press is remembered
 *  (`lib/auth/browseFirst.ts`) so the next open of the app lands on Discover
 *  rather than back here. A push, not a replace: the back gesture returns to
 *  this screen, which is where "Continue with Google" lives. */
export function SkipToDiscover() {
  const router = useRouter();
  const skip = () => {
    document.cookie = `${BROWSE_COOKIE}=1; path=/; max-age=${BROWSE_MAX_AGE_S}; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
    router.push("/discover");
  };
  return (
    <button
      type="button"
      data-testid="skip-signin"
      onClick={skip}
      style={{ height: 34, padding: "0 16px", borderRadius: 17, border: `1.5px solid ${LINE}`, background: "var(--card)", color: INK, fontSize: 12.5, fontWeight: 900, letterSpacing: 0.3, cursor: "pointer", fontFamily: "inherit" }}
    >
      Skip
    </button>
  );
}
