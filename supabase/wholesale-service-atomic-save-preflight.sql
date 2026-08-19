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
-- Schema-qualified throughout: every information_schema.tables /
-- information_schema.columns lookup is scoped to table_schema = 'public',
-- and every pg_proc lookup joins pg_namespace and restricts to
-- nspname = 'public' — never a schema-less match that could silently
-- resolve to a same-named object in another schema.
--
-- RPC checks verify the EXACT signature (pg_get_function_identity_arguments)
-- and require exactly one function by that name to exist — never just "a
-- function with a matching signature happens to exist somewhere among
-- several overloads". The wholesale_update_service_full signature checked
-- here is derived directly from wholesale-service-atomic-save-migration.sql
-- (12 arguments, in the order that file declares them).
--
-- microsoldering_tag_row_exists checks for the exact ('microsoldering')
-- row in wholesale_tags via EXISTS, exposing only a boolean — the RPC
-- raises microsoldering_tag_missing and saves nothing at all if an admin
-- requests the tag with p_is_microsoldering = true and this row is absent,
-- so a missing tag row is a real prerequisite gap, not a cosmetic one. One
-- honest caveat, unlike every other check in this file: this is the only
-- check that reads real table rows rather than pure catalog metadata, so
-- it requires wholesale_tags to already exist as a table — exactly the
-- same precondition this whole file already states (run wholesale-
-- navigation-migration.sql, which creates that table, first). If that
-- table is somehow absent despite the stated prerequisites, this specific
-- query fails to parse and the whole preflight errors out instead of
-- degrading to a graceful FAIL row, unlike prerequisite_objects_exist's
-- metadata-only checks above it.
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
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'wholesale_services') as services_table_exists,
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'wholesale_price_history') as history_table_exists,
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'wholesale_tags') as tags_table_exists,
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'wholesale_service_tags') as service_tags_table_exists,
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles') as profiles_table_exists,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_services' and column_name = 'recommended_price') as services_has_recommended_price,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_services' and column_name = 'target_margin_percent') as services_has_target_margin_percent,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_price_history' and column_name = 'old_recommended_price') as history_has_old_recommended_price,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_price_history' and column_name = 'new_recommended_price') as history_has_new_recommended_price,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_price_history' and column_name = 'old_target_margin_percent') as history_has_old_target_margin_percent,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_price_history' and column_name = 'new_target_margin_percent') as history_has_new_target_margin_percent,

    exists (select 1 from public.wholesale_tags where slug = 'microsoldering') as microsoldering_tag_row_exists,

    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_service_price') as price_rpc_name_matches,
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_service_price' and pg_get_function_identity_arguments(p.oid) = 'p_service_id uuid, p_admin_id uuid, p_pricing_type text, p_fixed_price numeric, p_price_min numeric, p_price_max numeric, p_currency text') as price_rpc_exact_matches,

    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_service_full') as full_rpc_name_matches,
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_service_full' and pg_get_function_identity_arguments(p.oid) = 'p_service_id uuid, p_admin_id uuid, p_name text, p_notes text, p_is_microsoldering boolean, p_pricing_type text, p_fixed_price numeric, p_price_min numeric, p_price_max numeric, p_currency text, p_recommended_price numeric, p_target_margin_percent numeric') as full_rpc_exact_matches
),
derived as (
  select
    raw.*,
    (
      history_has_old_recommended_price
      and history_has_new_recommended_price
      and history_has_old_target_margin_percent
      and history_has_new_target_margin_percent
    ) as history_has_all_pricing_intelligence_columns
  from raw
),
checks as (
  select 1 as ord, 'prerequisite_objects_exist' as check_name,
    case when services_table_exists and history_table_exists and tags_table_exists
      and service_tags_table_exists and profiles_table_exists
      and services_has_recommended_price and services_has_target_margin_percent
      and history_has_all_pricing_intelligence_columns
      then 'PASS' else 'FAIL' end as status,
    'services=' || services_table_exists || ', history=' || history_table_exists
      || ', tags=' || tags_table_exists || ', service_tags=' || service_tags_table_exists
      || ', profiles=' || profiles_table_exists
      || ', services.recommended_price=' || services_has_recommended_price
      || ', services.target_margin_percent=' || services_has_target_margin_percent
      || ', history.old_recommended_price=' || history_has_old_recommended_price
      || ', history.new_recommended_price=' || history_has_new_recommended_price
      || ', history.old_target_margin_percent=' || history_has_old_target_margin_percent
      || ', history.new_target_margin_percent=' || history_has_new_target_margin_percent
      || ' — if anything above is false, run wholesale-migration.sql, wholesale-navigation-migration.sql, '
      || 'and wholesale-pricing-intelligence-migration.sql first' as details
  from derived

  union all

  select 2, 'microsoldering_tag_row_exists',
    case when microsoldering_tag_row_exists then 'PASS' else 'FAIL' end,
    case when microsoldering_tag_row_exists
      then 'wholesale_tags has a row with slug = ''microsoldering'' — requesting the tag via wholesale_update_service_full will resolve correctly'
      else 'wholesale_tags has no row with slug = ''microsoldering'' — requesting the tag (p_is_microsoldering = true) will raise microsoldering_tag_missing and save nothing at all; run wholesale-navigation-migration.sql''s tag seed first'
    end
  from derived

  union all

  select 3, 'existing_rpcs_untouched',
    case when price_rpc_name_matches = 1 and price_rpc_exact_matches = 1 then 'PASS' else 'REVIEW REQUIRED' end,
    case
      when price_rpc_name_matches = 1 and price_rpc_exact_matches = 1
        then 'wholesale_update_service_price exists exactly once, with the exact expected signature — this migration creates a SIBLING RPC, wholesale_update_service_full, and never modifies wholesale_update_service_price'
      when price_rpc_name_matches = 0
        then 'wholesale_update_service_price was not found — investigate before proceeding'
      when price_rpc_name_matches > 1
        then price_rpc_name_matches || ' functions named wholesale_update_service_price exist in public — an unexpected overload must never silently pass this check, expected exactly 1'
      else 'a function named wholesale_update_service_price exists in public but its argument list does not match the expected signature — name alone is never treated as a match'
    end
  from derived

  union all

  select 4, 'already_applied',
    case
      when full_rpc_name_matches = 0 then 'PASS'
      when full_rpc_name_matches = 1 and full_rpc_exact_matches = 1 then 'PASS'
      else 'REVIEW REQUIRED'
    end,
    case
      when full_rpc_name_matches = 0
        then 'wholesale_update_service_full does not exist yet — expected state before running the migration for the first time'
      when full_rpc_name_matches = 1 and full_rpc_exact_matches = 1
        then 'wholesale_update_service_full already exists with the exact expected 12-argument signature — migration already ran, safe to re-run (create or replace)'
      when full_rpc_name_matches = 1
        then 'wholesale_update_service_full exists but its argument list does not match the signature this migration creates — investigate before proceeding, never assume create or replace will simply fix a mismatched signature'
      else full_rpc_name_matches || ' functions named wholesale_update_service_full exist in public — an unexpected overload must never be silently accepted as "already applied", investigate before proceeding'
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
    'PASS = safe to run wholesale-service-atomic-save-migration.sql. REVIEW REQUIRED = read every row above '
      || 'marked REVIEW REQUIRED yourself before deciding, never auto-cleared to PASS by this file. FAIL = fix '
      || 'the flagged row(s) first, the migration will not apply cleanly as-is.'
  from overall
) t
order by ord;
