-- A NAME IS FIFTEEN CHARACTERS AT MOST (19 Oct 2026)
--
-- The user: "fix word limit for all kinds of names and should not be more than
-- 15 letters in any case." Asked, they chose: spaces count, the database keeps
-- the rule too, and the names already longer are shortened now — the list of
-- renames below was put in front of them and approved as listed.
--
-- 1 · THE APPROVED RENAMES, by id (the live rows over 15 on 19 Oct 2026).
-- 2 · A FALLBACK for any LIVE row a test run made since that list was read:
--     cut to 15 and trimmed, and counted in a NOTICE, so the CHECKs below can
--     never fail to add. Soft-deleted rows are not touched.
-- 3 · TEN CHECKs, one per name column:
--       deleted_at is not null or char_length(btrim(col)) <= 15
--     A soft-deleted row is exempt, so soft-deleting an old long row still works.
--     The existing "at least one character" CHECKs are kept as they are.
--
-- Nothing else moves: no function, no policy, no grant.
-- ⚠ No begin;/commit; — db push wraps the file (Rule 18).

-- 1 · the approved renames ─────────────────────────────────────────────────

update public.profiles set full_name = v.n
from (values
  ('c49ab3bd-a8cf-4ace-9d72-6a73de7cc81e'::uuid, 'Deepak User'),
  ('b9556d97-5d0c-438b-b2ce-6ce7417546cc'::uuid, 'EEE Dance Co'),
  ('a6ff91f5-4cd3-416b-92aa-8760f30decac'::uuid, 'Bounce Academy'),
  ('bd3087f2-1d4e-453b-af80-61b7e23c11fa'::uuid, 'Rhythm Co'),
  ('9619f4e5-7cf2-40a6-ab47-c46fb36a79e2'::uuid, 'Proof Owner'),
  ('af49ce74-f6cd-47f4-9492-3b2a36b1ccad'::uuid, 'Proof Learner')
) as v(id, n)
where profiles.id = v.id;

update public.businesses set name = v.n
from (values
  ('e73aa0e4-7082-4d38-b691-98cbb9414c7c'::uuid, 'EEE Studio'),
  ('ae54c5eb-c135-4652-8eef-a419b5627073'::uuid, 'Rhea Kapoor'),
  ('ea191764-e3ba-4a6d-938d-c5fdc1531034'::uuid, 'Namma Studio'),
  ('c2339e7d-6d4c-4f1c-b170-2424653e9bd7'::uuid, 'Rhythm Sec 29'),
  ('3ddd15d4-dfef-4b18-8a2f-da951db889e2'::uuid, 'Rhythm DLF 3'),
  ('02160505-acc8-45e1-8484-7ee5f6117acd'::uuid, 'Bounce Academy'),
  ('0bdc9975-6636-4986-9e7c-c5cda43dd470'::uuid, 'Karan Breaking'),
  ('04b341eb-a7a1-4aad-953a-2fe31e616ffc'::uuid, 'Aditya Movement'),
  ('80876bcf-3344-4c7d-a666-5f4092fd54b6'::uuid, 'Meera Grewal Co')
) as v(id, n)
where businesses.id = v.id;

update public.crews set name = v.n
from (values
  ('56a66980-2a89-4a0b-832c-069c6ec0f5c2'::uuid, 'GGN Rockers'),
  ('73203edd-a597-49ae-aef3-84f0607669a4'::uuid, 'Step Up SCMS')
) as v(id, n)
where crews.id = v.id;

update public.routines set title = v.n
from (values
  ('1b2f87cb-b563-4854-9666-c2aed1303f7e'::uuid, 'Tarana Bhairavi'),
  ('937acbbb-b3ac-49be-9912-1039b8ec7937'::uuid, 'Kala Chashma'),
  ('0b2acb60-9e6e-4b03-ae40-81f14e12fcde'::uuid, 'Cypher Basics'),
  ('c53745ec-52b9-4575-9131-19897706634e'::uuid, 'Winter Piece'),
  ('9b165f6f-8a1e-4cc5-8d4c-b56d3c4c17e8'::uuid, 'Breath+Release'),
  ('b27027b9-8e8e-4e54-8172-182bbf030a59'::uuid, 'E2E Routine'),
  ('e928699a-9e8b-4d4d-a408-8e262835d76b'::uuid, 'E2E Routine')
) as v(id, n)
where routines.id = v.id;

update public.memberships set name = 'Shoot Pass'
where id = '73cbb7d3-d120-49b7-b00f-6815248ee28e';

update public.business_invites set name = 'E2E Trainer'
where id in (
  '7c2710bc-a8c5-4a21-9ba1-b697d3bfd972',
  'f52c2493-4f4a-4534-89b7-e9f24faa5b7b',
  'e5cb0cbb-cb85-40b6-a281-897b76524a53',
  'fc4c1197-09d5-4b06-bd4d-d56bdfcd8dc4',
  '3d053586-847e-494d-b374-119b304d9862',
  'b03d447d-aeed-4394-b00e-c22e86974480',
  '18011fcd-b78b-45b7-8727-d96acd4c3581',
  'b7a35e84-764c-4b61-9748-d22b1df6dfe4'
);

-- 2 · the fallback, then 3 · the CHECKs ──────────────────────────────────────

do $$
declare
  t record;
  n integer;
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
    execute format(
      'update public.%I set %I = btrim(left(btrim(%I), 15))
         where deleted_at is null and %I is not null and char_length(btrim(%I)) > 15',
      t.tbl, t.col, t.col, t.col, t.col);
    get diagnostics n = row_count;
    if n > 0 then
      raise notice 'shortened % live %.% value(s) the approved list did not name', n, t.tbl, t.col;
    end if;

    execute format(
      'alter table public.%I add constraint %I check (deleted_at is not null or %I is null or char_length(btrim(%I)) <= 15)',
      t.tbl, t.tbl || '_' || t.col || '_fits', t.col, t.col);
    execute format(
      'comment on constraint %I on public.%I is %L',
      t.tbl || '_' || t.col || '_fits', t.tbl,
      'A name is 15 characters at most, spaces included (19 Oct 2026). Soft-deleted rows are exempt.');
  end loop;
end $$;
