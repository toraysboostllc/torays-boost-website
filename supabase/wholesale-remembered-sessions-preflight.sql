-- ============================================================================
-- Preflight — read-only sanity check, run BEFORE
-- wholesale-remembered-sessions-migration.sql
-- ============================================================================
-- ONE statement, ONE result table — same convention as every other preflight
-- in this folder (see wholesale-global-warranty-preflight.sql).
--
-- Scope of the migration this preflights: exactly ONE new column,
-- wholesale_sessions.remembered boolean not null default true — nothing
-- else. No new table, no new RPC, no change to wholesale_shops,
-- wholesale_devices, or any other wholesale_* table. Existing rows all get
-- `true` via the DEFAULT (pre-migration, every session that was ever minted
-- behaved as fully persistent/remembered — this is a correct, non-lossy
-- backfill, not a guess).
--
-- Metadata-only — reads exclusively from information_schema.tables/columns,
-- never a row out of wholesale_sessions itself (row-level confirmation
-- belongs in wholesale-remembered-sessions-verify.sql, which only ever runs
-- AFTER the migration).
--
-- Order of operations:
--   1. Run this file. Read the check_name/status/details rows, and the final
--      OVERALL STATUS row.
--   2. Only if OVERALL STATUS is PASS, run
--      wholesale-remembered-sessions-migration.sql. REVIEW REQUIRED means
--      read the flagged row(s) yourself and decide — never treat it as an
--      automatic go-ahead. FAIL means fix what's flagged first.
--   3. Run wholesale-remembered-sessions-verify.sql afterward to confirm it
--      landed.
-- ============================================================================

with raw as (
  select
    exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'wholesale_sessions'
    ) as sessions_table_exists,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'wholesale_sessions' and column_name = 'remembered'
    ) as has_remembered_column
),
checks as (
  select 1 as ord, 'prerequisite_table_exists' as check_name,
    case when sessions_table_exists then 'PASS' else 'FAIL' end as status,
    case when sessions_table_exists
      then 'wholesale_sessions already exists — safe to proceed'
      else 'wholesale_sessions was not found — run wholesale-migration.sql first (it creates this table)'
    end as details
  from raw

  union all

  select 2, 'already_applied',
    case when has_remembered_column then 'PASS' else 'PASS' end,
    case when has_remembered_column
      then 'remembered column already exists — migration already ran, safe to re-run, it is idempotent'
      else 'remembered column does not exist yet — expected state before running the migration for the first time'
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
    'PASS = safe to run wholesale-remembered-sessions-migration.sql. REVIEW REQUIRED = read every row above marked '
      || 'REVIEW REQUIRED yourself before deciding, never auto-cleared to PASS by this file. FAIL = fix the flagged '
      || 'row(s) first, the migration will not apply cleanly as-is.'
  from overall
) t
order by ord;
