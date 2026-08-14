-- ============================================================================
-- Rollback for wholesale-navigation-migration.sql — REFERENCE ONLY
-- ============================================================================
-- This file is NOT run automatically by anything — no script, no test, no
-- CI step references it. It exists so that IF this migration is ever run
-- for real and needs to be undone, the exact, reviewed steps already exist
-- instead of being improvised under pressure.
--
-- Every statement below is destructive. Read wholesale-navigation-verify.sql
-- first if you want to know what's actually in these tables before dropping
-- anything. Run manually, one statement at a time, only with the owner's
-- explicit go-ahead for THIS specific rollback — the same bar as running the
-- forward migration in the first place.
--
-- Everything wholesale-migration.sql created (wholesale_shops, _devices,
-- _sessions, _access_log) is NOT touched by this file — this only undoes
-- what wholesale-navigation-migration.sql added.
-- ============================================================================

begin;

-- Reverse order of creation, so foreign keys never block a drop.

-- Function signature includes the p_currency parameter added alongside the
-- currency hardening — must match exactly or DROP FUNCTION fails to find it.
drop function if exists wholesale_update_service_price(uuid, uuid, text, numeric, numeric, numeric, text);
-- REVOKE/GRANT need no explicit undo — they vanish with the function itself.

drop table if exists wholesale_price_history;

drop table if exists wholesale_images;

drop table if exists wholesale_service_tags;
drop table if exists wholesale_tags;

-- Only drop what this migration added to wholesale_services — never touch
-- pricing_type/fixed_price/price_min/price_max themselves, or the table
-- stops working entirely for the auth/portal features this migration was
-- never meant to affect.
alter table wholesale_services drop constraint if exists wholesale_services_currency_check;
alter table wholesale_services drop column if exists currency;

alter table wholesale_services drop constraint if exists wholesale_services_pricing_values_check;
alter table wholesale_services drop constraint if exists wholesale_services_pricing_type_check;
-- Restores the original fixed/range-only rule (matches wholesale-migration.sql):
alter table wholesale_services add constraint wholesale_services_pricing_type_check
  check (pricing_type in ('fixed', 'range'));
-- Note: if any row was ever actually saved with pricing_type = 'quote' before
-- this rollback runs, the constraint above will reject the rollback itself —
-- that row has to be fixed or removed by hand first. This is intentional:
-- silently deleting a shop's real quote-priced service data is worse than a
-- rollback that stops and asks a human to look.

alter table wholesale_categories drop column if exists equipment_type_id;

drop table if exists wholesale_equipment_types;

commit;
