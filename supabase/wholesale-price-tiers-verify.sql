-- ============================================================================
-- Verify — read-only confirmation, run AFTER wholesale-price-tiers-migration.sql
-- ============================================================================
-- ONE statement, ONE result table — same convention as every other
-- verify/preflight in this project. Paste this whole file into the SQL
-- Editor and run it once, any time after the migration, as many times as
-- you want, forever. Entirely read-only: every check here is a SELECT
-- against catalog metadata (pg_proc, pg_namespace, pg_language,
-- information_schema) or a metadata-only introspection function
-- (pg_get_function_identity_arguments, pg_get_functiondef,
-- has_function_privilege) — never a call to either RPC itself, and nothing
-- here inserts, updates, deletes, or alters anything.
--
-- Corrected design: this file verifies TWO independent functions —
--   - wholesale_update_service_full (v1, 12 arguments) — must still exist,
--     exactly once, with its ORIGINAL signature and an installed body that
--     shows no trace of tier-related additions (proving it was genuinely
--     left untouched, not just renamed-and-forgotten).
--   - wholesale_update_service_full_v2 (14 arguments) — must exist exactly
--     once, with the new signature, an installed body containing the tier
--     validation/write logic, and its own independent grants/security/
--     search_path.
-- Plus one explicit combined check that neither name resolves to more than
-- one function — the exact ambiguous-overload scenario the corrected design
-- exists to avoid.
--
-- Order of operations:
--   1. Run wholesale-price-tiers-preflight.sql BEFORE the migration.
--   2. Run wholesale-price-tiers-migration.sql.
--   3. Run this file. Read the check_name/status/details rows, and the
--      final OVERALL STATUS row. PASS = every structural, security, and
--      behavioral check landed as expected. FAIL = something the migration
--      should have created is missing, wrong, ambiguous (an unexpected
--      overload), insecure, or stale — investigate before trusting this
--      feature.
-- ============================================================================

