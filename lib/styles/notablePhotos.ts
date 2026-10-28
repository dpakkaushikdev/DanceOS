/** A NOTABLE DANCER'S PHOTO, FROM WIKIPEDIA (29 Oct 2026, the user: "notable
 *  names should be carousel with pics of actual person with name").
 *
 *  The pictures are the people themselves, so they come from the one place that
 *  keeps a free, credited photo of each: Wikipedia's page summary
 *  (`/api/rest_v1/page/summary/{title}` → `thumbnail.source`). Read on the
 *  server, cached a week, one request per name, all in parallel.
 *
 *  ⚠ IT NEVER FAILS THE PAGE. A name with no article, a disambiguation page, a
 *  slow answer (2.5 s cut-off) or anything off Wikimedia's own image hosts comes
 *  back with no photo, and the card draws initials — a style page is an
 *  encyclopedia entry and must not 500 over a picture. */

export interface NotablePerson {
  name: string;
  photo: string | null;
  /** the person's Wikipedia page, when there is one — the card's door and its credit */
  page: string | null;
}

const UA = "DanceOS/1.0 (https://danceos-sigma.vercel.app)";

async function one(name: string): Promise<NotablePerson> {
  const none: NotablePerson = { name, photo: null, page: null };
  try {
    const title = encodeURIComponent(name.replace(/ /g, "_"));
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, {
      headers: { "User-Agent": UA, "Api-User-Agent": UA, Accept: "application/json" },
      next: { revalidate: 60 * 60 * 24 * 7 },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return none;
    const j = (await res.json()) as {
      type?: string;
      thumbnail?: { source?: string };
      content_urls?: { desktop?: { page?: string } };
    };
    if (j.type !== "standard") return none;
    const src = j.thumbnail?.source ?? null;
    /* Wikimedia serves thumbnails from two hosts (checked 29 Oct 2026) */
    const photo = src && ["upload.wikimedia.org", "thumb.wikimedia.org"].includes(new URL(src).hostname) ? src : null;
    const page = j.content_urls?.desktop?.page ?? null;
    return { name, photo, page: page && page.startsWith("https://en.wikipedia.org/") ? page : null };
  } catch {
    return none;
  }
}

export async function findNotablePeople(names: string[]): Promise<NotablePerson[]> {
  return Promise.all(names.map(one));
}
