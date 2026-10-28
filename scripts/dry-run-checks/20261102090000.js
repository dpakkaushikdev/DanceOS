// Checks for 20261102090000_a_practice_has_a_link — run inside the rolled-back
// transaction by scripts/dry-run-migration.js.
module.exports = async (c, { check }) => {
  const q = async (sql, args = []) => (await c.query(sql, args)).rows;
  await q(`select set_config('request.jwt.claims', '{}', true)`);

  const cols = await q(
    `select table_name from information_schema.columns where table_schema = 'public' and column_name = 'place_url' order by table_name`
  );
  check(cols.map((r) => r.table_name).join(",") === "crew_practices,enquiry_practices", "place_url on both practice tables");

  const [fn] = await q(
    `select p.prosecdef d, has_function_privilege('anon', p.oid, 'execute') a, has_function_privilege('authenticated', p.oid, 'execute') u
       from pg_proc p where p.proname = 'set_practice_link' and p.pronamespace = 'public'::regnamespace`
  );
  check(fn && fn.d && !fn.a && fn.u, "set_practice_link: definer, authenticated, not anon");

  const [anonN] = await q(
    `select count(*)::int n from pg_proc p where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')`
  );
  check(anonN.n === 40, "anon's executable set unchanged at 40", `(${anonN.n})`);

  const [pol] = await q(`select count(*)::int n from pg_policies where schemaname = 'public'`);
  check(pol.n >= 100, "policies present", `(${pol.n})`);

  // a crew practice: its leader sets a link, a bad link is refused, a stranger is refused
  const [p] = await q(
    `select p.id, c.leader_id from public.crew_practices p join public.crews c on c.id = p.crew_id
      where p.deleted_at is null and c.deleted_at is null limit 1`
  );
  if (!p) {
    check(true, "no crew practice on this database — crew branch not exercised");
    return;
  }
  const as = async (uid) => {
    await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role: "authenticated" })]);
    await q(`set local role authenticated`);
  };
  await q("savepoint a");
  try {
    await as(p.leader_id);
    await q(`select public.set_practice_link('crew', $1, 'https://maps.app.goo.gl/abc')`, [p.id]);
    await q(`reset role`);
    const [r] = await q(`select place_url from public.crew_practices where id = $1`, [p.id]);
    check(r.place_url === "https://maps.app.goo.gl/abc", "the leader sets the link");
  } catch (e) {
    check(false, "the leader sets the link", e.message);
  }
  await q("rollback to savepoint a");

  await q("savepoint b");
  try {
    await as(p.leader_id);
    await q(`select public.set_practice_link('crew', $1, 'javascript:alert(1)')`, [p.id]);
    check(false, "a javascript: link is refused", "was taken");
  } catch (e) {
    check(/http/.test(e.message), "a javascript: link is refused", e.message);
  }
  await q("rollback to savepoint b");

  await q("savepoint c");
  try {
    const [other] = await q(`select id from public.profiles where id <> $1 and deleted_at is null limit 1`, [p.leader_id]);
    await as(other.id);
    await q(`select public.set_practice_link('crew', $1, 'https://example.com')`, [p.id]);
    check(false, "somebody else is refused", "was taken");
  } catch (e) {
    check(/only the person/.test(e.message), "somebody else is refused", e.message);
  }
  await q("rollback to savepoint c");

  await q("savepoint d");
  try {
    await q(`update public.crew_practices set place_url = 'ftp://x' where id = $1`, [p.id]);
    check(false, "the CHECK refuses a non-web link written directly", "was taken");
  } catch (e) {
    check(/place_url_is_a_web_link/.test(e.message), "the CHECK refuses a non-web link written directly", e.message);
  }
  await q("rollback to savepoint d");

  const [notes] = await q(`select count(*)::int n from public.notifications where created_at > now() - interval '1 minute'`);
  check(notes.n === 0, "setting a link told nobody", `(${notes.n})`);
};
