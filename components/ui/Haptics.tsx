"use client";

import { useEffect } from "react";

/** A TAP THAT IS FELT (12 Oct 2026, the user: "make the app haptic for all
 *  clicks toggles everything"), and since 19 Oct 2026 ("make haptics better") a
 *  small VOCABULARY rather than one buzz for everything:
 *
 *  - light   — a link or a plain button: you moved somewhere
 *  - firm    — a switch, a tab, a checkbox, a radio, a chip, a fold: you changed
 *              a state
 *  - heavy   — Delete, Remove, Void, Call off, Log out: a double pulse, so a
 *              destructive press never feels like any other
 *  - success — a toast (`role="status"`) appearing: something went through
 *  - warning — an error (`role="alert"`) appearing: something did not
 *
 *  ONE listener for the whole app, in the capture phase, so no component has to
 *  remember to ask for it. Anything can also ask directly:
 *  `window.dispatchEvent(new CustomEvent("dos:haptic", { detail: "success" }))`.
 *
 *  ⚠ TWO ENGINES, because the platforms disagree. Android's browsers (and the
 *  installed TWA) answer `navigator.vibrate` — and 8 ms, the old value, is under
 *  what many phone motors can even spin up to, which is why taps often were not
 *  felt; the durations below are what a cheap motor actually renders. iOS Safari
 *  has no vibrate at all, and since iOS 18 the ONE thing that fires the Taptic
 *  Engine from a page is toggling a native `<input type="checkbox" switch>` inside
 *  the user's own gesture — so iOS gets one crisp tick per press, and the success
 *  and warning patterns (which arrive after the gesture) are Android's alone.
 *  A laptop silently does nothing, which is the right answer.
 *
 *  ⚠ The hidden label's own click bubbles through this same listener, so a flag
 *  stops it ticking itself; and two ticks closer than 35 ms collapse into one, so
 *  a press that lands on a label AND its control is felt once. */

type Kind = "light" | "firm" | "heavy" | "success" | "warning";

const PATTERN: Record<Kind, number | number[]> = {
  light: 12,
  firm: 20,
  heavy: [22, 55, 30],
  success: [14, 70, 22],
  warning: [32, 60, 32],
};

const CONTROL = 'button, a[href], [role="button"], [role="switch"], [role="tab"], [role="option"], [role="menuitem"], [role="radio"], [role="checkbox"], input[type="checkbox"], input[type="radio"], select, summary, label';
const STATEFUL = '[role="switch"], [role="tab"], [role="option"], [role="radio"], [role="checkbox"], input[type="checkbox"], input[type="radio"], summary, [aria-pressed]';
const DANGER_WORDS = /\b(delete|remove|void|call off|cancel booking|withdraw|log out|sign out|decline|reject)\b/i;

/** ⚠ the iOS engine toggles a real checkbox, and doing that while somebody is
 *  typing could take the focus — and the keyboard — away from their field */
const isTyping = () => {
  const a = document.activeElement;
  return a instanceof HTMLTextAreaElement || (a instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit"].includes(a.type)) || (a instanceof HTMLElement && a.isContentEditable);
};

const kindOf = (el: Element): Kind => {
  const words = `${el.getAttribute("aria-label") ?? ""} ${(el.textContent ?? "").slice(0, 60)}`;
  if (DANGER_WORDS.test(words)) return "heavy";
  if (el.matches(STATEFUL)) return "firm";
  return "light";
};

export function Haptics() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const canVibrate = typeof navigator.vibrate === "function";
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let label: HTMLLabelElement | null = null;
    if (!canVibrate) {
      label = document.createElement("label");
      label.setAttribute("aria-hidden", "true");
      label.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("switch", "");
      input.tabIndex = -1;
      label.appendChild(input);
      document.body.appendChild(label);
    }
    let self = false;
    let last = 0;
    let lastResult = 0;

    const fire = (kind: Kind, inGesture: boolean) => {
      try {
        if (canVibrate) {
          /* reduced motion keeps a single short tick and drops the patterns */
          navigator.vibrate(reduced ? 12 : PATTERN[kind]);
        } else if (label && inGesture && !isTyping()) {
          self = true;
          label.click();
          self = false;
        }
      } catch {
        self = false;
      }
    };

    const onClick = (e: MouseEvent) => {
      if (self || !e.isTrusted) return;
      const target = e.target as Element | null;
      if (!target || typeof target.closest !== "function") return;
      const el = target.closest(CONTROL);
      if (!el || (el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return;
      const now = performance.now();
      if (now - last < 35) return;
      last = now;
      fire(kindOf(el), true);
    };

    /* a toast or an error arriving is felt — once per 600 ms, and never in the
       same breath as the press that caused it (the press has already ticked) */
    const result = (kind: Kind) => {
      const now = performance.now();
      if (now - lastResult < 600 || now - last < 120) return;
      lastResult = now;
      fire(kind, false);
    };
    const observer = new MutationObserver((records) => {
      for (const r of records) {
        for (const n of Array.from(r.addedNodes)) {
          if (!(n instanceof HTMLElement)) continue;
          const hit = n.matches('[role="alert"], [role="status"]') ? n : n.querySelector('[role="alert"], [role="status"]');
          if (!hit || !(hit.textContent ?? "").trim()) continue;
          result(hit.getAttribute("role") === "alert" ? "warning" : "success");
          return;
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const onAsk = (e: Event) => {
      const kind = (e as CustomEvent<Kind>).detail;
      if (kind && kind in PATTERN) fire(kind, false);
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("dos:haptic", onAsk);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("dos:haptic", onAsk);
      observer.disconnect();
      label?.remove();
    };
  }, []);
  return null;
}
