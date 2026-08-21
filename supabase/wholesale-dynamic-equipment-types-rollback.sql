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
--      reactivate Video Consoles, restore everyone's sort_order to a sane
--      pre-migration-like value — always safe, no data loss (services,
--      prices, tiers, and price_history are never touched by this step;
--      only each category's own parent equipment_type_id changes back).
--   3. Re-point macbook-air/macbook-pro categories back to macbook,
--      reactivate macbook and gaming-laptops, restore laptops' Spanish name
--      to null (it never had one before this migration) — same "always
--      safe, no data loss" posture as step 2, same technique.
--   4. OPTIONAL — move any photo re-owned by step 2 above back to
--      category-level ownership. Safe (just flips which owner column is
--      set), but only meaningful if you're also doing step 7.
--   5. OPTIONAL — move macbook's photo back from laptops, but ONLY if this
--      migration actually moved one (i.e. only if laptops currently has a
--      photo and macbook currently doesn't — the exact signature the
--      migration's own transfer step would have left behind).
--   6. OPTIONAL, POTENTIALLY DESTRUCTIVE — delete the 3 new equipment_type
--      rows entirely. Only run this if you're confident nothing new was
--      attached to them since the migration ran (a fresh photo upload
--      directly to the new row, a rename, a reorder edit through DESK's new
--      UI) — this section does NOT try to detect that for you. Safe
--      immediately after the migration; increasingly risky the longer real
--      admin activity has occurred on these rows.
--   7. OPTIONAL — drop the 4 new columns. Loses any name_es/image_focus_x/
--      image_focus_y/full_bleed_photo values entered through DESK after the
--      migration ran, for EVERY equipment type, not just the ones this
--      migration touched. Only run this if you are abandoning the whole
--      feature, not just undoing the PS5/Xbox/Switch move and the Laptops
--      merge.
--
-- Sections 1-3 are the DEFAULT, executed rollback below — together they
-- undo every non-optional effect of the migration (both the PS5/Xbox/Switch
-- move and the MacBook -> Laptops merge). Sections 4-7 are commented out —
-- uncomment deliberately, read the warnings above each one again
-- immediately before you do.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Drop the 2 new RPCs.
-- ----------------------------------------------------------------------------
drop function if exists public.wholesale_swap_equipment_type_sort_order(uuid, uuid, uuid);
drop function if exists public.wholesale_delete_equipment_type(uuid, uuid, boolean);

-- ----------------------------------------------------------------------------
-- 2. Re-point the 3 categories back to Video Consoles, reactivate Video
--    Consoles (idempotent — safe even if it was never actually hidden), and
--    restore sort_order for the rows this migration touched back to the
--    values the original seed used (video-consoles=6, and the categories'
--    own former equipment-type-adjacent ordering is not sort_order-bearing,
--    so nothing else to restore there).
-- ----------------------------------------------------------------------------
update wholesale_categories set
  equipment_type_id = (select id from wholesale_equipment_types where slug = 'video-consoles'),
  updated_at = now()
where slug in ('ps5', 'xbox-series-x', 'switch');

update wholesale_equipment_types set active = true, sort_order = 6, updated_at = now()
where slug = 'video-consoles';

-- ----------------------------------------------------------------------------
-- 3. Re-point macbook-air/macbook-pro back to macbook, reactivate macbook
--    and gaming-laptops (both were active=true before this migration ran),
--    restore laptops' sort_order and clear the Spanish name this migration
--    set (name_es was null before — 'laptops'' English name is left as
--    'Laptops' since the seed already used that name before this migration
--    ever touched it; only name_es is this migration's own addition).
--    Original pre-migration sort_order values, from the real seed: macbook=3,
--    laptops=4, gaming-laptops=5.
-- ----------------------------------------------------------------------------
update wholesale_categories set
  equipment_type_id = (select id from wholesale_equipment_types where slug = 'macbook'),
  updated_at = now()
where slug in ('macbook-air', 'macbook-pro');

update wholesale_equipment_types set active = true, sort_order = 3, updated_at = now()
where slug = 'macbook';

update wholesale_equipment_types set active = true, sort_order = 5, updated_at = now()
where slug = 'gaming-laptops';

update wholesale_equipment_types set name_es = null, sort_order = 4, updated_at = now()
where slug = 'laptops';

-- ----------------------------------------------------------------------------
-- 4. OPTIONAL — reverse the photo re-ownership for ps5/xbox-series-x/switch
--    (only relevant if a photo was already category-owned for one of these
--    3 BEFORE the migration ran, and the migration's step 4 moved it to the
--    new equipment-type row).
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
-- 5. OPTIONAL — move macbook's photo back from laptops. Guarded the same
--    way the forward migration was: only fires if laptops currently has a
--    photo and macbook currently has none — the exact signature a real
--    transfer would have left. If both already have their own (the
--    migration's guard would have made the forward transfer a no-op — see
--    preflight check 13), there is nothing to reverse here.
-- ----------------------------------------------------------------------------
-- update wholesale_images set
--   equipment_type_id = (select id from wholesale_equipment_types where slug = 'macbook')
-- where equipment_type_id = (select id from wholesale_equipment_types where slug = 'laptops')
--   and not exists (
--     select 1 from wholesale_images where equipment_type_id = (select id from wholesale_equipment_types where slug = 'macbook')
--   );

-- ----------------------------------------------------------------------------
-- 6. OPTIONAL, POTENTIALLY DESTRUCTIVE — delete the 3 new equipment_type
--    rows. Only correct to run if section 2 already ran successfully above
--    (categories must be re-pointed away FIRST, or this delete would be
--    blocked by nothing at the SQL level but would silently orphan them at
--    the application level — always run section 2 before this, never this
--    alone).
-- ----------------------------------------------------------------------------
-- delete from wholesale_equipment_types where slug in ('ps5', 'xbox-series-x', 'switch');

-- ----------------------------------------------------------------------------
-- 7. OPTIONAL — drop the 4 new columns entirely (affects ALL equipment
--    types, not just the ones this migration touched — loses any
--    admin-entered Spanish names/crop positions/full-bleed toggles for the
--    whole catalog).
-- ----------------------------------------------------------------------------
-- alter table wholesale_equipment_types drop constraint if exists wholesale_equipment_types_image_focus_x_check;
-- alter table wholesale_equipment_types drop constraint if exists wholesale_equipment_types_image_focus_y_check;
-- alter table wholesale_equipment_types drop column if exists image_focus_x;
-- alter table wholesale_equipment_types drop column if exists image_focus_y;
-- alter table wholesale_equipment_types drop column if exists full_bleed_photo;
-- alter table wholesale_equipment_types drop column if exists name_es;

commit;
