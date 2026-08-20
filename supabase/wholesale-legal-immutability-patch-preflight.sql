-- ============================================================================
-- Preflight — run BEFORE wholesale-legal-immutability-patch-migration.sql
-- ============================================================================
-- Small, standalone patch on top of an ALREADY-EXECUTED
-- wholesale-legal-migration.sql. Do not confuse this with that file's own
-- preflight/migration/verify/rollback quartet — this one only hardens the
-- immutability protection on wholesale_legal_documents, nothing else.
--
-- Context: a real Supabase run surfaced that wholesale_legal_documents'
-- immutability guard trigger keyed its protection SOLELY on
-- `old.published_at is not null`. A row with status='published' (or
-- 'superseded') but published_at accidentally NULL — which should never
-- happen through the real wholesale_publish_legal_document RPC, but was
-- trivially producible by a hand-run INSERT, an incomplete test fixture, or
-- any future code path that forgets to set both fields together — was NOT
-- protected. This is a real defense-in-depth gap: the guard trusted a single
-- signal (published_at) instead of the row's actual lifecycle state
-- (status). This patch closes it two ways: (1) a CHECK constraint makes that
-- anomalous state impossible to create in the first place, and (2) the guard
-- itself is widened to also trigger on status alone, so it still protects
-- even if published_at were somehow null despite the constraint (a second
-- independent signal, not just a stricter version of the first).
--
-- ONE statement, ONE result table — same convention as every other preflight
-- in this project. Entirely read-only.
--
-- Order of operations:
--   1. Run this file. Read the check_name/status/details rows and the final
--      OVERALL STATUS row.
--   2. Only if OVERALL STATUS is PASS, run
--      wholesale-legal-immutability-patch-migration.sql. FAIL means fix
--      what's flagged first — in particular, check 2 below (offending rows)
--      must be corrected (set published_at on them, or reconsider their
--      status) BEFORE the new CHECK constraint can be added, or the ALTER
--      TABLE itself will fail with a check_violation against that existing
--      data.
--   3. Run wholesale-legal-immutability-patch-verify.sql afterward to
--      confirm it landed and actually works.
-- ============================================================================

with raw as (
  select
    exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'wholesale_legal_documents'
    ) as table_exists,
    exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'wholesale_legal_documents_immutability_guard'
    ) as guard_function_exists,
    exists (
      select 1 from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'wholesale_legal_documents'
        and t.tgname = 'trg_wholesale_legal_documents_immutability' and not t.tgisinternal
    ) as guard_trigger_exists,
    exists (
      select 1 from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'wholesale_legal_documents'
        and con.conname = 'wholesale_legal_documents_published_requires_published_at'
    ) as new_constraint_already_exists
),
offenders as (
  select
    count(*) as offender_count,
    string_agg(
      'id=' || id || ' version=' || coalesce(version, '(null)') || ' status=' || status,
      '; ' order by created_at
    ) as offender_details
  from wholesale_legal_documents
  where status in ('published', 'superseded') and published_at is null
),
checks as (
  select 1 as ord, 'prerequisite_table_and_guard_installed' as check_name,
    case when table_exists and guard_function_exists and guard_trigger_exists then 'PASS' else 'FAIL' end as status,
    'wholesale_legal_documents table exists=' || table_exists
      || ', immutability guard function exists=' || guard_function_exists
      || ', immutability guard trigger exists=' || guard_trigger_exists
      || ' — if any is false, run wholesale-legal-migration.sql first'
      as details
  from raw

  union all

  select 2, 'zero_published_or_superseded_rows_with_null_published_at',
    case when offender_count = 0 then 'PASS' else 'FAIL' end,
    'select count(*) from wholesale_legal_documents where status in (''published'',''superseded'') '
      || 'and published_at is null -> ' || offender_count
      || ' — must be 0 before the new CHECK constraint can be added (it would otherwise reject the whole ALTER '
      || 'TABLE against this existing data). Offending rows: ' || coalesce(offender_details, '(none)')
  from offenders

  union all

  select 3, 'new_constraint_not_already_present',
    case when not new_constraint_already_exists then 'PASS' else 'REVIEW REQUIRED' end,
    'wholesale_legal_documents_published_requires_published_at already exists=' || new_constraint_already_exists
      || ' — expect false on a first run. If true, this patch''s migration already ran (its own ADD CONSTRAINT '
      || 'step is DROP-then-ADD, so re-running it is still safe and idempotent; this is informational, not a '
      || 'blocker)'
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
    'PASS = safe to run wholesale-legal-immutability-patch-migration.sql. REVIEW REQUIRED = read the flagged '
      || 'row yourself before deciding. FAIL = fix the flagged row(s) first — in particular, any offending row '
      || 'from check 2 must have published_at corrected before the migration can apply.'
  from overall
) t
order by ord;
