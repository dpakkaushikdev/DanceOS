// Checks for 20261029090000_pay_is_set_when_paying, run inside the dry run's
// rolled-back transaction by scripts/dry-run-migration.js.
module.exports = async (c, { check }) => {
  const q = async (sql, args = []) => (await c.query(sql, args)).rows;
  const as = async (sub) => {
    await q("reset role");
    await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub, role: "authenticated" })]);
    await q("set local role authenticated");
  };
  const asService = async () => {
    await q("reset role");
    await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: "service_role" })]);
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
  await asService();
  for (const f of ["record_session_payment", "record_rent_payment", "void_rent_payment"]) {
    const acl = await q(
      "select has_function_privilege('anon', oid, 'execute') a, has_function_privilege('authenticated', oid, 'execute') u, prosecdef d from pg_proc where proname=$1 and pronamespace='public'::regnamespace",
      [f]
    );
    check(acl.length === 1 && acl[0].u && !acl[0].a && acl[0].d, `${f}: one definer, authenticated only`, JSON.stringify(acl));
  }
  const anon = await q("select count(*)::int n from pg_proc where pronamespace='public'::regnamespace and has_function_privilege('anon', oid, 'execute')");
  check(anon[0].n === 40, "anon's executable set unchanged (40)", anon[0].n);
  for (const t of ["rent_payments", "rent_lines", "payout_enquiry_lines"]) {
    const g = await q("select has_table_privilege('anon', $1, 'select') a, has_table_privilege('authenticated', $1, 'insert') i", [`public.${t}`]);
    check(!g[0].a && !g[0].i, `${t}: no anon read, no client insert`, JSON.stringify(g[0]));
  }

  /* 1 · a world */
  const ids = {};
  for (const n of ["owner", "teacher", "teamer", "participant", "stranger", "artist"]) {
    const id = await uuid();
    ids[n] = id;
    await q(
      `insert into auth.users (id, email, instance_id, aud, role, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values ($1, $2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '', now(), '{}', '{}', now(), now())`,
      [id, `dry.pay.${n}.${id.slice(0, 6)}@example.com`]
    );
    await q(`insert into public.profiles (id, full_name, role, city, created_by, updated_by) values ($1, $2, 'user', 'Pune', $1, $1)`, [id, `Dry ${n}`]);
  }
  const biz = async (name, type, owner) => {
    const [{ id }] = await q(
      `insert into public.businesses (name, type, city, visibility, created_by, updated_by) values ($1, $2, 'Pune', 'unlisted', $3, $3) returning id`,
      [name, type, owner]
    );
    await q(`insert into public.business_members (business_id, user_id, member_role, created_by, updated_by) values ($1, $2, 'owner', $2, $2)`, [id, owner]);
    return id;
  };
  const studio = await biz("Dry Pay Studio", "studio", ids.owner);
  const page = await biz("Dry Pay Artist", "artist_page", ids.artist);

  /* planting only: the class guards (a live Artist plan, no past start) are not
     what is under test, so they are off for these inserts and back on after */
  await q("set local session_replication_role = replica");
  const klass = async (business, venue) => {
    const [{ id }] = await q(
      `insert into public.classes (business_id, title, style, level, price_inr, capacity, status, venue_business_id, venue_status, share_slug, created_by, updated_by)
       values ($1, 'Hip-Hop · Beginner', 'Hip-Hop', 'beginner', 0, 10, 'draft', $2, $3, 'dry-pay-' || substr(md5(random()::text), 1, 8), $4, $4) returning id`,
      [business, venue, venue ? "accepted" : null, ids.owner]
    );
    return id;
  };
  const session = async (cls, dayOffset) => {
    const s = new Date(Date.now() + dayOffset * 86400000).toISOString();
    const e = new Date(Date.now() + dayOffset * 86400000 + 3600000).toISOString();
    const [{ id }] = await q(
      `insert into public.class_sessions (class_id, business_id, starts_at, ends_at, created_by, updated_by) values ($1, (select business_id from public.classes where id=$1), $2, $3, $4, $4) returning id`,
      [cls, s, e, ids.owner]
    );
    return id;
  };
  const cls = await klass(studio, null);
  const past1 = await session(cls, -3);
  const ahead = await session(cls, 3);
  await q(
    `insert into public.class_people (class_id, business_id, user_id, kind, status, created_by, updated_by) values ($1, $2, $3, 'artist', 'confirmed', $4, $4)`,
    [cls, studio, ids.teacher, ids.owner]
  );
  const [{ id: enq }] = await q(
    `insert into public.enquiries (business_id, from_user_id, type_key, message, status, created_by, updated_by) values ($1, $2, 'choreographer', 'Dry run', 'accepted', $2, $2) returning id`,
    [studio, ids.stranger]
  );
  await q(`insert into public.enquiry_people (enquiry_id, user_id, kind, status, created_by) values ($1, $2, 'team', 'confirmed', $3)`, [enq, ids.teamer, ids.owner]);
  await q(`insert into public.enquiry_people (enquiry_id, user_id, kind, status, created_by) values ($1, $2, 'participant', 'confirmed', $3)`, [enq, ids.participant, ids.owner]);

  const rentCls = await klass(page, studio);
  const rentPast = await session(rentCls, -2);
  const rentAhead = await session(rentCls, 5);
  await q("set local session_replication_role = origin");

  const pay = "select (public.record_session_payment($1, $2, $3::jsonb, 'upi', 'done', 'UTR123', null, null)).id";

  /* 2 · team pay, a class */
  await as(ids.teacher);
  await refused("only the owner pays the team", pay, [studio, ids.teacher, JSON.stringify([{ session_id: past1, rate_inr: 500 }])], /only the owner/);
  await as(ids.owner);
  await refused("a class still to run cannot be paid", pay, [studio, ids.teacher, JSON.stringify([{ session_id: ahead, rate_inr: 500 }])], /not happened yet/);
  await refused("somebody not on the class cannot be paid for it", pay, [studio, ids.stranger, JSON.stringify([{ session_id: past1, rate_inr: 500 }])], /never confirmed/);
  const [{ id: p1 }] = await q(pay, [studio, ids.teacher, JSON.stringify([{ session_id: past1, rate_inr: 750 }])]);
  const lines = await q("select rate_inr from public.payout_lines where payout_id=$1", [p1]);
  check(lines.length === 1 && lines[0].rate_inr === 750, "the rate typed now is the rate paid", JSON.stringify(lines));
  const p1row = await q("select amount_inr, provider_ref, method from public.payouts where id=$1", [p1]);
  check(p1row[0].amount_inr === 750 && p1row[0].provider_ref === "UTR123" && p1row[0].method === "upi", "the payout carries the total, the method and the reference", JSON.stringify(p1row[0]));
  await refused("a class is settled once", pay, [studio, ids.teacher, JSON.stringify([{ session_id: past1, rate_inr: 100 }])], /already settled/);

  /* 3 · team pay, an enquiry */
  await refused("a participant is not paid as team", pay, [studio, ids.participant, JSON.stringify([{ enquiry_id: enq, rate_inr: 2000 }])], /not on that enquiry/);
  await refused("a line naming both a class and an enquiry is refused", pay, [studio, ids.teamer, JSON.stringify([{ enquiry_id: enq, session_id: past1, rate_inr: 1 }])], /class or an enquiry/);
  const [{ id: p2 }] = await q(pay, [studio, ids.teamer, JSON.stringify([{ enquiry_id: enq, rate_inr: 2000 }])]);
  const el = await q("select rate_inr from public.payout_enquiry_lines where payout_id=$1 and deleted_at is null", [p2]);
  check(el.length === 1 && el[0].rate_inr === 2000, "a team member is paid for an enquiry", JSON.stringify(el));
  await refused("an enquiry is settled once per person", pay, [studio, ids.teamer, JSON.stringify([{ enquiry_id: enq, rate_inr: 1 }])], /already settled/);
  await as(ids.teamer);
  const mine = await q("select count(*)::int n from public.payout_enquiry_lines where user_id=$1", [ids.teamer]);
  check(mine[0].n === 1, "the person paid reads their enquiry line", mine[0].n);
  await as(ids.stranger);
  const not = await q("select count(*)::int n from public.payout_enquiry_lines");
  check(not[0].n === 0, "a stranger reads no enquiry line", not[0].n);
  await as(ids.owner);
  await q("select public.void_payout($1)", [p2]);
  const released = await q("select count(*)::int n from public.payout_enquiry_lines where payout_id=$1 and deleted_at is null", [p2]);
  check(released[0].n === 0, "voiding the payout frees its enquiry again", released[0].n);
  await q(pay, [studio, ids.teamer, JSON.stringify([{ enquiry_id: enq, rate_inr: 1500 }])]);
  check(true, "and it can be paid again after the void");

  /* 4 · rent */
  const rent = "select (public.record_rent_payment($1, $2, $3::jsonb, 'bank_transfer', 'done', null, null, null)).id";
  await as(ids.owner);
  await refused("the studio cannot pay the artist's rent", rent, [page, studio, JSON.stringify([{ session_id: rentPast, rate_inr: 400 }])], /only the owner/);
  await as(ids.artist);
  await refused("a class not held at that studio is refused", rent, [page, studio, JSON.stringify([{ session_id: past1, rate_inr: 400 }])], /not held in this studio/);
  const [{ id: r1 }] = await q(rent, [page, studio, JSON.stringify([{ session_id: rentPast, rate_inr: 400 }, { session_id: rentAhead, rate_inr: 400 }])]);
  const rp = await q("select amount_inr from public.rent_payments where id=$1", [r1]);
  check(rp[0].amount_inr === 800, "rent is paid for a past AND an upcoming class", JSON.stringify(rp));
  await refused("a class's rent is paid once", rent, [page, studio, JSON.stringify([{ session_id: rentPast, rate_inr: 1 }])], /already paid/);
  await as(ids.owner);
  const venueSees = await q("select count(*)::int n from public.rent_lines where rent_payment_id=$1", [r1]);
  check(venueSees[0].n === 2, "the studio reads the rent it was paid", venueSees[0].n);
  await as(ids.stranger);
  const strangerRent = await q("select count(*)::int n from public.rent_payments");
  check(strangerRent[0].n === 0, "a stranger reads no rent", strangerRent[0].n);
  await as(ids.owner);
  await refused("only the payer voids rent", "select public.void_rent_payment($1)", [r1], /only the payer/);
  await as(ids.artist);
  await q("select public.void_rent_payment($1)", [r1]);
  await asService();
  const voided = await q("select count(*)::int n from public.rent_lines where rent_payment_id=$1 and deleted_at is null", [r1]);
  check(voided[0].n === 0, "voiding rent frees its classes", voided[0].n);
};
