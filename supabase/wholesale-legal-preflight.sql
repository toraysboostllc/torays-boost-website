-- ============================================================================
-- Preflight — read-only sanity check, run BEFORE wholesale-legal-migration.sql
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
-- and every pg_proc/pg_constraint lookup joins pg_namespace and restricts to
-- nspname = 'public' — never a schema-less match that could silently
-- resolve to a same-named object in another schema.
--
-- Special check (5 below): confirms the EXACT current constraint name for
-- wholesale_price_history.service_id's foreign key to wholesale_services,
-- and its current confdeltype. wholesale-legal-migration.sql's own DROP
-- CONSTRAINT step is written against the name this check confirms
-- (wholesale_price_history_service_id_fkey) — if your project's constraint
-- has a different name (e.g. hand-renamed at some point), read this row's
-- details, and DO NOT run the migration as-is: fix the migration's DROP
-- CONSTRAINT line to match your actual name first.
--
-- Special check (6 below): confirms zero orphaned wholesale_price_history
-- rows (a service_id with no matching wholesale_services row). This should
-- already be impossible under the current CASCADE behavior, but the
-- migration is about to make service_id RESTRICT-only, so this file
-- confirms the starting data is clean before that change ever applies.
--
-- Order of operations:
--   1. Run this file. Read the check_name/status/details rows, and the
--      final OVERALL STATUS row.
--   2. Only if OVERALL STATUS is PASS, run wholesale-legal-migration.sql.
--      REVIEW REQUIRED means read the flagged row(s) yourself and decide —
--      never treat it as an automatic go-ahead. FAIL means fix what's
--      flagged first.
--   3. Run wholesale-legal-verify.sql afterward to confirm it landed.
-- ============================================================================

