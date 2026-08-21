-- ============================================================================
-- Preflight — run BEFORE wholesale-microsoldering-tag-assignment-migration.sql
-- ============================================================================
-- Scoped, one-off data operation: tag exactly 56 EXPLICIT service_id values
-- (never a name/category match) with the 'microsoldering' tag, sourced from
-- the owner's own review of a real CSV export of
-- wholesale-microsoldering-tag-candidates.sql ("Supabase Snippet Untitled
-- query (3).csv"). Breakdown, as approved by the owner:
--   iPhone active services            : 15
--   iPad active services              : 30
--   Laptops -> Laptops (Standard) -> No Power : 1
--   Video Consoles active services    : 10
--   Controllers                       : 0 (explicitly excluded)
--   TOTAL                             : 56
--
-- This file is completely independent of
-- wholesale-dynamic-equipment-types-*.sql — it does not touch
-- wholesale_equipment_types, wholesale_categories structure, or sort_order,
-- and does not require that other migration to have run first or at all.
--
-- ONE statement, ONE result table, entirely read-only — same convention and
-- same non-empty-result guarantee as
-- wholesale-dynamic-equipment-types-preflight.sql (see that file's header
-- for why: a real Supabase run once returned "Success. No rows returned"
-- for a differently-structured preflight query; every check here is a
-- single self-contained SELECT with no FROM, or a SELECT from a CTE
-- guaranteed exactly one row, so none of them can legitimately return zero
-- rows, and a zero-rows safety net is still appended just in case).
--
-- RESULT CONTRACT: check_number, check_name, status ('PASS'/'FAIL'/'STOP'),
-- details. check_number 99 is the final OVERALL STATUS row.
--
-- If OVERALL STATUS is anything other than PASS, STOP and tell Claude
-- before running the migration.
-- ============================================================================

with target_list(service_id, expected_equipment_type, expected_category, expected_service_name) as (
  values
    -- iPhone (15)
    ('a0f00a68-9ac4-4007-ba41-5cecd4cbbb11'::uuid, 'iPhone', 'iPhone 7 / 8 / X / XR / XS / XS Max / 11 / 11 Pro / 11 Pro Max', 'No Power'),
    ('6721d13b-0a6c-4e98-a3a6-3919f875d118'::uuid, 'iPhone', 'iPhone 7 / 8 / X / XR / XS / XS Max / 11 / 11 Pro / 11 Pro Max', 'Boot Loop'),
    ('0b973865-f8c3-40e1-9336-b341190bb6ec'::uuid, 'iPhone', 'iPhone 7 / 8 / X / XR / XS / XS Max / 11 / 11 Pro / 11 Pro Max', 'No Charge – Board Repair'),
    ('e974ab6e-678b-4d9e-90f2-2562f2eaa73e'::uuid, 'iPhone', 'iPhone 7 / 8 / X / XR / XS / XS Max / 11 / 11 Pro / 11 Pro Max', 'No Wi-Fi / Bluetooth – Board Repair'),
    ('274402df-7a6f-43f0-becf-8e894117c905'::uuid, 'iPhone', 'iPhone 7 / 8 / X / XR / XS / XS Max / 11 / 11 Pro / 11 Pro Max', 'Save Phone + Data Recovery'),
    ('e307b624-9782-4572-87cd-b8347ef3f173'::uuid, 'iPhone', 'iPhone 12 / 13 / 14', 'No Power'),
    ('793773d3-4eeb-4510-8aa4-68b018219cae'::uuid, 'iPhone', 'iPhone 12 / 13 / 14', 'Boot Loop'),
    ('88463850-bab8-45d7-b25d-c4178d9a12d9'::uuid, 'iPhone', 'iPhone 12 / 13 / 14', 'No Charge – Board Repair'),
    ('184e1c3c-e6ea-4350-8212-ccc825d0912a'::uuid, 'iPhone', 'iPhone 12 / 13 / 14', 'No Wi-Fi / Bluetooth – Board Repair'),
    ('8fc803f8-c255-4dd7-bfb0-1c7849002b3d'::uuid, 'iPhone', 'iPhone 12 / 13 / 14', 'Save Phone + Data Recovery'),
    ('76f1c27e-2bd6-4862-a697-6c3e44f0d0ac'::uuid, 'iPhone', 'iPhone 15 / 16 / 17', 'No Power'),
    ('1845ff3b-081f-4c85-8b0b-0ed9cda4a00f'::uuid, 'iPhone', 'iPhone 15 / 16 / 17', 'Boot Loop'),
    ('fc58450f-6e70-46ce-a97e-7e51ffc0a4b9'::uuid, 'iPhone', 'iPhone 15 / 16 / 17', 'No Charge – Board Repair'),
    ('9eb35062-4abd-4317-bef2-7c61d3716f4a'::uuid, 'iPhone', 'iPhone 15 / 16 / 17', 'No Wi-Fi / Bluetooth – Board Repair'),
    ('b4aa9434-1b1b-41bb-bb0d-a13604d47bfe'::uuid, 'iPhone', 'iPhone 15 / 16 / 17', 'Save Phone + Data Recovery'),
    -- iPad (30)
    ('810e5d83-9d4f-4054-88bc-1b4d594df507'::uuid, 'iPad', 'iPad 7th / 8th / 9th Generation', 'Charging Port Replacement'),
    ('636f607c-9309-4333-b55f-593d828969f8'::uuid, 'iPad', 'iPad 7th / 8th / 9th Generation', 'Charging IC Replacement'),
    ('d2b908d0-3b52-44b5-861d-9292eb1d76db'::uuid, 'iPad', 'iPad 7th / 8th / 9th Generation', 'Backlight Repair'),
    ('107334b5-c393-4a6e-8a3c-e3a866243941'::uuid, 'iPad', 'iPad 10th Generation', 'Charging Port Replacement'),
    ('49eec112-14d2-4bf2-8b57-3f56af695b59'::uuid, 'iPad', 'iPad 10th Generation', 'No Power'),
    ('422ee991-da3c-4205-a824-55dced29e0e4'::uuid, 'iPad', 'iPad 10th Generation', 'No Wi-Fi / Bluetooth – Board Repair'),
    ('f6f55860-7bb8-49cd-bea4-0728297d411a'::uuid, 'iPad', 'iPad 10th Generation', 'Backlight Repair'),
    ('1da74cd6-a77d-4241-a7e9-0326c83b86d8'::uuid, 'iPad', 'iPad 11th Generation', 'Charging IC / No Charge (IC-caused)'),
    ('9c11aad9-05db-4b83-8610-da8f8dd9db74'::uuid, 'iPad', 'iPad 11th Generation', 'No Charging'),
    ('2ad18346-f573-42e9-9dd3-e598f6bd2af6'::uuid, 'iPad', 'iPad 11th Generation', 'No Wi-Fi / Bluetooth – Board Repair'),
    ('6c14e379-8fda-481b-97db-dc4c97cf0dc6'::uuid, 'iPad', 'iPad Pro 11" — 1st, 2nd & 3rd Generation', 'No Power'),
    ('4d1e1173-f6d1-46ee-acdf-1ae009369775'::uuid, 'iPad', 'iPad Pro 11" — 1st, 2nd & 3rd Generation', 'Boot Loop'),
    ('1541f85b-b339-4531-9874-0a88dd30f6b9'::uuid, 'iPad', 'iPad Pro 11" — 1st, 2nd & 3rd Generation', 'No Charge – Board Repair'),
    ('074db437-e782-4f15-9c2d-83f12c516ae3'::uuid, 'iPad', 'iPad Pro 11" — 1st, 2nd & 3rd Generation', 'No Wi-Fi / Bluetooth – Board Repair'),
    ('bd5b071c-8fb6-441a-a268-c202956a8374'::uuid, 'iPad', 'iPad Pro 11" — 1st, 2nd & 3rd Generation', 'Save Device + Data Recovery'),
    ('ac6b2d48-d2c9-42fa-a9a0-0343c85ebadd'::uuid, 'iPad', 'iPad Pro 12.9" — 1st, 2nd & 3rd Generation', 'No Power'),
    ('46b2b85a-3fda-4351-8337-e2f88ecbc862'::uuid, 'iPad', 'iPad Pro 12.9" — 1st, 2nd & 3rd Generation', 'Boot Loop'),
    ('19dba538-6f48-4816-b653-38d281c3a9af'::uuid, 'iPad', 'iPad Pro 12.9" — 1st, 2nd & 3rd Generation', 'No Charge – Board Repair'),
    ('1f3ee4cc-3296-478a-b289-4cdb60886fd7'::uuid, 'iPad', 'iPad Pro 12.9" — 1st, 2nd & 3rd Generation', 'No Wi-Fi / Bluetooth – Board Repair'),
    ('aa5defaa-7447-41e6-a912-893ef7c98ccc'::uuid, 'iPad', 'iPad Pro 12.9" — 1st, 2nd & 3rd Generation', 'Save Device + Data Recovery'),
    ('c338bb8b-0868-4cad-8fef-ef6edd25d504'::uuid, 'iPad', 'iPad Pro 11" — 4th Generation & Newer', 'No Power'),
    ('376cdb7d-688e-4f59-8a6b-eb2810a4ffdb'::uuid, 'iPad', 'iPad Pro 11" — 4th Generation & Newer', 'Boot Loop'),
    ('734c6029-697e-4600-86eb-aff7ba4fdcbb'::uuid, 'iPad', 'iPad Pro 11" — 4th Generation & Newer', 'No Charge – Board Repair'),
    ('6f808c14-ad4d-41f4-a244-b5b918cacbc2'::uuid, 'iPad', 'iPad Pro 11" — 4th Generation & Newer', 'No Wi-Fi / Bluetooth – Board Repair'),
    ('69e2c3c8-1f1d-4cc1-8633-f95419b1b865'::uuid, 'iPad', 'iPad Pro 11" — 4th Generation & Newer', 'Save Device + Data Recovery'),
    ('d04e15f2-07f3-4162-ac44-1488c25eeb00'::uuid, 'iPad', 'iPad Pro 12.9" — 4th Generation & Newer', 'No Power'),
    ('425e5397-6232-4ea6-a9a8-fd568a6726f0'::uuid, 'iPad', 'iPad Pro 12.9" — 4th Generation & Newer', 'Boot Loop'),
    ('f316d870-bee9-4364-975e-ea8a6653c483'::uuid, 'iPad', 'iPad Pro 12.9" — 4th Generation & Newer', 'No Charge – Board Repair'),
    ('c20368d9-ae49-407b-85ae-c1a91d154fff'::uuid, 'iPad', 'iPad Pro 12.9" — 4th Generation & Newer', 'No Wi-Fi / Bluetooth – Board Repair'),
    ('409aa2d3-206c-4f30-ad88-cef2de9699a1'::uuid, 'iPad', 'iPad Pro 12.9" — 4th Generation & Newer', 'Save Device + Data Recovery'),
    -- Laptops (1)
    ('57b10620-7b41-4ebe-9020-9f79d42bc84a'::uuid, 'Laptops', 'Laptops (Standard)', 'No Power'),
    -- Video Consoles (10)
    ('f4fc9f51-84ca-4661-a379-34aa567d868c'::uuid, 'Video Consoles', 'PlayStation 5', 'HDMI Repair – Board Level'),
    ('7e7ba07a-adcc-4586-848a-b38b11238597'::uuid, 'Video Consoles', 'PlayStation 5', 'No Power – Board Repair'),
    ('f9ea9e54-247a-48a6-9df9-39468bb3f0e7'::uuid, 'Video Consoles', 'PlayStation 5', 'No Wi-Fi / Bluetooth – Board Repair'),
    ('f5c0605b-e163-4b3d-bf1e-544c48311ce4'::uuid, 'Video Consoles', 'Xbox Series X', 'HDMI Repair – Board Level'),
    ('3f2886b8-1716-4525-a712-d6c681a74a3b'::uuid, 'Video Consoles', 'Xbox Series X', 'No Power – Board Repair'),
    ('e19cdf0a-1de7-456c-8644-f71f5fa6ff7e'::uuid, 'Video Consoles', 'Xbox Series X', 'No Wi-Fi / Bluetooth – Board Repair'),
    ('44f199ad-8c7a-46ba-8a20-90903ada7fd8'::uuid, 'Video Consoles', 'Nintendo Switch / Switch OLED', 'Charging Port Replacement'),
    ('ee9dd812-2b16-4442-9ec0-54c6858bf537'::uuid, 'Video Consoles', 'Nintendo Switch / Switch OLED', 'Charging IC Replacement'),
    ('c68b7f11-353c-4163-b04d-2ef7555ae271'::uuid, 'Video Consoles', 'Nintendo Switch / Switch OLED', 'No Power – Board Repair'),
    ('729d78b6-1534-458e-a741-c594a8a8f7d0'::uuid, 'Video Consoles', 'Nintendo Switch / Switch OLED', 'No Wi-Fi / Bluetooth – Board Repair')
),
target_list_stats as (
  select count(*) as row_count, count(distinct service_id) as distinct_id_count from target_list
),
real_state as (
  select
    tl.service_id, tl.expected_equipment_type, tl.expected_category, tl.expected_service_name,
    s.id as real_service_id, s.name as real_service_name, s.active as real_service_active,
    c.name as real_category_name, c.active as real_category_active,
    et.name as real_equipment_type_name, et.slug as real_equipment_type_slug, et.active as real_equipment_type_active,
    exists (
      select 1 from wholesale_service_tags st
      join wholesale_tags t on t.id = st.tag_id
      where st.service_id = tl.service_id and t.slug = 'microsoldering'
    ) as already_tagged
  from target_list tl
  left join wholesale_services s on s.id = tl.service_id
  left join wholesale_categories c on c.id = s.category_id
  left join wholesale_equipment_types et on et.id = c.equipment_type_id
),
group_counts as (
  select expected_equipment_type, count(*) as target_count
  from target_list
  group by expected_equipment_type
),
checks as (
  select 1 as check_number, 'microsoldering_tag_exists' as check_name,
    case when exists (select 1 from wholesale_tags where slug = 'microsoldering') then 'PASS' else 'FAIL' end as status,
    'wholesale_tags row with slug=''microsoldering'' ' ||
      case when exists (select 1 from wholesale_tags where slug = 'microsoldering') then 'found' else 'NOT FOUND — nothing can be tagged until this row exists' end
      as details

  union all

  select 2, 'target_list_has_no_duplicate_ids_and_totals_56',
    case when (select row_count from target_list_stats) = 56 and (select distinct_id_count from target_list_stats) = 56 then 'PASS' else 'FAIL' end,
    'rows in this file''s target list = ' || (select row_count from target_list_stats)
      || ', distinct service_id values = ' || (select distinct_id_count from target_list_stats)
      || ' — both must be exactly 56 (56 rows, zero duplicate ids)'

  union all

  select 3, 'all_56_target_services_exist_in_database',
    case when (select count(*) from real_state where real_service_id is not null) = 56 then 'PASS' else 'FAIL' end,
    'target ids that resolve to a real wholesale_services row = ' || (select count(*) from real_state where real_service_id is not null)
      || ' / 56 — missing ids: ' || coalesce(
        (select string_agg(service_id::text, ', ') from real_state where real_service_id is null), '(none)'
      )

  union all

  select 4, 'all_56_targets_match_expected_name_category_equipment_type',
    case when (
      select count(*) from real_state
      where real_service_id is not null
        and (real_service_name is distinct from expected_service_name
          or real_category_name is distinct from expected_category
          or real_equipment_type_name is distinct from expected_equipment_type)
    ) = 0 then 'PASS' else 'FAIL' end,
    coalesce(
      (
        select string_agg(
          real_service_id::text || ': expected [' || expected_equipment_type || ' / ' || expected_category || ' / ' || expected_service_name
            || '], found [' || coalesce(real_equipment_type_name, 'NULL') || ' / ' || coalesce(real_category_name, 'NULL') || ' / ' || coalesce(real_service_name, 'NULL') || ']',
          E'\n'
        )
        from real_state
        where real_service_id is not null
          and (real_service_name is distinct from expected_service_name
            or real_category_name is distinct from expected_category
            or real_equipment_type_name is distinct from expected_equipment_type)
      ),
      'all 56 match exactly — same name, category, and equipment type as the approved CSV export'
    )

  union all

  select 5, 'none_of_the_56_belong_to_controllers',
    case when (select count(*) from real_state where real_equipment_type_slug = 'controllers') = 0 then 'PASS' else 'FAIL' end,
    'target ids currently owned by the Controllers equipment type = ' || (select count(*) from real_state where real_equipment_type_slug = 'controllers')
      || ' — must be 0 (Controllers is explicitly excluded from this tagging pass)'

  union all

  select 6, 'per_group_breakdown_matches_15_30_1_10',
    case when (
      (select target_count from group_counts where expected_equipment_type = 'iPhone') = 15
      and (select target_count from group_counts where expected_equipment_type = 'iPad') = 30
      and (select target_count from group_counts where expected_equipment_type = 'Laptops') = 1
      and (select target_count from group_counts where expected_equipment_type = 'Video Consoles') = 10
    ) then 'PASS' else 'FAIL' end,
    'iPhone=' || coalesce((select target_count from group_counts where expected_equipment_type = 'iPhone'), 0)
      || ' (expect 15), iPad=' || coalesce((select target_count from group_counts where expected_equipment_type = 'iPad'), 0)
      || ' (expect 30), Laptops=' || coalesce((select target_count from group_counts where expected_equipment_type = 'Laptops'), 0)
      || ' (expect 1), Video Consoles=' || coalesce((select target_count from group_counts where expected_equipment_type = 'Video Consoles'), 0)
      || ' (expect 10)'

  union all

  select 7, 'all_56_target_services_are_active',
    case when (select count(*) from real_state where real_service_id is not null and real_service_active is not true) = 0 then 'PASS' else 'FAIL' end,
    'target ids that resolve to an INACTIVE service = ' || (select count(*) from real_state where real_service_id is not null and real_service_active is not true)
      || ' — must be 0; inactive ones found: ' || coalesce(
        (select string_agg(real_service_id::text || ' (' || real_service_name || ')', ', ') from real_state where real_service_id is not null and real_service_active is not true),
        '(none)'
      )

  union all

  select 8, 'already_tagged_count (informational)',
    'PASS',
    'of the 56 targets, ' || (select count(*) from real_state where already_tagged) || ' already carry the microsoldering tag today — '
      || 'expected 0 on a first run (the real CSV export showed already_tagged_microsoldering=false for all of them); a nonzero count here '
      || 'is not blocking — the migration only INSERTs missing relationships (ON CONFLICT DO NOTHING), so an already-tagged service is '
      || 'simply left untouched, never re-tagged or duplicated'
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
    'PASS = safe to run wholesale-microsoldering-tag-assignment-migration.sql as-is. FAIL = fix the flagged '
      || 'row(s) first — most likely cause is DB state drift since the CSV was exported (a service renamed, '
      || 'moved category, deactivated, or re-parented to Controllers). Check 8 is informational only and never '
      || 'causes FAIL/STOP by itself.'
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
