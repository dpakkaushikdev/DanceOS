-- ⚠ Rule 9 (money + RLS): TWO NEW TABLES, THREE NEW DOORS, NOTHING EXISTING MOVED.
--
-- PAY IS SET WHEN PAYING (18 Oct 2026, the user: "remove mechanism to enter this
-- kind of pay anywhere … should get details when paying from team section with
-- data of what class hasnt been settled. can add single rate or bulk rate for
-- multiple classes … when an artist making class and adding studio should get
-- option to pay that studio rent in same way from other team").
--
-- 1. record_session_payment — a business pays one person for sessions they took,
--    at the RATE THE PAYER TYPES NOW, line by line. It replaces record_payout's
--    "rate on record" (class_people.pay_per_session_inr / business_members
--    .pay_per_session_inr), which nothing in the app sets any more. Same checks as
--    record_payout: the business's owner; a session of THIS business, ended; the
--    person confirmed on that class while it ran; a session paid once
--    (payout_lines' unique live index). Writes the same payouts + payout_lines,
--    so every ledger that already reads them is unchanged.
--
-- 2. rent_payments + rent_lines — an artist's page paying the studio whose room a
--    class was held in. A line is one session of a class whose venue is that
--    studio and was ACCEPTED; a session is rented once. Read by whoever runs
--    either side; no client writes — the doors are record_rent_payment (the
--    artist page's owner) and void_rent_payment (the same).
--
-- record_payout, the two pay_per_session columns and their doors are LEFT in
-- place (Rule 4 for the old bodies; the columns hold history). Nothing backfilled.

-- ── 0. an ENQUIRY a team member worked on is payable too (18 Oct 2026, the user:
--    "should also show list of enquiries they have worked on in an enquiry as a
--    team member not participant"). payout_lines needs a session, so an enquiry
--    line is its own table under the same payout. One live line per (enquiry,
--    person) — an enquiry is settled once per person. Read by the owner and the
--    person paid, exactly as payout_lines.
create table public.payout_enquiry_lines (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.payouts (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  enquiry_id uuid not null references public.enquiries (id) on delete cascade,
  rate_inr integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null,
  updated_by uuid not null,
  deleted_at timestamptz,
  constraint payout_enquiry_lines_rate check (rate_inr >= 0 and rate_inr <= 1000000)
);
comment on table public.payout_enquiry_lines is
  'The enquiries one payout covered for a team member, each with what was paid for it (18 Oct 2026).';
create unique index payout_enquiry_lines_one_live on public.payout_enquiry_lines (enquiry_id, user_id) where deleted_at is null;
create index payout_enquiry_lines_payout on public.payout_enquiry_lines (payout_id) where deleted_at is null;
create index payout_enquiry_lines_user on public.payout_enquiry_lines (user_id) where deleted_at is null;
create trigger payout_enquiry_lines_set_updated_at before update on public.payout_enquiry_lines
  for each row execute function public.set_updated_at();
alter table public.payout_enquiry_lines enable row level security;
revoke all on public.payout_enquiry_lines from anon, authenticated;
grant select on public.payout_enquiry_lines to authenticated;
create policy "owner and payee read payout enquiry lines" on public.payout_enquiry_lines for select to authenticated
  using (public.is_business_owner(business_id) or user_id = (select auth.uid()));

-- void_payout must release enquiry lines too, or a voided payment would leave
-- its enquiries "settled" for ever. A trigger, so the existing void door is not
-- re-typed (a re-typed function is one that can differ).
create or replace function public.payout_void_releases_enquiries()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    update public.payout_enquiry_lines set deleted_at = new.deleted_at, updated_by = coalesce(new.updated_by, updated_by)
     where payout_id = new.id and deleted_at is null;
  end if;
  return null;
end;
$$;
revoke execute on function public.payout_void_releases_enquiries() from public, anon, authenticated;
create trigger payouts_void_releases_enquiries after update of deleted_at on public.payouts
  for each row execute function public.payout_void_releases_enquiries();

-- ── 1. paying a person, the rate chosen at the time of paying ───────────────
-- A line is { session_id, rate_inr } for a class, or { enquiry_id, rate_inr }
-- for an enquiry they were on the team of.
create or replace function public.record_session_payment(
  p_business_id uuid,
  p_user_id uuid,
  p_lines jsonb,
  p_method text default 'bank_transfer',
  p_status text default 'done',
  p_provider_ref text default null,
  p_paid_on date default null,
  p_note text default null
)
returns public.payouts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_payout public.payouts;
  v_line jsonb;
  v_sid uuid;
  v_rate integer;
  v_session public.class_sessions;
  v_claim public.class_people;
  v_total integer := 0;
  v_seen uuid[] := '{}';
  v_out jsonb := '[]'::jsonb;
  v_eid uuid;
  v_eout jsonb := '[]'::jsonb;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_business_owner(p_business_id) then
    raise exception 'only the owner pays the team';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'pick at least one class to pay for';
  end if;
  if jsonb_array_length(p_lines) > 200 then
    raise exception 'pay for at most 200 classes at a time';
  end if;
  if p_status not in ('done', 'in_transit', 'on_hold', 'failed') then
    raise exception 'invalid status';
  end if;
  if p_method not in ('bank_transfer', 'upi', 'cash', 'other') then
    raise exception 'invalid method';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    begin
      v_sid := (v_line ->> 'session_id')::uuid;
      v_eid := (v_line ->> 'enquiry_id')::uuid;
      v_rate := (v_line ->> 'rate_inr')::integer;
    exception when others then
      raise exception 'each line needs a class or an enquiry and a whole-rupee amount';
    end;
    if (v_sid is null) = (v_eid is null) or v_rate is null then
      raise exception 'each line needs a class or an enquiry, and an amount';
    end if;
    if v_rate < 0 or v_rate > 1000000 then
      raise exception 'an amount is between ₹0 and ₹10,00,000';
    end if;
    if coalesce(v_sid, v_eid) = any (v_seen) then
      raise exception 'that line is in the list twice';
    end if;
    v_seen := v_seen || coalesce(v_sid, v_eid);

    if v_eid is not null then
      if not exists (select 1 from public.enquiries e
                      where e.id = v_eid and e.business_id = p_business_id and e.deleted_at is null) then
        raise exception 'that enquiry is not this business''s';
      end if;
      if not exists (select 1 from public.enquiry_people p
                      where p.enquiry_id = v_eid and p.user_id = p_user_id and p.kind = 'team'
                        and p.status = 'confirmed' and p.deleted_at is null) then
        raise exception 'they were not on that enquiry''s team';
      end if;
      if exists (select 1 from public.payout_enquiry_lines l
                  where l.enquiry_id = v_eid and l.user_id = p_user_id and l.deleted_at is null) then
        raise exception 'that enquiry is already settled';
      end if;
      v_eout := v_eout || jsonb_build_object('enquiry_id', v_eid, 'rate_inr', v_rate);
      v_total := v_total + v_rate;
      continue;
    end if;

    select s.* into v_session
      from public.class_sessions s
      join public.classes c on c.id = s.class_id
     where s.id = v_sid and c.business_id = p_business_id and c.deleted_at is null and s.deleted_at is null;
    if not found then
      raise exception 'that class is not this business''s';
    end if;
    if v_session.ends_at > now() then
      raise exception 'that class has not happened yet';
    end if;

    select * into v_claim
      from public.class_people cc
     where cc.class_id = v_session.class_id
       and cc.user_id = p_user_id
       and cc.status = 'confirmed'
       and (cc.deleted_at is null or cc.deleted_at > v_session.starts_at)
     order by cc.deleted_at nulls first, cc.created_at desc
     limit 1;
    if not found then
      raise exception 'they were never confirmed on that class';
    end if;
    if exists (select 1 from public.payout_lines l
                where l.session_id = v_sid and l.user_id = p_user_id and l.deleted_at is null) then
      raise exception 'that class is already settled';
    end if;

    v_out := v_out || jsonb_build_object('session_id', v_sid, 'class_id', v_session.class_id,
                                          'kind', v_claim.kind, 'rate_inr', v_rate);
    v_total := v_total + v_rate;
  end loop;

  if v_total <= 0 then
    raise exception 'type what you are paying';
  end if;

  insert into public.payouts (business_id, user_id, amount_inr, status, method,
                              provider_ref, paid_on, note, created_by, updated_by)
  values (p_business_id, p_user_id, v_total, p_status, p_method,
          nullif(trim(coalesce(p_provider_ref, '')), ''),
          coalesce(p_paid_on, current_date), nullif(trim(coalesce(p_note, '')), ''),
          v_user, v_user)
  returning * into v_payout;

  insert into public.payout_lines (payout_id, business_id, user_id, session_id,
                                   class_id, kind, rate_inr, created_by, updated_by)
  select v_payout.id, p_business_id, p_user_id,
         (l ->> 'session_id')::uuid, (l ->> 'class_id')::uuid,
         l ->> 'kind', (l ->> 'rate_inr')::integer, v_user, v_user
    from jsonb_array_elements(v_out) as l;

  insert into public.payout_enquiry_lines (payout_id, business_id, user_id, enquiry_id, rate_inr, created_by, updated_by)
  select v_payout.id, p_business_id, p_user_id, (l ->> 'enquiry_id')::uuid, (l ->> 'rate_inr')::integer, v_user, v_user
    from jsonb_array_elements(v_eout) as l;

  return v_payout;
end;
$$;
comment on function public.record_session_payment(uuid, uuid, jsonb, text, text, text, date, text) is
  'Pay one person for classes they took, at the amount the owner types per class now (18 Oct 2026). Writes payouts + payout_lines; a class is settled once.';
revoke execute on function public.record_session_payment(uuid, uuid, jsonb, text, text, text, date, text) from public, anon;
grant execute on function public.record_session_payment(uuid, uuid, jsonb, text, text, text, date, text) to authenticated;

-- ── 2. rent: an artist's page paying the studio it held a class in ──────────
create table public.rent_payments (
  id uuid primary key default gen_random_uuid(),
  payer_business_id uuid not null references public.businesses (id) on delete cascade,
  venue_business_id uuid not null references public.businesses (id) on delete cascade,
  amount_inr integer not null,
  status text not null default 'done',
  method text not null default 'bank_transfer',
  provider_ref text,
  paid_on date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null,
  updated_by uuid not null,
  deleted_at timestamptz,
  constraint rent_payments_amount check (amount_inr > 0 and amount_inr <= 100000000),
  constraint rent_payments_status check (status in ('done', 'in_transit', 'on_hold', 'failed')),
  constraint rent_payments_method check (method in ('bank_transfer', 'upi', 'cash', 'other')),
  constraint rent_payments_note check (note is null or char_length(note) <= 500),
  constraint rent_payments_ref check (provider_ref is null or char_length(provider_ref) between 1 and 120),
  constraint rent_payments_two_sides check (payer_business_id <> venue_business_id)
);
comment on table public.rent_payments is
  'Rent an artist''s page paid a studio for classes held in its rooms (18 Oct 2026). Written only by record_rent_payment; read by whoever runs either side.';
create index rent_payments_payer on public.rent_payments (payer_business_id, paid_on desc) where deleted_at is null;
create index rent_payments_venue on public.rent_payments (venue_business_id, paid_on desc) where deleted_at is null;
create trigger rent_payments_set_updated_at before update on public.rent_payments
  for each row execute function public.set_updated_at();

create table public.rent_lines (
  id uuid primary key default gen_random_uuid(),
  rent_payment_id uuid not null references public.rent_payments (id) on delete cascade,
  payer_business_id uuid not null references public.businesses (id) on delete cascade,
  venue_business_id uuid not null references public.businesses (id) on delete cascade,
  session_id uuid not null references public.class_sessions (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  rate_inr integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null,
  updated_by uuid not null,
  deleted_at timestamptz,
  constraint rent_lines_rate check (rate_inr >= 0 and rate_inr <= 1000000)
);
comment on table public.rent_lines is 'One class session a rent payment covered, with what was paid for it.';
create unique index rent_lines_one_live_per_session on public.rent_lines (session_id) where deleted_at is null;
create index rent_lines_payment on public.rent_lines (rent_payment_id);
create index rent_lines_payer on public.rent_lines (payer_business_id) where deleted_at is null;
create index rent_lines_venue on public.rent_lines (venue_business_id) where deleted_at is null;
create trigger rent_lines_set_updated_at before update on public.rent_lines
  for each row execute function public.set_updated_at();

alter table public.rent_payments enable row level security;
alter table public.rent_lines enable row level security;
revoke all on public.rent_payments from anon, authenticated;
revoke all on public.rent_lines from anon, authenticated;
grant select on public.rent_payments to authenticated;
grant select on public.rent_lines to authenticated;
create policy "either side reads rent" on public.rent_payments for select to authenticated
  using (public.runs_business(payer_business_id) or public.runs_business(venue_business_id));
create policy "either side reads rent lines" on public.rent_lines for select to authenticated
  using (public.runs_business(payer_business_id) or public.runs_business(venue_business_id));

create or replace function public.record_rent_payment(
  p_payer_business_id uuid,
  p_venue_business_id uuid,
  p_lines jsonb,
  p_method text default 'bank_transfer',
  p_status text default 'done',
  p_provider_ref text default null,
  p_paid_on date default null,
  p_note text default null
)
returns public.rent_payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row public.rent_payments;
  v_line jsonb;
  v_sid uuid;
  v_rate integer;
  v_session public.class_sessions;
  v_total integer := 0;
  v_seen uuid[] := '{}';
  v_out jsonb := '[]'::jsonb;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_business_owner(p_payer_business_id) then
    raise exception 'only the owner pays rent';
  end if;
  if p_payer_business_id = p_venue_business_id then
    raise exception 'that is your own studio';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'pick at least one class to pay for';
  end if;
  if jsonb_array_length(p_lines) > 200 then
    raise exception 'pay for at most 200 classes at a time';
  end if;
  if p_status not in ('done', 'in_transit', 'on_hold', 'failed') then
    raise exception 'invalid status';
  end if;
  if p_method not in ('bank_transfer', 'upi', 'cash', 'other') then
    raise exception 'invalid method';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    begin
      v_sid := (v_line ->> 'session_id')::uuid;
      v_rate := (v_line ->> 'rate_inr')::integer;
    exception when others then
      raise exception 'each class needs a session and a whole-rupee amount';
    end;
    if v_sid is null or v_rate is null then
      raise exception 'each class needs a session and an amount';
    end if;
    if v_rate < 0 or v_rate > 1000000 then
      raise exception 'an amount is between ₹0 and ₹10,00,000';
    end if;
    if v_sid = any (v_seen) then
      raise exception 'that class is in the list twice';
    end if;
    v_seen := v_seen || v_sid;

    select s.* into v_session
      from public.class_sessions s
      join public.classes c on c.id = s.class_id
     where s.id = v_sid
       and c.business_id = p_payer_business_id
       and c.venue_business_id = p_venue_business_id
       and c.venue_status = 'accepted'
       and c.deleted_at is null
       and s.deleted_at is null;
    if not found then
      raise exception 'that class was not held in this studio';
    end if;
    if exists (select 1 from public.rent_lines l where l.session_id = v_sid and l.deleted_at is null) then
      raise exception 'that class''s rent is already paid';
    end if;

    v_out := v_out || jsonb_build_object('session_id', v_sid, 'class_id', v_session.class_id, 'rate_inr', v_rate);
    v_total := v_total + v_rate;
  end loop;

  if v_total <= 0 then
    raise exception 'type what you are paying';
  end if;

  insert into public.rent_payments (payer_business_id, venue_business_id, amount_inr, status, method,
                                    provider_ref, paid_on, note, created_by, updated_by)
  values (p_payer_business_id, p_venue_business_id, v_total, p_status, p_method,
          nullif(trim(coalesce(p_provider_ref, '')), ''),
          coalesce(p_paid_on, current_date), nullif(trim(coalesce(p_note, '')), ''),
          v_user, v_user)
  returning * into v_row;

  insert into public.rent_lines (rent_payment_id, payer_business_id, venue_business_id, session_id,
                                 class_id, rate_inr, created_by, updated_by)
  select v_row.id, p_payer_business_id, p_venue_business_id,
         (l ->> 'session_id')::uuid, (l ->> 'class_id')::uuid, (l ->> 'rate_inr')::integer, v_user, v_user
    from jsonb_array_elements(v_out) as l;

  return v_row;
end;
$$;
comment on function public.record_rent_payment(uuid, uuid, jsonb, text, text, text, date, text) is
  'An artist''s page pays a studio rent for classes held in its rooms, at the amount typed per class now (18 Oct 2026). A class session is rented once.';
revoke execute on function public.record_rent_payment(uuid, uuid, jsonb, text, text, text, date, text) from public, anon;
grant execute on function public.record_rent_payment(uuid, uuid, jsonb, text, text, text, date, text) to authenticated;

create or replace function public.void_rent_payment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row public.rent_payments;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  select * into v_row from public.rent_payments r where r.id = p_id and r.deleted_at is null;
  if not found then
    raise exception 'payment not found';
  end if;
  if not public.is_business_owner(v_row.payer_business_id) then
    raise exception 'only the payer voids a rent payment';
  end if;
  update public.rent_lines set deleted_at = now(), updated_by = v_user
   where rent_payment_id = v_row.id and deleted_at is null;
  update public.rent_payments set deleted_at = now(), updated_by = v_user where id = v_row.id;
end;
$$;
comment on function public.void_rent_payment(uuid) is 'Take back a rent payment recorded by mistake; its classes become unpaid again.';
revoke execute on function public.void_rent_payment(uuid) from public, anon;
grant execute on function public.void_rent_payment(uuid) to authenticated;
