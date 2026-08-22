-- ============================================================================
-- Second, independent legal document type — "Estimate Disclaimer"
-- ============================================================================
-- Additive follow-up to wholesale-legal-migration.sql AND
-- wholesale-legal-immutability-patch-migration.sql (both already executed in
-- production; this file does not touch either of them or re-run any of their
-- steps). Run in the same Supabase project's SQL Editor, AFTER both of those
-- have already run at least once.
--
-- Context: the Torays Boost Pro Legal Bundle (6 documents, 5 checkboxes,
-- representative name/title — wholesale_legal_documents /
-- wholesale_legal_acceptances / wholesale_publish_legal_document /
-- wholesale_accept_legal_terms, all UNTOUCHED by this file) is a formal
-- master agreement. The owner separately requires a second, much lighter
-- disclaimer — ONE bilingual body of text about wholesale pricing being
-- estimates/references, not a guaranteed final quote, with a SINGLE checkbox
-- ("I have read and accept the Terms and Conditions.") and no
-- representative name/title. Both documents are required IN PARALLEL — a
-- shop must accept BOTH before seeing catalog/prices; neither replaces the
-- other. This file reuses wholesale_legal_documents' own table/versioning/
-- publish/immutability machinery for the new type (via a document_type
-- discriminator) rather than building a second, parallel schema — and adds
-- a genuinely separate acceptances table (not the existing 5-checkbox one
-- widened with nullable columns) so neither document's own guarantees are
-- weakened by the other's shape.
--
-- Naming note: the existing 6-key bundle already has a section literally
-- named "pricing_disclaimer" (Document 3). This file's new document_type is
-- named 'estimate_disclaimer' instead, specifically to avoid a real name
-- collision between "a section inside the master agreement" and "a
-- standalone document" — see this migration's own preflight for the same
-- note.
--
-- Scope of this file, exactly:
--   1. wholesale_legal_documents gains a document_type column
--      ('master_agreement' | 'estimate_disclaimer'), defaulting every
--      existing (and future v1-RPC-inserted) row to 'master_agreement' —
--      wholesale_publish_legal_document (v1) is not modified and needs no
--      awareness of this column at all.
--   2. version uniqueness is rescoped from GLOBAL to per-(document_type,
--      version) — otherwise the very first estimate_disclaimer version
--      would collide with any master_agreement version sharing the same
--      version string.
--   3. The content-shape CHECK constraints become conditional on
--      document_type: master_agreement keeps the exact existing 6-key
--      requirement (zero behavior change); estimate_disclaimer requires
--      exactly one 'body' key per language (content_en/content_es stay
--      jsonb; no column-type change).
--   4. The "at most one published row" partial unique index is rescoped
--      from table-wide to per-document_type — a published master_agreement
--      and a published estimate_disclaimer now legitimately coexist.
--   5. The immutability guard (wholesale_legal_documents_immutability_guard,
--      same function name the existing trigger already points at — no
--      trigger change needed) is widened to also protect document_type
--      itself, so it can never be silently flipped on an already-published/
--      superseded row after the fact — otherwise a published row's type
--      could retroactively violate the new per-type unique index's
--      guarantee. The widened entry condition from
--      wholesale-legal-immutability-patch-migration.sql (status OR
--      published_at) is preserved as-is, never narrowed back.
--   6. A NEW, separate table — wholesale_estimate_disclaimer_acceptances —
--      append-only, single accepts_terms boolean (CHECK true), no
--      representative name/title, own content_hash snapshot. NOT the
--      existing wholesale_legal_acceptances table widened with nullable
--      columns.
--   7. TWO new RPCs, following the same "never CREATE OR REPLACE an
--      existing function with a different argument list — always a new,
--      distinctly-named function" rule already established in this
--      codebase for wholesale_update_service_full_v2 /
--      wholesale_update_portal_settings_v2:
--        - wholesale_publish_legal_document_v2(p_admin_id, p_document_type,
--          p_version, p_content_en, p_content_es) — supersede is scoped by
--          document_type, so publishing a new estimate_disclaimer version
--          never touches any master_agreement row, and vice versa.
--          wholesale_publish_legal_document (v1) is left completely
--          untouched; DESK's existing master-agreement publish flow keeps
--          calling v1 exactly as before.
--        - wholesale_accept_estimate_disclaimer(p_shop_id, p_device_id,
--          p_session_id, p_legal_document_id, p_accepts_terms, p_locale,
--          p_ip, p_user_agent) — single boolean re-validated in SQL (never
--          trusted from the caller alone), requires the document be the
--          CURRENTLY published estimate_disclaimer (rejects a stale/
--          superseded id, and rejects a master_agreement id outright).
--          wholesale_accept_legal_terms (existing) is left completely
--          untouched.
--
-- Idempotent throughout — IF NOT EXISTS / a guarded DROP ... IF EXISTS
-- before every ADD CONSTRAINT / CREATE OR REPLACE FUNCTION — wrapped in one
-- explicit transaction: if anything fails, Postgres rolls back everything,
-- never a half-applied schema.
--
-- No DELETE, no DROP TABLE, no DROP COLUMN anywhere in this file. Every
-- existing row in wholesale_legal_documents/wholesale_legal_acceptances
-- keeps every value it already has; every existing published master
-- agreement stays exactly as published.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. document_type — additive, backfilled by its own DEFAULT (no UPDATE
--    statement needed). Every existing row becomes 'master_agreement'
--    automatically.
-- ----------------------------------------------------------------------------
alter table wholesale_legal_documents
  add column if not exists document_type text not null default 'master_agreement';

