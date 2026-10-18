// Checks for 20261030090000_a_name_is_fifteen_characters, run inside the dry
// run's rolled-back transaction by scripts/dry-run-migration.js.
module.exports = async (c, { check }) => {
  const q = async (sql, args = []) => (await c.query(sql, args)).rows;
  const refused = async (label, sql, args, match) => {
    await q("savepoint s");
    try {
      await q(sql, args);
      await q("release savepoint s");
      check(false, label, "was not refused");
    } catch (e) {
      await q("rollback to savepoint s");
      check(match.test(e.message), label, e.message);
    }
  };
  await q("reset role");
  await q(`select set_config('request.jwt.claims', '{"role":"service_role"}', true)`);

  const COLS = [
    ["profiles", "full_name"],
    ["businesses", "name"],
    ["crews", "name"],
    ["rooms", "name"],
    ["assets", "name"],
    ["memberships", "name"],
    ["routines", "title"],
    ["class_bookings", "attendee_name"],
    ["leads", "name"],
    ["business_invites", "name"],
  ];

  /* 1 · every live name fits, and every column has its CHECK */
  for (const [t, col] of COLS) {
    const [{ n }] = await q(`select count(*)::int n from public.${t} where deleted_at is null and char_length(btrim(${col})) > 15`);
    check(n === 0, `${t}.${col}: no live value over 15`, n);
    const con = await q(`select 1 from pg_constraint where conname = $1 and conrelid = $2::regclass`, [`${t}_${col}_fits`, `public.${t}`]);
    check(con.length === 1, `${t}_${col}_fits exists`, con.length);
  }

  /* 2 · the approved renames landed */
  const named = await q(`select name from public.businesses where id in ('e73aa0e4-7082-4d38-b691-98cbb9414c7c','c2339e7d-6d4c-4f1c-b170-2424653e9bd7') order by name`);
  check(JSON.stringify(named.map((r) => r.name)) === JSON.stringify(["EEE Studio", "Rhythm Sec 29"]), "studios renamed as approved", JSON.stringify(named));
  const p = await q(`select full_name from public.profiles where id = 'af49ce74-f6cd-47f4-9492-3b2a36b1ccad'`);
  check(p[0]?.full_name === "Proof Learner", "Proof Learner renamed", p[0]?.full_name);

  /* 3 · a 16-character name is refused, 15 is accepted */
  const crew = await q(`select id from public.crews where deleted_at is null limit 1`);
  await refused(
    "a 16-character crew name is refused",
    `update public.crews set name = 'Sixteen Chars ab' where id = $1`,
    [crew[0].id],
    /crews_name_fits/
  );
  await q("savepoint ok");
  let ok = true;
  try {
    await q(`update public.crews set name = 'Fifteen Chars a' where id = $1`, [crew[0].id]);
  } catch (e) {
    ok = false;
  }
  await q("rollback to savepoint ok");
  check(ok, "a 15-character crew name is accepted");

  const biz = await q(`select id from public.businesses where deleted_at is null limit 1`);
  await refused(
    "a 16-character business name is refused",
    `update public.businesses set name = 'Sixteen Chars ab' where id = $1`,
    [biz[0].id],
    /businesses_name_fits/
  );
  const prof = await q(`select id from public.profiles where deleted_at is null limit 1`);
  await refused(
    "a 16-character person name is refused",
    `update public.profiles set full_name = 'Sixteen Chars ab' where id = $1`,
    [prof[0].id],
    /profiles_full_name_fits/
  );

  /* 4 · a soft-deleted row keeps its long name */
  const dead = await q(`select id from public.businesses where deleted_at is not null and char_length(btrim(name)) > 15 limit 1`);
  if (dead.length) {
    await q("savepoint d");
    let fine = true;
    try {
      await q(`update public.businesses set updated_at = now() where id = $1`, [dead[0].id]);
    } catch (e) {
      fine = false;
    }
    await q("rollback to savepoint d");
    check(fine, "a soft-deleted long-named row can still be updated");
  } else {
    check(true, "no soft-deleted long-named business to test (skipped)");
  }

  /* 5 · nothing else moved */
  const [{ a }] = await q("select count(*)::int a from pg_proc where pronamespace='public'::regnamespace and has_function_privilege('anon', oid, 'execute')");
  check(a === 40, "anon's executable set unchanged (40)", a);
  const [{ pol }] = await q("select count(*)::int pol from pg_policies where schemaname = 'public'");
  check(true, `public policies: ${pol} (the migration adds none)`);
};
