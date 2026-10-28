-- A PRACTICE'S "WHERE" IS A NAME AND A LINK (29 Oct 2026, the user: "where in
-- add practice form should be a link and there should be an option to name it
-- as well").
--
-- The NAME is the `place` column both practice tables have always had (free
-- text, required). The LINK is new: `place_url`, an http(s) address — a map pin
-- in practice — optional, and set by ONE new door so not one existing function
-- is re-typed (save_crew_practice, save_enquiry_practice, my_crew_practices and
-- my_enquiry_practices are untouched; the app reads the column directly under
-- the SELECT policies those tables already carry).
--
-- ⚠ Setting a link moves nothing anybody is told about: notify_practice_moved
-- compares starts_at, place and status only. No `begin;`/`commit;` (Rule 18).

alter table public.crew_practices add column if not exists place_url text;
alter table public.enquiry_practices add column if not exists place_url text;

alter table public.crew_practices
  add constraint crew_practices_place_url_is_a_web_link
  check (place_url is null or (char_length(place_url) <= 500 and place_url ~* '^https?://[^[:space:]]+$'));
alter table public.enquiry_practices
  add constraint enquiry_practices_place_url_is_a_web_link
  check (place_url is null or (char_length(place_url) <= 500 and place_url ~* '^https?://[^[:space:]]+$'));

comment on column public.crew_practices.place_url is
  'Where the practice is, as a link (a map pin). `place` is its name. Set through set_practice_link.';
comment on column public.enquiry_practices.place_url is
  'Where the practice is, as a link (a map pin). `place` is its name. Set through set_practice_link.';

create or replace function public.set_practice_link(p_kind text, p_practice_id uuid, p_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := nullif(btrim(coalesce(p_url, '')), '');
  v_enquiry uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if v_url is not null and v_url !~* '^https?://[^[:space:]]+$' then
    raise exception 'a link starts with http:// or https://';
  end if;

  if p_kind = 'crew' then
    if not public.leads_practice(p_practice_id) then
      raise exception 'only the person who leads this crew can change its practice';
    end if;
    update public.crew_practices set place_url = v_url
     where id = p_practice_id and deleted_at is null;
  elsif p_kind = 'job' then
    select enquiry_id into v_enquiry from public.enquiry_practices
     where id = p_practice_id and deleted_at is null;
    if v_enquiry is null or not public.can_work_enquiry(v_enquiry) then
      raise exception 'only its owners and managers can change this practice';
    end if;
    update public.enquiry_practices set place_url = v_url, updated_by = auth.uid()
     where id = p_practice_id and deleted_at is null;
  else
    raise exception 'a practice is a crew''s or a job''s';
  end if;
end;
$$;

comment on function public.set_practice_link(text, uuid, text) is
  'Sets or clears a practice''s place link — the crew''s leader for a crew practice, an enquiry''s owners and managers for a job practice.';
revoke execute on function public.set_practice_link(text, uuid, text) from public, anon;
grant execute on function public.set_practice_link(text, uuid, text) to authenticated;
