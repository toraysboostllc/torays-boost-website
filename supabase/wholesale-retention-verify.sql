-- ============================================================================
-- Verify — run AFTER wholesale-retention-migration.sql
-- ============================================================================
-- Same convention as wholesale-legal-verify.sql. Paste this whole file into
-- the SQL Editor and run it once. Read the check_name/status/details rows,
-- and the final OVERALL STATUS row.
--
-- NOT purely read-only: several checks below (the append-only guard, dry-run
-- read-only behavior, real anonymization behavior, validation rejections)
-- can only be confirmed by actually attempting the write and observing
-- whether Postgres/the function accepts or rejects it. To make this safe to
-- run "any time, as many times as you want, forever," the ENTIRE file is
-- wrapped in one explicit transaction that ends in ROLLBACK, never COMMIT
-- (see the very last statement).
--
-- Every synthetic row this file creates is tagged with the literal marker
-- '__wsr_verify__' somewhere in a text field, for the same reason
-- wholesale-legal-verify.sql tags its own rows with '__wsl_verify__' — so
-- that in the extremely unlikely event this file is ever run without
-- reaching its own final ROLLBACK, any stray row left behind is trivially
-- identifiable and removable by searching for that marker.
-- ============================================================================

begin;

create temporary table _wsr_verify_results (
  ord int,
  check_name text,
  status text,
  details text
) on commit drop;

-- ----------------------------------------------------------------------------
-- Structural checks (1-6): table, columns, triggers, RPC signature/security/
-- grants — pure metadata reads.
-- ----------------------------------------------------------------------------
insert into _wsr_verify_results
select 1, 'retention_runs_table_and_columns_present',
  case when
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'wholesale_retention_runs')
    and exists (select 1 from information_schema.columns where table_schema='public' and table_name='wholesale_retention_runs' and column_name='admin_id')
    and exists (select 1 from information_schema.columns where table_schema='public' and table_name='wholesale_retention_runs' and column_name='retention_days')
    and exists (select 1 from information_schema.columns where table_schema='public' and table_name='wholesale_retention_runs' and column_name='dry_run')
    and exists (select 1 from information_schema.columns where table_schema='public' and table_name='wholesale_retention_runs' and column_name='rows_matched')
    and exists (select 1 from information_schema.columns where table_schema='public' and table_name='wholesale_retention_runs' and column_name='rows_affected')
  then 'PASS' else 'FAIL' end,
  'wholesale_retention_runs exists with admin_id/retention_days/dry_run/rows_matched/rows_affected';

insert into _wsr_verify_results
select 2, 'retention_days_check_constraint_present',
  case when (
    select count(*) from pg_constraint c join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace
      where n.nspname='public' and t.relname='wholesale_retention_runs' and pg_get_constraintdef(c.oid) ilike '%retention_days > 0%'
  ) >= 1 then 'PASS' else 'FAIL' end,
  'a CHECK constraint enforcing retention_days > 0 exists on wholesale_retention_runs (schema-level enforcement, not just application code)';

insert into _wsr_verify_results
select 3, 'append_only_trigger_present',
  case when exists (select 1 from pg_trigger where tgname='trg_wholesale_retention_runs_append_only' and not tgisinternal)
  then 'PASS' else 'FAIL' end,
  'trg_wholesale_retention_runs_append_only installed on wholesale_retention_runs';

insert into _wsr_verify_results
select 4, 'rpc_exists_exactly_once_no_overloads',
  case when (
    select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname='public' and p.proname='wholesale_run_data_retention'
  ) = 1 then 'PASS' else 'FAIL' end,
  'expects exactly 1 function named wholesale_run_data_retention in public — any count other than 1 means '
    || 'either it is missing, or more than one overload exists (which `create or replace function` cannot '
    || 'collapse if the argument types differ)';

insert into _wsr_verify_results
select 5, 'rpc_signature_exact',
  case when (
    select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname='public' and p.proname='wholesale_run_data_retention'
      and pg_get_function_identity_arguments(p.oid) = 'p_admin_id uuid, p_retention_days integer, p_dry_run boolean'
  ) = 1 then 'PASS' else 'FAIL' end,
  'expects identity arguments exactly: p_admin_id uuid, p_retention_days integer, p_dry_run boolean';

