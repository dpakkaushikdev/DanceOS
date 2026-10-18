import type { ReactNode } from "react";
import { AmenityIcon, amenityLabel } from "@/components/ui/AmenityIcon";
import { FigureHead } from "@/components/ui/FigureHead";
import { ShelfHead } from "@/features/discovery/components/discover-kit";
import { InvertedPanel } from "@/components/ui/InvertedPanel";
import { DOS_DISPLAY } from "@/lib/design/tokens";
import { splitAddress } from "@/lib/format/address";
import type { Room } from "@/types/room";

/** THE STUDIO ITSELF — WHERE IT IS, WHAT ITS ROOMS HAVE, WHAT IT SELLS (5 Oct 2026).
 *
 *  The user: *"Studio Public page- below Schedule should have full adrees and
 *  rooms with amenities mentioned alongside membership in a seprate segragation
 *  and others from next session below that."*
 *
 *  So the studio's page is three shapes now: the top squircle (the hero, the
 *  buttons, the Schedule bar), THIS — a section of its own on the page's theme
 *  holding the place and what is on sale — and the lower one with the next
 *  sessions and the team.
 *
 *  ⚠ THE ADDRESS IS THE CLASS PAGE'S OWN BOX (`class-address`, 4 Oct 2026) and the
 *  room tile is its room tile, so a studio's address and a room's amenities read
 *  the same way on the studio's page and on every class held there. The words
 *  come from `fullAddressOf` — the pin resolved, or the area and city — which is
 *  the Rooms desk's sentence too.
 *
 *  ⚠ NO MAPS BUTTON HERE: the Location button in the top squircle already opens
 *  the pin, and two doors to one subject is the shape C31 and C51 each undid. */
export function StudioPlace({
  address,
  rooms,
  tint,
  children,
}: {
  address: string;
  rooms: Room[];
  tint: string;
  /** what the studio sells — drawn under the rooms, inside this section */
  children?: ReactNode;
}) {
  const lines = splitAddress(address);
  const micro = { fontSize: 9, fontWeight: 900, letterSpacing: 0.9, color: "var(--muted)" } as const;
  return (
    <InvertedPanel ground="page" testId="studio-place">
      <ShelfHead title="At the studio" margin="0 0 10px" />

      {/* ── WHERE — the address in words, street first, then city · state · PIN ── */}
      <div style={micro}>ADDRESS</div>
      <div data-testid="studio-address" style={{ display: "flex", alignItems: "flex-start", gap: 9, marginTop: 6, padding: "10px 11px", borderRadius: 13, background: "var(--el)" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={tint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
          <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
          <circle cx="12" cy="10" r="2.3" />
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text)", lineHeight: 1.4, overflowWrap: "anywhere" }}>{lines.street || "No address on record yet"}</div>
          {lines.locality ? <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, lineHeight: 1.4 }}>{lines.locality}</div> : null}
        </div>
      </div>

      {/* ── THE ROOMS, each with what it HAS — the amenities belong to the room,
          not to the studio, so they are drawn inside its tile ── */}
      {rooms.length > 0 ? (
        <>
          <FigureHead
            margin="14px 0 6px"
            title={<span style={micro}>ROOMS</span>}
            figure={<span style={{ fontSize: 10.5, fontWeight: 800, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{rooms.length}</span>}
          />
          {/* ⚠ SMALLER ROOM CARDS, THE CAPACITY SAID PROPERLY (11 Oct 2026, the
              user: "At the studio section on studio profiles should have smaller
              room cards and capacity written properly"). Two to a row, the name
              at a card's size rather than a heading's, and the capacity a figure
              with its word — "20 · Capacity" — where it read "Holds 20" in grey
              beside the name. The amenities stay inside the room they belong to. */}
          {/* ⚠⚠ ONE ROOM, ONE FULL-WIDTH CARD, AND THE AMENITIES AS A LIST (18 Oct
              2026, the user: "room amenities can be written in a better ui ux too
              cramped right now fix rooms at the studio"). Two to a row left each
              room ~150px, so a third chip wrapped into a ragged pile. Now the name
              and the capacity share the card's head, and the amenities sit under a
              hairline as a two-column list — an icon in a tinted square and the
              word beside it — which reads as "what this room has" at a glance. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {rooms.map((r) => (
              <div key={r.id} data-testid="studio-room" style={{ padding: "12px 13px", borderRadius: 15, background: `${tint}0d`, border: "1.5px solid var(--el)", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div data-testid="studio-room-name" style={{ flex: 1, minWidth: 0, fontFamily: DOS_DISPLAY, fontSize: 16, fontWeight: 800, letterSpacing: -0.3, lineHeight: 1.2, color: "var(--text)", overflowWrap: "anywhere" }}>
                    {r.name}
                  </div>
                  <div data-testid="studio-room-capacity" aria-label={`Capacity ${r.capacity} people`} style={{ flexShrink: 0, display: "inline-flex", alignItems: "baseline", gap: 5, padding: "4px 10px", borderRadius: 999, background: `${tint}1c`, border: `1.5px solid ${tint}33` }}>
                    <span style={{ fontSize: 14, fontWeight: 900, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{r.capacity}</span>
                    <span style={{ ...micro, color: "var(--sub)" }}>CAPACITY</span>
                  </div>
                </div>
                <div style={{ height: 1, background: "var(--el)", margin: "10px 0" }} />
                {r.amenities.length > 0 ? (
                  <ul data-testid="studio-room-amenities" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))", gap: "8px 10px" }}>
                    {r.amenities.map((a) => (
                      <li key={a} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <span aria-hidden="true" style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", background: `${tint}2e`, color: tint }}>
                          <AmenityIcon value={a} size={14} color={tint} />
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", lineHeight: 1.25, overflowWrap: "anywhere" }}>{amenityLabel(a)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>No amenities listed</span>
                )}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {children}
    </InvertedPanel>
  );
}
