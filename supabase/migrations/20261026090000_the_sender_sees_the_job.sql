-- THE PERSON WHO SENT AN ENQUIRY SEES ITS JOB, AND MAY BRING PARTICIPANTS
-- (18 Oct 2026, the user: "team and practices should be visible to the person
-- sending the enquiry. participants can be added by the person sending the
-- enquiry").
--
-- The whole of it:
--   1. three SELECT policies, so the SENDER reads their own enquiry's people,
--      its practices and their attendance (until now: the business's members
--      and the confirmed people on the job only). `is_enquiry_end` is the
--      existing definer helper — the business's member OR the sender — so no
--      policy reads `enquiries` under the caller's RLS and nothing can recurse.
--   2. `add_enquiry_person` — edited out of the catalog by asserted anchor:
--      the sender may add a PARTICIPANT (never team — the team is the
--      business's to choose), and may not re-label somebody already on it.
--   3. `remove_enquiry_person` — edited the same way: the sender may take off a
--      participant THEY added.
-- No table, column, row, grant or signature moves. Nothing is backfilled.
-- ⚠ No `begin;`/`commit;` (Rule 18).

create function public._dos_swap(p_def text, p_from text, p_to text, p_fn text, p_expect integer default 1) returns text
language plpgsql as $fn$
declare v_n integer;
begin
  p_from := replace(p_from, E'\r', '');
  p_to := replace(p_to, E'\r', '');
  v_n := (length(p_def) - length(replace(p_def, p_from, ''))) / length(p_from);
  if v_n <> p_expect then
    raise exception 'anchor found % times in %, expected %: %', v_n, p_fn, p_expect, left(p_from, 80);
  end if;
  return replace(p_def, p_from, p_to);
end;
$fn$;

-- ── 1 · the sender reads the job ────────────────────────────────────────────
create policy "the sender reads their enquiry's people" on public.enquiry_people for select to authenticated
  using (deleted_at is null and public.is_enquiry_end(enquiry_id));

create policy "the sender reads their enquiry's practices" on public.enquiry_practices for select to authenticated
  using (deleted_at is null and public.is_enquiry_end(enquiry_id));

create policy "the sender reads their enquiry's practice attendance" on public.enquiry_practice_attendance for select to authenticated
  using (exists (
    select 1 from public.enquiry_practices p
    where p.id = enquiry_practice_attendance.practice_id and p.deleted_at is null and public.is_enquiry_end(p.enquiry_id)
  ));

-- ── 2 · the sender brings participants ──────────────────────────────────────
do $do$
declare d text;
begin
  select pg_get_functiondef('public.add_enquiry_person(uuid,uuid,text,text)'::regprocedure) into d;
  d := public._dos_swap(d,
    $a$  if not public.can_work_enquiry(p_enquiry_id) then
    raise exception 'only its owners and managers can put people on this enquiry';
  end if;
  select * into v_e from public.enquiries where id = p_enquiry_id and deleted_at is null;$a$,
    $a$  select * into v_e from public.enquiries where id = p_enquiry_id and deleted_at is null;
  if not found then
    raise exception 'that enquiry is gone';
  end if;
  -- 18 Oct 2026: the person who SENT it may bring participants, never team
  if not public.can_work_enquiry(p_enquiry_id) then
    if v_e.from_user_id is distinct from auth.uid() then
      raise exception 'only its owners and managers, or the person who sent it, can put people on this enquiry';
    end if;
    if p_kind is distinct from 'participant' then
      raise exception 'you can add participants — the team is theirs to choose';
    end if;
    if exists (select 1 from public.enquiry_people x where x.enquiry_id = p_enquiry_id and x.user_id = p_user_id and x.deleted_at is null) then
      raise exception 'they are already on this job';
    end if;
  end if;$a$, 'add_enquiry_person');
  execute d;

  select pg_get_functiondef('public.remove_enquiry_person(uuid)'::regprocedure) into d;
  d := public._dos_swap(d,
    $a$  if not public.can_work_enquiry(v_row.enquiry_id) then
    raise exception 'only its owners and managers can take people off this enquiry';
  end if;$a$,
    $a$  if not public.can_work_enquiry(v_row.enquiry_id) and not (
       v_row.kind = 'participant' and v_row.created_by = auth.uid()
       and exists (select 1 from public.enquiries e where e.id = v_row.enquiry_id and e.from_user_id = auth.uid() and e.deleted_at is null)
  ) then
    raise exception 'only its owners and managers, or the person who added them, can take people off this enquiry';
  end if;$a$, 'remove_enquiry_person');
  execute d;
end;
$do$;

drop function public._dos_swap(text, text, text, text, integer);