alter table wholesale_legal_documents drop constraint if exists wholesale_legal_documents_document_type_check;
alter table wholesale_legal_documents add constraint wholesale_legal_documents_document_type_check
  check (document_type in ('master_agreement', 'estimate_disclaimer'));

-- ----------------------------------------------------------------------------
-- 2. version uniqueness — was a bare `unique` on the column (Postgres's
--    default name for that inline constraint is
--    wholesale_legal_documents_version_key, confirmed by this migration's
--    own preflight before this step runs). Rescoped to
--    (document_type, version): existing data is unaffected (today at most
--    one document_type value exists, so this is a strict widening, never a
--    narrowing that could reject pre-existing rows).
-- ----------------------------------------------------------------------------
alter table wholesale_legal_documents drop constraint if exists wholesale_legal_documents_version_key;
alter table wholesale_legal_documents drop constraint if exists wholesale_legal_documents_version_document_type_key;
alter table wholesale_legal_documents add constraint wholesale_legal_documents_version_document_type_key
  unique (document_type, version);

-- ----------------------------------------------------------------------------
-- 3. Content-shape CHECK — was unconditional (every row required all 6
--    keys). Now conditional on document_type: master_agreement keeps the
--    EXACT existing 6-key requirement (byte-identical condition to
--    wholesale-legal-migration.sql, just wrapped in an OR); estimate_
--    disclaimer requires exactly one 'body' key per language.
-- ----------------------------------------------------------------------------
alter table wholesale_legal_documents drop constraint if exists wholesale_legal_documents_content_keys_en;
alter table wholesale_legal_documents drop constraint if exists wholesale_legal_documents_content_keys_es;
alter table wholesale_legal_documents drop constraint if exists wholesale_legal_documents_content_shape_en;
alter table wholesale_legal_documents drop constraint if exists wholesale_legal_documents_content_shape_es;
alter table wholesale_legal_documents add constraint wholesale_legal_documents_content_shape_en check (
  (document_type = 'master_agreement' and content_en ?& array['access_agreement','pricing_policy','pricing_disclaimer',
                                                                'privacy_security','repair_warranty_terms','econsent_disclosure'])
  or (document_type = 'estimate_disclaimer' and content_en ? 'body')
);
alter table wholesale_legal_documents add constraint wholesale_legal_documents_content_shape_es check (
  (document_type = 'master_agreement' and content_es ?& array['access_agreement','pricing_policy','pricing_disclaimer',
                                                                'privacy_security','repair_warranty_terms','econsent_disclosure'])
  or (document_type = 'estimate_disclaimer' and content_es ? 'body')
);

