/**
 * MONEY ON THE DETAIL PAGES (19 Oct 2026) — the four things no test drove.
 *
 *   1. A team card's Pay goes INSIDE first: it opens Member Detail with the pay
 *      sheet already up (`?show=settle&pay=1`), never a sheet on the card.
 *   2. Other Teams Detail opens for somebody who is BOTH on a studio's team and
 *      rents its rooms from their own artist page — Paid and Rent columns.
 *   3. Rent payments FOLD there: the list is closed, and each payment opens onto
 *      what it covered.
 *   4. A dispute, end to end: the person paid raises one on a lump sum, the owner
 *      answers it on Member Detail and accepts with "record the difference" — the
 *      dispute reads accepted and a payment for exactly the difference exists.
 *
 *   npm run build && npx next start -p 3100
 *   NODE_PATH=$(pwd)/node_modules DANCEOS_BASE_URL=http://localhost:3100 \
 *     node scripts/shots/shoot-money-detail.js
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
const rpc = (h, fn, args) => call("POST", `/rest/v1/rpc/${fn}`, h, args, `rpc ${fn}`);
const rows = (h, q) => call("GET", `/rest/v1/${q}`, h, undefined, `get ${q}`);

let pass = 0;
let fail = 0;
const check = (ok, what) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  if (ok) pass += 1;
  else fail += 1;
};

const account = async (email, fullName) => {
  const created = await call("POST", `${SUPABASE}/auth/v1/admin/users`, H_SERVICE, { email, password: PASSWORD, email_confirm: true }, `create ${email}`);
  const token = await call("POST", `${SUPABASE}/auth/v1/token?grant_type=password`, { apikey: ANON, "Content-Type": "application/json" }, { email, password: PASSWORD }, `sign in ${email}`);
  const h = asUser(token.access_token);
  await call("POST", "/rest/v1/profiles", { ...h, Prefer: "return=minimal" }, { id: created.id, full_name: fullName, role: "user", city: "Pune", styles: ["Hip-Hop"] }, `profile ${email}`);
  return { id: created.id, email, name: fullName, h };
};

const signIn = async (ctx, email) => {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login/email`, { waitUntil: "networkidle" });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 30000 });
  return page;
};

const grant = (kind, userId, businessId, plan) =>
  call("POST", "/rest/v1/subscriptions", H_SERVICE, {
    kind, user_id: userId, business_id: businessId, plan_key: plan,
    price_inr: 0, period: "monthly", status: "active",
    current_period_start: new Date().toISOString().slice(0, 10),
    current_period_end: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
    granted: true, note: "Granted by a shoot script — nothing charged",
    created_by: userId, updated_by: userId,
  }, `grant ${plan}`);

const iso = (minutes) => new Date(Date.now() + minutes * 60000).toISOString();

(async () => {
  const stamp = Date.now().toString(36);
  const tag = stamp.slice(-6);
  const made = { users: [], businesses: [] };
  const browser = await chromium.launch();
  const errs = [];

  try {
    /* ── THE WORLD ── */
    const owner = await account(`shot.money.owner.${stamp}@example.com`, `Mon Own ${tag}`);
    const artist = await account(`shot.money.art.${stamp}@example.com`, `Mon Art ${tag}`);
    made.users.push(owner.id, artist.id);

    const studio = await rpc(owner.h, "create_business_with_owner", { p_type: "studio", p_name: `Mon Hall ${tag}`, p_area: "Kothrud", p_city: "Pune", p_styles: ["Hip-Hop"] });
    made.businesses.push(studio.id);
    await grant("studio", owner.id, studio.id, "studio_monthly");
    await call("PATCH", `/rest/v1/businesses?id=eq.${studio.id}`, H_SERVICE, { verified_at: new Date().toISOString(), visibility: "listed" }, "list the studio");
    const room = await call("POST", "/rest/v1/rooms", owner.h, { business_id: studio.id, name: "Room A", capacity: 30 }, "room");

    /* the artist on the studio's team, through the real invite door */
    const inv = await rpc(owner.h, "invite_person_to_business", { p_business_id: studio.id, p_user_id: artist.id, p_role: "trainer" });
    await rpc(artist.h, "accept_business_invite", { p_code: inv.code });

    /* …and renting its room from their own artist page */
    await grant("artist", artist.id, null, "artist_monthly");
    const page = await rpc(artist.h, "create_business_with_owner", { p_type: "artist_page", p_name: `Mon Page ${tag}`, p_area: "Kothrud", p_city: "Pune", p_styles: ["Hip-Hop"] });
    made.businesses.push(page.id);
    const cls = await rpc(artist.h, "create_class_with_session", {
      p_business_id: page.id, p_title: "Hip-Hop · All levels", p_style: "Hip-Hop", p_level: "all",
      p_room: null, p_price_inr: 0, p_capacity: 8, p_status: "draft",
      p_starts_at: iso(60 * 24 * 12), p_ends_at: iso(60 * 24 * 12 + 60),
      p_room_id: room[0].id, p_poster: null, p_venue_business_id: studio.id,
      p_lat: null, p_lng: null, p_maps_url: null,
    });
    await rpc(owner.h, "respond_to_venue_request", { p_class_id: cls.id, p_accept: true });

    /* the money: a team payment and a rent payment, each through its own door */
    const payout = await rpc(owner.h, "record_team_payment", { p_business_id: studio.id, p_user_id: artist.id, p_amount_inr: 1000, p_method: "upi", p_status: "done", p_paid_on: null, p_note: null });
    const rent = await rpc(artist.h, "record_rent_amount", { p_payer_business_id: page.id, p_venue_business_id: studio.id, p_amount_inr: 800, p_method: "upi", p_status: "done", p_provider_ref: null, p_paid_on: null, p_note: null });
    check(Boolean(payout && payout.id) && Boolean(rent && rent.id), "the world: a ₹1,000 team payment and a ₹800 rent payment are on record");

    /* ══ 1 · THE TEAM CARD'S PAY GOES INSIDE FIRST ══ */
    const oCtx = await browser.newContext({ viewport: { width: 430, height: 932 } });
    const op = await signIn(oCtx, owner.email);
    op.on("pageerror", (e) => errs.push(`${op.url()} ${e}`));
    await op.goto(`${BASE}/business/${studio.id}/staff`, { waitUntil: "networkidle" });
    const payLink = op.getByTestId("team-card-pay").and(op.getByRole("link", { name: `Pay ${artist.name}` }));
    check((await payLink.count()) === 1, "the team card carries a Pay button");
    check((await payLink.getAttribute("href")) === `/business/${studio.id}/staff/${artist.id}?show=settle&pay=1`, "…which is a door to Member Detail, To settle, with the pay sheet asked for");
    check(!/₹\s?1,000/.test(await op.locator("body").innerText()), "…and the desk prints no rupees — the ₹1,000 paid is not on it");
    await payLink.click();
    await op.waitForURL((u) => u.pathname === `/business/${studio.id}/staff/${artist.id}`, { timeout: 20000 });
    await op.getByRole("dialog").first().waitFor({ timeout: 15000 }).catch(() => {});
    check((await op.getByRole("dialog").count()) >= 1, "pressing it lands on Member Detail with the pay sheet already open");

    /* ══ 2 + 3 · OTHER TEAMS DETAIL, AND RENT THAT FOLDS ══ */
    const aCtx = await browser.newContext({ viewport: { width: 430, height: 932 } });
    const ap = await signIn(aCtx, artist.email);
    ap.on("pageerror", (e) => errs.push(`${ap.url()} ${e}`));
    await ap.goto(`${BASE}/team/other/business/${studio.id}?show=rent`, { waitUntil: "networkidle" });
    check(new URL(ap.url()).pathname === `/team/other/business/${studio.id}`, "Other Teams Detail opens for a teammate who also rents the rooms");
    const list = ap.getByTestId("rent-payments");
    check((await list.count()) === 1, "the Rent column draws the payments as one fold");
    check((await list.getAttribute("open")) === null, "…closed at first");
    await list.locator("summary").first().click();
    const pay = ap.getByTestId("rent-payment");
    await pay.first().waitFor({ timeout: 10000 });
    check((await pay.count()) === 1 && (await list.getAttribute("open")) !== null, "opening it shows the one payment");
    check((await pay.getAttribute("open")) === null, "…and the payment is itself a fold, closed");
    await ap.getByTestId("rent-payment-head").click();
    check((await pay.getAttribute("open")) !== null, "…opening onto what it covered");

    /* ══ 4 · A DISPUTE, RAISED BY THE PERSON PAID ══ */
    await ap.goto(`${BASE}/team/other/business/${studio.id}?show=paid`, { waitUntil: "networkidle" });
    await ap.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
    const studioCard = ap.getByTestId("paid-studio").first();
    check((await studioCard.count()) === 1, "the Paid column lists what this studio paid");
    await studioCard.locator('button[aria-expanded="false"]').first().click().catch(() => {});
    const raise = ap.getByRole("button", { name: "Dispute Lump sum" });
    check((await raise.count()) >= 1, "the payee is offered Dispute on the lump sum in the Paid column");
    await raise.first().click();
    await ap.getByLabel("What it should have been").fill("1500");
    check(/₹500/.test(await ap.getByTestId("dispute-total-figure").innerText()), "the sheet totals what is disputed — ₹500");
    await ap.getByLabel("What is wrong").fill("Half of the month is missing");
    await ap.getByRole("button", { name: "Raise dispute", exact: true }).click();
    await ap.getByTestId("dispute-pill").first().waitFor({ timeout: 20000 }).catch(() => {});
    const [d1] = await rows(H_SERVICE, `payment_disputes?payout_id=eq.${payout.id}&select=id,status,amount_inr,claimed_inr`);
    check(d1 && d1.status === "open" && d1.amount_inr === 1000 && d1.claimed_inr === 1500, `the dispute is open in the database at ₹1,000 → ₹1,500 (${d1 ? d1.status : "none"})`);

    /* ══ 4b · THE OWNER ACCEPTS ON MEMBER DETAIL AND RECORDS THE DIFFERENCE ══ */
    await op.goto(`${BASE}/business/${studio.id}/staff/${artist.id}?show=earnings`, { waitUntil: "networkidle" });
    await op.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
    const answer = op.getByRole("button", { name: "Answer the dispute on Lump sum" });
    check((await answer.count()) >= 1, "the owner is offered Answer on the same entry, inside Member Detail");
    await answer.first().click();
    await op.getByRole("radio", { name: "Accept" }).click();
    check((await op.getByTestId("dispute-settle").count()) === 1, "accepting an underpayment offers to record the ₹500 difference");
    check((await op.getByLabel("Record the ₹500 difference as paid").isChecked()), "…ticked by default");
    await op.getByRole("button", { name: "Accept · record ₹500" }).click();
    await op.waitForTimeout(3000);
    const [d2] = await rows(H_SERVICE, `payment_disputes?id=eq.${d1.id}&select=status`);
    check(d2 && d2.status === "accepted", `the dispute reads accepted (${d2 ? d2.status : "none"})`);
    const settles = await rows(H_SERVICE, `payouts?business_id=eq.${studio.id}&user_id=eq.${artist.id}&deleted_at=is.null&select=amount_inr,note`);
    const diff = settles.filter((p) => /Settles an accepted dispute/.test(p.note || ""));
    check(diff.length === 1 && diff[0].amount_inr === 500, `exactly one payment for the ₹500 difference is recorded (${diff.map((p) => p.amount_inr).join(",") || "none"})`);

    check(errs.length === 0, `no page error (${errs.slice(0, 2).join(" | ") || "none"})`);
  } catch (e) {
    check(false, `run died: ${e.message}`);
  } finally {
    await browser.close();
    for (const id of made.businesses.reverse()) {
      await call("DELETE", `/rest/v1/businesses?id=eq.${id}`, H_SERVICE, undefined, "clean business").catch((e) => console.log(`LEFT business ${id}: ${e.message}`));
    }
    for (const id of made.users) {
      await call("DELETE", `${SUPABASE}/auth/v1/admin/users/${id}`, H_SERVICE, undefined, "clean user").catch((e) => console.log(`LEFT user ${id}: ${e.message}`));
    }
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
