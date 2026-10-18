-- RENT AS A LUMP SUM, AND A DISPUTE PER ENTRY (19 Oct 2026).
--
-- The user, 19 Oct 2026: "pay rent should also have pay an amount as total", and
-- earlier (18 Oct): "find proper mechanisms for dispute against these payments as
-- well entry wise will make it easier to dispute then" and "should give total
-- properly while paying or disputing".
--
-- ⚠ No begin;/commit; (Rule 18) — db push wraps the file.
--
-- 1. record_rent_amount: an artist's page pays a studio a lump sum, not against
--    any class. record_rent_payment refuses a payment with no classes, so this is
--    its twin with no lines. The same gates: the payer's OWNER, never your own
--    studio, and only a studio that has held (accepted) one of your classes.
--
-- 2. payment_disputes: one dispute per ENTRY. An entry is a class line or an
--    enquiry line of a team payment, a class line of a rent payment, or — when a
--    payment carries no lines (a lump sum) — the payment itself. Raised by the
--    person paid (a team payment) or the studio's owner (rent); answered by the
--    payer's owner (accept · reject, with words); withdrawn by whoever raised it.
--    One open dispute per entry. It records the disagreement — it moves no money,
--    the same rule every payment here keeps.
--
-- Nothing existing moves: no column, no policy and no function body is touched.

