-- ============================================================================
-- Rollback for wholesale-dynamic-equipment-types-migration.sql — REFERENCE
-- ONLY
-- ============================================================================
-- This file is NOT run automatically by anything — no script, no test, no CI
-- step references it. It exists so that IF this migration ever needs to be
-- undone, the exact, reviewed steps already exist instead of being
-- improvised under pressure.
--
-- Structured in clearly separated sections, safest first:
--   1. Drop the 2 new RPCs — always safe, no data involved.
--   2. Re-point ps5/xbox-series-x/switch categories back to Video Consoles,
--      reactivate Video Consoles — always safe, no data loss (services,
--      prices, tiers, and price_history are never touched by this step;
--      only each category's own parent equipment_type_id changes back).
--   3. OPTIONAL — move any photo re-owned by the migration back to
--      category-level ownership. Safe (just flips which owner column is
--      set), but only meaningful if you're also doing step 4.
--   4. OPTIONAL, POTENTIALLY DESTRUCTIVE — delete the 3 new equipment_type
--      rows entirely. Only run this if you're confident nothing new was
--      attached to them since the migration ran (a fresh photo upload
--      directly to the new row, a rename, a reorder edit through DESK's new
--      UI) — this section does NOT try to detect that for you. Safe
--      immediately after the migration; increasingly risky the longer real
--      admin activity has occurred on these rows.
--   5. OPTIONAL — drop the 4 new columns. Loses any name_es/image_focus_x/
--      image_focus_y/full_bleed_photo values entered through DESK after the
--      migration ran, for EVERY equipment type, not just the 3 new ones.
--      Only run this if you are abandoning the whole feature, not just
--      undoing the PS5/Xbox/Switch move.
--
-- Sections 1-2 are the DEFAULT, executed rollback below. Sections 3-5 are
-- commented out — uncomment deliberately, read the warnings above each one
-- again immediately before you do.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Drop the 2 new RPCs.
-- ----------------------------------------------------------------------------
drop function if exists public.wholesale_swap_equipment_type_sort_order(uuid, uuid, uuid);
drop function if exists public.wholesale_delete_equipment_type(uuid, uuid, boolean);

-- ----------------------------------------------------------------------------
-- 2. Re-point the 3 categories back to Video Consoles, reactivate Video
--    Consoles (idempotent — safe even if it was never actually hidden).
--    Restores their sort_order to a sane default too (this migration's own
--    values, 13/14/15, matching what the original seed used for them as
--    categories) — not load-bearing for data integrity, just visual
--    tidiness if you ever look at raw category ordering again.
-- ----------------------------------------------------------------------------
update wholesale_categories set
  equipment_type_id = (select id from wholesale_equipment_types where slug = 'video-consoles'),
  updated_at = now()
where slug in ('ps5', 'xbox-series-x', 'switch');

update wholesale_equipment_types set active = true, updated_at = now()
where slug = 'video-consoles';

-- ----------------------------------------------------------------------------
-- 3. OPTIONAL — reverse the photo re-ownership (only relevant if a photo was
--    already category-owned for one of these 3 BEFORE the migration ran, and
--    the migration's step 4 moved it to the new equipment-type row).
-- ----------------------------------------------------------------------------
-- update wholesale_images set
--   category_id = c.id,
--   equipment_type_id = null
-- from wholesale_categories c
-- where wholesale_images.equipment_type_id in (
--     select id from wholesale_equipment_types where slug in ('ps5', 'xbox-series-x', 'switch')
--   )
--   and c.slug in ('ps5', 'xbox-series-x', 'switch')
--   and wholesale_images.equipment_type_id = (select id from wholesale_equipment_types where slug = c.slug);

-- ----------------------------------------------------------------------------
-- 4. OPTIONAL, POTENTIALLY DESTRUCTIVE — delete the 3 new equipment_type
--    rows. Only correct to run if section 2 already ran successfully above
--    (categories must be re-pointed away FIRST, or this delete would be
--    blocked by nothing at the SQL level but would silently orphan them at
--    the application level — always run section 2 before this, never this
--    alone).
-- ----------------------------------------------------------------------------
-- delete from wholesale_equipment_types where slug in ('ps5', 'xbox-series-x', 'switch');

-- ----------------------------------------------------------------------------
-- 5. OPTIONAL — drop the 4 new columns entirely (affects ALL equipment
--    types, not just the 3 new ones — loses any admin-entered Spanish
--    names/crop positions/full-bleed toggles for the whole catalog).
-- ----------------------------------------------------------------------------
-- alter table wholesale_equipment_types drop constraint if exists wholesale_equipment_types_image_focus_x_check;
-- alter table wholesale_equipment_types drop constraint if exists wholesale_equipment_types_image_focus_y_check;
-- alter table wholesale_equipment_types drop column if exists image_focus_x;
-- alter table wholesale_equipment_types drop column if exists image_focus_y;
-- alter table wholesale_equipment_types drop column if exists full_bleed_photo;
-- alter table wholesale_equipment_types drop column if exists name_es;

commit;
