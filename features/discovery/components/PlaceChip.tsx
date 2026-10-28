"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormPage } from "@/components/ui/FormPage";
import { Portal } from "@/components/ui/Portal";
import { CitySelect } from "@/features/geo/components/CitySelect";
import { PlaceSearch, type ResolvedPlace } from "@/features/geo/components/PlaceSearch";
import { INK, SUB } from "@/lib/design/tokens";
import { NEAR_CENTRE, formatPoint, hereCookie, nearestCity, type Point } from "@/lib/geo/here";
import { useCloseOnBack } from "@/lib/hooks/useCloseOnBack";
import { ALL_CITIES } from "@/features/discovery/filters";

type CityCentre = { city: string; lat: number; lng: number };

/** WHERE TO LOOK, ONCE (21 Sep 2026, the user: "merge near me and city filter
 *  on discover").
 *
 *  Discover asked the same question twice. The city chip said which city to
 *  measure in; the Near me chip said measure from ME instead of from the middle
 *  of it — and the second was never independent of the first, which is why
 *  18 Sep put them side by side and why side by side was still two controls for
 *  one answer. This is that answer: ONE chip, printing where the list is
 *  measured from, opening on Near me and then the cities DanceOS serves.
 *
 *  ⚠ THE CITY DOES NOT GO AWAY WHEN NEAR ME IS ON, and it must not: `near` is
 *  only the ORIGIN of the radius search, while the city still scopes the shelves
 *  that are not measured at all (classes, crews, events). So pressing Near me
 *  keeps the city underneath and only moves the point; picking a city turns Near
 *  me off, because a place you chose deliberately is a clearer answer than a
 *  point a browser handed over five minutes ago.
 *
 *  ⚠ AND NEAR ME IS OFFERED ONLY WHERE IT DOES SOMETHING — the studios tab, the
 *  one shelf that is a radius search. Elsewhere the same chip is the city alone,
 *  which is the whole of what the page can act on there.
 *
 *  ⚠ A THIRD WAY IN: AN ADDRESS (28 Oct 2026, the user: "near me which is based
 *  on current location, or current city if user switch city manually, or put
 *  some address … then as per that"). "Search an address…" opens Google's
 *  address search (the one the studio form uses); the place picked becomes the
 *  point (`near`), its words the chip's label (`at`), and the served city
 *  nearest it the city underneath. An address further than 75 km from every
 *  city DanceOS serves is refused in words rather than shown as an empty
 *  shelf. */
export function PlaceChip({
  city,
  cities,
  tab,
  extra,
  near,
  at,
  offerNearMe,
}: {
  city: string;
  /** the registry with its centres, busiest first */
  cities: CityCentre[];
  tab: string;
  extra: Record<string, string>;
  /** is the list measured from a point right now (the person, or an address) */
  near: boolean;
  /** the typed address it is measured from, when it is one */
  at: string | null;
  offerNearMe: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  /* REPLACE, not push (19 Sep 2026): where the list is measured from is a
     setting of the page you are on, not a page of its own — a push per change
     made the back gesture walk every state before it could leave Discover */
  const go = (nextCity: string, nextNear: Point | null, label: string | null = null) => {
    const p = new URLSearchParams({ city: nextCity, tab, ...extra });
    /* a city picked by hand says so (`near=centre`), or the phone's own point —
       Discover's default for the city you are in — would switch straight back on */
    p.set("near", nextNear ? formatPoint(nextNear) : NEAR_CENTRE);
    if (nextNear && label) p.set("at", label.slice(0, 80));
    router.replace(`/discover?${p.toString()}`, { scroll: false });
  };

  /* Asking for somebody's location is a prompt people refuse on principle, and
     once refused a browser does not ask again — so it is a row you press, never
     a default, and a refusal says what the list falls back to rather than
     nothing. The coordinates go in the URL, so the SERVER does the search and
     the result is a link somebody can keep; three decimals is about 100 m,
     which is plenty to sort studios by and not somebody's doorstep. A fix also
     refreshes the phone's remembered point (28 Oct 2026), so the next Discover
     opens where this one found you. */
  const askWhereIAm = () => {
    if (!("geolocation" in navigator)) {
      setErr("This browser will not share where you are.");
      return;
    }
    setBusy(true);
    setErr(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        document.cookie = hereCookie(p, location.protocol === "https:");
        go(city, p);
      },
      () => {
        setBusy(false);
        setErr("Not shared — the list stays measured from the city centre.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  };

  const pickAddress = (place: ResolvedPlace) => {
    const p = { lat: place.lat, lng: place.lng };
    const served = nearestCity(cities, p);
    if (!served) {
      setErr(`DanceOS isn't in ${place.city ?? "that area"} yet — pick one of the cities.`);
      setSearching(false);
      return;
    }
    setErr(null);
    setSearching(false);
    go(served, p, place.label ?? place.area ?? served);
  };

  const cityShown = city && city !== ALL_CITIES ? city : null;
  const leads = [
    ...(offerNearMe
      ? [
          {
            value: "__near__",
            option: "◎ Near me",
            label: busy ? "Finding you…" : cityShown ? `Near me · ${cityShown}` : "Near me",
            active: near && !at,
            onPick: askWhereIAm,
          },
        ]
      : []),
    {
      value: "__address__",
      option: "⌕ Search an address…",
      label: at ?? "Address",
      active: Boolean(at),
      onPick: () => setSearching(true),
    },
  ];

  return (
    <>
      <CitySelect
        variant="chip"
        /* ⚠ ALL CITIES (2 Oct 2026, the user: "location drop down on discover
           should also have option to view for all cities together called all") —
           the select's "none" row IS that option, and `city=all` in the address
           is its value, so it is a link like every other place */
        value={cityShown}
        cities={cities.map((c) => c.city)}
        placeholder="All cities"
        allowNone
        noneLabel="All cities"
        ariaLabel="Where to look"
        disabled={busy}
        /* ⚠ picking REPLACES the address below, so the sheet must not spend its
           own history entry on the way out — the back() would race the router
           (useCloseOnBack rule 2, the 19 Sep bug) */
        navigates
        lead={leads}
        onChange={(next) => go(next ?? ALL_CITIES, null)}
      />
      {err ? (
        <span role="status" style={{ fontSize: 10, color: INK, opacity: 0.75, marginLeft: 6 }}>
          {err}
        </span>
      ) : null}
      {searching ? <AddressSheet centre={cities.find((c) => c.city === cityShown) ?? null} onPick={pickAddress} onClose={() => setSearching(false)} /> : null}
    </>
  );
}

/** the address search, in the app's one sheet anatomy — portalled, because the
 *  chip it opens from sits in a row whose ancestors may clip a fixed child */
function AddressSheet({ centre, onPick, onClose }: { centre: Point | null; onPick: (place: ResolvedPlace) => void; onClose: () => void }) {
  /* a pick navigates (router.replace), so — like PickSheet with `navigates` —
     the sheet leaves its history entry rather than racing the router for it */
  useCloseOnBack(onClose, true, { spend: false });
  return (
    <Portal>
      <FormPage sheet title="Search an address" onBack={onClose} onClose={onClose}>
        <PlaceSearch placeholder="An area, a street, a landmark…" near={centre} autoFocus onPick={onPick} />
        <div style={{ fontSize: 11, color: SUB, marginTop: 10, lineHeight: 1.45 }}>Studios are measured from the place you pick, and the city follows it.</div>
      </FormPage>
    </Portal>
  );
}
