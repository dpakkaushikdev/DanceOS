/** a country's flag, from its ISO code (29 Oct 2026, the user: "country flag
 *  should also be there" on a style's facts). Only the countries `styleInfo`
 *  names; anything else simply draws no flag. */
const ISO: Record<string, string> = {
  Argentina: "AR",
  Uruguay: "UY",
  Brazil: "BR",
  Colombia: "CO",
  Cuba: "CU",
  "Puerto Rico": "PR",
  "United States": "US",
  "Dominican Republic": "DO",
  Egypt: "EG",
  Turkey: "TR",
  India: "IN",
  Pakistan: "PK",
  Italy: "IT",
  France: "FR",
  Jamaica: "JM",
  Nigeria: "NG",
  Ghana: "GH",
  Panama: "PA",
  "South Korea": "KR",
  Spain: "ES",
  "United Kingdom": "GB",
  Germany: "DE",
};

/** "India / Pakistan" → ["in", "pk"]; "Global" → [] (the caller draws a globe).
 *  ⚠ Lower-case ISO codes for an IMAGE, not flag emoji: Windows browsers have no
 *  flag glyphs and draw "IN" instead of 🇮🇳. */
export function countryCodes(country: string): string[] {
  return country
    .split("/")
    .map((p) => p.replace(/\(.*?\)/g, "").trim())
    .map((p) => ISO[p])
    .filter(Boolean)
    .map((c) => c.toLowerCase());
}

export const isGlobal = (country: string) => /^global$/i.test(country.trim());

/** the flag picture for one code (flagcdn.com, a free static flag set) */
export const flagSrc = (code: string) => `https://flagcdn.com/w40/${code}.png`;
