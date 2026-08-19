-- ============================================================================
-- Rollback for wholesale-price-tiers-migration.sql — REFERENCE ONLY
-- ============================================================================
-- This file is NOT run automatically by anything — no script, no test, no CI
-- step references it. It exists so that IF this migration is ever run for
-- real and needs to be undone, the exact, reviewed steps already exist
-- instead of being improvised under pressure.
--
-- Corrected design (see wholesale-price-tiers-migration.sql's header): the
-- migration this rolls back NEVER touches wholesale_update_service_full()
-- (v1) — it only creates a new, separately-named function,
-- wholesale_update_service_full_v2. Rolling back the RPC layer is therefore
-- a single DROP of v2 — there is no "restore the original body" step
-- needed, because v1's body was never replaced in the first place.
--
-- Any edit made through wholesale_update_service_full_v2 before this
-- rollback runs is permanent in the data (the rows and columns it wrote are
-- ordinary data) — running this file does not erase competitive_price/
-- high_profit_price values already saved on any service, it only removes
-- the columns themselves (and therefore those values) if you explicitly
-- keep the DROP COLUMN statements in section 2. If you only want to stop
-- new tier edits from being possible, without losing any tier data a shop
-- may already be relying on in the running application, skip section 2
-- entirely and stop after section 1.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Non-destructive: remove ONLY wholesale_update_service_full_v2.
--    wholesale_update_service_full() (v1) is not referenced anywhere in
--    this section and is left exactly as it is — it was never modified by
--    the migration this undoes, so there is nothing to restore for it.
-- ----------------------------------------------------------------------------
drop function if exists public.wholesale_update_service_full_v2(
  uuid, uuid, text, text, boolean, text, numeric, numeric, numeric, text, numeric, numeric, numeric, numeric
);

-- ----------------------------------------------------------------------------
-- 2. Drop the price-tier columns and their constraints. OPTIONAL — comment
--    this whole section out (or simply stop after section 1 above) if you
--    want to keep any competitive_price/high_profit_price data a shop is
--    already relying on in the running application while still disabling
--    new tier edits (section 1 already removed the only function that can
--    write to these columns).
-- ----------------------------------------------------------------------------
alter table wholesale_services drop constraint if exists wholesale_services_price_tiers_check;
alter table wholesale_services drop constraint if exists wholesale_services_competitive_price_check;
alter table wholesale_services drop constraint if exists wholesale_services_high_profit_price_check;
alter table wholesale_services drop column if exists competitive_price;
alter table wholesale_services drop column if exists high_profit_price;

alter table wholesale_price_history drop column if exists old_competitive_price;
alter table wholesale_price_history drop column if exists new_competitive_price;
alter table wholesale_price_history drop column if exists old_high_profit_price;
alter table wholesale_price_history drop column if exists new_high_profit_price;

commit;
