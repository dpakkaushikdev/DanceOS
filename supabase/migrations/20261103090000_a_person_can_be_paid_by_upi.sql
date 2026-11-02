-- A PERSON CAN BE PAID BY UPI (2 Nov 2026, the user: "first fix the teams
-- payment option").
--
-- The Pay sheet drew "Pay through Cashfree · coming soon" since 18 Oct and
-- could never keep it: money a studio pays its own people is the studio's,
-- from the studio's own bank (Step 13), and routing it through DanceOS's
-- Cashfree balance is payment-aggregator territory under RBI rules — a
-- licence, not a feature. So the studio stays the payer. What DanceOS adds is
-- the ADDRESS and the HANDSHAKE: a person says the UPI id a studio may pay
-- them on, the Pay sheet records the payout and opens the owner's own UPI app
-- with that id and the figure filled in, and the person taps Received when
-- it lands. Nothing moves through DanceOS; no vendor, no KYC.
--
-- THREE DOORS:
--   set_my_upi_id            — a person sets or clears their own, lower-cased,
--                              in NPCI's name@bank shape.
--   upi_id_for_paying        — who may READ it: the person, and the owner of a
--                              business that can pay them (on its team, has
--                              taught for it, worked one of its enquiries, or
--                              has been paid by it before). Anyone else reads
--                              null, never an error — the sheet simply draws no
--                              UPI button.
--   confirm_payout_received  — the person paid, and only them, moves a payout
--                              from in_transit (or on_hold) to done, and the
--                              payer is told. done again is a no-op; failed is
--                              refused; set_payout_status stays the owner's
--                              door for failed and on_hold.
--
-- ⚠ THE COLUMN IS BEHIND THE PHONE'S WALL. `profiles` is readable by every
-- signed-in user, and an artist's row by anyone at all, through a COLUMN grant
-- (6 Oct 2026). `upi_id` is deliberately NOT added to that grant: a payment
-- address is not a public fact, and the only way out is the RPC above. Every
-- repository already names its columns, so nothing breaks.
-- No `begin;`/`commit;` (Rule 18).

alter table public.profiles add column if not exists upi_id text;

alter table public.profiles
  add constraint profiles_upi_id_is_a_vpa
  check (upi_id is null or upi_id ~ '^[a-z0-9._-]{2,255}@[a-z]{2,64}$');

comment on column public.profiles.upi_id is
  'The UPI id a studio may pay this person on, lower-case, name@bank (2 Nov 2026). Not in the column grant: read only through upi_id_for_paying.';

-- ── set_my_upi_id ─────────────────────────────────────────────────────────────

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
         updated_by = v_user
   where id = v_user and deleted_at is null;
end;
$$;

comment on function public.set_my_upi_id(text) is
  'Sets or clears the caller''s own UPI id — trimmed, lower-cased, name@bank or refused.';
revoke execute on function public.set_my_upi_id(text) from public, anon;
grant execute on function public.set_my_upi_id(text) to authenticated;

-- ── upi_id_for_paying ─────────────────────────────────────────────────────────

create or replace function public.upi_id_for_paying(p_user_id uuid, p_business_id uuid default null)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.upi_id
    from public.profiles p
   where p.id = p_user_id
     and p.deleted_at is null
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

comment on function public.upi_id_for_paying(uuid, uuid) is
  'A person''s UPI id for the caller who may pay them: themselves, or the owner of a business they are on, taught for, worked an enquiry of, or were paid by. Null otherwise.';
revoke execute on function public.upi_id_for_paying(uuid, uuid) from public, anon;
grant execute on function public.upi_id_for_paying(uuid, uuid) to authenticated;

-- ── confirm_payout_received ───────────────────────────────────────────────────

create or replace function public.confirm_payout_received(p_payout_id uuid)
returns public.payouts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row public.payouts;
  v_name text;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  select * into v_row from public.payouts p where p.id = p_payout_id and p.deleted_at is null;
  if not found then
    raise exception 'that payment is not on record';
  end if;
  if v_row.user_id <> v_user then
    raise exception 'only the person paid marks it received';
  end if;
  if v_row.status = 'done' then
    return v_row;
  end if;
  if v_row.status = 'failed' then
    raise exception 'that payment was marked failed';
  end if;

  update public.payouts
     set status = 'done',
         updated_by = v_user
   where id = v_row.id
   returning * into v_row;

  select full_name into v_name from public.profiles where id = v_user;
  perform public.notify(
    v_row.created_by,
    'money',
    coalesce(v_name, 'Somebody') || ' received ₹' || v_row.amount_inr::text,
    'Marked received.',
    '/business/' || v_row.business_id::text || '/staff/' || v_row.user_id::text
  );
  return v_row;
end;
$$;

comment on function public.confirm_payout_received(uuid) is
  'The person paid marks a payout received: in_transit or on_hold becomes done and the payer is told. done is a no-op; failed is refused.';
revoke execute on function public.confirm_payout_received(uuid) from public, anon;
grant execute on function public.confirm_payout_received(uuid) to authenticated;

-- ── the payee's notification lands where Received is ──────────────────────────
-- `notify_payout` (29 Aug 2026) linked `/earnings`, which prints figures and
-- charts and no payment rows. The rows — and now the Received button — are on
-- the Other Teams page for that business, so the link goes there, and a payout
-- on its way says what to do about it. Same trigger, same grants.

create or replace function public.notify_payout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant text;
begin
  select b.name into v_tenant from public.businesses b where b.id = new.business_id;
  perform public.notify(new.user_id, 'money',
    coalesce(v_tenant, 'A studio') || ' paid you ₹' || new.amount_inr::text,
    case new.status
      when 'done' then 'Recorded as settled.'
      when 'in_transit' then 'On its way — tap Received when it lands.'
      else 'Recorded as ' || replace(new.status, '_', ' ') || '.'
    end,
    '/team/other/business/' || new.business_id::text);
  return null;
end;
$$;
revoke execute on function public.notify_payout() from public, anon, authenticated;