with raw as (
  select
    -- The 2 new wholesale_services columns and 4 new wholesale_price_
    -- history columns, checked INDIVIDUALLY — a prior version of this file
    -- checked these via a bare count(*) (services_tier_columns_count = 2,
    -- history_tier_columns_count = 4), which could reach the expected
    -- count via a coincidental/wrong column rather than confirming each of
    -- the 6 specific columns actually exists by name. Exact names taken
    -- from wholesale-price-tiers-migration.sql.
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_services' and column_name = 'competitive_price') as services_has_competitive_price,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_services' and column_name = 'high_profit_price') as services_has_high_profit_price,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_price_history' and column_name = 'old_competitive_price') as history_has_old_competitive_price,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_price_history' and column_name = 'new_competitive_price') as history_has_new_competitive_price,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_price_history' and column_name = 'old_high_profit_price') as history_has_old_high_profit_price,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wholesale_price_history' and column_name = 'new_high_profit_price') as history_has_new_high_profit_price,

    (select count(*) from pg_constraint c join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace where n.nspname = 'public' and t.relname = 'wholesale_services' and c.conname = 'wholesale_services_competitive_price_check') as competitive_check_exists,
    (select count(*) from pg_constraint c join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace where n.nspname = 'public' and t.relname = 'wholesale_services' and c.conname = 'wholesale_services_high_profit_price_check') as high_profit_check_exists,
    (select count(*) from pg_constraint c join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace where n.nspname = 'public' and t.relname = 'wholesale_services' and c.conname = 'wholesale_services_price_tiers_check') as tiers_order_check_exists,
    (select pg_get_constraintdef(c.oid) from pg_constraint c join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace where n.nspname = 'public' and t.relname = 'wholesale_services' and c.conname = 'wholesale_services_price_tiers_check') as tiers_order_check_def,
    -- Same definition, but with every parenthesis and "::text" cast marker
    -- stripped and collapsed to single spaces — Postgres re-serializes a
    -- CHECK expression through its own parser/deparser when a constraint
    -- is added, which legitimately wraps sub-expressions in parentheses
    -- (e.g. "(competitive_price IS NULL) AND (high_profit_price IS NULL)"
    -- instead of the single unparenthesized run this file's condition was
    -- originally written as) and appends an explicit type cast to string
    -- literals ("'fixed'::text"). Neither changes the meaning of the
    -- constraint. Matching against this normalized form instead of the raw
    -- pg_get_constraintdef() output means this check verifies the actual
    -- boolean semantics Postgres installed, not the exact byte layout of
    -- however Postgres's deparser happens to print it back.
    (select regexp_replace(regexp_replace(regexp_replace(coalesce(pg_get_constraintdef(c.oid), ''), '::text', '', 'g'), '[()]', ' ', 'g'), '\s+', ' ', 'g') from pg_constraint c join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace where n.nspname = 'public' and t.relname = 'wholesale_services' and c.conname = 'wholesale_services_price_tiers_check') as tiers_order_check_def_normalized,
    -- convalidated=false would mean the constraint exists but Postgres has
    -- not actually confirmed every existing row satisfies it (the NOT
    -- VALID / VALIDATE CONSTRAINT two-step) — this migration never uses
    -- NOT VALID, so this must be true.
    (select c.convalidated from pg_constraint c join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace where n.nspname = 'public' and t.relname = 'wholesale_services' and c.conname = 'wholesale_services_price_tiers_check') as tiers_order_check_validated,

    -- v1: name + exact original signature, counted independently of v2.
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_service_full') as v1_name_matches,
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_service_full' and pg_get_function_identity_arguments(p.oid) = 'p_service_id uuid, p_admin_id uuid, p_name text, p_notes text, p_is_microsoldering boolean, p_pricing_type text, p_fixed_price numeric, p_price_min numeric, p_price_max numeric, p_currency text, p_recommended_price numeric, p_target_margin_percent numeric') as v1_exact_matches,
    (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_service_full' and pg_get_function_identity_arguments(p.oid) = 'p_service_id uuid, p_admin_id uuid, p_name text, p_notes text, p_is_microsoldering boolean, p_pricing_type text, p_fixed_price numeric, p_price_min numeric, p_price_max numeric, p_currency text, p_recommended_price numeric, p_target_margin_percent numeric' limit 1) as v1_oid,

    -- v2: name + exact new signature, counted independently of v1.
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_service_full_v2') as v2_name_matches,
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_service_full_v2' and pg_get_function_identity_arguments(p.oid) = 'p_service_id uuid, p_admin_id uuid, p_name text, p_notes text, p_is_microsoldering boolean, p_pricing_type text, p_fixed_price numeric, p_price_min numeric, p_price_max numeric, p_currency text, p_recommended_price numeric, p_target_margin_percent numeric, p_competitive_price numeric, p_high_profit_price numeric') as v2_exact_matches,
    (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'wholesale_update_service_full_v2' and pg_get_function_identity_arguments(p.oid) = 'p_service_id uuid, p_admin_id uuid, p_name text, p_notes text, p_is_microsoldering boolean, p_pricing_type text, p_fixed_price numeric, p_price_min numeric, p_price_max numeric, p_currency text, p_recommended_price numeric, p_target_margin_percent numeric, p_competitive_price numeric, p_high_profit_price numeric' limit 1) as v2_oid
),
v1_meta as (
  select
    coalesce((select p.prorettype = 'text'::regtype from pg_proc p where p.oid = raw.v1_oid), false) as returns_text,
    coalesce((select l.lanname = 'plpgsql' from pg_proc p join pg_language l on l.oid = p.prolang where p.oid = raw.v1_oid), false) as lang_plpgsql,
    coalesce((select not p.prosecdef from pg_proc p where p.oid = raw.v1_oid), false) as security_invoker,
    coalesce((
      select exists (select 1 from unnest(coalesce(p.proconfig, array[]::text[])) cfg where cfg = 'search_path=public, pg_temp')
      from pg_proc p where p.oid = raw.v1_oid
    ), false) as search_path_pinned,
    (select pg_get_functiondef(raw.v1_oid)) as functiondef,
    coalesce((select has_function_privilege('service_role', raw.v1_oid, 'EXECUTE')), false) as service_role_can_execute,
    coalesce((select has_function_privilege('anon', raw.v1_oid, 'EXECUTE')), false) as anon_can_execute,
    coalesce((select has_function_privilege('authenticated', raw.v1_oid, 'EXECUTE')), false) as authenticated_can_execute,
    coalesce((select has_function_privilege('public', raw.v1_oid, 'EXECUTE')), false) as public_can_execute
  from raw
),
v2_meta as (
  select
    coalesce((select p.prorettype = 'text'::regtype from pg_proc p where p.oid = raw.v2_oid), false) as returns_text,
    coalesce((select l.lanname = 'plpgsql' from pg_proc p join pg_language l on l.oid = p.prolang where p.oid = raw.v2_oid), false) as lang_plpgsql,
    coalesce((select not p.prosecdef from pg_proc p where p.oid = raw.v2_oid), false) as security_invoker,
    coalesce((
      select exists (select 1 from unnest(coalesce(p.proconfig, array[]::text[])) cfg where cfg = 'search_path=public, pg_temp')
      from pg_proc p where p.oid = raw.v2_oid
    ), false) as search_path_pinned,
    (select pg_get_functiondef(raw.v2_oid)) as functiondef,
    coalesce((select has_function_privilege('service_role', raw.v2_oid, 'EXECUTE')), false) as service_role_can_execute,
    coalesce((select has_function_privilege('anon', raw.v2_oid, 'EXECUTE')), false) as anon_can_execute,
    coalesce((select has_function_privilege('authenticated', raw.v2_oid, 'EXECUTE')), false) as authenticated_can_execute,
    coalesce((select has_function_privilege('public', raw.v2_oid, 'EXECUTE')), false) as public_can_execute
  from raw
),
checks as (
  select 1 as ord, 'services_tier_columns_present' as check_name,
    case when services_has_competitive_price and services_has_high_profit_price then 'PASS' else 'FAIL' end as status,
    'wholesale_services.competitive_price=' || services_has_competitive_price
      || ', wholesale_services.high_profit_price=' || services_has_high_profit_price
      || ' — expect true, true'
      as details
  from raw

  union all

  select 2, 'history_tier_columns_present',
    case
      when history_has_old_competitive_price and history_has_new_competitive_price
        and history_has_old_high_profit_price and history_has_new_high_profit_price
      then 'PASS' else 'FAIL'
    end,
    'wholesale_price_history.old_competitive_price=' || history_has_old_competitive_price
      || ', new_competitive_price=' || history_has_new_competitive_price
      || ', old_high_profit_price=' || history_has_old_high_profit_price
      || ', new_high_profit_price=' || history_has_new_high_profit_price
      || ' — expect true, true, true, true (checked individually, not by count, so a missing column can never hide behind the other three)'
  from raw

  union all

  select 3, 'tier_check_constraints_present',
    case when competitive_check_exists = 1 and high_profit_check_exists = 1 and tiers_order_check_exists = 1 then 'PASS' else 'FAIL' end,
    'wholesale_services_competitive_price_check=' || competitive_check_exists
      || ', wholesale_services_high_profit_price_check=' || high_profit_check_exists
      || ', wholesale_services_price_tiers_check=' || tiers_order_check_exists || ' — expect 1, 1, 1'
  from raw

  union all

  -- Matched against tiers_order_check_def_normalized (parens stripped,
  -- "::text" casts stripped, whitespace collapsed — see its definition in
  -- the raw CTE above), never against the raw pg_get_constraintdef()
  -- output, so this never breaks on Postgres's own legitimate re-
  -- parenthesization or added type casts when it deparses the installed
  -- expression. Each inequality accepts either textual direction of the
  -- same relationship (e.g. "competitive_price > fixed_price" or
  -- "fixed_price < competitive_price") since both mean the same thing.
  select 4, 'tier_order_check_definition',
    case
      when tiers_order_check_def_normalized like '%competitive_price IS NULL AND high_profit_price IS NULL%'
        and tiers_order_check_def_normalized like '%pricing_type = ''fixed''%'
        and tiers_order_check_def_normalized like '%fixed_price IS NOT NULL%'
        and tiers_order_check_def_normalized like '%competitive_price IS NOT NULL%'
        and tiers_order_check_def_normalized like '%recommended_price IS NOT NULL%'
        and tiers_order_check_def_normalized like '%high_profit_price IS NOT NULL%'
        and (
          tiers_order_check_def_normalized like '%competitive_price > fixed_price%'
          or tiers_order_check_def_normalized like '%fixed_price < competitive_price%'
        )
        and (
          tiers_order_check_def_normalized like '%recommended_price >= competitive_price%'
          or tiers_order_check_def_normalized like '%competitive_price <= recommended_price%'
        )
        and (
          tiers_order_check_def_normalized like '%high_profit_price >= recommended_price%'
          or tiers_order_check_def_normalized like '%recommended_price <= high_profit_price%'
        )
        and tiers_order_check_validated is true
      then 'PASS' else 'FAIL'
    end,
    case
      when tiers_order_check_def is null then 'constraint not found — see tier_check_constraints_present'
      else 'installed definition: ' || tiers_order_check_def
        || ' — normalized for comparison: ' || tiers_order_check_def_normalized
        || ' — convalidated=' || tiers_order_check_validated
        || ' — expect all 6 required components present (legacy-null branch, pricing_type=''fixed'', all 4 non-null checks, and the 3 ordering inequalities in either textual direction) and convalidated=true'
    end
  from raw

  union all

  select 5, 'v1_untouched_signature',
    case when v1_name_matches = 1 and v1_exact_matches = 1 then 'PASS' else 'FAIL' end,
    case
      when v1_name_matches = 1 and v1_exact_matches = 1
        then 'public.wholesale_update_service_full exists exactly once, with the exact original 12-argument signature'
      when v1_name_matches = 0
        then 'public.wholesale_update_service_full does not exist at all — this migration never creates it, so its absence means a prior migration was never applied or v1 was dropped out-of-band'
      when v1_name_matches > 1
        then v1_name_matches || ' functions named wholesale_update_service_full exist in public — an unexpected overload, expected exactly 1'
      else 'a function named wholesale_update_service_full exists but its argument list does not match the exact original 12-argument signature — it may have been modified out-of-band'
    end
  from raw

  union all

  select 6, 'v1_body_shows_no_tier_additions',
    case
      when v1_exact_matches = 1
        and v1_functiondef not like '%p_competitive_price%'
        and v1_functiondef not like '%p_high_profit_price%'
        and v1_functiondef not like '%invalid_price_tiers%'
      then 'PASS'
      else 'FAIL'
    end,
    case
      when v1_exact_matches <> 1 then 'v1 not found with the exact expected signature — see v1_untouched_signature'
      else 'checked the ACTUAL installed body of wholesale_update_service_full (pg_get_functiondef) for any trace of tier-related parameters or logic — none should be present; this proves v1 was genuinely left untouched by this migration, not merely left at the same name with different internals'
    end
  from raw, (select functiondef as v1_functiondef from v1_meta) v1f

  union all

  select 7, 'v1_return_language_security_grants',
    case
      when v1_exact_matches = 1
        and returns_text and lang_plpgsql and security_invoker and search_path_pinned
        and service_role_can_execute and not anon_can_execute and not authenticated_can_execute and not public_can_execute
      then 'PASS'
      else 'FAIL'
    end,
    case
      when v1_exact_matches <> 1 then 'v1 not found with the exact expected signature — see v1_untouched_signature'
      else 'returns_text=' || returns_text || ', language_plpgsql=' || lang_plpgsql
        || ', security_invoker=' || security_invoker || ', search_path_pinned=' || search_path_pinned
        || ', service_role=' || service_role_can_execute || ', anon=' || anon_can_execute
        || ', authenticated=' || authenticated_can_execute || ', PUBLIC=' || public_can_execute
        || ' — expect true, true, true, true, true, false, false, false (security_invoker=true means NOT SECURITY DEFINER)'
    end
  from raw, v1_meta

  union all

  select 8, 'v2_exact_signature',
    case when v2_name_matches = 1 and v2_exact_matches = 1 then 'PASS' else 'FAIL' end,
    case
      when v2_name_matches = 1 and v2_exact_matches = 1
        then 'public.wholesale_update_service_full_v2 exists exactly once, with the exact expected 14-argument signature'
      when v2_name_matches = 0
        then 'public.wholesale_update_service_full_v2 does not exist at all'
      when v2_name_matches > 1
        then v2_name_matches || ' functions named wholesale_update_service_full_v2 exist in public — an unexpected overload of the new function, expected exactly 1'
      else 'a function named wholesale_update_service_full_v2 exists but its argument list does not match the expected 14-argument signature'
    end
  from raw

  union all

  select 9, 'v2_critical_protections',
    case
      when v2_exact_matches = 1
        and v2_functiondef like '%p_competitive_price%'
        and v2_functiondef like '%p_high_profit_price%'
        and v2_functiondef like '%invalid_price_tiers%'
        and v2_functiondef like '%p_pricing_type <> ''fixed''%'
        and v2_functiondef like '%v_unchanged%'
        and v2_functiondef like '%v_price_fields_changed%'
      then 'PASS'
      else 'FAIL'
    end,
    case
      when v2_exact_matches <> 1 then 'v2 not found with the exact expected signature — see v2_exact_signature'
      else 'checked the ACTUAL installed body of wholesale_update_service_full_v2 (pg_get_functiondef) for: the tier parameters, the invalid_price_tiers rejection, the fixed-type-only guard, and the pre-existing v_unchanged/v_price_fields_changed guards this function shares with v1'
    end
  from raw, (select functiondef as v2_functiondef from v2_meta) v2f

  union all

  select 10, 'v2_return_language_security_grants',
    case
      when v2_exact_matches = 1
        and returns_text and lang_plpgsql and security_invoker and search_path_pinned
        and service_role_can_execute and not anon_can_execute and not authenticated_can_execute and not public_can_execute
      then 'PASS'
      else 'FAIL'
    end,
    case
      when v2_exact_matches <> 1 then 'v2 not found with the exact expected signature — see v2_exact_signature'
      else 'returns_text=' || returns_text || ', language_plpgsql=' || lang_plpgsql
        || ', security_invoker=' || security_invoker || ', search_path_pinned=' || search_path_pinned
        || ', service_role=' || service_role_can_execute || ', anon=' || anon_can_execute
        || ', authenticated=' || authenticated_can_execute || ', PUBLIC=' || public_can_execute
        || ' — expect true, true, true, true, true, false, false, false (security_invoker=true means NOT SECURITY DEFINER)'
    end
  from raw, v2_meta

  union all

  select 11, 'no_unexpected_overloads',
    case when v1_name_matches = 1 and v2_name_matches = 1 then 'PASS' else 'FAIL' end,
    'functions named wholesale_update_service_full=' || v1_name_matches
      || ', wholesale_update_service_full_v2=' || v2_name_matches
      || ' — expect exactly 1 and 1; the corrected design never creates a second signature under either name, so any count other than 1 for either name is an ambiguous-overload situation and must never be treated as PASS'
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
    'PASS = every structural, security, and behavioral check landed as expected for BOTH v1 (untouched) and v2 (new). FAIL = '
      || 'something is missing, wrong, ambiguous (an unexpected overload), insecure, or v1 shows signs of having been modified — '
      || 'investigate before trusting this feature.'
  from overall
) t
order by ord;
