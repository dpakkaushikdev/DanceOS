"use client";

import type { ReactNode } from "react";
import { useOptimisticNav } from "@/features/shell/components/SegmentedNav";

/** DISCOVER'S SECTION TILES (4571-4585), PRESSED THE MOMENT THEY ARE TAPPED
 *  (20 Sep 2026): each tab is a real link, so the tile you press lights straight
 *  away and React puts it back if the navigation never lands. The address is
 *  still the state, and the tiles are still anchors for a middle-click.
 *
 *  ⚠ MINIMAL, WITH ANIMATED ICONS (29 Oct 2026, the user: "give a look which is
 *  minimalistic but icons should be animated"). A quiet card on the page's own
 *  ground, a still name, and one line icon in the section's colour whose PARTS
 *  move — the calendar's tick draws itself, the studio's windows glow and its
 *  flag waves, the artist's sparkle twinkles, the dancer sways. No gradient
 *  slab, no drifting light, nothing on the title. The chosen tile wears its
 *  colour as a wash, an edge and a filled icon. Reduced motion stops every part
 *  (globals.css, `.dos-entity-tile *`). */
const TINT: Record<string, string> = {
  classes: "#14B8A6",
  studios: "#3B82F6",
  artists: "#EC4899",
  styles: "#A855F7",
};
const FALLBACK = "#0EA5E9";

/** a line icon whose parts move — decorative, the anchor's `aria-label` names it */
function TabGlyph({ k, delay }: { k: string; delay: number }) {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const box = { width: 24, height: 24, viewBox: "0 0 24 24", "aria-hidden": true, style: { overflow: "visible" } };
  const anim = (name: string, secs: number) => ({ animation: `${name} ${secs}s ease-in-out ${delay}s infinite` });
  if (k === "classes")
    return (
      <svg {...box}>
        <rect x="3.5" y="5" width="17" height="15.5" rx="3" {...s} />
        <path d="M3.5 10h17M8.5 3v4M15.5 3v4" {...s} />
        <path d="M9 15.2l2 2 4-4" {...s} pathLength={1} strokeDasharray={1} style={anim("dosIcoCheck", 3.2)} />
      </svg>
    );
  if (k === "studios")
    return (
      <svg {...box}>
        <path d="M3.5 20.5V10L12 5l8.5 5v10.5" {...s} />
        <path d="M12 5V1.8" {...s} />
        <path className="dos-ico-part" d="M12 1.8h4.2l-1.2 1.3 1.2 1.3H12z" fill="currentColor" stroke="none" style={{ transformOrigin: "left center", ...anim("dosIcoFlag", 2.2) }} />
        <path d="M2.5 20.5h19M10 20.5v-4.5h4v4.5" {...s} />
        <rect x="6.6" y="11.6" width="2.8" height="2.6" rx=".6" fill="currentColor" style={anim("dosIcoGlow", 2.6)} />
        <rect x="14.6" y="11.6" width="2.8" height="2.6" rx=".6" fill="currentColor" style={{ animation: `dosIcoGlow 2.6s ease-in-out ${delay + 1.3}s infinite` }} />
      </svg>
    );
  if (k === "artists")
    return (
      <svg {...box}>
        <circle cx="11" cy="8" r="3.5" {...s} />
        <path d="M4 20.5c.8-3.8 3.6-6 7-6s6.2 2.2 7 6" {...s} />
        <path className="dos-ico-part" d="M19 2.2l.75 1.75 1.75.75-1.75.75L19 7.2l-.75-1.75-1.75-.75 1.75-.75z" fill="currentColor" stroke="none" style={anim("dosIcoTwinkle", 2.4)} />
      </svg>
    );
  if (k === "styles")
    return (
      <svg {...box}>
        <g className="dos-ico-part" style={{ transformOrigin: "50% 100%", ...anim("dosIcoSway", 2.8) }}>
          <circle cx="12" cy="4.5" r="2" {...s} />
          <path d="M12 6.5v4.5M12 8.5l-5-3M12 8.5l5.5-4.5M12 11l-5 8.5q5 2.2 10 0z" {...s} />
        </g>
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
  /* ⚠ ONE DOCK WITH A SLIDING PILL (29 Oct 2026, the user: "still not happy with
     discover tiles make it better"). Four separate cards read as four buttons
     competing; this is ONE control: a quiet rounded dock, a pill in the chosen
     section's colour that SLIDES under the tab you press, and each icon still
     moving on its own. The chosen tab's icon pops when it lands. */
  const at = Math.max(0, tabs.findIndex((t) => t.key === shown));
  const n = Math.max(1, tabs.length);
  const pillCol = TINT[tabs[at]?.key ?? ""] ?? FALLBACK;
  return (
    <div
      data-testid="discover-dock"
      style={{
        position: "relative",
        display: "flex",
        margin: "10px 0 4px",
        padding: 5,
        borderRadius: 22,
        background: "var(--card)",
        border: "1.5px solid var(--el)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 5,
          bottom: 5,
          left: `calc(5px + ${at} * (100% - 10px) / ${n})`,
          width: `calc((100% - 10px) / ${n})`,
          borderRadius: 17,
          background: `linear-gradient(140deg, ${pillCol}, color-mix(in srgb, ${pillCol} 72%, #000))`,
          boxShadow: `0 8px 20px color-mix(in srgb, ${pillCol} 38%, transparent)`,
          transition: "left .42s cubic-bezier(.34,1.32,.64,1), background .3s ease, box-shadow .3s ease",
        }}
      />
      {tabs.map((t, i) => {
        const on = shown === t.key;
        const col = TINT[t.key] ?? FALLBACK;
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
              position: "relative",
              zIndex: 1,
              flex: 1,
              minWidth: 0,
              height: 70,
              borderRadius: 17,
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <span
              key={on ? "on" : "off"}
              aria-hidden="true"
              style={{
                display: "grid",
                placeItems: "center",
                color: on ? "#fff" : col,
                transform: "scale(1.15)",
                animation: on ? "dosTabPop .45s cubic-bezier(.34,1.56,.64,1)" : "none",
                transition: "color .25s ease",
              }}
            >
              <TabGlyph k={t.key} delay={i * 0.45} />
            </span>
            <span
              aria-hidden="true"
              style={{
                maxWidth: "92%",
                fontSize: 12,
                fontWeight: on ? 900 : 700,
                letterSpacing: 0.2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                color: on ? "#fff" : "var(--sub)",
                transition: "color .25s ease",
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
