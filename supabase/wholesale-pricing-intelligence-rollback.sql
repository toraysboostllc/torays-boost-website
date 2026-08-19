-- ============================================================================
-- Rollback for wholesale-pricing-intelligence-migration.sql — REFERENCE ONLY
-- ============================================================================
-- This file is NOT run automatically by anything — no script, no test, no CI
-- step references it. It exists so that IF this migration is ever run for
-- real and needs to be undone, the exact, reviewed steps already exist
-- instead of being improvised under pressure.
--
-- Every statement below is destructive to the OBJECTS this migration
-- created — never to wholesale_services/wholesale_price_history rows that
-- already existed before this migration ran, and never to
-- wholesale_update_service_price (the pre-existing RPC this migration never
-- modified). Read wholesale-pricing-intelligence-verify.sql first if you
-- want to know what's actually stored in the new columns before dropping
-- them — any recommended_price/target_margin_percent an admin has already
-- set from DESK is permanently lost once this file's ALTER ... DROP COLUMN
-- statements run. Run manually, one statement at a time, only with the
-- owner's explicit go-ahead for THIS specific rollback.
-- ============================================================================

begin;

-- Reverse order of creation.

-- 1. The two new RPCs.
drop function if exists wholesale_update_portal_settings(uuid, numeric, text, boolean, text, boolean);
drop function if exists wholesale_update_service_pricing_intelligence(uuid, uuid, numeric, numeric);

-- 2. The four wholesale_price_history columns. Any recorded
--    pricing-intelligence history rows lose these values permanently — the
--    service_id/changed_by/changed_at columns on those rows are untouched
--    (they belong to the table itself, not this migration), so the rows
--    remain, just with these four cells gone.
alter table wholesale_price_history drop column if exists old_recommended_price;
alter table wholesale_price_history drop column if exists new_recommended_price;
alter table wholesale_price_history drop column if exists old_target_margin_percent;
alter table wholesale_price_history drop column if exists new_target_margin_percent;

-- 3. The two wholesale_services CHECK constraints and columns. Any
--    recommended_price/target_margin_percent an admin has set is lost.
alter table wholesale_services drop constraint if exists wholesale_services_recommended_price_check;
alter table wholesale_services drop constraint if exists wholesale_services_target_margin_percent_check;
alter table wholesale_services drop column if exists recommended_price;
alter table wholesale_services drop column if exists target_margin_percent;

-- 4. wholesale_portal_settings — the whole table, including whatever the
--    admin has configured (default margin, rounding rule, Sales module
--    state). Gone entirely once this runs.
drop table if exists wholesale_portal_settings;

commit;
