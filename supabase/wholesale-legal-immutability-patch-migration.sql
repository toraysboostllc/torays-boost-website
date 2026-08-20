-- ============================================================================
-- Immutability defense-in-depth patch — run AFTER
-- wholesale-legal-immutability-patch-preflight.sql reports OVERALL STATUS
-- PASS, and AFTER wholesale-legal-migration.sql (already executed in
-- production; this patch does not touch it or re-run any of its steps).
-- ============================================================================
-- Root cause this patch closes: wholesale_legal_documents_immutability_guard
-- (defined in wholesale-legal-migration.sql) protects a row's content only
-- when `old.published_at is not null` — a single signal. A row can reach
-- status='published' or 'superseded' with published_at left NULL through any
-- path that doesn't go through the real wholesale_publish_legal_document RPC
-- (a hand-run INSERT, a future code path, a test fixture) — and such a row
-- was silently NOT protected, even though its status says it is a real
-- published (or formerly published) legal document. This is a genuine
-- defense-in-depth gap, not just a test-data mistake: the guard should never
-- have trusted published_at alone to mean "this document went live."
--
-- Fix, two independent layers:
--
--   1. A CHECK constraint makes the anomalous state impossible to create
--      going forward: any row with status in ('published','superseded') MUST
--      have published_at set. This is enforced by Postgres itself against
--      every INSERT/UPDATE, not just the RPC's own discipline.
--
--   2. The guard trigger is widened to fire on EITHER signal —
--      `status in ('published','superseded') OR published_at is not null` —
--      instead of published_at alone. This is deliberate belt-and-suspenders:
--      even if constraint #1 were ever bypassed (a superuser migration, a
--      bug, a future NOT VALID constraint on a differently-configured
--      database), the guard still protects a row whose STATUS says it is
--      published/superseded, independent of whether published_at happens to
--      be set. Two independent signals, not one signal checked twice.
--
-- What this patch deliberately does NOT change: the set of columns the guard
-- protects (content_en, content_es, content_hash, version, published_at,
-- published_by) is unchanged. The legitimate status-only transition
-- wholesale_publish_legal_document performs (`update ... set
-- status = 'superseded' where status = 'published'`) is untouched by this
-- widening — that RPC never changes any of the 6 protected columns, so the
-- guard's protected-column check (which fires whenever the ENTRY condition
-- is true, old or new) never raises for it, exactly as before. See
-- wholesale-legal-immutability-patch-verify.sql check
-- "guard_still_allows_legitimate_published_to_superseded_transition" for the
-- functional proof.
--
-- Idempotent: the constraint step is DROP-then-ADD, and the function step is
-- CREATE OR REPLACE — safe to run this file more than once.
--
-- No new tables, columns, or RPCs. No change to wholesale-legal-migration.sql
-- (already executed in production) or wholesale-legal-rollback.sql (that
-- file's own DROP FUNCTION/DROP TABLE steps already remove whatever this
-- patch leaves in place, in the same order — no update needed there).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Consistency constraint — published_at is mandatory once a document has
--    ever been published (status 'published' or 'superseded'). Drafts are
--    unaffected (published_at stays nullable for status='draft').
-- ----------------------------------------------------------------------------
alter table wholesale_legal_documents
  drop constraint if exists wholesale_legal_documents_published_requires_published_at;
alter table wholesale_legal_documents
  add constraint wholesale_legal_documents_published_requires_published_at check (
    status not in ('published', 'superseded') or published_at is not null
  );

-- ----------------------------------------------------------------------------
-- 2. Immutability guard — widened entry condition, same protected columns,
--    same exception messages. Replaces the function defined in
--    wholesale-legal-migration.sql; the existing trigger
--    (trg_wholesale_legal_documents_immutability) already points at this
--    function by name, so no trigger changes are needed here.
-- ----------------------------------------------------------------------------
create or replace function public.wholesale_legal_documents_immutability_guard()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'DELETE' then
    if old.status in ('published', 'superseded') or old.published_at is not null then
      raise exception 'cannot_delete_published_legal_document';
    end if;
    return old;
  end if;
  if old.status in ('published', 'superseded') or old.published_at is not null then
    if new.content_en is distinct from old.content_en
       or new.content_es is distinct from old.content_es
       or new.content_hash is distinct from old.content_hash
       or new.version is distinct from old.version
       or new.published_at is distinct from old.published_at
       or new.published_by is distinct from old.published_by
    then
      raise exception 'cannot_modify_published_legal_document_content';
    end if;
  end if;
  return new;
end;
$$;

commit;
