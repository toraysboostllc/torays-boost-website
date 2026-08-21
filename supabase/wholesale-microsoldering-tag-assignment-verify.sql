-- ============================================================================
-- Verify — run AFTER wholesale-microsoldering-tag-assignment-migration.sql
-- ============================================================================
-- Confirms the 56 explicit target ids (see the migration/preflight headers
-- for the full list and provenance) now carry the 'microsoldering' tag —
-- exactly those 56, no more, no less — and that Controllers is completely
-- untouched. Entirely read-only.
--
-- Same non-empty-result guarantee as the other files in this session
-- (check_number, check_name, status PASS/FAIL/STOP, details; a zero-rows
-- safety net appended only if the real checks somehow produced none).
-- ============================================================================

with target_list(service_id) as (
  values
    ('a0f00a68-9ac4-4007-ba41-5cecd4cbbb11'::uuid), ('6721d13b-0a6c-4e98-a3a6-3919f875d118'::uuid), ('0b973865-f8c3-40e1-9336-b341190bb6ec'::uuid),
    ('e974ab6e-678b-4d9e-90f2-2562f2eaa73e'::uuid), ('274402df-7a6f-43f0-becf-8e894117c905'::uuid), ('e307b624-9782-4572-87cd-b8347ef3f173'::uuid),
    ('793773d3-4eeb-4510-8aa4-68b018219cae'::uuid), ('88463850-bab8-45d7-b25d-c4178d9a12d9'::uuid), ('184e1c3c-e6ea-4350-8212-ccc825d0912a'::uuid),
    ('8fc803f8-c255-4dd7-bfb0-1c7849002b3d'::uuid), ('76f1c27e-2bd6-4862-a697-6c3e44f0d0ac'::uuid), ('1845ff3b-081f-4c85-8b0b-0ed9cda4a00f'::uuid),
    ('fc58450f-6e70-46ce-a97e-7e51ffc0a4b9'::uuid), ('9eb35062-4abd-4317-bef2-7c61d3716f4a'::uuid), ('b4aa9434-1b1b-41bb-bb0d-a13604d47bfe'::uuid),
    ('810e5d83-9d4f-4054-88bc-1b4d594df507'::uuid), ('636f607c-9309-4333-b55f-593d828969f8'::uuid), ('d2b908d0-3b52-44b5-861d-9292eb1d76db'::uuid),
    ('107334b5-c393-4a6e-8a3c-e3a866243941'::uuid), ('49eec112-14d2-4bf2-8b57-3f56af695b59'::uuid), ('422ee991-da3c-4205-a824-55dced29e0e4'::uuid),
    ('f6f55860-7bb8-49cd-bea4-0728297d411a'::uuid), ('1da74cd6-a77d-4241-a7e9-0326c83b86d8'::uuid), ('9c11aad9-05db-4b83-8610-da8f8dd9db74'::uuid),
    ('2ad18346-f573-42e9-9dd3-e598f6bd2af6'::uuid), ('6c14e379-8fda-481b-97db-dc4c97cf0dc6'::uuid), ('4d1e1173-f6d1-46ee-acdf-1ae009369775'::uuid),
    ('1541f85b-b339-4531-9874-0a88dd30f6b9'::uuid), ('074db437-e782-4f15-9c2d-83f12c516ae3'::uuid), ('bd5b071c-8fb6-441a-a268-c202956a8374'::uuid),
    ('ac6b2d48-d2c9-42fa-a9a0-0343c85ebadd'::uuid), ('46b2b85a-3fda-4351-8337-e2f88ecbc862'::uuid), ('19dba538-6f48-4816-b653-38d281c3a9af'::uuid),
    ('1f3ee4cc-3296-478a-b289-4cdb60886fd7'::uuid), ('aa5defaa-7447-41e6-a912-893ef7c98ccc'::uuid), ('c338bb8b-0868-4cad-8fef-ef6edd25d504'::uuid),
    ('376cdb7d-688e-4f59-8a6b-eb2810a4ffdb'::uuid), ('734c6029-697e-4600-86eb-aff7ba4fdcbb'::uuid), ('6f808c14-ad4d-41f4-a244-b5b918cacbc2'::uuid),
    ('69e2c3c8-1f1d-4cc1-8633-f95419b1b865'::uuid), ('d04e15f2-07f3-4162-ac44-1488c25eeb00'::uuid), ('425e5397-6232-4ea6-a9a8-fd568a6726f0'::uuid),
    ('f316d870-bee9-4364-975e-ea8a6653c483'::uuid), ('c20368d9-ae49-407b-85ae-c1a91d154fff'::uuid), ('409aa2d3-206c-4f30-ad88-cef2de9699a1'::uuid),
    ('57b10620-7b41-4ebe-9020-9f79d42bc84a'::uuid),
    ('f4fc9f51-84ca-4661-a379-34aa567d868c'::uuid), ('7e7ba07a-adcc-4586-848a-b38b11238597'::uuid), ('f9ea9e54-247a-48a6-9df9-39468bb3f0e7'::uuid),
    ('f5c0605b-e163-4b3d-bf1e-544c48311ce4'::uuid), ('3f2886b8-1716-4525-a712-d6c681a74a3b'::uuid), ('e19cdf0a-1de7-456c-8644-f71f5fa6ff7e'::uuid),
    ('44f199ad-8c7a-46ba-8a20-90903ada7fd8'::uuid), ('ee9dd812-2b16-4442-9ec0-54c6858bf537'::uuid), ('c68b7f11-353c-4163-b04d-2ef7555ae271'::uuid),
    ('729d78b6-1534-458e-a741-c594a8a8f7d0'::uuid)
),
tag as (
  select id as tag_id from wholesale_tags where slug = 'microsoldering'
),
tagged_targets as (
  select tl.service_id
  from target_list tl
  join wholesale_service_tags st on st.service_id = tl.service_id and st.tag_id = (select tag_id from tag)
),
all_microsoldering_tagged as (
  select st.service_id
  from wholesale_service_tags st
  where st.tag_id = (select tag_id from tag)
),
group_breakdown as (
  select et.name as equipment_type, count(*) as tagged_count
  from tagged_targets tt
  join wholesale_services s on s.id = tt.service_id
  join wholesale_categories c on c.id = s.category_id
  join wholesale_equipment_types et on et.id = c.equipment_type_id
  group by et.name
),
controllers_tagged as (
  select count(*) as n
  from wholesale_service_tags st
  join wholesale_services s on s.id = st.service_id
  join wholesale_categories c on c.id = s.category_id
  join wholesale_equipment_types et on et.id = c.equipment_type_id
  where st.tag_id = (select tag_id from tag) and et.slug = 'controllers'
),
checks as (
  select 1 as check_number, 'microsoldering_tag_exists' as check_name,
    case when exists (select 1 from tag) then 'PASS' else 'FAIL' end as status,
    'wholesale_tags row with slug=''microsoldering'' ' || case when exists (select 1 from tag) then 'found' else 'NOT FOUND' end as details

  union all

  select 2, 'all_56_targets_now_tagged',
    case when (select count(*) from tagged_targets) = 56 then 'PASS' else 'FAIL' end,
    (select count(*) from tagged_targets) || ' / 56 target ids carry the microsoldering tag — missing: ' || coalesce(
      (select string_agg(tl.service_id::text, ', ') from target_list tl where tl.service_id not in (select service_id from tagged_targets)),
      '(none)'
    )

  union all

  select 3, 'tagged_set_is_exactly_the_56_targets_no_more_no_less',
    case when (select count(*) from all_microsoldering_tagged) = 56 and (select count(*) from tagged_targets) = 56 then 'PASS' else 'FAIL' end,
    'total services carrying the microsoldering tag (anywhere in the database) = ' || (select count(*) from all_microsoldering_tagged)
      || '; of those, in-target = ' || (select count(*) from tagged_targets)
      || ' — both must equal 56 for the tagged set to be EXACTLY the 56 approved targets, nothing extra'

  union all

  select 4, 'controllers_completely_unchanged',
    case when (select n from controllers_tagged) = 0 then 'PASS' else 'FAIL' end,
    'Controllers-owned services carrying the microsoldering tag = ' || (select n from controllers_tagged) || ' — must be 0, Controllers was explicitly excluded'

  union all

  select 5, 'per_group_breakdown_matches_15_30_1_10',
    case when (
      coalesce((select tagged_count from group_breakdown where equipment_type = 'iPhone'), 0) = 15
      and coalesce((select tagged_count from group_breakdown where equipment_type = 'iPad'), 0) = 30
      and coalesce((select tagged_count from group_breakdown where equipment_type = 'Laptops'), 0) = 1
      and coalesce((select tagged_count from group_breakdown where equipment_type = 'Video Consoles'), 0) = 10
    ) then 'PASS' else 'FAIL' end,
    'iPhone=' || coalesce((select tagged_count from group_breakdown where equipment_type = 'iPhone'), 0)
      || ' (expect 15), iPad=' || coalesce((select tagged_count from group_breakdown where equipment_type = 'iPad'), 0)
      || ' (expect 30), Laptops=' || coalesce((select tagged_count from group_breakdown where equipment_type = 'Laptops'), 0)
      || ' (expect 1), Video Consoles=' || coalesce((select tagged_count from group_breakdown where equipment_type = 'Video Consoles'), 0)
      || ' (expect 10)'
),
overall as (
  select case when bool_or(status = 'FAIL') then 'FAIL' else 'PASS' end as status from checks
),
report as (
  select check_number, check_name, status, details from checks
  union all
  select 99, 'OVERALL STATUS', overall.status,
    'PASS = all 56 target services carry the microsoldering tag, exactly those 56 and no others, Controllers '
      || 'untouched. FAIL = read the flagged row(s) above before deciding whether to re-run the migration or '
      || 'investigate.'
  from overall
)
select check_number, check_name, status, details
from report

union all

select 0, 'OVERALL STATUS', 'STOP',
  'ZERO CHECK ROWS WERE RETURNED — this verify produced no results at all, which should never happen under '
    || 'correct execution. Re-run this file with its full, unmodified text selected, in the correct '
    || 'database/schema; if it still returns only this one row, tell Claude before proceeding.'
where not exists (select 1 from report)

order by check_number;