with raw as (
  select
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'wholesale_shops') as shops_table_exists,
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'wholesale_devices') as devices_table_exists,
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'wholesale_sessions') as sessions_table_exists,
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles') as profiles_table_exists,

    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_shops' and column_name = 'id') as shops_has_id,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_shops' and column_name = 'status') as shops_has_status,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_devices' and column_name = 'shop_id') as devices_has_shop_id,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_devices' and column_name = 'status') as devices_has_status,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_sessions' and column_name = 'shop_id') as sessions_has_shop_id,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_sessions' and column_name = 'device_id') as sessions_has_device_id,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'id') as profiles_has_id,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'role') as profiles_has_role,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'status') as profiles_has_status,

    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'wholesale_price_history') as history_table_exists,
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'wholesale_services') as services_table_exists,

    exists (select 1 from pg_extension where extname = 'pgcrypto') as pgcrypto_enabled,

    -- Must NOT already exist — this migration creates both from scratch.
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'wholesale_legal_documents') as legal_documents_exists,
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'wholesale_legal_acceptances') as legal_acceptances_exists,

    -- The exact current FK name + delete rule for
    -- wholesale_price_history.service_id -> wholesale_services.id.
    (select conname from pg_constraint where conrelid = 'public.wholesale_price_history'::regclass and confrelid = 'public.wholesale_services'::regclass limit 1) as service_fk_name,
    -- confdeltype is pg_catalog's internal "char" type, not text — cast
    -- explicitly here, once, at the source, so every downstream use of
    -- service_fk_deltype (coalesce, ||, comparisons) operates on real text
    -- and never hits Postgres's "operator is not unique: unknown || "char""
    -- ambiguity (confirmed in production: Supabase rejected this file with
    -- exactly that error before this cast was added).
    (select confdeltype::text from pg_constraint where conrelid = 'public.wholesale_price_history'::regclass and confrelid = 'public.wholesale_services'::regclass limit 1) as service_fk_deltype,
    (select count(*) from pg_constraint where conrelid = 'public.wholesale_price_history'::regclass and confrelid = 'public.wholesale_services'::regclass) as service_fk_count
),
orphan_check as (
  select count(*) as orphan_count
  from wholesale_price_history ph
  left join wholesale_services ws on ws.id = ph.service_id
  where ws.id is null
),
checks as (
  select 1 as ord, 'prerequisite_tables_and_columns_exist' as check_name,
    case when shops_table_exists and devices_table_exists and sessions_table_exists and profiles_table_exists
      and shops_has_id and shops_has_status and devices_has_shop_id and devices_has_status
      and sessions_has_shop_id and sessions_has_device_id
      and profiles_has_id and profiles_has_role and profiles_has_status
      and history_table_exists and services_table_exists
      then 'PASS' else 'FAIL' end as status,
    'wholesale_shops=' || shops_table_exists || ' (id=' || shops_has_id || ', status=' || shops_has_status || ')'
      || ', wholesale_devices=' || devices_table_exists || ' (shop_id=' || devices_has_shop_id || ', status=' || devices_has_status || ')'
      || ', wholesale_sessions=' || sessions_table_exists || ' (shop_id=' || sessions_has_shop_id || ', device_id=' || sessions_has_device_id || ')'
      || ', profiles=' || profiles_table_exists || ' (id=' || profiles_has_id || ', role=' || profiles_has_role || ', status=' || profiles_has_status || ')'
      || ', wholesale_price_history=' || history_table_exists || ', wholesale_services=' || services_table_exists
      || ' — if anything above is false, run wholesale-migration.sql / wholesale-navigation-migration.sql first, or confirm the profiles table (created outside this repo, see supabase-setup.sql in the DESK project) already has role/status columns'
      as details
  from raw

  union all

  select 2, 'pgcrypto_extension_enabled',
    case when pgcrypto_enabled then 'PASS' else 'FAIL' end,
    'pgcrypto extension enabled=' || pgcrypto_enabled
      || ' — required for gen_random_uuid() and digest(); wholesale-migration.sql already runs '
      || '"create extension if not exists pgcrypto" so this should always be true. If false, run '
      || '"create extension if not exists pgcrypto;" yourself before proceeding.'
  from raw

  union all

  select 3, 'legal_tables_do_not_already_exist',
    case when not legal_documents_exists and not legal_acceptances_exists then 'PASS' else 'REVIEW REQUIRED' end,
    'wholesale_legal_documents exists=' || legal_documents_exists
      || ', wholesale_legal_acceptances exists=' || legal_acceptances_exists
      || ' — expect both false on a first run (this migration creates them idempotently with IF NOT EXISTS, '
      || 'so REVIEW REQUIRED here is not necessarily a blocker on a re-run, but confirm neither was created '
      || 'out-of-band with a different shape before proceeding)'
  from raw

  union all

  select 4, 'service_id_fk_single_and_named_as_expected',
    case
      when service_fk_count = 1 and service_fk_name = 'wholesale_price_history_service_id_fkey' then 'PASS'
      when service_fk_count = 0 then 'FAIL'
      else 'REVIEW REQUIRED'
    end,
    case
      when service_fk_count = 1 and service_fk_name = 'wholesale_price_history_service_id_fkey'
        then 'exactly one FK found, named wholesale_price_history_service_id_fkey (Postgres default name) — '
          || 'wholesale-legal-migration.sql''s DROP CONSTRAINT line already targets this exact name, safe to proceed'
      when service_fk_count = 0
        then 'no FK from wholesale_price_history.service_id to wholesale_services.id found at all — run '
          || 'wholesale-navigation-migration.sql first'
      else service_fk_count || ' constraint(s) found, actual name(s): ' || coalesce(service_fk_name, '(null)')
        || ' — the migration''s hardcoded DROP CONSTRAINT name (wholesale_price_history_service_id_fkey) does '
        || 'not match; edit wholesale-legal-migration.sql''s section 5 to use the actual name before running it'
    end
  from raw

  union all

  select 5, 'service_id_fk_currently_cascade',
    case
      when service_fk_count = 1 and service_fk_deltype = 'c' then 'PASS'
      when service_fk_count = 1 and service_fk_deltype = 'r' then 'PASS'
      else 'REVIEW REQUIRED'
    end,
    case
      when service_fk_count = 1 and service_fk_deltype = 'c'
        then 'confdeltype=''c'' (CASCADE) — the expected starting state; wholesale-legal-migration.sql will '
          || 'change this to RESTRICT (''r'')'
      when service_fk_count = 1 and service_fk_deltype = 'r'
        then 'confdeltype=''r'' (RESTRICT) already — this migration''s FK step already ran and is safe to '
          || 're-apply (idempotent, same end state)'
      else 'confdeltype=' || coalesce(service_fk_deltype, '(none)') || ' — unexpected delete rule, investigate '
        || 'before proceeding (expected ''c'' or ''r'')'
    end
  from raw

  union all

  select 6, 'zero_orphaned_price_history_rows',
    case when orphan_count = 0 then 'PASS' else 'FAIL' end,
    'select count(*) from wholesale_price_history ph left join wholesale_services ws on ws.id = ph.service_id '
      || 'where ws.id is null -> ' || orphan_count
      || ' — must be 0. This should already be guaranteed by the CURRENT CASCADE behavior, but the migration is '
      || 'about to make service_id RESTRICT-only, so any orphan found here must be investigated and cleaned up '
      || '(or the affected service_id values corrected) BEFORE running wholesale-legal-migration.sql — do not '
      || 'proceed with a nonzero count.'
  from orphan_check
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
    'PASS = safe to run wholesale-legal-migration.sql. REVIEW REQUIRED = read every row above marked '
      || 'REVIEW REQUIRED yourself before deciding, never auto-cleared to PASS by this file. FAIL = fix the '
      || 'flagged row(s) first, the migration will not apply cleanly or safely as-is.'
  from overall
) t
order by ord;
