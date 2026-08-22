-- ============================================================================
-- Preflight — run BEFORE wholesale-legal-document-types-migration.sql
-- ============================================================================
-- Small, standalone follow-up on top of an ALREADY-EXECUTED
-- wholesale-legal-migration.sql AND wholesale-legal-immutability-patch-
-- migration.sql. Do not confuse this with either of those files' own
-- quartets — this one only adds a second, independent legal document type
-- (the "Estimate Disclaimer") alongside the existing 6-document master
-- agreement, nothing else.
--
-- ONE statement, ONE result table — same convention as every other
-- preflight in this project. Entirely read-only.
--
-- Order of operations:
--   1. Run this file. Read the check_name/status/details rows and the final
--      OVERALL STATUS row.
--   2. Only if OVERALL STATUS is PASS, run
--      wholesale-legal-document-types-migration.sql. FAIL means fix what's
--      flagged first.
--   3. Run wholesale-legal-document-types-verify.sql afterward to confirm
--      it landed and actually works.
-- ============================================================================

with raw as (
  select
    exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'wholesale_legal_documents'
    ) as legal_documents_table_exists,
    exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'wholesale_legal_acceptances'
    ) as legal_acceptances_table_exists,
    exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'wholesale_publish_legal_document'
    ) as publish_v1_exists,
    exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'wholesale_accept_legal_terms'
    ) as accept_v1_exists,
    exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'wholesale_legal_documents_immutability_guard'
    ) as guard_function_exists,
    -- Confirms the immutability patch's widened guard (status OR
    -- published_at) already landed — this migration's own guard rewrite
    -- preserves that widened condition, so it must already exist first.
    exists (
      select 1 from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'wholesale_legal_documents'
        and con.conname = 'wholesale_legal_documents_published_requires_published_at'
    ) as immutability_patch_applied,
    -- The exact name Postgres auto-assigns to an inline `version text not
    -- null unique` column constraint. Step 2 of the migration hardcodes a
    -- DROP CONSTRAINT against this exact name (with IF EXISTS, so a wrong
    -- guess is silently a no-op rather than an error) — this check confirms
    -- the guess is actually correct against a REAL database before relying
    -- on it.
    exists (
      select 1 from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'wholesale_legal_documents'
        and con.conname = 'wholesale_legal_documents_version_key' and con.contype = 'u'
    ) as version_unique_constraint_name_confirmed,
    exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'idx_wholesale_legal_documents_one_published'
    ) as one_published_index_exists,
    -- Already-applied guards (REVIEW REQUIRED, not FAIL — this migration is
    -- idempotent and safe to re-run).
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'wholesale_legal_documents' and column_name = 'document_type'
    ) as document_type_column_already_exists,
    exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'wholesale_estimate_disclaimer_acceptances'
    ) as new_table_already_exists,
    exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'wholesale_publish_legal_document_v2'
    ) as publish_v2_already_exists,
    exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'wholesale_accept_estimate_disclaimer'
    ) as accept_estimate_disclaimer_already_exists
),
checks as (
  select 1 as ord, 'prerequisite_legal_bundle_installed' as check_name,
    case when legal_documents_table_exists and legal_acceptances_table_exists
           and publish_v1_exists and accept_v1_exists and guard_function_exists
      then 'PASS' else 'FAIL' end as status,
    'wholesale_legal_documents exists=' || legal_documents_table_exists
      || ', wholesale_legal_acceptances exists=' || legal_acceptances_table_exists
      || ', wholesale_publish_legal_document exists=' || publish_v1_exists
      || ', wholesale_accept_legal_terms exists=' || accept_v1_exists
      || ', immutability guard function exists=' || guard_function_exists
      || ' — if any is false, run wholesale-legal-migration.sql first'
      as details
  from raw

  union all

  select 2, 'immutability_patch_already_applied',
    case when immutability_patch_applied then 'PASS' else 'FAIL' end,
    'wholesale_legal_documents_published_requires_published_at constraint exists=' || immutability_patch_applied
      || ' — if false, run wholesale-legal-immutability-patch-migration.sql first (this migration''s guard '
      || 'rewrite preserves that patch''s widened entry condition and must not regress it)'
  from raw

  union all

  select 3, 'version_unique_constraint_name_confirmed',
    case when version_unique_constraint_name_confirmed then 'PASS' else 'REVIEW REQUIRED' end,
    'wholesale_legal_documents_version_key (unique constraint on version alone) exists='
      || version_unique_constraint_name_confirmed
      || ' — expected true on a fresh install of wholesale-legal-migration.sql. If false (e.g. this migration '
      || 'already ran once, or the constraint was manually renamed), the migration''s DROP CONSTRAINT IF EXISTS '
      || 'step against this name is a safe no-op either way — but review manually before proceeding if you did '
      || 'not expect this'
  from raw

  union all

  select 4, 'one_published_index_exists',
    case when one_published_index_exists then 'PASS' else 'FAIL' end,
    'idx_wholesale_legal_documents_one_published exists=' || one_published_index_exists
      || ' — if false, run wholesale-legal-migration.sql first'
  from raw

  union all

  select 5, 'not_already_applied',
    case
      when not document_type_column_already_exists and not new_table_already_exists
        and not publish_v2_already_exists and not accept_estimate_disclaimer_already_exists
      then 'PASS'
      when document_type_column_already_exists and new_table_already_exists
        and publish_v2_already_exists and accept_estimate_disclaimer_already_exists
      then 'REVIEW REQUIRED'
      else 'REVIEW REQUIRED'
    end,
    'document_type column exists=' || document_type_column_already_exists
      || ', wholesale_estimate_disclaimer_acceptances exists=' || new_table_already_exists
      || ', wholesale_publish_legal_document_v2 exists=' || publish_v2_already_exists
      || ', wholesale_accept_estimate_disclaimer exists=' || accept_estimate_disclaimer_already_exists
      || ' — expect all false on a first run. All true means this migration already ran (safe to re-run, fully '
      || 'idempotent). A MIX of true/false means a previous run was interrupted partway — review before '
      || 're-running'
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
    'PASS = safe to run wholesale-legal-document-types-migration.sql. REVIEW REQUIRED = read the flagged row(s) '
      || 'yourself before deciding (may just mean a prior run already completed, or a benign constraint-name '
      || 'mismatch). FAIL = fix the flagged prerequisite first.'
  from overall
) t
order by ord;
