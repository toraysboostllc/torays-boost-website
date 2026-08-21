-- ============================================================================
-- Microsoldering tag assignment — run AFTER
-- wholesale-microsoldering-tag-assignment-preflight.sql reports OVERALL
-- STATUS PASS
-- ============================================================================
-- Tags exactly 56 EXPLICIT service_id values with the 'microsoldering' tag.
-- Same 56 ids, same breakdown (iPhone 15, iPad 30, Laptops 1, Video Consoles
-- 10, Controllers 0), same list as the preflight — see that file's header
-- for provenance (owner-reviewed CSV export of
-- wholesale-microsoldering-tag-candidates.sql).
--
-- IDEMPOTENT, insert-missing-only: ON CONFLICT (service_id, tag_id) DO
-- NOTHING against wholesale_service_tags' own primary key. Never deletes or
-- replaces any existing tag relationship, on these services or any other —
-- this file contains exactly one INSERT statement and nothing else that
-- writes to the database. Safe to run more than once; a second run inserts
-- zero new rows.
--
-- Wrapped in an explicit transaction with a guard block that re-validates,
-- at migration time (not just at preflight time — DB state could have
-- drifted between the two SQL Editor runs), the same three hard invariants
-- the preflight already checked: the tag exists, all 56 target ids still
-- resolve to real services, and none of them currently belong to
-- Controllers. Any guard failure raises an exception and the whole
-- transaction rolls back — never a partial tag assignment.
-- ============================================================================

begin;

do $$
declare
  v_target_ids uuid[] := array[
    -- iPhone (15)
    'a0f00a68-9ac4-4007-ba41-5cecd4cbbb11', '6721d13b-0a6c-4e98-a3a6-3919f875d118', '0b973865-f8c3-40e1-9336-b341190bb6ec',
    'e974ab6e-678b-4d9e-90f2-2562f2eaa73e', '274402df-7a6f-43f0-becf-8e894117c905', 'e307b624-9782-4572-87cd-b8347ef3f173',
    '793773d3-4eeb-4510-8aa4-68b018219cae', '88463850-bab8-45d7-b25d-c4178d9a12d9', '184e1c3c-e6ea-4350-8212-ccc825d0912a',
    '8fc803f8-c255-4dd7-bfb0-1c7849002b3d', '76f1c27e-2bd6-4862-a697-6c3e44f0d0ac', '1845ff3b-081f-4c85-8b0b-0ed9cda4a00f',
    'fc58450f-6e70-46ce-a97e-7e51ffc0a4b9', '9eb35062-4abd-4317-bef2-7c61d3716f4a', 'b4aa9434-1b1b-41bb-bb0d-a13604d47bfe',
    -- iPad (30)
    '810e5d83-9d4f-4054-88bc-1b4d594df507', '636f607c-9309-4333-b55f-593d828969f8', 'd2b908d0-3b52-44b5-861d-9292eb1d76db',
    '107334b5-c393-4a6e-8a3c-e3a866243941', '49eec112-14d2-4bf2-8b57-3f56af695b59', '422ee991-da3c-4205-a824-55dced29e0e4',
    'f6f55860-7bb8-49cd-bea4-0728297d411a', '1da74cd6-a77d-4241-a7e9-0326c83b86d8', '9c11aad9-05db-4b83-8610-da8f8dd9db74',
    '2ad18346-f573-42e9-9dd3-e598f6bd2af6', '6c14e379-8fda-481b-97db-dc4c97cf0dc6', '4d1e1173-f6d1-46ee-acdf-1ae009369775',
    '1541f85b-b339-4531-9874-0a88dd30f6b9', '074db437-e782-4f15-9c2d-83f12c516ae3', 'bd5b071c-8fb6-441a-a268-c202956a8374',
    'ac6b2d48-d2c9-42fa-a9a0-0343c85ebadd', '46b2b85a-3fda-4351-8337-e2f88ecbc862', '19dba538-6f48-4816-b653-38d281c3a9af',
    '1f3ee4cc-3296-478a-b289-4cdb60886fd7', 'aa5defaa-7447-41e6-a912-893ef7c98ccc', 'c338bb8b-0868-4cad-8fef-ef6edd25d504',
    '376cdb7d-688e-4f59-8a6b-eb2810a4ffdb', '734c6029-697e-4600-86eb-aff7ba4fdcbb', '6f808c14-ad4d-41f4-a244-b5b918cacbc2',
    '69e2c3c8-1f1d-4cc1-8633-f95419b1b865', 'd04e15f2-07f3-4162-ac44-1488c25eeb00', '425e5397-6232-4ea6-a9a8-fd568a6726f0',
    'f316d870-bee9-4364-975e-ea8a6653c483', 'c20368d9-ae49-407b-85ae-c1a91d154fff', '409aa2d3-206c-4f30-ad88-cef2de9699a1',
    -- Laptops (1)
    '57b10620-7b41-4ebe-9020-9f79d42bc84a',
    -- Video Consoles (10)
    'f4fc9f51-84ca-4661-a379-34aa567d868c', '7e7ba07a-adcc-4586-848a-b38b11238597', 'f9ea9e54-247a-48a6-9df9-39468bb3f0e7',
    'f5c0605b-e163-4b3d-bf1e-544c48311ce4', '3f2886b8-1716-4525-a712-d6c681a74a3b', 'e19cdf0a-1de7-456c-8644-f71f5fa6ff7e',
    '44f199ad-8c7a-46ba-8a20-90903ada7fd8', 'ee9dd812-2b16-4442-9ec0-54c6858bf537', 'c68b7f11-353c-4163-b04d-2ef7555ae271',
    '729d78b6-1534-458e-a741-c594a8a8f7d0'
  ]::uuid[];
  v_tag_id uuid;
  v_found_count int;
  v_controllers_count int;
