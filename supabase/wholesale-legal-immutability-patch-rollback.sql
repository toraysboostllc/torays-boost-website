-- ============================================================================
-- Rollback for wholesale-legal-immutability-patch-migration.sql — REFERENCE
-- ONLY
-- ============================================================================
-- This file is NOT run automatically by anything — no script, no test, no CI
-- step references it. It exists so that IF this patch ever needs to be
-- undone, the exact, reviewed steps already exist instead of being
-- improvised under pressure.
--
-- NON-DESTRUCTIVE. Unlike wholesale-legal-rollback.sql (which can drop
-- wholesale_legal_acceptances and destroy real acceptance evidence), this
-- patch only added one CHECK constraint and replaced one trigger function's
-- body — no new tables, columns, or rows exist anywhere because of it.
-- Running this file: (a) drops the CHECK constraint added by the patch, and
-- (b) restores the immutability guard function to its exact pre-patch form
-- (the one defined in wholesale-legal-migration.sql, keyed on published_at
-- alone). No data of any kind is deleted, and no real document's content is
-- touched. Safe to run against a database that has real published documents.
--
-- After running this file, the known defense-in-depth gap this patch closed
-- is open again: a wholesale_legal_documents row could once more reach
-- status='published'/'superseded' with published_at NULL, and such a row
-- would not be protected by the immutability guard. Only run this rollback
-- if you have a specific, reviewed reason to (e.g. this patch introduced an
-- unrelated regression and you need to buy time to fix it) — not as a
-- routine operation.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Restore the immutability guard to its pre-patch form — keyed solely on
--    published_at, exactly as wholesale-legal-migration.sql defined it.
-- ----------------------------------------------------------------------------
create or replace function public.wholesale_legal_documents_immutability_guard()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'DELETE' then
    if old.published_at is not null then
      raise exception 'cannot_delete_published_legal_document';
    end if;
    return old;
  end if;
  if old.published_at is not null then
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

-- ----------------------------------------------------------------------------
-- 2. Drop the consistency constraint this patch added. No column, row, or
--    other object is affected — this constraint never stored data of its
--    own, only validated existing columns.
-- ----------------------------------------------------------------------------
alter table wholesale_legal_documents
  drop constraint if exists wholesale_legal_documents_published_requires_published_at;

commit;
