-- ============================================================================
-- Read-only verification for wholesale-easy-search-migration.sql
-- ============================================================================
-- Run this AFTER wholesale-easy-search-migration.sql, in the Supabase SQL
-- Editor. Every statement here is a SELECT — nothing here writes, updates,
-- deletes, or alters anything. Safe to run as many times as you want, at any
-- point, forever.
-- ============================================================================

-- 1. Both tables exist.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('wholesale_device_models', 'wholesale_device_model_codes')
order by table_name;
-- expect exactly 2 rows

-- 2. wholesale_device_models has every expected column.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_name = 'wholesale_device_models'
order by ordinal_position;
-- expect: id (uuid), brand (text, NO), commercial_name (text, NO),
-- device_category (text, NO, 'phone'), year (integer, YES), screen (text),
-- processor (text), ram (text), storage (text), main_camera (text),
-- battery (text), catalog_model_id (uuid, YES), active (boolean, NO, true),
-- created_at, updated_at (timestamptz, NO)

-- 3. wholesale_device_model_codes has every expected column.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_name = 'wholesale_device_model_codes'
order by ordinal_position;
-- expect: id (uuid), device_model_id (uuid, NO), code (text, NO),
-- normalized_code (text, NO), region (text, YES), active (boolean, NO, true),
-- created_at, updated_at (timestamptz, NO)

-- 4. Foreign keys resolve to the right tables.
select
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name as references_table,
  ccu.column_name as references_column
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_name in ('wholesale_device_models', 'wholesale_device_model_codes')
order by tc.table_name, kcu.column_name;
-- expect: wholesale_device_model_codes.device_model_id -> wholesale_device_models.id
-- wholesale_device_models.catalog_model_id -> wholesale_categories.id

-- 5. The uniqueness invariant on normalized_code exists.
select indexname, indexdef
from pg_indexes
where tablename = 'wholesale_device_model_codes'
  and indexname = 'uq_wholesale_device_model_codes_normalized';
-- expect 1 row, definition containing "UNIQUE"

-- 6. Every other index exists.
select tablename, indexname
from pg_indexes
where tablename in ('wholesale_device_models', 'wholesale_device_model_codes')
order by tablename, indexname;
-- expect (beyond the primary keys and the unique index above):
-- idx_wholesale_device_models_catalog_model, idx_wholesale_device_models_brand,
-- idx_wholesale_device_models_active, idx_wholesale_device_model_codes_model,
-- idx_wholesale_device_model_codes_active

-- 7. Not-blank CHECK constraints exist.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in ('wholesale_device_models'::regclass, 'wholesale_device_model_codes'::regclass)
  and contype = 'c'
order by conname;
-- expect 4 rows: brand, commercial_name, code, normalized_code not-blank checks

-- 8. Belt-and-suspenders: no duplicate normalized_code actually made it past
--    the unique index (should be structurally impossible once it exists).
select normalized_code, count(*) as code_count
from wholesale_device_model_codes
group by normalized_code
having count(*) > 1;
-- expect ZERO rows

-- 9. updated_at triggers exist on both tables.
select event_object_table, trigger_name
from information_schema.triggers
where event_object_table in ('wholesale_device_models', 'wholesale_device_model_codes')
order by event_object_table;
-- expect 2 rows: trg_wholesale_device_models_touch_updated_at,
-- trg_wholesale_device_model_codes_touch_updated_at

-- 10. RLS is enabled on both tables, with zero policies.
select relname, relrowsecurity
from pg_class
where relname in ('wholesale_device_models', 'wholesale_device_model_codes');
-- expect both relrowsecurity = TRUE

select tablename, count(*) as policy_count
from pg_policies
where tablename in ('wholesale_device_models', 'wholesale_device_model_codes')
group by tablename;
-- expect ZERO rows (no policies on either table)

-- ============================================================================
-- 11. POST-MIGRATION SUMMARY — one row, every check above collapsed into it.
-- ============================================================================
with tables_present as (
  select count(*) as n from information_schema.tables
  where table_schema = 'public'
    and table_name in ('wholesale_device_models', 'wholesale_device_model_codes')
),
unique_index_present as (
  select count(*) as n from pg_indexes
  where tablename = 'wholesale_device_model_codes'
    and indexname = 'uq_wholesale_device_model_codes_normalized'
),
other_indexes_present as (
  select count(*) as n from pg_indexes
  where indexname in (
    'idx_wholesale_device_models_catalog_model', 'idx_wholesale_device_models_brand',
    'idx_wholesale_device_models_active', 'idx_wholesale_device_model_codes_model',
    'idx_wholesale_device_model_codes_active'
  )
),
checks_present as (
  select count(*) as n from pg_constraint
  where conrelid in ('wholesale_device_models'::regclass, 'wholesale_device_model_codes'::regclass)
    and contype = 'c'
),
triggers_present as (
  select count(*) as n from information_schema.triggers
  where event_object_table in ('wholesale_device_models', 'wholesale_device_model_codes')
),
duplicate_codes as (
  select count(*) as n from (
    select normalized_code from wholesale_device_model_codes
    group by normalized_code having count(*) > 1
  ) x
),
rls as (
  select
    bool_and(relrowsecurity) as both_rls_enabled,
    (select count(*) from pg_policies where tablename in ('wholesale_device_models', 'wholesale_device_model_codes')) as policy_count
  from pg_class
  where relname in ('wholesale_device_models', 'wholesale_device_model_codes')
)
select
  tables_present.n as tables_present_count,
  unique_index_present.n as unique_index_present_count,
  other_indexes_present.n as other_indexes_present_count,
  checks_present.n as check_constraints_present_count,
  triggers_present.n as triggers_present_count,
  duplicate_codes.n as duplicate_normalized_code_count,
  rls.both_rls_enabled,
  rls.policy_count,
  case
    when tables_present.n = 2
      and unique_index_present.n = 1
      and other_indexes_present.n = 5
      and checks_present.n = 4
      and triggers_present.n = 2
      and duplicate_codes.n = 0
      and rls.both_rls_enabled
      and rls.policy_count = 0
    then 'PASS'
    else 'FAIL'
  end as overall_status
from tables_present, unique_index_present, other_indexes_present, checks_present,
     triggers_present, duplicate_codes, rls;
