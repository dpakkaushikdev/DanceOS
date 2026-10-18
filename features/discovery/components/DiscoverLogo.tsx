/** DISCOVER'S FOUR TILES ARE PICTURES (18 Oct 2026, the user, a second time:
 *  "need better logos for discover make sure they are bigger and consume the
 *  whole tile space and should use better colors and instead of clipart use a
 *  picture which has animation").
 *
 *  ⚠ AND A THIRD TIME, LATER THE SAME DAY: "better animated pics for classes,
 *  studios, artists, styles with their titles and icon being animated with
 *  background and using full tile space". So each scene now stands on a MOVING
 *  backdrop — a wide multi-colour gradient sliding under the picture and soft
 *  coloured lights drifting across it (`Backdrop`) — and the tile's title band
 *  carries an animated icon (`DiscoverTileIcon`) beside a word whose letters lift
 *  one after another (DiscoverTabs.tsx).
 *
 *  Each is a little lit SCENE that fills the whole tile — no outlines, so it
 *  reads as a picture and not a sticker: a class under the studio lights with
 *  three dancers moving in the mirror and notes in the air, a studio building at
 *  dusk with its windows coming on and a flag waving, a performer under a
 *  sweeping spotlight between red curtains with confetti falling, and a disco
 *  ball over an equaliser for the styles with a colour ring orbiting it. Every
 *  motion is transform / opacity, so it stays on the compositor, and reduced
 *  motion stops all of it (globals.css, `.dos-entity-tile *`).
 *
 *  ⚠ The SVG is `slice`d into the tile, so it is the tile's own shape that
 *  decides the crop; everything that matters sits in the middle 70%. Gradient ids
 *  carry the tile's key so four scenes on one page never share a definition. */

type Ids = { id: (s: string) => string; url: (s: string) => string };

/** the moving ground every scene stands on: a 300-unit-wide gradient of the
 *  scene's own colours sliding back and forth under the 100-unit view, and three
 *  soft lights drifting in different directions over it */
