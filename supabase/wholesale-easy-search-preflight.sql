-- ============================================================================
-- Preflight — run BEFORE wholesale-easy-search-migration.sql
-- ============================================================================
-- Confirms the two new Easy Search tables don't already exist in an
-- unexpected shape, and that their one real dependency (wholesale_categories,
-- the "Model" level of the Equipment -> Model -> Failure/Service -> Price
-- catalog, for the optional catalog_model_id link) is present. Entirely
-- read-only.
--
-- RESULT CONTRACT (same convention as every other preflight in this repo):
--   check_number integer, check_name text, status text ('PASS'/'FAIL'/'STOP'),
--   details text. check_number 99 is the final OVERALL STATUS row. A
--   synthetic OVERALL STATUS/STOP row is appended ONLY if the real checks
--   below somehow produced zero rows.
-- ============================================================================

with raw as (
  select
    exists (select 1 from information_schema.tables where table_schema='public' and table_name='wholesale_categories') as categories_table_exists,
    exists (select 1 from information_schema.tables where table_schema='public' and table_name='wholesale_device_models') as models_table_already_exists,
    exists (select 1 from information_schema.tables where table_schema='public' and table_name='wholesale_device_model_codes') as codes_table_already_exists,
    (select count(*) from wholesale_categories) as categories_count
),
checks as (
  select 1 as check_number, 'wholesale_categories_exists' as check_name,
    case when categories_table_exists then 'PASS' else 'STOP' end as status,
    'wholesale_categories exists=' || categories_table_exists || ', row_count=' || coalesce(categories_count, 0)
      || ' — required as the FK target for wholesale_device_models.catalog_model_id (nullable, but the table must '
      || 'exist for the column''s foreign key constraint to be created at all)'
  from raw

  union all

  select 2, 'easy_search_tables_not_already_present',
    case when not (models_table_already_exists or codes_table_already_exists) then 'PASS' else 'STOP' end,
    'wholesale_device_models exists=' || models_table_already_exists
      || ', wholesale_device_model_codes exists=' || codes_table_already_exists
      || ' — expect both false on a first run. If either already exists, STOP and investigate before running the '
      || 'migration (it uses "create table if not exists", so it would silently no-op on a pre-existing table with a '
      || 'DIFFERENT shape than this feature expects rather than erroring — safer to confirm by hand first).'
  from raw
),
overall as (
  select
    case
      when bool_or(status = 'STOP') then 'STOP'
      when bool_or(status = 'FAIL') then 'FAIL'
      else 'PASS'
    end as status
  from checks
),
report as (
  select check_number, check_name, status, details from checks
  union all
  select 99, 'OVERALL STATUS', overall.status,
    'PASS = safe to run wholesale-easy-search-migration.sql as-is. STOP = do NOT run the migration — either '
      || 'wholesale_categories is missing (should never happen in a real Torays Boost environment) or the Easy '
      || 'Search tables already exist and need manual review first.'
  from overall
)
select check_number, check_name, status, details
from report

union all

select 0, 'OVERALL STATUS', 'STOP',
  'ZERO CHECK ROWS WERE RETURNED — this preflight produced no results at all, which should never happen under '
    || 'correct execution. Treat this as NO-GO/STOP: do NOT run the migration. Re-run this file with its full, '
    || 'unmodified text selected, in the correct database/schema; if it still returns only this one row, tell '
    || 'Claude before proceeding.'
where not exists (select 1 from report)

order by check_number;
