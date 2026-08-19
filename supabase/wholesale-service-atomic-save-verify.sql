-- ============================================================================
-- Verify — read-only confirmation, run AFTER
-- wholesale-service-atomic-save-migration.sql
-- ============================================================================
-- ONE statement, ONE result table — same convention as every other
-- verify/preflight in this project. Paste this whole file into the SQL
-- Editor and run it once, any time after the migration, as many times as
-- you want, forever. Entirely read-only: every check here is a SELECT
-- against catalog metadata (pg_proc, pg_namespace, pg_language,
-- information_schema) or a metadata-only introspection function
-- (pg_get_function_identity_arguments, pg_get_function_arguments,
-- pg_get_functiondef, has_function_privilege) — never a call to
-- wholesale_update_service_full or wholesale_update_service_price
-- themselves, and nothing here inserts, updates, deletes, or alters
-- anything.
--
-- Schema-qualified throughout: every pg_proc lookup joins pg_namespace and
-- restricts to nspname = 'public', and the one information_schema.columns
-- spot check is scoped to table_schema = 'public' — never a schema-less
-- match that could silently resolve to a same-named object in another
-- schema.
--
-- Both RPCs are verified by EXACT signature and require exactly one
-- function by that name to exist — never just "a function with a matching
-- signature happens to exist somewhere among several overloads". An
-- unexpected overload (two-plus functions sharing the name, regardless of
-- which one matches) is treated the same as a wrong signature: FAIL, never
-- PASS.
--
-- full_rpc_critical_protections reads the ACTUAL INSTALLED function body
-- via pg_get_functiondef(oid) — the real, currently-deployed source, not
-- the migration file on disk — and checks for the specific fixes this
-- migration is supposed to have shipped: the p_is_microsoldering NULL
-- guard, the p_pricing_type NULL guard, the USD currency check, the
-- fixed/range/quote shape validations, the microsoldering_tag_missing
-- guard, the v_unchanged no-op guard, and the v_price_fields_changed
-- narrower guard that conditions the wholesale_price_history insert. A
-- database still running an older installed definition that predates one
-- of these fixes — even if the function name and outer signature look
-- identical — fails this check instead of reading as healthy.
--
-- Order of operations:
--   1. Run wholesale-service-atomic-save-preflight.sql BEFORE the
--      migration.
--   2. Run wholesale-service-atomic-save-migration.sql.
--   3. Run this file. Read the check_name/status/details rows, and the
--      final OVERALL STATUS row. PASS = every structural, security, and
--      behavioral check landed as expected. FAIL = something the migration
--      should have created is missing, wrong, ambiguous (an unexpected
--      overload), insecure, or stale — investigate before trusting this
--      feature.
-- ============================================================================

