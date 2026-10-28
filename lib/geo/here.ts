/** WHERE THE PHONE SAYS YOU ARE (28 Oct 2026, the user: "when i open cult fit
 *  app it ask for the location access first step. This is how i want … at the
 *  install, without even signup").
 *
 *  The installed app asks Android for the location on its first open after
 *  install (`AskWhereOnFirstOpen`); what it answers lives HERE, in one cookie on
 *  the phone, rounded to three decimals (about 100 m — enough to sort studios
 *  by, not somebody's doorstep). Never in the database: there is no account yet
 *  when it is asked, and a profile's city is something the person chose, which
 *  a passing GPS fix must not overwrite.
 *
 *  A cookie rather than localStorage because the pages that use it — Discover,
 *  onboarding — are rendered on the SERVER.
 *
 *  ⚠ THE CITY STILL MATTERS WITH A POINT IN HAND. Only the studios shelf is a
 *  radius search; classes, crews and artists are scoped by city, and a profile
 *  must name one of the cities DanceOS serves (the 19 Sep 2026 trigger). So the
 *  point is turned into a city — the nearest served centre, within reach — and
 *  never into a free-text name from a geocoder. */

export type Point = { lat: number; lng: number };

/** "28.459,77.027" — the point, as the cookie and `?near=` both carry it */
export const HERE_COOKIE = "dos_here";
/** thirty days: a fix older than that says where somebody was, not where they are */
export const HERE_MAX_AGE_S = 60 * 60 * 24 * 30;

/** The APK's first-run flag (bubblewrap `firstRunFlag`): its launcher adds
 *  `?dos_first_open=true` to the start URL on the first open after install and
 *  `=false` after. `proxy.ts` turns the true one into the cookie below, because
 *  a signed-out `/` is redirected to `/login` on the server and the query string
 *  never reaches the browser. */
export const FIRST_OPEN_PARAM = "dos_first_open";
export const FIRST_OPEN_COOKIE = "dos_first_open";
/** long enough to survive the splash, the redirect and a slow first paint */
export const FIRST_OPEN_MAX_AGE_S = 10 * 60;

/** `?near=centre`: a city picked by hand on Discover — measure from its centre,
 *  even when it is the city the phone is in */
export const NEAR_CENTRE = "centre";

/** further than this from every served centre, and nobody is "in" any of them */
export const NEAREST_CITY_KM = 75;

/** A point from a cookie or an address bar, or nothing. Bounded to India,
 *  because a pair of numbers from outside is the least trustworthy input the app
 *  has, and a radius search from the wrong hemisphere is an empty shelf with no
 *  explanation (11 Sep 2026, when this lived in the Discover page). */
export function parsePoint(raw: string | null | undefined): Point | null {
  const [a, b] = String(raw ?? "").split(",");
  const lat = Number(a);
  const lng = Number(b);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return lat >= 6 && lat <= 37.5 && lng >= 68 && lng <= 97.5 ? { lat, lng } : null;
}

export const formatPoint = (p: Point): string => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;

/** great-circle distance; at city scale the earth is round enough for this */
export function distanceKm(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The served city whose centre is nearest, or null when none is within reach.
 *  Noida lands on New Delhi and Thane on Mumbai — what the 19 Sep aliases say. A
 *  centre at 0,0 is a city registered from a bad pin, never a real centre. */
export function nearestCity(
  cities: ReadonlyArray<{ city: string; lat: number; lng: number }>,
  p: Point,
  maxKm: number = NEAREST_CITY_KM
): string | null {
  let best: { city: string; km: number } | null = null;
  for (const c of cities) {
    if (c.lat === 0 && c.lng === 0) continue;
    const km = distanceKm(p, c);
    if (km <= maxKm && (!best || km < best.km)) best = { city: c.city, km };
  }
  return best?.city ?? null;
}

/** the `document.cookie` assignment that remembers a point (client side) */
export const hereCookie = (p: Point, secure: boolean): string =>
  `${HERE_COOKIE}=${formatPoint(p)}; path=/; max-age=${HERE_MAX_AGE_S}; samesite=lax${secure ? "; secure" : ""}`;
