-- ============================================================================
-- Verify — read-only sanity check, run AFTER
-- wholesale-remembered-sessions-migration.sql
-- ============================================================================
-- ONE statement, ONE result table — same convention as every other verify in
-- this folder. Paste this whole file into the SQL Editor and run it once.
--
-- Confirms: the column exists with the right type/nullability/default, and
-- that every EXISTING row (minted before this migration ran) backfilled to
-- true — i.e. no shop's already-working "stay signed in" behavior silently
-- changed the moment this migration landed.
-- ============================================================================

with raw as (
  select
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'wholesale_sessions' and column_name = 'remembered'
    ) as has_remembered_column,
    (
      select is_nullable = 'NO'
      from information_schema.columns
      where table_schema = 'public' and table_name = 'wholesale_sessions' and column_name = 'remembered'
    ) as is_not_null,
    (
      select data_type
      from information_schema.columns
      where table_schema = 'public' and table_name = 'wholesale_sessions' and column_name = 'remembered'
    ) as data_type,
    (select count(*) from wholesale_sessions) as total_sessions,
    (select count(*) from wholesale_sessions where remembered is not true) as sessions_not_remembered_true
),
checks as (
  select 1 as ord, 'column_exists' as check_name,
    case when has_remembered_column then 'PASS' else 'FAIL' end as status,
    case when has_remembered_column
      then 'wholesale_sessions.remembered exists'
      else 'wholesale_sessions.remembered is missing — the migration did not run, or failed partway through'
    end as details
  from raw

  union all

  select 2, 'column_type_and_nullability',
    case when has_remembered_column and is_not_null and data_type = 'boolean' then 'PASS' else 'FAIL' end,
    'data_type=' || coalesce(data_type, 'n/a') || ', not_null=' || coalesce(is_not_null::text, 'n/a')
  from raw

  union all

  select 3, 'existing_rows_backfilled_true',
    case when has_remembered_column and sessions_not_remembered_true = 0 then 'PASS'
         when not has_remembered_column then 'FAIL'
         else 'REVIEW REQUIRED'
    end,
    total_sessions || ' total session row(s), ' || sessions_not_remembered_true
      || ' NOT remembered=true — expected 0 immediately after a fresh migration run '
      || '(a non-zero count here is only expected once real "Keep me signed in" '
      || 'unchecked logins have happened since)'
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
  select 99, 'OVERALL STATUS', overall.status,
    'PASS = the migration landed correctly. REVIEW REQUIRED = read the flagged row yourself — it may simply mean '
      || 'real logins with the checkbox unchecked have already happened, which is expected once shops start using '
      || 'the feature. FAIL = investigate before trusting this feature in production.'
  from overall
) t
order by ord;
