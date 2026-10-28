import type { CSSProperties } from "react";

/** A REAL <button> THAT LOOKS LIKE THE BOX IT REPLACED (28 Oct 2026).
 *
 *  The app had 68 tap targets drawn as `<div|span role="button" tabIndex={0}
 *  onKeyDown=…>` — each one hand-wiring what a <button> does for free (keyboard
 *  focus, Enter and Space, the disabled state, voice control). They are real
 *  buttons now, and these two styles are what keep them looking identical.
 *  Tailwind's preflight already gives a button `font: inherit`, `color: inherit`,
 *  a transparent background, no padding and no border; what is left is the
 *  browser's own centring and the default arrow cursor.
 *
 *  ⚠ A box in normal flow STRETCHES to its container; a button SHRINKS to its
 *  contents. So a box that was a `<div>` filling its row uses `BTN_RESET_BLOCK`
 *  (`display: block; width: 100%`). A chip in a row of chips uses `BTN_RESET` —
 *  `width: 100%` on a flex item in a row would make every chip the row's width.
 *  The caller's own style is spread AFTER, so its display / width always win. */
export const BTN_RESET: CSSProperties = {
  textAlign: "inherit",
  cursor: "pointer",
  font: "inherit",
  color: "inherit",
  background: "none",
  border: "none",
  padding: 0,
  margin: 0,
  appearance: "none",
};

export const BTN_RESET_BLOCK: CSSProperties = {
  ...BTN_RESET,
  display: "block",
  width: "100%",
  boxSizing: "border-box",
};
