-- THE SENDER IS ON A JOB PRACTICE'S REGISTER (18 Oct 2026)
--
-- The user: "job practice should show register with both team and participants
-- and the person who created enquiry should also be there."
--
-- `20261026090000` already lets the SENDER read the enquiry's people, practices
-- and practice attendance. Two definer functions still left them out:
--
--   1. my_enquiry_practices — the sender had no row, so their own practice page
--      was "not found", their Practice tool did not list the job and the calendar
--      did not carry it. The sender now gets every practice of an enquiry they
--      sent, with my_part 'sender'. Same signature, same grants.
--   2. check_in_enquiry_practice — the runner could check in only a CONFIRMED
--      enquiry_people row, so the sender could never be marked present. The
--      enquiry's own sender is admitted too. Same signature, same grants.
--
-- Nothing else moves: no table, column, policy or grant. undo_ needs no change
-- (it never tested who the person is). No begin/commit (Rule 18).

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
              when e.from_user_id = auth.uid() then 'sender'
              else (select x.kind from public.enquiry_people x where x.enquiry_id = e.id and x.user_id = auth.uid()
                      and x.deleted_at is null and x.status = 'confirmed' limit 1) end,
         (select count(*)::int from public.enquiry_people x where x.enquiry_id = e.id and x.deleted_at is null and x.status = 'confirmed')
           + case when e.from_user_id is not null then 1 else 0 end,
         (select count(*)::int from public.enquiry_practice_attendance a where a.practice_id = pr.id and a.deleted_at is null)
    from public.enquiry_practices pr
    join public.enquiries e on e.id = pr.enquiry_id and e.deleted_at is null
    left join public.businesses b on b.id = e.business_id
    left join public.crews c on c.id = e.crew_id
   where pr.deleted_at is null
     and pr.starts_at < p_to and pr.ends_at > p_from
     and (public.can_work_enquiry(e.id) or public.is_on_enquiry(e.id) or e.from_user_id = auth.uid())
   order by pr.starts_at
   limit 400;
$$;
revoke execute on function public.my_enquiry_practices(timestamptz, timestamptz) from public, anon;
grant execute on function public.my_enquiry_practices(timestamptz, timestamptz) to authenticated;

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
                   and x.deleted_at is null and x.status = 'confirmed')
     and not exists (select 1 from public.enquiries e where e.id = v_row.enquiry_id and e.from_user_id = p_user_id and e.deleted_at is null) then
    raise exception 'that person has not said yes to this job';
  end if;
  if exists (select 1 from public.enquiry_practice_attendance a where a.practice_id = p_practice_id and a.user_id = p_user_id and a.deleted_at is null) then
    return; -- already in: pressing twice is one attendance
  end if;
  insert into public.enquiry_practice_attendance (practice_id, user_id, updated_by) values (p_practice_id, p_user_id, auth.uid());
end;
$$;
revoke execute on function public.check_in_enquiry_practice(uuid, uuid) from public, anon;
grant execute on function public.check_in_enquiry_practice(uuid, uuid) to authenticated;
