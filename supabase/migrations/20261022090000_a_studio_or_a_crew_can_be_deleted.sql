-- A STUDIO OR A CREW CAN BE DELETED (18 Oct 2026, the user: "option to delete
-- studio and crew. should ask for confirmation before deleting"). The app asks
-- first; these two doors are what it asks the database to do.
--
-- delete_studio(p_business_id) — the studio's PRINCIPAL owner only (the oldest
-- live owner seat, `business_principal_owner`, the same person who may remove
-- another owner). Refused in words while something still depends on it:
--   * a published class of its own with a session still to run;
--   * an artist's class accepted into its room with a session still to run;
--   * a subscription on it that still RENEWS (a mandate is Cashfree's — deleting
--     a row stops no charge);
--   * somebody holds a pass it sold with hours left and not run out.
-- Otherwise, in one transaction and all SOFT (`deleted_at`, one UPDATE back):
-- the studio, its memberships on sale, its pending invites, its drafts, and
-- every team seat (so it leaves every switcher). The rest of the team is told.
-- Past classes, rooms and money rows are left as they are — history.
--
-- delete_crew(p_crew_id) — the crew's LEADER only. Every practice still to come
-- is called off (its own trigger tells the members), every roster seat closed,
-- and the crew soft-deleted. The members are told.
--
-- Two new functions, authenticated only. No table, column, policy or existing
-- function changes. No `begin;`/`commit;` (Rule 18).

create or replace function public.delete_studio(p_business_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_name text;
  v_n integer;
  r record;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  select b.name into v_name from public.businesses b
   where b.id = p_business_id and b.deleted_at is null and b.type = 'studio';
  if v_name is null then
    raise exception 'that studio is not here';
  end if;
  if public.business_principal_owner(p_business_id) is distinct from v_user then
    raise exception 'Only the studio''s main owner can delete it';
  end if;

  select count(*) into v_n from public.classes c
   where c.business_id = p_business_id and c.deleted_at is null and c.status = 'published'
     and exists (select 1 from public.class_sessions s where s.class_id = c.id and s.deleted_at is null and s.ends_at > now());
  if v_n > 0 then
    raise exception '% has % still to run — finish or delete %, then delete the studio',
      v_name, case when v_n = 1 then 'a class' else v_n || ' classes' end, case when v_n = 1 then 'it' else 'them' end;
  end if;

  select count(*) into v_n from public.classes c
   where c.venue_business_id = p_business_id and c.business_id <> p_business_id
     and c.deleted_at is null and c.venue_status = 'accepted'
     and exists (select 1 from public.class_sessions s where s.class_id = c.id and s.deleted_at is null and s.ends_at > now());
  if v_n > 0 then
    raise exception 'An artist''s class is booked into % still to run — it has to finish first', v_name;
  end if;

  if exists (select 1 from public.subscriptions s
              where s.business_id = p_business_id and s.deleted_at is null
                and s.status in ('active', 'past_due', 'pending_auth')
                and not s.granted and not s.cancel_at_period_end) then
    raise exception '%''s subscription still renews — stop renewing it from its Subscription first', v_name;
  end if;

  select count(*) into v_n from public.membership_passes mp
   where mp.business_id = p_business_id and mp.deleted_at is null and mp.status = 'active'
     and mp.units_used < mp.units_total
     and (mp.expires_at is null or mp.expires_at > now());
  if v_n > 0 then
    raise exception '% still % a pass from % with hours left — they have to use it up or run out first',
      case when v_n = 1 then 'Somebody' else v_n || ' people' end,
      case when v_n = 1 then 'holds' else 'hold' end, v_name;
  end if;

  -- the team is told before the seats close
  for r in
    select distinct m.user_id from public.business_members m
     where m.business_id = p_business_id and m.deleted_at is null and m.user_id <> v_user
  loop
    perform public.notify(r.user_id, 'people', v_name || ' was deleted', 'Its owner closed the studio.', '/business');
  end loop;

  update public.businesses set deleted_at = now(), updated_by = v_user where id = p_business_id;
  update public.memberships set deleted_at = now(), updated_by = v_user where business_id = p_business_id and deleted_at is null;
  update public.business_invites set deleted_at = now(), updated_by = v_user where business_id = p_business_id and deleted_at is null and status = 'pending';
  update public.classes set deleted_at = now(), updated_by = v_user where business_id = p_business_id and deleted_at is null and status = 'draft';
  update public.business_members set deleted_at = now(), updated_by = v_user where business_id = p_business_id and deleted_at is null;

  return jsonb_build_object('status', 'deleted', 'business_id', p_business_id);
end;
$function$;

revoke all on function public.delete_studio(uuid) from public, anon;
grant execute on function public.delete_studio(uuid) to authenticated, service_role;
comment on function public.delete_studio(uuid) is
  'The principal owner deletes a studio (soft): refused while a class of its own or an artist''s class in its room is still to run, a subscription on it renews, or a pass it sold has hours left; otherwise closes its memberships, pending invites, drafts and every team seat, and tells the team.';

create or replace function public.delete_crew(p_crew_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_crew public.crews;
  r record;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  select * into v_crew from public.crews c where c.id = p_crew_id and c.deleted_at is null;
  if v_crew.id is null then
    raise exception 'that crew is not here';
  end if;
  if v_crew.leader_id <> v_user then
    raise exception 'Only the crew''s leader can delete it';
  end if;

  -- practices still to come are called off; their own trigger tells the members
  update public.crew_practices set status = 'cancelled', updated_by = v_user
   where crew_id = p_crew_id and deleted_at is null and status = 'scheduled' and starts_at > now();

  for r in
    select distinct m.user_id from public.crew_members m
     where m.crew_id = p_crew_id and m.deleted_at is null and m.status = 'confirmed' and m.user_id <> v_user
  loop
    perform public.notify(r.user_id, 'people', v_crew.name || ' was deleted', 'Its leader closed the crew.', '/crews');
  end loop;

  update public.crew_members set deleted_at = now(), updated_by = v_user where crew_id = p_crew_id and deleted_at is null;
  update public.crews set deleted_at = now(), updated_by = v_user where id = p_crew_id;

  return jsonb_build_object('status', 'deleted', 'crew_id', p_crew_id);
end;
$function$;

revoke all on function public.delete_crew(uuid) from public, anon;
grant execute on function public.delete_crew(uuid) to authenticated, service_role;
comment on function public.delete_crew(uuid) is
  'The leader deletes a crew (soft): calls off every practice still to come, closes every roster seat, and tells the members.';
