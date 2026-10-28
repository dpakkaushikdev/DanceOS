"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FIRST_OPEN_COOKIE, HERE_COOKIE, formatPoint, hereCookie } from "@/lib/geo/here";

/** what this phone answered last time: "granted" | "denied" */
const ANSWER_KEY = "dos.here.answer";
/** one quiet refresh per app session, not one per page */
const REFRESHED_KEY = "dos.here.refreshed";

const readCookie = (name: string): string | null => {
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
};

/* storage can be missing or throw (a private window, blocked site data) — the
   question still gets asked, it just cannot be remembered */
const get = (s: () => Storage, k: string): string | null => {
  try {
    return s().getItem(k);
  } catch {
    return null;
  }
};
const set = (s: () => Storage, k: string, v: string) => {
  try {
    s().setItem(k, v);
  } catch {
    /* see above */
  }
};

/** THE FIRST THING THE APP DOES IS ASK WHERE YOU ARE (28 Oct 2026, the user:
 *  "when i open cult fit app it ask for the location access first step. This
 *  is how i want … at the install only, without even signup").
 *
 *  Mounted at the root, because the first page of a fresh install is not always
 *  /login: uninstalling the APK does not clear Chrome's cookies, so somebody
 *  reinstalling may already be signed in and land on Discover.
 *
 *  * FIRST OPEN AFTER INSTALL (the APK's flag, turned into a cookie by
 *    `proxy.ts`): read the position. ⚠ Since 1.3.1 the APK ASKS ANDROID ITSELF,
 *    over its splash and before Chrome opens, and sends the flag as `true` only
 *    when the answer was Allow — so this read is answered through location
 *    delegation with no dialog at all. (1.3.0 let this call trigger the dialog;
 *    the library then opened it from the background, which HyperOS blocks
 *    silently. See `android/.../LauncherActivity.java`.)
 *  * EVERY LATER OPEN OF THE APP, only if the last answer was yes: refresh the
 *    point quietly — Android does not ask again once allowed.
 *  * "DON'T ALLOW" IS FINAL. Nothing here asks again; Discover's Near me stays a
 *    row you press.
 *  * THE WEBSITE IN A BROWSER is never asked on load: it gets no first-open flag
 *    and is not `display-mode: standalone`.
 *
 *  ⚠ It does not lean on `navigator.permissions.query`, whose answer inside a
 *  Trusted Web Activity is the delegated one and unproven on a real phone; the
 *  answer this phone gave is remembered here instead. */
export function AskWhereOnFirstOpen() {
  const router = useRouter();

  useEffect(() => {
    const firstOpen = readCookie(FIRST_OPEN_COOKIE) === "1";
    if (firstOpen) {
      document.cookie = `${FIRST_OPEN_COOKIE}=; path=/; max-age=0`;
    }
    const inApp = window.matchMedia("(display-mode: standalone)").matches;
    const refresh = !firstOpen && inApp && get(() => localStorage, ANSWER_KEY) === "granted" && !get(() => sessionStorage, REFRESHED_KEY);
    if ((!firstOpen && !refresh) || !("geolocation" in navigator)) {
      return;
    }
    set(() => sessionStorage, REFRESHED_KEY, "1");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const changed = readCookie(HERE_COOKIE) !== formatPoint(p);
        document.cookie = hereCookie(p, location.protocol === "https:");
        set(() => localStorage, ANSWER_KEY, "granted");
        /* the server-rendered page under the dialog (Discover, onboarding)
           re-reads the cookie; /login has nothing that uses it, and a refresh
           there costs nothing */
        if (changed) router.refresh();
      },
      (err) => {
        /* a timeout or no fix is not an answer — only a refusal is remembered */
        if (err.code === err.PERMISSION_DENIED) set(() => localStorage, ANSWER_KEY, "denied");
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 }
    );
  }, [router]);

  return null;
}
