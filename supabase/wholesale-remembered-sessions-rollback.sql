-- ============================================================================
-- Rollback for wholesale-remembered-sessions-migration.sql — REFERENCE ONLY,
-- non-destructive to anything that existed before this migration
-- ============================================================================
-- This file is NOT run automatically by anything — no script, no test, no CI
-- step references it. It exists so that IF this migration is ever run for
-- real and needs to be undone, the exact, reviewed steps already exist
-- instead of being improvised under pressure.
--
-- Non-destructive: this migration only ADDED 1 column to an ALREADY-EXISTING
-- table. Rolling it back removes exactly that column and nothing else —
--   - wholesale_sessions itself is NOT dropped.
--   - Every pre-existing column (id, shop_id, device_id, session_token_hash,
--     created_at, expires_at, revoked_at) and its current value on every row
--     is untouched.
--   - No wholesale_shops/wholesale_devices/wholesale_access_log row is
--     touched — this was never a change to any other table.
--
-- The only real effect of running this file: api/_lib/wholesaleDb.js's
-- mintSession()/createSession() would start failing to write the
-- `remembered` field it always passes (PostgREST would simply ignore an
-- unknown key on insert with a plain object body the way this codebase calls
-- it — confirm the actual client behavior before relying on that if you ever
-- run this) — meaning "Keep me signed in on this device" would need its own
-- code rollback alongside this SQL rollback, not just this file alone. Run
-- manually, one statement at a time, only with the owner's explicit
-- go-ahead for THIS specific rollback, and only together with reverting the
-- application code that reads/writes this column.
-- ============================================================================

begin;

alter table wholesale_sessions drop column if exists remembered;

commit;
