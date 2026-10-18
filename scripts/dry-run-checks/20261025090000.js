// Checks for 20261025090000_a_job_is_asked_files_and_my_practices, run inside
// the dry run's rolled-back transaction by scripts/dry-run-migration.js.
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
  const left = await q("select count(*)::int n from public.enquiry_people where status = 'assigned'");
  check(left[0].n === 0, "no row is left 'assigned'", left[0].n);
  for (const f of ["respond_to_enquiry_job", "my_enquiry_jobs", "my_enquiry_practices", "is_enquiry_end", "add_enquiry_file", "remove_enquiry_file", "add_enquiry_person", "save_enquiry_practice", "check_in_enquiry_practice", "is_on_enquiry"]) {
    const acl = await q("select has_function_privilege('anon', oid, 'execute') a, has_function_privilege('authenticated', oid, 'execute') u, prosecdef d from pg_proc where proname=$1 and pronamespace='public'::regnamespace", [f]);
    check(acl.length === 1 && acl[0].u && !acl[0].a && acl[0].d, `${f}: one definer, authenticated only`, JSON.stringify(acl));
  }
  const g = await q(`select has_table_privilege('anon','public.enquiry_files','select') a, has_table_privilege('authenticated','public.enquiry_files','insert') i, has_table_privilege('authenticated','public.enquiry_files','select') s, (select relrowsecurity from pg_class where oid='public.enquiry_files'::regclass) r`);
  check(!g[0].a && !g[0].i && g[0].s && g[0].r, "enquiry_files: RLS on, anon nothing, select only", JSON.stringify(g[0]));
  const fk = await q(`select count(*)::int n from pg_constraint where conrelid='public.enquiry_files'::regclass and contype='f' and confrelid='auth.users'::regclass`);
  check(fk[0].n === 0, "enquiry_files: no FK into auth.users", fk[0].n);

  /* 1 · a world */
  const ids = {};
  for (const n of ["owner", "staff", "sender", "dancer", "stranger"]) {
    const id = await uuid();
    ids[n] = id;
    await q(`insert into auth.users (id, email, instance_id, aud, role, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
             values ($1, $2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), '{}', '{}', now(), now())`,
      [id, `dry.job.${n}.${id.slice(0, 6)}@example.com`]);
    await q(`insert into public.profiles (id, full_name, role, city, created_by, updated_by) values ($1, $2, 'user', 'Pune', $1, $1)`, [id, `Dry ${n}`]);
  }
  const [{ id: biz }] = await q(`insert into public.businesses (name, type, city, visibility, created_by, updated_by) values ('Dry Job Studio', 'studio', 'Pune', 'unlisted', $1, $1) returning id`, [ids.owner]);
  await q(`insert into public.business_members (business_id, user_id, member_role, created_by, updated_by) values ($1, $2, 'owner', $2, $2)`, [biz, ids.owner]);
  await q(`insert into public.business_members (business_id, user_id, member_role, created_by, updated_by) values ($1, $2, 'staff', $3, $3)`, [biz, ids.staff, ids.owner]);
  const [{ id: enq }] = await q(`insert into public.enquiries (business_id, from_user_id, type_key, message, status, created_by, updated_by) values ($1, $2, 'choreographer', 'Dry run', 'accepted', $2, $2) returning id`, [biz, ids.sender]);

  /* 2 · asked, then answered */
  await as(ids.owner);
  const [dancer] = await q("select * from public.add_enquiry_person($1, $2, 'participant', 'Lead')", [enq, ids.dancer]);
  check(dancer.status === "asked", "a new person is ASKED", dancer.status);
  const [self] = await q("select * from public.add_enquiry_person($1, $2, 'team', null)", [enq, ids.owner]);
  check(self.status === "confirmed", "adding yourself is confirmed at once", self.status);
  const n1 = await q("select href from public.notifications where user_id=$1 and title='You are asked onto a job'", [ids.dancer]);
  await asNobody();
  const n1b = await q("select href from public.notifications where user_id=$1 and title='You are asked onto a job'", [ids.dancer]);
  check(n1b.length === 1 && n1b[0].href === "/inbox?show=jobs", "the person asked is told, pointed at Enquiries", JSON.stringify(n1b) + JSON.stringify(n1));

  await as(ids.dancer);
  const jobs = await q("select * from public.my_enquiry_jobs()");
  check(jobs.length === 1 && jobs[0].status === "asked" && jobs[0].host_name === "Dry Job Studio" && jobs[0].role === "Lead", "my_enquiry_jobs names who asked", JSON.stringify(jobs));
  const readEnq = await q("select id from public.enquiries where id=$1", [enq]);
  check(readEnq.length === 0, "the person asked still cannot read the enquiry itself", readEnq.length);
  await as(ids.stranger);
  await refused("a stranger cannot answer somebody's ask", "select public.respond_to_enquiry_job($1, true)", [dancer.id], /not yours/);

  /* 3 · practices before and after a yes */
  await as(ids.owner);
  const [pr] = await q("select * from public.save_enquiry_practice($1, now() + interval '1 day', now() + interval '1 day 2 hours', 'Hall A', null, null)", [enq]);
  await asNobody();
  const told0 = await q("select count(*)::int n from public.notifications where user_id=$1 and title='Practice for a job'", [ids.dancer]);
  check(told0[0].n === 0, "an ASKED person is not told about a practice", told0[0].n);
  await as(ids.dancer);
  const seen0 = await q("select id from public.enquiry_practices where id=$1", [pr.id]);
  check(seen0.length === 0, "an ASKED person cannot read the practice", seen0.length);
  await as(ids.owner);
  await refused("an ASKED person cannot be checked in", "select public.check_in_enquiry_practice($1, $2)", [pr.id, ids.dancer], /not said yes/);

  await as(ids.dancer);
  const [yes] = await q("select * from public.respond_to_enquiry_job($1, true)", [dancer.id]);
  check(yes.status === "confirmed", "the person says yes → confirmed", yes.status);
  await refused("an answered ask cannot be answered twice", "select public.respond_to_enquiry_job($1, false)", [dancer.id], /already answered/);
  await asNobody();
  const toldOwner = await q("select count(*)::int n from public.notifications where user_id=$1 and title like '%is on the job'", [ids.owner]);
  check(toldOwner[0].n === 1, "the owner is told the yes", toldOwner[0].n);
  await as(ids.dancer);
  const seen1 = await q("select id from public.enquiry_practices where id=$1", [pr.id]);
  check(seen1.length === 1, "a CONFIRMED person reads the practice", seen1.length);
  const mine = await q("select * from public.my_enquiry_practices(now() - interval '1 day', now() + interval '30 days')");
  check(mine.length === 1 && mine[0].my_part === "participant" && mine[0].people === 2 && mine[0].host_name === "Dry Job Studio", "my_enquiry_practices lists it for the participant", JSON.stringify(mine));
  await as(ids.owner);
  const mineO = await q("select * from public.my_enquiry_practices(now() - interval '1 day', now() + interval '30 days')");
  check(mineO.length === 1 && mineO[0].my_part === "runs", "…and for the owner as the one who runs it", JSON.stringify(mineO));
  await q("select public.check_in_enquiry_practice($1, $2)", [pr.id, ids.dancer]);
  const mineO2 = await q("select checked_in from public.my_enquiry_practices(now() - interval '1 day', now() + interval '30 days')");
  check(mineO2[0].checked_in === 1, "a confirmed person checks in and the count follows", mineO2[0].checked_in);
  await as(ids.stranger);
  const mineS = await q("select * from public.my_enquiry_practices(now() - interval '1 day', now() + interval '30 days')");
  check(mineS.length === 0, "a stranger's list is empty", mineS.length);

  /* 4 · a no */
  await as(ids.owner);
  const [staffAsk] = await q("select * from public.add_enquiry_person($1, $2, 'team', 'Assistant')", [enq, ids.staff]);
  await as(ids.staff);
  const [no] = await q("select * from public.respond_to_enquiry_job($1, false)", [staffAsk.id]);
  check(no.status === "declined" && no.deleted_at !== null, "a no closes the row and keeps the answer", JSON.stringify({ s: no.status, d: no.deleted_at }));
  const jobsS = await q("select * from public.my_enquiry_jobs()");
  check(jobsS.length === 0, "a declined ask leaves my_enquiry_jobs", jobsS.length);
  await as(ids.owner);
  const [again] = await q("select * from public.add_enquiry_person($1, $2, 'team', 'Assistant')", [enq, ids.staff]);
  check(again.status === "asked" && again.id !== staffAsk.id, "asking again after a no is a fresh ask", again.status);

  /* 5 · files */
  await as(ids.sender);
  const [f1] = await q("select * from public.add_enquiry_file($1, 'music', 'Track 1', 'https://example.com/a.mp3')", [enq]);
  check(f1.kind === "music", "the sender adds a link", f1.kind);
  await as(ids.owner);
  const [f2] = await q("select * from public.add_enquiry_file($1, 'video', 'Reference', 'https://youtu.be/x')", [enq]);
  await refused("a link must be http(s)", "select public.add_enquiry_file($1, 'link', 'Bad', 'javascript:alert(1)')", [enq], /web link/);
  await refused("a link needs a name", "select public.add_enquiry_file($1, 'link', '  ', 'https://example.com')", [enq], /name/);
  await refused("an invented kind is refused", "select public.add_enquiry_file($1, 'zip', 'X', 'https://example.com')", [enq], /music, a video/);
  await as(ids.stranger);
  await refused("a stranger cannot add a link", "select public.add_enquiry_file($1, 'link', 'X', 'https://example.com')", [enq], /two ends/);
  const sf = await q("select id from public.enquiry_files where enquiry_id=$1", [enq]);
  check(sf.length === 0, "a stranger reads no file", sf.length);
  await as(ids.dancer);
  const df = await q("select id from public.enquiry_files where enquiry_id=$1", [enq]);
  check(df.length === 0, "a person on the job does not read the enquiry's files", df.length);
  await as(ids.sender);
  const sendf = await q("select id from public.enquiry_files where enquiry_id=$1", [enq]);
  check(sendf.length === 2, "the sender reads both links", sendf.length);
  await refused("the sender cannot take down the business's link", "select public.remove_enquiry_file($1)", [f2.id], /only whoever added/);
  await q("select public.remove_enquiry_file($1)", [f1.id]);
  await as(ids.staff);
  const staffF = await q("select id from public.enquiry_files where enquiry_id=$1", [enq]);
  check(staffF.length === 1, "a member reads the files; a removed one is gone", staffF.length);
  await asNobody();
  const toldS = await q("select count(*)::int n from public.notifications where user_id=$1 and title='A link was added to your enquiry'", [ids.sender]);
  check(toldS[0].n === 1, "the sender is told the business added a link", toldS[0].n);
  await refused("a direct insert is refused", "set local role authenticated; insert into public.enquiry_files (enquiry_id, kind, label, url) values ('" + enq + "', 'link', 'x', 'https://x.y')", [], /permission denied|row-level/);
};