-- ----------------------------------------------------------------------------
-- 4. One-published-per-type, not one-published-globally. Existing data
--    trivially satisfies the new, stricter-scoped rule (today's <=1
--    published row total is also <=1 per type, since only one type exists
--    yet).
-- ----------------------------------------------------------------------------
drop index if exists idx_wholesale_legal_documents_one_published;
create unique index if not exists idx_wholesale_legal_documents_one_published_per_type
  on wholesale_legal_documents (document_type) where status = 'published';

-- ----------------------------------------------------------------------------
-- 5. Immutability guard — widened to also protect document_type. Same
--    function NAME as wholesale-legal-migration.sql /
--    wholesale-legal-immutability-patch-migration.sql — the existing
--    trigger already points at it, so no trigger changes are needed here.
--    The widened entry condition from the immutability patch (status IN
--    ('published','superseded') OR published_at IS NOT NULL) is preserved
--    unchanged; only the protected-column list gains document_type.
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
       or new.document_type is distinct from old.document_type
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
-- 6. wholesale_estimate_disclaimer_acceptances — a NEW, separate,
--    append-only table. Not the existing wholesale_legal_acceptances table
--    widened with nullable representative_name/title columns — that would
--    weaken the existing table's own not-null/all-5-true guarantees for
--    master_agreement acceptances. Same posture (RLS enabled, zero
--    policies, service_role only) as every other wholesale_* table.
-- ----------------------------------------------------------------------------
create table if not exists wholesale_estimate_disclaimer_acceptances (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references wholesale_shops(id) on delete restrict,
  device_id uuid references wholesale_devices(id) on delete set null,
  session_id uuid references wholesale_sessions(id) on delete set null,
  legal_document_id uuid not null references wholesale_legal_documents(id) on delete restrict,
  accepts_terms boolean not null,
  content_hash text not null,
  locale text not null check (locale in ('en', 'es')),
  ip text,
  user_agent text,
  accepted_at timestamptz not null default now()
);

alter table wholesale_estimate_disclaimer_acceptances
  drop constraint if exists wholesale_estimate_disclaimer_acceptances_accepted_true;
alter table wholesale_estimate_disclaimer_acceptances
  add constraint wholesale_estimate_disclaimer_acceptances_accepted_true check (accepts_terms = true);

create index if not exists idx_wholesale_estimate_disclaimer_acceptances_shop
  on wholesale_estimate_disclaimer_acceptances(shop_id);
create index if not exists idx_wholesale_estimate_disclaimer_acceptances_shop_doc
  on wholesale_estimate_disclaimer_acceptances(shop_id, legal_document_id);
create index if not exists idx_wholesale_estimate_disclaimer_acceptances_accepted_at
  on wholesale_estimate_disclaimer_acceptances(accepted_at desc);

alter table wholesale_estimate_disclaimer_acceptances enable row level security;
-- No policies — same "RLS enabled, zero policies, service_role only"
-- posture every other wholesale_* table already has.

