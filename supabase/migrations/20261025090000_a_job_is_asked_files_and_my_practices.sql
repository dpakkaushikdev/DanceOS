-- ══════════════════════════════════════════════════════════════════════════════
-- A JOB IS ASKED, AN ENQUIRY HAS FILES, AND A PERSON'S ENQUIRY PRACTICES ARE ONE
-- READ (18 Oct 2026) — ⚠ Rule 9 (RLS): one new table, one widened CHECK, five
-- bodies re-stated from 20261024090000 with one change each, four new functions.
-- ⚠ No begin/commit (Rule 18).
--
-- The user: *"finish all still open points … enquiry details should also have a
-- section called files for adding links for music, videos, or document, pics.
-- only in link format … fix practices as you mentioned"* — the two still-open
-- points were: a person was put on a job with no ask, and enquiry practices
-- lived on the enquiry page only (not the Practice tool, not the calendar).
--
--   1. enquiry_people.status is asked | confirmed | declined. A new person is
--      ASKED (yourself: confirmed at once); `respond_to_enquiry_job` is theirs
--      alone; a no closes the row (soft delete, status kept). The one live row
--      on production ('assigned') becomes 'confirmed' — it was put there
--      before asking existed.
--   2. Only CONFIRMED people are told about practices, read them, and can be
--      checked in (`is_on_enquiry`, save/cancel/check-in re-stated).
--   3. `my_enquiry_jobs()` — the caller's own asks and jobs, with who asked, so
--      somebody can answer WITHOUT reading the enquiry (what the client asked
--      and pays stays the business's — the 24 Oct rule kept).
--   4. `my_enquiry_practices(from, to)` — every enquiry practice the caller runs
--      or is confirmed on, for the Practice tool and the calendar.
--   5. `enquiry_files` — links only (http/https), a kind (music · video ·
--      document · photo · link) and a label; read by the business's members and
--      the sender; added by either end; removed by whoever added it or whoever
--      works the enquiry.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. asked → confirmed | declined ──────────────────────────────────────────
alter table public.enquiry_people drop constraint enquiry_people_status_check;
update public.enquiry_people set status = 'confirmed' where status = 'assigned';
alter table public.enquiry_people
  add constraint enquiry_people_status_check check (status in ('asked', 'confirmed', 'declined'));
alter table public.enquiry_people alter column status set default 'asked';

-- ── 2. only a confirmed person is "on" the job ───────────────────────────────
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
      and p.status = 'confirmed'
  );
$$;

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
    -- already asked or on it: the role and the kind are what move
    update public.enquiry_people
       set kind = p_kind, role = v_role, updated_by = auth.uid()
     where enquiry_id = p_enquiry_id and user_id = p_user_id and deleted_at is null
     returning * into v_row;
    return v_row;
  end if;

  insert into public.enquiry_people (enquiry_id, user_id, kind, role, status, updated_by)
  values (p_enquiry_id, p_user_id, p_kind, v_role,
          case when p_user_id = auth.uid() then 'confirmed' else 'asked' end, auth.uid())
  returning * into v_row;

  if p_user_id <> auth.uid() then
    perform public.notify(
      p_user_id, 'enquiry',
      'You are asked onto a job',
      coalesce(v_role || ' · ', '') || 'for ' || coalesce((select b.name from public.businesses b where b.id = v_e.business_id),
                                                            (select c.name from public.crews c where c.id = v_e.crew_id), 'an enquiry')
        || ' — say yes or no in Enquiries',
      '/inbox?show=jobs');
  end if;
  return v_row;
end;
$$;

-- ── 3. the person answers ────────────────────────────────────────────────────
create or replace function public.respond_to_enquiry_job(p_person_id uuid, p_accept boolean)
returns public.enquiry_people
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.enquiry_people;
  v_e public.enquiries;
  v_who text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select * into v_row from public.enquiry_people where id = p_person_id and deleted_at is null;
  if not found or v_row.user_id <> auth.uid() then
    raise exception 'that ask is not yours to answer';
  end if;
  if v_row.status <> 'asked' then
    raise exception 'that ask is already answered';
  end if;
  if p_accept then
    update public.enquiry_people set status = 'confirmed', updated_by = auth.uid() where id = p_person_id returning * into v_row;
  else
    update public.enquiry_people set status = 'declined', deleted_at = now(), updated_by = auth.uid() where id = p_person_id returning * into v_row;
  end if;

  select * into v_e from public.enquiries where id = v_row.enquiry_id;
  select coalesce(nullif(btrim(p.full_name), ''), 'Somebody') into v_who from public.profiles p where p.id = auth.uid();
  if v_e.business_id is not null then
    perform public.notify_business_owners(
      v_e.business_id, 'enquiry',
      case when p_accept then v_who || ' is on the job' else v_who || ' said no to the job' end,
      coalesce(v_row.role, case when v_row.kind = 'team' then 'Team' else 'Participant' end),
      '/inbox/enquiries/' || v_e.id::text || '?show=team');
  elsif v_e.crew_id is not null then
    perform public.notify(
      (select c.leader_id from public.crews c where c.id = v_e.crew_id), 'enquiry',
      case when p_accept then v_who || ' is on the job' else v_who || ' said no to the job' end,
      coalesce(v_row.role, case when v_row.kind = 'team' then 'Team' else 'Participant' end),
      '/inbox/enquiries/' || v_e.id::text || '?show=team');
  end if;
  return v_row;
