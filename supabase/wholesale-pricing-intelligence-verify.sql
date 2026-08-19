-- ============================================================================
-- Verify — read-only confirmation, run AFTER
-- wholesale-pricing-intelligence-migration.sql
-- ============================================================================
-- ONE statement, ONE result table — same convention as
-- wholesale-pricing-intelligence-preflight.sql. Paste this whole file into
-- the SQL Editor and run it once, any time after the migration, as many
-- times as you want, forever — every check here is read-only (SELECT only,
-- nothing that inserts, updates, deletes, or alters).
--
-- Schema-qualified throughout, on purpose: every information_schema.tables /
-- information_schema.columns lookup is scoped to table_schema = 'public',
-- every pg_proc lookup joins pg_namespace and restricts to
-- nspname = 'public', every pg_class lookup is scoped to the public schema
-- via the same join, pg_policies is scoped to schemaname = 'public', and
-- every direct table reference uses the public.<table> form (including
-- 'public.wholesale_services'::regclass) — never a schema-less name that
-- could silently resolve to a same-named object in another schema.
--
-- RPC checks verify the EXACT signature and require exactly one function by
-- that name to exist at all — never just "a function with a matching
-- signature happens to exist somewhere among several overloads". The
-- identity signature (types only) and any DEFAULT clause are separate
-- concerns, checked separately:
--   - pg_get_function_identity_arguments(oid) reconstructs the argument
--     list WITHOUT default values — that's what identifies a function for
--     ALTER/DROP FUNCTION, and what the "exact signature" checks below
--     compare against. It deliberately never includes a DEFAULT clause, so
--     comparing it against a string that has one would never match.
--   - pg_get_function_arguments(oid) reconstructs the FULL argument list,
--     including default values — that's what price_rpc_currency_default
--     below uses, cross-checked against pronargdefaults (how many trailing
--     arguments have a default), to confirm p_currency's default is
--     exactly 'USD'::text without relying on a single signal alone.
--
-- Order of operations:
--   1. Run wholesale-pricing-intelligence-preflight.sql BEFORE the
--      migration.
--   2. Run wholesale-pricing-intelligence-migration.sql.
--   3. Run this file. Read the check_name/status/details rows, and the
--      final OVERALL STATUS row. PASS = every structural and security check
--      landed as expected. REVIEW REQUIRED = read the flagged row(s)
--      yourself — this can be a legitimate, benign state (see
--      settings_initial_values below), never treat it as an automatic
--      failure. FAIL = something the migration should have created is
--      missing, wrong, or ambiguous (including an unexpected overload).
--
-- services_pricing_intelligence_usage is informational only — how many
-- services already have a manual recommended_price/target_margin_percent
-- override, and how many wholesale_price_history rows recorded a
-- pricing-intelligence change — and can never affect OVERALL STATUS; a
-- database where every service already has these fields edited is exactly
-- as healthy as a freshly migrated one with none set.
-- ============================================================================