-- ----------------------------------------------------------------------------
-- 7. wholesale_publish_legal_document_v2 — a NEW, distinctly-named function.
--    wholesale_publish_legal_document (v1) is not referenced, read, or
--    replaced anywhere below — left byte-for-byte as it was. v2's body is
--    v1's body, plus a p_document_type parameter and a supersede step
--    scoped by that type.
-- ----------------------------------------------------------------------------
create or replace function public.wholesale_publish_legal_document_v2(
  p_admin_id uuid, p_document_type text, p_version text, p_content_en jsonb, p_content_es jsonb
) returns uuid
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare v_hash text; v_id uuid;
begin
  if not exists (select 1 from public.profiles where id = p_admin_id and role = 'admin' and status = 'approved') then
    raise exception 'invalid_admin';
  end if;
  if p_document_type not in ('master_agreement', 'estimate_disclaimer') then
    raise exception 'invalid_document_type';
  end if;
  if p_version is null or length(btrim(p_version)) = 0 then
    raise exception 'invalid_version';
  end if;
  v_hash := encode(digest(p_content_en::text || p_content_es::text, 'sha256'), 'hex');
  -- Scoped by document_type — the ONE behavioral difference from v1's
  -- global "supersede whatever is published" UPDATE. Publishing a new
  -- estimate_disclaimer version never flips any master_agreement row's
  -- status, and vice versa.
  update public.wholesale_legal_documents set status = 'superseded'
    where status = 'published' and document_type = p_document_type;
  insert into public.wholesale_legal_documents
    (document_type, version, status, content_en, content_es, content_hash, published_at, published_by)
  values (p_document_type, p_version, 'published', p_content_en, p_content_es, v_hash, now(), p_admin_id)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.wholesale_publish_legal_document_v2(
  uuid, text, text, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.wholesale_publish_legal_document_v2(
  uuid, text, text, jsonb, jsonb
) to service_role;

-- ----------------------------------------------------------------------------
-- 8. wholesale_accept_estimate_disclaimer — the lightweight clickwrap RPC.
--    Single boolean re-validated in SQL (never trusted from the caller
--    alone, same posture as wholesale_accept_legal_terms), no
--    representative name/title. Requires the document be the CURRENTLY
--    published estimate_disclaimer (rejects a stale/superseded id, and
--    rejects a master_agreement id outright via the document_type filter in
--    its own lookup), and that the shop is active.
-- ----------------------------------------------------------------------------
create or replace function public.wholesale_accept_estimate_disclaimer(
  p_shop_id uuid, p_device_id uuid, p_session_id uuid, p_legal_document_id uuid,
  p_accepts_terms boolean, p_locale text, p_ip text, p_user_agent text
) returns uuid
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare v_doc public.wholesale_legal_documents%rowtype; v_id uuid;
begin
  if not p_accepts_terms then
    raise exception 'checkbox_required';
  end if;
  if p_locale not in ('en', 'es') then
    raise exception 'invalid_locale';
  end if;
  select * into v_doc from public.wholesale_legal_documents
    where id = p_legal_document_id and status = 'published' and document_type = 'estimate_disclaimer';
  if not found then
    raise exception 'document_not_published';
  end if;
  if not exists (select 1 from public.wholesale_shops where id = p_shop_id and status = 'active') then
    raise exception 'shop_not_active';
  end if;
  insert into wholesale_estimate_disclaimer_acceptances
    (shop_id, device_id, session_id, legal_document_id, accepts_terms, content_hash, locale, ip, user_agent)
  values (p_shop_id, p_device_id, p_session_id, p_legal_document_id, true, v_doc.content_hash, p_locale, p_ip, p_user_agent)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.wholesale_accept_estimate_disclaimer(
  uuid, uuid, uuid, uuid, boolean, text, text, text
) from public, anon, authenticated;
grant execute on function public.wholesale_accept_estimate_disclaimer(
  uuid, uuid, uuid, uuid, boolean, text, text, text
) to service_role;

commit;

-- ============================================================================
-- Not part of the transaction above, on purpose — read this, do not run it
-- as part of this file:
--
--   Run supabase/wholesale-legal-document-types-preflight.sql BEFORE this
--   file, and supabase/wholesale-legal-document-types-verify.sql AFTER.
--
--   supabase/wholesale-legal-document-types-rollback.sql documents how to
--   undo every object this file creates, for reference only — it is never
--   run automatically and is not part of this migration. Its non-
--   destructive path only ever drops the new column/constraints/index/
--   table/RPCs this file adds — it never touches wholesale_legal_documents'
--   pre-existing rows, wholesale_legal_acceptances, or either of the
--   existing v1 RPCs, because this migration never touched them either.
-- ============================================================================
