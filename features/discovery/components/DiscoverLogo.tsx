/** DISCOVER'S FOUR TILES ARE PICTURES (18 Oct 2026, the user, a second time:
 *  "need better logos for discover make sure they are bigger and consume the
 *  whole tile space and should use better colors and instead of clipart use a
 *  picture which has animation").
 *
 *  Each is a little lit SCENE that fills the whole tile — no outlines, so it
 *  reads as a picture and not a sticker: a class under the studio lights with
 *  three dancers moving in the mirror, a studio building at dusk with its windows
 *  coming on, a performer under a sweeping spotlight between red curtains, and a
 *  disco ball over an equaliser for the styles. Soft gradients carry the light;
 *  every motion is transform / opacity, so it stays on the compositor, and
 *  reduced motion stops all of it (globals.css, `.dos-entity-tile *`).
 *
 *  ⚠ The SVG is `slice`d into the tile, so it is the tile's own shape that
 *  decides the crop; everything that matters sits in the middle 70%. Gradient ids
 *  carry the tile's key so four scenes on one page never share a definition. */
export function DiscoverScene({ k }: { k: string }) {
  const svg = {
    viewBox: "0 0 100 120",
    preserveAspectRatio: "xMidYMid slice",
    "aria-hidden": true,
    style: { position: "absolute" as const, inset: 0, width: "100%", height: "100%", display: "block" },
  };
  const id = (s: string) => `dsc-${k}-${s}`;
  const url = (s: string) => `url(#${id(s)})`;

  if (k === "classes") {
    return (
      <svg {...svg}>
        <defs>
          <linearGradient id={id("wall")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1E1B4B" />
            <stop offset=".55" stopColor="#5B21B6" />
            <stop offset="1" stopColor="#C026D3" />
          </linearGradient>
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
        <rect width="100" height="120" fill={url("wall")} />
        <rect x="8" y="18" width="84" height="62" rx="3" fill={url("mirror")} />
        <rect x="-30" y="18" width="16" height="62" fill="#FFFFFF" opacity=".22" transform="skewX(-18)" style={{ animation: "dosSceneSweep 3.6s ease-in-out infinite" }} />
        {[20, 50, 80].map((x, i) => (
          <ellipse key={x} cx={x} cy="4" rx="22" ry="34" fill={url("lamp")} style={{ animation: `dosLogoGlow 2.8s ease-in-out ${i * 0.5}s infinite` }} />
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
        <defs>
          <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0B1033" />
            <stop offset=".5" stopColor="#4C1D95" />
            <stop offset="1" stopColor="#F472B6" />
          </linearGradient>
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
        <rect width="100" height="120" fill={url("sky")} />
        <circle cx="78" cy="20" r="16" fill={url("moon")} style={{ animation: "dosLogoGlow 4s ease-in-out infinite" }} />
        {[
          [12, 12, 0], [30, 22, 0.7], [52, 9, 1.4], [92, 44, 0.3], [8, 40, 1.1], [62, 30, 1.8],
        ].map(([x, y, d]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill="#FFFFFF" style={{ animation: `dosLogoBlink 2.2s ease-in-out ${d}s infinite` }} />
        ))}
        <rect x="-4" y="78" width="26" height="42" fill="#1E1B4B" opacity=".75" />
        <rect x="80" y="70" width="26" height="50" fill="#1E1B4B" opacity=".75" />
        <rect x="20" y="38" width="62" height="82" rx="2" fill={url("bldg")} />
        <rect x="27" y="28" width="48" height="13" rx="3" fill="#0B1033" stroke="#F472B6" strokeWidth="1.6" style={{ animation: "dosSceneNeon 2.6s ease-in-out infinite" }} />
        <path d="M44 34.5h14" stroke="#F9A8D4" strokeWidth="2.4" strokeLinecap="round" style={{ animation: "dosSceneNeon 2.6s ease-in-out infinite" }} />
        <circle cx="38" cy="34.5" r="2" fill="#67E8F9" style={{ animation: "dosLogoBlink 1.3s ease-in-out infinite" }} />
        <circle cx="64" cy="34.5" r="2" fill="#67E8F9" style={{ animation: "dosLogoBlink 1.3s ease-in-out .65s infinite" }} />
        {[48, 62, 76, 90].flatMap((y, r) =>
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
        <path d="M44 120v-9a7 7 0 0 1 14 0v9z" fill="#FB923C" />
        <rect x="44" y="104" width="14" height="16" fill="#FDE68A" opacity=".4" style={{ animation: "dosLogoGlow 2s ease-in-out infinite" }} />
      </svg>
    );
  }

  if (k === "artists") {
    return (
      <svg {...svg}>
        <defs>
          <radialGradient id={id("bg")} cx=".5" cy=".35" r=".8">
            <stop offset="0" stopColor="#7C2D12" />
            <stop offset="1" stopColor="#1C0A0A" />
          </radialGradient>
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
        <rect width="100" height="120" fill={url("bg")} />
        <path d="M42 -4 H58 L84 104 H16 Z" fill={url("beam")} style={{ transformOrigin: "50px -4px", animation: "dosSceneBeam 4s ease-in-out infinite" }} />
        <ellipse cx="50" cy="104" rx="36" ry="9" fill={url("pool")} />
        {[0, 1, 2].map((i) => (
          <path key={`l${i}`} d={`M${i * 6} 0 q4 60 ${-2 + i} 120 h7 q-3 -60 1 -120z`} fill={url("curtain")} />
        ))}
        {[0, 1, 2].map((i) => (
          <path key={`r${i}`} d={`M${100 - i * 6} 0 q-4 60 ${2 - i} 120 h-7 q3 -60 -1 -120z`} fill={url("curtain")} />
        ))}
        <rect width="100" height="8" fill="#991B1B" />
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
        <defs>
          <linearGradient id={id("bg")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#0891B2" />
            <stop offset=".5" stopColor="#7C3AED" />
            <stop offset="1" stopColor="#DB2777" />
          </linearGradient>
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
        <rect width="100" height="120" fill={url("bg")} />
        <g style={{ transformOrigin: "50px 40px", animation: "dosSceneRays 14s linear infinite" }}>
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} d="M50 40 L46 -40 L54 -40 Z" fill="#FFFFFF" opacity={i % 2 ? 0.08 : 0.16} transform={`rotate(${i * 30} 50 40)`} />
          ))}
        </g>
        <path d="M50 0v18" stroke="#E2E8F0" strokeWidth="1" />
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
