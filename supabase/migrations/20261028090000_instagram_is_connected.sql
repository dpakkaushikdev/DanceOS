-- ⚠ Rule 9 (auth + RLS): ONE NEW TABLE, WRITTEN ONLY BY THE SERVER.
--
-- CONNECT INSTAGRAM (18 Oct 2026, the user: "user should be able to click insta
-- icon and it should sync with the insta account logged in the phone. like they
-- do in many games such as pokemon go").
--
-- A person taps the Instagram icon, Instagram asks them to Allow, and Instagram
-- hands the app back WHICH account that was (Instagram API with Instagram
-- Login — Creator and Business accounts only; Meta closed personal accounts to
-- every app in Dec 2024). The handle on the profile is then a FACT, not a typed
-- claim, and the chip wears a tick.
--
-- WHY A TABLE OF ITS OWN AND NOT A FLAG IN `socials`. `profiles.socials` is the
-- person's own to write (`update_my_profile`, and a direct PATCH is only held
-- to "every url is http(s)"), so a `verified: true` inside it would be a claim
-- anybody could type. This table has NO write grant for any client role: the
-- only door in is `connect_instagram`, granted to the service role alone and
-- called by the OAuth callback after Instagram itself has said who it is.
--
-- WHAT IS KEPT: the Instagram account's id, its username and its type. NOT the
-- access token — it is used once in the callback to ask "who is this" and then
-- dropped, so there is nothing here worth stealing.
--
-- ONE ACCOUNT, ONE PERSON. A live Instagram account can be connected to one
-- DanceOS profile at a time, so nobody can wear somebody else's verified handle
-- by connecting it second.
--
-- The tick is only drawn while the profile's Instagram link still points at
-- the connected username (the app compares the two), so editing the link by
-- hand to somebody else's handle takes the tick off by itself.

create table public.instagram_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  ig_user_id text not null,
  username text not null,
  account_type text,
  connected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  /* ⚠ PLAIN UUIDs, NO FOREIGN KEY INTO auth.users (19 Sep). Written under the
     service role, where auth.uid() is null, so `connect_instagram` stamps the
     person explicitly. */
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  constraint instagram_connections_ig_id_shape check (ig_user_id ~ '^[0-9]{1,30}$'),
  constraint instagram_connections_username_shape check (username ~ '^[A-Za-z0-9._]{1,30}$'),
  constraint instagram_connections_type_shape check (account_type is null or char_length(account_type) <= 40)
);
comment on table public.instagram_connections is
  'A person''s Instagram account, as Instagram itself reported it through Instagram Login (18 Oct 2026). Written only by connect_instagram (service role, the OAuth callback); taken down by the person through disconnect_instagram. No token is stored.';

create unique index instagram_connections_one_per_person on public.instagram_connections (user_id) where deleted_at is null;
create unique index instagram_connections_one_person_per_account on public.instagram_connections (ig_user_id) where deleted_at is null;
create trigger instagram_connections_set_updated_at before update on public.instagram_connections
  for each row execute function public.set_updated_at();

alter table public.instagram_connections enable row level security;
revoke all on public.instagram_connections from anon, authenticated;
/* the handle is public the moment it is on a profile, so anybody may read WHO
   is connected — but only these columns: never the Instagram account id */
grant select (id, user_id, username, connected_at, deleted_at) on public.instagram_connections to anon, authenticated;
create policy "anyone reads live instagram connections" on public.instagram_connections for select to anon, authenticated
  using (deleted_at is null);

-- ── the one door in: the OAuth callback, under the service role ─────────────
create or replace function public.connect_instagram(p_user_id uuid, p_ig_user_id text, p_username text, p_account_type text)
returns public.instagram_connections
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.instagram_connections;
  v_username text := btrim(coalesce(p_username, ''));
  v_url text;
  v_socials jsonb;
  v_at int;
begin
  if p_user_id is null or not exists (select 1 from public.profiles p where p.id = p_user_id and p.deleted_at is null) then
    raise exception 'there is no such profile';
  end if;
  if coalesce(p_ig_user_id, '') !~ '^[0-9]{1,30}$' then
    raise exception 'Instagram did not say which account that was';
  end if;
  if v_username !~ '^[A-Za-z0-9._]{1,30}$' then
    raise exception 'Instagram sent a username this app cannot read';
  end if;
  if exists (select 1 from public.instagram_connections c
              where c.ig_user_id = p_ig_user_id and c.user_id <> p_user_id and c.deleted_at is null) then
    raise exception 'That Instagram account is already connected to another DanceOS profile';
  end if;

  /* reconnecting replaces: the person's old connection (another account, or the
     same one renamed) is taken down before the new one goes in */
  update public.instagram_connections
     set deleted_at = now(), updated_by = p_user_id
   where user_id = p_user_id and deleted_at is null;

  insert into public.instagram_connections (user_id, ig_user_id, username, account_type, created_by, updated_by)
  values (p_user_id, p_ig_user_id, v_username, nullif(left(btrim(coalesce(p_account_type, '')), 40), ''), p_user_id, p_user_id)
  returning * into v_row;

  /* THE CHIP FOLLOWS THE FACT: the profile's Instagram link becomes the
     connected account's address, in the place it already held, or at the end.
     At the 12-link ceiling with no Instagram entry the list is left alone. */
  v_url := 'https://www.instagram.com/' || v_username || '/';
  select coalesce(p.socials, '[]'::jsonb) into v_socials from public.profiles p where p.id = p_user_id;
  select (e.ord - 1)::int into v_at
    from jsonb_array_elements(v_socials) with ordinality e(item, ord)
   where e.item ->> 'platform' = 'Instagram'
   limit 1;
  if v_at is not null then
    v_socials := jsonb_set(v_socials, array[v_at::text], jsonb_build_object('platform', 'Instagram', 'url', v_url));
  elsif jsonb_array_length(v_socials) < 12 then
    v_socials := v_socials || jsonb_build_array(jsonb_build_object('platform', 'Instagram', 'url', v_url));
  end if;
  update public.profiles set socials = v_socials, updated_by = p_user_id where id = p_user_id;

  return v_row;
end;
$$;
comment on function public.connect_instagram(uuid, text, text, text) is
  'Record that this person''s Instagram account is the one Instagram Login reported, and point their Instagram link at it. Service role only — the OAuth callback is the sole caller.';
revoke execute on function public.connect_instagram(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.connect_instagram(uuid, text, text, text) to service_role;

-- ── the way out: the person themselves ──────────────────────────────────────
create or replace function public.disconnect_instagram()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  /* the link on the profile stays — it is theirs — it just stops wearing a tick */
  update public.instagram_connections
     set deleted_at = now(), updated_by = auth.uid()
   where user_id = auth.uid() and deleted_at is null;
end;
$$;
comment on function public.disconnect_instagram() is
  'Take down the caller''s Instagram connection. Their Instagram link stays on the profile, without the tick.';
revoke execute on function public.disconnect_instagram() from public, anon;
grant execute on function public.disconnect_instagram() to authenticated;