with raw as (
  select
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_service_full') as full_rpc_name_matches,
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_service_full' and pg_get_function_identity_arguments(p.oid) = 'p_service_id uuid, p_admin_id uuid, p_name text, p_notes text, p_is_microsoldering boolean, p_pricing_type text, p_fixed_price numeric, p_price_min numeric, p_price_max numeric, p_currency text, p_recommended_price numeric, p_target_margin_percent numeric') as full_rpc_exact_matches,
    (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_service_full' and pg_get_function_identity_arguments(p.oid) = 'p_service_id uuid, p_admin_id uuid, p_name text, p_notes text, p_is_microsoldering boolean, p_pricing_type text, p_fixed_price numeric, p_price_min numeric, p_price_max numeric, p_currency text, p_recommended_price numeric, p_target_margin_percent numeric' limit 1) as full_rpc_oid,

    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_service_price') as price_rpc_name_matches,
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_service_price' and pg_get_function_identity_arguments(p.oid) = 'p_service_id uuid, p_admin_id uuid, p_pricing_type text, p_fixed_price numeric, p_price_min numeric, p_price_max numeric, p_currency text') as price_rpc_exact_matches,
    (select pg_get_function_arguments(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_service_price' and pg_get_function_identity_arguments(p.oid) = 'p_service_id uuid, p_admin_id uuid, p_pricing_type text, p_fixed_price numeric, p_price_min numeric, p_price_max numeric, p_currency text' limit 1) as price_rpc_full_args,
    (select p.pronargdefaults from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_service_price' and pg_get_function_identity_arguments(p.oid) = 'p_service_id uuid, p_admin_id uuid, p_pricing_type text, p_fixed_price numeric, p_price_min numeric, p_price_max numeric, p_currency text' limit 1) as price_rpc_nargdefaults,

    (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_services' and column_name in ('recommended_price', 'target_margin_percent')) as services_pricing_columns_count
),
full_rpc_meta as (
  select
    coalesce((select p.prorettype = 'text'::regtype from pg_proc p where p.oid = raw.full_rpc_oid), false) as returns_text,
    coalesce((select l.lanname = 'plpgsql' from pg_proc p join pg_language l on l.oid = p.prolang where p.oid = raw.full_rpc_oid), false) as lang_plpgsql,
    coalesce((select not p.prosecdef from pg_proc p where p.oid = raw.full_rpc_oid), false) as security_invoker,
    coalesce((
      select exists (
        select 1 from unnest(coalesce(p.proconfig, array[]::text[])) cfg
        where cfg = 'search_path=public, pg_temp'
      )
      from pg_proc p where p.oid = raw.full_rpc_oid
    ), false) as search_path_pinned,
    (select pg_get_functiondef(raw.full_rpc_oid)) as functiondef,
    coalesce((select has_function_privilege('service_role', raw.full_rpc_oid, 'EXECUTE')), false) as service_role_can_execute,
    coalesce((select has_function_privilege('anon', raw.full_rpc_oid, 'EXECUTE')), false) as anon_can_execute,
    coalesce((select has_function_privilege('authenticated', raw.full_rpc_oid, 'EXECUTE')), false) as authenticated_can_execute,
    coalesce((select has_function_privilege('public', raw.full_rpc_oid, 'EXECUTE')), false) as public_can_execute
  from raw
),
checks as (
  select 1 as ord, 'full_rpc_exact_signature' as check_name,
    case when full_rpc_name_matches = 1 and full_rpc_exact_matches = 1 then 'PASS' else 'FAIL' end as status,
    case
      when full_rpc_name_matches = 1 and full_rpc_exact_matches = 1
        then 'public.wholesale_update_service_full exists exactly once, with the exact expected 12-argument signature'
      when full_rpc_name_matches = 0
        then 'public.wholesale_update_service_full does not exist at all'
      when full_rpc_name_matches > 1
        then full_rpc_name_matches || ' functions named wholesale_update_service_full exist in public — an unexpected overload must never be treated as PASS, expected exactly 1'
      else 'a function named wholesale_update_service_full exists in public but its argument list does not match the expected 12-argument signature — name alone is never treated as a match'
    end as details
  from raw

  union all

  select 2, 'full_rpc_return_language_security',
    case
      when full_rpc_exact_matches = 1 and returns_text and lang_plpgsql and security_invoker and search_path_pinned
      then 'PASS'
      else 'FAIL'
    end,
    case
      when full_rpc_exact_matches <> 1 then 'RPC not found with the exact expected signature — see full_rpc_exact_signature'
      else 'returns_text=' || returns_text || ', language_plpgsql=' || lang_plpgsql
        || ', security_invoker=' || security_invoker || ', search_path_pinned=' || search_path_pinned
        || ' — expect true, true, true, true (security_invoker=true means NOT SECURITY DEFINER)'
    end
  from raw, full_rpc_meta

  union all

  select 3, 'full_rpc_execute_grants',
    case
      when full_rpc_exact_matches = 1 and service_role_can_execute
        and not anon_can_execute and not authenticated_can_execute and not public_can_execute
      then 'PASS'
      else 'FAIL'
    end,
    case
      when full_rpc_exact_matches <> 1 then 'RPC not found with the exact expected signature — see full_rpc_exact_signature'
      else 'service_role=' || service_role_can_execute || ', anon=' || anon_can_execute
        || ', authenticated=' || authenticated_can_execute || ', PUBLIC=' || public_can_execute
        || ' — expect true, false, false, false'
    end
  from raw, full_rpc_meta

  union all

  select 4, 'full_rpc_critical_protections',
    case
      when full_rpc_exact_matches = 1
        and functiondef like '%p_is_microsoldering is null%'
        and functiondef like '%p_pricing_type is null%'
        and functiondef like '%p_currency is distinct from ''USD''%'
        and functiondef like '%invalid_fixed_price%'
        and functiondef like '%invalid_range_price%'
        and functiondef like '%invalid_quote_price%'
        and functiondef like '%microsoldering_tag_missing%'
        and functiondef like '%v_unchanged%'
        and functiondef like '%v_price_fields_changed%'
        and functiondef like '%if v_price_fields_changed then%'
      then 'PASS'
      else 'FAIL'
    end,
    case
      when full_rpc_exact_matches <> 1 then 'RPC not found with the exact expected signature — see full_rpc_exact_signature'
      else 'checked the ACTUAL installed function body (pg_get_functiondef) for: p_is_microsoldering NULL guard, '
        || 'p_pricing_type NULL guard, USD currency check, fixed/range/quote shape validations, '
        || 'microsoldering_tag_missing guard, v_unchanged no-op guard, and the v_price_fields_changed guard '
        || 'conditioning the history insert — a stale pre-fix installed definition fails this check even if the '
        || 'function name and outer signature look identical'
    end
  from raw, full_rpc_meta

  union all

  select 5, 'price_rpc_exact_signature',
    case when price_rpc_name_matches = 1 and price_rpc_exact_matches = 1 then 'PASS' else 'FAIL' end,
    case
      when price_rpc_name_matches = 1 and price_rpc_exact_matches = 1
        then 'public.wholesale_update_service_price exists exactly once, with the exact expected signature — unchanged from wholesale-navigation-migration.sql'
      when price_rpc_name_matches = 0
        then 'public.wholesale_update_service_price does not exist at all'
      when price_rpc_name_matches > 1
        then price_rpc_name_matches || ' functions named wholesale_update_service_price exist in public — an unexpected overload must never be treated as PASS, expected exactly 1'
      else 'a function named wholesale_update_service_price exists in public but its argument list does not match the expected signature'
    end
  from raw

  union all

  select 6, 'price_rpc_currency_default',
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

  select 7, 'services_pricing_columns_present',
    case when services_pricing_columns_count = 2 then 'PASS' else 'FAIL' end,
    'recommended_price/target_margin_percent columns found on public.wholesale_services: ' || services_pricing_columns_count
      || ' — expect 2 (this migration adds only a function, never a column/table/constraint; this is a spot check '
      || 'that no earlier migration''s schema change regressed)'
  from raw
),
overall as (
  select
    case
      when bool_or(status = 'FAIL') then 'FAIL'
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
    'PASS = every structural, security, and behavioral check landed as expected. FAIL = something the migration '
      || 'should have created is missing, wrong, ambiguous (an unexpected overload), insecure, or stale (an older '
      || 'installed definition missing a since-added guard) — investigate before trusting this feature.'
  from overall
) t
order by ord;
