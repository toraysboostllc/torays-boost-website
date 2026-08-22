-- ============================================================================
-- Rollback for wholesale-global-warranty-migration.sql — REFERENCE ONLY,
-- non-destructive to anything that existed before this migration
-- ============================================================================
-- This file is NOT run automatically by anything — no script, no test, no CI
-- step references it. It exists so that IF this migration is ever run for
-- real and needs to be undone, the exact, reviewed steps already exist
-- instead of being improvised under pressure.
--
-- Non-destructive, unlike wholesale-pricing-intelligence-rollback.sql (which
-- has to drop the whole wholesale_portal_settings table, because that
-- migration created it): this migration only ADDED 4 columns and 1 function
-- to an ALREADY-EXISTING table. Rolling it back removes exactly those 5
-- objects and nothing else —
--   - wholesale_portal_settings itself is NOT dropped.
--   - Every pre-existing column on the row (default_target_margin_percent,
--     rounding_rule, sales_visible, sales_status, sales_entry_blocked,
--     updated_at, updated_by) and its current value is untouched.
--   - wholesale_update_portal_settings() (v1) is NOT dropped — this
--     migration never modified it, so rolling back never needs to touch it
--     either.
--   - No wholesale_services/wholesale_categories/wholesale_equipment_types/
--     wholesale_price_history row is touched — this was never a per-service
--     feature, there is nothing on those tables to undo.
--
-- The only real data loss from running this file: whatever warranty
-- configuration (enabled/duration/terms) an admin has already set from
-- DESK — those 4 cells are gone once the DROP COLUMN statements run. Read
-- wholesale-global-warranty-verify.sql first if you want to know the
-- current values before dropping them. Run manually, one statement at a
-- time, only with the owner's explicit go-ahead for THIS specific rollback.
-- ============================================================================

begin;

-- Reverse order of creation.

-- 1. The new RPC. wholesale_update_portal_settings (v1, 6 arguments) is
--    deliberately NOT referenced here — this migration never touched it.
drop function if exists wholesale_update_portal_settings_v2(uuid, numeric, text, boolean, text, boolean, boolean, integer, text, text);

-- 2. The CHECK constraint and the 4 new columns. Any warranty configuration
--    an admin has already set is lost; every other column on this same row
--    (default_target_margin_percent, rounding_rule, sales_visible,
--    sales_status, sales_entry_blocked, updated_at, updated_by) and the row
--    itself are completely untouched.
alter table wholesale_portal_settings drop constraint if exists wholesale_portal_settings_warranty_duration_check;
alter table wholesale_portal_settings drop column if exists warranty_enabled;
alter table wholesale_portal_settings drop column if exists warranty_duration_days;
alter table wholesale_portal_settings drop column if exists warranty_terms_en;
alter table wholesale_portal_settings drop column if exists warranty_terms_es;

commit;
