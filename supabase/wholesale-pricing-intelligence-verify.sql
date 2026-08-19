-- ============================================================================
-- Read-only verification for wholesale-pricing-intelligence-migration.sql
-- ============================================================================
-- Run this AFTER wholesale-pricing-intelligence-migration.sql, in the
-- Supabase SQL Editor. Every statement here is a SELECT — nothing here
-- writes, updates, deletes, or alters anything. Safe to run as many times as
-- you want, at any point, forever.
-- ============================================================================

-- 1. wholesale_portal_settings exists with exactly one row (id = 1) and the
--    expected defaults.
select id, default_target_margin_percent, rounding_rule, sales_visible, sales_status, sales_entry_blocked
from wholesale_portal_settings;
-- expect exactly 1 row: id=1, default_target_margin_percent=40.00,
-- rounding_rule='nearest_1', sales_visible=true, sales_status='maintenance',
-- sales_entry_blocked=true (unless an admin already changed it via DESK)

-- 2. The two new wholesale_services columns exist, nullable, no default.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_name = 'wholesale_services'
  and column_name in ('recommended_price', 'target_margin_percent')
order by column_name;
-- expect 2 rows, both is_nullable = YES, column_default = null

-- 3. The four new wholesale_price_history columns exist, nullable.
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'wholesale_price_history'
  and column_name in ('old_recommended_price', 'new_recommended_price', 'old_target_margin_percent', 'new_target_margin_percent')
order by column_name;
-- expect 4 rows, all is_nullable = YES

-- 4. Both new CHECK constraints on wholesale_services exist.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'wholesale_services'::regclass
  and conname in ('wholesale_services_recommended_price_check', 'wholesale_services_target_margin_percent_check')
order by conname;
-- expect 2 rows

-- 5. No existing service row was touched by this migration — every
--    recommended_price/target_margin_percent is still null unless an admin
--    has already used the new DESK controls since the migration ran.
select count(*) as services_with_recommended_price,
       (select count(*) from wholesale_services where target_margin_percent is not null) as services_with_target_margin
from wholesale_services
where recommended_price is not null;

-- 6. Both new RPCs exist, with the expected argument signature.
select proname, pg_get_function_identity_arguments(oid) as args
from pg_proc
where proname in ('wholesale_update_service_pricing_intelligence', 'wholesale_update_portal_settings')
order by proname;
-- expect 2 rows

-- 7. The existing price RPC is untouched — same signature as before this
--    migration ever ran.
select proname, pg_get_function_identity_arguments(oid) as args
from pg_proc
where proname = 'wholesale_update_service_price';
-- expect exactly 1 row: args = "p_service_id uuid, p_admin_id uuid,
-- p_pricing_type text, p_fixed_price numeric, p_price_min numeric,
-- p_price_max numeric, p_currency text DEFAULT 'USD'::text"

-- 8. EXECUTE on both new RPCs is granted only to service_role, revoked from
--    public/anon/authenticated — same posture as every other wholesale RPC.
select p.proname,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p
where p.proname in ('wholesale_update_service_pricing_intelligence', 'wholesale_update_portal_settings');
-- expect 2 rows, each: service_role_can_execute=true, anon_can_execute=false,
-- authenticated_can_execute=false

-- 9. RLS is enabled on wholesale_portal_settings, with zero policies.
select relrowsecurity
from pg_class
where relname = 'wholesale_portal_settings';
-- expect TRUE

select count(*) as policy_count
from pg_policies
where tablename = 'wholesale_portal_settings';
-- expect 0

-- ============================================================================
-- 10. POST-MIGRATION SUMMARY — one row, every check above collapsed into it.
-- ============================================================================
with settings_row as (
  select count(*) as n from wholesale_portal_settings where id = 1
),
services_columns as (
  select count(*) as n
  from information_schema.columns
  where table_name = 'wholesale_services'
    and column_name in ('recommended_price', 'target_margin_percent')
),
history_columns as (
  select count(*) as n
  from information_schema.columns
  where table_name = 'wholesale_price_history'
    and column_name in ('old_recommended_price', 'new_recommended_price', 'old_target_margin_percent', 'new_target_margin_percent')
),
constraints_present as (
  select count(*) as n
  from pg_constraint
  where conrelid = 'wholesale_services'::regclass
    and conname in ('wholesale_services_recommended_price_check', 'wholesale_services_target_margin_percent_check')
),
rpcs_present as (
  select count(*) as n
  from pg_proc
  where proname in ('wholesale_update_service_pricing_intelligence', 'wholesale_update_portal_settings')
),
existing_rpc_intact as (
  select count(*) as n
  from pg_proc
  where proname = 'wholesale_update_service_price'
),
rls as (
  select
    (select relrowsecurity from pg_class where relname = 'wholesale_portal_settings') as rls_enabled,
    (select count(*) from pg_policies where tablename = 'wholesale_portal_settings') as policy_count
)
select
  settings_row.n as settings_row_count,
  services_columns.n as services_columns_count,
  history_columns.n as history_columns_count,
  constraints_present.n as constraints_present_count,
  rpcs_present.n as new_rpcs_count,
  existing_rpc_intact.n as existing_price_rpc_intact_count,
  rls.rls_enabled,
  rls.policy_count,
  case
    when settings_row.n = 1
      and services_columns.n = 2
      and history_columns.n = 4
      and constraints_present.n = 2
      and rpcs_present.n = 2
      and existing_rpc_intact.n = 1
      and rls.rls_enabled
      and rls.policy_count = 0
    then 'PASS'
    else 'FAIL'
  end as overall_status
from settings_row, services_columns, history_columns, constraints_present, rpcs_present, existing_rpc_intact, rls;
