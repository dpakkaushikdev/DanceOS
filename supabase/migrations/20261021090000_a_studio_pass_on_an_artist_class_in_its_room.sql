-- A STUDIO'S PASS ON AN ARTIST'S CLASS IN ITS ROOM (18 Oct 2026).
--
-- The user: "artist doesnt have its own memberships only studio has but can be
-- used if artist select while selecting a studio within dance os."
--
-- An artist sells no memberships (20261004130000, `classes_no_artist_memberships`
-- keeps `allows_artist_memberships` false). Until now a studio's pass was offered
-- only on a class the STUDIO owns (`p.business_id = s.business_id`), so an
-- artist's class held in that studio's room never took it. One branch more in
-- `passes_for_session` — which `book_with_membership` also asks — offers the
-- VENUE studio's pass when the studio has ACCEPTED the room and the class's own
-- "Studio memberships" switch is on. The switch is the artist's to turn on.
--
-- ⚠ Everything else is the catalog's own body, unchanged. `create or replace`
-- with the same signature, so the ACL stays exactly as it is
-- ({postgres, authenticated, service_role}; never anon).
--
-- ⚠ The backfill: an ARTIST-PAGE class not yet published starts OFF, so it does
-- not begin taking a studio's passes without the artist choosing it. A studio's
-- own classes are untouched.

create or replace function public.passes_for_session(p_session_id uuid)
 returns table(pass_id uuid, membership_name text, business_name text, unit text, units_total numeric, units_used numeric, units_needed numeric, enough boolean)
 language sql
 stable security definer
 set search_path to ''
as $function$
  with s as (
    select se.id, se.class_id, se.starts_at, se.ends_at, c.business_id, c.allows_studio_memberships, c.allows_artist_memberships,
           c.venue_business_id, c.venue_status
      from public.class_sessions se
      join public.classes c on c.id = se.class_id and c.deleted_at is null and c.price_inr > 0
     where se.id = p_session_id and se.deleted_at is null
  )
  select p.id, m.name, b.name, p.unit, p.units_total, p.units_used,
         case when p.unit = 'hours'
              then round(extract(epoch from (s.ends_at - s.starts_at)) / 3600.0, 1)
              else 1 end,
         (p.units_total - p.units_used) >=
           case when p.unit = 'hours'
                then round(extract(epoch from (s.ends_at - s.starts_at)) / 3600.0, 1)
                else 1 end
    from s
    join public.membership_passes p
      on p.user_id = auth.uid() and p.status = 'active' and p.deleted_at is null
     and (p.expires_at is null or s.starts_at < p.expires_at)
    join public.memberships m on m.id = p.membership_id
    join public.businesses b on b.id = p.business_id
   where (
     -- the studio's own pass, on its own class
     (p.business_id = s.business_id and s.allows_studio_memberships)
     -- the studio's pass, on an artist's class held in its room once it said yes (18 Oct 2026)
     or (p.business_id = s.venue_business_id and s.venue_status = 'accepted' and s.allows_studio_memberships)
     -- the artist's pass, on a class that artist is confirmed to teach
     or (s.allows_artist_memberships and exists (
           select 1 from public.class_people k
             join public.businesses ab on ab.id = p.business_id and ab.type = 'artist_page'
            where k.class_id = s.class_id and k.kind = 'artist' and k.status = 'confirmed' and k.deleted_at is null
              and k.user_id = public.business_owner(p.business_id)
         ))
   )
   order by 8 desc, 2;
$function$;

-- the switch starts OFF on every artist's class not yet published; the artist
-- turns it on. ⚠ A PUBLISHED class is left as it is: it is fixed
-- (`guard_published_class_fixed`), and it was published with the form's
-- "Studio memberships" switch visibly on — that was the artist's choice.
update public.classes c
   set allows_studio_memberships = false
  from public.businesses b
 where b.id = c.business_id and b.type = 'artist_page'
   and c.status <> 'published'
   and c.allows_studio_memberships;

comment on column public.classes.allows_studio_memberships is
  'A studio''s pass covers a seat. On a studio''s own class: that studio''s passes. On an artist''s class held in a studio''s room (venue accepted): that venue studio''s passes — the artist''s choice, off by default (18 Oct 2026).';
