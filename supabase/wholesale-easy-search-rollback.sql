-- ============================================================================
-- Rollback for wholesale-easy-search-migration.sql — REFERENCE ONLY
-- ============================================================================
-- This file is NOT run automatically by anything — no script, no test, no CI
-- step references it. It exists so that IF this migration is ever run for
-- real and needs to be undone, the exact, reviewed steps already exist
-- instead of being improvised under pressure.
--
-- Non-destructive by construction: the actual "drop table" statements for
-- wholesale_device_models / wholesale_device_model_codes are commented out
-- at the bottom of this file, on purpose. By the time a rollback is ever
-- needed, an admin may already have loaded real device/code data through
-- Desk's Easy Search panel (manually or via CSV import) — dropping the
-- tables would destroy that commercial data, which is never an acceptable
-- automated step. Run supabase/wholesale-easy-search-verify.sql first if you
-- want to know what's actually in these tables before deciding whether to
-- drop them at all.
-- ============================================================================

begin;

-- Reverse order of creation.

-- 1. Triggers.
drop trigger if exists trg_wholesale_device_model_codes_touch_updated_at on wholesale_device_model_codes;
drop trigger if exists trg_wholesale_device_models_touch_updated_at on wholesale_device_models;
drop function if exists wholesale_easy_search_touch_updated_at();

-- 2. Indexes (codes table).
drop index if exists idx_wholesale_device_model_codes_active;
drop index if exists idx_wholesale_device_model_codes_model;
drop index if exists uq_wholesale_device_model_codes_normalized;

-- 3. Indexes (models table).
drop index if exists idx_wholesale_device_models_active;
drop index if exists idx_wholesale_device_models_brand;
drop index if exists idx_wholesale_device_models_catalog_model;

-- 4. CHECK constraints.
alter table wholesale_device_model_codes drop constraint if exists wholesale_device_model_codes_normalized_not_blank;
alter table wholesale_device_model_codes drop constraint if exists wholesale_device_model_codes_code_not_blank;
alter table wholesale_device_models drop constraint if exists wholesale_device_models_commercial_name_not_blank;
alter table wholesale_device_models drop constraint if exists wholesale_device_models_brand_not_blank;

commit;

-- ============================================================================
-- 5. The tables themselves — NOT part of the transaction above, and
--    commented out on purpose (see this file's header). Uncomment and run
--    only after confirming (via wholesale-easy-search-verify.sql or a
--    direct row count) that there is no real device/code data worth
--    keeping, or after that data has been deliberately exported/migrated
--    elsewhere first. wholesale_device_model_codes must be dropped before
--    wholesale_device_models (its foreign key depends on it) — though
--    "cascade" on wholesale_device_models would also take the codes table's
--    ROWS with it via ON DELETE CASCADE, dropping the codes TABLE itself
--    still needs to happen first or explicitly, since a table drop is not
--    implied by another table's row-level cascade:
--
--   drop table if exists wholesale_device_model_codes;
--   drop table if exists wholesale_device_models;
-- ============================================================================
