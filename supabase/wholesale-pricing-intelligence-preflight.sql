-- ============================================================================
-- Preflight — read-only sanity check, run BEFORE
-- wholesale-pricing-intelligence-migration.sql
-- ============================================================================
-- ONE statement, ONE result table — same convention as
-- wholesale-images-preflight.sql. Paste this whole file into the SQL Editor
-- and run it once.
--
-- Entirely read-only: only SELECT/WITH, nothing that inserts, updates,
-- deletes, alters, creates, drops, or calls any RPC/stored function. Never
-- reads a shop name, code hash, device/session token hash, cookie value, or
-- API/service-role key — this file only ever touches
-- wholesale_portal_settings, wholesale_services, wholesale_price_history,
-- and profiles (existence-only, via pg_constraint, never row contents).
--
-- Order of operations:
--   1. Run this file. Read the check_name/status/details rows, and the
--      final OVERALL STATUS row.
--   2. Only if OVERALL STATUS is PASS, run
--      wholesale-pricing-intelligence-migration.sql. REVIEW REQUIRED means
--      read the flagged row(s) yourself and decide — never treat it as an
--      automatic go-ahead. FAIL means fix what's flagged first.
--   3. Run wholesale-pricing-intelligence-verify.sql afterward to confirm it
--      landed.
-- ============================================================================

with raw as (
  select
    exists (select 1 from information_schema.tables where table_name = 'wholesale_portal_settings') as settings_table_exists,
    exists (select 1 from information_schema.columns where table_name = 'wholesale_services' and column_name = 'recommended_price') as services_has_recommended_price,
    exists (select 1 from information_schema.columns where table_name = 'wholesale_services' and column_name = 'target_margin_percent') as services_has_target_margin_percent,
    exists (select 1 from information_schema.columns where table_name = 'wholesale_price_history' and column_name = 'old_recommended_price') as history_has_pricing_intelligence_columns,
    exists (select 1 from pg_proc where proname = 'wholesale_update_service_pricing_intelligence') as rpc_pricing_intelligence_exists,
    exists (select 1 from pg_proc where proname = 'wholesale_update_portal_settings') as rpc_portal_settings_exists,
    exists (select 1 from pg_proc where proname = 'wholesale_update_service_price') as existing_price_rpc_exists,
    exists (select 1 from information_schema.tables where table_name = 'wholesale_services') as services_table_exists,
    exists (select 1 from information_schema.tables where table_name = 'wholesale_price_history') as history_table_exists,
    exists (select 1 from information_schema.tables where table_name = 'profiles') as profiles_table_exists,
    (select count(*) from wholesale_services) as total_services,
    (select count(*) from wholesale_services where recommended_price is not null) as services_with_manual_recommended_price,
    (select count(*) from wholesale_services where target_margin_percent is not null) as services_with_target_margin
),
checks as (
  select 1 as ord, 'prerequisite_tables_exist' as check_name,
    case when services_table_exists and history_table_exists and profiles_table_exists
      then 'PASS' else 'FAIL' end as status,
    case when services_table_exists and history_table_exists and profiles_table_exists
      then 'wholesale_services, wholesale_price_history, and profiles all exist — safe to proceed'
      else 'one or more prerequisite tables are missing (wholesale_services=' || services_table_exists
        || ', wholesale_price_history=' || history_table_exists || ', profiles=' || profiles_table_exists
        || ') — run wholesale-migration.sql and wholesale-navigation-migration.sql first'
    end as details
  from raw

  union all

  select 2, 'existing_price_rpc_untouched',
    case when existing_price_rpc_exists then 'PASS' else 'REVIEW REQUIRED' end,
    case when existing_price_rpc_exists
      then 'wholesale_update_service_price already exists — this migration adds a SIBLING function, never modifies this one'
      else 'wholesale_update_service_price was not found — expected from wholesale-navigation-migration.sql, investigate before proceeding'
    end
  from raw

  union all

  select 3, 'already_applied',
    case
      when settings_table_exists and services_has_recommended_price and services_has_target_margin_percent
        and history_has_pricing_intelligence_columns and rpc_pricing_intelligence_exists and rpc_portal_settings_exists
        then 'PASS'
      when not settings_table_exists and not services_has_recommended_price and not services_has_target_margin_percent
        and not history_has_pricing_intelligence_columns and not rpc_pricing_intelligence_exists and not rpc_portal_settings_exists
        then 'PASS'
      else 'REVIEW REQUIRED'
    end,
    case
      when settings_table_exists and services_has_recommended_price and services_has_target_margin_percent
        and history_has_pricing_intelligence_columns and rpc_pricing_intelligence_exists and rpc_portal_settings_exists
        then 'every object already present — migration already ran, safe to re-run, it is idempotent'
      when not settings_table_exists and not services_has_recommended_price and not services_has_target_margin_percent
        and not history_has_pricing_intelligence_columns and not rpc_pricing_intelligence_exists and not rpc_portal_settings_exists
        then 'none of the new objects exist yet — expected state before running the migration for the first time'
      else 'partial state — settings_table=' || settings_table_exists
        || ', services.recommended_price=' || services_has_recommended_price
        || ', services.target_margin_percent=' || services_has_target_margin_percent
        || ', history_columns=' || history_has_pricing_intelligence_columns
        || ', rpc_pricing_intelligence=' || rpc_pricing_intelligence_exists
        || ', rpc_portal_settings=' || rpc_portal_settings_exists
        || ' — investigate before running the migration, a prior run may have failed partway through'
    end
  from raw

  union all

  select 4, 'existing_services_untouched', 'PASS',
    'total services=' || total_services || ', with manual recommended_price=' || services_with_manual_recommended_price
      || ', with target_margin_percent override=' || services_with_target_margin
      || ' (both counts expected 0 on an environment where this feature has never been used yet — this migration never sets either column on an existing row)'
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
    'PASS = safe to run wholesale-pricing-intelligence-migration.sql. REVIEW REQUIRED = read every row above '
      || 'marked REVIEW REQUIRED yourself before deciding, never auto-cleared to PASS by this file. FAIL = fix '
      || 'the flagged row(s) first, the migration will not apply cleanly as-is.'
  from overall
) t
order by ord;
