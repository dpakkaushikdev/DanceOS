-- ══════════════════════════════════════════════════════════════════════════════
-- AN ENQUIRY HAS A TEAM AND PRACTICES (18 Oct 2026) — ⚠ Rule 9 (RLS): three new
-- tables. ⚠ NOT APPLIED; the list goes in front of the user before `db push`.
-- ⚠ No begin/commit (Rule 18): `db push` wraps the file already.
--
-- The user: *"enquiries … should have 3 sections — Payments where quotation
-- history and earnings are there, second to assign team members and
-- participants to that enquiry and 3rd to create enquiry practices for that
-- enquiry. so now practice gets 2 types one for crew and one for enquiries."*
--
--   1. enquiry_people — who is on the job: the business's own TEAM (a live seat
--      on the business, or a confirmed member of the crew asked) and
--      PARTICIPANTS (anybody on DanceOS), each with a role in words.
--   2. enquiry_practices — rehearsals for the job: when, where, a note,
--      scheduled | cancelled. The people told are the enquiry's people.
--   3. enquiry_practice_attendance — the register: one live row = present,
--      undo soft-deletes (Step 10's rule, as crew practices keep it).
--
-- Who may act: whoever may WORK the enquiry (`can_work_enquiry` — an owner or a
-- manager, or a crew's leader). Who may read: every member of the business that
-- was asked (`is_enquiry_member`), and the person themselves. An assigned person
-- reads the enquiry's practices (`is_on_enquiry`) but NOT the enquiry itself —
-- what the client asked and what they pay stays the business's.
--
-- ⚠ It does NOT ride on `crew_practices`: a crew practice belongs to a crew and
-- reads its roster; this belongs to an enquiry and reads its people. Two tables,
-- one grammar.
-- Nothing existing moves: no table, column, policy, grant or function changes.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. who is on the job ─────────────────────────────────────────────────────
create table public.enquiry_people (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.enquiries (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('team', 'participant')),
  role text,
  status text not null default 'assigned' check (status in ('assigned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  /* ⚠ PLAIN UUIDs, NO FOREIGN KEY INTO auth.users (the 19 Sep defect that made
     an account undeletable) */
  created_by uuid not null default auth.uid(),
  updated_by uuid,
  deleted_at timestamptz,
  constraint enquiry_people_role_shape check (role is null or char_length(btrim(role)) between 1 and 40)
);
comment on table public.enquiry_people is
  'Who is on an enquiry''s job: the business''s team and participants from DanceOS, each with a role. Set by the people who work the enquiry; read by the business''s members and the person themselves.';
create unique index enquiry_people_live_unique on public.enquiry_people (enquiry_id, user_id) where deleted_at is null;
create index enquiry_people_user_idx on public.enquiry_people (user_id) where deleted_at is null;
create trigger enquiry_people_set_updated_at before update on public.enquiry_people
  for each row execute function public.set_updated_at();

-- ── 2. rehearsals for the job ────────────────────────────────────────────────
create table public.enquiry_practices (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.enquiries (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  place text not null,
  note text,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid(),
  updated_by uuid,
  deleted_at timestamptz,
  constraint enquiry_practices_ends_after_start check (ends_at > starts_at),
  constraint enquiry_practices_place_shape check (char_length(btrim(place)) between 1 and 120),
  constraint enquiry_practices_note_shape check (note is null or char_length(note) <= 280)
);
comment on table public.enquiry_practices is
  'A rehearsal for an enquiry''s job. Created by whoever works the enquiry; the enquiry''s people are told. Not public.';
create index enquiry_practices_enquiry_idx on public.enquiry_practices (enquiry_id, starts_at) where deleted_at is null;
create trigger enquiry_practices_set_updated_at before update on public.enquiry_practices
  for each row execute function public.set_updated_at();

-- ── 3. who turned up ─────────────────────────────────────────────────────────
create table public.enquiry_practice_attendance (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references public.enquiry_practices (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid(),
  updated_by uuid,
  deleted_at timestamptz
);
comment on table public.enquiry_practice_attendance is
  'Who turned up to an enquiry practice. One live row per person = present; undo soft-deletes.';
create unique index enquiry_practice_attendance_live_unique on public.enquiry_practice_attendance (practice_id, user_id) where deleted_at is null;
create trigger enquiry_practice_attendance_set_updated_at before update on public.enquiry_practice_attendance
  for each row execute function public.set_updated_at();

-- ── a helper the policies share ──────────────────────────────────────────────
-- ⚠ SECURITY DEFINER so a policy on enquiry_practices does not recurse through
-- enquiry_people's own policies (42P17).
create or replace function public.is_on_enquiry(p_enquiry_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.enquiry_people p
    where p.enquiry_id = p_enquiry_id and p.user_id = auth.uid() and p.deleted_at is null
  );
$$;
comment on function public.is_on_enquiry(uuid) is
  'Is the caller assigned to this enquiry''s job? Lets them read its practices.';
revoke execute on function public.is_on_enquiry(uuid) from public, anon;
grant execute on function public.is_on_enquiry(uuid) to authenticated;

-- ── RLS — select only; every change goes through the functions ───────────────
alter table public.enquiry_people enable row level security;
alter table public.enquiry_practices enable row level security;
alter table public.enquiry_practice_attendance enable row level security;

revoke all on public.enquiry_people from anon, authenticated;
revoke all on public.enquiry_practices from anon, authenticated;
revoke all on public.enquiry_practice_attendance from anon, authenticated;
grant select on public.enquiry_people to authenticated;
grant select on public.enquiry_practices to authenticated;
grant select on public.enquiry_practice_attendance to authenticated;

create policy "the business reads an enquiry's people" on public.enquiry_people for select to authenticated
  using (public.is_enquiry_member(enquiry_id));
create policy "people read their own enquiry rows" on public.enquiry_people for select to authenticated
  using (user_id = auth.uid());

create policy "the business and its people read enquiry practices" on public.enquiry_practices for select to authenticated
  using (deleted_at is null and (public.is_enquiry_member(enquiry_id) or public.is_on_enquiry(enquiry_id)));

create policy "the business reads enquiry practice attendance" on public.enquiry_practice_attendance for select to authenticated
  using (exists (
    select 1 from public.enquiry_practices p
    where p.id = enquiry_practice_attendance.practice_id and p.deleted_at is null and public.is_enquiry_member(p.enquiry_id)
  ));
create policy "people read their own enquiry practice attendance" on public.enquiry_practice_attendance for select to authenticated
  using (user_id = auth.uid());

-- ── add_enquiry_person ───────────────────────────────────────────────────────
create or replace function public.add_enquiry_person(
  p_enquiry_id uuid,
  p_user_id uuid,
  p_kind text,
  p_role text default null
)
returns public.enquiry_people
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_e public.enquiries;
  v_row public.enquiry_people;
  v_role text := nullif(btrim(coalesce(p_role, '')), '');
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.can_work_enquiry(p_enquiry_id) then
    raise exception 'only its owners and managers can put people on this enquiry';
  end if;
  select * into v_e from public.enquiries where id = p_enquiry_id and deleted_at is null;
  if v_e.status in ('completed', 'declined', 'withdrawn', 'called_off', 'lost', 'cancelled') then
    raise exception 'this enquiry is closed';
  end if;
  if p_kind not in ('team', 'participant') then
    raise exception 'a person is on the team or a participant';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id and p.deleted_at is null) then
    raise exception 'that person is not on DanceOS';
  end if;
  if p_kind = 'team' and not (
       (v_e.business_id is not null and exists (
          select 1 from public.business_members m
          where m.business_id = v_e.business_id and m.user_id = p_user_id and m.deleted_at is null))
    or (v_e.crew_id is not null and (
          exists (select 1 from public.crews c where c.id = v_e.crew_id and c.leader_id = p_user_id and c.deleted_at is null)
          or exists (select 1 from public.crew_members cm where cm.crew_id = v_e.crew_id and cm.user_id = p_user_id
                       and cm.status = 'confirmed' and cm.deleted_at is null)))
  ) then
    raise exception 'only somebody on your team can be added as team — add them as a participant';
  end if;
  if v_e.from_user_id = p_user_id then
    raise exception 'the person who sent the enquiry cannot be put on its job';
  end if;
  if exists (select 1 from public.enquiry_people x where x.enquiry_id = p_enquiry_id and x.user_id = p_user_id and x.deleted_at is null) then
    -- already on it: the role and the kind are what move
    update public.enquiry_people
       set kind = p_kind, role = v_role, updated_by = auth.uid()
     where enquiry_id = p_enquiry_id and user_id = p_user_id and deleted_at is null
     returning * into v_row;
    return v_row;
  end if;

  insert into public.enquiry_people (enquiry_id, user_id, kind, role, updated_by)
  values (p_enquiry_id, p_user_id, p_kind, v_role, auth.uid())
  returning * into v_row;

  if p_user_id <> auth.uid() then
    perform public.notify(
      p_user_id, 'enquiry',
      'You are on a job',
      coalesce(v_role || ' · ', '') || 'for ' || coalesce((select b.name from public.businesses b where b.id = v_e.business_id),
                                                            (select c.name from public.crews c where c.id = v_e.crew_id), 'an enquiry'),
      case when p_kind = 'team' then '/inbox/enquiries/' || p_enquiry_id::text else null end);
  end if;
  return v_row;
end;
$$;
revoke execute on function public.add_enquiry_person(uuid, uuid, text, text) from public, anon;
grant execute on function public.add_enquiry_person(uuid, uuid, text, text) to authenticated;

-- ── remove_enquiry_person ────────────────────────────────────────────────────
create or replace function public.remove_enquiry_person(p_person_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.enquiry_people;
begin
  select * into v_row from public.enquiry_people where id = p_person_id and deleted_at is null;
  if not found then
    raise exception 'that person is not on this enquiry';
  end if;
  if not public.can_work_enquiry(v_row.enquiry_id) then
    raise exception 'only its owners and managers can take people off this enquiry';
  end if;
  update public.enquiry_people set deleted_at = now(), updated_by = auth.uid() where id = p_person_id;
end;
$$;
revoke execute on function public.remove_enquiry_person(uuid) from public, anon;
grant execute on function public.remove_enquiry_person(uuid) to authenticated;

-- ── save_enquiry_practice — create or edit; the enquiry's people are told ────
create or replace function public.save_enquiry_practice(
  p_enquiry_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_place text,
  p_note text default null,
  p_practice_id uuid default null
)
returns public.enquiry_practices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_e public.enquiries;
  v_row public.enquiry_practices;
  v_title text;
  v_p record;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.can_work_enquiry(p_enquiry_id) then
    raise exception 'only its owners and managers can arrange a practice';
  end if;
  select * into v_e from public.enquiries where id = p_enquiry_id and deleted_at is null;
  if v_e.status in ('completed', 'declined', 'withdrawn', 'called_off', 'lost', 'cancelled') then
    raise exception 'this enquiry is closed';
  end if;
  if p_ends_at <= p_starts_at then
    raise exception 'a practice ends after it starts';
  end if;
  if p_place is null or char_length(btrim(p_place)) = 0 then
    raise exception 'say where the practice is';
  end if;

  if p_practice_id is null then
    insert into public.enquiry_practices (enquiry_id, starts_at, ends_at, place, note, updated_by)
    values (p_enquiry_id, p_starts_at, p_ends_at, btrim(p_place), nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
    returning * into v_row;
    v_title := 'Practice for a job';
  else
    update public.enquiry_practices
       set starts_at = p_starts_at, ends_at = p_ends_at, place = btrim(p_place),
           note = nullif(btrim(coalesce(p_note, '')), ''), updated_by = auth.uid()
     where id = p_practice_id and enquiry_id = p_enquiry_id and deleted_at is null and status = 'scheduled'
     returning * into v_row;
    if not found then
      raise exception 'that practice is not open to change';
    end if;
    v_title := 'A practice moved';
  end if;

  for v_p in
    select x.user_id, x.kind from public.enquiry_people x
     where x.enquiry_id = p_enquiry_id and x.deleted_at is null and x.user_id <> auth.uid()
  loop
    perform public.notify(
      v_p.user_id, 'enquiry', v_title,
      to_char(v_row.starts_at at time zone 'Asia/Kolkata', 'Dy DD Mon · HH12:MI am') || ' · ' || v_row.place,
      case when v_p.kind = 'team' then '/inbox/enquiries/' || p_enquiry_id::text || '?show=practices' else null end);
  end loop;
  return v_row;
end;
$$;
revoke execute on function public.save_enquiry_practice(uuid, timestamptz, timestamptz, text, text, uuid) from public, anon;
grant execute on function public.save_enquiry_practice(uuid, timestamptz, timestamptz, text, text, uuid) to authenticated;

-- ── cancel_enquiry_practice — a STATUS, never a delete ───────────────────────
create or replace function public.cancel_enquiry_practice(p_practice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.enquiry_practices;
  v_p record;
begin
  select * into v_row from public.enquiry_practices where id = p_practice_id and deleted_at is null;
  if not found then
    raise exception 'that practice is not there';
  end if;
  if not public.can_work_enquiry(v_row.enquiry_id) then
    raise exception 'only its owners and managers can call a practice off';
  end if;
  if v_row.status = 'cancelled' then
    return;
  end if;
  update public.enquiry_practices set status = 'cancelled', updated_by = auth.uid() where id = p_practice_id;
  for v_p in
    select x.user_id, x.kind from public.enquiry_people x
     where x.enquiry_id = v_row.enquiry_id and x.deleted_at is null and x.user_id <> auth.uid()
  loop
    perform public.notify(
      v_p.user_id, 'enquiry', 'A practice is called off',
      to_char(v_row.starts_at at time zone 'Asia/Kolkata', 'Dy DD Mon · HH12:MI am') || ' · ' || v_row.place,
      case when v_p.kind = 'team' then '/inbox/enquiries/' || v_row.enquiry_id::text || '?show=practices' else null end);
  end loop;
end;
$$;
revoke execute on function public.cancel_enquiry_practice(uuid) from public, anon;
grant execute on function public.cancel_enquiry_practice(uuid) to authenticated;

-- ── the register ─────────────────────────────────────────────────────────────
create or replace function public.check_in_enquiry_practice(p_practice_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.enquiry_practices;
begin
  select * into v_row from public.enquiry_practices where id = p_practice_id and deleted_at is null;
  if not found then
    raise exception 'that practice is not there';
  end if;
  if not public.can_work_enquiry(v_row.enquiry_id) then
    raise exception 'only its owners and managers run this register';
  end if;
  if v_row.status <> 'scheduled' then
    raise exception 'this practice was called off';
  end if;
  if not exists (select 1 from public.enquiry_people x where x.enquiry_id = v_row.enquiry_id and x.user_id = p_user_id and x.deleted_at is null) then
    raise exception 'that person is not on this enquiry';
  end if;
  if exists (select 1 from public.enquiry_practice_attendance a where a.practice_id = p_practice_id and a.user_id = p_user_id and a.deleted_at is null) then
    return; -- already in: pressing twice is one attendance
  end if;
  insert into public.enquiry_practice_attendance (practice_id, user_id, updated_by) values (p_practice_id, p_user_id, auth.uid());
end;
$$;
revoke execute on function public.check_in_enquiry_practice(uuid, uuid) from public, anon;
grant execute on function public.check_in_enquiry_practice(uuid, uuid) to authenticated;

create or replace function public.undo_enquiry_practice_check_in(p_practice_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.enquiry_practices;
begin
  select * into v_row from public.enquiry_practices where id = p_practice_id and deleted_at is null;
  if not found then
    raise exception 'that practice is not there';
  end if;
  if not public.can_work_enquiry(v_row.enquiry_id) then
    raise exception 'only its owners and managers run this register';
  end if;
  update public.enquiry_practice_attendance set deleted_at = now(), updated_by = auth.uid()
   where practice_id = p_practice_id and user_id = p_user_id and deleted_at is null;
end;
$$;
revoke execute on function public.undo_enquiry_practice_check_in(uuid, uuid) from public, anon;
grant execute on function public.undo_enquiry_practice_check_in(uuid, uuid) to authenticated;
