/** THE CODE SQUARE — A REAL QR SINCE 21 Sep 2026.
 *
 *  The user: *"qr code button should just open qr not link on all profiles code
 *  should look better as well."*
 *
 *  ⚠ WHAT THIS REPLACED WAS NOT A QR CODE. It was the prototype's own
 *  `dosHash` + `QRBlock` (6388, 6460) — three finder squares and a field of
 *  modules derived from a HASH of the string, so it looked like a code and
 *  encoded nothing. Its own comment said "real scanning arrives with the camera
 *  work later", and the camera work arrived on 19 Sep (the people picker's Scan
 *  sheet) while this stayed a drawing: **the one thing that sheet exists to read
 *  was decoration.** That is backlog row R27, and it is why "should look better"
 *  is answered by making it real rather than by restyling it.
 *
 *  `lib/qr/encode.ts` is the encoder, written here rather than taken as a
 *  dependency (its own comment says why, and how far its proof goes).
 *
 *  ⚠ WHAT "LOOKS BETTER" DOES **NOT** MEAN HERE: rounded modules. Readers
 *  locate a code by its three finder patterns and sample module centres, and
 *  every pixel of rounding is contrast taken off a corner the camera is using.
 *  A code that photographs a little prettier and scans a little worse is the
 *  trade this app keeps refusing. What it does mean: a real 4-module quiet zone
 *  (without which many readers simply never see the code), true black on white,
 *  crisp edges, and **contiguous dark modules drawn as ONE rect** — which
 *  removes the hairline seams sub-pixel rendering leaves between neighbours, and
 *  is the one change that is better to look at AND better to scan. */

import type { ReactNode } from "react";
import { qrMatrix } from "@/lib/qr/encode";

/** the spec's minimum, and it is not decoration: a reader needs the blank
 *  margin to find the code's edge at all */
const QUIET = 4;

/** under about this many CSS pixels a module, a phone camera will not resolve
 *  the code — a 37-module profile link inside 72px is 1.6px a module. The
 *  square is still DRAWN (it is a true code, and a screenshot of it enlarges),
 *  but it stops claiming to be scannable. */
const SCANNABLE_PX_PER_MODULE = 3;

/** ⚠ THE DEFAULT IS NEUTRAL, AND THAT IS A CORRECTION (29 Sep 2026). It read
 *  "Entry code" — the prototype's own word (6460) — and on 29 Sep the last
 *  caller that meant it went: a DOS-CL-#### square claiming to be a class's
 *  door key, which no door in this app has ever read. Every live caller names
 *  its own square (an invite code, a profile, a booking link), so what this
 *  default governs is the NEXT one, and it must not hand it a classPerson. */
/* ⚠ THE FANCY VARIANT (18 Oct 2026, the user: "qr code for all profiles should
   become more fancy make it good looking and smooth. with some unique qr
   patterns"). It reverses the "no rounding" refusal above for PROFILE codes
   only, and keeps what scanning actually needs: the 4-module quiet zone, the
   three finder patterns drawn as solid eyes, a dark ink on white (every palette
   below is deep enough for > 7:1), and modules that still cover their centre —
   a dot of radius .44 or a rounded square of .9 is sampled exactly where a
   reader samples. The STYLE and the PALETTE are picked by a hash of the code,
   so every profile's square is its own and the same profile is always the same. */
const FANCY_PALETTES: Array<[string, string]> = [
  ["#4C1D95", "#BE185D"],
  ["#0F3D5E", "#0E7490"],
  ["#7C2D12", "#B45309"],
  ["#14532D", "#0F766E"],
  ["#312E81", "#1D4ED8"],
  ["#831843", "#6D28D9"],
  ["#1F2937", "#7C3AED"],
];
const FANCY_STYLES = ["dots", "rounded", "squircle"] as const;
const hashOf = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

