/** DISCOVER'S FOUR LOGOS AS ANIMATED CLIPART (18 Oct 2026, the user: "discover
 *  classes, studios, artists and styles should be more like a animated clipart
 *  with more colors. icons should be more like a pic with multiple colors used in
 *  design").
 *
 *  Each is a little filled picture rather than a line icon: an ink outline, four
 *  or five hues of its own, a highlight, and one or two small loops — the
 *  calendar's tick draws itself and a star pops, the studio's windows light and
 *  its flag waves while notes float out of the door, the dancer swings her arms
 *  under a spotlight, the notes bounce while a sparkle turns. The colours are
 *  FIXED (not `currentColor`) so a picture reads the same on the tile's wash and
 *  on its gradient; the outline keeps it legible on both. Every motion is
 *  transform / opacity / stroke-dashoffset, so it stays on the compositor, and
 *  reduced motion stops all of it (globals.css, `.dos-entity-tile *`). */
const INK = "#2A1F3D";
const line = { stroke: INK, strokeWidth: 1.4, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

export function DiscoverLogo({ k, size = 36 }: { k: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 40 40",
    "aria-hidden": true,
    style: { overflow: "visible" as const },
  };

  if (k === "classes") {
    return (
      <svg {...common}>
        <ellipse cx="20" cy="36.5" rx="13" ry="1.8" fill="#000" opacity=".14" />
        <rect x="6" y="8" width="28" height="26" rx="5" fill="#FFFFFF" {...line} />
        <path d="M6 13a5 5 0 0 1 5-5h18a5 5 0 0 1 5 5v2.5H6z" fill="#F43F5E" {...line} />
        <rect x="12" y="4.5" width="3.2" height="7" rx="1.6" fill="#3B82F6" {...line} />
        <rect x="24.8" y="4.5" width="3.2" height="7" rx="1.6" fill="#3B82F6" {...line} />
        {[
          [11, 20, "#FDE68A"],
          [17, 20, "#BAE6FD"],
          [23, 20, "#FBCFE8"],
          [29, 20, "#BBF7D0"],
          [11, 25.5, "#BAE6FD"],
          [17, 25.5, "#FBCFE8"],
        ].map(([x, y, c]) => (
          <rect key={`${x}-${y}`} x={(x as number) - 2} y={(y as number) - 1.8} width="4" height="3.6" rx="1" fill={c as string} />
        ))}
        <circle cx="25.5" cy="27" r="5.6" fill="#22C55E" {...line} />
        <path
          d="M22.8 27l1.9 1.9 3.6-3.8"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="18"
          style={{ animation: "dosLogoDraw 2.6s ease-in-out infinite" }}
        />
        <path
          d="M33.5 3.5l1.1 2.6 2.6 1.1-2.6 1.1-1.1 2.6-1.1-2.6-2.6-1.1 2.6-1.1z"
          fill="#FACC15"
          stroke={INK}
          strokeWidth=".9"
          strokeLinejoin="round"
          style={{ transformOrigin: "33.5px 7.3px", animation: "dosLogoSpin 3s linear infinite" }}
        />
        <circle cx="5" cy="5.5" r="1.4" fill="#A78BFA" style={{ transformOrigin: "5px 5.5px", animation: "dosLogoPing 2.6s ease-out infinite" }} />
      </svg>
    );
  }

  if (k === "studios") {
    return (
      <svg {...common}>
        <ellipse cx="20" cy="37" rx="15" ry="1.8" fill="#000" opacity=".14" />
        <rect x="7" y="16" width="26" height="20" rx="1.5" fill="#FEF3C7" {...line} />
        <path d="M4 17.5L20 6l16 11.5z" fill="#8B5CF6" {...line} />
        <path d="M10.5 15L20 8.3l9.5 6.7" fill="none" stroke="#C4B5FD" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M20 6V1.5" stroke={INK} strokeWidth="1.3" strokeLinecap="round" />
        <path
          d="M20 1.6h6.5l-1.8 2 1.8 2H20z"
          fill="#F43F5E"
          stroke={INK}
          strokeWidth=".9"
          strokeLinejoin="round"
          style={{ transformOrigin: "20px 3.6px", animation: "dosLogoWave 1.6s ease-in-out infinite" }}
        />
        {[
          [12.5, 21.5, "#FACC15", 0],
          [20, 21.5, "#38BDF8", 0.4],
          [27.5, 21.5, "#FB7185", 0.8],
        ].map(([x, y, c, d]) => (
          <rect
            key={x as number}
            x={(x as number) - 2.6}
            y={(y as number) - 2.4}
            width="5.2"
            height="4.8"
            rx="1"
            fill={c as string}
            stroke={INK}
            strokeWidth="1.1"
            style={{ animation: `dosLogoGlow 2.4s ease-in-out ${d}s infinite` }}
          />
        ))}
        <path d="M16.5 36v-7.5a3.5 3.5 0 0 1 7 0V36z" fill="#F97316" {...line} />
        <circle cx="22" cy="32" r=".7" fill={INK} />
        <path d="M7 36h26" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
        <g style={{ animation: "dosLogoFloat 2.4s ease-out infinite" }}>
          <path d="M33 27v-5.5l3-.8v5" fill="none" stroke="#EC4899" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="32.2" cy="27.2" r="1.3" fill="#EC4899" />
          <circle cx="35.2" cy="26.2" r="1.3" fill="#EC4899" />
        </g>
      </svg>
    );
  }

  if (k === "artists") {
    return (
      <svg {...common}>
        <path d="M14 2h12l7 34H7z" fill="#FDE68A" opacity=".45" style={{ animation: "dosLogoGlow 2.8s ease-in-out infinite" }} />
        <ellipse cx="20" cy="36.5" rx="11" ry="1.8" fill="#000" opacity=".16" />
        <g style={{ transformOrigin: "20px 35px", animation: "dosLogoSway 1.4s ease-in-out infinite" }}>
          <path d="M20 22l-5 12.5M20 22l5.5 12" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M20 22l-5 12.5M20 22l5.5 12" stroke="#0EA5E9" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M13.5 26.5L20 16.5l6.5 10z" fill="#14B8A6" {...line} />
          <path d="M16.3 12.8h7.4l1.3 6.2h-10z" fill="#EC4899" {...line} />
          <g style={{ transformOrigin: "16.8px 14px", animation: "dosLogoArm 1.4s ease-in-out infinite" }}>
            <path d="M16.8 14L10 8.5" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
            <path d="M16.8 14L10 8.5" stroke="#F9C4A0" strokeWidth="1.5" strokeLinecap="round" />
          </g>
          <g style={{ transformOrigin: "23.2px 14px", animation: "dosLogoArm 1.4s ease-in-out .7s infinite" }}>
            <path d="M23.2 14l7.3-2.2" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
            <path d="M23.2 14l7.3-2.2" stroke="#F9C4A0" strokeWidth="1.5" strokeLinecap="round" />
          </g>
          <circle cx="20" cy="8.3" r="3.8" fill="#F9C4A0" {...line} />
          <path d="M16.2 8.2c0-3.6 2-5.4 4.4-5.2 2.6.2 3.9 2.2 3.3 4.4-1.7-.4-3.2-1.4-4.1-2.6-.8 1.6-2 2.8-3.6 3.4z" fill="#4C1D95" stroke={INK} strokeWidth="1" strokeLinejoin="round" />
          <circle cx="25.2" cy="5.2" r="1.3" fill="#F43F5E" />
        </g>
        <path d="M4 18h4M3 23h3.5M32 26h4M33 31h3" stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" style={{ animation: "dosLogoBlink 1.4s ease-in-out infinite" }} />
      </svg>
    );
  }

  if (k === "styles") {
    return (
      <svg {...common}>
        <ellipse cx="20" cy="37" rx="12" ry="1.8" fill="#000" opacity=".14" />
        <circle cx="20" cy="20" r="14" fill="#EDE9FE" opacity=".7" />
        <g style={{ animation: "dosLogoBounce 1.2s cubic-bezier(.34,1.56,.64,1) infinite" }}>
          <path d="M15 29V11l13-3.5V25" fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 29V11l13-3.5V25" fill="none" stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 11l13-3.5v4.4L15 15.4z" fill="#8B5CF6" {...line} />
          <ellipse cx="11.6" cy="29.2" rx="4" ry="3.2" fill="#EC4899" {...line} />
          <ellipse cx="24.6" cy="25.4" rx="4" ry="3.2" fill="#F97316" {...line} />
          <ellipse cx="10.3" cy="28.2" rx="1.2" ry=".7" fill="#FFFFFF" opacity=".75" />
          <ellipse cx="23.3" cy="24.4" rx="1.2" ry=".7" fill="#FFFFFF" opacity=".75" />
        </g>
        <path
          d="M6.5 5l1.4 3.3 3.3 1.4-3.3 1.4L6.5 14.4l-1.4-3.3L1.8 9.7l3.3-1.4z"
          fill="#FACC15"
          stroke={INK}
          strokeWidth=".9"
          strokeLinejoin="round"
          style={{ transformOrigin: "6.5px 9.7px", animation: "dosLogoSpin 3s linear infinite" }}
        />
        <path
          d="M33.5 15.5c-1.2-1.6-3.6-.6-3 1.2.4 1.4 3 3.1 3 3.1s2.6-1.7 3-3.1c.6-1.8-1.8-2.8-3-1.2z"
          fill="#F43F5E"
          stroke={INK}
          strokeWidth=".9"
          style={{ animation: "dosLogoFloat 2.6s ease-out .6s infinite" }}
        />
      </svg>
    );
  }
  return null;
}
