// Checks for 20261024090000_an_enquiry_has_a_team_and_practices, run inside the
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

  /* 0 · the shape */
  await asNobody();
  const fns = ["is_on_enquiry", "add_enquiry_person", "remove_enquiry_person", "save_enquiry_practice", "cancel_enquiry_practice", "check_in_enquiry_practice", "undo_enquiry_practice_check_in"];
  for (const f of fns) {
    const acl = await q("select has_function_privilege('anon', oid, 'execute') a, has_function_privilege('authenticated', oid, 'execute') u, prosecdef d from pg_proc where proname=$1 and pronamespace='public'::regnamespace", [f]);
    check(acl.length === 1 && acl[0].u && !acl[0].a && acl[0].d, `${f}: one definer, authenticated only`, JSON.stringify(acl));
  }
  for (const t of ["enquiry_people", "enquiry_practices", "enquiry_practice_attendance"]) {
    const r = await q("select relrowsecurity r from pg_class where oid=$1::regclass", [`public.${t}`]);
    check(r[0].r === true, `${t}: RLS on`, r[0].r);
    const pols = await q("select cmd from pg_policies where schemaname='public' and tablename=$1", [t]);
    check(pols.length >= 1 && pols.every((p) => p.cmd === "SELECT"), `${t}: select policies only`, JSON.stringify(pols));
    const g = await q(`select has_table_privilege('anon', $1, 'select') a, has_table_privilege('authenticated', $1, 'insert') i, has_table_privilege('authenticated', $1, 'select') s`, [`public.${t}`]);
    check(!g[0].a && !g[0].i && g[0].s, `${t}: anon nothing, authenticated select only`, JSON.stringify(g[0]));
    const fk = await q(`select count(*)::int n from pg_constraint where conrelid=$1::regclass and contype='f' and confrelid='auth.users'::regclass`, [`public.${t}`]);
    check(fk[0].n === 0, `${t}: no FK into auth.users`, fk[0].n);
  }

  /* 1 · a studio with an owner and a staff seat, a sender, a stranger, an outsider */
  const ids = {};
  for (const n of ["owner", "staff", "sender", "dancer", "stranger"]) {
    const id = await uuid();
    ids[n] = id;
    await q(`insert into auth.users (id, email, instance_id, aud, role, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
             values ($1, $2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), '{}', '{}', now(), now())`,
      [id, `dry.enqteam.${n}.${id.slice(0, 6)}@example.com`]);
    await q(`insert into public.profiles (id, full_name, role, city, created_by, updated_by) values ($1, $2, 'user', 'Pune', $1, $1)`, [id, `Dry ${n}`]);
  }
  const [{ id: biz }] = await q(`insert into public.businesses (name, type, city, visibility, created_by, updated_by) values ('Dry Enq Studio', 'studio', 'Pune', 'unlisted', $1, $1) returning id`, [ids.owner]);
  await q(`insert into public.business_members (business_id, user_id, member_role, created_by, updated_by) values ($1, $2, 'owner', $2, $2)`, [biz, ids.owner]);
  await q(`insert into public.business_members (business_id, user_id, member_role, created_by, updated_by) values ($1, $2, 'staff', $3, $3)`, [biz, ids.staff, ids.owner]);
  const [{ id: enq }] = await q(`insert into public.enquiries (business_id, from_user_id, type_key, message, status, created_by, updated_by) values ($1, $2, 'choreographer', 'Dry run', 'accepted', $2, $2) returning id`, [biz, ids.sender]);

  /* 2 · people */
  await as(ids.staff);
  await refused("a staff seat cannot put people on it", "select public.add_enquiry_person($1, $2, 'team', null)", [enq, ids.staff], /owners and managers/);
  await as(ids.owner);
  await refused("a stranger is not TEAM", "select public.add_enquiry_person($1, $2, 'team', null)", [enq, ids.dancer], /only somebody on your team/);
  await refused("the sender is not on the job", "select public.add_enquiry_person($1, $2, 'participant', null)", [enq, ids.sender], /sent the enquiry/);
  await refused("a made-up kind is refused", "select public.add_enquiry_person($1, $2, 'boss', null)", [enq, ids.dancer], /team or a participant/);
  const [team] = await q("select * from public.add_enquiry_person($1, $2, 'team', 'Lead choreographer')", [enq, ids.staff]);
  check(team && team.kind === "team" && team.role === "Lead choreographer", "the owner adds the staff seat as team, with a role", JSON.stringify(team));
  const [part] = await q("select * from public.add_enquiry_person($1, $2, 'participant', 'Dancer')", [enq, ids.dancer]);
  check(part && part.kind === "participant", "the owner adds anybody on DanceOS as a participant", part && part.kind);
  const [again] = await q("select * from public.add_enquiry_person($1, $2, 'participant', 'Lead dancer')", [enq, ids.dancer]);
  check(again.id === part.id && again.role === "Lead dancer", "adding again moves the role, never a second row", JSON.stringify(again));
  await asNobody();
  const told = await q("select href from public.notifications where user_id=$1 and title='You are on a job'", [ids.dancer]);
  check(told.length === 1 && told[0].href === null, "the participant is told once, with no door into the enquiry", JSON.stringify(told));
  const toldTeam = await q("select href from public.notifications where user_id=$1 and title='You are on a job'", [ids.staff]);
  check(toldTeam.length === 1 && toldTeam[0].href === `/inbox/enquiries/${enq}`, "a team member is told, with the door", JSON.stringify(toldTeam));

  /* 3 · reads */
  await as(ids.staff);
  const staffRead = await q("select count(*)::int n from public.enquiry_people where enquiry_id=$1", [enq]);
  check(staffRead[0].n === 2, "every member of the business reads the people", staffRead[0].n);
  await as(ids.dancer);
  const ownRead = await q("select count(*)::int n from public.enquiry_people where enquiry_id=$1", [enq]);
  check(ownRead[0].n === 1, "a participant reads only their own row", ownRead[0].n);
  const enqRead = await q("select count(*)::int n from public.enquiries where id=$1", [enq]);
  check(enqRead[0].n === 0, "…and NOT the enquiry itself", enqRead[0].n);
  await as(ids.stranger);
  const strangerRead = await q("select count(*)::int n from public.enquiry_people where enquiry_id=$1", [enq]);
  check(strangerRead[0].n === 0, "a stranger reads nothing", strangerRead[0].n);
  await refused("no direct insert", "insert into public.enquiry_people (enquiry_id, user_id, kind) values ($1, $2, 'participant')", [enq, ids.stranger], /permission denied|row-level security/);

  /* 4 · practices */
  await as(ids.owner);
  await refused("ends before it starts is refused", "select public.save_enquiry_practice($1, now() + interval '2 day', now() + interval '1 day', 'Hall', null, null)", [enq], /ends after it starts/);
  const [pr] = await q("select * from public.save_enquiry_practice($1, now() + interval '1 day', now() + interval '1 day 2 hours', 'Studio A', 'Bring shoes', null)", [enq]);
  check(pr && pr.status === "scheduled" && pr.place === "Studio A", "the owner arranges a practice", JSON.stringify(pr));
  await asNobody();
  const ptold = await q("select count(*)::int n from public.notifications where title='Practice for a job' and user_id = any($1::uuid[])", [[ids.staff, ids.dancer]]);
  check(ptold[0].n === 2, "both people on the job are told", ptold[0].n);
  const otold = await q("select count(*)::int n from public.notifications where title='Practice for a job' and user_id=$1", [ids.owner]);
  check(otold[0].n === 0, "whoever arranged it is not told about their own practice", otold[0].n);
  await as(ids.dancer);
  const dRead = await q("select count(*)::int n from public.enquiry_practices where enquiry_id=$1", [enq]);
  check(dRead[0].n === 1, "a participant reads the job's practices", dRead[0].n);
  await as(ids.stranger);
  const sRead = await q("select count(*)::int n from public.enquiry_practices where enquiry_id=$1", [enq]);
  check(sRead[0].n === 0, "a stranger reads none", sRead[0].n);

  /* 5 · the register */
  await as(ids.staff);
  await refused("a staff seat cannot run the register", "select public.check_in_enquiry_practice($1, $2)", [pr.id, ids.dancer], /run this register/);
  await as(ids.owner);
  await refused("somebody off the job cannot be checked in", "select public.check_in_enquiry_practice($1, $2)", [pr.id, ids.stranger], /not on this enquiry/);
  await q("select public.check_in_enquiry_practice($1, $2)", [pr.id, ids.dancer]);
  await q("select public.check_in_enquiry_practice($1, $2)", [pr.id, ids.dancer]);
  const att = await q("select count(*)::int n from public.enquiry_practice_attendance where practice_id=$1 and deleted_at is null", [pr.id]);
  check(att[0].n === 1, "pressing twice is one attendance", att[0].n);
  await q("select public.undo_enquiry_practice_check_in($1, $2)", [pr.id, ids.dancer]);
  await asNobody();
  const att2 = await q("select count(*)::int live, count(*) filter (where deleted_at is not null)::int gone from public.enquiry_practice_attendance where practice_id=$1", [pr.id]);
  check(att2[0].live === 1 && att2[0].gone === 1, "undo soft-deletes, history kept", JSON.stringify(att2[0]));

  /* 6 · cancel and remove */
  await as(ids.owner);
  await q("select public.cancel_enquiry_practice($1)", [pr.id]);
  await refused("a called-off practice takes no check-in", "select public.check_in_enquiry_practice($1, $2)", [pr.id, ids.dancer], /called off/);
  await asNobody();
  const cancelled = await q("select status, deleted_at from public.enquiry_practices where id=$1", [pr.id]);
  check(cancelled[0].status === "cancelled" && cancelled[0].deleted_at === null, "cancel is a status, never a delete", JSON.stringify(cancelled[0]));
  await as(ids.owner);
  await q("select public.remove_enquiry_person($1)", [part.id]);
  await asNobody();
  const removed = await q("select deleted_at from public.enquiry_people where id=$1", [part.id]);
  check(removed[0].deleted_at !== null, "removing soft-deletes the row", removed[0].deleted_at);

  /* 7 · a closed enquiry takes nobody */
  await q("update public.enquiries set status='completed' where id=$1", [enq]);
  await as(ids.owner);
  await refused("a closed enquiry takes no new person", "select public.add_enquiry_person($1, $2, 'participant', null)", [enq, ids.dancer], /closed/);
  await asNobody();
};
