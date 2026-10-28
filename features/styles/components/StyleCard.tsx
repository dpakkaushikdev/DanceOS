import Link from "next/link";
import { DOS_DISPLAY, INK } from "@/lib/design/tokens";
import { dosStyleColor } from "@/lib/constants/styles";
import { styleInfo, styleSlug } from "@/lib/constants/styleInfo";
import { StyleArt } from "./StyleArt";
import { FollowerPill } from "@/features/discovery/components/discover-kit";

/** a dance style on Discover's Styles tab (2 Oct 2026): its drawn dancer on the
 *  style's own colour, its name across the foot, its family above — a door to
 *  the style's own page. */
/* ⚠ NO "N CLASSES IN {CITY}" ON THE FACE (18 Oct 2026, the user: "remove classes
   in gurgaon etc from the style tiles should not appear outside. should be
   centrally aligned with pics"). The count still ORDERS the shelf and still
   answers the "Classes in …" filter; it is simply not printed on the tile, and
   the family and the name sit centred under the dancer. */
export function StyleCard({ style, followers, small = false }: { style: string; followers?: number; small?: boolean }) {
  const color = dosStyleColor(style);
  const { family } = styleInfo(style);
  /* `small`: three to a row on Discover (29 Oct 2026, the user: "reduce size of
     artist and dance style cards") — the same card, its words a step down */
  const nameSize = small ? (style.length > 11 ? 11 : 13) : style.length > 14 ? 14 : 17;
  /* ⚠ THE ARTIST CARD'S SHAPE (29 Oct 2026, the user: "segregate lower half of
     dance style like its done for artist"): the dancer in a square picture on the
     style's colour, and under it a section of its own on the card — the family,
     the name and the follower count. The words no longer sit over the art. */
  return (
    <Link
      href={`/styles/${styleSlug(style)}`}
      aria-label={`Open ${style}`}
      data-testid="style-card"
      style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: small ? 4 : 7, padding: small ? 7 : 11, borderRadius: small ? 15 : 18, textDecoration: "none", background: "var(--card)", border: "1.5px solid var(--el)", color: INK }}
    >
      {/* ⚠ THE DANCER IS FITTED, NOT CROPPED (2 Oct 2026) — the page frame keeps
          the whole figure inside the square */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", borderRadius: small ? 11 : 14, overflow: "hidden", background: `linear-gradient(150deg, ${color}, ${color}99)`, boxShadow: "0 6px 16px -8px rgba(0,0,0,.6)" }}>
        <StyleArt style={style} frame="page" />
        {/* the people who dance it or want to learn it (10 Oct 2026), back on the
            picture's top-right like every Discover card (29 Oct 2026) */}
        {followers !== undefined ? <FollowerPill n={followers} /> : null}
      </div>
      <div style={{ minWidth: 0, padding: small ? "2px 1px 1px" : "4px 2px 2px", textAlign: "center" }}>
        <div style={{ fontSize: small ? 7.5 : 9, fontWeight: 900, letterSpacing: small ? 0.5 : 0.8, textTransform: "uppercase", color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{family}</div>
        {/* one line whatever the name (18 Oct 2026) — a long one steps down, then ellipsises */}
        <div title={style} style={{ fontFamily: DOS_DISPLAY, fontWeight: 900, fontSize: nameSize, letterSpacing: -0.4, lineHeight: 1.2, marginTop: 2, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{style}</div>
      </div>
    </Link>
  );
}

/** the Styles tab's mark: a dancer mid-turn, the skirt flaring */
export function StyleI({ size = 26, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="4.2" r="1.8" />
      <path d="M12 6.5v5.5" />
      <path d="M12 8.2l-4.5-2.2M12 8.2l4.2 3" />
      <path d="M7 20.5l5-8.5 5 8.5z" />
    </svg>
  );
}
