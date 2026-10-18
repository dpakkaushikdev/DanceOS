// Checks for 20261026090000_the_sender_sees_the_job, run inside the dry run's
// rolled-back transaction by scripts/dry-run-migration.js.
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
  check(!(await q("select 1 from pg_proc where proname = '_dos_swap'")).length, "the helper is gone", "");
  for (const f of ["add_enquiry_person", "remove_enquiry_person"]) {
    const acl = await q("select has_function_privilege('anon', oid, 'execute') a, has_function_privilege('authenticated', oid, 'execute') u, prosecdef d from pg_proc where proname=$1 and pronamespace='public'::regnamespace", [f]);
    check(acl.length === 1 && acl[0].u && !acl[0].a && acl[0].d, `${f}: one definer, authenticated only`, JSON.stringify(acl));
  }
  const anon = await q("select count(*)::int n from pg_proc where pronamespace='public'::regnamespace and has_function_privilege('anon', oid, 'execute')");
  check(anon[0].n === 40, "anon's executable set unchanged", anon[0].n);

  /* 1 · a world */
  const ids = {};
  for (const n of ["owner", "staff", "sender", "dancer", "dancer2", "stranger"]) {
    const id = await uuid();
    ids[n] = id;
    await q(`insert into auth.users (id, email, instance_id, aud, role, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
             values ($1, $2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), '{}', '{}', now(), now())`,
      [id, `dry.sender.${n}.${id.slice(0, 6)}@example.com`]);
    await q(`insert into public.profiles (id, full_name, role, city, created_by, updated_by) values ($1, $2, 'user', 'Pune', $1, $1)`, [id, `Dry ${n}`]);
  }
  const [{ id: biz }] = await q(`insert into public.businesses (name, type, city, visibility, created_by, updated_by) values ('Dry Sender Studio', 'studio', 'Pune', 'unlisted', $1, $1) returning id`, [ids.owner]);
  await q(`insert into public.business_members (business_id, user_id, member_role, created_by, updated_by) values ($1, $2, 'owner', $2, $2)`, [biz, ids.owner]);
  await q(`insert into public.business_members (business_id, user_id, member_role, created_by, updated_by) values ($1, $2, 'staff', $3, $3)`, [biz, ids.staff, ids.owner]);
  const [{ id: enq }] = await q(`insert into public.enquiries (business_id, from_user_id, type_key, message, status, created_by, updated_by) values ($1, $2, 'choreographer', 'Dry run', 'accepted', $2, $2) returning id`, [biz, ids.sender]);

  /* 2 · the business puts its team on and plans a practice */
  await as(ids.owner);
  const [team] = await q("select * from public.add_enquiry_person($1, $2, 'team', 'Choreographer')", [enq, ids.staff]);
  check(team.kind === "team", "the business still adds team", team.kind);
  const start = new Date(Date.now() + 3 * 86400000).toISOString();
  const end = new Date(Date.now() + 3 * 86400000 + 3600000).toISOString();
  const [prac] = await q("select * from public.save_enquiry_practice($1, $2, $3, 'Studio A', null, null)", [enq, start, end]);

  /* 3 · the sender sees it */
  await as(ids.sender);
  const people = await q("select kind from public.enquiry_people where enquiry_id = $1", [enq]);
  check(people.some((p) => p.kind === "team"), "the sender reads the team", JSON.stringify(people));
  const pr = await q("select id from public.enquiry_practices where enquiry_id = $1", [enq]);
  check(pr.length === 1 && pr[0].id === prac.id, "the sender reads the practices", pr.length);

  /* 4 · the sender brings a participant */
  const [part] = await q("select * from public.add_enquiry_person($1, $2, 'participant', 'Bride')", [enq, ids.dancer]);
  check(part.kind === "participant" && part.status === "asked", "the sender adds a participant, ASKED", JSON.stringify(part));
  await refused("the sender cannot add team", "select * from public.add_enquiry_person($1, $2, 'team', null)", [enq, ids.dancer2], /participants/);
  await refused("the sender cannot relabel the business's team", "select * from public.add_enquiry_person($1, $2, 'participant', null)", [enq, ids.staff], /already on this job/);
  await refused("the sender cannot add themselves", "select * from public.add_enquiry_person($1, $2, 'participant', null)", [enq, ids.sender], /sent the enquiry/);

  /* 5 · a stranger sees nothing and adds nobody */
  await as(ids.stranger);
  const sp = await q("select 1 from public.enquiry_people where enquiry_id = $1", [enq]);
  check(sp.length === 0, "a stranger reads no people", sp.length);
  const spr = await q("select 1 from public.enquiry_practices where enquiry_id = $1", [enq]);
  check(spr.length === 0, "a stranger reads no practices", spr.length);
  await refused("a stranger adds nobody", "select * from public.add_enquiry_person($1, $2, 'participant', null)", [enq, ids.dancer2], /person who sent it/);

  /* 6 · removals */
  await as(ids.sender);
  await refused("the sender cannot remove the team", "select public.remove_enquiry_person($1)", [team.id], /person who added them/);
  await q("select public.remove_enquiry_person($1)", [part.id]);
  await asNobody();
  const gone = await q("select deleted_at from public.enquiry_people where id = $1", [part.id]);
  check(gone[0].deleted_at !== null, "the sender removes their own participant", "");
  await as(ids.owner);
  const [p2] = await q("select * from public.add_enquiry_person($1, $2, 'participant', null)", [enq, ids.dancer2]);
  await as(ids.sender);
  await refused("the sender cannot remove a participant the business added", "select public.remove_enquiry_person($1)", [p2.id], /person who added them/);
  await as(ids.owner);
  await q("select public.remove_enquiry_person($1)", [team.id]);
  check(true, "the business still removes anybody", "");
};
