// Checks for 20261106090000_a_upi_id_is_verified — run inside the rolled-back
// transaction by scripts/dry-run-migration.js.
module.exports = async (c, { check }) => {
  const q = async (sql, args = []) => (await c.query(sql, args)).rows;
  await q(`select set_config('request.jwt.claims', '{}', true)`);

  // 1. the three columns exist and sit behind the phone's wall, like upi_id
  for (const col of ["upi_name_at_bank", "upi_verified_at", "upi_verification_ref"]) {
    const [n] = await q(
      `select count(*)::int n from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = $1`,
      [col]
    );
    check(n.n === 1, `profiles.${col} exists`);
    const [priv] = await q(
      `select has_column_privilege('authenticated', 'public.profiles', $1, 'select') a,
              has_column_privilege('anon', 'public.profiles', $1, 'select') n`,
      [col]
    );
    check(priv && !priv.a && !priv.n, `${col} is not selectable by authenticated or anon`);
  }

  // 2. the doors: who may open which
  const fnPriv = async (name, nargs) => {
    const [fn] = await q(
      `select p.prosecdef d, has_function_privilege('anon', p.oid, 'execute') a, has_function_privilege('authenticated', p.oid, 'execute') u
         from pg_proc p where p.proname = $1 and p.pronamespace = 'public'::regnamespace and p.pronargs = $2`,
      [name, nargs]
    );
    return fn;
  };
  const setMine = await fnPriv("set_my_upi_id", 1);
  check(setMine && setMine.d && !setMine.a && setMine.u, "set_my_upi_id: definer, authenticated, not anon");
  const setVerified = await fnPriv("set_upi_id_verified", 4);
  check(setVerified && setVerified.d && !setVerified.a && !setVerified.u, "set_upi_id_verified: definer, NOT authenticated, NOT anon (service role only)");
  const forPaying = await fnPriv("upi_for_paying", 2);
  check(forPaying && forPaying.d && !forPaying.a && forPaying.u, "upi_for_paying: definer, authenticated, not anon");
  const old = await fnPriv("upi_id_for_paying", 2);
  check(old && old.d && !old.a && old.u, "upi_id_for_paying is untouched (still answers)");

  // 3. anon's executable set is unchanged
  const [anonN] = await q(
    `select count(*)::int n from pg_proc p where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')`
  );
  check(anonN.n === 40, "anon's executable set unchanged at 40", `(${anonN.n})`);

  const as = async (uid) => {
    await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role: "authenticated" })]);
    await q(`set local role authenticated`);
  };
  const asService = async () => {
    await q(`reset role`);
    await q(`select set_config('request.jwt.claims', '{}', true)`);
  };

  const [pay] = await q(
    `select p.id, p.business_id, p.user_id
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

  // 4. the person sets an id: stored, UNVERIFIED (nothing has asked Cashfree)
  await q("savepoint a");
  try {
    await as(pay.user_id);
    await q(`select public.set_my_upi_id('Priya.S@OKHDFC')`);
    const [r] = await q(`select * from public.upi_for_paying($1, null)`, [pay.user_id]);
    check(r && r.upi_id === "priya.s@okhdfc" && r.name_at_bank === null && r.verified_at === null, "a freshly set id reads back unverified, no name", JSON.stringify(r));
    await asService();
  } catch (e) {
    await asService();
    check(false, "a freshly set id reads back unverified, no name", e.message);
  }
  await q("rollback to savepoint a");

  // 5. the person may NOT mark their own id verified
  //    ⚠ a refused statement ABORTS the transaction, so the expected refusal
  //    sits in its own savepoint and is rolled back before anything else runs
  await q("savepoint b");
  try {
    await as(pay.user_id);
    await q(`select public.set_my_upi_id('priya.s@okhdfc')`);
    let refused = false;
    await q("savepoint b1");
    try {
      await q(`select public.set_upi_id_verified($1, 'priya.s@okhdfc', 'FAKE NAME', 'fake-ref')`, [pay.user_id]);
    } catch (e) {
      refused = /permission denied/i.test(e.message);
    }
    await q("rollback to savepoint b1");
    check(refused, "an authenticated person is refused set_upi_id_verified (permission denied)");
    const [still] = await q(`select * from public.upi_for_paying($1, null)`, [pay.user_id]);
    check(still && still.verified_at === null && still.name_at_bank === null, "…and their id stays unverified after the attempt");
    await asService();
  } catch (e) {
    await q("rollback to savepoint b");
    await asService();
    check(false, "an authenticated person is refused set_upi_id_verified (permission denied)", e.message);
  }
  await q("rollback to savepoint b");

  // 6. the service role marks it verified; the owner reads the name; a stranger reads nothing
  await q("savepoint c");
  try {
    await as(pay.user_id);
    await q(`select public.set_my_upi_id('priya.s@okhdfc')`);
    await asService();
    await q(`select public.set_upi_id_verified($1, 'priya.s@okhdfc', 'PRIYA SHARMA', 'cf-ref-123')`, [pay.user_id]);

    await as(owner.user_id);
    const [o] = await q(`select * from public.upi_for_paying($1, $2)`, [pay.user_id, pay.business_id]);
    check(o && o.upi_id === "priya.s@okhdfc" && o.name_at_bank === "PRIYA SHARMA" && o.verified_at !== null, "the business's owner reads the id, the name at the bank and the verification", JSON.stringify(o));
    const oldRead = await q(`select public.upi_id_for_paying($1, $2) v`, [pay.user_id, pay.business_id]);
    check(oldRead[0] && oldRead[0].v === "priya.s@okhdfc", "the old upi_id_for_paying still answers the owner");
    await asService();

    if (stranger) {
      await as(stranger.id);
      const s = await q(`select * from public.upi_for_paying($1, $2)`, [pay.user_id, pay.business_id]);
      check(s.length === 0, "a stranger reads no row at all");
      await asService();
    }
  } catch (e) {
    await asService();
    check(false, "the business's owner reads the id, the name at the bank and the verification", e.message);
  }
  await q("rollback to savepoint c");

  // 7. a CHANGED id drops its verification; the SAME id keeps it; clearing clears all
  await q("savepoint d");
  try {
    await as(pay.user_id);
    await q(`select public.set_my_upi_id('priya.s@okhdfc')`);
    await asService();
    await q(`select public.set_upi_id_verified($1, 'priya.s@okhdfc', 'PRIYA SHARMA', 'cf-ref-123')`, [pay.user_id]);

    await as(pay.user_id);
    await q(`select public.set_my_upi_id('PRIYA.S@okhdfc')`); // same id, different case
    const [same] = await q(`select * from public.upi_for_paying($1, null)`, [pay.user_id]);
    check(same && same.verified_at !== null && same.name_at_bank === "PRIYA SHARMA", "re-saving the same id (any case) keeps its verification");

    await q(`select public.set_my_upi_id('priya@okaxis')`);
    const [changed] = await q(`select * from public.upi_for_paying($1, null)`, [pay.user_id]);
    check(changed && changed.upi_id === "priya@okaxis" && changed.verified_at === null && changed.name_at_bank === null, "a different id starts unverified");

    await q(`select public.set_my_upi_id(null)`);
    const none = await q(`select * from public.upi_for_paying($1, null)`, [pay.user_id]);
    check(none.length === 0, "clearing the id leaves no row to read");
    await asService();
    const [cols] = await q(`select upi_id, upi_name_at_bank, upi_verified_at, upi_verification_ref from public.profiles where id = $1`, [pay.user_id]);
    check(cols && cols.upi_id === null && cols.upi_name_at_bank === null && cols.upi_verified_at === null && cols.upi_verification_ref === null, "all four UPI columns are null after clearing");
  } catch (e) {
    await asService();
    check(false, "a different id starts unverified", e.message);
  }
  await q("rollback to savepoint d");

  // 8. the service door refuses a bad shape and an unknown person
  await q("savepoint e");
  let badShape = false;
  try {
    await q(`select public.set_upi_id_verified($1, 'not-a-vpa', 'X', 'r')`, [pay.user_id]);
  } catch (e) {
    badShape = /name@bank/.test(e.message);
  }
  check(badShape, "set_upi_id_verified refuses a non-VPA in words");
  await q("rollback to savepoint e");
  await q("savepoint f");
  let noSuch = false;
  try {
    await q(`select public.set_upi_id_verified('00000000-0000-0000-0000-000000000000', 'nobody@okaxis', 'X', 'r')`);
  } catch (e) {
    noSuch = /no such person/.test(e.message);
  }
  check(noSuch, "set_upi_id_verified refuses an unknown person");
  await q("rollback to savepoint f");
};
