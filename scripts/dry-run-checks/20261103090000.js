// Checks for 20261103090000_a_person_can_be_paid_by_upi — run inside the
// rolled-back transaction by scripts/dry-run-migration.js.
module.exports = async (c, { check }) => {
  const q = async (sql, args = []) => (await c.query(sql, args)).rows;
  await q(`select set_config('request.jwt.claims', '{}', true)`);

  // 1. the column exists and is NOT readable by the app roles — the phone's wall
  const [col] = await q(
    `select count(*)::int n from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'upi_id'`
  );
  check(col.n === 1, "profiles.upi_id exists");
  const [priv] = await q(
    `select has_column_privilege('authenticated', 'public.profiles', 'upi_id', 'select') a,
            has_column_privilege('anon', 'public.profiles', 'upi_id', 'select') n`
  );
  check(priv && !priv.a && !priv.n, "upi_id is not selectable by authenticated or anon");

  // 2. the three doors: definer, authenticated, not anon
  for (const name of ["set_my_upi_id", "upi_id_for_paying", "confirm_payout_received"]) {
    const [fn] = await q(
      `select p.prosecdef d, has_function_privilege('anon', p.oid, 'execute') a, has_function_privilege('authenticated', p.oid, 'execute') u
         from pg_proc p where p.proname = $1 and p.pronamespace = 'public'::regnamespace`,
      [name]
    );
    check(fn && fn.d && !fn.a && fn.u, `${name}: definer, authenticated, not anon`);
  }

  // 3. anon's executable set is unchanged
  const [anonN] = await q(
    `select count(*)::int n from pg_proc p where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')`
  );
  check(anonN.n === 40, "anon's executable set unchanged at 40", `(${anonN.n})`);

  const as = async (uid) => {
    await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role: "authenticated" })]);
    await q(`set local role authenticated`);
  };

  // a payout whose payee is on that business's team, and the business's owner
  const [pay] = await q(
    `select p.id, p.business_id, p.user_id, p.created_by
       from public.payouts p
       join public.business_members m on m.business_id = p.business_id and m.user_id = p.user_id and m.deleted_at is null
      where p.deleted_at is null
      limit 1`
  );
  if (!pay) {
    check(true, "no payout with a team-member payee on this database — behaviours not exercised");
    return;
  }
  const [owner] = await q(
    `select user_id from public.business_members where business_id = $1 and member_role = 'owner' and deleted_at is null limit 1`,
    [pay.business_id]
  );
  const [stranger] = await q(
    `select id from public.profiles p
      where p.deleted_at is null and p.id <> $1 and p.id <> $2
        and not exists (select 1 from public.business_members m where m.user_id = p.id and m.business_id = $3)
      limit 1`,
    [pay.user_id, owner.user_id, pay.business_id]
  );

  // 4. the payee sets, reads, is refused a bad shape, and clears
  await q("savepoint a");
  try {
    await as(pay.user_id);
    await q(`select public.set_my_upi_id(' Priya.S@OKHDFC ')`);
    const [r] = await q(`select public.upi_id_for_paying($1, null) v`, [pay.user_id]);
    check(r.v === "priya.s@okhdfc", "set_my_upi_id stores trimmed lower-case; the owner reads their own", r.v);
    await q(`reset role`);
  } catch (e) {
    check(false, "set_my_upi_id stores trimmed lower-case; the owner reads their own", e.message);
  }
  await q("rollback to savepoint a");

  await q("savepoint b");
  try {
    await as(pay.user_id);
    await q(`select public.set_my_upi_id('priya@')`);
    check(false, "a bad shape is refused with the exact words", "was taken");
  } catch (e) {
    check(e.message.includes("That is not a UPI id — it looks like name@bank"), "a bad shape is refused with the exact words", e.message);
  }
  await q("rollback to savepoint b");

  await q("savepoint c");
  try {
    await as(pay.user_id);
    await q(`select public.set_my_upi_id('priya@okhdfc')`);
    await q(`select public.set_my_upi_id(null)`);
    const [r] = await q(`select public.upi_id_for_paying($1, null) v`, [pay.user_id]);
    check(r.v === null, "set_my_upi_id(null) clears", r.v);
    await q(`reset role`);
  } catch (e) {
    check(false, "set_my_upi_id(null) clears", e.message);
  }
  await q("rollback to savepoint c");

  // 5. who may read it for paying
  await q("savepoint d");
  try {
    await as(pay.user_id);
    await q(`select public.set_my_upi_id('priya@okhdfc')`);
    await q(`reset role`);
    await as(owner.user_id);
    const [o] = await q(`select public.upi_id_for_paying($1, $2) v`, [pay.user_id, pay.business_id]);
    check(o.v === "priya@okhdfc", "the business's owner reads a team member's id for paying", o.v);
    await q(`reset role`);
    if (stranger) {
      await as(stranger.id);
      const [s] = await q(`select public.upi_id_for_paying($1, $2) v`, [pay.user_id, pay.business_id]);
      check(s.v === null, "a stranger reads null, not an error", s.v);
      await q(`reset role`);
    } else {
      check(true, "no stranger profile found — stranger read not exercised");
    }
  } catch (e) {
    check(false, "who may read it for paying", e.message);
  }
  await q("rollback to savepoint d");

  // 6. Received — one savepoint per expected error, since an error aborts the
  //    transaction until the savepoint is rolled back to
  const told = async () =>
    (
      await q(
        `select count(*)::int n from public.notifications where user_id = $1 and created_at > now() - interval '1 minute' and title like '% received ₹%'`,
        [pay.created_by]
      )
    )[0].n;

  await q("savepoint e1");
  try {
    await q(`update public.payouts set status = 'in_transit' where id = $1`, [pay.id]);
    await as(owner.user_id);
    await q(`select public.confirm_payout_received($1)`, [pay.id]);
    check(false, "the payer cannot mark it received", "was taken");
  } catch (e) {
    check(/only the person paid/.test(e.message), "the payer cannot mark it received", e.message);
  }
  await q("rollback to savepoint e1");

  await q("savepoint e2");
  try {
    await q(`update public.payouts set status = 'in_transit' where id = $1`, [pay.id]);
    await as(pay.user_id);
    const [r1] = await q(`select (public.confirm_payout_received($1)).status s`, [pay.id]);
    check(r1.s === "done", "the payee moves in_transit to done", r1.s);
    const [r2] = await q(`select (public.confirm_payout_received($1)).status s`, [pay.id]);
    check(r2.s === "done", "Received again is a no-op", r2.s);
    await q(`reset role`);
    const n = await told();
    check(n === 1, "the payer is told once, and a second Received tells nobody", `(${n})`);
  } catch (e) {
    check(false, "the payee moves in_transit to done", e.message);
  }
  await q("rollback to savepoint e2");

  await q("savepoint e3");
  try {
    await q(`update public.payouts set status = 'failed' where id = $1`, [pay.id]);
    await as(pay.user_id);
    await q(`select public.confirm_payout_received($1)`, [pay.id]);
    check(false, "a failed payout cannot be received", "was taken");
  } catch (e) {
    check(/marked failed/.test(e.message), "a failed payout cannot be received", e.message);
  }
  await q("rollback to savepoint e3");

  await q("savepoint e4");
  try {
    await as(pay.user_id);
    await q(`select public.confirm_payout_received('00000000-0000-0000-0000-000000000000')`);
    check(false, "a missing payout is not on record", "was taken");
  } catch (e) {
    check(/not on record/.test(e.message), "a missing payout is not on record", e.message);
  }
  await q("rollback to savepoint e4");
};
