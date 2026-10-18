/* A PAID MEMBERSHIP, END TO END, AGAINST THE REAL CASHFREE SANDBOX (18 Oct 2026).
   The user: "fix memberships end to end", then "check how to use memberships to
   book classes and how its getting consumed". The free pass and the database
   rules had their checks (shoot-return, rls-proof-memberships); a PAID pass had
   never been driven through the real rail, and the spend had never been read
   back screen by screen. This drives the whole life of one:

     a studio sells it → a dancer presses Buy now on the studio's page → pays →
     the pass is ACTIVE → it books a 1-hour class → ONE hour is spent →
     the invoice says the pass paid, not "Free" → a 3-hour class is shown the
     pass but cannot take it (2 hours left) → cancelling the seat puts the hour
     back → the seller sees the holder and the money →
     a second paid pass is RETURNED unused → Cashfree holds the refund.

   Everything is the app's own code except ONE thing no script can press:
   Cashfree's checkout window. The SDK is stubbed for this page only and the probe
   pays the session the APP opened through Cashfree's sandbox Order Pay API with
   `testsuccess@gocash`, which really captures (shoot-enquiry-money's method).

   ⚠ Sandbox only — it refuses to run unless CASHFREE_ENV=sandbox.

   Run:  $env:DANCEOS_BASE_URL="http://localhost:3000"; $env:NODE_PATH="$pwd\node_modules"; node scripts/shots/shoot-membership-money.js  */
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const REPO = path.join(__dirname, "..", "..");
const BASE = process.env.DANCEOS_BASE_URL || "http://localhost:3000";
const env = Object.fromEntries(
  fs.readFileSync(path.join(REPO, ".env.local"), "utf8").split(/\r?\n/).filter((l) => /^\s*[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const UA = "danceos-proof";
const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", Prefer: "return=representation", "User-Agent": UA };
const CF = "https://sandbox.cashfree.com/pg";
const cfH = { "x-client-id": env.CASHFREE_APP_ID, "x-client-secret": env.CASHFREE_SECRET_KEY, "x-api-version": "2025-01-01", "Content-Type": "application/json" };

let ok = 0, bad = 0;
const check = (c, m) => { console.log((c ? "  ok   " : "  FAIL ") + m); c ? ok++ : bad++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, url, headers, body) {
  const r = await fetch(url.startsWith("http") ? url : `${SUPA}${url}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${url} -> ${r.status} ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
}
async function cf(method, p, body) {
  const r = await fetch(CF + p, { method, headers: cfH, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`Cashfree ${method} ${p} -> ${r.status} ${t.slice(0, 300)}`);
  return JSON.parse(t);
}

async function makeAccount(stamp, who, fullName) {
  const email = `memmoney.${who}.${stamp}@example.com`;
  const password = `Money!${stamp}aA1`;
  const made = await call("POST", "/auth/v1/admin/users", svc, { email, password, email_confirm: true });
  await call("POST", "/rest/v1/profiles", svc, { id: made.id, full_name: fullName, role: "user", city: "Pune", styles: ["Hip-Hop"], created_by: made.id, updated_by: made.id });
  const token = await call("POST", "/auth/v1/token?grant_type=password", { apikey: ANON, "Content-Type": "application/json", "User-Agent": UA }, { email, password });
  return { id: made.id, email, password, name: fullName, h: { apikey: ANON, Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json", "User-Agent": UA } };
}

async function signIn(page, acc) {
  await page.goto(`${BASE}/login/email`, { waitUntil: "networkidle" });
  const btn = page.getByRole("button", { name: "Sign in" });
  await btn.waitFor({ timeout: 60000 });
  for (let i = 0; i < 20; i++) {
    await page.getByLabel("Email address").fill(acc.email);
    await page.getByLabel("Password", { exact: true }).fill(acc.password);
    if (await btn.isEnabled()) break;
    await page.waitForTimeout(800);
  }
  await btn.click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60000 });
}

const SDK_STUB = `window.Cashfree = function () {
  return { checkout: function (o) { window.__cfSession = o.paymentSessionId; return new Promise(function (r) { window.__cfClose = r; }); } };
};`;

/* press Buy now on the studio's page, then Pay, and pay the APP's session in the sandbox */
async function buyAndPay(page, studioId, m) {
  await page.goto(`${BASE}/studio/${studioId}`, { waitUntil: "networkidle" });
  await page.evaluate(() => { window.__cfSession = null; });
  await page.getByRole("button", { name: `Buy ${m.name}`, exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Confirm payment" });
  await sheet.waitFor({ timeout: 30000 });
  await sheet.getByRole("button", { name: /^Pay / }).click();
  await page.waitForFunction(() => Boolean(window.__cfSession), null, { timeout: 60000 });
  const session = await page.evaluate(() => window.__cfSession);
  await cf("POST", "/orders/sessions", { payment_session_id: session, payment_method: { upi: { channel: "collect", upi_id: "testsuccess@gocash" } } });
  const [order] = await call("GET", `/rest/v1/orders?membership_id=eq.${m.id}&select=id,status,amount_inr,provider,provider_order_id,membership_pass_id,business_id&order=created_at.desc&limit=1`, svc);
  let paid = null;
  for (let i = 0; i < 20 && !paid; i++) {
    await sleep(3000);
    paid = (await cf("GET", `/orders/${order.provider_order_id}/payments`)).find((p) => p.payment_status === "SUCCESS") || null;
  }
  await page.evaluate(() => window.__cfClose({ paymentDetails: { paymentMessage: "probe" } }));
  await page.waitForURL(/\/memberships\?show=booked/, { timeout: 60000 }).catch(() => {});
  return { order, paid };
}

/* a published Hip-Hop class `daysOut` ahead, `hours` long, the owner teaching it */
async function makeClass(owner, studioId, daysOut, hours) {
  const starts = new Date(Date.now() + daysOut * 86400000);
  starts.setUTCMinutes(0, 0, 0);
  const cls = await call("POST", "/rest/v1/rpc/create_class_with_session", owner.h, {
    p_business_id: studioId, p_title: "x", p_style: "Hip-Hop", p_level: "beginner", p_room: "Studio A",
    p_price_inr: 300, p_capacity: 10, p_status: "draft", p_starts_at: starts.toISOString(), p_ends_at: new Date(starts.getTime() + hours * 3600000).toISOString(),
  });
  await call("POST", "/rest/v1/class_people", svc, { class_id: cls.id, business_id: studioId, user_id: owner.id, kind: "artist", status: "confirmed", can_attendance: true, can_refunds: false, pay_per_session_inr: 0, created_by: owner.id, updated_by: owner.id });
  await call("PATCH", `/rest/v1/classes?id=eq.${cls.id}`, owner.h, { status: "published" });
  const [row] = await call("GET", `/rest/v1/classes?id=eq.${cls.id}&select=id,share_slug,status,allows_studio_memberships`, svc);
  return row;
}

const passRow = async (id) => (await call("GET", `/rest/v1/membership_passes?id=eq.${id}&select=id,status,units_total,units_used,expires_at`, svc))[0];

(async () => {
  if (env.CASHFREE_ENV !== "sandbox") throw new Error(`refusing: CASHFREE_ENV is ${env.CASHFREE_ENV}, not sandbox`);
  const stamp = Date.now().toString(36);
  const made = { users: [], businesses: [] };
  const errors = [];
  const browser = await chromium.launch();
  try {
    const owner = await makeAccount(stamp, "owner", `Mu Owner ${stamp}`);
    made.users.push(owner.id);
    const buyer = await makeAccount(stamp, "buyer", `Mu Buyer ${stamp}`);
    made.users.push(buyer.id);

    const studio = await call("POST", "/rest/v1/rpc/create_business_with_owner", owner.h, { p_type: "studio", p_name: `Mu Hall ${stamp}`, p_area: "Kothrud", p_city: "Pune", p_styles: ["Hip-Hop"] });
    made.businesses.push(studio.id);
    await call("POST", "/rest/v1/subscriptions", svc, {
      kind: "studio", user_id: owner.id, business_id: studio.id, plan_key: "studio_monthly",
      price_inr: 0, period: "monthly", status: "active",
      current_period_start: new Date().toISOString().slice(0, 10),
      current_period_end: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
      granted: true, note: "Granted by a shoot script — nothing charged", created_by: owner.id, updated_by: owner.id,
    });
    await call("PATCH", `/rest/v1/businesses?id=eq.${studio.id}`, svc, { verified_at: new Date().toISOString(), visibility: "listed" });

    /* two paid memberships through the owner's own door: one to spend, one to return */
    const sell = (name) => call("POST", "/rest/v1/rpc/save_membership", owner.h, {
      p_membership_id: null, p_business_id: studio.id, p_name: name, p_unit: "hours", p_units: 3,
      p_price_inr: 500, p_total_count: 5, p_status: "live", p_validity_days: 30,
    });
    const spendM = await sell(`Mu Spend ${stamp}`);
    const returnM = await sell(`Mu Return ${stamp}`);
    const oneHour = await makeClass(owner, studio.id, 3, 1);
    const threeHour = await makeClass(owner, studio.id, 4, 3);
    check(oneHour.status === "published" && oneHour.allows_studio_memberships === true,
      `set-up: a listed studio, two ₹500 · 3-hour memberships, a 1-hour and a 3-hour class that take a studio pass`);

    /* ── THE BUYER: Buy now, Pay, and the pass is active ── */
    const bp = await (await browser.newContext({ viewport: { width: 430, height: 932 } })).newPage();
    bp.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
    await bp.route("https://sdk.cashfree.com/js/v3/cashfree.js", (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: SDK_STUB }));
    await signIn(bp, buyer);

    const one = await buyAndPay(bp, studio.id, spendM);
    check(one.order && one.order.amount_inr === 500 && one.order.provider === "cashfree" && one.order.business_id === studio.id,
      `the APP made our order and a Cashfree order: ₹${one.order?.amount_inr} for the studio (${one.order?.provider_order_id})`);
    check(Boolean(one.paid), `Cashfree captured ₹${one.paid?.payment_amount} on it`);
    const pass1 = await passRow(one.order.membership_pass_id);
    const [order1] = await call("GET", `/rest/v1/orders?id=eq.${one.order.id}&select=status`, svc);
    const pay1 = await call("GET", `/rest/v1/payments?order_id=eq.${one.order.id}&select=status,amount_inr,business_id`, svc);
    check(order1.status === "paid" && pay1.length === 1 && pay1[0].status === "captured" && pay1[0].business_id === studio.id,
      `the payment landed: order ${order1.status}, payment ${pay1[0]?.status} ₹${pay1[0]?.amount_inr}, on the studio's books`);
    check(pass1.status === "active" && Number(pass1.units_total) === 3 && Number(pass1.units_used) === 0 && Boolean(pass1.expires_at),
      `the pass is ACTIVE: ${pass1.units_used} of ${pass1.units_total} hours used, valid until ${String(pass1.expires_at).slice(0, 10)}`);
    check(/\/memberships/.test(bp.url()), `after paying the buyer lands on their memberships (${new URL(bp.url()).pathname}${new URL(bp.url()).search})`);

    /* ── SPEND IT: a 1-hour class takes ONE hour ── */
    await bp.goto(`${BASE}/c/${oneHour.share_slug}`, { waitUntil: "networkidle" });
    /* ⚠ the passes are options on "How are you paying?" since 18 Oct 2026 — Book Now opens it */
    await bp.getByRole("button", { name: "Book Now" }).click();
    const how = bp.getByRole("dialog", { name: "How are you paying?" });
    await how.waitFor({ timeout: 10000 });
    const sizes = await how.locator('[data-testid="pass-row"], [aria-label="Pay by UPI, card or netbanking"]').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
    check(sizes.length >= 2 && Math.max(...sizes) - Math.min(...sizes) <= 4, `the membership and UPI · Card · Netbanking are one size on the sheet (${sizes.join(", ")}px)`);
    const use = how.getByRole("button", { name: `Use ${spendM.name}` });
    const offered = await use.count();
    const offerText = offered ? (await bp.getByTestId("pass-strip").innerText()).replace(/\s+/g, " ") : "";
    check(offered === 1 && /3 hours left · this class takes 1 hour/.test(offerText), `the class page offers the pass and says what it will take (${offerText})`);
    if (offered) {
      /* ⚠ it ASKS first (18 Oct 2026) — the press opens the question, only its button spends */
      await use.click();
      const ask = bp.getByRole("alertdialog", { name: `Use ${spendM.name} for this class?` });
      await ask.waitFor({ timeout: 10000 });
      const askText = (await ask.innerText()).replace(/\s+/g, " ");
      check(/Left after/.test(askText) && /2 hours of 3 hours/.test(askText), `the question says what will be left (${askText.slice(0, 120)})`);
      await ask.getByRole("button", { name: "Use membership" }).click();
      await bp.getByText(`Booked with ${spendM.name}`).waitFor({ timeout: 30000 }).catch(() => {});
    }
    let p1 = pass1, seat = [];
    for (let i = 0; i < 10; i++) {
      p1 = await passRow(pass1.id);
      seat = await call("GET", `/rest/v1/class_bookings?class_id=eq.${oneHour.id}&user_id=eq.${buyer.id}&status=eq.enrolled&select=id`, svc);
      if (seat.length && Number(p1.units_used) > 0) break;
      await sleep(1500);
    }
    check(seat.length === 1 && Number(p1.units_used) === 1, `one seat booked and ONE hour spent (${seat.length} seat, ${p1.units_used} of 3 used)`);
    const uses = await call("GET", `/rest/v1/membership_uses?pass_id=eq.${pass1.id}&deleted_at=is.null&select=units,class_booking_id`, svc);
    check(uses.length === 1 && Number(uses[0].units) === 1 && uses[0].class_booking_id === seat[0]?.id, `the use row ties the hour to that seat (${uses[0]?.units} h)`);

    /* the invoice says the pass paid — it read "Free" before 18 Oct 2026 */
    await bp.reload({ waitUntil: "networkidle" });
    await bp.getByRole("button", { name: "Invoice" }).click();
    const inv = bp.getByRole("dialog", { name: "Invoice" });
    await inv.waitFor({ timeout: 15000 });
    const invText = (await inv.innerText()).replace(/\s+/g, " ");
    check(/Paid with/.test(invText) && invText.includes(spendM.name) && /FROM YOUR PASS/i.test(invText) && /1 hour/.test(invText) && !/Free/.test(invText),
      `the invoice says the pass paid: "${invText.slice(invText.indexOf("Paid with"), invText.indexOf("Paid with") + 60)}…" — and not Free`);
    await bp.keyboard.press("Escape").catch(() => {});
    await bp.goto(`${BASE}/memberships?show=booked`, { waitUntil: "networkidle" });
    check((await bp.getByLabel("1 of 3 used").count()) > 0, "the pass's bar on the Memberships desk reads 1 of 3 used");

    /* ── A 3-HOUR CLASS: the pass is shown, and refused on the row, not after the press ── */
    await bp.goto(`${BASE}/c/${threeHour.share_slug}`, { waitUntil: "networkidle" });
    await bp.getByRole("button", { name: "Book Now" }).click();
    await bp.getByRole("dialog", { name: "How are you paying?" }).waitFor({ timeout: 10000 });
    const short = bp.getByRole("button", { name: `${spendM.name} — not enough left for this class` });
    check((await short.count()) === 1 && (await short.isDisabled()), "a 3-hour class shows the pass with 2 hours left as NOT enough, and it cannot be pressed");
    check((await bp.getByRole("button", { name: `Use ${spendM.name}` }).count()) === 0, "…and offers no Use button for it");

    /* ── CANCEL THE SEAT: the hour comes back ── */
    await bp.goto(`${BASE}/c/${oneHour.share_slug}`, { waitUntil: "networkidle" });
    await bp.getByRole("button", { name: "Cancel booking" }).click();
    const rs = bp.getByRole("dialog", { name: "Cancel this booking?" });
    await rs.waitFor({ timeout: 15000 });
    const rsText = (await rs.innerText()).replace(/\s+/g, " ");
    check(/come back to your pass/i.test(rsText), `the cancel sheet says the hours come back to the pass ("${rsText.match(/YOUR PASS HOURS[^.]*/i)?.[0] ?? rsText.slice(0, 80)}")`);
    await rs.getByRole("button", { name: "Schedule clash" }).click();
    let back = p1;
    for (let i = 0; i < 10; i++) {
      back = await passRow(pass1.id);
      if (Number(back.units_used) === 0) break;
      await sleep(1500);
    }
    check(Number(back.units_used) === 0 && back.status === "active", `cancelling put the hour back: ${back.units_used} of 3 used, ${back.status}`);

    /* ── THE SELLER SEES IT ── */
    const op = await (await browser.newContext({ viewport: { width: 430, height: 932 } })).newPage();
    op.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
    await signIn(op, owner);
    await op.goto(`${BASE}/business/${studio.id}/memberships/${spendM.id}`, { waitUntil: "networkidle" });
    const holders = (await op.getByTestId("membership-holders").innerText().catch(() => "")).replace(/\s+/g, " ");
    check(holders.includes(buyer.name), `the seller's details page lists the holder (${buyer.name})`);
    await op.goto(`${BASE}/business/${studio.id}/memberships/${spendM.id}?show=earnings`, { waitUntil: "networkidle" });
    const earn = (await op.getByTestId("membership-earnings").innerText().catch(() => "")).replace(/\s+/g, " ");
    check(/₹500/.test(earn), `the seller's Earnings column counts the ₹500 (${earn.slice(0, 90)})`);

    /* ── A SECOND PASS, RETURNED UNUSED: the refund goes to Cashfree ── */
    const two = await buyAndPay(bp, studio.id, returnM);
    check(Boolean(two.paid), `the second pass is paid (₹${two.paid?.payment_amount})`);
    await bp.goto(`${BASE}/memberships?show=booked`, { waitUntil: "networkidle" });
    await bp.getByTestId("my-pass").filter({ hasText: returnM.name }).getByTestId("return-pass").click();
    const dlg = bp.getByRole("alertdialog", { name: `Return ${returnM.name}?` });
    await dlg.waitFor({ timeout: 30000 });
    await dlg.getByRole("button", { name: "Return it" }).click();
    let rf = [];
    for (let i = 0; i < 10; i++) {
      rf = await call("GET", `/rest/v1/refunds?order_id=eq.${two.order.id}&select=id,status,amount_inr,user_id,provider_refund_id`, svc);
      if (rf.length && rf[0].provider_refund_id) break;
      await sleep(1500);
    }
    const pass2 = await passRow(two.order.membership_pass_id);
    check(pass2.status === "cancelled", `the returned pass is cancelled (${pass2.status})`);
    check(rf.length === 1 && rf[0].amount_inr === 500 && rf[0].user_id === buyer.id && Boolean(rf[0].provider_refund_id),
      `one ₹${rf[0]?.amount_inr} refund against the buyer, SENT to Cashfree (cf ${rf[0]?.provider_refund_id ?? "missing"})`);
    if (rf.length) {
      let cfRf = null;
      for (let i = 0; i < 10; i++) {
        cfRf = await cf("GET", `/orders/${two.order.provider_order_id}/refunds/rf_${rf[0].id.replace(/-/g, "")}`).catch(() => null);
        if (cfRf?.refund_status === "SUCCESS") break;
        await sleep(3000);
      }
      check(cfRf && Number(cfRf.refund_amount) === 500, `Cashfree holds the refund under OUR id: ₹${cfRf?.refund_amount} ${cfRf?.refund_status}`);
    }
    check(errors.length === 0, `no page error${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  } catch (e) {
    check(false, `aborted: ${e.message}`);
  } finally {
    await browser.close();
    for (const id of made.businesses) {
      const r = await fetch(`${SUPA}/rest/v1/businesses?id=eq.${id}`, { method: "DELETE", headers: svc });
      if (!r.ok) console.log(`  cleanup: business ${id} -> ${r.status} ${(await r.text()).slice(0, 160)}`);
    }
    for (const id of made.users) {
      const r = await fetch(`${SUPA}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: svc });
      if (!r.ok) console.log(`  cleanup: user ${id} -> ${r.status} ${(await r.text()).slice(0, 160)}`);
    }
    console.log(`\n${ok} passed, ${bad} failed`);
    process.exit(bad ? 1 : 0);
  }
})();
