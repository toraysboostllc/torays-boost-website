-- ============================================================================
-- Preflight — run BEFORE wholesale-dynamic-equipment-types-migration.sql
-- ============================================================================
-- Small, standalone migration on top of the already-applied wholesale
-- catalog schema. Makes the 8 wholesale-portal home cards fully DESK-managed:
-- adds a Spanish name, a normalized photo-crop focus point (X/Y, 0-100), and
-- a full-bleed-photo toggle directly onto wholesale_equipment_types, and
-- converts PlayStation 5 / Xbox Series X / Nintendo Switch from categories
-- nested under a "Video Consoles" equipment type into real, independent
-- wholesale_equipment_types rows — eliminating the client-side
-- PROMOTED_CATEGORY_SLUGS hack entirely rather than parametrizing it.
--
-- ONE statement, ONE result table — same convention as every other preflight
-- in this project. Entirely read-only.
--
-- Order of operations:
--   1. Run this file. Read the check_name/status/details rows and the final
--      OVERALL STATUS row.
--   2. Read every row under "current catalog snapshot" (checks 6-8) by hand
--      before proceeding — this migration hardcodes slug-based lookups
--      (e.g. 'video-consoles', 'gaming-laptops') that assume the current
--      seeded catalog shape. If any of those rows show something other than
--      what you expect, STOP and tell Claude before running the migration —
--      the migration's slug references may need correcting first.
--   3. Only if OVERALL STATUS is PASS, run
--      wholesale-dynamic-equipment-types-migration.sql.
--   4. Run wholesale-dynamic-equipment-types-verify.sql afterward to confirm
--      it landed and actually works.
-- ============================================================================