end;
$$;
revoke execute on function public.respond_to_enquiry_job(uuid, boolean) from public, anon;
grant execute on function public.respond_to_enquiry_job(uuid, boolean) to authenticated;

-- ── 4. practices: only confirmed people are told and checked in ──────────────
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
    select x.user_id from public.enquiry_people x
     where x.enquiry_id = p_enquiry_id and x.deleted_at is null and x.status = 'confirmed' and x.user_id <> auth.uid()
  loop
    perform public.notify(
      v_p.user_id, 'enquiry', v_title,
      to_char(v_row.starts_at at time zone 'Asia/Kolkata', 'Dy DD Mon · HH12:MI am') || ' · ' || v_row.place,
      '/practice/job/' || v_row.id::text);
  end loop;
  return v_row;
end;
$$;

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
    select x.user_id from public.enquiry_people x
     where x.enquiry_id = v_row.enquiry_id and x.deleted_at is null and x.status = 'confirmed' and x.user_id <> auth.uid()
  loop
    perform public.notify(
      v_p.user_id, 'enquiry', 'A practice is called off',
      to_char(v_row.starts_at at time zone 'Asia/Kolkata', 'Dy DD Mon · HH12:MI am') || ' · ' || v_row.place,
      '/practice/job/' || v_row.id::text);
  end loop;
end;
$$;

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
  if not exists (select 1 from public.enquiry_people x where x.enquiry_id = v_row.enquiry_id and x.user_id = p_user_id
                   and x.deleted_at is null and x.status = 'confirmed') then
    raise exception 'that person has not said yes to this job';
  end if;
  if exists (select 1 from public.enquiry_practice_attendance a where a.practice_id = p_practice_id and a.user_id = p_user_id and a.deleted_at is null) then
    return; -- already in: pressing twice is one attendance
  end if;
  insert into public.enquiry_practice_attendance (practice_id, user_id, updated_by) values (p_practice_id, p_user_id, auth.uid());
end;
$$;

-- ── 5. my asks and my jobs ───────────────────────────────────────────────────
create or replace function public.my_enquiry_jobs()
returns table (
  id uuid, enquiry_id uuid, kind text, role text, status text, created_at timestamptz,
  host_name text, host_photo_path text, type_key text, first_date date
)
language sql
security definer
set search_path = ''
stable
as $$
  select p.id, p.enquiry_id, p.kind, p.role, p.status, p.created_at,
         coalesce(b.name, c.name), coalesce(b.profile_photo_path, c.photo), e.type_key,
         (select min(d) from unnest(e.dates) d)
    from public.enquiry_people p
    join public.enquiries e on e.id = p.enquiry_id and e.deleted_at is null
    left join public.businesses b on b.id = e.business_id
    left join public.crews c on c.id = e.crew_id
   where p.user_id = auth.uid() and p.deleted_at is null and p.status in ('asked', 'confirmed')
   order by (p.status = 'asked') desc, p.created_at desc
   limit 200;
$$;
revoke execute on function public.my_enquiry_jobs() from public, anon;
grant execute on function public.my_enquiry_jobs() to authenticated;

-- ── 6. every enquiry practice the caller runs or is confirmed on ─────────────
create or replace function public.my_enquiry_practices(p_from timestamptz, p_to timestamptz)
returns table (
  id uuid, enquiry_id uuid, starts_at timestamptz, ends_at timestamptz, place text, note text, status text,
  host_name text, host_photo_path text, type_key text, my_part text, people integer, checked_in integer
)
language sql
security definer
set search_path = ''
stable
as $$
  select pr.id, pr.enquiry_id, pr.starts_at, pr.ends_at, pr.place, pr.note, pr.status,
         coalesce(b.name, c.name), coalesce(b.profile_photo_path, c.photo), e.type_key,
         case when public.can_work_enquiry(e.id) then 'runs'
              else (select x.kind from public.enquiry_people x where x.enquiry_id = e.id and x.user_id = auth.uid()
                      and x.deleted_at is null and x.status = 'confirmed' limit 1) end,
         (select count(*)::int from public.enquiry_people x where x.enquiry_id = e.id and x.deleted_at is null and x.status = 'confirmed'),
         (select count(*)::int from public.enquiry_practice_attendance a where a.practice_id = pr.id and a.deleted_at is null)
    from public.enquiry_practices pr
    join public.enquiries e on e.id = pr.enquiry_id and e.deleted_at is null
    left join public.businesses b on b.id = e.business_id
    left join public.crews c on c.id = e.crew_id
   where pr.deleted_at is null
     and pr.starts_at < p_to and pr.ends_at > p_from
     and (public.can_work_enquiry(e.id) or public.is_on_enquiry(e.id))
   order by pr.starts_at
   limit 400;
