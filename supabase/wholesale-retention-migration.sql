-- ============================================================================
-- Wholesale data retention / anonymization procedure
-- ============================================================================
-- Closes the gap flagged as Privacy & Data Security Policy (Document 4 of
-- the Torays Boost Pro Legal Bundle v1.0), Section 10(d): "information that
-- is no longer reasonably necessary is deleted or anonymized, subject to any
-- legal retention requirement" — and its internal implementation note in
-- torays-boost-pro-legal-framework.md, which requires a *documented
-- procedure* (not just contract language) to exist before real publication.
--
-- Additive follow-up to wholesale-legal-migration.sql. Run in the same
-- Supabase project's SQL Editor, AFTER that file has already run at least
-- once (this file references wholesale_legal_documents/wholesale_legal_
-- acceptances only to explicitly document that it never touches them, not
-- as a hard dependency for its own objects).
--
-- ----------------------------------------------------------------------------
-- WHAT THIS PROCEDURE TOUCHES, AND WHAT IT NEVER TOUCHES — read this first
-- ----------------------------------------------------------------------------
-- Touches, by design: ONLY wholesale_access_log. Old rows (older than a
-- caller-supplied retention window) have their `ip`/`user_agent` columns set
-- to NULL ("anonymized" — never deleted). The row itself, its `event` and
-- `created_at`, and its `shop_id`/`device_id` linkage are ALWAYS preserved,
-- so the security/audit trail ("what happened, when, to which shop") stays
-- intact — only the two fields that are actually personal/identifying data
-- (IP address, user-agent string) are cleared.
--
-- NEVER touches, by construction (grep this file for the three table names
-- below — none of them ever appears after UPDATE/DELETE in this file):
--   - wholesale_legal_documents  (published legal text — already immutable
--     via trg_wholesale_legal_documents_immutability; this procedure adds
--     no new way around that guard)
--   - wholesale_legal_acceptances (append-only clickwrap evidence)
--   - wholesale_price_history     (append-only via
--     trg_wholesale_price_history_append_only)
-- These three are the exact three categories Document 4 Section 10(c) and
-- the Electronic Consent & Records Disclosure (Document 6) commit to never
-- deleting by ordinary account changes — this procedure is deliberately
-- scoped to never even attempt touching them, rather than relying on a
-- runtime check to stop it.
--
-- ----------------------------------------------------------------------------
-- THE RETENTION PERIOD IS NOT DECIDED HERE — INTENTIONALLY
-- ----------------------------------------------------------------------------
-- wholesale_run_data_retention() takes p_retention_days as a REQUIRED
-- argument with no default value in the function signature — every call
-- must supply it explicitly. Torays Boost has not set a business or legal
-- retention period for access-log IP/user-agent data; per the internal note
-- already on record (torays-boost-pro-legal-framework.md, Section 12, point
-- 7), that number is a decision for a Florida-licensed attorney, not a
-- default this migration is allowed to bake in. Until that number exists,
-- this procedure simply is not called with real intent — dry-run mode
-- exists specifically so it CAN be exercised and verified before any real
-- number is chosen.
--
-- ----------------------------------------------------------------------------
-- DRY-RUN MODE AND THE OPERATION LOG
-- ----------------------------------------------------------------------------
-- p_dry_run defaults to TRUE (the only default in this function — a safety
-- default, not a retention-period default). In dry-run mode, the function
-- counts exactly which rows WOULD be anonymized and returns/logs that count
-- WITHOUT writing anything to wholesale_access_log itself. Every call —
-- dry-run or real — inserts exactly one row into the new
-- wholesale_retention_runs audit table below, so there is a permanent,
-- append-only record of every time this procedure ran, by whom, with what
-- parameters, and what it did or would have done. That audit table is
-- itself never touched by the retention logic (it only ever grows).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. wholesale_retention_runs — append-only log of every retention run
--    (dry-run or real). This table is intentionally NOT covered by any
--    retention/cleanup logic of its own — it is the permanent record that a
--    given cleanup happened, and must outlive the data it describes.
-- ----------------------------------------------------------------------------
create table if not exists wholesale_retention_runs (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  admin_id uuid references profiles(id) on delete set null,
  table_name text not null,
  retention_days integer not null check (retention_days > 0),
  dry_run boolean not null,
  rows_matched integer not null,
  rows_affected integer not null,
  notes text
);

create index if not exists idx_wholesale_retention_runs_run_at
  on wholesale_retention_runs(run_at desc);

alter table wholesale_retention_runs enable row level security;
-- Same "RLS enabled, zero policies, service_role only" posture as every
-- other wholesale_* table — see wholesale-migration.sql's header.

