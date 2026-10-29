"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { searchEverythingAction } from "@/features/discovery/server-actions/search";
import { gradientOf } from "@/features/profiles/components/profile-kit";
import { photoUrl } from "@/lib/media/photo";
import { BTN_RESET } from "@/components/ui/buttonReset";
import type { SearchHit, SearchKind } from "@/repositories/search";
import { ALL_CITIES } from "../filters";

/** THE ONE SEARCH BOX (lifted out of DiscoverFilters, 29 Oct 2026, so Pulse and
 *  Discover draw the same control — two copies of a search box are two search
 *  boxes that will drift). Everything, in sections (prototype 4535-4575):
 *  Studios · Artists · Crews · People, three each, "No matches anywhere on
 *  DanceOS." Nothing about it changed in the move. */

const micro: React.CSSProperties = { fontSize: 9.5, fontWeight: 800, letterSpacing: 0.7, textTransform: "uppercase" };
const KIND_LABEL: Record<SearchKind, string> = { studio: "Studios", artist: "Artists", crew: "Crews", person: "People" };
/* the prototype's own order, with Dancers last (4548-4552) */
const KIND_ORDER: SearchKind[] = ["studio", "artist", "crew", "person"];

export function SearchBox({ city, margin = "12px 0 4px", placeholder = "Search" }: { city: string; margin?: string; placeholder?: string }) {
  const [q, setQ] = useState("");
  const [searchOn, setSearchOn] = useState(false);
  const [answer, setAnswer] = useState<{ term: string; hits: SearchHit[] }>({ term: "", hits: [] });
  const term = q.trim();

  /* ⚠ THE CITY IS A PASSENGER, NOT AN INPUT (30 Sep 2026). It rides along for
     the LOG alone — the search itself is national — so it is read through a ref
     at send time rather than listed as a dependency: a city change with a term
     still in the box would otherwise fire a SECOND identical query. Synced in its
     own effect, because this repo's lint forbids a ref write during render. */
  const cityRef = useRef(city);
  useEffect(() => {
    cityRef.current = city;
  }, [city]);

  useEffect(() => {
    if (term.length < 2) return;
    let live = true;
    const t = setTimeout(async () => {
      const out = await searchEverythingAction({ term, city: cityRef.current === ALL_CITIES ? "" : cityRef.current });
      if (live) setAnswer({ term, hits: out.hits });
    }, 220);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [term]);
  const hits = answer.term === term ? answer.hits : [];
  const searching = term.length >= 2 && answer.term !== term;

  return (
    <div style={{ position: "relative", margin }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        value={q}
        aria-label="Search DanceOS"
        onChange={(e) => setQ(e.target.value.slice(0, 60))}
        onFocus={() => setSearchOn(true)}
        onBlur={() => setTimeout(() => setSearchOn(false), 180)}
        placeholder={placeholder}
        autoComplete="off"
        style={{ width: "100%", boxSizing: "border-box", background: "var(--card)", border: "1.5px solid var(--el)", borderRadius: 14, padding: "13px 40px 13px 38px", color: "var(--text)", fontSize: 13.5, outline: "none", fontFamily: "inherit" }}
      />
      {q ? (
        <button type="button" aria-label="Clear search" onClick={() => setQ("")} style={{ ...BTN_RESET, position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "var(--sub)", cursor: "pointer", fontWeight: 800, fontSize: 13 }}>
          ✕
        </button>
      ) : null}
      {searchOn && term.length >= 2 ? (
        <div role="listbox" aria-label="Search results" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 400, background: "var(--solid)", border: "1.5px solid var(--el)", borderRadius: 16, maxHeight: 340, overflowY: "auto", boxShadow: "0 14px 40px rgba(0,0,0,.5)" }}>
          {searching && hits.length === 0 ? <div style={{ padding: "18px 14px", fontSize: 12.5, color: "var(--sub)", textAlign: "center" }}>Searching…</div> : null}
          {!searching && hits.length === 0 ? <div style={{ padding: "18px 14px", fontSize: 12.5, color: "var(--sub)", textAlign: "center" }}>No matches anywhere on DanceOS.</div> : null}
          {KIND_ORDER.filter((k) => hits.some((h) => h.kind === k)).map((k) => (
            <div key={k}>
              <div style={{ ...micro, color: "var(--muted)", padding: "10px 14px 4px" }}>{KIND_LABEL[k]}</div>
              {hits
                .filter((h) => h.kind === k)
                .map((h) => {
                  const g = gradientOf(h.name);
                  /* the picture where there is one (20 Sep 2026); initials are the fallback */
                  const face = photoUrl(h.photoPath);
                  const initials = h.name.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
                  return (
                    <Link key={h.id} href={h.href} role="option" aria-label={`${h.name} — ${h.sub}`} onMouseDown={(e) => e.preventDefault()} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", cursor: "pointer", color: "var(--text)", textDecoration: "none" }}>
                      <span style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, overflow: "hidden", background: `linear-gradient(135deg,${g[0]},${g[1]})`, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 12 }}>
                        {face ? <Image src={face} alt="" width={34} height={34} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : initials}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</span>
                        <span style={{ display: "block", fontSize: 11, color: "var(--sub)" }}>{h.sub}</span>
                      </span>
                      <span style={{ color: "var(--sub)", fontSize: 12 }}>›</span>
                    </Link>
                  );
                })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
