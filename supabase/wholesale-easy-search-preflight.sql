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
    exists (select 1 from information_schema.tables where table_schema='public' and table_name='wholesale_device_model_codes') as codes_table_already_exists
),
checks as (
  select
    1 as check_number,
    'wholesale_categories_exists' as check_name,
    (case when categories_table_exists then 'PASS' else 'STOP' end) as status,
    -- No row count here on purpose (a prior version tried "select count(*)
    -- from wholesale_categories" directly in `raw`, unconditionally — a
    -- literal count(*) against a table that doesn't exist yet raises a
    -- hard Postgres error at query time regardless of the exists() check
    -- above, since Postgres validates every referenced relation when the
    -- query is PARSED, not conditionally per branch; that would crash this
    -- ENTIRE preflight with a raw error instead of reporting check 1 as a
    -- clean STOP). Existence alone is everything check 1 actually needs to
    -- decide PASS/STOP — a row count was never load-bearing, so the
    -- simplest fix is to just not compute one, rather than reach for a
    -- catalog-introspection workaround.
    ('wholesale_categories exists=' || categories_table_exists::text
      || ' — required as the FK target for wholesale_device_models.catalog_model_id (nullable, but the table must '
      || 'exist for the column''s foreign key constraint to be created at all)') as details
  from raw

  union all

  select
    2 as check_number,
    'easy_search_tables_not_already_present' as check_name,
    (case when not (models_table_already_exists or codes_table_already_exists) then 'PASS' else 'STOP' end) as status,
    ('wholesale_device_models exists=' || models_table_already_exists::text
      || ', wholesale_device_model_codes exists=' || codes_table_already_exists::text
      || ' — expect both false on a first run. If either already exists, STOP and investigate before running the '
      || 'migration (it uses "create table if not exists", so it would silently no-op on a pre-existing table with a '
      || 'DIFFERENT shape than this feature expects rather than erroring — safer to confirm by hand first).') as details
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
  select
    99 as check_number,
    'OVERALL STATUS' as check_name,
    overall.status as status,
    ('PASS = safe to run wholesale-easy-search-migration.sql as-is. STOP = do NOT run the migration — either '
      || 'wholesale_categories is missing (should never happen in a real Torays Boost environment) or the Easy '
      || 'Search tables already exist and need manual review first.') as details
  from overall
)
select check_number, check_name, status, details
from report

union all

select
  0 as check_number,
  'OVERALL STATUS' as check_name,
  'STOP' as status,
  ('ZERO CHECK ROWS WERE RETURNED — this preflight produced no results at all, which should never happen under '
    || 'correct execution. Treat this as NO-GO/STOP: do NOT run the migration. Re-run this file with its full, '
    || 'unmodified text selected, in the correct database/schema; if it still returns only this one row, tell '
    || 'Claude before proceeding.') as details
where not exists (select 1 from report)

order by check_number;
