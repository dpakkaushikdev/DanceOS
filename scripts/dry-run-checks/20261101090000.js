// Checks for 20261101090000_a_name_is_twenty_five_characters — run inside the
// rolled-back transaction by scripts/dry-run-migration.js.
module.exports = async (c, { check }) => {
  const q = async (sql, args = []) => (await c.query(sql, args)).rows;
  await q(`select set_config('request.jwt.claims', '{}', true)`);
  const rows = await q(
    `select conrelid::regclass::text t, pg_get_constraintdef(oid) d from pg_constraint where conname like '%\\_fits' escape '\\' and connamespace = 'public'::regnamespace`
  );
  check(rows.length === 10, "ten _fits constraints", `(${rows.length})`);
  check(rows.every((r) => r.d.includes("<= 25")), "every one says 25");
  check(rows.every((r) => !r.d.includes("<= 15")), "none says 15");
  const [b] = await q(`select id from public.businesses where deleted_at is null limit 1`);
  await q("savepoint s1");
  try {
    await q(`update public.businesses set name = repeat('a', 25) where id = $1`, [b.id]);
    check(true, "a 25-character name is taken");
  } catch (e) {
    check(false, "a 25-character name is taken", e.message);
  }
  await q("rollback to savepoint s1");
  await q("savepoint s2");
  try {
    await q(`update public.businesses set name = repeat('a', 26) where id = $1`, [b.id]);
    check(false, "a 26-character name is refused", "was taken");
  } catch (e) {
    check(/_fits/.test(e.message), "a 26-character name is refused", e.message);
  }
  await q("rollback to savepoint s2");
};