with raw as (
  select
    exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'wholesale_equipment_types'
    ) as equipment_types_table_exists,
    exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'wholesale_categories'
    ) as categories_table_exists,
    exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'wholesale_images'
    ) as images_table_exists,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'wholesale_equipment_types' and column_name = 'name_es'
    ) as name_es_already_exists,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'wholesale_equipment_types' and column_name = 'image_focus_x'
    ) as image_focus_x_already_exists,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'wholesale_equipment_types' and column_name = 'image_focus_y'
    ) as image_focus_y_already_exists,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'wholesale_equipment_types' and column_name = 'full_bleed_photo'
    ) as full_bleed_photo_already_exists,
    exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'wholesale_swap_equipment_type_sort_order'
    ) as swap_rpc_already_exists,
    exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'wholesale_delete_equipment_type'
    ) as delete_rpc_already_exists,
    (select count(*) from wholesale_equipment_types where slug in ('ps5', 'xbox-series-x', 'switch')) as promoted_slug_collision_count,
    (select id from wholesale_equipment_types where slug = 'video-consoles') as video_consoles_id
),
video_consoles_categories as (
  select c.slug, c.name, c.id,
    (select count(*) from wholesale_services s where s.category_id = c.id) as service_count,
    (select count(*) from wholesale_images i where i.category_id = c.id) as image_count
  from wholesale_categories c, raw
  where c.equipment_type_id = raw.video_consoles_id
),
target_categories as (
  select slug, id, equipment_type_id,
    (select count(*) from wholesale_services s where s.category_id = c.id) as service_count,
    (select count(*) from wholesale_images i where i.category_id = c.id) as image_count,
    (select count(*) from wholesale_price_history ph join wholesale_services s on s.id = ph.service_id where s.category_id = c.id) as price_history_count
  from wholesale_categories c
  where c.slug in ('ps5', 'xbox-series-x', 'switch')
),
current_equipment_types as (
  select string_agg(
    slug || ' (name=' || name || ', sort_order=' || sort_order || ', active=' || active || ', is_tag_lens=' || is_tag_lens || ')',
    E'\n' order by sort_order, name
  ) as listing, count(*) as total_count
  from wholesale_equipment_types
),
checks as (
  select 1 as ord, 'prerequisite_tables_exist' as check_name,
    case when equipment_types_table_exists and categories_table_exists and images_table_exists then 'PASS' else 'FAIL' end as status,
    'wholesale_equipment_types=' || equipment_types_table_exists
      || ', wholesale_categories=' || categories_table_exists
      || ', wholesale_images=' || images_table_exists
      || ' — if any is false, run the base wholesale-*-migration.sql files first'
      as details
  from raw

  union all

  select 2, 'new_columns_not_already_present',
    case when not (name_es_already_exists or image_focus_x_already_exists or image_focus_y_already_exists or full_bleed_photo_already_exists)
      then 'PASS' else 'REVIEW REQUIRED' end,
    'name_es=' || name_es_already_exists || ', image_focus_x=' || image_focus_x_already_exists
      || ', image_focus_y=' || image_focus_y_already_exists || ', full_bleed_photo=' || full_bleed_photo_already_exists
      || ' — expect all false on a first run. If true, this migration''s column-add step already ran; its own '
      || '"add column if not exists" makes re-running safe regardless (informational, not a blocker)'
  from raw

  union all

  select 3, 'new_rpcs_not_already_present',
    case when not (swap_rpc_already_exists or delete_rpc_already_exists) then 'PASS' else 'REVIEW REQUIRED' end,
    'wholesale_swap_equipment_type_sort_order exists=' || swap_rpc_already_exists
      || ', wholesale_delete_equipment_type exists=' || delete_rpc_already_exists
      || ' — expect both false on a first run; CREATE OR REPLACE makes a re-run safe either way'
  from raw

  union all

  select 4, 'no_slug_collision_for_new_equipment_type_rows',
    case when promoted_slug_collision_count = 0 then 'PASS' else 'FAIL' end,
    'select count(*) from wholesale_equipment_types where slug in (''ps5'',''xbox-series-x'',''switch'') -> '
      || promoted_slug_collision_count
      || ' — must be 0 (these must not already exist as equipment types) before the migration can safely INSERT them. '
      || 'A nonzero count almost certainly means this migration already ran once — check row 3 above too.'
  from raw

  union all

  select 5, 'video_consoles_equipment_type_found',
    case when video_consoles_id is not null then 'PASS' else 'FAIL' end,
    'wholesale_equipment_types row with slug=''video-consoles'' ' ||
      case when video_consoles_id is not null then 'found (id=' || video_consoles_id || ')' else 'NOT FOUND — the migration''s hardcoded slug reference will not match anything; investigate the real slug before running it' end
  from raw

  union all

  select 6, 'video_consoles_current_categories (READ BY HAND)',
    'REVIEW REQUIRED',
    coalesce(
      (select string_agg(slug || ' (name=' || name || ', services=' || service_count || ', images=' || image_count || ')', E'\n' order by slug) from video_consoles_categories),
      '(none found — Video Consoles has zero categories already)'
    ) || E'\n\nExpected: exactly ps5, xbox-series-x, switch and nothing else. If any OTHER category is '
      || 'listed here, the migration''s step that hides Video Consoles once empty would be WRONG (it would '
      || 'still have real content) — stop and tell Claude before running the migration.'

  union all

  select 7, 'ps5_xbox_switch_categories_found_with_current_relations (READ BY HAND)',
    case when (select count(*) from target_categories) = 3 then 'PASS' else 'FAIL' end,
    coalesce(
      (select string_agg(slug || ' (id=' || id || ', equipment_type_id=' || equipment_type_id || ', services=' || service_count || ', images=' || image_count || ', price_history_rows=' || price_history_count || ')', E'\n' order by slug) from target_categories),
      '(none found at all)'
    ) || ' — expected exactly 3 rows (ps5, xbox-series-x, switch); this is the exact before-state the migration '
      || 'must preserve (same category id, same services, same price_history) after re-pointing equipment_type_id'

  union all

  select 8, 'current_equipment_types_snapshot (READ BY HAND)',
    'REVIEW REQUIRED',
    (select listing from current_equipment_types) || E'\n\nTotal rows: ' || (select total_count from current_equipment_types)
      || ' — cross-check this against the expected 8 visible home cards (Microsoldering, iPhone, iPad, a '
      || 'Laptops-named equipment type, Controllers, plus Video Consoles which should NOT be independently '
      || 'visible today). If the Laptops-related slug isn''t exactly ''gaming-laptops'', the migration''s '
      || 'explicit sort_order-by-slug step for it needs correcting before you run it.'
),
overall as (
  select
    case
      when bool_or(status = 'FAIL') then 'FAIL'
      when bool_or(status = 'REVIEW REQUIRED') then 'REVIEW REQUIRED'
      else 'PASS'
    end as status
  from checks
)
select check_name, status, details
from (
  select ord, check_name, status, details from checks
  union all
  select
    99,
    'OVERALL STATUS',
    overall.status,
    'PASS = safe to run wholesale-dynamic-equipment-types-migration.sql as-is. REVIEW REQUIRED = read every '
      || 'flagged row by hand (especially 6 and 8) and confirm the migration''s hardcoded slug references match '
      || 'before proceeding — this file cannot verify that automatically. FAIL = fix the flagged row(s) first.'
  from overall
) t
order by ord;