insert into _wsr_verify_results
select 6, 'rpc_is_security_invoker_with_fixed_search_path',
  case when (
    select not p.prosecdef
       and exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg ilike 'search_path=%')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname='public' and p.proname='wholesale_run_data_retention'
       and pg_get_function_identity_arguments(p.oid) = 'p_admin_id uuid, p_retention_days integer, p_dry_run boolean'
  ) is true then 'PASS' else 'FAIL' end,
  'prosecdef=false (SECURITY INVOKER, never SECURITY DEFINER) AND proconfig carries an explicit search_path entry '
    || '— confirms the function cannot be tricked by a caller-controlled search_path';

insert into _wsr_verify_results
select 7, 'rpc_grants_service_role_only',
  case when (
    select has_function_privilege('service_role', p.oid, 'EXECUTE') and not has_function_privilege('anon', p.oid, 'EXECUTE')
       and not has_function_privilege('authenticated', p.oid, 'EXECUTE') and not has_function_privilege('public', p.oid, 'EXECUTE')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname='public' and p.proname='wholesale_run_data_retention'
       and pg_get_function_identity_arguments(p.oid) = 'p_admin_id uuid, p_retention_days integer, p_dry_run boolean'
  ) is true then 'PASS' else 'FAIL' end,
  'service_role can execute, anon/authenticated/PUBLIC cannot';

-- ----------------------------------------------------------------------------
-- Setup for functional checks: one approved-admin profile (synthetic, or
-- reused if one already exists), and a snapshot of every table this
-- procedure must never touch, taken BEFORE any functional check below runs.
-- ----------------------------------------------------------------------------
do $$
declare
  v_admin_id uuid;
begin
  select id into v_admin_id from profiles where role = 'admin' and status = 'approved' limit 1;
  if v_admin_id is null then
    insert into profiles (id, role, status) values (gen_random_uuid(), 'admin', 'approved')
      returning id into v_admin_id;
  end if;
  create temporary table _wsr_verify_admin as select v_admin_id as admin_id;

  create temporary table _wsr_verify_scope_before as
    select
      (select count(*) from wholesale_legal_documents) as legal_documents_count,
      (select count(*) from wholesale_legal_acceptances) as legal_acceptances_count,
      (select count(*) from wholesale_price_history) as price_history_count;
end $$;

-- ----------------------------------------------------------------------------
-- Functional check (10): dry-run is fully read-only — a matching row's
-- entire content is byte-for-byte unchanged after a dry-run call, and the
-- call still logs an audit row with dry_run=true, rows_affected=0.
-- ----------------------------------------------------------------------------
do $$
declare
  v_log_id uuid;
  v_before record;
  v_after record;
  v_result jsonb;
  v_run_logged boolean;
begin
  insert into wholesale_access_log (event, ip, user_agent, created_at)
    values ('__wsr_verify__ login_success', '203.0.113.9', '__wsr_verify__ UA', now() - interval '400 days')
    returning id into v_log_id;

  select ip, user_agent, event, created_at into v_before from wholesale_access_log where id = v_log_id;

  select wholesale_run_data_retention((select admin_id from _wsr_verify_admin), 365, true) into v_result;

  select ip, user_agent, event, created_at into v_after from wholesale_access_log where id = v_log_id;

  select exists (
    select 1 from wholesale_retention_runs
    where admin_id = (select admin_id from _wsr_verify_admin) and dry_run = true and rows_affected = 0
      and run_at >= now() - interval '1 minute'
  ) into v_run_logged;

  insert into _wsr_verify_results values (
    10, 'dry_run_is_fully_read_only',
    case when v_before.ip = v_after.ip and v_before.user_agent = v_after.user_agent
      and v_before.event = v_after.event and v_before.created_at = v_after.created_at
      and (v_result->>'rows_affected')::int = 0 and (v_result->>'rows_matched')::int >= 1
      and v_run_logged
      then 'PASS' else 'FAIL' end,
    'row unchanged after dry_run=true: ' || (v_before.ip = v_after.ip and v_before.user_agent = v_after.user_agent)
      || '; result.rows_affected=' || (v_result->>'rows_affected') || ' (expect 0); result.rows_matched=' || (v_result->>'rows_matched') || ' (expect >=1)'
      || '; audit row logged with dry_run=true, rows_affected=0: ' || v_run_logged
  );
end $$;