function FancyQR({ code, size, label, matrix }: { code: string; size: number; label: string; matrix: { size: number; modules: boolean[][] } }) {
  const n = matrix.size;
  const span = n + QUIET * 2;
  const h = hashOf(code);
  const [c1, c2] = FANCY_PALETTES[h % FANCY_PALETTES.length];
  const style = FANCY_STYLES[(h >>> 8) % FANCY_STYLES.length];
  const gid = `qrg-${h.toString(36)}`;
  const inEye = (x: number, y: number) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  const cells: ReactNode[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!matrix.modules[y][x] || inEye(x, y)) continue;
      const px = x + QUIET;
      const py = y + QUIET;
      if (style === "dots") cells.push(<circle key={`${x}-${y}`} cx={px + 0.5} cy={py + 0.5} r={0.44} />);
      else if (style === "rounded") cells.push(<rect key={`${x}-${y}`} x={px + 0.05} y={py + 0.05} width={0.9} height={0.9} rx={0.32} />);
      else cells.push(<rect key={`${x}-${y}`} x={px + 0.04} y={py + 0.04} width={0.92} height={0.92} rx={0.18} />);
    }
  }
  const eye = (ex: number, ey: number) => (
    <g key={`eye-${ex}-${ey}`}>
      <path
        fillRule="evenodd"
        d={`M${ex + 1.9} ${ey}h3.2a1.9 1.9 0 0 1 1.9 1.9v3.2a1.9 1.9 0 0 1-1.9 1.9h-3.2a1.9 1.9 0 0 1-1.9-1.9v-3.2a1.9 1.9 0 0 1 1.9-1.9z M${ex + 2.1} ${ey + 1}h2.8a1.1 1.1 0 0 1 1.1 1.1v2.8a1.1 1.1 0 0 1-1.1 1.1h-2.8a1.1 1.1 0 0 1-1.1-1.1v-2.8a1.1 1.1 0 0 1 1.1-1.1z`}
      />
      <rect x={ex + 2} y={ey + 2} width={3} height={3} rx={style === "dots" ? 1.5 : 0.9} />
    </g>
  );
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${span} ${span}`}
      role="img"
      aria-label={`${label} ${code}`}
      data-qr-modules={n}
      data-qr-style={style}
      data-qr-scannable={size / span >= SCANNABLE_PX_PER_MODULE ? "yes" : "small"}
      style={{ background: "#fff", borderRadius: 18, flexShrink: 0, display: "block" }}
    >
      <defs>
        {/* userSpaceOnUse: ONE sweep across the code, not a gradient repeated inside every dot */}
        <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={span} y2={span}>
          <stop offset="0" stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={span} height={span} fill="#fff" />
      <g fill={`url(#${gid})`}>
        {cells}
        {eye(QUIET, QUIET)}
        {eye(QUIET + n - 7, QUIET)}
        {eye(QUIET, QUIET + n - 7)}
      </g>
    </svg>
  );
}

export function QRBlock({
  code,
  size = 96,
  label = "QR code",
  variant = "plain",
}: {
  code: string;
  size?: number;
  label?: string;
  variant?: "plain" | "fancy";
}) {
  let matrix: { size: number; modules: boolean[][] } | null = null;
  try {
    matrix = qrMatrix(code);
  } catch {
    /* over capacity, or something unencodable — never take a page down over a
       picture of a link. The text is always printed beside this by its caller. */
    matrix = null;
  }

  if (!matrix) {
    return (
      <div
        role="img"
        aria-label={`${label} ${code}`}
        style={{
          width: size,
          height: size,
          borderRadius: 10,
          background: "var(--card)",
          border: "1px dashed var(--el)",
          display: "grid",
          placeItems: "center",
          fontSize: 10.5,
          fontWeight: 800,
          color: "var(--muted)",
          textAlign: "center",
          padding: 8,
          boxSizing: "border-box",
          flexShrink: 0,
        }}
      >
        Too long for a code
      </div>
    );
  }

  if (variant === "fancy") return <FancyQR code={code} size={size} label={label} matrix={matrix} />;

  const n = matrix.size;
  const span = n + QUIET * 2;
  const perModule = size / span;

  /* ⚠ ONE RECT PER RUN, NOT PER MODULE. Two rects sharing an edge at a
     fractional pixel leave a seam the camera reads as a lighter module; merged,
     the run is one shape with one edge. It also cuts the node count by roughly
     half on a version-10 code. */
  const runs: Array<{ x: number; y: number; w: number }> = [];
  for (let y = 0; y < n; y++) {
    let start = -1;
    for (let x = 0; x <= n; x++) {
      const on = x < n && matrix.modules[y][x];
      if (on && start < 0) start = x;
      else if (!on && start >= 0) {
        runs.push({ x: start, y, w: x - start });
        start = -1;
      }
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${span} ${span}`}
      role="img"
      aria-label={`${label} ${code}`}
      data-qr-modules={n}
      data-qr-scannable={perModule >= SCANNABLE_PX_PER_MODULE ? "yes" : "small"}
      shapeRendering="crispEdges"
      style={{
        background: "#fff",
        borderRadius: 12,
        flexShrink: 0,
        display: "block",
      }}
    >
      {/* the quiet zone is part of the code, so it is painted, not left to
          whatever happens to be behind the element */}
      <rect x="0" y="0" width={span} height={span} fill="#fff" />
      {runs.map((r) => (
        <rect key={`${r.y}-${r.x}`} x={r.x + QUIET} y={r.y + QUIET} width={r.w} height={1} fill="#000" />
      ))}
    </svg>
  );
}
