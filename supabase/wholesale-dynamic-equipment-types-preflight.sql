-- ============================================================================
-- Preflight — run BEFORE wholesale-dynamic-equipment-types-migration.sql
-- ============================================================================
-- Small, standalone migration on top of the already-applied wholesale
-- catalog schema. Makes the 8 wholesale-portal home cards fully DESK-managed:
-- adds a Spanish name, a normalized photo-crop focus point (X/Y, 0-100), and
-- a full-bleed-photo toggle directly onto wholesale_equipment_types;
-- converts PlayStation 5 / Xbox Series X / Nintendo Switch from categories
-- nested under a "Video Consoles" equipment type into real, independent
-- wholesale_equipment_types rows; and makes 'laptops' the one official
-- Laptops card by moving macbook's categories (macbook-air, macbook-pro)
-- onto it and hiding 'macbook'/'gaming-laptops' as historical-compatibility
-- rows (never deleted). See the migration file's own header for the full
-- owner-approved decision and the exact final 8-card visual order.
--
-- ONE statement, ONE result table — same convention as every other preflight
-- in this project. Entirely read-only.
--
-- Order of operations:
--   1. Run this file. Read the check_name/status/details rows and the final
--      OVERALL STATUS row.
--   2. Read every row under "current catalog snapshot" (checks 6-14) by
--      hand before proceeding — this migration hardcodes slug-based lookups
--      ('video-consoles' for the 3 promoted categories, 'macbook'/'laptops'
--      for the Laptops merge) and check 13 specifically flags the one edge
--      case that needs a human call: macbook AND laptops both already
--      having their own photo (the migration will not silently overwrite
--      either one in that case). Check 14 is a HARD GATE, not informational
--      — with zero active services currently tagged 'microsoldering',
--      OVERALL STATUS is FAIL and the migration must not run yet (it would
--      succeed, but Microsoldering would end up with zero content, a
--      silent no-op the owner has said must stop the migration instead).
--      If check 5, 6, 10, 11, 13, or 14 show something other than what you
--      expect, STOP and tell Claude before running the migration.
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
    (select id from wholesale_equipment_types where slug = 'video-consoles') as video_consoles_id,
    (select id from wholesale_equipment_types where slug = 'laptops') as laptops_id,
    (select id from wholesale_equipment_types where slug = 'macbook') as macbook_id
),
video_consoles_categories as (
  select c.slug, c.name, c.id,
    (select count(*) from wholesale_services s where s.category_id = c.id) as service_count,
    (select count(*) from wholesale_images i where i.category_id = c.id) as image_count
  from wholesale_categories c, raw
  where c.equipment_type_id = raw.video_consoles_id
),
macbook_categories as (
  select c.slug, c.name, c.id,
    (select count(*) from wholesale_services s where s.category_id = c.id) as service_count,
    (select count(*) from wholesale_images i where i.category_id = c.id) as image_count
  from wholesale_categories c, raw
  where c.equipment_type_id = raw.macbook_id
),
target_categories as (
  select slug, id, equipment_type_id,
    (select count(*) from wholesale_services s where s.category_id = c.id) as service_count,
    (select count(*) from wholesale_images i where i.category_id = c.id) as image_count,
    (select count(*) from wholesale_price_history ph join wholesale_services s on s.id = ph.service_id where s.category_id = c.id) as price_history_count
  from wholesale_categories c
  where c.slug in ('ps5', 'xbox-series-x', 'switch')
),
macbook_target_categories as (
  select slug, id, equipment_type_id,
    (select count(*) from wholesale_services s where s.category_id = c.id) as service_count,
    (select count(*) from wholesale_images i where i.category_id = c.id) as image_count,
    (select count(*) from wholesale_price_history ph join wholesale_services s on s.id = ph.service_id where s.category_id = c.id) as price_history_count
  from wholesale_categories c
  where c.slug in ('macbook-air', 'macbook-pro')
),
microsoldering_tag_status as (
  select
    (select id from wholesale_tags where slug = 'microsoldering') as tag_id,
    (
      select count(*) from wholesale_service_tags st
      join wholesale_services s on s.id = st.service_id
      where st.tag_id = (select id from wholesale_tags where slug = 'microsoldering')
        and s.active = true
    ) as tagged_active_service_count
),
current_equipment_types as (
  select string_agg(
    slug || ' (name=' || name || ', sort_order=' || sort_order || ', active=' || active || ', is_tag_lens=' || is_tag_lens || ')',
    E'\n' order by sort_order, name
  ) as listing, count(*) as total_count
  from wholesale_equipment_types
),
-- Real, computed visibility per equipment type — a card only actually shows
-- on the portal when it has at least one category with at least one active
-- service (the exact filter buildWholesaleCatalog applies). This exists
-- specifically because a PRIOR version of this migration hardcoded an
-- assumption ('gaming-laptops' = the real "Laptops" card) that turned out
-- to be wrong when checked against the real seed data: 'laptops' and
-- 'gaming-laptops' are BOTH seeded as empty, zero-service placeholder
-- categories ("Diagnostic-only categories — no services yet, prices
-- pending"), while 'macbook' — never mentioned in any approved card-order
-- list — has real, populated categories. Read this row carefully; do not
-- assume any specific slug is "the" Laptops card.
equipment_type_visibility as (
  select
    et.slug, et.name, et.active, et.sort_order,
    count(distinct c.id) filter (where c.active) as active_category_count,
    count(distinct s.id) filter (where s.active) as active_service_count,
    (
      count(distinct c.id) filter (where c.active) > 0
      and count(distinct s.id) filter (where s.active) > 0
    ) as would_be_visible_today
  from wholesale_equipment_types et
  left join wholesale_categories c on c.equipment_type_id = et.id
  left join wholesale_services s on s.category_id = c.id
  where et.is_tag_lens = false
  group by et.slug, et.name, et.active, et.sort_order
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
      || ' — this is every row that exists, active or not, visible or not. See check 9 below for which ones '
      || 'ACTUALLY show as a card today — that is the list that matters for deciding the final visual order, '
      || 'and it is computed, never assumed.'

  union all

  select 9, 'equipment_type_real_visibility (READ BY HAND)',
    'REVIEW REQUIRED',
    coalesce(
      (select string_agg(
        slug || ' (name=' || name || ') — ' ||
        case when would_be_visible_today then 'VISIBLE today' else 'NOT visible today (empty)' end ||
        ' [active_categories=' || active_category_count || ', active_services=' || active_service_count || ']',
        E'\n' order by would_be_visible_today desc, sort_order
      ) from equipment_type_visibility),
      '(no non-tag-lens equipment types found)'
    )
      || E'\n\nThis is what originally surfaced that ''laptops''/''gaming-laptops'' were both empty while '
      || '''macbook'' had the real content. The owner has since decided (see checks 10-13 and the migration''s '
      || 'own header): ''laptops'' becomes the one official card, macbook''s categories move onto it, and '
      || '''macbook''/''gaming-laptops'' are hidden as historical compatibility rows. This row is now '
      || 'informational — confirm it still matches reality (no new services added to macbook/laptops/'
      || 'gaming-laptops since the decision was made) before running the migration.'

  union all

  select 10, 'laptops_and_macbook_equipment_types_found',
    case when laptops_id is not null and macbook_id is not null then 'PASS' else 'FAIL' end,
    'wholesale_equipment_types row with slug=''laptops'' ' ||
      case when laptops_id is not null then 'found (id=' || laptops_id || ')' else 'NOT FOUND — the migration''s hardcoded reference will not match anything' end
      || E'; slug=''macbook'' ' ||
      case when macbook_id is not null then 'found (id=' || macbook_id || ')' else 'NOT FOUND — the migration''s hardcoded reference will not match anything' end
  from raw

  union all

  select 11, 'macbook_current_categories (READ BY HAND)',
    'REVIEW REQUIRED',
    coalesce(
      (select string_agg(slug || ' (name=' || name || ', services=' || service_count || ', images=' || image_count || ')', E'\n' order by slug) from macbook_categories),
      '(none found — macbook has zero categories already)'
    ) || E'\n\nExpected: exactly macbook-air, macbook-pro and nothing else. If any OTHER category is listed '
      || 'here, it will move to ''laptops'' too (the migration re-points every category currently under '
      || 'macbook, not just these two by name) — stop and tell Claude before running the migration if that''s '
      || 'not what you want.'

  union all

  select 12, 'macbook_categories_found_with_current_relations (READ BY HAND)',
    case when (select count(*) from macbook_target_categories) = 2 then 'PASS' else 'FAIL' end,
    coalesce(
      (select string_agg(slug || ' (id=' || id || ', equipment_type_id=' || equipment_type_id || ', services=' || service_count || ', images=' || image_count || ', price_history_rows=' || price_history_count || ')', E'\n' order by slug) from macbook_target_categories),
      '(none found at all)'
    ) || ' — expected exactly 2 rows (macbook-air, macbook-pro); this is the exact before-state the migration '
      || 'must preserve (same category id, same services, same price_history, same price tiers) after '
      || 're-pointing equipment_type_id to ''laptops'''

  union all

  select 13, 'macbook_and_laptops_photo_collision_check',
    case when (
      (select count(*) from wholesale_images where equipment_type_id = raw.macbook_id) > 0
      and (select count(*) from wholesale_images where equipment_type_id = raw.laptops_id) > 0
    ) then 'REVIEW REQUIRED' else 'PASS' end,
    case when (
      (select count(*) from wholesale_images where equipment_type_id = raw.macbook_id) > 0
      and (select count(*) from wholesale_images where equipment_type_id = raw.laptops_id) > 0
    ) then
      'BOTH macbook and laptops already have their own photo. The migration''s photo-transfer step will NOT '
        || 'overwrite laptops'' existing photo (guarded by the unique-per-equipment-type index) — macbook''s '
        || 'photo will simply stay attached to the now-hidden macbook row, unused. If you want macbook''s '
        || 'photo to become the Laptops card''s photo instead, replace it from DESK after the migration runs.'
    else
      'macbook photos=' || (select count(*) from wholesale_images where equipment_type_id = raw.macbook_id)
        || ', laptops photos=' || (select count(*) from wholesale_images where equipment_type_id = raw.laptops_id)
        || ' — no collision, the migration''s photo transfer (if macbook has one) will apply cleanly'
    end
  from raw

  union all

  -- Hard gate, not informational: with zero active services tagged
  -- 'microsoldering', the Microsoldering card would have no content at all
  -- post-migration (same "hide if empty" rule as any other equipment
  -- type) — a silent, invisible no-op the owner explicitly said must STOP
  -- the migration rather than pass quietly. Tag at least one active
  -- service as Microsoldering from DESK, then re-run this preflight.
  select 14, 'microsoldering_tagged_active_service_count',
    case when tagged_active_service_count > 0 then 'PASS' else 'FAIL' end,
    'active services tagged ''microsoldering'' -> ' || tagged_active_service_count
      || ' — must be > 0. STOP/NO-GO if 0: the Microsoldering card would have zero content post-migration '
      || '(same hide-if-empty rule every other equipment type gets). Tag at least one active service as '
      || 'Microsoldering from DESK, then re-run this preflight, before running the migration.'
  from microsoldering_tag_status
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
      || 'flagged row by hand (especially 6, 8, 11, and 13) and confirm the migration''s hardcoded slug '
      || 'references match before proceeding — this file cannot verify that automatically. FAIL = fix the '
      || 'flagged row(s) first — check 14 (zero services tagged microsoldering) is the one FAIL that is only '
      || 'fixed from DESK (tag a service), not by changing the migration.'
  from overall
) t
order by ord;
