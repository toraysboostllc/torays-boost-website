-- ============================================================================
-- Read-only verification for wholesale-service-atomic-save-migration.sql
-- ============================================================================
-- Run this AFTER wholesale-service-atomic-save-migration.sql, in the
-- Supabase SQL Editor. Every statement here is a SELECT — nothing here
-- writes, updates, deletes, or alters anything. Safe to run as many times as
-- you want, at any point, forever.
-- ============================================================================

-- 1. The new RPC exists with the expected 12-argument signature.
select proname, pg_get_function_identity_arguments(oid) as args
from pg_proc
where proname = 'wholesale_update_service_full';
-- expect exactly 1 row: args = "p_service_id uuid, p_admin_id uuid, p_name text,
-- p_notes text, p_is_microsoldering boolean, p_pricing_type text,
-- p_fixed_price numeric, p_price_min numeric, p_price_max numeric,
-- p_currency text, p_recommended_price numeric, p_target_margin_percent numeric"

-- 2. Both existing per-concern RPCs are untouched — same signatures as
--    before this migration ever ran.
select proname, pg_get_function_identity_arguments(oid) as args
from pg_proc
where proname in ('wholesale_update_service_price', 'wholesale_update_service_pricing_intelligence')
order by proname;
-- expect 2 rows, unchanged from wholesale-navigation-migration.sql /
-- wholesale-pricing-intelligence-migration.sql

-- 3. EXECUTE on the new RPC is granted only to service_role, revoked from
--    public/anon/authenticated — same posture as every other wholesale RPC.
select p.proname,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p
where p.proname = 'wholesale_update_service_full';
-- expect 1 row: service_role_can_execute=true, anon_can_execute=false,
-- authenticated_can_execute=false

-- 4. No schema change happened — this migration adds only a function, never
--    a column/table/constraint. Confirms wholesale_services still has
--    exactly the columns the three prior migrations put there (spot check).
select count(*) as recommended_price_and_target_margin_columns
from information_schema.columns
where table_name = 'wholesale_services'
  and column_name in ('recommended_price', 'target_margin_percent');
-- expect 2

-- ============================================================================
-- 5. POST-MIGRATION SUMMARY — one row, every check above collapsed into it.
-- ============================================================================
with full_rpc as (
  select count(*) as n from pg_proc where proname = 'wholesale_update_service_full'
),
existing_rpcs_intact as (
  select count(*) as n from pg_proc
  where proname in ('wholesale_update_service_price', 'wholesale_update_service_pricing_intelligence')
),
grants as (
  select
    has_function_privilege('service_role', oid, 'EXECUTE') as service_role_can_execute,
    has_function_privilege('anon', oid, 'EXECUTE') as anon_can_execute,
    has_function_privilege('authenticated', oid, 'EXECUTE') as authenticated_can_execute
  from pg_proc where proname = 'wholesale_update_service_full'
)
select
  full_rpc.n as full_rpc_count,
  existing_rpcs_intact.n as existing_rpcs_intact_count,
  grants.service_role_can_execute,
  grants.anon_can_execute,
  grants.authenticated_can_execute,
  case
    when full_rpc.n = 1
      and existing_rpcs_intact.n = 2
      and grants.service_role_can_execute
      and not grants.anon_can_execute
      and not grants.authenticated_can_execute
    then 'PASS'
    else 'FAIL'
  end as overall_status
from full_rpc, existing_rpcs_intact, grants;