with raw as (
  select
    (select count(*) from public.wholesale_portal_settings) as settings_total_rows,
    (select count(*) from public.wholesale_portal_settings where id = 1) as settings_id1_rows,
    (select default_target_margin_percent from public.wholesale_portal_settings where id = 1) as settings_margin,
    (select rounding_rule from public.wholesale_portal_settings where id = 1) as settings_rounding_rule,
    (select sales_visible from public.wholesale_portal_settings where id = 1) as settings_sales_visible,
    (select sales_status from public.wholesale_portal_settings where id = 1) as settings_sales_status,
    (select sales_entry_blocked from public.wholesale_portal_settings where id = 1) as settings_sales_entry_blocked,

    (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_services' and column_name = 'recommended_price') as rp_data_type,
    (select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_services' and column_name = 'recommended_price') as rp_is_nullable,
    (select column_default from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_services' and column_name = 'recommended_price') as rp_column_default,
    (select numeric_precision from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_services' and column_name = 'recommended_price') as rp_precision,
    (select numeric_scale from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_services' and column_name = 'recommended_price') as rp_scale,

    (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_services' and column_name = 'target_margin_percent') as tmp_data_type,
    (select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_services' and column_name = 'target_margin_percent') as tmp_is_nullable,
    (select column_default from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_services' and column_name = 'target_margin_percent') as tmp_column_default,
    (select numeric_precision from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_services' and column_name = 'target_margin_percent') as tmp_precision,
    (select numeric_scale from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_services' and column_name = 'target_margin_percent') as tmp_scale,

    (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_price_history' and column_name = 'old_recommended_price') as h_orp_type,
    (select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_price_history' and column_name = 'old_recommended_price') as h_orp_nullable,
    (select numeric_precision from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_price_history' and column_name = 'old_recommended_price') as h_orp_precision,
    (select numeric_scale from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_price_history' and column_name = 'old_recommended_price') as h_orp_scale,

    (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_price_history' and column_name = 'new_recommended_price') as h_nrp_type,
    (select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_price_history' and column_name = 'new_recommended_price') as h_nrp_nullable,
    (select numeric_precision from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_price_history' and column_name = 'new_recommended_price') as h_nrp_precision,
    (select numeric_scale from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_price_history' and column_name = 'new_recommended_price') as h_nrp_scale,

    (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_price_history' and column_name = 'old_target_margin_percent') as h_otmp_type,
    (select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_price_history' and column_name = 'old_target_margin_percent') as h_otmp_nullable,
    (select numeric_precision from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_price_history' and column_name = 'old_target_margin_percent') as h_otmp_precision,
    (select numeric_scale from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_price_history' and column_name = 'old_target_margin_percent') as h_otmp_scale,

    (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_price_history' and column_name = 'new_target_margin_percent') as h_ntmp_type,
    (select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_price_history' and column_name = 'new_target_margin_percent') as h_ntmp_nullable,
    (select numeric_precision from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_price_history' and column_name = 'new_target_margin_percent') as h_ntmp_precision,
    (select numeric_scale from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_price_history' and column_name = 'new_target_margin_percent') as h_ntmp_scale,

    (select count(*) from pg_constraint where conrelid = 'public.wholesale_services'::regclass and conname = 'wholesale_services_recommended_price_check') as rp_check_count,
    (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.wholesale_services'::regclass and conname = 'wholesale_services_recommended_price_check') as rp_check_def,
    (select count(*) from pg_constraint where conrelid = 'public.wholesale_services'::regclass and conname = 'wholesale_services_target_margin_percent_check') as tmp_check_count,
    (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.wholesale_services'::regclass and conname = 'wholesale_services_target_margin_percent_check') as tmp_check_def,

    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_portal_settings') as settings_rpc_name_matches,
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_portal_settings' and pg_get_function_identity_arguments(p.oid) = 'p_admin_id uuid, p_default_target_margin_percent numeric, p_rounding_rule text, p_sales_visible boolean, p_sales_status text, p_sales_entry_blocked boolean') as settings_rpc_exact_matches,
    (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_portal_settings' and pg_get_function_identity_arguments(p.oid) = 'p_admin_id uuid, p_default_target_margin_percent numeric, p_rounding_rule text, p_sales_visible boolean, p_sales_status text, p_sales_entry_blocked boolean' limit 1) as settings_rpc_oid,

    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_service_price') as price_rpc_name_matches,
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_service_price' and pg_get_function_identity_arguments(p.oid) = 'p_service_id uuid, p_admin_id uuid, p_pricing_type text, p_fixed_price numeric, p_price_min numeric, p_price_max numeric, p_currency text') as price_rpc_exact_matches,
    (select pg_get_function_arguments(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_service_price' and pg_get_function_identity_arguments(p.oid) = 'p_service_id uuid, p_admin_id uuid, p_pricing_type text, p_fixed_price numeric, p_price_min numeric, p_price_max numeric, p_currency text' limit 1) as price_rpc_full_args,
    (select p.pronargdefaults from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_service_price' and pg_get_function_identity_arguments(p.oid) = 'p_service_id uuid, p_admin_id uuid, p_pricing_type text, p_fixed_price numeric, p_price_min numeric, p_price_max numeric, p_currency text' limit 1) as price_rpc_nargdefaults,

    (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'wholesale_portal_settings') as settings_rls_enabled,
    (select count(*) from pg_policies where schemaname = 'public' and tablename = 'wholesale_portal_settings') as settings_policy_count,

    (select count(*) from public.wholesale_services where recommended_price is not null) as services_with_recommended_price,
    (select count(*) from public.wholesale_services where target_margin_percent is not null) as services_with_target_margin,
    (select count(*) from public.wholesale_price_history where old_recommended_price is not null or new_recommended_price is not null or old_target_margin_percent is not null or new_target_margin_percent is not null) as history_rows_with_pricing_intelligence
),
grants as (
  select
    coalesce(has_function_privilege('service_role', raw.settings_rpc_oid, 'EXECUTE'), false) as settings_service_role_can_execute,
    coalesce(has_function_privilege('anon', raw.settings_rpc_oid, 'EXECUTE'), false) as settings_anon_can_execute,
    coalesce(has_function_privilege('authenticated', raw.settings_rpc_oid, 'EXECUTE'), false) as settings_authenticated_can_execute,
    coalesce(has_function_privilege('public', raw.settings_rpc_oid, 'EXECUTE'), false) as settings_public_can_execute
  from raw
),
checks as (
  select 1 as ord, 'settings_singleton_row' as check_name,
    case when settings_total_rows = 1 and settings_id1_rows = 1 then 'PASS' else 'FAIL' end as status,
    'public.wholesale_portal_settings has ' || settings_total_rows || ' total row(s), ' || settings_id1_rows
      || ' with id = 1 — expect exactly 1 total, exactly 1 with id = 1' as details
  from raw

  union all

  select 2, 'settings_initial_values',
    case
      when settings_id1_rows = 1
        and settings_margin = 40 and settings_rounding_rule = 'nearest_1'
        and settings_sales_visible = true and settings_sales_status = 'maintenance'
        and settings_sales_entry_blocked = true
      then 'PASS'
      when settings_id1_rows = 1
      then 'REVIEW REQUIRED'
      else 'FAIL'
    end,
    case
      when settings_id1_rows <> 1
      then 'no id = 1 row to read values from — see settings_singleton_row'
      else 'default_target_margin_percent=' || settings_margin || ', rounding_rule=' || settings_rounding_rule
        || ', sales_visible=' || settings_sales_visible || ', sales_status=' || settings_sales_status
        || ', sales_entry_blocked=' || settings_sales_entry_blocked
        || ' — expected fresh-migration defaults are 40 / nearest_1 / true / maintenance / true. A difference here '
        || 'is expected and benign once an admin has used DESK''s Pricing & Sales Settings controls, not a defect '
        || '— investigate only if this looks unexpected'
    end
  from raw

  union all

  select 3, 'services_recommended_price_column',
    case when rp_data_type = 'numeric' and rp_is_nullable = 'YES' and rp_column_default is null and rp_precision = 10 and rp_scale = 2 then 'PASS' else 'FAIL' end,
    'data_type=' || coalesce(rp_data_type, 'MISSING') || ', is_nullable=' || coalesce(rp_is_nullable, 'MISSING')
      || ', column_default=' || coalesce(rp_column_default, 'null') || ', numeric_precision=' || coalesce(rp_precision::text, 'MISSING')
      || ', numeric_scale=' || coalesce(rp_scale::text, 'MISSING') || ' — expect numeric(10,2), YES, null'
  from raw

  union all

  select 4, 'services_target_margin_percent_column',
    case when tmp_data_type = 'numeric' and tmp_is_nullable = 'YES' and tmp_column_default is null and tmp_precision = 5 and tmp_scale = 2 then 'PASS' else 'FAIL' end,
    'data_type=' || coalesce(tmp_data_type, 'MISSING') || ', is_nullable=' || coalesce(tmp_is_nullable, 'MISSING')
      || ', column_default=' || coalesce(tmp_column_default, 'null') || ', numeric_precision=' || coalesce(tmp_precision::text, 'MISSING')
      || ', numeric_scale=' || coalesce(tmp_scale::text, 'MISSING') || ' — expect numeric(5,2), YES, null'
  from raw

  union all

  select 5, 'history_old_recommended_price_column',
    case when h_orp_type = 'numeric' and h_orp_nullable = 'YES' and h_orp_precision = 10 and h_orp_scale = 2 then 'PASS' else 'FAIL' end,
    'data_type=' || coalesce(h_orp_type, 'MISSING') || ', is_nullable=' || coalesce(h_orp_nullable, 'MISSING')
      || ', numeric_precision=' || coalesce(h_orp_precision::text, 'MISSING') || ', numeric_scale=' || coalesce(h_orp_scale::text, 'MISSING')
      || ' — expect numeric(10,2), YES'
  from raw

  union all

  select 6, 'history_new_recommended_price_column',
    case when h_nrp_type = 'numeric' and h_nrp_nullable = 'YES' and h_nrp_precision = 10 and h_nrp_scale = 2 then 'PASS' else 'FAIL' end,
    'data_type=' || coalesce(h_nrp_type, 'MISSING') || ', is_nullable=' || coalesce(h_nrp_nullable, 'MISSING')
      || ', numeric_precision=' || coalesce(h_nrp_precision::text, 'MISSING') || ', numeric_scale=' || coalesce(h_nrp_scale::text, 'MISSING')
      || ' — expect numeric(10,2), YES'
  from raw

  union all

  select 7, 'history_old_target_margin_percent_column',
    case when h_otmp_type = 'numeric' and h_otmp_nullable = 'YES' and h_otmp_precision = 5 and h_otmp_scale = 2 then 'PASS' else 'FAIL' end,
    'data_type=' || coalesce(h_otmp_type, 'MISSING') || ', is_nullable=' || coalesce(h_otmp_nullable, 'MISSING')
      || ', numeric_precision=' || coalesce(h_otmp_precision::text, 'MISSING') || ', numeric_scale=' || coalesce(h_otmp_scale::text, 'MISSING')
      || ' — expect numeric(5,2), YES'
  from raw

  union all

  select 8, 'history_new_target_margin_percent_column',
    case when h_ntmp_type = 'numeric' and h_ntmp_nullable = 'YES' and h_ntmp_precision = 5 and h_ntmp_scale = 2 then 'PASS' else 'FAIL' end,
    'data_type=' || coalesce(h_ntmp_type, 'MISSING') || ', is_nullable=' || coalesce(h_ntmp_nullable, 'MISSING')
      || ', numeric_precision=' || coalesce(h_ntmp_precision::text, 'MISSING') || ', numeric_scale=' || coalesce(h_ntmp_scale::text, 'MISSING')
      || ' — expect numeric(5,2), YES'
  from raw

  union all

  select 9, 'services_check_constraints',
    case
      when rp_check_count = 1 and tmp_check_count = 1
        and rp_check_def ~* 'recommended_price\s+is\s+null' and rp_check_def ~* 'recommended_price\s*>=\s*\(?0'
        and tmp_check_def ~* 'target_margin_percent\s+is\s+null' and tmp_check_def ~* 'target_margin_percent\s*>=\s*\(?0'
        and tmp_check_def ~* 'target_margin_percent\s*<\s*\(?100'
      then 'PASS'
      else 'FAIL'
    end,
    'wholesale_services_recommended_price_check (' || coalesce(rp_check_count::text, '0') || ')=' || coalesce(rp_check_def, 'MISSING')
      || ' | wholesale_services_target_margin_percent_check (' || coalesce(tmp_check_count::text, '0') || ')=' || coalesce(tmp_check_def, 'MISSING')
      || ' — expect the recommended_price check to allow null or require >= 0, and the target_margin_percent check '
      || 'to allow null or require 0 <= value < 100 (definitions checked by content, not just by name existing)'
  from raw

  union all

  select 10, 'settings_rpc_exact_signature',
    case when settings_rpc_name_matches = 1 and settings_rpc_exact_matches = 1 then 'PASS' else 'FAIL' end,
    case
      when settings_rpc_name_matches = 1 and settings_rpc_exact_matches = 1
        then 'public.wholesale_update_portal_settings exists exactly once, with the exact expected argument list'
      when settings_rpc_name_matches = 0
        then 'public.wholesale_update_portal_settings does not exist at all'
      when settings_rpc_name_matches > 1
        then settings_rpc_name_matches || ' functions named wholesale_update_portal_settings exist in public — an unexpected overload must never silently pass this check, expected exactly 1'
      else 'a function named wholesale_update_portal_settings exists in public but its argument list does not match the expected signature — name alone is never treated as a match'
    end
  from raw

  union all

  select 11, 'price_rpc_exact_signature',
    case when price_rpc_name_matches = 1 and price_rpc_exact_matches = 1 then 'PASS' else 'FAIL' end,
    case
      when price_rpc_name_matches = 1 and price_rpc_exact_matches = 1
        then 'public.wholesale_update_service_price exists exactly once, with the exact expected argument list — unchanged from wholesale-navigation-migration.sql'
      when price_rpc_name_matches = 0
        then 'public.wholesale_update_service_price does not exist at all'
      when price_rpc_name_matches > 1
        then price_rpc_name_matches || ' functions named wholesale_update_service_price exist in public — an unexpected overload must never silently pass this check, expected exactly 1'
      else 'a function named wholesale_update_service_price exists in public but its argument list does not match the expected signature'
    end
  from raw

  union all

  select 12, 'price_rpc_currency_default',
    case
      when price_rpc_name_matches = 1 and price_rpc_exact_matches = 1 and price_rpc_nargdefaults = 1
        and price_rpc_full_args = 'p_service_id uuid, p_admin_id uuid, p_pricing_type text, p_fixed_price numeric, p_price_min numeric, p_price_max numeric, p_currency text DEFAULT ''USD''::text'
      then 'PASS'
      else 'FAIL'
    end,
    case
      when price_rpc_name_matches <> 1 or price_rpc_exact_matches <> 1
        then 'RPC not found with the exact expected identity signature — see price_rpc_exact_signature'
      else 'pronargdefaults=' || coalesce(price_rpc_nargdefaults::text, 'MISSING') || ', pg_get_function_arguments=' || coalesce(price_rpc_full_args, 'MISSING')
        || ' — expect exactly 1 defaulted argument, with p_currency text DEFAULT ''USD''::text as the final argument (two independent signals, checked together)'
    end
  from raw

  union all

  select 13, 'settings_rpc_execute_grants',
    case
      when settings_rpc_name_matches = 1 and settings_rpc_exact_matches = 1 and settings_service_role_can_execute
        and not settings_anon_can_execute and not settings_authenticated_can_execute and not settings_public_can_execute
      then 'PASS'
      else 'FAIL'
    end,
    case
      when settings_rpc_name_matches <> 1 or settings_rpc_exact_matches <> 1
        then 'RPC not found with the exact expected signature — see settings_rpc_exact_signature'
      else 'service_role=' || settings_service_role_can_execute || ', anon=' || settings_anon_can_execute
        || ', authenticated=' || settings_authenticated_can_execute || ', PUBLIC=' || settings_public_can_execute
        || ' — expect true, false, false, false'
    end
  from raw, grants

  union all

  select 14, 'settings_rls_zero_policies',
    case when settings_rls_enabled and settings_policy_count = 0 then 'PASS' else 'FAIL' end,
    'relrowsecurity=' || coalesce(settings_rls_enabled::text, 'MISSING') || ', policy_count=' || settings_policy_count
      || ' — expect true, 0, scoped to public.wholesale_portal_settings only'
  from raw

  union all

  select 15, 'services_pricing_intelligence_usage',
    'PASS', -- informational only, never gates OVERALL STATUS
    services_with_recommended_price || ' service(s) have a manual recommended_price override, '
      || services_with_target_margin || ' have a target_margin_percent override, '
      || history_rows_with_pricing_intelligence || ' wholesale_price_history row(s) recorded a pricing-intelligence '
      || 'change — informational only, any count from 0 up to every active service/row is a healthy state'
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
    'PASS = the migration landed exactly as expected, security posture confirmed. REVIEW REQUIRED = read every row '
      || 'above marked REVIEW REQUIRED yourself — settings_initial_values differing from the fresh-migration '
      || 'defaults is a common, benign cause and does not by itself mean anything is wrong. FAIL = something the '
      || 'migration should have created is missing, wrong, ambiguous (an unexpected overload), or insecure — '
      || 'investigate before trusting this feature.'
  from overall
) t
order by ord;
