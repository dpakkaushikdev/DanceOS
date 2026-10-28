import Link from "next/link";
import { DOS_DISPLAY } from "@/lib/design/tokens";
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
  return (
    <Link
      href={`/styles/${styleSlug(style)}`}
      aria-label={`Open ${style}`}
      data-testid="style-card"
      style={{ position: "relative", display: "block", aspectRatio: "4 / 5", borderRadius: small ? 14 : 18, overflow: "hidden", textDecoration: "none", background: `linear-gradient(150deg, ${color}, ${color}99)`, border: "1.5px solid var(--el)" }}
    >
      <span aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,.72) 100%)" }} />
      {/* ⚠ THE DANCER IS FITTED, NOT CROPPED (2 Oct 2026): the card frame keeps the
          whole figure above the name, its feet on the floor of that box — every
          style's outline is measured, so a Breaking freeze and a Ghoomar skirt
          both fill it whole */}
      <StyleArt style={style} frame="card" />
      <span style={{ position: "absolute", left: small ? 6 : 10, right: small ? 6 : 10, bottom: small ? 7 : 11, color: "#fff", textAlign: "center" }}>
        <span style={{ display: "block", fontSize: small ? 7.5 : 9, fontWeight: 900, letterSpacing: small ? 0.5 : 0.8, textTransform: "uppercase", opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{family}</span>
        {/* one line whatever the name (18 Oct 2026) — a long one steps down, then ellipsises */}
        <span title={style} style={{ display: "block", fontFamily: DOS_DISPLAY, fontWeight: 900, fontSize: nameSize, letterSpacing: -0.4, lineHeight: 1.2, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 1px 3px rgba(0,0,0,.35)" }}>{style}</span>
      </span>
      {/* the people who carry this style on their profile or want to learn it
          (10 Oct 2026, the user: "follower count on styles tile on discover") —
          the same pill a studio, an artist and a crew card wear */}
      {followers !== undefined ? <FollowerPill n={followers} /> : null}
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
