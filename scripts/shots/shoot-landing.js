/**
 * THE APP OPENS ON DISCOVER, THE DRAWER ARRANGES ITS TOOLS, AND A STUDIO HAS A
 * PRACTICE DESK (18 Oct 2026).
 *
 * The user: *"make sure user and artist whenever they open the app land on
 * discover first. breaking right now"*, *"arrange and reorder tools in profile
 * switcher how we do for dance styles do this by giving a arrange button with
 * tools heading"* and *"practice tool for studio as well"*.
 *
 * ⚠ The landing is a PROXY rule about DOCUMENT loads, so only a browser can
 * prove it: a document load of "/" (an open, a reload) goes to Discover, and a
 * press of the bar's Home (a client navigation) does not.
 *
 *   npm run build && npx next start -p 3100
 *   NODE_PATH=$(pwd)/node_modules DANCEOS_BASE_URL=http://localhost:3100 \
 *     node scripts/shots/shoot-landing.js
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("@playwright/test");

const ROOT = path.resolve(__dirname, "..", "..");
const BASE = process.env.DANCEOS_BASE_URL || "http://localhost:3000";
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z_]+)=(.*)$/.exec(line);
  if (m) env[m[1]] = m[2].trim();
}
const SUPABASE = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PASSWORD = "Shoot-passw0rd!";
const H_SERVICE = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", Prefer: "return=representation" };
const asUser = (t) => ({ apikey: ANON, Authorization: `Bearer ${t}`, "Content-Type": "application/json", Prefer: "return=representation" });

const call = async (method, url, headers, body, what) => {
  const res = await fetch(url.startsWith("http") ? url : `${SUPABASE}${url}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${what}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
};
let pass = 0;
let fail = 0;
const check = (ok, what) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  if (ok) pass += 1;
  else fail += 1;
};

(async () => {
  const stamp = Date.now().toString(36);
  const tag = stamp.slice(-6);
  const made = { users: [], businesses: [] };
  const browser = await chromium.launch();
  const errs = [];
  try {
    const email = `shot.landing.${stamp}@example.com`;
    const created = await call("POST", `${SUPABASE}/auth/v1/admin/users`, H_SERVICE, { email, password: PASSWORD, email_confirm: true }, "create user");
    made.users.push(created.id);
    const token = await call("POST", `${SUPABASE}/auth/v1/token?grant_type=password`, { apikey: ANON, "Content-Type": "application/json" }, { email, password: PASSWORD }, "token");
    const h = asUser(token.access_token);
    await call("POST", "/rest/v1/profiles", { ...h, Prefer: "return=minimal" }, { id: created.id, full_name: `Land Ing ${tag}`, role: "user", city: "Pune", styles: ["Hip-Hop"] }, "profile");
    const studio = await call("POST", "/rest/v1/rpc/create_business_with_owner", h, { p_type: "studio", p_name: `Land Std ${tag}`, p_area: "Kothrud", p_city: "Pune", p_styles: ["Hip-Hop"] }, "studio");
    made.businesses.push(studio.id);

    const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errs.push(e.message));

    /* ── 1 · SIGNING IN LANDS ON DISCOVER ── */
    await page.goto(`${BASE}/login/email`, { waitUntil: "networkidle" });
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 30000 });
    check(new URL(page.url()).pathname === "/discover", `signing in lands on Discover (${new URL(page.url()).pathname})`);

    /* ── 2 · OPENING THE APP AT "/" LANDS ON DISCOVER, EVERY TIME ── */
    for (let i = 1; i <= 2; i++) {
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      check(new URL(page.url()).pathname === "/discover", `open #${i}: a document load of "/" lands on Discover`);
    }

    /* ── 3 · …THE BAR IS DISCOVER ALONE, AND YOUR PAGE IS THE SWITCHER'S FIRST ROW (28 Oct 2026, C183) ── */
    const mainBar = page.getByRole("navigation", { name: "Main" });
    check((await mainBar.getByRole("link").count()) === 1 && (await mainBar.getByRole("link", { name: "Home", exact: true }).count()) === 0, "the bar holds Discover alone — no Home");
    let home = false;
    for (let i = 0; i < 8 && !home; i++) {
      await page.getByTestId("profile-switcher").click().catch(() => {});
      await page.getByRole("menu", { name: "Your profiles" }).getByRole("menuitem").first().click({ timeout: 3000 }).catch(() => {});
      home = await page.waitForURL((u) => u.pathname.startsWith("/person/"), { timeout: 3000 }).then(() => true).catch(() => false);
    }
    check(home, "the switcher's first row opens your own page — a client hop, never sent to Discover");
    check((await mainBar.getByRole("link", { name: "Discover" }).count()) === 1, "your own page keeps the bar, so Discover is one press away");
    await page.reload({ waitUntil: "networkidle" });
    /* Home IS /person/{you} since 28 Oct 2026, so a reload stays on your page — only a load of "/" opens Discover */
    check(new URL(page.url()).pathname.startsWith("/person/"), "a reload on your own page stays on it (28 Oct 2026)");

    /* ── 4 · THE DRAWER: TOOLS, WITH ARRANGE ON ITS HEADING ── */
    await page.getByRole("button", { name: /switch profile/i }).first().click();
    const head = page.getByTestId("drawer-tools-head");
    await head.waitFor({ timeout: 15000 });
    check(/TOOLS/i.test(await head.innerText()), "the drawer's tools are headed TOOLS");
    await page.getByTestId("drawer-tools-arrange").click();
    const rows = page.getByTestId("drawer-tool-arrange-row");
    await rows.first().waitFor({ timeout: 10000 });
    const n = await rows.count();
    check(n >= 5, `Arrange turns the tools into rows to drag (${n})`);
    check((await page.getByTestId("drawer-tools-arranging").count()) === 1, "…marked as arranging");
    await page.getByTestId("drawer-tools-arrange").click();
    await page.waitForTimeout(400);
    check((await rows.count()) === 0, "Done puts them back as the tool rows");
    await page.keyboard.press("Escape");

    /* ── 5 · A STUDIO'S PRACTICE DESK ── */
    await page.goto(`${BASE}/business/${studio.id}/practice`, { waitUntil: "networkidle" });
    check(new URL(page.url()).pathname === `/business/${studio.id}/practice`, "the studio's practice desk opens for its owner");
    check(await page.getByRole("heading", { level: 1, name: "Practice" }).isVisible().catch(() => false), "…headed Practice");
    check((await page.getByTestId("practice-chips").count()) === 0, "…with no Crew · Job chips — a studio's practices are its jobs'");
    check(await page.getByTestId("practice-empty").isVisible().catch(() => false), "…and says so when there is nothing coming up");
    await page.getByTestId("practice-tab-past").click();
    await page.waitForTimeout(300);
    check(page.url().includes(`/business/${studio.id}/practice?tab=past`), `the tab is the studio's own address (${page.url().replace(BASE, "")})`);

    /* the studio's drawer carries the tool — ⚠ once the studio is CHOSEN (29 Oct
       2026: a page no longer switches you into its profile; only the switcher
       does, so the switcher's choice is set first) */
    await page.context().addCookies([{ name: "dos_profile", value: studio.id, url: BASE }]);
    await page.goto(`${BASE}/business/${studio.id}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /switch profile/i }).first().click();
    const tool = page.getByRole("navigation", { name: "Tools" }).getByRole("link", { name: "Practice", exact: true });
    await tool.waitFor({ timeout: 15000 }).catch(() => {});
    check((await tool.getAttribute("href").catch(() => null)) === `/business/${studio.id}/practice`, "the studio's drawer lists Practice, opening its own desk");
    await page.keyboard.press("Escape");

    /* ── 6 · IN A STUDIO THERE IS NO DISCOVER, AND NO PAGE SWITCHES YOU (29 Oct 2026) ── */
    check((await page.getByTestId("brand").getAttribute("href")) === `/studio/${studio.id}`, "in the studio, the brand opens the studio's page, not Discover");
    await page.goto(`${BASE}/discover`, { waitUntil: "networkidle" });
    check(new URL(page.url()).pathname === `/studio/${studio.id}`, `typing /discover in the studio lands on the studio (${new URL(page.url()).pathname})`);
    check((await page.getByRole("navigation", { name: "Main" }).count()) === 0, "…and no bottom bar offers Discover");
    await page.goto(`${BASE}/person/${created.id}`, { waitUntil: "networkidle" });
    check(/you are in/i.test((await page.getByRole("button", { name: /switch profile/i }).first().getAttribute("aria-label")) ?? "") && ((await page.getByRole("button", { name: /switch profile/i }).first().getAttribute("aria-label")) ?? "").includes(`Land Std ${tag}`), "opening your own page does NOT switch you out of the studio");
    await page.context().clearCookies({ name: "dos_profile" });
    await page.goto(`${BASE}/discover`, { waitUntil: "networkidle" });
    check(new URL(page.url()).pathname === "/discover", "as yourself, Discover opens");

    check(errs.length === 0, `no page error (${errs.join(" | ") || "none"})`);
  } catch (e) {
    console.log("FAILED", e);
    fail += 1;
  } finally {
    for (const id of made.businesses) {
      await call("DELETE", `/rest/v1/businesses?id=eq.${id}`, H_SERVICE, undefined, `clean business ${id}`).catch((e) => console.log(`  (business ${id} not deleted: ${e.message})`));
    }
    for (const id of made.users) {
      await call("DELETE", `${SUPABASE}/auth/v1/admin/users/${id}`, H_SERVICE, undefined, `clean user ${id}`).catch((e) => console.log(`  (user ${id} not deleted: ${e.message})`));
    }
    await browser.close();
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
