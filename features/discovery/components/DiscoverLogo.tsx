/** DISCOVER'S FOUR LOGOS, EACH MOVING (18 Oct 2026, the user: "better logos with
 *  running animation for classes, studios, artists and styles on discover").
 *
 *  One drawn mark per section, in one stroke family, each with its own small
 *  loop: a class's tick draws itself on the calendar, a studio's windows light
 *  one after another, an artist dances, a style's note bounces with a spark
 *  turning beside it. Every motion is transform / opacity / stroke-dashoffset,
 *  so it stays on the compositor. Reduced motion stops all of it (globals.css,
 *  `.dos-entity-tile *`). `currentColor`, so the tile's own colour decides the ink. */
export function DiscoverLogo({ k, size = 30 }: { k: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 32 32",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    style: { overflow: "visible" as const },
  };
  if (k === "classes") {
    return (
      <svg {...common}>
        <rect x="4.5" y="6.5" width="23" height="21" rx="4.5" />
        <path d="M4.5 12.5h23M11 3.8v5M21 3.8v5" />
        <path d="M10.5 19.5l3.6 3.6 7.4-7.4" strokeWidth="2.4" strokeDasharray="18" style={{ animation: "dosLogoDraw 2.6s ease-in-out infinite" }} />
        <circle cx="25" cy="7" r="1.6" fill="currentColor" stroke="none" style={{ transformOrigin: "25px 7px", animation: "dosLogoPing 2.6s ease-out infinite" }} />
      </svg>
    );
  }
  if (k === "studios") {
    return (
      <svg {...common}>
        <path d="M5 28V12.5L16 5l11 7.5V28" />
        <path d="M3 28h26" />
        <path d="M13.5 28v-6h5v6" />
        {[
          [9.5, 15.5, 0],
          [16, 15.5, 0.35],
          [22.5, 15.5, 0.7],
        ].map(([x, y, d]) => (
          <rect key={x} x={x - 1.6} y={y - 1.6} width="3.2" height="3.2" rx=".8" fill="currentColor" stroke="none" style={{ animation: `dosLogoBlink 2.4s ease-in-out ${d}s infinite` }} />
        ))}
        <path d="M16 5v-2.5" style={{ transformOrigin: "16px 5px", animation: "dosLogoSway 1.8s ease-in-out infinite" }} />
      </svg>
    );
  }
  if (k === "artists") {
    return (
      <svg {...common}>
        <g style={{ transformOrigin: "16px 28px", animation: "dosLogoSway 1.4s ease-in-out infinite" }}>
          <circle cx="16" cy="7" r="3" />
          <path d="M16 10.5v8.5" />
          <path d="M16 19l-4.5 8M16 19l5 7" />
          <path d="M16 13l-6-3.5" style={{ transformOrigin: "16px 13px", animation: "dosLogoArm 1.4s ease-in-out infinite" }} />
          <path d="M16 13l6.5-1.5" style={{ transformOrigin: "16px 13px", animation: "dosLogoArm 1.4s ease-in-out .7s infinite" }} />
        </g>
        <path d="M4 26.5h4M24 28h4" strokeWidth="1.6" style={{ animation: "dosLogoBlink 1.4s ease-in-out infinite" }} />
      </svg>
    );
  }
  if (k === "styles") {
    return (
      <svg {...common}>
        <g style={{ animation: "dosLogoBounce 1.2s cubic-bezier(.34,1.56,.64,1) infinite" }}>
          <path d="M12 23.5V8l12-3v15" />
          <ellipse cx="9.2" cy="23.6" rx="3.2" ry="2.6" fill="currentColor" />
          <ellipse cx="21.2" cy="20.3" rx="3.2" ry="2.6" fill="currentColor" />
          <path d="M12 12.5l12-3" />
        </g>
        <path d="M5 7.5l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z" fill="currentColor" stroke="none" style={{ transformOrigin: "5px 11px", animation: "dosLogoSpin 3s linear infinite" }} />
      </svg>
    );
  }
  return null;
}
