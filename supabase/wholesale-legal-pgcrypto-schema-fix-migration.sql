-- ============================================================================
-- pgcrypto schema-qualification patch — run AFTER
-- wholesale-legal-pgcrypto-schema-fix-preflight.sql reports OVERALL STATUS
-- PASS, and AFTER wholesale-legal-migration.sql AND wholesale-legal-
-- document-types-migration.sql (both already executed in production; this
-- patch does not touch either of them or re-run any of their steps).
-- ============================================================================
-- Root cause this patch closes (see this quartet's own preflight for the
-- full evidence trail — real Vercel runtime logs, 2026-08-22): publishing
-- an Estimate Disclaimer version failed with Postgres error 42883,
-- "function digest(text, unknown) does not exist". This Supabase project
-- has pgcrypto installed in the `extensions` schema (Supabase's own
-- default), never `public`. Both affected functions are declared
-- `security invoker set search_path = public, pg_temp` — that SET clause
-- overrides the search_path for the function body only, and never included
-- `extensions`, so the unqualified digest() call could never resolve.
--
-- Fix, deliberately the narrowest possible: schema-qualify ONLY the one
-- call site, `digest(...)` -> `extensions.digest(...)`, in both affected
-- functions. Nothing else changes:
--   - Signatures/parameter lists: byte-identical to the currently installed
--     versions (CREATE OR REPLACE FUNCTION with the exact same argument
--     list replaces the existing function in place — it does not create a
--     new overload, and Postgres preserves all existing GRANT/REVOKE
--     privileges on it automatically, so this file does not re-issue any
--     REVOKE/GRANT statements).
--   - `security invoker` and `set search_path = public, pg_temp`: kept
--     exactly as-is. The fix is schema-qualifying the call, NOT widening
--     the search_path to include `extensions` — a narrower, more explicit
--     fix that can never accidentally shadow a `public`-schema function
--     with a same-named `extensions`-schema one in the future.
--   - Every validation branch (invalid_admin / invalid_document_type /
--     invalid_version), the supersede UPDATE, the INSERT column list and
--     values, and the RETURNING id: byte-identical to the currently
--     installed bodies.
--   - v1's behavior (global supersede) and v2's behavior (supersede scoped
--     by document_type): unchanged — this patch does not touch that logic
--     at all, only the digest() call inside each.
--
-- What this patch does NOT do: it does not touch wholesale_legal_documents,
-- wholesale_legal_acceptances, wholesale_estimate_disclaimer_acceptances,
-- or any row in any of them (no INSERT/UPDATE/DELETE anywhere in this
-- file); it does not touch profiles; it does not re-declare
-- wholesale_accept_legal_terms or wholesale_accept_estimate_disclaimer
-- (neither of those calls digest() and neither is affected by this bug).
--
-- Idempotent: both steps are CREATE OR REPLACE FUNCTION with the function's
-- existing exact signature — safe to run this file more than once.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. wholesale_publish_legal_document (v1) — defined in
--    wholesale-legal-migration.sql. Only the digest() call site changes.
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
  v_hash := encode(extensions.digest(p_content_en::text || p_content_es::text, 'sha256'), 'hex');
  update public.wholesale_legal_documents set status = 'superseded' where status = 'published';
  insert into public.wholesale_legal_documents
    (version, status, content_en, content_es, content_hash, published_at, published_by)
  values (p_version, 'published', p_content_en, p_content_es, v_hash, now(), p_admin_id)
  returning id into v_id;
  return v_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. wholesale_publish_legal_document_v2 — defined in wholesale-legal-
--    document-types-migration.sql. Only the digest() call site changes.
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
  v_hash := encode(extensions.digest(p_content_en::text || p_content_es::text, 'sha256'), 'hex');
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
