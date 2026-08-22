-- ============================================================================
-- Rollback for wholesale-legal-pgcrypto-schema-fix-migration.sql — REFERENCE
-- ONLY
-- ============================================================================
-- This file is NOT run automatically by anything — no script, no test, no CI
-- step references it. It exists so that IF this patch ever needs to be
-- undone, the exact, reviewed steps already exist instead of being
-- improvised under pressure.
--
-- NON-DESTRUCTIVE. This patch only replaced the body of two already-existing
-- functions (schema-qualifying one call site) — no new tables, columns, or
-- rows exist anywhere because of it. Running this file restores
-- wholesale_publish_legal_document and wholesale_publish_legal_document_v2
-- to their EXACT pre-patch bodies (the ones defined in wholesale-legal-
-- migration.sql and wholesale-legal-document-types-migration.sql,
-- respectively) — same signatures, same security invoker/search_path, same
-- validations, same insert/update logic, only the digest() call reverts to
-- its bare, unqualified form. No data of any kind is deleted, and no
-- existing legal document's content is touched. Safe to run against a
-- database that has real published documents.
--
-- After running this file, the known bug this patch fixed reopens: on a
-- Supabase project where pgcrypto lives in the `extensions` schema, both
-- RPCs will once again fail with "function digest(text, unknown) does not
-- exist" (error 42883) on every publish attempt. Only run this rollback if
-- you have a specific, reviewed reason to (e.g. this patch introduced an
-- unrelated regression and you need to buy time to fix it) — not as a
-- routine operation.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Restore wholesale_publish_legal_document (v1) to its exact pre-patch
--    body — the unqualified digest() call, exactly as
--    wholesale-legal-migration.sql defined it.
-- ----------------------------------------------------------------------------
create or replace function public.wholesale_publish_legal_document(
  p_admin_id uuid, p_version text, p_content_en jsonb, p_content_es jsonb
) returns uuid
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare v_hash text; v_id uuid;
begin
  if not exists (select 1 from public.profiles where id = p_admin_id and role = 'admin' and status = 'approved') then
    raise exception 'invalid_admin';
  end if;
  if p_version is null or length(btrim(p_version)) = 0 then
    raise exception 'invalid_version';
  end if;
  v_hash := encode(digest(p_content_en::text || p_content_es::text, 'sha256'), 'hex');
  update public.wholesale_legal_documents set status = 'superseded' where status = 'published';
  insert into public.wholesale_legal_documents
    (version, status, content_en, content_es, content_hash, published_at, published_by)
  values (p_version, 'published', p_content_en, p_content_es, v_hash, now(), p_admin_id)
  returning id into v_id;
  return v_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Restore wholesale_publish_legal_document_v2 to its exact pre-patch
--    body — the unqualified digest() call, exactly as
--    wholesale-legal-document-types-migration.sql defined it.
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

commit;
