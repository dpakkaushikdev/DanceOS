// Checks for 20261031090000_rent_as_a_lump_sum_and_disputes, run inside the dry
// run's rolled-back transaction by scripts/dry-run-migration.js. Every refusal
// and every write is made AS the real person (role authenticated + their sub).
module.exports = async (c, { check }) => {
  const q = async (sql, args = []) => (await c.query(sql, args)).rows;
  const as = async (uid) => {
    await q("reset role");
    await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role: "authenticated" })]);
    await q("set local role authenticated");
  };
  const asSuper = async () => {
    await q("reset role");
    await q(`select set_config('request.jwt.claims', '{}', true)`);
  };
  let n = 0;
  const refused = async (label, uid, sql, args, match) => {
    const sp = `r${n++}`;
    await q(`savepoint ${sp}`);
    try {
      await as(uid);
      await q(sql, args);
      await asSuper();
      await q(`release savepoint ${sp}`);
      check(false, label, "was not refused");
    } catch (e) {
      await q(`rollback to savepoint ${sp}`);
      await asSuper();
      check(match.test(e.message), label, e.message);
    }
  };
  await asSuper();

  /* the world: an artist's page that has held an accepted class in a studio */
  const [pair] = await q(`
    select c.business_id payer, c.venue_business_id venue,
           (select m.user_id from public.business_members m where m.business_id = c.business_id and m.member_role = 'owner' and m.deleted_at is null limit 1) payer_owner,
           (select m.user_id from public.business_members m where m.business_id = c.venue_business_id and m.member_role = 'owner' and m.deleted_at is null limit 1) venue_owner
      from public.classes c
     where c.venue_status = 'accepted' and c.venue_business_id is not null and c.deleted_at is null
     limit 1`);
  check(Boolean(pair && pair.payer_owner && pair.venue_owner), "a payer and a venue with owners exist", JSON.stringify(pair));
  const [stranger] = await q(`select p.id from public.profiles p where p.deleted_at is null
     and not exists (select 1 from public.business_members m where m.user_id = p.id and m.business_id in ($1, $2) and m.deleted_at is null) limit 1`, [pair.payer, pair.venue]);

  /* 1 · rent as a lump sum */
  await as(pair.payer_owner);
  const [rent] = await q(`select * from public.record_rent_amount($1, $2, 4500, 'upi', 'done', null, null, 'October')`, [pair.payer, pair.venue]);
  await asSuper();
  check(rent && rent.amount_inr === 4500, "the payer's owner records ₹4,500 rent as a lump sum", rent?.amount_inr);
  const lines = await q(`select count(*)::int n from public.rent_lines where rent_payment_id = $1`, [rent.id]);
  check(lines[0].n === 0, "a lump sum carries no lines", lines[0].n);
  await refused("the venue's owner cannot record the payer's rent", pair.venue_owner,
    `select public.record_rent_amount($1, $2, 100)`, [pair.payer, pair.venue], /only the owner pays rent/);
  await refused("₹0 is refused", pair.payer_owner,
    `select public.record_rent_amount($1, $2, 0)`, [pair.payer, pair.venue], /type what you are paying/);
  await refused("your own studio is refused", pair.payer_owner,
    `select public.record_rent_amount($1, $1, 100)`, [pair.payer], /your own studio/);
  const [other] = await q(`select b.id from public.businesses b where b.type = 'studio' and b.deleted_at is null and b.id <> $2
     and not exists (select 1 from public.classes c where c.business_id = $1 and c.venue_business_id = b.id and c.venue_status = 'accepted' and c.deleted_at is null) limit 1`, [pair.payer, pair.venue]);
  await refused("a studio that never held your class is refused", pair.payer_owner,
    `select public.record_rent_amount($1, $2, 100)`, [pair.payer, other.id], /not held a class in this studio/);

  /* 2 · a rent dispute on the lump sum, raised by the venue */
  await as(pair.venue_owner);
  const [{ raise_payment_dispute: d1 }] = await q(`select public.raise_payment_dispute('rent_payment', $1, 'Only half arrived', 2250)`, [rent.id]);
  await asSuper();
  const [row1] = await q(`select * from public.payment_disputes where id = $1`, [d1]);
  check(row1.status === "open" && row1.amount_inr === 4500 && row1.claimed_inr === 2250 && row1.payer_business_id === pair.payer,
    "the venue disputes the lump sum, the paid amount snapshotted", JSON.stringify({ s: row1.status, a: row1.amount_inr, c: row1.claimed_inr }));
  await refused("a second open dispute on the same entry is refused", pair.venue_owner,
    `select public.raise_payment_dispute('rent_payment', $1, 'again please')`, [rent.id], /already disputed/);
  await refused("the payer cannot dispute its own rent", pair.payer_owner,
    `select public.raise_payment_dispute('rent_payment', $1, 'not me')`, [rent.id], /only the studio paid/);
  await refused("a two-letter reason is refused", pair.venue_owner,
    `select public.raise_payment_dispute('rent_payment', $1, 'no')`, [rent.id], /say what is wrong/);
  const notified = await q(`select count(*)::int n from public.notifications where title = 'A payment is disputed' and user_id = $1`, [pair.payer_owner]);
  check(notified[0].n >= 1, "the payer's owner is told", notified[0].n);

  /* reads: the two ends, nobody else */
  await as(pair.venue_owner);
  const vr = await q(`select id from public.payment_disputes where id = $1`, [d1]);
  await as(pair.payer_owner);
  const pr = await q(`select id from public.payment_disputes where id = $1`, [d1]);
  await as(stranger.id);
  const sr = await q(`select id from public.payment_disputes where id = $1`, [d1]);
  await asSuper();
  check(vr.length === 1 && pr.length === 1 && sr.length === 0, "raiser and payer read it, a stranger does not", `${vr.length}/${pr.length}/${sr.length}`);
  await refused("no direct insert", pair.venue_owner,
    `insert into public.payment_disputes (kind, target_id, rent_payment_id, payer_business_id, venue_business_id, amount_inr, reason, raised_by, created_by, updated_by) values ('rent_payment', $1, $1, $2, $3, 1, 'xyz', $4, $4, $4)`,
    [rent.id, pair.payer, pair.venue, pair.venue_owner], /permission denied|row-level/);

  /* answering */
  await refused("the venue cannot answer its own dispute", pair.venue_owner,
    `select public.answer_payment_dispute($1, true, 'fine')`, [d1], /only the payer answers/);
  await as(pair.payer_owner);
  await q(`select public.answer_payment_dispute($1, false, 'Bank shows the full amount')`, [d1]);
  await asSuper();
  const [ans] = await q(`select status, response, answered_by from public.payment_disputes where id = $1`, [d1]);
  check(ans.status === "rejected" && ans.response === "Bank shows the full amount" && ans.answered_by === pair.payer_owner, "the payer rejects it with words", JSON.stringify(ans));
  await refused("an answered dispute cannot be answered again", pair.payer_owner,
    `select public.answer_payment_dispute($1, true)`, [d1], /already answered/);
  const told = await q(`select count(*)::int n from public.notifications where user_id = $1 and title = 'Your dispute was rejected'`, [pair.venue_owner]);
  check(told[0].n >= 1, "the venue is told the answer", told[0].n);
  await as(pair.venue_owner);
  const [{ raise_payment_dispute: d2 }] = await q(`select public.raise_payment_dispute('rent_payment', $1, 'Asking again with proof')`, [rent.id]);
  await q(`select public.withdraw_payment_dispute($1)`, [d2]);
  await asSuper();
  const [wd] = await q(`select status from public.payment_disputes where id = $1`, [d2]);
  check(wd.status === "withdrawn", "once answered it can be raised again, and withdrawn by its raiser", wd.status);

  /* 3 · a team payment entry, raised by the person paid */
  const [ses] = await q(`select s.id sid, s.class_id cid from public.class_sessions s join public.classes c on c.id = s.class_id
     where c.business_id = $1 and s.deleted_at is null limit 1`, [pair.payer]);
  const [payee] = await q(`select p.id from public.profiles p where p.deleted_at is null and p.id not in ($1, $2) limit 1`, [pair.payer_owner, pair.venue_owner]);
  const [po] = await q(`insert into public.payouts (business_id, user_id, amount_inr, created_by, updated_by) values ($1, $2, 900, $3, $3) returning id`, [pair.payer, payee.id, pair.payer_owner]);
  const [pl] = await q(`insert into public.payout_lines (payout_id, business_id, user_id, session_id, class_id, kind, rate_inr, created_by, updated_by)
     values ($1, $2, $3, $4, $5, 'artist', 900, $6, $6) returning id`, [po.id, pair.payer, payee.id, ses.sid, ses.cid, pair.payer_owner]);
  await refused("the whole payment cannot be disputed when it has entries", payee.id,
    `select public.raise_payment_dispute('payout', $1, 'all wrong')`, [po.id], /dispute the entry/);
  await refused("somebody else cannot dispute my pay", stranger.id,
    `select public.raise_payment_dispute('payout_line', $1, 'not mine')`, [pl.id], /only the person paid/);
  await as(payee.id);
  const [{ raise_payment_dispute: d3 }] = await q(`select public.raise_payment_dispute('payout_line', $1, 'That class was two hours', 1800)`, [pl.id]);
  await asSuper();
  const [r3] = await q(`select amount_inr, claimed_inr, payout_id, rent_payment_id from public.payment_disputes where id = $1`, [d3]);
  check(r3.amount_inr === 900 && r3.claimed_inr === 1800 && r3.payout_id === po.id && r3.rent_payment_id === null, "the payee disputes one entry at ₹900 → ₹1,800", JSON.stringify(r3));
  await as(pair.payer_owner);
  await q(`select public.answer_payment_dispute($1, true, 'Paying the rest')`, [d3]);
  await asSuper();
  const [r3b] = await q(`select status from public.payment_disputes where id = $1`, [d3]);
  check(r3b.status === "accepted", "the payer accepts it", r3b.status);

  /* 4 · nothing else moved */
  const [{ a }] = await q("select count(*)::int a from pg_proc where pronamespace='public'::regnamespace and has_function_privilege('anon', oid, 'execute')");
  check(a === 40, "anon's executable set unchanged (40)", a);
  const fns = await q(`select p.proname from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('record_rent_amount','raise_payment_dispute','answer_payment_dispute','withdraw_payment_dispute') and has_function_privilege('anon', p.oid, 'execute')`);
  check(fns.length === 0, "none of the four new doors is anon's", fns.map((f) => f.proname).join(","));
  const g = await q(`select privilege_type from information_schema.role_table_grants where table_name = 'payment_disputes' and grantee in ('anon','authenticated') order by 1`);
  check(JSON.stringify(g.map((x) => x.privilege_type)) === JSON.stringify(["SELECT"]), "authenticated reads, nobody writes, anon nothing", JSON.stringify(g));
  const [{ pol }] = await q("select count(*)::int pol from pg_policies where schemaname = 'public' and tablename = 'payment_disputes'");
  check(pol === 1, "one policy on the new table", pol);
};
