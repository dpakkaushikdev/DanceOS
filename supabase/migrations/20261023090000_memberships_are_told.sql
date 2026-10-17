-- A MEMBERSHIP IS TOLD (18 Oct 2026). The user: "notification for memberships."
--
-- Until today a membership raised nothing: a pass bought, a pass spent and a
-- pass handed back were all silent, so the Memberships tool could never carry a
-- count. This adds a seventh notification AREA, 'membership', and the triggers
-- that raise it where the facts happen.
--
--   1. notifications_kind_check admits 'membership'.
--   2. notification_group (live body, edited by asserted anchor) files kind
--      'membership', and any link into /memberships or a business's
--      /memberships desk, under 'membership'. Money stays money (a membership
--      REFUND is still kind money, decided first).
--   3. set_notification_prefs (live body, anchored) accepts the new key.
--   4. notify_membership_pass — AFTER INSERT OR UPDATE OF status on
--      membership_passes:
--        becomes active (a free pass on insert, a paid one on capture)
--          → the buyer: "Your membership is ready"
--          → the seller's owners: "{buyer} took {membership}"
--        active → used_up  → the buyer: "Your membership is used up"
--        active → cancelled → the seller's owners: "{buyer} returned {membership}"
--   5. notify_membership_use — AFTER INSERT on membership_uses: the holder is
--      told what was spent and what is left.
--
-- Both trigger functions are definer, executable by no client role, and never
-- raise (notify() swallows its own errors; these return null). No table,
-- column, policy or grant changes; nothing is backfilled.
-- ⚠ No begin/commit (Rule 18).

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind = any (array['class','team','crew','enquiry','money','danceos','event','membership']));

do $$
declare
  v_def text;
  v_anchor text;
  v_new text;
begin
  -- 2. notification_group
  v_def := pg_get_functiondef('public.notification_group(text,text)'::regprocedure);
  v_anchor := E'  if p_kind = ''money'' then return ''money''; end if;\n';
  if (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor) <> 1 then
    raise exception 'notification_group anchor not found exactly once';
  end if;
  v_new := v_anchor
    || E'  if p_kind = ''membership'' or h like ''/memberships%'' or h ~ ''^/business/[^/?]+/memberships'' then return ''membership''; end if;\n';
  execute replace(v_def, v_anchor, v_new);

  -- 3. set_notification_prefs
  v_def := pg_get_functiondef('public.set_notification_prefs(jsonb,boolean,boolean,boolean,jsonb)'::regprocedure);
  v_anchor := $a$('class', 'team', 'crew', 'enquiry', 'money', 'danceos')$a$;
  if (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor) <> 1 then
    raise exception 'set_notification_prefs anchor not found exactly once';
  end if;
  execute replace(v_def, v_anchor, $a$('class', 'team', 'crew', 'enquiry', 'money', 'danceos', 'membership')$a$);
end $$;

-- 4. a pass bought, used up, handed back
create or replace function public.notify_membership_pass()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_name text;
  v_who text;
  v_was text := case when tg_op = 'UPDATE' then old.status else null end;
begin
  if new.deleted_at is not null then
    return null;
  end if;
  if v_was is not distinct from new.status then
    return null;
  end if;
  select m.name into v_name from public.memberships m where m.id = new.membership_id;
  select p.full_name into v_who from public.profiles p where p.id = new.user_id;
  v_name := coalesce(v_name, 'a membership');
  v_who := coalesce(v_who, 'Somebody');

  if new.status = 'active' and coalesce(v_was, '') <> 'active' then
    perform public.notify(new.user_id, 'membership', 'Your membership is ready',
      v_name || case when new.expires_at is not null
        then ' · valid till ' || to_char(new.expires_at at time zone 'Asia/Kolkata', 'DD Mon YYYY')
        else ' · valid until used up' end,
      '/memberships');
    perform public.notify_business_owners(new.business_id, 'membership',
      v_who || ' took ' || v_name, null,
      '/business/' || new.business_id || '/memberships/' || new.membership_id);
  elsif new.status = 'used_up' and v_was = 'active' then
    perform public.notify(new.user_id, 'membership', 'Your membership is used up',
      v_name || ' has nothing left', '/memberships');
  elsif new.status = 'cancelled' and v_was = 'active' then
    perform public.notify_business_owners(new.business_id, 'membership',
      v_who || ' returned ' || v_name, null,
      '/business/' || new.business_id || '/memberships/' || new.membership_id);
  end if;
  return null;
exception when others then
  return null;
end;
$$;

revoke all on function public.notify_membership_pass() from public, anon, authenticated;

create trigger membership_passes_notify
  after insert or update of status on public.membership_passes
  for each row execute function public.notify_membership_pass();

-- 5. a pass spent on a class
create or replace function public.notify_membership_use()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_pass public.membership_passes;
  v_name text;
begin
  select * into v_pass from public.membership_passes where id = new.pass_id;
  if not found then
    return null;
  end if;
  select m.name into v_name from public.memberships m where m.id = v_pass.membership_id;
  perform public.notify(v_pass.user_id, 'membership',
    'Membership used on a class',
    coalesce(v_name, 'Your membership') || ' · '
      -- the use row is written BEFORE book_with_membership moves units_used,
      -- so what is left is counted with this use taken off here
      || regexp_replace(greatest(v_pass.units_total - v_pass.units_used - new.units, 0)::text, '\.0+$', '') || ' '
      || case when v_pass.unit = 'hours' then 'hours' else 'classes' end || ' left',
    '/memberships');
  return null;
exception when others then
  return null;
end;
$$;

revoke all on function public.notify_membership_use() from public, anon, authenticated;

create trigger membership_uses_notify
  after insert on public.membership_uses
  for each row execute function public.notify_membership_use();
