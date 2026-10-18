// Checks for 20261027090000_the_sender_is_on_the_register, run inside the dry
// run's rolled-back transaction by scripts/dry-run-migration.js.
module.exports = async (c, { check }) => {
  const q = async (sql, args = []) => (await c.query(sql, args)).rows;
  const as = async (sub) => {
    await q("reset role");
    await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub, role: "authenticated" })]);
    await q("set local role authenticated");
  };
  const asNobody = async () => {
    await q("reset role");
    await q(`select set_config('request.jwt.claims', '{}', true)`);
  };
  const uuid = async () => (await q("select gen_random_uuid() u"))[0].u;
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

  /* 0 · shape */
  await asNobody();
  for (const f of ["my_enquiry_practices", "check_in_enquiry_practice"]) {
    const acl = await q(
      "select has_function_privilege('anon', oid, 'execute') a, has_function_privilege('authenticated', oid, 'execute') u, prosecdef d from pg_proc where proname=$1 and pronamespace='public'::regnamespace",
      [f]
    );
    check(acl.length === 1 && acl[0].u && !acl[0].a && acl[0].d, `${f}: one definer, authenticated only`, JSON.stringify(acl));
  }
  const anon = await q("select count(*)::int n from pg_proc where pronamespace='public'::regnamespace and has_function_privilege('anon', oid, 'execute')");
  check(anon[0].n === 40, "anon's executable set unchanged", anon[0].n);

  /* 1 · a world */
  const ids = {};
  for (const n of ["owner", "staff", "sender", "stranger"]) {
    const id = await uuid();
    ids[n] = id;
    await q(
      `insert into auth.users (id, email, instance_id, aud, role, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values ($1, $2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), '{}', '{}', now(), now())`,
      [id, `dry.reg.${n}.${id.slice(0, 6)}@example.com`]
    );
    await q(`insert into public.profiles (id, full_name, role, city, created_by, updated_by) values ($1, $2, 'user', 'Pune', $1, $1)`, [id, `Dry ${n}`]);
  }
  const [{ id: biz }] = await q(
    `insert into public.businesses (name, type, city, visibility, created_by, updated_by) values ('Dry Register Studio', 'studio', 'Pune', 'unlisted', $1, $1) returning id`,
    [ids.owner]
  );
  await q(`insert into public.business_members (business_id, user_id, member_role, created_by, updated_by) values ($1, $2, 'owner', $2, $2)`, [biz, ids.owner]);
  await q(`insert into public.business_members (business_id, user_id, member_role, created_by, updated_by) values ($1, $2, 'staff', $3, $3)`, [biz, ids.staff, ids.owner]);
  const [{ id: enq }] = await q(
    `insert into public.enquiries (business_id, from_user_id, type_key, message, status, created_by, updated_by) values ($1, $2, 'choreographer', 'Dry run', 'accepted', $2, $2) returning id`,
    [biz, ids.sender]
  );
  const start = new Date(Date.now() + 3 * 86400000).toISOString();
  const end = new Date(Date.now() + 3 * 86400000 + 3600000).toISOString();
  const from = new Date(Date.now() - 86400000).toISOString();
  const to = new Date(Date.now() + 30 * 86400000).toISOString();

  await as(ids.owner);
  await q("select * from public.add_enquiry_person($1, $2, 'team', 'Choreographer')", [enq, ids.staff]);
  const [prac] = await q("select * from public.save_enquiry_practice($1, $2, $3, 'Studio A', null, null)", [enq, start, end]);

  /* 2 · who reads what */
  const ownerRows = await q("select my_part, people from public.my_enquiry_practices($1, $2) where id = $3", [from, to, prac.id]);
  check(ownerRows.length === 1 && ownerRows[0].my_part === "runs", "the owner still reads it as runs", JSON.stringify(ownerRows));
  await asNobody();
  const confirmed = (await q("select count(*)::int n from public.enquiry_people where enquiry_id=$1 and deleted_at is null and status='confirmed'", [enq]))[0].n;
  check(ownerRows[0] && ownerRows[0].people === confirmed + 1, "people counts the confirmed AND the sender", `${ownerRows[0] && ownerRows[0].people} vs ${confirmed}+1`);

  await as(ids.sender);
  const senderRows = await q("select my_part from public.my_enquiry_practices($1, $2) where id = $3", [from, to, prac.id]);
  check(senderRows.length === 1 && senderRows[0].my_part === "sender", "the sender reads it, as sender", JSON.stringify(senderRows));

  await as(ids.stranger);
  const strangerRows = await q("select 1 from public.my_enquiry_practices($1, $2) where id = $3", [from, to, prac.id]);
  check(strangerRows.length === 0, "a stranger reads nothing", strangerRows.length);

  /* 3 · the register */
  await as(ids.owner);
  await q("select public.check_in_enquiry_practice($1, $2)", [prac.id, ids.sender]);
  await q("select public.check_in_enquiry_practice($1, $2)", [prac.id, ids.sender]);
  await asNobody();
  const att = await q("select count(*)::int n from public.enquiry_practice_attendance where practice_id=$1 and user_id=$2 and deleted_at is null", [prac.id, ids.sender]);
  check(att[0].n === 1, "the owner checks the sender in, twice is once", att[0].n);

  await as(ids.owner);
  await refused("a stranger cannot be checked in", "select public.check_in_enquiry_practice($1, $2)", [prac.id, ids.stranger], /not said yes/);
  await as(ids.sender);
  await refused("the sender cannot run the register", "select public.check_in_enquiry_practice($1, $2)", [prac.id, ids.sender], /owners and managers/);
};
