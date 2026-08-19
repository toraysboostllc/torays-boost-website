-- ============================================================================
-- Preflight — read-only sanity check, run BEFORE
-- wholesale-price-tiers-migration.sql
-- ============================================================================
-- ONE statement, ONE result table — same convention as every other
-- preflight in this project. Paste this whole file into the SQL Editor and
-- run it once.
--
-- Entirely read-only: only SELECT/WITH, nothing that inserts, updates,
-- deletes, alters, creates, drops, or calls any RPC/stored function.
--
-- Schema-qualified throughout: every information_schema.tables /
-- information_schema.columns lookup is scoped to table_schema = 'public',
-- and every pg_proc lookup joins pg_namespace and restricts to
-- nspname = 'public' — never a schema-less match that could silently
-- resolve to a same-named object in another schema.
--
-- Corrected design (see wholesale-price-tiers-migration.sql's header for
-- the full reasoning): this migration NEVER modifies
-- wholesale_update_service_full() (v1, 12 arguments) — it only creates a
-- new, separately-named function, wholesale_update_service_full_v2. So this
-- preflight checks TWO independent things about the RPC layer:
--   - v1 exists exactly once, with its exact original 12-argument
--     signature, untouched. If more than one function named
--     wholesale_update_service_full exists, or its signature doesn't match
--     exactly, that is an unexpected overload and must be investigated
--     before proceeding — never silently accepted.
--   - v2 either doesn't exist yet (expected before the first run) or
--     already exists with the exact expected 14-argument signature
--     (expected on a safe idempotent re-run) — anything else is flagged for
--     review.
--
-- Order of operations:
--   1. Run this file. Read the check_name/status/details rows, and the
--      final OVERALL STATUS row.
--   2. Only if OVERALL STATUS is PASS, run
--      wholesale-price-tiers-migration.sql. REVIEW REQUIRED means read the
--      flagged row(s) yourself and decide — never treat it as an automatic
--      go-ahead. FAIL means fix what's flagged first.
--   3. Run wholesale-price-tiers-verify.sql afterward to confirm it landed.
-- ============================================================================

