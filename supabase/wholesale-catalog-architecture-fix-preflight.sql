-- ============================================================================
-- Preflight — run BEFORE wholesale-catalog-architecture-fix-migration.sql
-- ============================================================================
-- Confirms the current (post-dynamic-equipment-types, post-microsoldering-
-- tag-assignment) real state matches what the forward-only correction
-- migration assumes, before it runs. Entirely read-only.
--
-- RESULT CONTRACT (same convention as every other preflight this round):
--   check_number integer, check_name text, status text ('PASS'/'FAIL'/'STOP'),
--   details text. check_number 99 is the final OVERALL STATUS row. A
--   synthetic OVERALL STATUS/STOP row is appended ONLY if the real checks
--   below somehow produced zero rows (see wholesale-dynamic-equipment-types-
--   preflight.sql's header for the full rationale — same pattern, reused
--   here rather than re-explained).
-- ============================================================================

with raw as (
  select
    exists (select 1 from information_schema.tables where table_schema='public' and table_name='wholesale_equipment_types') as et_table_exists,
    exists (select 1 from information_schema.tables where table_schema='public' and table_name='wholesale_categories') as cat_table_exists,
    exists (select 1 from information_schema.tables where table_schema='public' and table_name='wholesale_services') as svc_table_exists,
    exists (select 1 from information_schema.tables where table_schema='public' and table_name='wholesale_service_tags') as tags_table_exists,
    exists (select 1 from information_schema.tables where table_schema='public' and table_name='wholesale_images') as images_table_exists,
    exists (select 1 from information_schema.columns where table_schema='public' and table_name='wholesale_equipment_types' and column_name='catalog_mode') as catalog_mode_already_exists,
    exists (select 1 from information_schema.columns where table_schema='public' and table_name='wholesale_services' and column_name='name_es') as service_name_es_already_exists,
    exists (select 1 from information_schema.columns where table_schema='public' and table_name='wholesale_services' and column_name='description_en') as description_en_already_exists,
    exists (select 1 from information_schema.columns where table_schema='public' and table_name='wholesale_services' and column_name='description_es') as description_es_already_exists,
    exists (select 1 from pg_indexes where indexname = 'uq_wholesale_images_service') as service_image_index_already_exists,
    (select id from wholesale_equipment_types where slug = 'microsoldering') as microsoldering_id,
    (select id from wholesale_equipment_types where slug = 'macbook') as macbook_id,
    (select id from wholesale_equipment_types where slug = 'laptops') as laptops_id,
    (select active from wholesale_equipment_types where slug = 'macbook') as macbook_currently_active,
    (select is_tag_lens from wholesale_equipment_types where slug = 'microsoldering') as microsoldering_currently_tag_lens
),
target56 as (
  select unnest(array[
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
  ]::uuid[]) as service_id
),
currently_tagged as (
  select st.service_id
  from wholesale_service_tags st
  join wholesale_tags tag on tag.id = st.tag_id and tag.slug = 'microsoldering'
),
tag_set_diff as (
  select
    (select count(*) from target56 t where not exists (select 1 from currently_tagged c where c.service_id = t.service_id)) as missing_count,
    (select count(*) from currently_tagged c where not exists (select 1 from target56 t where t.service_id = c.service_id)) as extra_count,
    (select count(*) from currently_tagged) as total_tagged_count
),
macbook_categories_current as (
  select c.slug, c.name, c.id, et.slug as current_equipment_type_slug,
    (select count(*) from wholesale_services s where s.category_id = c.id) as service_count
  from wholesale_categories c
  left join wholesale_equipment_types et on et.id = c.equipment_type_id
  where c.slug in ('macbook-air', 'macbook-pro')
),
laptops_categories_current as (
  select c.slug, c.name, et.slug as current_equipment_type_slug,
    (select count(*) from wholesale_services s where s.category_id = c.id and s.active) as active_service_count
  from wholesale_categories c
  left join wholesale_equipment_types et on et.id = c.equipment_type_id
  where c.slug in ('laptops-normal', 'laptops-gamer')
),
full_listing as (
  select string_agg(
    slug || ' (name=' || name || ', active=' || active || ', sort_order=' || sort_order || ', is_tag_lens=' || is_tag_lens || ')',
    E'\n' order by sort_order, name
  ) as listing
  from wholesale_equipment_types
),
photo_snapshot as (
  select
    (select count(*) from wholesale_images where equipment_type_id = raw.macbook_id) as macbook_photo_count,
    (select count(*) from wholesale_images where equipment_type_id = raw.laptops_id) as laptops_photo_count
  from raw
),
target9_slugs as (
  select unnest(array['microsoldering','iphone','ipad','macbook','laptops','ps5','xbox-series-x','switch','controllers']) as slug
),
checks as (
  select 1 as check_number, 'prerequisite_tables_exist' as check_name,
    case when et_table_exists and cat_table_exists and svc_table_exists and tags_table_exists and images_table_exists then 'PASS' else 'FAIL' end as status,
    'equipment_types=' || et_table_exists || ', categories=' || cat_table_exists || ', services=' || svc_table_exists
      || ', service_tags=' || tags_table_exists || ', images=' || images_table_exists
      as details
  from raw

  union all

  select 2, 'new_columns_and_index_not_already_present (READ BY HAND)',
    'PASS',
    case when not (catalog_mode_already_exists or service_name_es_already_exists or description_en_already_exists or description_es_already_exists or service_image_index_already_exists)
      then '' else 'REVIEW REQUIRED — ' end
      || 'catalog_mode=' || catalog_mode_already_exists || ', services.name_es=' || service_name_es_already_exists
      || ', description_en=' || description_en_already_exists || ', description_es=' || description_es_already_exists
      || ', uq_wholesale_images_service=' || service_image_index_already_exists
      || ' — expect all false on a first run; every add is "if not exists" / constraint-drop-then-add, so a re-run is safe regardless'
  from raw

  union all

  select 3, 'microsoldering_and_macbook_and_laptops_equipment_types_found',
    case when microsoldering_id is not null and macbook_id is not null and laptops_id is not null then 'PASS' else 'FAIL' end,
    'microsoldering=' || coalesce(microsoldering_id::text, 'NOT FOUND') || ', macbook=' || coalesce(macbook_id::text, 'NOT FOUND')
      || ', laptops=' || coalesce(laptops_id::text, 'NOT FOUND')
      || ' — all 3 must exist as rows for this migration''s hardcoded slug references to resolve'
  from raw

  union all

  select 4, 'macbook_currently_inactive_and_microsoldering_currently_tag_lens (informational)',
    'PASS',
    'macbook.active=' || coalesce(macbook_currently_active::text, 'NULL') || ' (expect false, pre-fix)'
      || ', microsoldering.is_tag_lens=' || coalesce(microsoldering_currently_tag_lens::text, 'NULL') || ' (expect true, pre-fix)'
      || ' — informational only; the migration sets both unconditionally regardless of current value, so this is not blocking'
  from raw

  union all

  select 5, 'microsoldering_tag_set_matches_target_exactly',
    case when missing_count = 0 and extra_count = 0 then 'PASS' else 'STOP' end,
    'total_currently_tagged=' || total_tagged_count || ' (target=56), missing=' || missing_count || ', extra=' || extra_count
      || ' — the CURRENT microsoldering tag set must be EXACTLY the 56 known target ids (56/56 present, 0 missing, 0 '
      || 'extra) before the migration blindly retracts only those 56 by id. missing > 0 means one or more of the known '
      || '56 was untagged since the prior verified assignment (the DELETE would then silently no-op on it, but a '
      || 'mismatch this specific means something changed manually and needs investigating first). extra > 0 means '
      || 'some OTHER service is ALSO carrying the microsoldering tag — the migration would leave it (and the tag '
      || 'mechanism, which this fix decommissions) not fully retired. Any difference is real drift since the last '
      || 'verified state — investigate and resolve it before running the migration; do not proceed on STOP.'
  from tag_set_diff

  union all

  select 6, 'macbook_air_pro_categories_resolve_to_laptops_or_macbook',
    case when (
      select count(*) from macbook_categories_current where current_equipment_type_slug in ('laptops', 'macbook')
    ) = 2 then 'PASS' else 'FAIL' end,
    coalesce(
      (select string_agg(slug || ' -> ' || coalesce(current_equipment_type_slug, 'NULL') || ' (services=' || service_count || ')', ', ' order by slug) from macbook_categories_current),
      '(neither macbook-air nor macbook-pro found at all)'
    ) || ' — both must currently resolve to either ''laptops'' (the wrong post-migration state, expected) or ''macbook'' '
      || '(already correct) for the re-point step to safely apply; anything else means unexpected drift — investigate before running the migration.'

  union all

  select 7, 'laptops_own_categories_resolve_as_expected',
    case when (
      select current_equipment_type_slug from laptops_categories_current where slug = 'laptops-normal'
    ) = 'laptops' and (
      select current_equipment_type_slug from laptops_categories_current where slug = 'laptops-gamer'
    ) in ('gaming-laptops', 'laptops')
    then 'PASS' else 'FAIL' end,
    coalesce(
      (select string_agg(slug || ' -> ' || coalesce(current_equipment_type_slug, 'NULL') || ' (active_services=' || active_service_count || ')', ', ' order by slug) from laptops_categories_current),
      '(neither laptops-normal nor laptops-gamer found at all)'
    ) || ' — laptops-normal must resolve to ''laptops'' (this migration never touches it). laptops-gamer must resolve '
      || 'to either ''gaming-laptops'' (the real pre-existing state this fix corrects — see the migration file''s own '
      || 'header) or already ''laptops'' (already fixed); anything else means unexpected drift.'

  union all

  select 8, 'photo_ownership_snapshot (READ BY HAND)',
    'PASS',
    (select 'macbook photos=' || macbook_photo_count || ', laptops photos=' || laptops_photo_count from photo_snapshot)
      || ' — this migration does NOT move any photo automatically (see its own header for why). If macbook''s original '
      || 'photo ended up on laptops during the prior wrong migration and you want it back on MacBook specifically, do '
      || 'that from DESK after this migration runs — it is a content decision, not something this file infers.'

  union all

  select 9, 'final_9_card_target_slugs_all_exist',
    case when (
      select count(*) from target9_slugs ts
      where exists (select 1 from wholesale_equipment_types et where et.slug = ts.slug)
    ) = 9 then 'PASS' else 'FAIL' end,
    'of the 9 target slugs [microsoldering, iphone, ipad, macbook, laptops, ps5, xbox-series-x, switch, controllers], '
      || (select count(*) from target9_slugs ts where exists (select 1 from wholesale_equipment_types et where et.slug = ts.slug))
      || ' / 9 resolve to a real row — missing: ' || coalesce(
        (select string_agg(ts.slug, ', ') from target9_slugs ts where not exists (select 1 from wholesale_equipment_types et where et.slug = ts.slug)),
        '(none)'
      )

  union all

  select 10, 'current_equipment_types_snapshot (READ BY HAND)',
    'PASS',
    (select listing from full_listing)
),
overall as (
  select
    case
      when bool_or(status = 'STOP') then 'STOP'
      when bool_or(status = 'FAIL') then 'FAIL'
      else 'PASS'
    end as status
  from checks
),
report as (
  select check_number, check_name, status, details from checks
  union all
  select 99, 'OVERALL STATUS', overall.status,
    'PASS = safe to run wholesale-catalog-architecture-fix-migration.sql as-is. STOP = do NOT run the migration under '
      || 'any circumstances — check 5 (the microsoldering tag-set exact-match gate) or the zero-rows safety net fired; '
      || 'this is real drift since the last verified state and must be resolved first. FAIL = fix/investigate the '
      || 'flagged row(s) first. Read every ''(READ BY HAND)'' row (2, 8, 10) regardless of overall status; check 8 in '
      || 'particular is a content decision, never automated.'
  from overall
)
select check_number, check_name, status, details
from report

union all

select 0, 'OVERALL STATUS', 'STOP',
  'ZERO CHECK ROWS WERE RETURNED — this preflight produced no results at all, which should never happen under '
    || 'correct execution. Treat this as NO-GO/STOP: do NOT run the migration. Re-run this file with its full, '
    || 'unmodified text selected, in the correct database/schema; if it still returns only this one row, tell '
    || 'Claude before proceeding.'
where not exists (select 1 from report)

order by check_number;
