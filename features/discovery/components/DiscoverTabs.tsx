"use client";

import type { ReactNode } from "react";
import { useOptimisticNav } from "@/features/shell/components/SegmentedNav";

/** DISCOVER'S SECTION TILES (4571-4585), PRESSED THE MOMENT THEY ARE TAPPED
 *  (20 Sep 2026): each tab is a real link, so the tile you press lights straight
 *  away and React puts it back if the navigation never lands. The address is
 *  still the state, and the tiles are still anchors for a middle-click.
 *
 *  ⚠ THE LOOK, RE-CUT (29 Oct 2026, the user: "keep minimum animation on the
 *  background should not be on the title and make them better still not quite
 *  happy with the current look and animations"). One calm gradient per tile, a
 *  single soft light drifting slowly BEHIND everything, and a still icon in a
 *  glass squircle over a still name. No bouncing icon, no lifting letters, no
 *  breathing halo. The chosen tile is the full colour with a ring; the others
 *  sit back. Reduced motion stops the drift (globals.css, `.dos-entity-tile *`). */
const TINT: Record<string, [string, string]> = {
  classes: ["#0F766E", "#2563EB"],
  studios: ["#1D4ED8", "#6D28D9"],
  artists: ["#BE185D", "#EA580C"],
  styles: ["#6D28D9", "#C026D3"],
};
const FALLBACK: [string, string] = ["#0EA5E9", "#6366F1"];

/** a still line icon per tile — decorative, the anchor's `aria-label` names it */
function TabGlyph({ k }: { k: string }) {
  const s = { fill: "none", stroke: "#fff", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const box = { width: 22, height: 22, viewBox: "0 0 24 24", "aria-hidden": true };
  if (k === "classes")
    return (
      <svg {...box}>
        <rect x="3.5" y="5" width="17" height="15.5" rx="3" {...s} />
        <path d="M3.5 10h17M8.5 3v4M15.5 3v4M9 15l2 2 4-4" {...s} />
      </svg>
    );
  if (k === "studios")
    return (
      <svg {...box}>
        <path d="M3.5 20.5V9.5L12 4l8.5 5.5v11z" {...s} />
        <path d="M9.5 20.5v-6h5v6M2.5 20.5h19" {...s} />
      </svg>
    );
  if (k === "artists")
    return (
      <svg {...box}>
        <circle cx="12" cy="7.5" r="3.5" {...s} />
        <path d="M5 20.5c.8-3.8 3.6-6 7-6s6.2 2.2 7 6" {...s} />
        <path d="M18.5 3.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" fill="#fff" stroke="none" />
      </svg>
    );
  if (k === "styles")
    return (
      <svg {...box}>
        <circle cx="12" cy="4.5" r="2" {...s} />
        <path d="M12 6.5v4.5M12 8.5l-5-3M12 8.5l5.5-4.5M12 11l-5 8.5q5 2.2 10 0z" {...s} />
      </svg>
    );
  return null;
}

export function DiscoverTabs({
  tabs,
  active,
}: {
  /** ⚠ EVERY TAB CARRIES ITS OWN `href` AS DATA. Discover's page is a SERVER
   *  component — a function cannot cross that boundary (a 500 on 20 Sep 2026). */
  tabs: Array<{ key: string; word: string; href: string; icon: ReactNode }>;
  active: string;
}) {
  const { shown, go } = useOptimisticNav(active);
  return (
    <div style={{ display: "flex", gap: 8, margin: "10px 0 4px" }}>
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
              height: 88,
              borderRadius: 18,
              textDecoration: "none",
              color: "#fff",
              background: `linear-gradient(150deg, ${a} 0%, ${b} 100%)`,
              boxShadow: on
                ? `0 0 0 2px var(--bg), 0 0 0 4px ${a}, 0 10px 22px color-mix(in srgb, ${a} 40%, transparent)`
                : "0 1px 3px rgba(0,0,0,.16)",
              opacity: on ? 1 : 0.78,
            }}
          >
            {/* the ONE moving thing — a soft light drifting slowly behind the
                content; the icon and the name never move */}
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                width: 120,
                height: 120,
                borderRadius: 60,
                top: -54,
                right: -48,
                background: "radial-gradient(circle, rgba(255,255,255,.34), rgba(255,255,255,0) 68%)",
                animation: `dosTileDrift 9s ease-in-out ${i * 1.3}s infinite alternate`,
              }}
            />
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(180deg, rgba(255,255,255,0) 45%, rgba(0,0,0,.22) 100%)",
              }}
            />
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 11,
                left: 11,
                width: 38,
                height: 38,
                borderRadius: 12,
                display: "grid",
                placeItems: "center",
                background: "rgba(255,255,255,.18)",
                border: "1px solid rgba(255,255,255,.32)",
              }}
            >
              <TabGlyph k={t.key} />
            </span>
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 11,
                right: 6,
                bottom: 10,
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: 0.1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                textShadow: "0 1px 2px rgba(0,0,0,.3)",
              }}
            >
              {t.word}
            </span>
          </a>
        );
      })}
    </div>
  );
}
