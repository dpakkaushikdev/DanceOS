-- A NAME IS 25 CHARACTERS (19 Oct 2026, the user: "character names increase to 25").
--
-- 20261030090000 put ten CHECKs `<table>_<col>_fits` at 15 characters. This
-- widens each to 25 — a loosening only: every row that passed 15 passes 25, and
-- nothing is rewritten. Soft-deleted rows stay exempt. No function, policy,
-- grant or row moves. (No begin/commit: db push wraps the file — Rule 18.)

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('profiles',         'full_name'),
      ('businesses',       'name'),
      ('crews',            'name'),
      ('rooms',            'name'),
      ('assets',           'name'),
      ('memberships',      'name'),
      ('routines',         'title'),
      ('class_bookings',   'attendee_name'),
      ('leads',            'name'),
      ('business_invites', 'name')
    ) as x(tbl, col)
  loop
    execute format('alter table public.%I drop constraint if exists %I', t.tbl, t.tbl || '_' || t.col || '_fits');
    execute format(
      'alter table public.%I add constraint %I check (deleted_at is not null or %I is null or char_length(btrim(%I)) <= 25)',
      t.tbl, t.tbl || '_' || t.col || '_fits', t.col, t.col);
    execute format(
      'comment on constraint %I on public.%I is %L',
      t.tbl || '_' || t.col || '_fits', t.tbl,
      'A name is 25 characters at most, spaces included (widened from 15 on 19 Oct 2026). Soft-deleted rows are exempt.');
  end loop;
end $$;
