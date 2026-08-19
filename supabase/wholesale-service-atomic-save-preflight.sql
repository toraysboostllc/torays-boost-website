-- ============================================================================
-- Preflight — read-only sanity check, run BEFORE
-- wholesale-service-atomic-save-migration.sql
-- ============================================================================
-- ONE statement, ONE result table — same convention as every other
-- preflight in this project. Paste this whole file into the SQL Editor and
-- run it once.
--
-- Entirely read-only: only SELECT/WITH, nothing that inserts, updates,
-- deletes, alters, creates, drops, or calls any RPC/stored function.
--
-- Order of operations:
--   1. Run this file. Read the check_name/status/details rows, and the
--      final OVERALL STATUS row.
--   2. Only if OVERALL STATUS is PASS, run
--      wholesale-service-atomic-save-migration.sql. REVIEW REQUIRED means
--      read the flagged row(s) yourself and decide — never treat it as an
--      automatic go-ahead. FAIL means fix what's flagged first.
--   3. Run wholesale-service-atomic-save-verify.sql afterward to confirm it
--      landed.
-- ============================================================================

with raw as (
  select
    exists (select 1 from information_schema.tables where table_name = 'wholesale_services') as services_table_exists,
    exists (select 1 from information_schema.tables where table_name = 'wholesale_price_history') as history_table_exists,
    exists (select 1 from information_schema.tables where table_name = 'wholesale_tags') as tags_table_exists,
    exists (select 1 from information_schema.tables where table_name = 'wholesale_service_tags') as service_tags_table_exists,
    exists (select 1 from information_schema.tables where table_name = 'profiles') as profiles_table_exists,
    exists (select 1 from information_schema.columns where table_name = 'wholesale_services' and column_name = 'recommended_price') as services_has_recommended_price,
    exists (select 1 from information_schema.columns where table_name = 'wholesale_services' and column_name = 'target_margin_percent') as services_has_target_margin_percent,
    exists (select 1 from information_schema.columns where table_name = 'wholesale_price_history' and column_name = 'old_recommended_price') as history_has_pricing_intelligence_columns,
    exists (select 1 from pg_proc where proname = 'wholesale_update_service_price') as rpc_price_exists,
    exists (select 1 from pg_proc where proname = 'wholesale_update_service_pricing_intelligence') as rpc_pricing_intelligence_exists,
    exists (select 1 from pg_proc where proname = 'wholesale_update_service_full') as rpc_full_exists
),
checks as (
  select 1 as ord, 'prerequisite_objects_exist' as check_name,
    case when services_table_exists and history_table_exists and tags_table_exists
      and service_tags_table_exists and profiles_table_exists
      and services_has_recommended_price and services_has_target_margin_percent
      and history_has_pricing_intelligence_columns
      then 'PASS' else 'FAIL' end as status,
    'services=' || services_table_exists || ', history=' || history_table_exists
      || ', tags=' || tags_table_exists || ', service_tags=' || service_tags_table_exists
      || ', profiles=' || profiles_table_exists
      || ', services.recommended_price=' || services_has_recommended_price
      || ', services.target_margin_percent=' || services_has_target_margin_percent
      || ', history pricing-intelligence columns=' || history_has_pricing_intelligence_columns
      || ' — if anything above is false, run wholesale-migration.sql, wholesale-navigation-migration.sql, '
      || 'and wholesale-pricing-intelligence-migration.sql first'
  from raw

  union all

  select 2, 'existing_rpcs_untouched',
    case when rpc_price_exists and rpc_pricing_intelligence_exists then 'PASS' else 'REVIEW REQUIRED' end,
    case when rpc_price_exists and rpc_pricing_intelligence_exists
      then 'wholesale_update_service_price and wholesale_update_service_pricing_intelligence both already exist — this migration adds a SIBLING function, never modifies either one'
      else 'one or both existing per-concern RPCs were not found (price=' || rpc_price_exists
        || ', pricing_intelligence=' || rpc_pricing_intelligence_exists || ') — investigate before proceeding'
    end
  from raw

  union all

  select 3, 'already_applied',
    case
      when rpc_full_exists then 'PASS'
      when not rpc_full_exists then 'PASS'
    end,
    case
      when rpc_full_exists then 'wholesale_update_service_full already exists — migration already ran, safe to re-run (create or replace)'
      else 'wholesale_update_service_full does not exist yet — expected state before running the migration for the first time'
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
    'PASS = safe to run wholesale-service-atomic-save-migration.sql. REVIEW REQUIRED = read every row above '
      || 'marked REVIEW REQUIRED yourself before deciding, never auto-cleared to PASS by this file. FAIL = fix '
      || 'the flagged row(s) first, the migration will not apply cleanly as-is.'
  from overall
) t
order by ord;
