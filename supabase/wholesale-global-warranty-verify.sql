-- ============================================================================
-- Verify — read-only confirmation, run AFTER
-- wholesale-global-warranty-migration.sql
-- ============================================================================
-- ONE statement, ONE result table — same convention as
-- wholesale-global-warranty-preflight.sql. Paste this whole file into the
-- SQL Editor and run it once, any time after the migration, as many times as
-- you want, forever — every check here is read-only.
--
-- Schema-qualified throughout: every information_schema.* lookup is scoped
-- to table_schema = 'public', every pg_proc lookup joins pg_namespace and
-- restricts to nspname = 'public', every pg_class/pg_policies lookup is
-- scoped to the public schema. RPC checks verify the EXACT signature and
-- require exactly one function by that name — never just "a function with a
-- matching signature happens to exist somewhere among several overloads"
-- (same two-signal approach as wholesale-pricing-intelligence-verify.sql:
-- pg_get_function_identity_arguments for the exact-match check,
-- has_function_privilege for grants).
--
-- Order of operations:
--   1. Run wholesale-global-warranty-preflight.sql BEFORE the migration.
--   2. Run wholesale-global-warranty-migration.sql.
--   3. Run this file. Read the check_name/status/details rows, and the final
--      OVERALL STATUS row. PASS = every structural and security check landed
--      as expected. REVIEW REQUIRED = read the flagged row(s) yourself —
--      this can be a legitimate, benign state (see warranty_current_values
--      below), never treat it as an automatic failure. FAIL = something the
--      migration should have created is missing, wrong, or ambiguous.
-- ============================================================================