$$;
revoke execute on function public.my_enquiry_practices(timestamptz, timestamptz) from public, anon;
grant execute on function public.my_enquiry_practices(timestamptz, timestamptz) to authenticated;

-- ── 7. files: links only ─────────────────────────────────────────────────────
create table public.enquiry_files (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.enquiries (id) on delete cascade,
  kind text not null check (kind in ('music', 'video', 'document', 'photo', 'link')),
  label text not null,
  url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  /* ⚠ PLAIN UUIDs, NO FOREIGN KEY INTO auth.users (19 Sep) */
  created_by uuid not null default auth.uid(),
  updated_by uuid,
  deleted_at timestamptz,
  constraint enquiry_files_label_shape check (char_length(btrim(label)) between 1 and 80),
  constraint enquiry_files_url_shape check (url ~* '^https?://[^\s]+$' and char_length(url) <= 600)
);
comment on table public.enquiry_files is
  'Links shared on an enquiry — music, video, a document, photos — never an upload. Read by the business''s members and the sender; added by either end.';
create index enquiry_files_enquiry_idx on public.enquiry_files (enquiry_id, created_at) where deleted_at is null;
create trigger enquiry_files_set_updated_at before update on public.enquiry_files
  for each row execute function public.set_updated_at();

create or replace function public.is_enquiry_end(p_enquiry_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select public.is_enquiry_member(p_enquiry_id)
      or exists (select 1 from public.enquiries e where e.id = p_enquiry_id and e.from_user_id = auth.uid() and e.deleted_at is null);
$$;
comment on function public.is_enquiry_end(uuid) is 'Is the caller either end of this enquiry — the business''s member, or the person who sent it?';
revoke execute on function public.is_enquiry_end(uuid) from public, anon;
grant execute on function public.is_enquiry_end(uuid) to authenticated;

alter table public.enquiry_files enable row level security;
revoke all on public.enquiry_files from anon, authenticated;
grant select on public.enquiry_files to authenticated;
create policy "either end reads an enquiry's files" on public.enquiry_files for select to authenticated
  using (deleted_at is null and public.is_enquiry_end(enquiry_id));

create or replace function public.add_enquiry_file(p_enquiry_id uuid, p_kind text, p_label text, p_url text)
returns public.enquiry_files
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_e public.enquiries;
  v_row public.enquiry_files;
  v_url text := btrim(coalesce(p_url, ''));
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select * into v_e from public.enquiries where id = p_enquiry_id and deleted_at is null;
  if not found then
    raise exception 'that enquiry is not there';
  end if;
  if not (public.can_work_enquiry(p_enquiry_id) or v_e.from_user_id = auth.uid()) then
    raise exception 'only the two ends of this enquiry can add a link';
  end if;
  if p_kind not in ('music', 'video', 'document', 'photo', 'link') then
    raise exception 'a link is music, a video, a document, photos or a link';
  end if;
  if v_url !~* '^https?://[^\s]+$' or char_length(v_url) > 600 then
    raise exception 'that is not a web link — it must start with http:// or https://';
  end if;
  if char_length(btrim(coalesce(p_label, ''))) not between 1 and 80 then
    raise exception 'give the link a name (up to 80 characters)';
  end if;
  insert into public.enquiry_files (enquiry_id, kind, label, url, updated_by)
  values (p_enquiry_id, p_kind, btrim(p_label), v_url, auth.uid())
  returning * into v_row;

  if v_e.from_user_id = auth.uid() then
    if v_e.business_id is not null then
      perform public.notify_business_owners(v_e.business_id, 'enquiry', 'A link was added to an enquiry', btrim(p_label),
        '/inbox/enquiries/' || p_enquiry_id::text || '?show=files');
    elsif v_e.crew_id is not null then
      perform public.notify((select c.leader_id from public.crews c where c.id = v_e.crew_id), 'enquiry',
        'A link was added to an enquiry', btrim(p_label), '/inbox/enquiries/' || p_enquiry_id::text || '?show=files');
    end if;
  else
    perform public.notify(v_e.from_user_id, 'enquiry', 'A link was added to your enquiry', btrim(p_label),
      '/inbox/enquiries/' || p_enquiry_id::text || '?show=files');
  end if;
  return v_row;
end;
$$;
revoke execute on function public.add_enquiry_file(uuid, text, text, text) from public, anon;
grant execute on function public.add_enquiry_file(uuid, text, text, text) to authenticated;

create or replace function public.remove_enquiry_file(p_file_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.enquiry_files;
begin
  select * into v_row from public.enquiry_files where id = p_file_id and deleted_at is null;
  if not found then
    raise exception 'that link is not there';
  end if;
  if not (v_row.created_by = auth.uid() or public.can_work_enquiry(v_row.enquiry_id)) then
    raise exception 'only whoever added it, or whoever works the enquiry, can take a link down';
  end if;
  update public.enquiry_files set deleted_at = now(), updated_by = auth.uid() where id = p_file_id;
end;
$$;
revoke execute on function public.remove_enquiry_file(uuid) from public, anon;
grant execute on function public.remove_enquiry_file(uuid) to authenticated;
