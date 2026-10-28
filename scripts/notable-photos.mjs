// node scripts/notable-photos.mjs
//
// Writes lib/styles/notablePhotos.data.json — every NOTABLE NAME on a style page
// (lib/constants/styleInfo.ts) with the person's own free photo and their
// Wikipedia page — and EXITS 1 IF ANY NAME HAS NO PHOTO.
//
// ⚠ 29 Oct 2026, the user: "there should not be a single one without a pic." So a
// name is only on a style page if its English Wikipedia article carries a free
// lead image of that person; a name that has none is replaced in styleInfo.ts by
// another documented figure of the same style, never drawn as initials or as a
// picture of somebody else. Run this after editing any `notable` list.
//
// The displayed name and the article title differ for a few people; TITLE says
// which article each of those is.
import fs from "node:fs";

const TITLE = {
  "T. Balasaraswati": "Balasaraswati",
  "Kalamandalam Ramankutty Nair": "Ramankutty Nair",
  "Shobha Naidu": "Sobha Naidu",
  "Guru Bipin Singh": "Bipin Singh Thounaojam",
  "Srimanta Sankardev": "Sankardev",
  "Jalaluddin Rumi": "Rumi",
  "Bboy Lilou": "B-boy Lilou",
  "Bgirl Ami": "Ami Yuasa",
  "Phil Wizard": "Philip Kim (breakdancer)",
  "Fred 'Rerun' Berry": "Fred Berry",
  "Elephant Man": "Elephant Man (musician)",
  "Alex Da Silva": "Alex Da Silva (dancer)",
  "Akram Khan": "Akram Khan (dancer)",
  "Jack Cole": "Jack Cole (choreographer)",
  "Bill 'Bojangles' Robinson": "Bill Robinson",
  "The Nicholas Brothers": "Nicholas Brothers",
  "Tahia Carioca": "Taheyya Kariokka",
  "Taemin": "Taemin",
};

const UA = "DanceOS/1.0 (https://danceos-sigma.vercel.app)";
const src = fs.readFileSync("lib/constants/styleInfo.ts", "utf8");
const names = [...new Set([...src.matchAll(/notable:\s*\[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1])))];

const out = {};
for (let i = 0; i < names.length; i += 40) {
  const chunk = names.slice(i, i + 40);
  const titles = chunk.map((n) => TITLE[n] ?? n);
  const u = new URL("https://en.wikipedia.org/w/api.php");
  u.search = new URLSearchParams({ action: "query", format: "json", redirects: "1", prop: "pageimages|pageprops", piprop: "thumbnail", pithumbsize: "400", pilimit: "50", titles: titles.join("|") });
  const j = await (await fetch(u, { headers: { "User-Agent": UA } })).json();
  const norm = Object.fromEntries((j.query.normalized || []).map((n) => [n.from, n.to]));
  const redir = Object.fromEntries((j.query.redirects || []).map((n) => [n.from, n.to]));
  const pages = Object.values(j.query.pages);
  chunk.forEach((name, k) => {
    let t = norm[titles[k]] || titles[k];
    t = redir[t] || t;
    const p = pages.find((x) => x.title === t);
    const ok = p && !("missing" in p) && !(p.pageprops && "disambiguation" in p.pageprops) && p.thumbnail;
    /* Wikimedia serves thumbnails from two hosts; the API appends utm_* tracking */
    const photo = ok ? p.thumbnail.source.split("?")[0] : null;
    out[name] = ok && /^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(photo)
      ? { photo, page: `https://en.wikipedia.org/wiki/${encodeURIComponent(t.replace(/ /g, "_"))}` }
      : null;
  });
}

const missing = names.filter((n) => !out[n]);
if (missing.length) {
  console.error(`${missing.length} of ${names.length} notable names have no photo:\n  ${missing.join("\n  ")}`);
  process.exit(1);
}
const sorted = Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
fs.writeFileSync("lib/styles/notablePhotos.data.json", JSON.stringify(sorted, null, 1) + "\n");
console.log(`${names.length} of ${names.length} notable names have a photo — lib/styles/notablePhotos.data.json written`);