-- ----------------------------------------------------------------------------
-- 2. wholesale_run_data_retention — the procedure itself.
-- ----------------------------------------------------------------------------
create or replace function public.wholesale_run_data_retention(
  p_admin_id uuid,
  p_retention_days integer,
  p_dry_run boolean default true
) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_cutoff timestamptz;
  v_matched integer;
  v_affected integer := 0;
  v_notes text;
begin
  -- Same admin double-check every other admin-facing wholesale RPC already
  -- uses (wholesale_publish_legal_document, above) — never trusts a role
  -- claim from the caller, always re-reads profiles with the service role.
  if not exists (
    select 1 from public.profiles where id = p_admin_id and role = 'admin' and status = 'approved'
  ) then
    raise exception 'invalid_admin';
  end if;

  if p_retention_days is null or p_retention_days <= 0 then
    raise exception 'invalid_retention_days';
  end if;

  v_cutoff := now() - (p_retention_days || ' days')::interval;

  -- Scope, exactly: wholesale_access_log rows older than the cutoff that
  -- still carry an ip or user_agent value worth anonymizing. Rows already
  -- anonymized by a prior run (ip and user_agent both already null) are
  -- excluded from the count on purpose, so re-running this with the same
  -- parameters is idempotent and its "rows_matched" number reflects real
  -- remaining work, not the same rows counted forever.
  select count(*) into v_matched
    from wholesale_access_log
    where created_at < v_cutoff
      and (ip is not null or user_agent is not null);

  if p_dry_run then
    v_notes := 'dry_run: no rows modified';
  else
    update wholesale_access_log
      set ip = null, user_agent = null
      where created_at < v_cutoff
        and (ip is not null or user_agent is not null);
    get diagnostics v_affected = row_count;
    v_notes := 'executed: ip/user_agent anonymized on matched rows';
  end if;

  insert into wholesale_retention_runs
    (admin_id, table_name, retention_days, dry_run, rows_matched, rows_affected, notes)
  values
    (p_admin_id, 'wholesale_access_log', p_retention_days, p_dry_run, v_matched, v_affected, v_notes);

  return jsonb_build_object(
    'table', 'wholesale_access_log',
    'retention_days', p_retention_days,
    'dry_run', p_dry_run,
    'cutoff', v_cutoff,
    'rows_matched', v_matched,
    'rows_affected', v_affected
  );
end;
$$;

revoke execute on function public.wholesale_run_data_retention(uuid, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.wholesale_run_data_retention(uuid, integer, boolean)
  to service_role;

commit;

-- ============================================================================
-- Not part of the transaction above, on purpose — read this, do not run it
-- as part of this file:
--
--   PREFLIGHT (equivalent checks, run by hand or scripted before this file):
--     - confirm wholesale_access_log exists with ip/user_agent/created_at
--       columns (already true after wholesale-migration.sql).
--     - confirm profiles exists with role/status columns (already true).
--     - confirm wholesale_retention_runs does not already exist from a
--       previous partial attempt.
--
--   VERIFY (run after this file):
--     - call wholesale_run_data_retention(<real admin id>, 1, true) against
--       a project with at least one old wholesale_access_log row that has a
--       non-null ip — confirm rows_matched > 0, rows_affected = 0 (dry run
--       never writes), and that the matched row's ip is UNCHANGED afterward.
--     - call the same function with p_dry_run := false — confirm
--       rows_affected = rows_matched from the dry run immediately before it,
--       and that the matched row's ip/user_agent are now null while its
--       event/created_at/shop_id/device_id are unchanged.
--     - confirm a wholesale_retention_runs row was inserted for BOTH calls
--       above (one dry_run=true, one dry_run=false).
--     - confirm calling with p_retention_days = 0 or a negative number
--       raises invalid_retention_days and writes nothing.
--     - confirm a non-admin p_admin_id raises invalid_admin and writes
--       nothing, matching every other admin RPC's rejection behavior.
--     - grep this file (or the deployed function source via pg_proc) for
--       "wholesale_legal_documents", "wholesale_legal_acceptances", and
--       "wholesale_price_history" — confirm none of the three appears
--       anywhere in wholesale_run_data_retention's body.
--
--   ROLLBACK:
--     drop function if exists wholesale_run_data_retention(uuid, integer, boolean);
--     drop table if exists wholesale_retention_runs;
--   (No other object depends on either — safe to drop in this order, no
--   cascade needed. Dropping wholesale_retention_runs after real runs have
--   happened destroys that audit history — same caution as the rest of the
--   legal bundle's rollback: only do this before any real production use.)
-- ============================================================================
