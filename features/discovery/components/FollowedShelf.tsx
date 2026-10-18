import Image from "next/image";
import Link from "next/link";
import { DOS_DISPLAY, DOS_TINT, INK } from "@/lib/design/tokens";
import { ShelfHead, initialsOf } from "./discover-kit";
import { TopPanel } from "@/components/ui/TopPanel";
import { StyleArt } from "@/features/styles/components/StyleArt";

/* "crew" since 2 Oct 2026 — a crew has been followable since 19 Sep, and the
   Crews tab drew no shelf because this union said it could not */
/* "style" since 10 Oct 2026 — the Styles tab's shelf is the styles you dance and
   the ones you want to learn, each drawn as its own dancer on its own colour */
export type FollowedKind = "studio" | "artist" | "crew" | "style";

export interface FollowedTile {
  id: string;
  name: string;
  kind: FollowedKind;
  href: string;
  photo: string | null;
  grad: [string, string];
  /** a style tile: the style whose dancer is drawn on the face */
  style?: string;
  /** the word under the name, when the kind alone does not say it ("You dance", "To learn") */
  tag?: string;
}

/* ⚠ a STUDIO tile borrowed `DOS_TINT.org` — the studio blue an organization wore
   — and that key went with organizations (29 Sep 2026), so the colour is stated
   here instead. It is unchanged on screen. */
const TINT: Record<FollowedKind, string> = { studio: "#3B82F6", artist: DOS_TINT.artist, crew: "#EF4444", style: "#5AC8FA" };

/** "Followed by you" (prototype FollowedRow 4112-4144), heading the Studios and
 *  Artists tabs for a signed-in person: the count beside the heading, then a
 *  swiped rail of 74px squircle tiles — the face (or initials on the gradient),
 *  the name on one line, and the kind in its own tint. NO STAR: "the words are
 *  the label; the shelf is the fact." The Crews tab draws the crews you follow
 *  since 2 Oct 2026 (the user: "followed crews also dont appear in the followed
 *  by you row on discover"). */
export function FollowedShelf({ rows }: { rows: FollowedTile[] }) {
  if (rows.length === 0) return null;
  /* ⚠ ITS OWN SQUIRCLE, BETWEEN THE TWO (3 Oct 2026, the user: "followed by you
     section on discover in seprated squircle card in middle section") — the same
     card the top of the page is, untinted, so Discover reads as three shapes:
     the head, what you follow, and the shelf on the opposite theme */
  return (
    <TopPanel testId="followed-shelf" style={{ marginTop: 12 }}>
      {/* ⚠ THE SAME HEADING AS THE SHELF BELOW (18 Oct 2026, the user: "followed
          by you section should also have same heading as above with same totals
          style") — one component, `ShelfHead`, so the two cannot drift */}
      <div style={{ marginBottom: 10 }}>
        <ShelfHead title="Followed by you" count={rows.length} unit="followed" testId="followed-count" />
      </div>
      {/* ⚠ THE RING WAS CUT (18 Oct 2026, the user: "followed by you circles
          getting cut"). The ring is a box-shadow 3.5px OUTSIDE the 74px face, and
          `overflow-x: auto` turns overflow-y to auto too, so the scroller clipped
          the ring's top, the first tile's left edge and the last tile's right.
          The rail carries 6px of room on every side for the ring, and a negative
          margin of the same so the tiles still line up with the heading. */}
      <div style={{ display: "flex", gap: 12, overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none", padding: 6, margin: "-2px -6px -6px" }}>
        {rows.map((x) => (
          <Link key={x.id} href={x.href} aria-label={x.style ? `${x.name} — ${x.tag ?? "your style"}` : `${x.name} — followed ${x.kind}`} data-testid={x.style ? "followed-style" : undefined} style={{ flexShrink: 0, width: 74, color: INK, textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center" }}>
            {/* the kind's own tint rings the face — the word under the name is
                gone (18 Oct 2026, "remove sub heading below name in this
                section"), so the ring is the only thing that still tells a studio
                from an artist at a glance */}
            <div style={{ width: 74, height: 74, borderRadius: "50%", background: `linear-gradient(135deg,${x.grad[0]},${x.grad[1]})`, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box", position: "relative", overflow: "hidden", boxShadow: `0 0 0 2px var(--card), 0 0 0 3.5px ${TINT[x.kind]}` }}>
              {x.style ? <StyleArt style={x.style} frame="page" /> : x.photo ? <Image src={x.photo} alt="" fill sizes="74px" style={{ objectFit: "cover" }} /> : <span style={{ color: "#fff", fontSize: 21, fontWeight: 900, fontFamily: DOS_DISPLAY, lineHeight: 1 }}>{initialsOf(x.name)}</span>}
            </div>
            {/* the NAME alone, centred under the picture — 9px since 18 Oct 2026
                (the user: "name below pic should be smaller") */}
            <span title={x.name} style={{ display: "block", width: "100%", marginTop: 6, fontSize: 9, fontWeight: 700, color: "var(--sub)", lineHeight: 1.25, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.name}</span>
          </Link>
        ))}
      </div>
    </TopPanel>
  );
}
