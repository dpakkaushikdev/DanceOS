"use client";

import type { ReactNode } from "react";
import { useOptimisticNav } from "@/features/shell/components/SegmentedNav";

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
              textAlign: "center",
              padding: "10px 2px 8px",
              borderRadius: 14,
              textDecoration: "none",
              background: on
                ? `linear-gradient(135deg, ${a}, ${b})`
                : `linear-gradient(135deg, color-mix(in srgb, ${a} 16%, var(--card)), color-mix(in srgb, ${b} 10%, var(--card)))`,
              color: on ? "#fff" : `color-mix(in srgb, ${a} 70%, var(--text))`,
              border: `1.5px solid ${on ? "transparent" : `color-mix(in srgb, ${a} 35%, transparent)`}`,
              boxShadow: on ? `0 6px 16px color-mix(in srgb, ${a} 38%, transparent)` : "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              animation: `dosTileIn .4s cubic-bezier(.34,1.56,.64,1) ${i * 60}ms both`,
            }}
          >
            <span
              aria-hidden="true"
              style={{ display: "inline-flex", animation: on ? "dosTabPop .5s cubic-bezier(.34,1.56,.64,1)" : "none" }}
            >
              {t.icon}
            </span>
            <div style={{ fontSize: 10, fontWeight: 800 }}>{t.word}</div>
          </a>
        );
      })}
    </div>
  );
}
