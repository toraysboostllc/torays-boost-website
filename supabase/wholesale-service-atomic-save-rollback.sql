-- ============================================================================
-- Rollback for wholesale-service-atomic-save-migration.sql — REFERENCE ONLY
-- ============================================================================
-- This file is NOT run automatically by anything — no script, no test, no CI
-- step references it. It exists so that IF this migration is ever run for
-- real and needs to be undone, the exact, reviewed steps already exist
-- instead of being improvised under pressure.
--
-- This migration created exactly ONE object (a function) and changed no
-- schema — so its rollback is a single DROP, and it never touches any
-- wholesale_services/wholesale_price_history/wholesale_service_tags row,
-- nor either of the two pre-existing RPCs this migration never modified.
-- Any edit made through wholesale_update_service_full() before this rollback
-- runs is permanent in the data (the rows it wrote are ordinary rows) — this
-- only removes the ability to call that RPC again going forward.
-- ============================================================================

begin;

drop function if exists wholesale_update_service_full(
  uuid, uuid, text, text, boolean, text, numeric, numeric, numeric, text, numeric, numeric
);

commit;
