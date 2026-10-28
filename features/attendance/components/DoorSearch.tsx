"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { searchPeopleAction } from "@/features/people/server-actions/people";
import { gradientOf } from "@/features/profiles/components/profile-kit";
import { NAME_MAX } from "@/lib/constants/names";
import { plainError } from "@/lib/errors";
import { photoUrl } from "@/lib/media/photo";
import type { Profile } from "@/types/profile";

type Hit = Profile & { isArtist: boolean };

/** THE DOOR'S SEARCH BOX (18 Oct 2026, the user: "attendance walk in search bar
 *  should work like search on discover with only user or artist names").
 *
 *  Discover's own dropdown — the box, a list under it in sections, a face and a
 *  name per row — over PEOPLE only: `searchPeopleAction`, the one people search,
 *  which returns users and artists and nothing else (a studio or a crew cannot
 *  be checked in to a class). Each section is headed the way Discover heads
 *  its own: Artists, then Users.
 *
 *  Picking somebody is the same act as scanning their code: the register books
 *  them if they hold no seat and checks them in (`onPick` → `scanCheckIn`).
 *  ⚠ The walk-in by NAME (R60) stays as the dropdown's last row, for the person
 *  standing there who is not on DanceOS at all — said in words, so it is never
 *  mistaken for a search result. */
export function DoorSearch({
  value,
  onChange,
  onPick,
  onWalkIn,
  busy,
  onRegister,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (p: Hit) => void;
  onWalkIn: () => void;
  busy: boolean;
  /** who already holds a seat, so a row can say so before it is pressed */
  onRegister: (userId: string) => "in" | "booked" | null;
}) {
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const seq = useRef(0);
  const term = value.trim();

  useEffect(() => {
    if (term.length < 2) return;
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      setSearching(true);
      const out = await searchPeopleAction({ term });
      if (mine !== seq.current) return;
      setSearching(false);
      setHits(out.people);
      setErr(out.error);
    }, 220);
    return () => clearTimeout(t);
  }, [term]);

  const shown = term.length >= 2 ? hits : [];
  const groups: Array<[string, Hit[]]> = [
    ["ARTISTS", shown.filter((h) => h.isArtist)],
    ["DANCERS", shown.filter((h) => !h.isArtist)],
  ];

  return (
    <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            /* Enter picks the first person found; with nobody found it does nothing */
            if (shown[0]) {
              onPick(shown[0]);
              setOpen(false);
            }
          }
        }}
        maxLength={NAME_MAX}
        placeholder="Search by name"
        aria-label="Search DanceOS for somebody at the door"
        autoComplete="off"
        data-testid="door-name"
        disabled={busy}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "12px 14px",
          borderRadius: 999,
          border: "1.5px solid var(--el)",
          background: "var(--card)",
          color: "var(--text)",
          fontSize: 12.5,
          fontFamily: "inherit",
          textTransform: "none",
          outline: "none",
        }}
      />
      {open && term.length >= 2 ? (
        <div
          role="listbox"
          aria-label="People at the door"
          data-testid="door-results"
          style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 400, background: "var(--solid)", border: "1.5px solid var(--el)", borderRadius: 16, maxHeight: 340, overflowY: "auto", boxShadow: "0 14px 40px rgba(0,0,0,.5)" }}
        >
          {searching && shown.length === 0 ? <div style={{ padding: "16px 14px", fontSize: 12.5, color: "var(--sub)", textAlign: "center" }}>Searching…</div> : null}
          {!searching && shown.length === 0 ? (
            <div style={{ padding: "16px 14px", fontSize: 12.5, color: "var(--sub)", textAlign: "center" }}>{err ? plainError(err) : "Nobody by that name."}</div>
          ) : null}
          {groups
            .filter(([, list]) => list.length > 0)
            .map(([label, list]) => (
              <div key={label}>
                <div style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: 1.1, color: "var(--muted)", padding: "10px 14px 4px" }}>{label}</div>
                {list.map((h) => {
                  const g = gradientOf(h.fullName);
                  const face = photoUrl(h.avatarPath);
                  const initials = h.fullName.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
                  const state = onRegister(h.id);
                  const sub = [h.isArtist ? "Artist" : "Dancer", h.city, state === "in" ? "Already in" : state === "booked" ? "Booked" : null].filter(Boolean).join(" · ");
                  return (
                    <button
                      key={h.id}
                      type="button"
                      role="option"
                      aria-selected={false}
                      aria-label={`Check ${h.fullName} in`}
                      data-testid="door-hit"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onPick(h);
                        setOpen(false);
                      }}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 14px", cursor: "pointer", color: "var(--text)", background: "transparent", border: "none", textAlign: "left", fontFamily: "inherit" }}
                    >
                      <span style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, overflow: "hidden", background: `linear-gradient(135deg,${g[0]},${g[1]})`, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 12 }}>
                        {face ? <Image src={face} alt="" width={34} height={34} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : initials}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.fullName}</span>
                        <span style={{ display: "block", fontSize: 11, color: "var(--sub)" }}>{sub}</span>
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 900, color: state === "in" ? "var(--sub)" : "#22C55E" }}>{state === "in" ? "In" : "Check in ›"}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          {/* not on DanceOS — the walk-in by name, last and said in words */}
          <button
            type="button"
            data-testid="door-walk-in"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onWalkIn();
              setOpen(false);
            }}
            style={{ display: "block", width: "100%", padding: "11px 14px", borderTop: "1.5px solid var(--el)", background: "transparent", borderLeft: "none", borderRight: "none", borderBottom: "none", color: "var(--sub)", fontSize: 12, fontWeight: 700, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}
          >
            Not on DanceOS? Add “{term}” as a walk-in
          </button>
        </div>
      ) : null}
    </div>
  );
}
