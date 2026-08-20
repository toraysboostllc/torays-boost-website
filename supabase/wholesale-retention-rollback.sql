-- ============================================================================
-- Rollback for wholesale-retention-migration.sql — REFERENCE ONLY
-- ============================================================================
-- This file is NOT run automatically by anything — no script, no test, no CI
-- step references it. It exists so that IF this migration is ever run for
-- real and needs to be undone, the exact, reviewed steps already exist
-- instead of being improvised under pressure.
--
-- ----------------------------------------------------------------------------
-- DEFAULT PATH — NON-DESTRUCTIVE (Section 1 below). Run this if you want to
-- ----------------------------------------------------------------------------
-- stop the retention procedure from being callable at all, WITHOUT losing
-- any record of runs that already happened. It drops only the callable
-- procedure (the function itself, plus its append-only guard's trigger and
-- guard function) — wholesale_retention_runs, and every row already in it,
-- is left completely intact. This is the default and recommended path for
-- almost every real reason to run this file: pausing the feature, reverting
-- a bad edit to the function body, or removing the capability while a
-- retention-period decision is still pending the Florida attorney.
--
-- ****************************************************************************
-- SECTION 2 IS FULLY DESTRUCTIVE AND IS NOT THE DEFAULT — WARNING
-- ****************************************************************************
-- Section 2 (commented out below, requires deliberately uncommenting) drops
-- wholesale_retention_runs itself, destroying the permanent audit log of
-- every retention run that ever executed (who ran it, when, dry-run or
-- real, how many rows were matched/affected). Do not uncomment and run
-- Section 2 unless you have already exported/archived that table through
-- some other means and genuinely intend to give up that record. There is
-- essentially never a good reason to run Section 2 — dropping the callable
-- procedure (Section 1) is sufficient for every ordinary "undo this
-- feature" need; Section 2 exists only for a complete, deliberate teardown
-- of a project that will never use this procedure again.
-- ****************************************************************************
--
-- Order of operations in Section 1: trigger before its function, function
-- before nothing else depends on it (wholesale_run_data_retention itself
-- inserts into wholesale_retention_runs but does not need to be dropped
-- before that table survives — it is dropped first here simply because it
-- is the actual "capability" being removed).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- SECTION 1 — default, non-destructive. Removes the callable procedure and
-- its append-only guard mechanics; wholesale_retention_runs and all its rows
-- are left in place, untouched.
-- ----------------------------------------------------------------------------
drop function if exists public.wholesale_run_data_retention(uuid, integer, boolean);

-- The append-only guard on wholesale_retention_runs is left ENABLED even
-- after the callable procedure is gone — the audit table it protects still
-- exists and its existing rows still deserve the same "never editable"
-- guarantee they had while the procedure was active. Dropping the trigger
-- here would silently weaken that guarantee for no benefit (nothing calls
-- wholesale_run_data_retention anymore to trigger a write in the first
-- place, so there is no operational reason to remove the guard). If you
-- genuinely want the trigger gone too, it is included in the fully
-- destructive Section 2 below, alongside the table it protects — the two
-- are removed together, deliberately, never separately.

commit;

-- ============================================================================
-- SECTION 2 — FULLY DESTRUCTIVE. Not executed by this file as written.
-- Uncomment the block below and run it ONLY as a separate, deliberate
-- action, and only after reading the warning at the top of this file.
-- ============================================================================

-- begin;
--
-- drop trigger if exists trg_wholesale_retention_runs_append_only on wholesale_retention_runs;
-- drop function if exists public.wholesale_retention_runs_append_only_guard();
-- drop table if exists wholesale_retention_runs;
--
-- commit;
