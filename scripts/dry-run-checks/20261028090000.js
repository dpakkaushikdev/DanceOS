// Checks for 20261028090000_instagram_is_connected, run inside the dry run's transaction:
//   NODE_PATH=<scratchpad>/node_modules node scripts/dry-run-migration.js supabase/migrations/20261028090000_instagram_is_connected.sql scripts/dry-run-checks/20261028090000.js
module.exports = async (client, { check }) => {
  const q = (sql, args) => client.query(sql, args);
  let sp = 0;
  /* an expected refusal must not abort the outer transaction */
  const refused = async (sql, args) => {
    const name = `ig_sp_${++sp}`;
    await q(`savepoint ${name}`);
    try {
      await q(sql, args);
      await q(`release savepoint ${name}`);
      return null;
    } catch (e) {
      await q(`rollback to savepoint ${name}`);
      return e.message;
    }
  };
  const as = async (role, sub) => {
    await q(`set local role ${role}`);
    await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(sub ? { sub, role } : { role })]);
  };
  const reset = async () => {
    await q("reset role");
    await q(`select set_config('request.jwt.claims', '', true)`);
  };

  const people = (await q("select id, socials from public.profiles where deleted_at is null and coalesce(jsonb_array_length(socials),0) < 12 order by created_at limit 2")).rows;
  check(people.length === 2, "two live profiles to test with");
  const [a, b] = people;

  // 1. the service role connects A
  await as("service_role");
  const row = (await q("select * from public.connect_instagram($1, '17841400000000001', 'rhea.moves', 'MEDIA_CREATOR')", [a.id])).rows[0];
  check(row && row.username === "rhea.moves" && row.created_by === a.id, "connect_instagram inserts the row, stamped with the person");
  const soc = (await q("select socials from public.profiles where id = $1", [a.id])).rows[0].socials;
  const ig = soc.filter((s) => s.platform === "Instagram");
  check(ig.length === 1 && ig[0].url === "https://www.instagram.com/rhea.moves/", "the profile's Instagram link points at the connected account (exactly one entry)");

  // 2. reconnect replaces; the same account cannot go to a second person
  await q("select * from public.connect_instagram($1, '17841400000000002', 'rhea_two', null)", [a.id]);
  const live = (await q("select count(*)::int n from public.instagram_connections where user_id = $1 and deleted_at is null", [a.id])).rows[0].n;
  check(live === 1, "reconnecting leaves one live connection");
  const soc2 = (await q("select socials from public.profiles where id = $1", [a.id])).rows[0].socials.filter((s) => s.platform === "Instagram");
  check(soc2.length === 1 && soc2[0].url.endsWith("/rhea_two/"), "reconnecting rewrites the same Instagram entry, not a second one");
  const dup = await refused("select * from public.connect_instagram($1, '17841400000000002', 'thief', null)", [b.id]);
  check(dup && /already connected/.test(dup), "one Instagram account cannot be connected to a second profile", dup);
  const badName = await refused("select * from public.connect_instagram($1, '17841400000000009', 'no spaces', null)", [b.id]);
  check(badName && /username/.test(badName), "a malformed username is refused", badName);
  await reset();

  // 3. a signed-in person: reads the handle, never the account id, and cannot write
  await as("authenticated", b.id);
  const seen = (await q("select user_id, username from public.instagram_connections where user_id = $1", [a.id])).rows;
  check(seen.length === 1 && seen[0].username === "rhea_two", "a signed-in person reads somebody's live connection");
  const idRead = await refused("select ig_user_id from public.instagram_connections");
  check(idRead && /permission denied/.test(idRead), "the Instagram account id is not readable by a client", idRead);
  const ins = await refused("insert into public.instagram_connections (user_id, ig_user_id, username) values ($1, '1', 'fake')", [b.id]);
  check(ins && /permission denied/.test(ins), "a client cannot insert a connection", ins);
  const upd = await refused("update public.instagram_connections set username = 'fake' where user_id = $1", [a.id]);
  check(upd && /permission denied/.test(upd), "a client cannot rewrite a connection", upd);
  const rpc = await refused("select public.connect_instagram($1, '17841400000000003', 'fake', null)", [b.id]);
  check(rpc && /permission denied/.test(rpc), "a client cannot call connect_instagram", rpc);
  // B disconnecting touches only B (who has nothing)
  await q("select public.disconnect_instagram()");
  await reset();
  check((await q("select count(*)::int n from public.instagram_connections where user_id = $1 and deleted_at is null", [a.id])).rows[0].n === 1, "somebody else's disconnect leaves A connected");

  // 4. a stranger reads too
  await as("anon");
  const anonSeen = (await q("select username from public.instagram_connections where user_id = $1", [a.id])).rows;
  check(anonSeen.length === 1, "a signed-out visitor reads a live connection (public pages)");
  const anonRpc = await refused("select public.disconnect_instagram()");
  check(anonRpc && /permission denied/.test(anonRpc), "a stranger cannot call disconnect_instagram", anonRpc);
  await reset();

  // 5. A disconnects: the row goes, the link stays
  await as("authenticated", a.id);
  await q("select public.disconnect_instagram()");
  const gone = (await q("select count(*)::int n from public.instagram_connections where user_id = $1", [a.id])).rows[0].n;
  check(gone === 0, "after disconnecting, the person's connection is no longer readable");
  await reset();
  const kept = (await q("select socials from public.profiles where id = $1", [a.id])).rows[0].socials.filter((s) => s.platform === "Instagram");
  check(kept.length === 1, "the Instagram link stays on the profile after disconnecting");
};
