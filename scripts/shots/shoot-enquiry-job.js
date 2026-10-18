/* AN ENQUIRY JOB, DRIVEN END TO END (18 Oct 2026, `20261025090000`).

   A real studio, a real sender and a real participant, and the whole job loop
   in a browser:

     · the owner adds the participant from the enquiry's Team — they read ASKED;
     · the participant answers on /inbox?show=jobs — Accept — and the card says
       they are on it, and the owner's Team reads Confirmed;
     · the owner arranges a practice from the enquiry's Practices — the card
       links to /practice/job/{id}, with no register inline;
     · it is on the participant's /practice (the Enquiry type) and on their
       calendar, and its own page shows the participant no register;
     · the owner opens /practice/job/{id} and checks the participant in — read
       back out of the database;
     · both ends add a link on Files, and a javascript: link is refused in words.

   Everything it makes it deletes in a `finally` that reads its own status.

   Run:  $env:DANCEOS_BASE_URL="http://localhost:3100"; $env:NODE_PATH="$pwd\node_modules"; node scripts/shots/shoot-enquiry-job.js  */
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const REPO = path.join(__dirname, "..", "..");
const BASE = process.env.DANCEOS_BASE_URL || "http://localhost:3100";
const env = Object.fromEntries(
  fs.readFileSync(path.join(REPO, ".env.local"), "utf8").split(/\r?\n/).filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const UA = "danceos-proof";
const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", Prefer: "return=representation", "User-Agent": UA };

let ok = 0, bad = 0;
const check = (c, m) => { console.log((c ? "  ok   " : "  FAIL ") + m); c ? ok++ : bad++; };

async function call(method, url, headers, body) {
  const r = await fetch(url.startsWith("http") ? url : `${SUPA}${url}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${url} -> ${r.status} ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
}

async function makeAccount(stamp, who, fullName) {
  const email = `ejob.${who}.${stamp}@example.com`;
  const password = `Ejob!${stamp}aA1`;
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

/* tomorrow in IST, as the date input wants it */
const tomorrowIst = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + 26 * 3600000));

(async () => {
  const stamp = Date.now().toString(36);
  const made = { users: [], businesses: [], enquiries: [] };
  const browser = await chromium.launch();
  const errs = [];
  try {
    const owner = await makeAccount(stamp, "owner", `Job Owner ${stamp}`);
    made.users.push(owner.id);
    const sender = await makeAccount(stamp, "sender", `Job Sender ${stamp}`);
    made.users.push(sender.id);
    const dancer = await makeAccount(stamp, "dancer", `Job Dancer ${stamp}`);
    made.users.push(dancer.id);

    const studio = await call("POST", "/rest/v1/rpc/create_business_with_owner", owner.h, { p_type: "studio", p_name: `Job Hall ${stamp}`, p_area: "Kothrud", p_city: "Pune", p_styles: ["Hip-Hop"] });
    made.businesses.push(studio.id);
    await call("PATCH", `/rest/v1/businesses?id=eq.${studio.id}`, svc, { verified_at: new Date().toISOString(), visibility: "listed" });

    /* an enquiry ON — planted with the service role, the way shoot-inbox does */
    const [enq] = await call("POST", "/rest/v1/enquiries", svc, {
      business_id: studio.id, from_user_id: sender.id, type_key: "choreographer", fields: [["What for", "Event"]],
      dates: [tomorrowIst()], message: "Job probe", status: "ongoing", created_by: sender.id, updated_by: sender.id,
    });
    made.enquiries.push(enq.id);

    const ctx = () => browser.newContext({ viewport: { width: 430, height: 932 } });
    const op = await (await ctx()).newPage();
    const dp = await (await ctx()).newPage();
    const sp = await (await ctx()).newPage();
    for (const p of [op, dp, sp]) p.on("pageerror", (e) => errs.push(e.message));
    await signIn(op, owner);
    await signIn(dp, dancer);
    await signIn(sp, sender);

    /* ── 1 · THE OWNER ADDS THE PARTICIPANT, WHO READS ASKED ── */
    await op.goto(`${BASE}/inbox/enquiries/${enq.id}?show=team`, { waitUntil: "networkidle" });
    await op.getByRole("button", { name: "+ Add participant" }).click();
    await op.getByLabel("Role").fill("Dancer");
    await op.getByLabel("Search DanceOS for a dancer").fill(dancer.name);
    await op.getByRole("button", { name: `Add ${dancer.name} as a participant` }).click();
    const personRow = op.getByTestId("enquiry-person").filter({ hasText: dancer.name });
    await personRow.waitFor({ timeout: 20000 });
    check((await personRow.getByTestId("enquiry-person-status").getAttribute("data-status")) === "asked", "owner's Team: the participant reads Asked until they answer");

    /* ── 2 · THE PARTICIPANT ACCEPTS ON /inbox?show=jobs ── */
    await dp.goto(`${BASE}/inbox?show=jobs`, { waitUntil: "networkidle" });
    check((await dp.getByRole("button", { name: "Your jobs" }).getAttribute("aria-pressed")) === "true", "participant: ?show=jobs opens the Jobs column");
    const job = dp.getByTestId("enquiry-job").filter({ hasText: `Job Hall ${stamp}` });
    await job.waitFor({ timeout: 20000 });
    check((await job.getByTestId("enquiry-job-status").getAttribute("data-status")) === "asked", "participant: the job card reads Asked");
    await job.getByRole("button", { name: `Accept the job with Job Hall ${stamp}` }).click();
    await job.getByTestId("enquiry-job-status").and(dp.locator('[data-status="confirmed"]')).waitFor({ timeout: 20000 });
    check(true, "participant: Accept turns the card to On it");
    const [pRow] = await call("GET", `/rest/v1/enquiry_people?enquiry_id=eq.${enq.id}&user_id=eq.${dancer.id}&deleted_at=is.null&select=status`, svc);
    check(pRow && pRow.status === "confirmed", `the database reads the seat confirmed (${pRow ? pRow.status : "no row"})`);

    /* ── 3 · THE OWNER ARRANGES A PRACTICE ── */
    await op.goto(`${BASE}/inbox/enquiries/${enq.id}?show=practices`, { waitUntil: "networkidle" });
    await op.getByRole("button", { name: "+ Add practice" }).click();
    await op.locator("#ep-date").fill(tomorrowIst());
    await op.locator("#ep-start").fill("18:00");
    await op.locator("#ep-end").fill("19:30");
    await op.locator("#ep-place").fill(`Hall ${stamp}`);
    await op.getByRole("button", { name: "Add practice", exact: true }).click();
    const pCard = op.getByTestId("enquiry-practice-card").filter({ hasText: `Hall ${stamp}` });
    await pCard.waitFor({ timeout: 20000 });
    const [pr] = await call("GET", `/rest/v1/enquiry_practices?enquiry_id=eq.${enq.id}&deleted_at=is.null&select=id`, svc);
    check(Boolean(pr), "the practice is saved");
    const href = await pCard.getByRole("link", { name: /^Open the practice — / }).getAttribute("href");
    check(href === `/practice/job/${pr.id}`, `the enquiry's practice card opens its own page (${href})`);
    check((await op.getByRole("button", { name: /^Check .* in$/ }).count()) === 0, "no register inline on the enquiry page any more");

    /* ── 4 · IT IS ON THE PARTICIPANT'S /practice AND CALENDAR ── */
    await dp.goto(`${BASE}/practice?type=enquiry`, { waitUntil: "networkidle" });
    check((await dp.getByTestId("practice-types").count()) === 1, "participant /practice: the Crew · Enquiry types are drawn");
    check((await dp.getByRole("link", { name: "Enquiry practices" }).getAttribute("aria-current")) === "page", "participant /practice: the Enquiry type is the one shown");
    check((await dp.getByTestId("enquiry-practice-card").filter({ hasText: `Hall ${stamp}` }).count()) === 1, "participant /practice: the job's practice is listed");
    await dp.goto(`${BASE}/calendar`, { waitUntil: "networkidle" });
    check((await dp.locator(`a[href="/practice/job/${pr.id}"]`).count()) >= 1, "participant calendar: the practice is on it, opening its own page");
    await dp.goto(`${BASE}/practice/job/${pr.id}`, { waitUntil: "networkidle" });
    check((await dp.getByTestId("practice-detail").getAttribute("data-part")) === "participant", "participant: the practice page knows them as a participant");
    check((await dp.getByTestId("practice-register").count()) === 0, "participant: no register for somebody who does not run it");

    /* ── 5 · THE RUNNER CHECKS THEM IN ── */
    await op.goto(`${BASE}/practice/job/${pr.id}`, { waitUntil: "networkidle" });
    check((await op.getByTestId("practice-detail").getAttribute("data-part")) === "runs", "owner: the practice page knows them as the runner");
    await op.getByRole("button", { name: `Check ${dancer.name} in` }).click();
    await op.getByRole("button", { name: `Take ${dancer.name} off the register` }).waitFor({ timeout: 20000 });
    const att = await call("GET", `/rest/v1/enquiry_practice_attendance?practice_id=eq.${pr.id}&user_id=eq.${dancer.id}&deleted_at=is.null&select=id`, svc).catch(() => null);
    check(Array.isArray(att) && att.length === 1, `the check-in is one live attendance row (${att ? att.length : "unread"})`);

    /* ── 6 · FILES, FROM BOTH ENDS ── */
    for (const [page, who] of [[op, "owner"], [sp, "sender"]]) {
      await page.goto(`${BASE}/inbox/enquiries/${enq.id}?show=files`, { waitUntil: "networkidle" });
      await page.getByTestId("enquiry-files").waitFor({ timeout: 20000 });
      await page.getByRole("group", { name: "What kind of link" }).getByRole("button", { name: /Music/ }).click();
      await page.locator("#ef-name").fill(`Mix ${who} ${stamp}`);
      await page.locator("#ef-url").fill(`https://example.com/${who}-${stamp}.mp3`);
      await page.getByRole("button", { name: "Add link", exact: true }).click();
      const row = page.getByTestId("enquiry-file").filter({ hasText: `Mix ${who} ${stamp}` });
      await row.waitFor({ timeout: 20000 });
      const a = row.getByRole("link", { name: new RegExp(`^Open Mix ${who} ${stamp}`) });
      check((await a.getAttribute("target")) === "_blank" && /noopener/.test((await a.getAttribute("rel")) || ""), `${who}: the link is added, and opens in a new tab with noopener`);
    }
    await sp.locator("#ef-name").fill(`Bad ${stamp}`);
    await sp.locator("#ef-url").fill("javascript:alert(1)");
    await sp.getByRole("button", { name: "Add link", exact: true }).click();
    await sp.getByText(/not a web link/).waitFor({ timeout: 20000 }).catch(() => {});
    check((await sp.getByText(/not a web link/).count()) >= 1, "sender: a javascript: link is refused in words");
    const files = await call("GET", `/rest/v1/enquiry_files?enquiry_id=eq.${enq.id}&deleted_at=is.null&select=url`, svc);
    check(files.length === 2 && files.every((f) => /^https:/.test(f.url)), `the database holds the two good links and not the bad one (${files.length})`);

    check(errs.length === 0, `no page error (${errs.slice(0, 2).join(" | ") || "none"})`);
  } catch (e) {
    check(false, `run died: ${e.message}`);
  } finally {
    await browser.close();
    for (const id of made.enquiries) {
      const r = await fetch(`${SUPA}/rest/v1/enquiries?id=eq.${id}`, { method: "DELETE", headers: svc });
      if (!r.ok) console.log(`  ⚠ cleanup enquiry ${id}: ${r.status} ${(await r.text()).slice(0, 160)}`);
    }
    for (const id of made.businesses) {
      const r = await fetch(`${SUPA}/rest/v1/businesses?id=eq.${id}`, { method: "DELETE", headers: svc });
      if (!r.ok) console.log(`  ⚠ cleanup business ${id}: ${r.status} ${(await r.text()).slice(0, 160)}`);
    }
    for (const id of made.users) {
      const r = await fetch(`${SUPA}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: svc });
      if (!r.ok) console.log(`  ⚠ cleanup user ${id}: ${r.status}`);
    }
    console.log(`\n${ok} passed, ${bad} failed`);
    process.exit(bad ? 1 : 0);
  }
})();
