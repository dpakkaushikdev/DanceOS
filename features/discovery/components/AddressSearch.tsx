"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BTN_RESET } from "@/components/ui/buttonReset";
import type { PlaceSuggestion, ResolvedPlace } from "@/features/geo/components/PlaceSearch";
import { NEAR_CENTRE, formatPoint, hereCookie, nearestCity, type Point } from "@/lib/geo/here";
import { ALL_CITIES } from "@/features/discovery/filters";

type CityCentre = { city: string; lat: number; lng: number };

const micro: React.CSSProperties = { fontSize: 9.5, fontWeight: 800, letterSpacing: 0.7, textTransform: "uppercase" };

/** SEARCH AN ADDRESS — DISCOVER'S ONE PLACE CONTROL (29 Oct 2026, the user:
 *  "search on discover should be replaced by search an address, the drop down
 *  for search an address should also be like the search on pulse, merge nearby
 *  with the search an address and remove the city drop down from it").
 *
 *  It replaces both the "Search DanceOS" box (Pulse keeps that one) and the
 *  place chip (C45/C95). The box SHOWS where the page is measured from — the
 *  address, "Near me · {city}", or the city — and typing in it searches Google's
 *  places, in the Pulse search box's own dropdown. ◎ Near me is the first row,
 *  All cities the second (C95's option, kept so nothing is lost).
 *
 *  ⚠ The served city follows the point: an address further than 75 km from
 *  every city DanceOS serves is refused in words, exactly as the chip did.
 *  ⚠ Every pick REPLACES the address — where the list is measured from is a
 *  setting of this page, not a page of its own (19 Sep 2026). */
