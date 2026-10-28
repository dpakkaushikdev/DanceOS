"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { INK, SUB } from "@/lib/design/tokens";
import { HERE_ANSWER_KEY, hereCookie } from "@/lib/geo/here";

const CARD = "var(--card)";
const EL = "var(--el)";

/** TURN ON LOCATION — THE STANDARD ROW (28 Oct 2026, the user: "use the standard
 *  approach that is most widely accepted and used").
 *
 *  The widely used shape: the system dialog ONCE, at first launch (the APK's
 *  launcher does that), and after that no automatic prompt — instead a row where
 *  location matters, which asks again only when it is pressed. 1.3.3 asked at
 *  every open until allowed; this row replaces that.
 *
 *  Drawn on Discover while no location is known (no `dos_here` cookie and no
 *  point in the address). Pressed, it asks the browser — Chrome's own prompt on
 *  the website; inside the app the question goes through Chrome to the app
 *  (location delegation), which shows Android's dialog on most phones and is
 *  blocked without a word on HyperOS. So any failure inside the app says where
 *  the switch is (Settings → Apps → DanceOS → Permissions), which is also the
 *  only way once Android has stopped showing the dialog after two refusals. A
 *  fix refreshes the page: the cookie is now set, so this row goes away. */
export function TurnOnLocationRow() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const ask = () => {
    if (!("geolocation" in navigator)) {
      setHint("This browser will not share where you are.");
      return;
    }
    setBusy(true);
    setHint(null);
    const inApp = window.matchMedia("(display-mode: standalone)").matches;
    const off = inApp
      ? "Location is off. Switch on your phone's Location, and allow it for DanceOS in Settings → Apps → DanceOS → Permissions → Location, then open the app again."
      : "Location is off for this site. Allow it in your browser's site settings, then try again.";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        document.cookie = hereCookie({ lat: pos.coords.latitude, lng: pos.coords.longitude }, location.protocol === "https:");
        try {
          localStorage.setItem(HERE_ANSWER_KEY, "granted");
        } catch {
          /* a private window; the cookie is what the page reads anyway */
        }
        router.refresh();
      },
      (err) => {
        setBusy(false);
        /* inside the app a timeout is most likely the blocked dialog, not slow
           GPS (network location answers in a second), so it gets the same words */
        setHint(inApp || err.code === err.PERMISSION_DENIED ? off : "Could not find you just now — try again, or pick a city.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  };

  return (
    <div data-testid="turn-on-location" style={{ marginTop: 8 }}>
      <button
        type="button"
        onClick={ask}
        disabled={busy}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 12, border: `1.5px solid ${EL}`, background: CARD, color: INK, fontSize: 12, fontWeight: 800, textAlign: "left", cursor: busy ? "default" : "pointer", fontFamily: "inherit", opacity: busy ? 0.7 : 1 }}
      >
        <span aria-hidden="true">◎</span>
        <span style={{ flex: 1, minWidth: 0 }}>{busy ? "Finding you…" : "Turn on location"}</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: SUB, whiteSpace: "nowrap" }}>see studios near you</span>
      </button>
      {hint ? (
        <div role="status" style={{ fontSize: 10.5, color: "#B45309", marginTop: 5, lineHeight: 1.45 }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}
