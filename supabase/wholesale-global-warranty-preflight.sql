-- ============================================================================
-- Preflight — read-only sanity check, run BEFORE
-- wholesale-global-warranty-migration.sql
-- ============================================================================
-- ONE statement, ONE result table — same convention as every other preflight
-- in this folder (see wholesale-pricing-intelligence-preflight.sql). Paste
-- this whole file into the SQL Editor and run it once.
--
-- Global warranty, NOT per-service: this feature adds exactly 4 new columns
-- to the EXISTING wholesale_portal_settings singleton row (the same table
-- DESK's "Pricing & Sales Settings" panel already reads/writes — see
-- wholesale-pricing-intelligence-migration.sql, which created it) and ONE
-- new RPC, wholesale_update_portal_settings_v2. It does not touch
-- wholesale_services, wholesale_categories, wholesale_equipment_types, or
-- wholesale_price_history in any way — there is no per-service warranty
-- concept in this migration at all.
--
-- Metadata-only, on purpose: every check here reads exclusively from
-- information_schema.tables, information_schema.columns, and pg_proc joined
-- to pg_namespace — never a row out of wholesale_portal_settings itself
-- (row-level confirmation belongs in wholesale-global-warranty-verify.sql,
-- which only ever runs AFTER the migration). Every information_schema.*
-- lookup is scoped to table_schema = 'public', and every pg_proc lookup
-- joins pg_namespace and restricts to nspname = 'public'.
--
-- Order of operations:
--   1. Run this file. Read the check_name/status/details rows, and the final
--      OVERALL STATUS row.
--   2. Only if OVERALL STATUS is PASS, run
--      wholesale-global-warranty-migration.sql. REVIEW REQUIRED means read
--      the flagged row(s) yourself and decide — never treat it as an
--      automatic go-ahead. FAIL means fix what's flagged first.
--   3. Run wholesale-global-warranty-verify.sql afterward to confirm it
--      landed.
-- ============================================================================

with raw as (
  select
    exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'wholesale_portal_settings'
    ) as settings_table_exists,
    exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'profiles'
    ) as profiles_table_exists,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'wholesale_portal_settings' and column_name = 'warranty_enabled'
    ) as has_warranty_enabled,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'wholesale_portal_settings' and column_name = 'warranty_duration_days'
    ) as has_warranty_duration_days,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'wholesale_portal_settings' and column_name = 'warranty_terms_en'
    ) as has_warranty_terms_en,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'wholesale_portal_settings' and column_name = 'warranty_terms_es'
    ) as has_warranty_terms_es,
    exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'wholesale_update_portal_settings'
    ) as rpc_v1_exists,
    exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'wholesale_update_portal_settings_v2'
    ) as rpc_v2_exists
),
derived as (
  select
    raw.*,
    (has_warranty_enabled and has_warranty_duration_days and has_warranty_terms_en and has_warranty_terms_es) as has_all_warranty_columns,
    (has_warranty_enabled or has_warranty_duration_days or has_warranty_terms_en or has_warranty_terms_es) as has_any_warranty_column
  from raw
),
checks as (
  select 1 as ord, 'prerequisite_tables_exist' as check_name,
    case when settings_table_exists and profiles_table_exists then 'PASS' else 'FAIL' end as status,
    case when settings_table_exists and profiles_table_exists
      then 'wholesale_portal_settings and profiles both exist — safe to proceed'
      else 'one or more prerequisite tables are missing (wholesale_portal_settings=' || settings_table_exists
        || ', profiles=' || profiles_table_exists
        || ') — run wholesale-pricing-intelligence-migration.sql first (it creates wholesale_portal_settings)'
    end as details
  from derived

  union all

  select 2, 'existing_settings_rpc_v1_untouched',
    case when rpc_v1_exists then 'PASS' else 'REVIEW REQUIRED' end,
    case when rpc_v1_exists
      then 'wholesale_update_portal_settings (v1, 6 arguments) already exists — this migration adds a SIBLING function, wholesale_update_portal_settings_v2, and never modifies this one (same "never CREATE OR REPLACE with a different argument count" rule already established by wholesale-price-tiers-migration.sql for wholesale_update_service_full_v2)'
      else 'wholesale_update_portal_settings was not found — expected from wholesale-pricing-intelligence-migration.sql, investigate before proceeding'
    end
  from derived

  union all

  select 3, 'already_applied',
    case
      when has_all_warranty_columns and rpc_v2_exists then 'PASS'
      when not has_any_warranty_column and not rpc_v2_exists then 'PASS'
      else 'REVIEW REQUIRED'
    end,
    case
      when has_all_warranty_columns and rpc_v2_exists
        then 'every new object already present — migration already ran, safe to re-run, it is idempotent'
      when not has_any_warranty_column and not rpc_v2_exists
        then 'none of the new objects exist yet — expected state before running the migration for the first time'
      else 'partial state — warranty_enabled=' || has_warranty_enabled
        || ', warranty_duration_days=' || has_warranty_duration_days
        || ', warranty_terms_en=' || has_warranty_terms_en
        || ', warranty_terms_es=' || has_warranty_terms_es
        || ', rpc_v2=' || rpc_v2_exists
        || ' — investigate before running the migration, a prior run may have failed partway through'
    end
  from derived
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
    'PASS = safe to run wholesale-global-warranty-migration.sql. REVIEW REQUIRED = read every row above marked '
      || 'REVIEW REQUIRED yourself before deciding, never auto-cleared to PASS by this file. FAIL = fix the flagged '
      || 'row(s) first, the migration will not apply cleanly as-is.'
  from overall
) t
order by ord;