begin
  if array_length(v_target_ids, 1) <> 56 then
    raise exception 'expected exactly 56 target ids in this migration''s own list, found %', array_length(v_target_ids, 1);
  end if;

  select id into v_tag_id from wholesale_tags where slug = 'microsoldering';
  if v_tag_id is null then
    raise exception 'microsoldering_tag_not_found — run the preflight, it must have already failed check 1';
  end if;

  select count(*) into v_found_count from wholesale_services where id = any(v_target_ids);
  if v_found_count <> 56 then
    raise exception 'expected all 56 target ids to resolve to a real wholesale_services row, found %; DB state has drifted since the preflight ran — re-run the preflight before retrying this migration', v_found_count;
  end if;

  select count(*) into v_controllers_count
  from wholesale_services s
  join wholesale_categories c on c.id = s.category_id
  join wholesale_equipment_types et on et.id = c.equipment_type_id
  where s.id = any(v_target_ids) and et.slug = 'controllers';
  if v_controllers_count <> 0 then
    raise exception 'expected 0 of the 56 target ids to belong to Controllers, found % — Controllers is explicitly excluded from this tagging pass', v_controllers_count;
  end if;
end $$;

-- The only write in this file: insert exactly the missing
-- (service_id, tag_id) pairs. ON CONFLICT targets wholesale_service_tags'
-- own primary key (service_id, tag_id) — an id that's already tagged is
-- silently skipped, never touched, never duplicated. No other tag on any
-- of these 56 services (or any other service) is read, written, or removed.
insert into wholesale_service_tags (service_id, tag_id)
select target.service_id, t.id
from unnest(array[
  'a0f00a68-9ac4-4007-ba41-5cecd4cbbb11', '6721d13b-0a6c-4e98-a3a6-3919f875d118', '0b973865-f8c3-40e1-9336-b341190bb6ec',
  'e974ab6e-678b-4d9e-90f2-2562f2eaa73e', '274402df-7a6f-43f0-becf-8e894117c905', 'e307b624-9782-4572-87cd-b8347ef3f173',
  '793773d3-4eeb-4510-8aa4-68b018219cae', '88463850-bab8-45d7-b25d-c4178d9a12d9', '184e1c3c-e6ea-4350-8212-ccc825d0912a',
  '8fc803f8-c255-4dd7-bfb0-1c7849002b3d', '76f1c27e-2bd6-4862-a697-6c3e44f0d0ac', '1845ff3b-081f-4c85-8b0b-0ed9cda4a00f',
  'fc58450f-6e70-46ce-a97e-7e51ffc0a4b9', '9eb35062-4abd-4317-bef2-7c61d3716f4a', 'b4aa9434-1b1b-41bb-bb0d-a13604d47bfe',
  '810e5d83-9d4f-4054-88bc-1b4d594df507', '636f607c-9309-4333-b55f-593d828969f8', 'd2b908d0-3b52-44b5-861d-9292eb1d76db',
  '107334b5-c393-4a6e-8a3c-e3a866243941', '49eec112-14d2-4bf2-8b57-3f56af695b59', '422ee991-da3c-4205-a824-55dced29e0e4',
  'f6f55860-7bb8-49cd-bea4-0728297d411a', '1da74cd6-a77d-4241-a7e9-0326c83b86d8', '9c11aad9-05db-4b83-8610-da8f8dd9db74',
  '2ad18346-f573-42e9-9dd3-e598f6bd2af6', '6c14e379-8fda-481b-97db-dc4c97cf0dc6', '4d1e1173-f6d1-46ee-acdf-1ae009369775',
  '1541f85b-b339-4531-9874-0a88dd30f6b9', '074db437-e782-4f15-9c2d-83f12c516ae3', 'bd5b071c-8fb6-441a-a268-c202956a8374',
  'ac6b2d48-d2c9-42fa-a9a0-0343c85ebadd', '46b2b85a-3fda-4351-8337-e2f88ecbc862', '19dba538-6f48-4816-b653-38d281c3a9af',
  '1f3ee4cc-3296-478a-b289-4cdb60886fd7', 'aa5defaa-7447-41e6-a912-893ef7c98ccc', 'c338bb8b-0868-4cad-8fef-ef6edd25d504',
  '376cdb7d-688e-4f59-8a6b-eb2810a4ffdb', '734c6029-697e-4600-86eb-aff7ba4fdcbb', '6f808c14-ad4d-41f4-a244-b5b918cacbc2',
  '69e2c3c8-1f1d-4cc1-8633-f95419b1b865', 'd04e15f2-07f3-4162-ac44-1488c25eeb00', '425e5397-6232-4ea6-a9a8-fd568a6726f0',
  'f316d870-bee9-4364-975e-ea8a6653c483', 'c20368d9-ae49-407b-85ae-c1a91d154fff', '409aa2d3-206c-4f30-ad88-cef2de9699a1',
  '57b10620-7b41-4ebe-9020-9f79d42bc84a',
  'f4fc9f51-84ca-4661-a379-34aa567d868c', '7e7ba07a-adcc-4586-848a-b38b11238597', 'f9ea9e54-247a-48a6-9df9-39468bb3f0e7',
  'f5c0605b-e163-4b3d-bf1e-544c48311ce4', '3f2886b8-1716-4525-a712-d6c681a74a3b', 'e19cdf0a-1de7-456c-8644-f71f5fa6ff7e',
  '44f199ad-8c7a-46ba-8a20-90903ada7fd8', 'ee9dd812-2b16-4442-9ec0-54c6858bf537', 'c68b7f11-353c-4163-b04d-2ef7555ae271',
  '729d78b6-1534-458e-a741-c594a8a8f7d0'
]::uuid[]) as target(service_id)
cross join (select id from wholesale_tags where slug = 'microsoldering') as t
on conflict (service_id, tag_id) do nothing;

commit;