export function AddressSearch({
  city,
  cities,
  tab,
  extra,
  near,
  at,
}: {
  city: string;
  cities: CityCentre[];
  tab: string;
  extra: Record<string, string>;
  /** the point the page is measured from right now, if any */
  near: Point | null;
  /** the typed address it is measured from, when it is one */
  at: string | null;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /* `signIn`: the address lookup is a signed-in person's (an open geocoder is
     the Maps quota spent on anybody's behalf), so a stranger is told so rather
     than shown "no places" */
  const [answer, setAnswer] = useState<{ term: string; places: PlaceSuggestion[]; signIn?: boolean }>({ term: "", places: [] });
  const seq = useRef(0);
  const term = q.trim();

  const cityShown = city && city !== ALL_CITIES ? city : null;
  const centre = cities.find((c) => c.city === cityShown) ?? null;
  const showing = busy ? "Finding you…" : at ? at : near ? (cityShown ? `Near me · ${cityShown}` : "Near me") : cityShown ?? "All cities";

  useEffect(() => {
    if (term.length < 2) return;
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const p = new URLSearchParams({ q: term });
        if (centre) {
          p.set("lat", String(centre.lat));
          p.set("lng", String(centre.lng));
        }
        const res = await fetch(`/api/places?${p.toString()}`);
        if (res.status === 401) {
          if (mine === seq.current) setAnswer({ term, places: [], signIn: true });
          return;
        }
        const body = (await res.json()) as { places?: PlaceSuggestion[] };
        if (mine === seq.current) setAnswer({ term, places: body.places ?? [] });
      } catch {
        if (mine === seq.current) setAnswer({ term, places: [] });
      }
    }, 250);
    return () => clearTimeout(t);
  }, [term, centre]);
  const places = answer.term === term ? answer.places : [];
  const signIn = answer.term === term && answer.signIn === true;
  const searching = term.length >= 2 && answer.term !== term;

  const go = (nextCity: string, nextNear: Point | null, label: string | null = null) => {
    const p = new URLSearchParams({ city: nextCity, tab, ...extra });
    /* a radius only means something on an unmeasured page for the Studios
       shelf (measured from the city's centre) — elsewhere it would sit on the
       Filters button counting for nothing */
    if (!nextNear && tab !== "studios") p.delete("dist");
    /* a city picked by hand says so (`near=centre`), or the phone's own point
       would switch straight back on */
    p.set("near", nextNear ? formatPoint(nextNear) : NEAR_CENTRE);
    if (nextNear && label) p.set("at", label.slice(0, 80));
    setQ("");
    setOpen(false);
    router.replace(`/discover?${p.toString()}`, { scroll: false });
  };

  const askWhereIAm = () => {
    if (!("geolocation" in navigator)) {
      setErr("This browser will not share where you are.");
      return;
    }
    setBusy(true);
    setErr(null);
    setOpen(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        document.cookie = hereCookie(p, location.protocol === "https:");
        const served = nearestCity(cities, p);
        if (!served) {
          setErr("DanceOS isn't where you are yet — search an address instead.");
          return;
        }
        go(served, p);
      },
      () => {
        setBusy(false);
        setErr("Location not shared — search an address instead.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  };

  const pickPlace = async (s: PlaceSuggestion) => {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/places?place=${encodeURIComponent(s.id)}`);
      const body = (await res.json()) as { place?: ResolvedPlace | null };
      const place = body.place;
      setBusy(false);
      if (!place) {
        setErr("That place could not be found — try another.");
        return;
      }
      const p = { lat: place.lat, lng: place.lng };
      const served = nearestCity(cities, p);
      if (!served) {
        setErr(`DanceOS isn't in ${place.city ?? "that area"} yet — try another address.`);
        return;
      }
      go(served, p, s.main || place.label || place.area || served);
    } catch {
      setBusy(false);
      setErr("That place could not be found — try another.");
    }
  };

  const row: React.CSSProperties = { ...BTN_RESET, display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 14px", cursor: "pointer", color: "var(--text)", textAlign: "left" };
  const icon = (bg: string): React.CSSProperties => ({ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: bg, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 15 });
  const placed = Boolean(at || near);

  return (
    <div data-testid="address-search" style={{ position: "relative", margin: "12px 0 4px" }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={placed ? "var(--text)" : "var(--muted)"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
        <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
        <circle cx="12" cy="9.5" r="2.5" />
      </svg>
      <input
        value={q}
        aria-label="Search an address"
        onChange={(e) => setQ(e.target.value.slice(0, 80))}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        placeholder={showing}
        autoComplete="off"
        style={{ width: "100%", boxSizing: "border-box", background: "var(--card)", border: "1.5px solid var(--el)", borderRadius: 14, padding: "13px 40px 13px 38px", color: "var(--text)", fontSize: 13.5, outline: "none", fontFamily: "inherit" }}
        className={placed ? "dos-address-placed" : undefined}
      />
      {/* the placeholder of a measured page reads in ink, not grey — it is the answer, not a hint */}
      {placed ? <style>{".dos-address-placed::placeholder{color:var(--text);opacity:1;font-weight:700}"}</style> : null}
      {q ? (
        <button type="button" aria-label="Clear the address search" onClick={() => setQ("")} style={{ ...BTN_RESET, position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "var(--sub)", cursor: "pointer", fontWeight: 800, fontSize: 13 }}>
          ✕
        </button>
      ) : placed ? (
        <button type="button" aria-label="Stop measuring from this place" onClick={() => go(cityShown ?? city, null)} style={{ ...BTN_RESET, position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "var(--sub)", cursor: "pointer", fontWeight: 800, fontSize: 13 }}>
          ✕
        </button>
      ) : null}
      {open ? (
        <div role="listbox" aria-label="Places" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 400, background: "var(--solid)", border: "1.5px solid var(--el)", borderRadius: 16, maxHeight: 360, overflowY: "auto", boxShadow: "0 14px 40px rgba(0,0,0,.5)" }}>
          <div style={{ ...micro, color: "var(--muted)", padding: "10px 14px 4px" }}>Where to look</div>
          <button type="button" role="option" aria-selected={Boolean(near && !at)} data-testid="address-near-me" onMouseDown={(e) => e.preventDefault()} onClick={askWhereIAm} style={row}>
            <span aria-hidden="true" style={icon("#0EA5E9")}>◎</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 700 }}>Near me</span>
              <span style={{ display: "block", fontSize: 11, color: "var(--sub)" }}>Measure everything from where you are</span>
            </span>
            {near && !at ? <span style={{ color: "var(--text)", fontSize: 12, fontWeight: 900 }}>✓</span> : null}
          </button>
          <button type="button" role="option" aria-selected={city === ALL_CITIES && !near} data-testid="address-all-cities" onMouseDown={(e) => e.preventDefault()} onClick={() => go(ALL_CITIES, null)} style={row}>
            <span aria-hidden="true" style={icon("#6366F1")}>✦</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 700 }}>All cities</span>
              <span style={{ display: "block", fontSize: 11, color: "var(--sub)" }}>Everything on DanceOS</span>
            </span>
            {city === ALL_CITIES && !near ? <span style={{ color: "var(--text)", fontSize: 12, fontWeight: 900 }}>✓</span> : null}
          </button>
          {term.length >= 2 ? (
            <div data-testid="address-places">
              <div style={{ ...micro, color: "var(--muted)", padding: "10px 14px 4px" }}>Places</div>
              {searching && places.length === 0 ? <div style={{ padding: "14px", fontSize: 12.5, color: "var(--sub)", textAlign: "center" }}>Searching…</div> : null}
              {signIn ? (
                <a data-testid="address-sign-in" href={`/login?next=${encodeURIComponent(`/discover?city=${encodeURIComponent(city)}&tab=${encodeURIComponent(tab)}`)}`} style={{ display: "block", padding: "14px", fontSize: 12.5, color: "var(--text)", fontWeight: 700, textAlign: "center", textDecoration: "none" }}>
                  Sign in to search an address ›
                </a>
              ) : null}
              {!searching && !signIn && places.length === 0 ? <div style={{ padding: "14px", fontSize: 12.5, color: "var(--sub)", textAlign: "center" }}>No places match that.</div> : null}
              {places.map((s) => (
                <button type="button" key={s.id} role="option" aria-selected={false} aria-label={`${s.main}${s.secondary ? ` — ${s.secondary}` : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => void pickPlace(s)} style={row}>
                  <span aria-hidden="true" style={icon("var(--el)")}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
                      <circle cx="12" cy="9.5" r="2.5" />
                    </svg>
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.main}</span>
                    {s.secondary ? <span style={{ display: "block", fontSize: 11, color: "var(--sub)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.secondary}</span> : null}
                  </span>
                  <span style={{ color: "var(--sub)", fontSize: 12 }}>›</span>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ padding: "8px 14px 12px", fontSize: 11, color: "var(--sub)" }}>Type an area, a street or a landmark.</div>
          )}
        </div>
      ) : null}
      {err ? (
        <div role="status" style={{ fontSize: 11, color: "var(--sub)", marginTop: 6 }}>
          {err}
        </div>
      ) : null}
    </div>
  );
}
