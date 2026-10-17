// Checks for 20261022090000_a_studio_or_a_crew_can_be_deleted, run inside the
// dry run's rolled-back transaction by scripts/dry-run-migration.js.
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

  /* 0 · the grants, and nothing else moved */
  await asNobody();
  for (const f of ["delete_studio", "delete_crew"]) {
    const acl = await q("select has_function_privilege('anon', oid, 'execute') a, has_function_privilege('authenticated', oid, 'execute') u from pg_proc where proname=$1 and pronamespace='public'::regnamespace", [f]);
    check(acl.length === 1 && acl[0].u && !acl[0].a, `${f}: authenticated, never anon`, JSON.stringify(acl));
  }
  const anon = await q("select count(*)::int n from pg_proc p where pronamespace='public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')");
  check(anon[0].n === 40, "anon executable set still 40", anon[0].n);
  const pol = await q("select count(*)::int n from pg_policies where schemaname='public'");
  check(pol[0].n === 107, "public policies still 107", pol[0].n);

  /* 1 · people, a studio with a second owner and a staff seat, a crew */
  const ids = {};
  for (const n of ["owner", "owner2", "staff", "leader", "member", "stranger"]) {
    const id = await uuid();
    ids[n] = id;
    await q(`insert into auth.users (id, email, instance_id, aud, role, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
             values ($1, $2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), '{}', '{}', now(), now())`,
      [id, `dry.del.${n}.${id.slice(0, 6)}@example.com`]);
    await q(`insert into public.profiles (id, full_name, role, city, created_by, updated_by) values ($1, $2, 'user', 'Pune', $1, $1)`, [id, `Dry ${n}`]);
  }
  const [{ id: studio }] = await q(`insert into public.businesses (name, type, city, visibility, created_by, updated_by) values ('Dry Del Studio', 'studio', 'Pune', 'unlisted', $1, $1) returning id`, [ids.owner]);
  await q(`insert into public.business_members (business_id, user_id, member_role, created_by, updated_by, created_at) values ($1, $2, 'owner', $2, $2, now() - interval '1 day')`, [studio, ids.owner]);
  await q(`insert into public.business_members (business_id, user_id, member_role, created_by, updated_by) values ($1, $2, 'owner', $2, $2)`, [studio, ids.owner2]);
  await q(`insert into public.business_members (business_id, user_id, member_role, created_by, updated_by) values ($1, $2, 'staff', $3, $3)`, [studio, ids.staff, ids.owner]);
  const [{ id: ms }] = await q(`insert into public.memberships (business_id, name, unit, units, price_inr, total_count, status, created_by, updated_by) values ($1, 'Dry pass', 'hours', 3, 0, 10, 'live', $2, $2) returning id`, [studio, ids.owner]);
  const [{ id: pass }] = await q(`insert into public.membership_passes (membership_id, business_id, user_id, price_inr, unit, units_total, units_used, status, bought_at, created_by, updated_by) values ($1, $2, $3, 0, 'hours', 3, 0, 'active', now(), $3, $3) returning id`, [ms, studio, ids.stranger]);

  /* 2 · who may, and the refusal while a pass has hours left */
  await as(ids.stranger);
  await refused("a stranger cannot delete the studio", "select public.delete_studio($1)", [studio], /main owner/);
  await as(ids.owner2);
  await refused("a second owner cannot either", "select public.delete_studio($1)", [studio], /main owner/);
  await as(ids.owner);
  await refused("a pass with hours left refuses it, in words", "select public.delete_studio($1)", [studio], /hours left/);

  await asNobody();
  await q(`update public.membership_passes set units_used = 3, status = 'used_up' where id = $1`, [pass]);
  await as(ids.owner);
  const out = await q("select public.delete_studio($1) r", [studio]);
  check(out[0].r.status === "deleted", "the main owner deletes it once nothing depends on it", JSON.stringify(out[0].r));

  await asNobody();
  const b = await q("select deleted_at from public.businesses where id=$1", [studio]);
  check(b[0].deleted_at !== null, "the studio is soft-deleted, the row kept");
  const seats = await q("select count(*)::int n from public.business_members where business_id=$1 and deleted_at is null", [studio]);
  check(seats[0].n === 0, "every team seat is closed", seats[0].n);
  const msd = await q("select deleted_at from public.memberships where id=$1", [ms]);
  check(msd[0].deleted_at !== null, "its membership is off sale");
  const told = await q("select count(*)::int n from public.notifications where user_id = any($1) and title = 'Dry Del Studio was deleted'", [[ids.owner2, ids.staff]]);
  check(told[0].n === 2, "the rest of the team is told", told[0].n);
  const self = await q("select count(*)::int n from public.notifications where user_id = $1 and title = 'Dry Del Studio was deleted'", [ids.owner]);
  check(self[0].n === 0, "the owner who pressed it is not told", self[0].n);
  await as(ids.owner);
  await refused("deleting it twice says it is gone", "select public.delete_studio($1)", [studio], /not here/);

  /* 3 · a crew */
  await asNobody();
  const [{ id: crew }] = await q(`insert into public.crews (name, city, style, leader_id, created_by, updated_by) values ('Dry Del Crew', 'Pune', 'Hip-Hop', $1, $1, $1) returning id`, [ids.leader]);
  await q(`insert into public.crew_members (crew_id, user_id, role, status, created_by, updated_by) values ($1, $2, 'leader', 'confirmed', $2, $2)`, [crew, ids.leader]);
  await q(`insert into public.crew_members (crew_id, user_id, role, status, created_by, updated_by) values ($1, $2, 'member', 'confirmed', $3, $3)`, [crew, ids.member, ids.leader]);
  const [{ id: prac }] = await q(`insert into public.crew_practices (crew_id, starts_at, ends_at, place, status, created_by, updated_by) values ($1, now() + interval '2 days', now() + interval '2 days 2 hours', 'Hall', 'scheduled', $2, $2) returning id`, [crew, ids.leader]);

  await as(ids.member);
  await refused("a member cannot delete the crew", "select public.delete_crew($1)", [crew], /leader/);
  await as(ids.leader);
  const co = await q("select public.delete_crew($1) r", [crew]);
  check(co[0].r.status === "deleted", "the leader deletes it", JSON.stringify(co[0].r));
  await asNobody();
  check((await q("select deleted_at from public.crews where id=$1", [crew]))[0].deleted_at !== null, "the crew is soft-deleted");
  check((await q("select count(*)::int n from public.crew_members where crew_id=$1 and deleted_at is null", [crew]))[0].n === 0, "every roster seat is closed");
  check((await q("select status from public.crew_practices where id=$1", [prac]))[0].status === "cancelled", "the practice still to come is called off");
  const crewTold = await q("select count(*)::int n from public.notifications where user_id = $1 and title = 'Dry Del Crew was deleted'", [ids.member]);
  check(crewTold[0].n === 1, "the member is told", crewTold[0].n);
};