function Backdrop({ ids, stops, lights }: { ids: Ids; stops: string[]; lights: [string, string, string] }) {
  const { id, url } = ids;
  return (
    <>
      <defs>
        <linearGradient id={id("bgslide")} x1="0" y1="0" x2="1" y2=".35">
          {stops.map((c, i) => (
            <stop key={i} offset={i / (stops.length - 1)} stopColor={c} />
          ))}
        </linearGradient>
        {lights.map((c, i) => (
          <radialGradient key={i} id={id(`light${i}`)} cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor={c} stopOpacity=".85" />
            <stop offset="1" stopColor={c} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>
      <rect x="0" y="0" width="300" height="120" fill={url("bgslide")} style={{ animation: "dosSceneBg 9s ease-in-out infinite alternate" }} />
      {/* fill-box so each light scales about its own centre, not the view's corner */}
      <circle cx="20" cy="30" r="34" fill={url("light0")} style={{ transformBox: "fill-box", transformOrigin: "center", animation: "dosSceneBlobA 7s ease-in-out infinite" }} />
      <circle cx="85" cy="70" r="38" fill={url("light1")} style={{ transformBox: "fill-box", transformOrigin: "center", animation: "dosSceneBlobB 8.5s ease-in-out infinite" }} />
      <circle cx="40" cy="105" r="30" fill={url("light2")} style={{ transformBox: "fill-box", transformOrigin: "center", animation: "dosSceneBlobA 10s ease-in-out -3s infinite reverse" }} />
    </>
  );
}

export function DiscoverScene({ k }: { k: string }) {
  const svg = {
    viewBox: "0 0 100 120",
    preserveAspectRatio: "xMidYMid slice",
    "aria-hidden": true,
    style: { position: "absolute" as const, inset: 0, width: "100%", height: "100%", display: "block" },
  };
  const id = (s: string) => `dsc-${k}-${s}`;
  const url = (s: string) => `url(#${id(s)})`;
  const ids: Ids = { id, url };

  if (k === "classes") {
    return (
      <svg {...svg}>
        <Backdrop ids={ids} stops={["#1E1B4B", "#5B21B6", "#C026D3", "#0EA5E9", "#14B8A6", "#5B21B6"]} lights={["#22D3EE", "#F472B6", "#FDE047"]} />
        <defs>
          <linearGradient id={id("floor")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F59E0B" />
            <stop offset="1" stopColor="#92400E" />
          </linearGradient>
          <linearGradient id={id("mirror")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#A5F3FC" stopOpacity=".38" />
            <stop offset="1" stopColor="#818CF8" stopOpacity=".12" />
          </linearGradient>
          <radialGradient id={id("lamp")} cx=".5" cy="0" r=".9">
            <stop offset="0" stopColor="#FEF3C7" stopOpacity=".9" />
            <stop offset="1" stopColor="#FEF3C7" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={id("d1")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FB7185" /><stop offset="1" stopColor="#E11D48" /></linearGradient>
          <linearGradient id={id("d2")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5EEAD4" /><stop offset="1" stopColor="#0D9488" /></linearGradient>
          <linearGradient id={id("d3")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FDE047" /><stop offset="1" stopColor="#EA580C" /></linearGradient>
        </defs>
        <rect x="8" y="14" width="84" height="66" rx="3" fill={url("mirror")} />
        <rect x="-30" y="14" width="16" height="66" fill="#FFFFFF" opacity=".22" transform="skewX(-18)" style={{ animation: "dosSceneSweep 3.6s ease-in-out infinite" }} />
        {[20, 50, 80].map((x, i) => (
          <ellipse key={x} cx={x} cy="2" rx="22" ry="34" fill={url("lamp")} style={{ animation: `dosLogoGlow 2.8s ease-in-out ${i * 0.5}s infinite` }} />
        ))}
        {/* notes floating up off the music */}
        {[
          [14, "#FDE047", 0], [86, "#F9A8D4", 1.2], [62, "#67E8F9", 2.1],
        ].map(([x, c, d]) => (
          <g key={x as number} style={{ animation: `dosSceneRise 3.4s ease-out ${d}s infinite` }}>
            <path d={`M${(x as number) + 2.4} 58 v-7 l4 -1.2 v6`} stroke={c as string} strokeWidth="1.4" fill="none" strokeLinecap="round" />
            <ellipse cx={(x as number) + 1.2} cy="58.3" rx="2" ry="1.5" fill={c as string} />
          </g>
        ))}
        <rect x="6" y="60" width="88" height="2.4" rx="1.2" fill="#FCD34D" />
        <rect y="80" width="100" height="40" fill={url("floor")} />
        {[88, 98, 110].map((y) => <rect key={y} y={y} width="100" height=".6" fill="#78350F" opacity=".45" />)}
        {[
          [24, "d1", 0],
          [50, "d2", 0.25],
          [76, "d3", 0.5],
        ].map(([x, g, d]) => (
          <g key={x as number} style={{ transformOrigin: `${x}px 92px`, animation: `dosSceneDance 1.4s ease-in-out ${d}s infinite` }}>
            <ellipse cx={x as number} cy="93" rx="8" ry="1.8" fill="#000" opacity=".25" />
            <path d={`M${x} 66 l-6 26 M${x} 66 l6 26`} stroke="#3B0764" strokeWidth="3" strokeLinecap="round" />
            <path d={`M${(x as number) - 7} 70 L${x} 52 L${(x as number) + 7} 70 Z`} fill={url(g as string)} />
            <path d={`M${(x as number) - 3} 55 L${(x as number) - 11} 44 M${(x as number) + 3} 55 L${(x as number) + 11} 44`} stroke="#FDBA8C" strokeWidth="2.6" strokeLinecap="round" />
            <circle cx={x as number} cy="46" r="5" fill="#FDBA8C" />
            <path d={`M${(x as number) - 5} 45 a5 5 0 0 1 10 0 q-5 -3 -10 0z`} fill="#3B0764" />
          </g>
        ))}
      </svg>
    );
  }

  if (k === "studios") {
    return (
      <svg {...svg}>
        <Backdrop ids={ids} stops={["#0B1033", "#4C1D95", "#F472B6", "#FB923C", "#7C3AED", "#0B1033"]} lights={["#F472B6", "#60A5FA", "#FDE68A"]} />
        <defs>
          <linearGradient id={id("bldg")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#312E81" />
            <stop offset="1" stopColor="#1E1B4B" />
          </linearGradient>
          <radialGradient id={id("moon")} cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#FEF9C3" />
            <stop offset=".55" stopColor="#FDE68A" stopOpacity=".55" />
            <stop offset="1" stopColor="#FDE68A" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={id("win")} cx=".5" cy=".5" r=".7">
            <stop offset="0" stopColor="#FFF7AE" />
            <stop offset="1" stopColor="#F59E0B" />
          </radialGradient>
        </defs>
        <circle cx="80" cy="16" r="16" fill={url("moon")} style={{ animation: "dosLogoGlow 4s ease-in-out infinite" }} />
        {[
          [12, 10, 0], [30, 18, 0.7], [52, 6, 1.4], [94, 40, 0.3], [6, 36, 1.1], [64, 22, 1.8],
        ].map(([x, y, d]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill="#FFFFFF" style={{ animation: `dosLogoBlink 2.2s ease-in-out ${d}s infinite` }} />
        ))}
        <rect x="-4" y="74" width="26" height="46" fill="#1E1B4B" opacity=".75" />
        <rect x="80" y="66" width="26" height="54" fill="#1E1B4B" opacity=".75" />
        {/* the flag on the roof */}
        <path d="M51 26v-18" stroke="#E2E8F0" strokeWidth="1.2" />
        <path d="M51.6 8.5 q6 -2 12 1 v8 q-6 -3 -12 -1z" fill="#22D3EE" style={{ transformOrigin: "51.6px 12px", animation: "dosLogoWave 1.6s ease-in-out infinite" }} />
        <rect x="20" y="36" width="62" height="84" rx="2" fill={url("bldg")} />
        <rect x="27" y="26" width="48" height="13" rx="3" fill="#0B1033" stroke="#F472B6" strokeWidth="1.6" style={{ animation: "dosSceneNeon 2.6s ease-in-out infinite" }} />
        <path d="M44 32.5h14" stroke="#F9A8D4" strokeWidth="2.4" strokeLinecap="round" style={{ animation: "dosSceneNeon 2.6s ease-in-out infinite" }} />
        <circle cx="38" cy="32.5" r="2" fill="#67E8F9" style={{ animation: "dosLogoBlink 1.3s ease-in-out infinite" }} />
        <circle cx="64" cy="32.5" r="2" fill="#67E8F9" style={{ animation: "dosLogoBlink 1.3s ease-in-out .65s infinite" }} />
        {[46, 60, 74, 88].flatMap((y, r) =>
          [30, 46, 62].map((x, c) => (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="10"
              height="9"
              rx="1.2"
              fill={url("win")}
              style={{ animation: `dosSceneWindow 3.2s ease-in-out ${((r * 3 + c) * 0.37) % 3}s infinite` }}
            />
          ))
        )}
        {/* a dancer passing the lit window */}
        <g style={{ animation: "dosSceneWalk 5s ease-in-out infinite alternate" }}>
          <circle cx="35" cy="77" r="1.6" fill="#1E1B4B" />
          <path d="M35 79 v4 M35 80.5 l-2 1.8 M35 80.5 l2.2 -1.4" stroke="#1E1B4B" strokeWidth="1.1" strokeLinecap="round" />
        </g>
        <path d="M44 120v-9a7 7 0 0 1 14 0v9z" fill="#FB923C" />
        <rect x="44" y="104" width="14" height="16" fill="#FDE68A" opacity=".4" style={{ animation: "dosLogoGlow 2s ease-in-out infinite" }} />
      </svg>
    );
  }

  if (k === "artists") {
    return (
      <svg {...svg}>
        <Backdrop ids={ids} stops={["#1C0A0A", "#7C2D12", "#DB2777", "#F59E0B", "#9D174D", "#1C0A0A"]} lights={["#F59E0B", "#EC4899", "#A855F7"]} />
        <defs>
          <linearGradient id={id("beam")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FEF3C7" stopOpacity=".95" />
            <stop offset="1" stopColor="#FDE68A" stopOpacity=".05" />
          </linearGradient>
          <linearGradient id={id("curtain")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#7F1D1D" />
            <stop offset=".5" stopColor="#DC2626" />
            <stop offset="1" stopColor="#7F1D1D" />
          </linearGradient>
          <linearGradient id={id("body")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F472B6" />
            <stop offset="1" stopColor="#7C3AED" />
          </linearGradient>
          <radialGradient id={id("pool")} cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#FDE68A" stopOpacity=".85" />
            <stop offset="1" stopColor="#FDE68A" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d="M42 -4 H58 L84 104 H16 Z" fill={url("beam")} style={{ transformOrigin: "50px -4px", animation: "dosSceneBeam 4s ease-in-out infinite" }} />
        <ellipse cx="50" cy="104" rx="36" ry="9" fill={url("pool")} />
        {[0, 1, 2].map((i) => (
          <path key={`l${i}`} d={`M${i * 6} 0 q4 60 ${-2 + i} 120 h7 q-3 -60 1 -120z`} fill={url("curtain")} />
        ))}
        {[0, 1, 2].map((i) => (
          <path key={`r${i}`} d={`M${100 - i * 6} 0 q-4 60 ${2 - i} 120 h-7 q3 -60 -1 -120z`} fill={url("curtain")} />
        ))}
        <rect width="100" height="8" fill="#991B1B" />
        {/* confetti falling through the light */}
        {[
          [26, "#FDE047", 0], [40, "#22D3EE", 0.9], [58, "#A3E635", 1.7], [72, "#F472B6", 0.4], [48, "#FB923C", 2.3],
        ].map(([x, c, d]) => (
          <rect key={x as number} x={x as number} y="6" width="2.4" height="3.6" rx=".6" fill={c as string} style={{ transformOrigin: `${(x as number) + 1.2}px 8px`, animation: `dosSceneFall 3s linear ${d}s infinite` }} />
        ))}
        <g style={{ transformOrigin: "50px 102px", animation: "dosSceneSway 2s ease-in-out infinite" }}>
          <path d="M50 70 L42 100 M50 70 L66 80" stroke="#4C1D95" strokeWidth="4" strokeLinecap="round" />
          <path d="M40 74 L50 46 L60 74 Z" fill={url("body")} />
          <g style={{ transformOrigin: "46px 52px", animation: "dosLogoArm 2s ease-in-out infinite" }}>
            <path d="M46 52 L30 38" stroke="#FDBA8C" strokeWidth="3.2" strokeLinecap="round" />
          </g>
          <path d="M54 52 L70 44" stroke="#FDBA8C" strokeWidth="3.2" strokeLinecap="round" />
          <circle cx="50" cy="38" r="6.5" fill="#FDBA8C" />
          <path d="M43.5 37 a6.5 6.5 0 0 1 13 0 q-4 -4 -9 -1 q-2 2 -4 1z" fill="#3B0764" />
        </g>
        {[[22, 30, 0], [78, 26, 0.8], [70, 62, 1.5], [28, 66, 0.4]].map(([x, y, d]) => (
          <path
            key={`${x}-${y}`}
            d={`M${x} ${(y as number) - 4} l1.2 2.8 2.8 1.2 -2.8 1.2 -1.2 2.8 -1.2 -2.8 -2.8 -1.2 2.8 -1.2z`}
            fill="#FEF08A"
            style={{ transformOrigin: `${x}px ${y}px`, animation: `dosLogoSpin 2.4s linear ${d}s infinite` }}
          />
        ))}
      </svg>
    );
  }

  if (k === "styles") {
    return (
      <svg {...svg}>
        <Backdrop ids={ids} stops={["#0891B2", "#7C3AED", "#DB2777", "#F59E0B", "#10B981", "#0891B2"]} lights={["#FDE047", "#22D3EE", "#F472B6"]} />
        <defs>
          <radialGradient id={id("ball")} cx=".35" cy=".3" r=".8">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset=".5" stopColor="#CBD5E1" />
            <stop offset="1" stopColor="#475569" />
          </radialGradient>
          <linearGradient id={id("eq")} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#22D3EE" />
            <stop offset=".6" stopColor="#A3E635" />
            <stop offset="1" stopColor="#FDE047" />
          </linearGradient>
        </defs>
        <g style={{ transformOrigin: "50px 40px", animation: "dosSceneRays 14s linear infinite" }}>
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} d="M50 40 L46 -40 L54 -40 Z" fill="#FFFFFF" opacity={i % 2 ? 0.08 : 0.16} transform={`rotate(${i * 30} 50 40)`} />
          ))}
        </g>
        <path d="M50 0v18" stroke="#E2E8F0" strokeWidth="1" />
        {/* a ring of colour orbiting the ball */}
        <g style={{ transformOrigin: "50px 40px", animation: "dosSceneRays 5s linear infinite reverse" }}>
          {["#FDE047", "#F472B6", "#22D3EE", "#A3E635", "#FB923C", "#C084FC"].map((c, i) => (
            <circle key={c} cx={50 + 28 * Math.cos((i * Math.PI) / 3)} cy={40 + 28 * Math.sin((i * Math.PI) / 3)} r="2.4" fill={c} />
          ))}
        </g>
        <circle cx="50" cy="40" r="20" fill={url("ball")} />
        <g style={{ transformOrigin: "50px 40px", animation: "dosSceneFacet 1.6s steps(4) infinite" }}>
          {[[-10, -8], [4, -12], [10, 2], [-4, 6], [-14, 8], [6, 14], [-2, -4]].map(([dx, dy], i) => (
            <rect key={i} x={50 + dx} y={40 + dy} width="4" height="4" fill="#FFFFFF" opacity=".85" />
          ))}
        </g>
        {[
          [24, "#FDE047", 0], [74, "#67E8F9", 1.1], [38, "#F9A8D4", 0.6],
        ].map(([x, c, d]) => (
          <g key={x as number} style={{ animation: `dosSceneRise 3s ease-out ${d}s infinite` }}>
            <path d={`M${(x as number) + 3} 86 v-9 l5 -1.5 v8`} stroke={c as string} strokeWidth="1.6" fill="none" strokeLinecap="round" />
            <ellipse cx={(x as number) + 1.6} cy="86.4" rx="2.4" ry="1.8" fill={c as string} />
          </g>
        ))}
        {[10, 22, 34, 46, 58, 70, 82].map((x, i) => (
          <rect
            key={x}
            x={x}
            y="88"
            width="8"
            height="32"
            rx="2"
            fill={url("eq")}
            style={{ transformOrigin: `${x + 4}px 120px`, animation: `dosSceneEq ${0.7 + (i % 3) * 0.18}s ease-in-out ${i * 0.09}s infinite alternate` }}
          />
        ))}
      </svg>
    );
  }
  return null;
}

/** the little icon that rides beside the tile's title, each with its own loop:
 *  a calendar whose tick draws, a studio whose door glows, a star that spins, a
 *  note that bounces. Decorative — the tile's own `aria-label` names it. */
export function DiscoverTileIcon({ k, size = 14 }: { k: string; size?: number }) {
  const box = { width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true, style: { flexShrink: 0, overflow: "visible" as const, filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,.55))" } };
  const stroke = { fill: "none", stroke: "#fff", strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (k === "classes") {
    return (
      <svg {...box} style={{ ...box.style, animation: "dosLogoBounce 1.4s ease-in-out infinite" }}>
        <rect x="3" y="5" width="18" height="16" rx="3" fill="#FB7185" stroke="#fff" strokeWidth="2" />
        <path d="M3 10h18M8 3v4M16 3v4" {...stroke} strokeWidth={2} />
        <path d="M8.5 15l2.4 2.4 4.6-4.6" {...stroke} strokeWidth={2.2} strokeDasharray="18" style={{ animation: "dosLogoDraw 2.4s ease-in-out infinite" }} />
      </svg>
    );
  }
  if (k === "studios") {
    return (
      <svg {...box} style={{ ...box.style, transformOrigin: "50% 100%", animation: "dosTileIconPulse 1.8s ease-in-out infinite" }}>
        <path d="M3 21V9l9-6 9 6v12z" fill="#60A5FA" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
        <rect x="9.5" y="13" width="5" height="8" rx="1" fill="#FDE047" style={{ animation: "dosLogoBlink 1.6s ease-in-out infinite" }} />
      </svg>
    );
  }
  if (k === "artists") {
    return (
      <svg {...box} style={{ ...box.style, transformOrigin: "50% 50%", animation: "dosSceneRays 3.2s linear infinite" }}>
        <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" fill="#FDE047" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    );
  }
  if (k === "styles") {
    return (
      <svg {...box} style={{ ...box.style, transformOrigin: "40% 90%", animation: "dosTileIconWiggle 1.2s ease-in-out infinite" }}>
        <path d="M9 18V5l11-2v13" {...stroke} />
        <circle cx="6.5" cy="18" r="3" fill="#F472B6" stroke="#fff" strokeWidth="1.8" />
        <circle cx="17.5" cy="16" r="3" fill="#22D3EE" stroke="#fff" strokeWidth="1.8" />
      </svg>
    );
  }
  return null;
}
