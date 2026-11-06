-- A UPI ID IS VERIFIED (6 Nov 2026, the user: "how will it be verified if user
-- entered right UPI id … do real verification you already have cashfree
-- tokens").
--
-- Until today the only check on a UPI id was its SHAPE (name@bank), twice:
-- once in the app and once as profiles_upi_id_is_a_vpa. Nothing asked whether
-- the id exists or whose it is; the owner's UPI app was the only thing that
-- did, at the moment of paying, and nothing told the owner to read the name
-- it showed. Now the server asks Cashfree Secure ID when the id is saved, and
-- what Cashfree answers is kept beside the id:
--
--   upi_name_at_bank      the account holder's name as the bank has it, so
--                         the owner can read it in the Pay sheet BEFORE the
--                         UPI app opens and match it to the person.
--   upi_verified_at       when Cashfree said the id is real. Null = not
--                         verified: never asked, or Cashfree could not be
--                         reached, or it said INVALID (in which case the id is
--                         refused and never stored at all).
--   upi_verification_ref  Cashfree's reference for the lookup, for a dispute.
--
-- ⚠ WHO MAY WRITE "VERIFIED" — ONLY THE SERVER, NEVER THE PERSON. If a door
-- granted to `authenticated` took a name and a verified_at, anybody could call
-- it through PostgREST with a fake name and mark their own id verified without
-- Cashfree ever being asked — the whole feature undone by one curl. So
-- `set_upi_id_verified` is revoked from authenticated and anon and is called
-- with the SERVICE ROLE, by the server action, AFTER Cashfree has answered —
-- the same shape as `connect_instagram` (18 Oct 2026). The person's own door,
-- `set_my_upi_id`, keeps its signature and now CLEARS the three fields
-- whenever the id changes or is removed: a verification belongs to one id.
--
-- ⚠ ALL THREE COLUMNS ARE BEHIND THE PHONE'S WALL, like upi_id (2 Nov 2026):
-- not in the profiles column grant, so a stranger reads none of them. They
-- leave only through `upi_for_paying`, which carries the exact visibility rule
-- `upi_id_for_paying` has (the person, or the owner of a business that can pay
-- them) and now answers the name and the verification beside the id.
-- `upi_id_for_paying` stays, unchanged, so nothing that reads it breaks.
-- No `begin;`/`commit;` (Rule 18).

alter table public.profiles add column if not exists upi_name_at_bank text;
alter table public.profiles add column if not exists upi_verified_at timestamptz;
alter table public.profiles add column if not exists upi_verification_ref text;

comment on column public.profiles.upi_name_at_bank is
  'The account holder''s name at the bank for upi_id, as Cashfree Secure ID reported it (6 Nov 2026). Not in the column grant: read only through upi_for_paying.';
comment on column public.profiles.upi_verified_at is
  'When Cashfree Secure ID confirmed upi_id exists (6 Nov 2026). Null = not verified. Written only by set_upi_id_verified under the service role.';
comment on column public.profiles.upi_verification_ref is
  'Cashfree''s reference id for the lookup that verified upi_id (6 Nov 2026).';

-- ── set_my_upi_id: the person's door, now clearing a stale verification ───────

create or replace function public.set_my_upi_id(p_upi_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id text := nullif(lower(btrim(coalesce(p_upi_id, ''))), '');
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if v_id is not null and v_id !~ '^[a-z0-9._-]{2,255}@[a-z]{2,64}$' then
    raise exception 'That is not a UPI id — it looks like name@bank';
  end if;
  update public.profiles
     set upi_id = v_id,
         -- a verification is of ONE id: a different id, or none, starts over
         upi_name_at_bank = case when upi_id is not distinct from v_id then upi_name_at_bank else null end,
         upi_verified_at = case when upi_id is not distinct from v_id then upi_verified_at else null end,
         upi_verification_ref = case when upi_id is not distinct from v_id then upi_verification_ref else null end,
         updated_by = v_user
   where id = v_user and deleted_at is null;
end;
$$;

comment on function public.set_my_upi_id(text) is
  'Sets or clears the caller''s own UPI id — trimmed, lower-cased, name@bank or refused. A changed or removed id clears its verification.';
revoke execute on function public.set_my_upi_id(text) from public, anon;
grant execute on function public.set_my_upi_id(text) to authenticated;

-- ── set_upi_id_verified: the server's door, after Cashfree has answered ───────

create or replace function public.set_upi_id_verified(
  p_user_id uuid,
  p_upi_id text,
  p_name_at_bank text,
  p_verification_ref text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text := nullif(lower(btrim(coalesce(p_upi_id, ''))), '');
  v_name text := nullif(btrim(coalesce(p_name_at_bank, '')), '');
begin
  if v_id is null or v_id !~ '^[a-z0-9._-]{2,255}@[a-z]{2,64}$' then
    raise exception 'That is not a UPI id — it looks like name@bank';
  end if;
  -- the id and its verification land together, so the row can never say
  -- "verified" about an id other than the one it holds
  update public.profiles
     set upi_id = v_id,
         upi_name_at_bank = v_name,
         upi_verified_at = now(),
         upi_verification_ref = nullif(btrim(coalesce(p_verification_ref, '')), ''),
         updated_by = p_user_id
   where id = p_user_id and deleted_at is null;
  if not found then
    raise exception 'no such person';
  end if;
end;
$$;

comment on function public.set_upi_id_verified(uuid, text, text, text) is
  'SERVICE ROLE ONLY: records that Cashfree Secure ID confirmed this person''s UPI id, with the name at the bank and Cashfree''s reference (6 Nov 2026).';
revoke execute on function public.set_upi_id_verified(uuid, text, text, text) from public, anon, authenticated;

-- ── upi_for_paying: the id, the name and the verification, for who may pay ────

create or replace function public.upi_for_paying(p_user_id uuid, p_business_id uuid default null)
returns table (upi_id text, name_at_bank text, verified_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.upi_id, p.upi_name_at_bank, p.upi_verified_at
    from public.profiles p
   where p.id = p_user_id
     and p.deleted_at is null
     and p.upi_id is not null
     and (select auth.uid()) is not null
     and (
       p.id = (select auth.uid())
       or (
         p_business_id is not null
         and public.is_business_owner(p_business_id)
         and (
           exists (select 1 from public.business_members m
                    where m.business_id = p_business_id and m.user_id = p.id and m.deleted_at is null)
           or exists (select 1 from public.class_people cp
                       where cp.business_id = p_business_id and cp.user_id = p.id
                         and cp.status = 'confirmed' and cp.deleted_at is null)
           or exists (select 1 from public.enquiry_people ep
                        join public.enquiries e on e.id = ep.enquiry_id
                       where e.business_id = p_business_id and ep.user_id = p.id
                         and ep.kind = 'team' and ep.status = 'confirmed'
                         and ep.deleted_at is null and e.deleted_at is null)
           or exists (select 1 from public.payouts po
                       where po.business_id = p_business_id and po.user_id = p.id and po.deleted_at is null)
         )
       )
     );
$$;

comment on function public.upi_for_paying(uuid, uuid) is
  'A person''s UPI id with the name at the bank and when it was verified, for the caller who may pay them: themselves, or the owner of a business they are on, taught for, worked an enquiry of, or were paid by. No row otherwise.';
revoke execute on function public.upi_for_paying(uuid, uuid) from public, anon;
grant execute on function public.upi_for_paying(uuid, uuid) to authenticated;
