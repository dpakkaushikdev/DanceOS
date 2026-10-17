import type { CSSProperties } from "react";

/** A HEADING THAT COUNTS IN (18 Oct 2026, the user: "some running animation like
 *  5678 on all headings"). The start page's 5 · 6 · 7 · 8 beat one after another;
 *  a heading does the same, letter by letter — a small lift that runs along the
 *  word and starts again, so a title reads as a count-in rather than a label.
 *
 *  ⚠ The letters are aria-hidden and a visually-hidden copy carries the word, so a
 *  heading's accessible name reads "Classes", not "C l a s s e s" (inline-block
 *  letters are separated by spaces in the name). Words never break inside themselves.
 *  ⚠ Colour is NOT animated (unlike `dosBeat`): a heading must stay in its own
 *  ink. Reduced motion stops it (globals.css, `.dos-beat`). */
export function BeatText({ text, step = 0.07, style }: { text: string; step?: number; style?: CSSProperties }) {
  const chars = Array.from(text);
  const letters = chars.filter((ch) => ch.trim()).length;
  /* one cycle long enough for the wave to cross the word and rest a beat */
  const dur = Math.max(2.4, letters * step + 1.6);
  let i = 0;
  const words = text.split(/(\s+)/);
  return (
    <span className="dos-beat" style={style}>
      {/* ⚠ the accessible name: Chromium separates inline-BLOCK children with
          spaces, so the letters alone read "M e m b e r s h i p s" (shoot-hero
          caught it). One whole copy for assistive tech, the letters hidden. */}
      <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>{text}</span>
      <span aria-hidden="true">
      {words.map((w, wi) =>
        /\s+/.test(w) ? (
          w
        ) : (
          <span key={wi} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
            {Array.from(w).map((ch, ci) => {
              const n = i++;
              return (
                <span
                  key={ci}
                  style={{
                    display: "inline-block",
                    animation: `dosLetter ${dur}s ease-in-out ${(n * step).toFixed(2)}s infinite`,
                  }}
                >
                  {ch}
                </span>
              );
            })}
          </span>
        ),
      )}
      </span>
    </span>
  );
}