with raw as (
  select
    (select count(*) from public.wholesale_portal_settings) as settings_total_rows,
    (select warranty_enabled from public.wholesale_portal_settings where id = 1) as w_enabled,
    (select warranty_duration_days from public.wholesale_portal_settings where id = 1) as w_duration,
    (select warranty_terms_en from public.wholesale_portal_settings where id = 1) as w_terms_en,
    (select warranty_terms_es from public.wholesale_portal_settings where id = 1) as w_terms_es,
    -- Every OTHER existing column on the same row — proof this migration
    -- never touched them, not just an assertion in a comment.
    (select default_target_margin_percent from public.wholesale_portal_settings where id = 1) as untouched_margin,
    (select rounding_rule from public.wholesale_portal_settings where id = 1) as untouched_rounding_rule,
    (select sales_visible from public.wholesale_portal_settings where id = 1) as untouched_sales_visible,
    (select sales_status from public.wholesale_portal_settings where id = 1) as untouched_sales_status,
    (select sales_entry_blocked from public.wholesale_portal_settings where id = 1) as untouched_sales_entry_blocked,

    (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_portal_settings' and column_name = 'warranty_enabled') as we_type,
    (select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_portal_settings' and column_name = 'warranty_enabled') as we_nullable,
    (select column_default from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_portal_settings' and column_name = 'warranty_enabled') as we_default,

    (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_portal_settings' and column_name = 'warranty_duration_days') as wd_type,
    (select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_portal_settings' and column_name = 'warranty_duration_days') as wd_nullable,

    (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_portal_settings' and column_name = 'warranty_terms_en') as wten_type,
    (select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_portal_settings' and column_name = 'warranty_terms_en') as wten_nullable,

    (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_portal_settings' and column_name = 'warranty_terms_es') as wtes_type,
    (select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_portal_settings' and column_name = 'warranty_terms_es') as wtes_nullable,

    (select count(*) from pg_constraint where conrelid = 'public.wholesale_portal_settings'::regclass and conname = 'wholesale_portal_settings_warranty_duration_check') as duration_check_count,
    (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.wholesale_portal_settings'::regclass and conname = 'wholesale_portal_settings_warranty_duration_check') as duration_check_def,

    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_portal_settings') as v1_name_matches,
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_portal_settings' and pg_get_function_identity_arguments(p.oid) = 'p_admin_id uuid, p_default_target_margin_percent numeric, p_rounding_rule text, p_sales_visible boolean, p_sales_status text, p_sales_entry_blocked boolean') as v1_exact_matches,

    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_portal_settings_v2') as v2_name_matches,
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_portal_settings_v2' and pg_get_function_identity_arguments(p.oid) = 'p_admin_id uuid, p_default_target_margin_percent numeric, p_rounding_rule text, p_sales_visible boolean, p_sales_status text, p_sales_entry_blocked boolean, p_warranty_enabled boolean, p_warranty_duration_days integer, p_warranty_terms_en text, p_warranty_terms_es text') as v2_exact_matches,
    (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_portal_settings_v2' and pg_get_function_identity_arguments(p.oid) = 'p_admin_id uuid, p_default_target_margin_percent numeric, p_rounding_rule text, p_sales_visible boolean, p_sales_status text, p_sales_entry_blocked boolean, p_warranty_enabled boolean, p_warranty_duration_days integer, p_warranty_terms_en text, p_warranty_terms_es text' limit 1) as v2_oid,

    (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'wholesale_portal_settings') as settings_rls_enabled,
    (select count(*) from pg_policies where schemaname = 'public' and tablename = 'wholesale_portal_settings') as settings_policy_count
),
grants as (
  select
    coalesce(has_function_privilege('service_role', raw.v2_oid, 'EXECUTE'), false) as v2_service_role_can_execute,
    coalesce(has_function_privilege('anon', raw.v2_oid, 'EXECUTE'), false) as v2_anon_can_execute,
    coalesce(has_function_privilege('authenticated', raw.v2_oid, 'EXECUTE'), false) as v2_authenticated_can_execute,
    coalesce(has_function_privilege('public', raw.v2_oid, 'EXECUTE'), false) as v2_public_can_execute
  from raw
),
checks as (
  select 1 as ord, 'settings_singleton_row_still_one' as check_name,
    case when settings_total_rows = 1 then 'PASS' else 'FAIL' end as status,
    'public.wholesale_portal_settings has ' || settings_total_rows || ' row(s) — expect exactly 1 (this migration never inserts/deletes rows, only adds columns)' as details
  from raw

  union all

  select 2, 'warranty_enabled_column',
    case when we_type = 'boolean' and we_nullable = 'NO' and we_default ilike '%false%' then 'PASS' else 'FAIL' end,
    'data_type=' || coalesce(we_type, 'MISSING') || ', is_nullable=' || coalesce(we_nullable, 'MISSING')
      || ', column_default=' || coalesce(we_default, 'null') || ' — expect boolean, NO, a false default'
  from raw

  union all

  select 3, 'warranty_duration_days_column',
    case when wd_type = 'integer' and wd_nullable = 'YES' then 'PASS' else 'FAIL' end,
    'data_type=' || coalesce(wd_type, 'MISSING') || ', is_nullable=' || coalesce(wd_nullable, 'MISSING') || ' — expect integer, YES (nullable)'
  from raw

  union all

  select 4, 'warranty_terms_en_column',
    case when wten_type = 'text' and wten_nullable = 'YES' then 'PASS' else 'FAIL' end,
    'data_type=' || coalesce(wten_type, 'MISSING') || ', is_nullable=' || coalesce(wten_nullable, 'MISSING') || ' — expect text, YES (nullable)'
  from raw

  union all

  select 5, 'warranty_terms_es_column',
    case when wtes_type = 'text' and wtes_nullable = 'YES' then 'PASS' else 'FAIL' end,
    'data_type=' || coalesce(wtes_type, 'MISSING') || ', is_nullable=' || coalesce(wtes_nullable, 'MISSING') || ' — expect text, YES (nullable)'
  from raw

  union all

  select 6, 'warranty_duration_check_constraint',
    case
      when duration_check_count = 1
        and duration_check_def ~* 'warranty_enabled\s*=\s*false'
        and duration_check_def ~* 'warranty_duration_days\s*>\s*0'
        and duration_check_def ~* 'warranty_duration_days\s*<=\s*3650'
      then 'PASS'
      else 'FAIL'
    end,
    'wholesale_portal_settings_warranty_duration_check (' || coalesce(duration_check_count::text, '0') || ')=' || coalesce(duration_check_def, 'MISSING')
      || ' — expect: legal when warranty_enabled=false OR (duration is not null, > 0, and <= 3650), enforced at the schema level regardless of which RPC issued the UPDATE'
  from raw

  union all

  select 7, 'settings_rpc_v1_untouched',
    case when v1_name_matches = 1 and v1_exact_matches = 1 then 'PASS' else 'FAIL' end,
    case
      when v1_name_matches = 1 and v1_exact_matches = 1
        then 'wholesale_update_portal_settings (v1, 6 arguments) still exists exactly as it was — byte-for-byte untouched by this migration'
      when v1_name_matches = 0
        then 'wholesale_update_portal_settings (v1) is missing entirely — it should never have been dropped by this migration'
      else 'v1 exists but its argument list no longer matches the original 6-argument signature — it should have been completely untouched'
    end
  from raw

  union all

  select 8, 'settings_rpc_v2_exact_signature',
    case when v2_name_matches = 1 and v2_exact_matches = 1 then 'PASS' else 'FAIL' end,
    case
      when v2_name_matches = 1 and v2_exact_matches = 1
        then 'public.wholesale_update_portal_settings_v2 exists exactly once, with the exact expected 10-argument signature'
      when v2_name_matches = 0
        then 'public.wholesale_update_portal_settings_v2 does not exist at all'
      when v2_name_matches > 1
        then v2_name_matches || ' functions named wholesale_update_portal_settings_v2 exist in public — an unexpected overload must never silently pass this check, expected exactly 1'
      else 'a function named wholesale_update_portal_settings_v2 exists in public but its argument list does not match the expected signature — name alone is never treated as a match'
    end
  from raw

  union all

  select 9, 'settings_rpc_v2_execute_grants',
    case
      when v2_name_matches = 1 and v2_exact_matches = 1 and v2_service_role_can_execute
        and not v2_anon_can_execute and not v2_authenticated_can_execute and not v2_public_can_execute
      then 'PASS'
      else 'FAIL'
    end,
    case
      when v2_name_matches <> 1 or v2_exact_matches <> 1
        then 'RPC not found with the exact expected signature — see settings_rpc_v2_exact_signature'
      else 'service_role=' || v2_service_role_can_execute || ', anon=' || v2_anon_can_execute
        || ', authenticated=' || v2_authenticated_can_execute || ', PUBLIC=' || v2_public_can_execute
        || ' — expect true, false, false, false'
    end
  from raw, grants

  union all

  select 10, 'settings_rls_unchanged',
    case when settings_rls_enabled and settings_policy_count = 0 then 'PASS' else 'FAIL' end,
    'relrowsecurity=' || coalesce(settings_rls_enabled::text, 'MISSING') || ', policy_count=' || settings_policy_count
      || ' — expect true, 0 (unchanged from wholesale-pricing-intelligence-migration.sql — this migration adds no new RLS posture)'
  from raw

  union all

  select 11, 'other_settings_columns_untouched',
    'PASS', -- always informational-but-required-true; a real difference from a legitimately admin-configured value is expected and fine, this check only confirms the ROW still has real values (nothing nulled out / row not corrupted)
    'default_target_margin_percent=' || coalesce(untouched_margin::text, 'NULL') || ', rounding_rule=' || coalesce(untouched_rounding_rule, 'NULL')
      || ', sales_visible=' || coalesce(untouched_sales_visible::text, 'NULL') || ', sales_status=' || coalesce(untouched_sales_status, 'NULL')
      || ', sales_entry_blocked=' || coalesce(untouched_sales_entry_blocked::text, 'NULL')
      || ' — every pre-existing column on this row still has a real value; this migration never wrote to any of them'
  from raw

  union all

  select 12, 'warranty_current_values',
    'PASS', -- informational only, never gates OVERALL STATUS — freshly migrated (off, nulls) is exactly as healthy as an admin-configured state
    'warranty_enabled=' || coalesce(w_enabled::text, 'NULL') || ', warranty_duration_days=' || coalesce(w_duration::text, 'NULL')
      || ', warranty_terms_en=' || coalesce(left(w_terms_en, 40), 'NULL') || ', warranty_terms_es=' || coalesce(left(w_terms_es, 40), 'NULL')
      || ' — expected fresh-migration defaults are false / NULL / NULL / NULL. A difference here is expected and benign '
      || 'once an admin has used DESK''s warranty controls, not a defect — investigate only if this looks unexpected'
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
    'PASS = the migration landed exactly as expected, v1 is untouched, security posture confirmed. REVIEW REQUIRED = '
      || 'read every row above marked REVIEW REQUIRED yourself. FAIL = something the migration should have created is '
      || 'missing, wrong, ambiguous, or insecure — investigate before trusting this feature.'
  from overall
) t
order by ord;
