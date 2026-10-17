// Checks for 20261023090000_memberships_are_told, run inside the dry run's
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
  const notes = async (user, title) =>
    (await q("select kind, href, body from public.notifications where user_id=$1 and title=$2 and deleted_at is null", [user, title]));

  /* 0 · nothing else moved */
  await asNobody();
  const anon = await q("select count(*)::int n from pg_proc p where pronamespace='public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')");
  check(anon[0].n === 40, "anon executable set still 40", anon[0].n);
  const pol = await q("select count(*)::int n from pg_policies where schemaname='public'");
  check(pol[0].n === 107, "public policies still 107", pol[0].n);
  for (const f of ["notify_membership_pass", "notify_membership_use"]) {
    const acl = await q("select has_function_privilege('anon', oid, 'execute') a, has_function_privilege('authenticated', oid, 'execute') u from pg_proc where proname=$1 and pronamespace='public'::regnamespace", [f]);
    check(acl.length === 1 && !acl[0].u && !acl[0].a, `${f}: executable by no client role`, JSON.stringify(acl));
  }
  const g = await q(`select public.notification_group('membership', null) a, public.notification_group('class', '/memberships') b,
                            public.notification_group('booking', '/business/x/memberships/y') c, public.notification_group('money', '/memberships') d,
                            public.notification_group('class', '/c/abc') e`);
  check(g[0].a === "membership" && g[0].b === "membership" && g[0].c === "membership", "membership kind and links file under membership", JSON.stringify(g[0]));
  check(g[0].d === "money" && g[0].e === "class", "money stays money, a class stays a class", JSON.stringify(g[0]));

  /* 1 · people, a studio, a membership */
  const ids = {};
  for (const n of ["owner", "buyer", "other"]) {
    const id = await uuid();
    ids[n] = id;
    await q(`insert into auth.users (id, email, instance_id, aud, role, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
             values ($1, $2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), '{}', '{}', now(), now())`,
      [id, `dry.mem.${n}.${id.slice(0, 6)}@example.com`]);
    await q(`insert into public.profiles (id, full_name, role, city, created_by, updated_by) values ($1, $2, 'user', 'Pune', $1, $1)`, [id, `Dry ${n}`]);
  }
  const [{ id: studio }] = await q(`insert into public.businesses (name, type, city, visibility, created_by, updated_by) values ('Dry Mem Studio', 'studio', 'Pune', 'unlisted', $1, $1) returning id`, [ids.owner]);
  await q(`insert into public.business_members (business_id, user_id, member_role, created_by, updated_by) values ($1, $2, 'owner', $2, $2)`, [studio, ids.owner]);
  const [{ id: ms }] = await q(`insert into public.memberships (business_id, name, unit, units, price_inr, total_count, status, validity_days, created_by, updated_by) values ($1, 'Dry Ten', 'hours', 3, 0, 10, 'live', 30, $2, $2) returning id`, [studio, ids.owner]);

  /* 2 · a pass bought free (born active) */
  const [{ id: pass }] = await q(`insert into public.membership_passes (membership_id, business_id, user_id, price_inr, unit, units_total, units_used, status, bought_at, validity_days, created_by, updated_by) values ($1, $2, $3, 0, 'hours', 3, 0, 'active', now(), 30, $3, $3) returning id`, [ms, studio, ids.buyer]);
  const ready = await notes(ids.buyer, "Your membership is ready");
  check(ready.length === 1 && ready[0].kind === "membership" && ready[0].href === "/memberships", "the buyer is told it is ready", JSON.stringify(ready));
  check(ready.length === 1 && /Dry Ten/.test(ready[0].body), "…naming the membership", ready[0] && ready[0].body);
  const took = await notes(ids.owner, "Dry buyer took Dry Ten");
  check(took.length === 1 && took[0].kind === "membership" && took[0].href === `/business/${studio}/memberships/${ms}`, "the studio's owner is told who took it", JSON.stringify(took));
  const otherNotes = await q("select count(*)::int n from public.notifications where user_id=$1", [ids.other]);
  check(otherNotes[0].n === 0, "a bystander is told nothing", otherNotes[0].n);

  /* 3 · a priced pass waits, then the capture makes it active — told once */
  const [{ id: pass2 }] = await q(`insert into public.membership_passes (membership_id, business_id, user_id, price_inr, unit, units_total, units_used, status, bought_at, created_by, updated_by) values ($1, $2, $3, 500, 'hours', 3, 0, 'pending_payment', now(), $3, $3) returning id`, [ms, studio, ids.other]);
  const early = await notes(ids.other, "Your membership is ready");
  check(early.length === 0, "an unpaid pass tells nobody", early.length);
  await q("update public.membership_passes set status='active' where id=$1", [pass2]);
  const late = await notes(ids.other, "Your membership is ready");
  check(late.length === 1, "the capture tells the buyer", late.length);
  await q("update public.membership_passes set updated_at = now() where id=$1", [pass2]);
  await q("update public.membership_passes set status='active' where id=$1", [pass2]);
  const again = await notes(ids.other, "Your membership is ready");
  check(again.length === 1, "re-saving the same status tells nobody again", again.length);

  /* 4 · a use, against a real booking row (rolled back) */
  const bk = await q("select id, class_id, session_id from public.class_bookings limit 1");
  if (bk.length) {
    await q(`insert into public.membership_uses (pass_id, membership_id, class_booking_id, class_id, session_id, user_id, units, created_by, updated_by) values ($1, $2, $3, $4, $5, $6, 1, $6, $6)`,
      [pass, ms, bk[0].id, bk[0].class_id, bk[0].session_id, ids.buyer]);
    const used = await notes(ids.buyer, "Membership used on a class");
    check(used.length === 1 && /2 hours left/.test(used[0].body), "the holder is told what is left (counted with this use)", JSON.stringify(used));
  } else {
    check(true, "(no booking row to plant a use against — skipped)");
  }

  /* 5 · used up, and returned */
  await q("update public.membership_passes set units_used=3, status='used_up' where id=$1", [pass]);
  const up = await notes(ids.buyer, "Your membership is used up");
  check(up.length === 1 && up[0].kind === "membership", "the holder is told it is used up", JSON.stringify(up));
  await q("update public.membership_passes set status='cancelled' where id=$1", [pass2]);
  const ret = await notes(ids.owner, "Dry other returned Dry Ten");
  check(ret.length === 1, "the owner is told of a return", ret.length);

  /* 6 · the prefs door takes the new key and still refuses an invented one */
  await as(ids.buyer);
  const p = await q(`select public.set_notification_prefs('{"membership": false}'::jsonb, null, null, null, '{"membership": true}'::jsonb) r`);
  check(p.length === 1, "set_notification_prefs accepts membership");
  await refused("an invented group is still refused", `select public.set_notification_prefs('{"wizard": true}'::jsonb, null, null, null, null)`, [], /unknown notification group/);
  await asNobody();
  const ck = await q("select pg_get_constraintdef(oid) d from pg_constraint where conname='notifications_kind_check'");
  check(/membership/.test(ck[0].d) && /event/.test(ck[0].d), "the kind CHECK admits membership and keeps event", ck[0].d);
};