-- ----------------------------------------------------------------------------
-- Functional check (11): a real run (dry_run=false) anonymizes ONLY
-- ip/user_agent on the matched row, never deletes it, and never touches a
-- row newer than the retention window.
-- ----------------------------------------------------------------------------
do $$
declare
  v_old_log_id uuid;
  v_new_log_id uuid;
  v_count_before bigint;
  v_count_after bigint;
  v_old_after record;
  v_new_after record;
  v_result jsonb;
begin
  select count(*) into v_count_before from wholesale_access_log;

  insert into wholesale_access_log (event, ip, user_agent, created_at)
    values ('__wsr_verify__ login_success_2', '198.51.100.7', '__wsr_verify__ UA 2', now() - interval '400 days')
    returning id into v_old_log_id;
  insert into wholesale_access_log (event, ip, user_agent, created_at)
    values ('__wsr_verify__ login_success_recent', '198.51.100.8', '__wsr_verify__ UA recent', now() - interval '10 days')
    returning id into v_new_log_id;

  select count(*) into v_count_before from wholesale_access_log; -- re-snapshot AFTER inserting this check's own rows

  select wholesale_run_data_retention((select admin_id from _wsr_verify_admin), 365, false) into v_result;

  select count(*) into v_count_after from wholesale_access_log;
  select ip, user_agent, event, created_at into v_old_after from wholesale_access_log where id = v_old_log_id;
  select ip, user_agent, event, created_at into v_new_after from wholesale_access_log where id = v_new_log_id;

  insert into _wsr_verify_results values (
    11, 'real_run_anonymizes_only_old_ip_user_agent_never_deletes',
    case when v_count_before = v_count_after
      and v_old_after.ip is null and v_old_after.user_agent is null
      and v_old_after.event = '__wsr_verify__ login_success_2'
      and v_new_after.ip = '198.51.100.8' and v_new_after.user_agent = '__wsr_verify__ UA recent'
      then 'PASS' else 'FAIL' end,
    'row count before=' || v_count_before || ', after=' || v_count_after || ' (expect equal — no DELETE ever); '
      || 'old row (400 days) ip/user_agent now null, event preserved: '
      || (v_old_after.ip is null and v_old_after.user_agent is null and v_old_after.event = '__wsr_verify__ login_success_2')
      || '; recent row (10 days, within the 365-day window) left completely untouched: '
      || (v_new_after.ip = '198.51.100.8' and v_new_after.user_agent = '__wsr_verify__ UA recent')
  );
end $$;

-- ----------------------------------------------------------------------------
-- Functional check (12): never touches wholesale_legal_documents,
-- wholesale_legal_acceptances, or wholesale_price_history — row counts
-- unchanged from the snapshot taken before any functional check ran, even
-- after two real wholesale_run_data_retention calls above.
-- ----------------------------------------------------------------------------
insert into _wsr_verify_results
select 12, 'never_touches_legal_documents_acceptances_or_price_history',
  case when
    (select legal_documents_count from _wsr_verify_scope_before) = (select count(*) from wholesale_legal_documents)
    and (select legal_acceptances_count from _wsr_verify_scope_before) = (select count(*) from wholesale_legal_acceptances)
    and (select price_history_count from _wsr_verify_scope_before) = (select count(*) from wholesale_price_history)
  then 'PASS' else 'FAIL' end,
  'wholesale_legal_documents count before/after: ' || (select legal_documents_count from _wsr_verify_scope_before) || '/' || (select count(*) from wholesale_legal_documents)
    || '; wholesale_legal_acceptances: ' || (select legal_acceptances_count from _wsr_verify_scope_before) || '/' || (select count(*) from wholesale_legal_acceptances)
    || '; wholesale_price_history: ' || (select price_history_count from _wsr_verify_scope_before) || '/' || (select count(*) from wholesale_price_history)
    || ' — expect every pair equal';

-- ----------------------------------------------------------------------------
-- Functional check (13): validation rejects invalid retention_days (null,
-- zero, negative, over the 3650 ceiling) and an invalid admin — and none of
-- these rejected calls writes an audit row.
-- ----------------------------------------------------------------------------
do $$
declare
  v_admin_id uuid := (select admin_id from _wsr_verify_admin);
  v_runs_before bigint;
  v_runs_after bigint;
  v_zero_rejected boolean := false;
  v_negative_rejected boolean := false;
  v_null_rejected boolean := false;
  v_over_max_rejected boolean := false;
  v_bad_admin_rejected boolean := false;
