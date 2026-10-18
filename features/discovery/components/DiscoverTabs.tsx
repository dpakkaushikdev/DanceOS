"use client";

import type { ReactNode } from "react";
import { useOptimisticNav } from "@/features/shell/components/SegmentedNav";
import { DiscoverScene, DiscoverTileIcon } from "./DiscoverLogo";

/** DISCOVER'S SECTION TILES (4571-4585), PRESSED THE MOMENT THEY ARE TAPPED
 *  (20 Sep 2026, the user: *"see such bug doesnt appear anywhere in the system
 *  where things are getting stuck"*).
 *
 *  Same reason as the class segments: each tab is a real link, so a tap is a
 *  server round trip — and until it came back the OLD tile stayed lit and
 *  nothing moved. The tile you pressed lights straight away now and React puts
 *  it back if the navigation never lands. The address is still the state, so
 *  back and a pasted link are untouched, and the tiles are still anchors for a
 *  middle-click.
 *
 *  ⚠ EACH TILE WEARS ITS OWN COLOUR (18 Oct 2026, the user: "discover- classes,
 *  studios, artists, styles should be animated and more colorful"): a wash of it
 *  at rest, a gradient of it when chosen, the icon popping in. They breathe in
 *  one after another on load and shrink a touch under the finger. Reduced motion
 *  turns every animation off (globals.css). */
const TINT: Record<string, [string, string]> = {
  classes: ["#0D9488", "#2563EB"],
  studios: ["#2563EB", "#7C3AED"],
  artists: ["#DB2777", "#F59E0B"],
  styles: ["#7C3AED", "#DB2777"],
};
const FALLBACK: [string, string] = ["#0EA5E9", "#6366F1"];

export function DiscoverTabs({
  tabs,
  active,
}: {
  /** ⚠ EVERY TAB CARRIES ITS OWN `href` AS DATA. Discover's page is a SERVER
   *  component — a function cannot cross that boundary (a 500 on 20 Sep 2026).
   *  The element (`icon`) crosses fine; the closure does not. */
  tabs: Array<{ key: string; word: string; href: string; icon: ReactNode }>;
  active: string;
}) {
  const { shown, go } = useOptimisticNav(active);
  return (
    <div style={{ display: "flex", gap: 6, margin: "10px 0 4px" }}>
      {tabs.map((t, i) => {
        const on = shown === t.key;
        const [a, b] = TINT[t.key] ?? FALLBACK;
        const href = t.href;
        return (
          <a
            key={t.key}
            href={href}
            aria-label={t.word}
            aria-current={on ? "page" : undefined}
            data-tab={t.key}
            className="dos-entity-tile"
            onClick={(e) => go(t.key, href, e)}
            style={{
              flex: 1,
              minWidth: 0,
              position: "relative",
              overflow: "hidden",
              height: 104,
              borderRadius: 16,
              textDecoration: "none",
              background: `linear-gradient(135deg, ${a}, ${b})`,
              color: "#fff",
              /* chosen: a ring in the tile's own colour, clear of it by the page's
                 ground, and a lift; the others stay full-colour and sit back a touch */
              boxShadow: on
                ? `0 0 0 2px var(--bg), 0 0 0 4px ${a}, 0 8px 18px color-mix(in srgb, ${a} 45%, transparent)`
                : "0 2px 6px rgba(0,0,0,.18)",
              transform: on ? "translateY(-2px)" : undefined,
              filter: on ? undefined : "saturate(.82) brightness(.94)",
              animation: `dosTileIn .4s cubic-bezier(.34,1.56,.64,1) ${i * 60}ms both`,
            }}
          >
            {DiscoverScene({ k: t.key }) ?? (
              <span aria-hidden="true" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>{t.icon}</span>
            )}
            {/* THE TITLE ROW, ANIMATED (18 Oct 2026, the user: "titles and icon
                being animated"): the tile's own icon on its loop, then the word
                with its letters lifting one after another. Decorative only — the
                anchor's `aria-label` is the name, so the letters are hidden. */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                padding: "16px 2px 6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: 0.2,
                whiteSpace: "nowrap",
                background: "linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,.66))",
                textShadow: "0 1px 2px rgba(0,0,0,.55)",
              }}
            >
              <DiscoverTileIcon k={t.key} />
              <span style={{ display: "inline-flex" }}>
                {Array.from(t.word).map((ch, j) => (
                  <span key={j} style={{ display: "inline-block", animation: `dosTileLetter 2.6s ease-in-out ${i * 0.35 + j * 0.08}s infinite` }}>
                    {ch}
                  </span>
                ))}
              </span>
            </div>
          </a>
        );
      })}
    </div>
  );
}
