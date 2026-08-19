-- ============================================================================
-- Preflight — read-only sanity check, run BEFORE
-- wholesale-pricing-intelligence-migration.sql
-- ============================================================================
-- ONE statement, ONE result table — same convention as
-- wholesale-images-preflight.sql. Paste this whole file into the SQL Editor
-- and run it once.
--
-- Metadata-only, on purpose: every check here reads exclusively from
-- information_schema.tables, information_schema.columns, and pg_proc
-- joined to pg_namespace. It never reads a single row out of
-- wholesale_services, wholesale_price_history, wholesale_portal_settings,
-- or profiles. That's required, not just a style choice: before this
-- migration has ever run, wholesale_services.recommended_price and
-- .target_margin_percent do not exist yet. A query that references those
-- columns directly (even inside a WHERE, even if it would touch zero rows)
-- fails at parse/plan time with "column does not exist" — Postgres
-- resolves every column name in a query before it ever considers whether a
-- row would match — so this file never references them as real columns,
-- only ever as quoted text compared against a metadata table's own
-- column-name field. Row-count verification of those two columns (how many
-- services already have a manual override) belongs in
-- wholesale-pricing-intelligence-verify.sql, which only ever runs AFTER
-- the migration has added them — never here.
--
-- Every information_schema.tables / information_schema.columns check is
-- scoped to table_schema = 'public' (never a schema-less match that could
-- silently pick up a same-named object elsewhere), and every pg_proc check
-- joins pg_namespace and restricts to nspname = 'public' for the same
-- reason.
--
-- Order of operations:
--   1. Run this file. Read the check_name/status/details rows, and the
--      final OVERALL STATUS row.
--   2. Only if OVERALL STATUS is PASS, run
--      wholesale-pricing-intelligence-migration.sql. REVIEW REQUIRED means
--      read the flagged row(s) yourself and decide — never treat it as an
--      automatic go-ahead. FAIL means fix what's flagged first.
--   3. Run wholesale-pricing-intelligence-verify.sql afterward to confirm it
--      landed (including the recommended_price/target_margin_percent row
--      counts this file deliberately does not compute).
-- ============================================================================

with raw as (
  select
    exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'wholesale_services'
    ) as services_table_exists,
    exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'wholesale_price_history'
    ) as history_table_exists,
    exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'profiles'
    ) as profiles_table_exists,
    exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'wholesale_portal_settings'
    ) as settings_table_exists,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'wholesale_services' and column_name = 'recommended_price'
    ) as services_has_recommended_price,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'wholesale_services' and column_name = 'target_margin_percent'
    ) as services_has_target_margin_percent,
    -- The 4 pricing-intelligence history columns, checked individually —
    -- `derived` (below) turns these into TWO separate flags, never one
    -- ambiguous aggregate: history_has_all_pricing_intelligence_columns
    -- (AND of all 4 — required for "fully applied") and
    -- history_has_any_pricing_intelligence_column (OR of all 4 — its
    -- NEGATION is required for "nothing exists yet"). A single combined
    -- flag can't distinguish "0 of 4 exist" from "1, 2, or 3 of 4 exist"
    -- from whichever side of an AND/OR you pick, which is exactly the bug
    -- this split fixes: a partial state must satisfy NEITHER PASS branch.
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'wholesale_price_history' and column_name = 'old_recommended_price'
    ) as history_has_old_recommended_price,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'wholesale_price_history' and column_name = 'new_recommended_price'
    ) as history_has_new_recommended_price,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'wholesale_price_history' and column_name = 'old_target_margin_percent'
    ) as history_has_old_target_margin_percent,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'wholesale_price_history' and column_name = 'new_target_margin_percent'
    ) as history_has_new_target_margin_percent,
    exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'wholesale_update_portal_settings'
    ) as rpc_portal_settings_exists,
    exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'wholesale_update_service_price'
    ) as existing_price_rpc_exists
),
derived as (
  select
    raw.*,
    (
      history_has_old_recommended_price
      and history_has_new_recommended_price
      and history_has_old_target_margin_percent
      and history_has_new_target_margin_percent
    ) as history_has_all_pricing_intelligence_columns,
    (
      history_has_old_recommended_price
      or history_has_new_recommended_price
      or history_has_old_target_margin_percent
      or history_has_new_target_margin_percent
    ) as history_has_any_pricing_intelligence_column
  from raw
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
  from derived

  union all

  select 2, 'existing_price_rpc_untouched',
    case when existing_price_rpc_exists then 'PASS' else 'REVIEW REQUIRED' end,
    case when existing_price_rpc_exists
      then 'wholesale_update_service_price already exists — this migration adds a SIBLING function, never modifies this one'
      else 'wholesale_update_service_price was not found — expected from wholesale-navigation-migration.sql, investigate before proceeding'
    end
  from derived

  union all

  select 3, 'already_applied',
    case
      when settings_table_exists and services_has_recommended_price and services_has_target_margin_percent
        and history_has_all_pricing_intelligence_columns and rpc_portal_settings_exists
        then 'PASS'
      when not settings_table_exists and not services_has_recommended_price and not services_has_target_margin_percent
        and not history_has_any_pricing_intelligence_column and not rpc_portal_settings_exists
        then 'PASS'
      else 'REVIEW REQUIRED'
    end,
    case
      when settings_table_exists and services_has_recommended_price and services_has_target_margin_percent
        and history_has_all_pricing_intelligence_columns and rpc_portal_settings_exists
        then 'every object already present — migration already ran, safe to re-run, it is idempotent'
      when not settings_table_exists and not services_has_recommended_price and not services_has_target_margin_percent
        and not history_has_any_pricing_intelligence_column and not rpc_portal_settings_exists
        then 'none of the new objects exist yet — expected state before running the migration for the first time'
      else 'partial state — settings_table=' || settings_table_exists
        || ', services.recommended_price=' || services_has_recommended_price
        || ', services.target_margin_percent=' || services_has_target_margin_percent
        || ', history.old_recommended_price=' || history_has_old_recommended_price
        || ', history.new_recommended_price=' || history_has_new_recommended_price
        || ', history.old_target_margin_percent=' || history_has_old_target_margin_percent
        || ', history.new_target_margin_percent=' || history_has_new_target_margin_percent
        || ', rpc_portal_settings=' || rpc_portal_settings_exists
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
    'PASS = safe to run wholesale-pricing-intelligence-migration.sql. REVIEW REQUIRED = read every row above '
      || 'marked REVIEW REQUIRED yourself before deciding, never auto-cleared to PASS by this file. FAIL = fix '
      || 'the flagged row(s) first, the migration will not apply cleanly as-is.'
  from overall
) t
order by ord;