begin
  select count(*) into v_runs_before from wholesale_retention_runs;

  begin
    perform wholesale_run_data_retention(v_admin_id, 0, true);
  exception when others then v_zero_rejected := true;
  end;

  begin
    perform wholesale_run_data_retention(v_admin_id, -10, true);
  exception when others then v_negative_rejected := true;
  end;

  begin
    perform wholesale_run_data_retention(v_admin_id, null, true);
  exception when others then v_null_rejected := true;
  end;

  begin
    perform wholesale_run_data_retention(v_admin_id, 999999, true);
  exception when others then v_over_max_rejected := true;
  end;

  begin
    perform wholesale_run_data_retention(gen_random_uuid(), 365, true);
  exception when others then v_bad_admin_rejected := true;
  end;

  select count(*) into v_runs_after from wholesale_retention_runs;

  insert into _wsr_verify_results values (
    13, 'invalid_inputs_rejected_and_write_no_audit_row',
    case when v_zero_rejected and v_negative_rejected and v_null_rejected and v_over_max_rejected
      and v_bad_admin_rejected and v_runs_before = v_runs_after
      then 'PASS' else 'FAIL' end,
    'retention_days=0 rejected=' || v_zero_rejected || ', =-10 rejected=' || v_negative_rejected
      || ', =null rejected=' || v_null_rejected || ', =999999 (>3650) rejected=' || v_over_max_rejected
      || ', invalid admin rejected=' || v_bad_admin_rejected
      || '; wholesale_retention_runs count before=' || v_runs_before || ', after=' || v_runs_after || ' (expect equal — no audit row from a rejected call)'
  );
end $$;

-- ----------------------------------------------------------------------------
-- Functional check (14): idempotency — re-running with the same
-- retention_days against an already-anonymized row does not re-count it as
-- "matched."
-- ----------------------------------------------------------------------------
do $$
declare
  v_result jsonb;
begin
  select wholesale_run_data_retention((select admin_id from _wsr_verify_admin), 365, true) into v_result;

  insert into _wsr_verify_results values (
    14, 'idempotent_rerun_excludes_already_anonymized_rows',
    case when (v_result->>'rows_matched')::int = 0 then 'PASS' else 'FAIL' end,
    're-running dry_run=true with the same 365-day window after check 11 already anonymized the matching row — '
      || 'rows_matched=' || (v_result->>'rows_matched') || ' (expect 0: an already-null ip/user_agent row is not '
      || 're-counted as remaining work)'
  );
end $$;

-- ----------------------------------------------------------------------------
-- Functional check (15): the append-only guard on wholesale_retention_runs
-- itself rejects a direct UPDATE and DELETE against a real run row this
-- file's own checks above already created.
-- ----------------------------------------------------------------------------
do $$
declare
  v_run_id uuid;
  v_update_rejected boolean := false;
  v_delete_rejected boolean := false;
begin
  select id into v_run_id from wholesale_retention_runs
    where admin_id = (select admin_id from _wsr_verify_admin) order by run_at desc limit 1;

  begin
    update wholesale_retention_runs set rows_affected = 999 where id = v_run_id;
  exception when others then
    v_update_rejected := true;
  end;

  begin
    delete from wholesale_retention_runs where id = v_run_id;
  exception when others then
    v_delete_rejected := true;
  end;

  insert into _wsr_verify_results values (
    15, 'retention_runs_append_only_guard_rejects_update_and_delete',
    case when v_update_rejected and v_delete_rejected then 'PASS' else 'FAIL' end,
    'update_rejected=' || v_update_rejected || ', delete_rejected=' || v_delete_rejected || ' — expect true, true'
  );
end $$;

-- ----------------------------------------------------------------------------
-- Final result set.
-- ----------------------------------------------------------------------------
select check_name, status, details
from (
  select ord, check_name, status, details from _wsr_verify_results
  union all
  select
    99,
    'OVERALL STATUS',
    case
      when bool_or(status = 'FAIL') then 'FAIL'
      when bool_or(status = 'REVIEW REQUIRED') then 'REVIEW REQUIRED'
      else 'PASS'
    end,
    'PASS = every structural and functional check landed as expected. FAIL = investigate before trusting this '
      || 'procedure.'
  from _wsr_verify_results
) t
order by ord;

-- Nothing above is ever committed — every synthetic row this file created
-- (the admin profile if one didn't already exist, the access_log rows, the
-- retention_runs rows) is undone here. Re-run this file safely as many
-- times as you want, forever.
rollback;
