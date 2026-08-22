-- ============================================================================
-- Rollback for wholesale-legal-document-types-migration.sql — REFERENCE ONLY
-- ============================================================================
-- This file is NOT run automatically by anything — no script, no test, no CI
-- step references it. It exists so that IF this migration is ever run for
-- real and needs to be undone, the exact, reviewed steps already exist
-- instead of being improvised under pressure.
--
-- Non-destructive by default, UNLIKE section 3 below which is explicitly
-- marked destructive. This migration added: one column (document_type) with
-- one CHECK, one composite unique constraint (replacing a simpler one), two
-- content-shape CHECKs (replacing two simpler ones), one partial unique
-- index (replacing a simpler one), a widened immutability guard function
-- body (same function NAME, trigger untouched), one new table
-- (wholesale_estimate_disclaimer_acceptances), and two new RPCs. It never
-- touched wholesale_legal_documents' pre-existing rows, the existing
-- wholesale_legal_acceptances table, wholesale_publish_legal_document (v1),
-- or wholesale_accept_legal_terms (existing) — none of those are touched by
-- this rollback either.
--
-- ****************************************************************************
-- WARNING — destructive if run after real estimate_disclaimer acceptances
-- exist. wholesale_estimate_disclaimer_acceptances (section 3 below) is the
-- ONLY record that a specific shop's device/session accepted a specific
-- version of the estimate disclaimer. Dropping that table destroys that
-- evidence permanently. Do not run section 3 against a database that has
-- ever recorded a real acceptance unless you have already exported/archived
-- that table through some other means and genuinely intend to give up that
-- record.
--
-- WARNING — restoring the pre-migration schema (sections 4-6) is only safe
-- if ZERO wholesale_legal_documents rows with document_type='estimate_
-- disclaimer' exist. Restoring the old unconditional 6-key content CHECK
-- would otherwise reject any existing estimate_disclaimer row outright
-- (its content_en/content_es only ever have a 'body' key), and restoring
-- the global `unique(version)` constraint could fail if any estimate_
-- disclaimer version string happens to collide with a master_agreement
-- one. Delete or migrate away every estimate_disclaimer row first, or stop
-- after section 3 (which alone fully disables the feature in application
-- code, since the RPCs that write those rows are gone) and leave sections
-- 4-6 un-run if you'd rather keep the schema as-is.
-- ****************************************************************************
--
-- Order of operations below: RPCs first, then the new table, then schema
-- objects roughly in reverse order of how the migration created them.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. RPCs — safe, non-destructive (no data of their own).
--    wholesale_publish_legal_document (v1) and wholesale_accept_legal_terms
--    (existing) are NOT touched — this migration never modified either.
-- ----------------------------------------------------------------------------
drop function if exists public.wholesale_accept_estimate_disclaimer(
  uuid, uuid, uuid, uuid, boolean, text, text, text
);
drop function if exists public.wholesale_publish_legal_document_v2(
  uuid, text, text, jsonb, jsonb
);

-- ----------------------------------------------------------------------------
-- 2. Immutability guard — restored to its pre-this-migration form (the
--    immutability-patch's widened entry condition, status OR published_at,
--    STAYS — that patch predates this migration and is untouched by this
--    rollback), just without document_type in the protected-column list.
--    Same function NAME the existing trigger already points at — no trigger
--    change needed.
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

-- ----------------------------------------------------------------------------
-- 3. wholesale_estimate_disclaimer_acceptances table — DESTRUCTIVE. See the
--    warning at the top of this file. Comment this line out (and stop here)
--    to disable the feature in code while keeping every acceptance record
--    that already exists.
-- ----------------------------------------------------------------------------
drop table if exists wholesale_estimate_disclaimer_acceptances;

-- ----------------------------------------------------------------------------
-- 4. One-published-per-type index -> restore the original table-wide index.
--    See the WARNING above — only safe with zero estimate_disclaimer rows
--    left published.
-- ----------------------------------------------------------------------------
drop index if exists idx_wholesale_legal_documents_one_published_per_type;
create unique index if not exists idx_wholesale_legal_documents_one_published
  on wholesale_legal_documents ((true)) where status = 'published';

-- ----------------------------------------------------------------------------
-- 5. Content-shape CHECKs -> restore the original unconditional 6-key
--    requirement. See the WARNING above — only safe with zero estimate_
--    disclaimer rows remaining (they would violate this immediately).
-- ----------------------------------------------------------------------------
alter table wholesale_legal_documents drop constraint if exists wholesale_legal_documents_content_shape_en;
alter table wholesale_legal_documents drop constraint if exists wholesale_legal_documents_content_shape_es;
alter table wholesale_legal_documents add constraint wholesale_legal_documents_content_keys_en check (
  content_en ?& array['access_agreement','pricing_policy','pricing_disclaimer',
                       'privacy_security','repair_warranty_terms','econsent_disclosure']
);
alter table wholesale_legal_documents add constraint wholesale_legal_documents_content_keys_es check (
  content_es ?& array['access_agreement','pricing_policy','pricing_disclaimer',
                       'privacy_security','repair_warranty_terms','econsent_disclosure']
);

-- ----------------------------------------------------------------------------
-- 6. version uniqueness -> restore the original global `unique(version)`.
--    See the WARNING above — only safe if no cross-type version-string
--    collision exists.
-- ----------------------------------------------------------------------------
alter table wholesale_legal_documents drop constraint if exists wholesale_legal_documents_version_document_type_key;
alter table wholesale_legal_documents add constraint wholesale_legal_documents_version_key unique (version);

-- ----------------------------------------------------------------------------
-- 7. document_type column and its CHECK — dropped last, after every object
--    that referenced it. Every remaining row (all 'master_agreement' by
--    this point, since step 3-6 already require zero estimate_disclaimer
--    rows to have proceeded safely) simply loses the column.
-- ----------------------------------------------------------------------------
alter table wholesale_legal_documents drop constraint if exists wholesale_legal_documents_document_type_check;
alter table wholesale_legal_documents drop column if exists document_type;

commit;