with raw as (
  select
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'wholesale_services') as services_table_exists,
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'wholesale_price_history') as history_table_exists,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_services' and column_name = 'recommended_price') as services_has_recommended_price,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_services' and column_name = 'fixed_price') as services_has_fixed_price,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_services' and column_name = 'pricing_type') as services_has_pricing_type,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_services' and column_name = 'competitive_price') as services_already_has_competitive_price,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_services' and column_name = 'high_profit_price') as services_already_has_high_profit_price,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_price_history' and column_name = 'old_competitive_price') as history_already_has_old_competitive_price,

    -- v1 (wholesale_update_service_full) — must exist EXACTLY once, with
    -- its exact original 12-argument signature. This migration never
    -- touches v1, so its expected state is identical before and after.
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_service_full') as v1_name_matches,
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_service_full' and pg_get_function_identity_arguments(p.oid) = 'p_service_id uuid, p_admin_id uuid, p_name text, p_notes text, p_is_microsoldering boolean, p_pricing_type text, p_fixed_price numeric, p_price_min numeric, p_price_max numeric, p_currency text, p_recommended_price numeric, p_target_margin_percent numeric') as v1_exact_12arg_matches,

    -- v2 (wholesale_update_service_full_v2) — must NOT exist yet (first
    -- run), or already exist with the exact expected 14-argument signature
    -- (idempotent re-run). Never a different name-vs-signature combination.
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_service_full_v2') as v2_name_matches,
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_service_full_v2' and pg_get_function_identity_arguments(p.oid) = 'p_service_id uuid, p_admin_id uuid, p_name text, p_notes text, p_is_microsoldering boolean, p_pricing_type text, p_fixed_price numeric, p_price_min numeric, p_price_max numeric, p_currency text, p_recommended_price numeric, p_target_margin_percent numeric, p_competitive_price numeric, p_high_profit_price numeric') as v2_exact_14arg_matches
),
checks as (
  select 1 as ord, 'prerequisite_objects_exist' as check_name,
    case when services_table_exists and history_table_exists
      and services_has_recommended_price and services_has_fixed_price and services_has_pricing_type
      then 'PASS' else 'FAIL' end as status,
    'services=' || services_table_exists || ', history=' || history_table_exists
      || ', services.recommended_price=' || services_has_recommended_price
      || ', services.fixed_price=' || services_has_fixed_price
      || ', services.pricing_type=' || services_has_pricing_type
      || ' — if anything above is false, run wholesale-migration.sql and wholesale-pricing-intelligence-migration.sql first'
      as details
  from raw

  union all

  select 2, 'v1_untouched_exact_12arg_signature',
    case
      when v1_name_matches = 1 and v1_exact_12arg_matches = 1 then 'PASS'
      else 'FAIL'
    end,
    case
      when v1_name_matches = 1 and v1_exact_12arg_matches = 1
        then 'wholesale_update_service_full exists exactly once, with the exact original 12-argument signature — this migration never modifies it, so this must hold both before and after applying it'
      when v1_name_matches = 0
        then 'wholesale_update_service_full does not exist at all — run wholesale-service-atomic-save-migration.sql first'
      when v1_name_matches > 1
        then v1_name_matches || ' functions named wholesale_update_service_full exist in public — an unexpected overload must never be silently accepted, investigate before proceeding'
      else 'wholesale_update_service_full exists but its argument list does not match the exact expected 12-argument signature — investigate before proceeding, do not assume this migration can safely apply'
    end
  from raw

  union all

  select 3, 'v2_absent_or_already_applied_cleanly',
    case
      when v2_name_matches = 0 then 'PASS'
      when v2_name_matches = 1 and v2_exact_14arg_matches = 1 then 'PASS'
      else 'REVIEW REQUIRED'
    end,
    case
      when v2_name_matches = 0
        then 'wholesale_update_service_full_v2 does not exist yet — expected state before running this migration for the first time'
      when v2_name_matches = 1 and v2_exact_14arg_matches = 1
        then 'wholesale_update_service_full_v2 already exists with the exact expected 14-argument signature — this migration already ran, safe to re-run (create or replace against the same signature)'
      when v2_name_matches > 1
        then v2_name_matches || ' functions named wholesale_update_service_full_v2 exist in public — an unexpected overload of the NEW function name, investigate before proceeding'
      else 'wholesale_update_service_full_v2 exists but its argument list does not match the exact expected 14-argument signature — a stale or hand-edited version may be present, investigate before proceeding'
    end
  from raw

  union all

  select 4, 'tier_columns_already_applied',
    case
      when not services_already_has_competitive_price and not services_already_has_high_profit_price and not history_already_has_old_competitive_price
        then 'PASS'
      when services_already_has_competitive_price and services_already_has_high_profit_price and history_already_has_old_competitive_price
        then 'PASS'
      else 'REVIEW REQUIRED'
    end,
    case
      when not services_already_has_competitive_price and not services_already_has_high_profit_price and not history_already_has_old_competitive_price
        then 'no price-tier columns found yet — expected state before running this migration for the first time'
      when services_already_has_competitive_price and services_already_has_high_profit_price and history_already_has_old_competitive_price
        then 'all price-tier columns already exist — migration already ran, safe to re-run (idempotent add-column/create-or-replace)'
      else 'services.competitive_price=' || services_already_has_competitive_price
        || ', services.high_profit_price=' || services_already_has_high_profit_price
        || ', history.old_competitive_price=' || history_already_has_old_competitive_price
        || ' — partially applied state, investigate before proceeding rather than assuming a clean re-run'
    end
  from raw
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
    'PASS = safe to run wholesale-price-tiers-migration.sql. REVIEW REQUIRED = read every row above marked '
      || 'REVIEW REQUIRED yourself before deciding, never auto-cleared to PASS by this file. FAIL = fix the '
      || 'flagged row(s) first, the migration will not apply cleanly as-is.'
  from overall
) t
order by ord;