-- ── 1. rent as a lump sum ──────────────────────────────────────────────────
create or replace function public.record_rent_amount(
  p_payer_business_id uuid,
  p_venue_business_id uuid,
  p_amount_inr integer,
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
  if p_amount_inr is null or p_amount_inr < 1 or p_amount_inr > 100000000 then
    raise exception 'type what you are paying';
  end if;
  if p_status not in ('done', 'in_transit', 'on_hold', 'failed') then
    raise exception 'invalid status';
  end if;
  if p_method not in ('bank_transfer', 'upi', 'cash', 'other') then
    raise exception 'invalid method';
  end if;
  if not exists (
    select 1 from public.classes c
     where c.business_id = p_payer_business_id
       and c.venue_business_id = p_venue_business_id
       and c.venue_status = 'accepted'
       and c.deleted_at is null
  ) then
    raise exception 'you have not held a class in this studio';
  end if;

  insert into public.rent_payments (payer_business_id, venue_business_id, amount_inr, status, method,
                                    provider_ref, paid_on, note, created_by, updated_by)
  values (p_payer_business_id, p_venue_business_id, p_amount_inr, p_status, p_method,
          nullif(trim(coalesce(p_provider_ref, '')), ''),
          coalesce(p_paid_on, current_date), nullif(trim(coalesce(p_note, '')), ''),
          v_user, v_user)
  returning * into v_row;
  return v_row;
end;
$$;
comment on function public.record_rent_amount(uuid, uuid, integer, text, text, text, date, text) is
  'An artist''s page pays a studio rent as a lump sum, not against any class (19 Oct 2026). Only a studio that has held one of its classes.';
revoke execute on function public.record_rent_amount(uuid, uuid, integer, text, text, text, date, text) from public, anon;
grant execute on function public.record_rent_amount(uuid, uuid, integer, text, text, text, date, text) to authenticated;

-- ── 2. disputes, one per entry ─────────────────────────────────────────────
create table public.payment_disputes (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  -- the entry: a payout_lines / payout_enquiry_lines / rent_lines row, or the
  -- payout / rent payment itself when it carries no lines
  target_id uuid not null,
  payout_id uuid references public.payouts (id) on delete cascade,
  rent_payment_id uuid references public.rent_payments (id) on delete cascade,
  -- who answers it: the business that paid
  payer_business_id uuid not null references public.businesses (id) on delete cascade,
  -- the studio paid rent, when it is rent
  venue_business_id uuid references public.businesses (id) on delete cascade,
  -- what that entry was paid at, as recorded when the dispute was raised
  amount_inr integer not null,
  -- what the person raising it says it should have been (optional)
  claimed_inr integer,
  reason text not null,
  status text not null default 'open',
  response text,
  answered_at timestamptz,
  answered_by uuid,
  raised_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null,
  updated_by uuid not null,
  deleted_at timestamptz,
  constraint payment_disputes_kind check (kind in ('payout_line', 'payout_enquiry_line', 'payout', 'rent_line', 'rent_payment')),
  constraint payment_disputes_status check (status in ('open', 'accepted', 'rejected', 'withdrawn')),
  constraint payment_disputes_reason check (char_length(btrim(reason)) between 3 and 300),
  constraint payment_disputes_response check (response is null or char_length(response) <= 300),
  constraint payment_disputes_amount check (amount_inr >= 0),
  constraint payment_disputes_claimed check (claimed_inr is null or (claimed_inr >= 0 and claimed_inr <= 100000000)),
  constraint payment_disputes_one_payment check (
    (kind in ('payout_line', 'payout_enquiry_line', 'payout') and payout_id is not null and rent_payment_id is null)
    or (kind in ('rent_line', 'rent_payment') and rent_payment_id is not null and payout_id is null and venue_business_id is not null)
  )
);
comment on table public.payment_disputes is
  'One dispute per payment ENTRY (19 Oct 2026): raised by the person paid or the studio paid rent, answered by the payer. Records the disagreement; moves no money. Written only by raise/answer/withdraw_payment_dispute.';
create unique index payment_disputes_one_open on public.payment_disputes (kind, target_id)
  where status = 'open' and deleted_at is null;
create index payment_disputes_payout on public.payment_disputes (payout_id) where deleted_at is null;
create index payment_disputes_rent on public.payment_disputes (rent_payment_id) where deleted_at is null;
create index payment_disputes_payer on public.payment_disputes (payer_business_id) where deleted_at is null;
create index payment_disputes_raiser on public.payment_disputes (raised_by) where deleted_at is null;
create trigger payment_disputes_set_updated_at before update on public.payment_disputes
  for each row execute function public.set_updated_at();

alter table public.payment_disputes enable row level security;
revoke all on public.payment_disputes from anon, authenticated;
grant select on public.payment_disputes to authenticated;
create policy "the two ends read a dispute" on public.payment_disputes for select to authenticated
  using (
    raised_by = (select auth.uid())
    or public.is_business_owner(payer_business_id)
    or (venue_business_id is not null and public.is_business_owner(venue_business_id))
  );

create or replace function public.raise_payment_dispute(
  p_kind text,
  p_target_id uuid,
  p_reason text,
  p_claimed_inr integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_payout public.payouts;
  v_rent public.rent_payments;
  v_amount integer;
  v_id uuid;
  v_payer uuid;
  v_payer_name text;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'say what is wrong';
  end if;
  if char_length(btrim(p_reason)) > 300 then
    raise exception 'keep it under 300 characters';
  end if;
  if p_claimed_inr is not null and (p_claimed_inr < 0 or p_claimed_inr > 100000000) then
    raise exception 'that amount is not possible';
  end if;

  if p_kind = 'payout_line' then
    select p.* into v_payout from public.payout_lines l join public.payouts p on p.id = l.payout_id
     where l.id = p_target_id and l.deleted_at is null and p.deleted_at is null;
    if not found then raise exception 'that entry is not on record'; end if;
    select l.rate_inr into v_amount from public.payout_lines l where l.id = p_target_id;
  elsif p_kind = 'payout_enquiry_line' then
    select p.* into v_payout from public.payout_enquiry_lines l join public.payouts p on p.id = l.payout_id
     where l.id = p_target_id and l.deleted_at is null and p.deleted_at is null;
    if not found then raise exception 'that entry is not on record'; end if;
    select l.rate_inr into v_amount from public.payout_enquiry_lines l where l.id = p_target_id;
  elsif p_kind = 'payout' then
    select p.* into v_payout from public.payouts p where p.id = p_target_id and p.deleted_at is null;
    if not found then raise exception 'that payment is not on record'; end if;
    if exists (select 1 from public.payout_lines l where l.payout_id = v_payout.id and l.deleted_at is null)
       or exists (select 1 from public.payout_enquiry_lines l where l.payout_id = v_payout.id and l.deleted_at is null) then
      raise exception 'dispute the entry, not the whole payment';
    end if;
    v_amount := v_payout.amount_inr;
  elsif p_kind = 'rent_line' then
    select r.* into v_rent from public.rent_lines l join public.rent_payments r on r.id = l.rent_payment_id
     where l.id = p_target_id and l.deleted_at is null and r.deleted_at is null;
    if not found then raise exception 'that entry is not on record'; end if;
    select l.rate_inr into v_amount from public.rent_lines l where l.id = p_target_id;
  elsif p_kind = 'rent_payment' then
    select r.* into v_rent from public.rent_payments r where r.id = p_target_id and r.deleted_at is null;
    if not found then raise exception 'that payment is not on record'; end if;
    if exists (select 1 from public.rent_lines l where l.rent_payment_id = v_rent.id and l.deleted_at is null) then
      raise exception 'dispute the entry, not the whole payment';
    end if;
    v_amount := v_rent.amount_inr;
  else
    raise exception 'invalid kind';
  end if;

  if v_payout.id is not null then
    if v_payout.user_id <> v_user then
      raise exception 'only the person paid disputes a payment';
    end if;
    v_payer := v_payout.business_id;
  else
    if not public.is_business_owner(v_rent.venue_business_id) then
      raise exception 'only the studio paid disputes its rent';
    end if;
    v_payer := v_rent.payer_business_id;
  end if;

  if exists (select 1 from public.payment_disputes d
              where d.kind = p_kind and d.target_id = p_target_id and d.status = 'open' and d.deleted_at is null) then
    raise exception 'that entry is already disputed';
  end if;

  insert into public.payment_disputes (kind, target_id, payout_id, rent_payment_id, payer_business_id,
                                       venue_business_id, amount_inr, claimed_inr, reason, raised_by,
                                       created_by, updated_by)
  values (p_kind, p_target_id, v_payout.id, v_rent.id, v_payer, v_rent.venue_business_id,
          coalesce(v_amount, 0), p_claimed_inr, btrim(p_reason), v_user, v_user, v_user)
  returning id into v_id;

  select b.name into v_payer_name from public.businesses b where b.id = v_payer;
  perform public.notify_business_owners(
    v_payer, 'money',
    'A payment is disputed',
    case when v_rent.id is not null then 'A studio disputes rent you recorded: ' else 'Somebody you paid disputes an entry: ' end || btrim(p_reason),
    '/business/' || v_payer || '/staff'
  );
  return v_id;
end;
$$;
comment on function public.raise_payment_dispute(text, uuid, text, integer) is
  'Dispute one payment entry (19 Oct 2026): the person paid (team pay) or the studio''s owner (rent). One open dispute per entry.';
revoke execute on function public.raise_payment_dispute(text, uuid, text, integer) from public, anon;
grant execute on function public.raise_payment_dispute(text, uuid, text, integer) to authenticated;

create or replace function public.answer_payment_dispute(p_id uuid, p_accept boolean, p_response text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row public.payment_disputes;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  select * into v_row from public.payment_disputes d where d.id = p_id and d.deleted_at is null;
  if not found then
    raise exception 'dispute not found';
  end if;
  if not public.is_business_owner(v_row.payer_business_id) then
    raise exception 'only the payer answers a dispute';
  end if;
  if v_row.status <> 'open' then
    raise exception 'that dispute is already answered';
  end if;
  if p_accept is null then
    raise exception 'accept or reject it';
  end if;
  if p_response is not null and char_length(p_response) > 300 then
    raise exception 'keep it under 300 characters';
  end if;
  update public.payment_disputes
     set status = case when p_accept then 'accepted' else 'rejected' end,
         response = nullif(btrim(coalesce(p_response, '')), ''),
         answered_at = now(), answered_by = v_user, updated_by = v_user
   where id = p_id;
  perform public.notify(
    v_row.raised_by, 'money',
    case when p_accept then 'Your dispute was accepted' else 'Your dispute was rejected' end,
    coalesce(nullif(btrim(coalesce(p_response, '')), ''), 'Open it to see the entry.'),
    case when v_row.venue_business_id is not null then '/business/' || v_row.venue_business_id || '/staff' else '/team?show=other' end
  );
end;
$$;
comment on function public.answer_payment_dispute(uuid, boolean, text) is 'The payer accepts or rejects a dispute, with words (19 Oct 2026). Moves no money.';
revoke execute on function public.answer_payment_dispute(uuid, boolean, text) from public, anon;
grant execute on function public.answer_payment_dispute(uuid, boolean, text) to authenticated;

create or replace function public.withdraw_payment_dispute(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row public.payment_disputes;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  select * into v_row from public.payment_disputes d where d.id = p_id and d.deleted_at is null;
  if not found then
    raise exception 'dispute not found';
  end if;
  if v_row.raised_by <> v_user then
    raise exception 'only whoever raised it withdraws it';
  end if;
  if v_row.status <> 'open' then
    raise exception 'that dispute is already answered';
  end if;
  update public.payment_disputes set status = 'withdrawn', updated_by = v_user where id = p_id;
end;
$$;
comment on function public.withdraw_payment_dispute(uuid) is 'Take back a dispute you raised while it is still open (19 Oct 2026).';
revoke execute on function public.withdraw_payment_dispute(uuid) from public, anon;
grant execute on function public.withdraw_payment_dispute(uuid) to authenticated;
