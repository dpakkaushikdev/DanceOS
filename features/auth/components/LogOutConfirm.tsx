"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Portal } from "@/components/ui/Portal";
import { CENTER_CARD, CENTER_SCRIM } from "@/components/ui/centerModal";
import { signOutAction } from "@/features/auth/server-actions/auth";
import { RED } from "@/lib/design/tokens";
import { useCloseOnBack } from "@/lib/hooks/useCloseOnBack";

/** ARE YOU SURE? (3 Oct 2026, the user: "should not log out without
 *  confirmation"). Log out sat as the last row of the profile switcher — a menu
 *  you open to change PROFILE, on a chip at the screen's right edge where a
 *  thumb lands by accident — and one press ended the session on the spot. Now
 *  that press asks, in the middle of the screen, and only "Log out" in here
 *  submits `signOutAction`.
 *
 *  Mounted only while open (so `useCloseOnBack` is the hook's documented
 *  conditional-mount shape): system back, the scrim, Escape and Cancel all
 *  close it, and Cancel takes focus first, because the safe answer is the
 *  default one. */
export function LogOutConfirm({ onClose, word = "Log out" }: { onClose: () => void; word?: string }) {
  useCloseOnBack(onClose);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* ⚠ RE-CUT 18 Oct 2026 (the user: "make prompt box before log out better and
     with shorter text below"): a ringed mark, a two-word question, one short
     line, and the two answers stacked full width — Log out on top in red,
     Stay quiet under it — so the thumb lands on a whole row, not half of one. */
  const btn: React.CSSProperties = { width: "100%", padding: "13px 10px", borderRadius: 14, fontSize: 13.5, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", border: "none" };
  return (
    <Portal>
      <div onClick={onClose} style={{ ...CENTER_SCRIM, zIndex: 960 }}>
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="dos-logout-title"
          aria-describedby="dos-logout-sub"
          onClick={(e) => e.stopPropagation()}
          style={{ ...CENTER_CARD, maxWidth: 300, textAlign: "center", padding: "24px 16px 16px", borderRadius: 24 }}
        >
          <span aria-hidden="true" style={{ width: 56, height: 56, borderRadius: 999, margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center", background: `${RED}1a`, boxShadow: `0 0 0 6px ${RED}0d` }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 17l5-5-5-5M20 12H9M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5" />
            </svg>
          </span>
          <div id="dos-logout-title" style={{ fontSize: 19, fontWeight: 900, letterSpacing: -0.4 }}>
            {word}?
          </div>
          <div id="dos-logout-sub" style={{ fontSize: 12, color: "var(--sub)", marginTop: 4 }}>
            Sign back in with your email.
          </div>
          <form action={signOutAction} style={{ marginTop: 18 }}>
            <GoButton word={word} style={{ ...btn, background: RED, color: "#fff" }} />
          </form>
          <button ref={cancelRef} type="button" onClick={onClose} style={{ ...btn, marginTop: 8, background: "var(--el)", color: "var(--text)" }}>
            Stay
          </button>
        </div>
      </div>
    </Portal>
  );
}

/** the red answer — "Logging out…" while the session ends, so a second press is not a question */
function GoButton({ word, style }: { word: string; style: React.CSSProperties }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-label={word} style={{ ...style, opacity: pending ? 0.7 : 1 }}>
      {pending ? (word === "Sign out" ? "Signing out…" : "Logging out…") : word}
    </button>
  );
}
