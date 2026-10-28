/** A NOTABLE DANCER'S PHOTO, FROM WIKIPEDIA (29 Oct 2026, the user: "notable
 *  names should be carousel with pics of actual person with name", then "there
 *  should not be a single one without a pic").
 *
 *  The pictures are the people themselves — each one the free lead image of that
 *  person's English Wikipedia article — and they are RESOLVED AHEAD OF TIME by
 *  `node scripts/notable-photos.mjs` into `notablePhotos.data.json`, which exits
 *  1 if any name in `styleInfo.ts` has no photo. So a style page makes no
 *  request for them, and a name without a photo cannot reach the page: the
 *  script refuses it, and this read drops it as a belt to that brace. Never
 *  initials, never a picture of somebody else. */
import DATA from "./notablePhotos.data.json";

export interface NotablePerson {
  name: string;
  photo: string;
  /** the person's Wikipedia page — the card's door and its credit */
  page: string;
}

const MAP = DATA as Record<string, { photo: string; page: string } | null>;

export function findNotablePeople(names: string[]): NotablePerson[] {
  return names.flatMap((name) => {
    const hit = MAP[name];
    return hit ? [{ name, photo: hit.photo, page: hit.page }] : [];
  });
}
