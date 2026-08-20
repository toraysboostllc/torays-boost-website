-- ============================================================================
-- Preflight — read-only sanity check, run BEFORE wholesale-retention-migration.sql
-- ============================================================================
-- Same convention as wholesale-legal-preflight.sql: ONE statement, ONE result
-- table. Paste this whole file into the SQL Editor and run it once. Entirely
-- read-only — only SELECT/WITH, nothing that inserts, updates, deletes,
-- alters, creates, drops, or calls any RPC/stored function.
--
-- Schema-qualified throughout: every information_schema / pg_proc lookup is
-- scoped to table_schema/nspname = 'public', never a schema-less match.
--
-- Special check (4 below): confirms wholesale_run_data_retention does NOT
-- already exist as more than one overload. This migration will use
-- `create or replace function` with one exact signature — if a differently-
-- typed overload already exists from a prior hand-edit, `create or replace`
-- cannot fix that (Postgres treats a different argument-type list as a
-- distinct function), and this file flags it instead of the migration
-- silently leaving two versions callable.
--
-- Order of operations:
--   1. Run this file. Read the check_name/status/details rows, and the
--      final OVERALL STATUS row.
--   2. Only if OVERALL STATUS is PASS, run wholesale-retention-migration.sql.
--      REVIEW REQUIRED means read the flagged row(s) yourself and decide —
--      never treat it as an automatic go-ahead. FAIL means fix what's
--      flagged first.
--   3. Run wholesale-retention-verify.sql afterward to confirm it landed.
-- ============================================================================

with raw as (
  select
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'wholesale_access_log') as access_log_table_exists,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_access_log' and column_name = 'ip') as access_log_has_ip,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_access_log' and column_name = 'user_agent') as access_log_has_user_agent,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_access_log' and column_name = 'created_at') as access_log_has_created_at,

    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles') as profiles_table_exists,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'id') as profiles_has_id,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'role') as profiles_has_role,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'status') as profiles_has_status,

    -- Must NOT already exist — this migration creates it from scratch.
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'wholesale_retention_runs') as retention_runs_exists,

    -- How many overloads of wholesale_run_data_retention already exist, under
    -- ANY signature — expect 0 on a first run.
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'wholesale_run_data_retention') as retention_fn_overload_count,

    -- The 3 tables this procedure must never touch — confirmed to exist
    -- (from wholesale-legal-migration.sql) so the verify file's "never
    -- touched" checks have something real to snapshot against. Not a hard
    -- blocker if absent (retention doesn't depend on them structurally),
    -- but worth flagging if the legal bundle migration hasn't run yet.
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'wholesale_legal_documents') as legal_documents_exists,
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'wholesale_legal_acceptances') as legal_acceptances_exists,
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'wholesale_price_history') as price_history_exists
),
checks as (
  select 1 as ord, 'access_log_table_and_columns_present' as check_name,
    case when access_log_table_exists and access_log_has_ip and access_log_has_user_agent and access_log_has_created_at
      then 'PASS' else 'FAIL' end as status,
    'wholesale_access_log=' || access_log_table_exists
      || ' (ip=' || access_log_has_ip || ', user_agent=' || access_log_has_user_agent || ', created_at=' || access_log_has_created_at || ')'
      || ' — if false, run wholesale-migration.sql first'
      as details
  from raw

  union all

  select 2, 'profiles_table_and_columns_present',
    case when profiles_table_exists and profiles_has_id and profiles_has_role and profiles_has_status
      then 'PASS' else 'FAIL' end,
    'profiles=' || profiles_table_exists || ' (id=' || profiles_has_id || ', role=' || profiles_has_role || ', status=' || profiles_has_status || ')'
      || ' — profiles is created outside this repo (see supabase-setup.sql in the DESK project); if false, confirm it exists there first'
  from raw

  union all

  select 3, 'retention_runs_table_does_not_already_exist',
    case when not retention_runs_exists then 'PASS' else 'REVIEW REQUIRED' end,
    'wholesale_retention_runs exists=' || retention_runs_exists
      || ' — expect false on a first run (this migration creates it idempotently with IF NOT EXISTS, so '
      || 'REVIEW REQUIRED here is not necessarily a blocker on a re-run, but confirm it was not created '
      || 'out-of-band with a different shape before proceeding)'
  from raw

  union all

  select 4, 'retention_rpc_has_no_pre_existing_overload',
    case when retention_fn_overload_count = 0 then 'PASS'
      when retention_fn_overload_count = 1 then 'REVIEW REQUIRED'
      else 'FAIL' end,
    'wholesale_run_data_retention: ' || retention_fn_overload_count || ' existing overload(s) found — '
      || 'expect 0 on a first run. 1 is REVIEW REQUIRED (likely a prior run of this same migration; '
      || '`create or replace function` will safely replace it IF the argument list matches exactly — '
      || 'confirm it does before proceeding). 2+ means a differently-typed overload already exists and '
      || '`create or replace` cannot collapse it into one function; drop the extra overload manually first.'
  from raw

  union all

  select 5, 'legal_bundle_tables_present_for_verify_scope_checks',
    case when legal_documents_exists and legal_acceptances_exists and price_history_exists then 'PASS' else 'REVIEW REQUIRED' end,
    'wholesale_legal_documents=' || legal_documents_exists || ', wholesale_legal_acceptances=' || legal_acceptances_exists
      || ', wholesale_price_history=' || price_history_exists
      || ' — not a hard dependency for THIS migration (the retention procedure never references any of the '
      || 'three), but wholesale-retention-verify.sql''s "never touches these tables" checks are more '
      || 'meaningful with real tables to snapshot against; if any is false, run wholesale-legal-migration.sql '
      || 'first for a fuller verify pass (not strictly required to run this migration itself)'
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
    'PASS = safe to run wholesale-retention-migration.sql. REVIEW REQUIRED = read every row above marked '
      || 'REVIEW REQUIRED yourself before deciding, never auto-cleared to PASS by this file. FAIL = fix the '
      || 'flagged row(s) first, the migration will not apply cleanly or safely as-is.'
  from overall
) t
order by ord;
