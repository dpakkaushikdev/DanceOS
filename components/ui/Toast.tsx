"use client";

import { useSyncExternalStore } from "react";
import { plainError } from "@/lib/errors";

/** THE APP'S ONE POP-UP (19 Oct 2026). Before this every screen kept its own
 *  toast in local state with its own timer and its own look — about eight
 *  variants, 1.8 s to 4.2 s, four heights — and a toast fired by a sheet died
 *  with the sheet, so "Saved" flashed for 0.6 s. This is a module-level store:
 *  any component calls `toast("Saved")` or `toast.error(msg)` and the one
 *  `<Toaster />` in the root layout draws it, so it outlives whatever fired it.
 *
 *  - success: `role="status"`, ~3 s
 *  - error:   `role="alert"`, red edge, ~6 s, a close button, and the message
 *             passed through `plainError` so no database sentence reaches a user
 *
 *  The store owns the timer, so a second toast replaces the first cleanly. */

type Kind = "success" | "error" | "undo";
type Item = { id: number; kind: Kind; msg: string };

/* BATCH 3 (28 Oct 2026): an error STAYS until it is closed — a refusal read
   in 6 s was a refusal often missed — and a quick delete is "Removed · Undo":
   the screen hides the thing at once, and the real delete runs only when the
   undo window closes (5 s), when another toast replaces this one, or when the
   page is left. Nothing is restored, because nothing was deleted yet. */
const UNDO_MS = 5000;

let current: Item | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let pending: { commit: () => void; undo: () => void } | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** the delete a pending undo was holding back goes through now */
function flushPending() {
  const p = pending;
  pending = null;
  if (p) p.commit();
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushPending);
}

function show(kind: Kind, msg: string | null | undefined) {
  if (!msg) return;
  flushPending();
  const text = kind === "error" ? plainError(msg) : msg;
  current = { id: ++seq, kind, msg: text };
  if (timer) clearTimeout(timer);
  timer = kind === "error" ? null : setTimeout(() => dismiss(), 3000);
  emit();
}

function dismiss() {
  if (timer) clearTimeout(timer);
  timer = null;
  current = null;
  flushPending();
  emit();
}

function undoNow() {
  const p = pending;
  pending = null;
  if (timer) clearTimeout(timer);
  timer = null;
  current = null;
  emit();
  if (p) p.undo();
}

/** "Removed · Undo". `commit` is the real delete; `undo` puts the item back on
 *  screen. Exactly one of the two runs. */
function withUndo(msg: string, commit: () => void, undo: () => void) {
  flushPending();
  pending = { commit, undo };
  current = { id: ++seq, kind: "undo", msg };
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => dismiss(), UNDO_MS);
  emit();
}

type ToastFn = ((msg: string | null | undefined) => void) & {
  error: (msg: string | null | undefined) => void;
  /** an action result: shows the error when there is one, the success otherwise */
  result: (error: string | null | undefined, success: string) => void;
  /** a quick delete with an Undo — see `withUndo` */
  undo: (msg: string, commit: () => void, undo: () => void) => void;
  dismiss: () => void;
};

export const toast: ToastFn = Object.assign((msg: string | null | undefined) => show("success", msg), {
  error: (msg: string | null | undefined) => show("error", msg),
  result: (error: string | null | undefined, success: string) => (error ? show("error", error) : show("success", success)),
  undo: withUndo,
  dismiss,
});

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function Toaster() {
  const item = useSyncExternalStore(subscribe, () => current, () => null);
  if (!item) return null;
  const err = item.kind === "error";
  return (
    <div
      key={item.id}
      role={err ? "alert" : "status"}
      aria-live={err ? "assertive" : "polite"}
      style={{
        position: "fixed",
        bottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
        left: "50%",
        transform: "translateX(-50%)",
        width: "max-content",
        maxWidth: "min(360px, calc(100vw - 32px))",
        background: "var(--solid)",
        border: `1.5px solid ${err ? "#EF4444" : "#0EA5E9"}`,
        color: "var(--text)",
        padding: err ? "10px 10px 10px 16px" : "11px 18px",
        borderRadius: 18,
        fontSize: 13,
        fontWeight: 700,
        lineHeight: 1.35,
        textAlign: err ? "left" : "center",
        zIndex: 990,
        boxShadow: "0 6px 24px rgba(0,0,0,.45)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        animation: "dosSheetUp .22s cubic-bezier(.22,.9,.34,1)",
      }}
    >
      <span style={{ flex: 1 }}>{item.msg}</span>
      {item.kind === "undo" && (
        <button
          type="button"
          onClick={undoNow}
          data-testid="toast-undo"
          style={{ flexShrink: 0, height: 30, padding: "0 14px", borderRadius: 999, border: "none", background: "var(--text)", color: "var(--solid)", fontSize: 12.5, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}
        >
          Undo
        </button>
      )}
      {err && (
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 999, border: "none", background: "var(--el)", color: "var(--text)", fontSize: 14, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
