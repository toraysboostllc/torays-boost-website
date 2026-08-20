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
-- Run in the same Supabase project's SQL Editor, AFTER
-- wholesale-retention-preflight.sql has returned OVERALL STATUS = PASS.
-- Independent of wholesale-legal-migration.sql (no foreign key or other hard
-- dependency on wholesale_legal_documents/wholesale_legal_acceptances) —
-- this file only needs wholesale_access_log and profiles, both already
-- created by earlier migrations.
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
-- (IP address, user-agent string) are cleared. No `DELETE` statement of any
-- kind appears anywhere in this file.
--
-- NEVER touches, by construction (grep this file for the three table names
-- below — none of them ever appears after UPDATE/DELETE/INSERT in this
-- file's function body; wholesale-retention-verify.sql proves this
-- functionally, not just by grep):
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
-- must supply it explicitly. It is validated to be a whole number strictly
-- between 1 and RETENTION_DAYS_HARD_MAX (3650 — a ten-year sanity ceiling
-- against a typo like an extra zero, not a business decision about what the
-- real period should be). Torays Boost has not set a business or legal
-- retention period for access-log IP/user-agent data; per the internal note
-- already on record (torays-boost-pro-legal-framework.md, Section 12, point
-- 7), that number is a decision for a Florida-licensed attorney, not a
-- default this migration is allowed to bake in. Until that number exists,
-- this procedure simply is not called with real intent — dry-run mode
-- exists specifically so it CAN be exercised and verified before any real
-- number is chosen.
--
-- ----------------------------------------------------------------------------
-- DRY-RUN MODE, IDEMPOTENCY, AND THE OPERATION LOG
-- ----------------------------------------------------------------------------
-- p_dry_run defaults to TRUE (the only default in this function — a safety
-- default, not a retention-period default). In dry-run mode, the function
-- counts exactly which rows WOULD be anonymized and returns/logs that count
-- WITHOUT writing anything to wholesale_access_log itself — no UPDATE
-- statement executes on that table on the dry-run path at all, making it
-- read-only in practice, not merely "harmless in effect."
--
-- Every call — dry-run or real, successful or rejected by validation —
-- either inserts exactly one row into wholesale_retention_runs (on a
-- successful validated call) or raises an exception and inserts nothing (on
-- a rejected call: invalid admin, invalid retention_days). There is no path
-- where the function silently does nothing without either succeeding or
-- raising. wholesale_retention_runs is itself append-only (its own trigger,
-- section 2 below) — the permanent record of every run can never be edited
-- or deleted after the fact, by any caller, including service_role.
--
-- Re-running with the same p_retention_days is idempotent in effect: a row
-- already anonymized by a prior real run (ip and user_agent both already
-- null) is excluded from a later call's rows_matched count, so
-- rows_matched reflects real remaining work each time, not the same rows
-- counted forever.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. wholesale_retention_runs — append-only log of every retention run
--    (dry-run or real, successful calls only — a rejected/exception call
--    writes nothing here). This table is intentionally NOT covered by any
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
  rows_matched integer not null check (rows_matched >= 0),
  rows_affected integer not null check (rows_affected >= 0),
  notes text
);

create index if not exists idx_wholesale_retention_runs_run_at
  on wholesale_retention_runs(run_at desc);

alter table wholesale_retention_runs enable row level security;
-- Same "RLS enabled, zero policies, service_role only" posture as every
-- other wholesale_* table — see wholesale-migration.sql's header.

-- ----------------------------------------------------------------------------
-- 2. wholesale_retention_runs — append-only guard. Blocks UPDATE and DELETE
--    unconditionally, for every role including service_role, exactly the
--    same pattern as trg_wholesale_price_history_append_only
--    (wholesale-legal-migration.sql). The only legitimate write path is the
--    single INSERT inside wholesale_run_data_retention() below.
-- ----------------------------------------------------------------------------
create or replace function public.wholesale_retention_runs_append_only_guard()
returns trigger language plpgsql as $$
begin
  raise exception 'wholesale_retention_runs_is_append_only';
end;
$$;

drop trigger if exists trg_wholesale_retention_runs_append_only on wholesale_retention_runs;
create trigger trg_wholesale_retention_runs_append_only
  before update or delete on wholesale_retention_runs
  for each row execute function public.wholesale_retention_runs_append_only_guard();

-- ----------------------------------------------------------------------------
-- 3. wholesale_run_data_retention — the procedure itself. SECURITY INVOKER
--    (the default — never SECURITY DEFINER; this function runs with the
--    privileges of whoever calls it, exactly like every other wholesale_*
--    RPC in this project, see wholesale-legal-migration.sql section 7-8) and
--    a fixed, explicit search_path (public, pg_temp) so it can never be
--    tricked by a caller-controlled search_path into resolving an
--    unqualified identifier against an attacker-planted object in another
--    schema.
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
  -- uses (wholesale_publish_legal_document, wholesale-legal-migration.sql
  -- section 7) — never trusts a role claim from the caller, always re-reads
  -- profiles with the service role.
  if not exists (
    select 1 from public.profiles where id = p_admin_id and role = 'admin' and status = 'approved'
  ) then
    raise exception 'invalid_admin';
  end if;

  -- Required, validated, and bounded — see this file's header for why there
  -- is no default and no business-decided number here. 3650 = 10 years, a
  -- typo guard only, mirrored by the caller-side RETENTION_DAYS_MAX in
  -- api/wholesale-admin.js (defense in depth: the same limit enforced at
  -- both layers, neither trusting the other alone).
  if p_retention_days is null or p_retention_days <= 0 or p_retention_days > 3650 then
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
    -- No UPDATE statement executes on this path at all — dry-run is
    -- read-only in practice, not merely "harmless in effect."
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
--   Run supabase/wholesale-retention-preflight.sql BEFORE this file, and
--   supabase/wholesale-retention-verify.sql AFTER.
--
--   supabase/wholesale-retention-rollback.sql documents how to undo this
--   file — its DEFAULT path is non-destructive (drops only the callable
--   procedure, preserves wholesale_retention_runs and its audit history in
--   full). It is never run automatically and is not part of this migration.
-- ============================================================================
