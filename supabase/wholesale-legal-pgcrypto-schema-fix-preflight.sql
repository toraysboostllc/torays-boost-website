-- ============================================================================
-- Preflight — run BEFORE wholesale-legal-pgcrypto-schema-fix-migration.sql
-- ============================================================================
-- Small, standalone patch on top of ALREADY-EXECUTED wholesale-legal-
-- migration.sql AND wholesale-legal-document-types-migration.sql. Does not
-- touch either of those files or re-run any of their steps — this one only
-- schema-qualifies a single function call inside two already-published RPCs.
--
-- Bug this closes (confirmed via real Vercel runtime logs, 2026-08-22):
-- publishing an Estimate Disclaimer version in a live Preview failed with
--   {"code":"42883","message":"function digest(text, unknown) does not
--   exist","hint":"No function matches the given name and argument types.
--   You might need to add explicit type casts."}
-- raised from inside wholesale_publish_legal_document_v2, at the line
--   v_hash := encode(digest(p_content_en::text || p_content_es::text, 'sha256'), 'hex');
-- Root cause: this Supabase project has pgcrypto (which provides digest())
-- installed in the `extensions` schema — Supabase's own default when an
-- extension is enabled via its dashboard, never `public`. Both
-- wholesale_publish_legal_document (v1) and wholesale_publish_legal_document_v2
-- are declared `security invoker set search_path = public, pg_temp` — that
-- SET clause overrides the calling session's search_path for the duration
-- of the function body, and it does not include `extensions`, so `digest`
-- cannot be resolved even though pgcrypto is genuinely installed. v1 has
-- the exact same latent defect (byte-identical digest() call, byte-identical
-- search_path) — it had simply never been exercised against a real Supabase
-- publish before v2 was.
--
-- ONE statement, ONE result table — same convention as every other preflight
-- in this project. Entirely read-only: no INSERT/UPDATE/DELETE/ALTER/CREATE/
-- DROP anywhere in this file.
--
-- Order of operations:
--   1. Run this file. Read the check_name/status/details rows and the final
--      OVERALL STATUS row.
--   2. Only if OVERALL STATUS is PASS, run
--      wholesale-legal-pgcrypto-schema-fix-migration.sql. FAIL means the
--      real cause on THIS project may differ from the diagnosed one —
--      investigate the flagged row before proceeding; do not assume this
--      patch is the right fix without a PASS here.
--   3. Run wholesale-legal-pgcrypto-schema-fix-verify.sql afterward to
--      confirm it landed and both RPCs actually publish successfully.
-- ============================================================================

with raw as (
  select
    exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'wholesale_legal_documents'
    ) as legal_documents_table_exists,
    (
      select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'wholesale_publish_legal_document'
        and pg_get_function_identity_arguments(p.oid) = 'p_admin_id uuid, p_version text, p_content_en jsonb, p_content_es jsonb'
    ) as v1_oid,
    (
      select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'wholesale_publish_legal_document_v2'
        and pg_get_function_identity_arguments(p.oid) = 'p_admin_id uuid, p_document_type text, p_version text, p_content_en jsonb, p_content_es jsonb'
    ) as v2_oid,
    exists (
      select 1 from pg_extension where extname = 'pgcrypto'
    ) as pgcrypto_installed_anywhere,
    -- Located via pg_depend -> pg_extension (the function actually OWNED by
    -- the pgcrypto extension), never a bare "any function named digest"
    -- name match — a same-named user function in an unrelated schema would
    -- otherwise give a false PASS here.
    (
      select string_agg(distinct n.nspname, ', ' order by n.nspname)
      from pg_depend d
      join pg_extension e on e.oid = d.refobjid
      join pg_proc p on p.oid = d.objid
      join pg_namespace n on n.oid = p.pronamespace
      where e.extname = 'pgcrypto' and p.proname = 'digest'
    ) as pgcrypto_digest_schemas,
    exists (
      select 1
      from pg_depend d
      join pg_extension e on e.oid = d.refobjid
      join pg_proc p on p.oid = d.objid
      join pg_namespace n on n.oid = p.pronamespace
      where e.extname = 'pgcrypto' and p.proname = 'digest' and n.nspname = 'extensions'
    ) as extensions_digest_exists
),
fndefs as (
  select
    (select pg_get_functiondef(v1_oid) from raw) as v1_def,
    (select pg_get_functiondef(v2_oid) from raw) as v2_def
),
checks as (
  select 1 as ord, 'prerequisite_objects_exist' as check_name,
    case when legal_documents_table_exists and v1_oid is not null and v2_oid is not null then 'PASS' else 'FAIL' end as status,
    'wholesale_legal_documents exists=' || legal_documents_table_exists
      || ', wholesale_publish_legal_document (v1, exact 4-arg signature) found=' || (v1_oid is not null)
      || ', wholesale_publish_legal_document_v2 (exact 5-arg signature) found=' || (v2_oid is not null)
      || ' — if any is false, run wholesale-legal-migration.sql and/or wholesale-legal-document-types-migration.sql first'
      as details
  from raw

  union all

  select 2, 'pgcrypto_extension_installed',
    case when pgcrypto_installed_anywhere then 'PASS' else 'FAIL' end,
    'pgcrypto extension present in pg_extension (any schema)=' || pgcrypto_installed_anywhere
      || ' — if false, this patch cannot help: digest() is not installed at all, run '
      || '"create extension if not exists pgcrypto with schema extensions;" yourself first and re-run this preflight'
  from raw

  union all

  select 3, 'pgcrypto_digest_schema_located',
    case when pgcrypto_digest_schemas is not null then 'PASS' else 'FAIL' end,
    'digest() function actually owned by the pgcrypto extension is installed in: '
      || coalesce(pgcrypto_digest_schemas, '(not found via pg_depend — see check 2)')
  from raw

  union all

  select 4, 'extensions_schema_digest_confirmed',
    case when extensions_digest_exists then 'PASS' else 'FAIL' end,
    'extensions.digest exists=' || extensions_digest_exists
      || ' — this is the specific fact this patch depends on (schema-qualifying the call as extensions.digest(...)). '
      || 'If false, digest() is NOT in the extensions schema on this project and this patch''s fix (extensions.digest) '
      || 'would not resolve the error either — re-diagnose using check 3''s reported schema list instead of proceeding'
  from raw

  union all

  select 5, 'v1_currently_unqualified_digest_call_as_expected',
    case
      when v1_def is null then 'FAIL'
      when v1_def like '%encode(extensions.digest(%' then 'REVIEW REQUIRED'
      when v1_def like '%encode(digest(%' then 'PASS'
      else 'FAIL'
    end,
    case
      when v1_def is null then 'wholesale_publish_legal_document not found — see check 1'
      when v1_def like '%encode(extensions.digest(%' then 'v1 already calls extensions.digest(...) — this patch may already be applied to v1; review before re-running'
      when v1_def like '%encode(digest(%' then 'v1''s installed body currently calls the unqualified encode(digest(...)) — matches the pre-patch state this migration expects to find'
      else 'v1''s installed body does not match either the expected pre-patch or post-patch digest() call shape — investigate manually before proceeding'
    end
  from fndefs

  union all

  select 6, 'v2_currently_unqualified_digest_call_as_expected',
    case
      when v2_def is null then 'FAIL'
      when v2_def like '%encode(extensions.digest(%' then 'REVIEW REQUIRED'
      when v2_def like '%encode(digest(%' then 'PASS'
      else 'FAIL'
    end,
    case
      when v2_def is null then 'wholesale_publish_legal_document_v2 not found — see check 1'
      when v2_def like '%encode(extensions.digest(%' then 'v2 already calls extensions.digest(...) — this patch may already be applied to v2; review before re-running'
      when v2_def like '%encode(digest(%' then 'v2''s installed body currently calls the unqualified encode(digest(...)) — matches the pre-patch state this migration expects to find, and reproduces the exact reported 42883 error'
      else 'v2''s installed body does not match either the expected pre-patch or post-patch digest() call shape — investigate manually before proceeding'
    end
  from fndefs

  union all

  select 7, 'v1_and_v2_search_path_pinned_as_expected',
    case when (
      select coalesce((
        select exists (select 1 from unnest(coalesce(p.proconfig, array[]::text[])) cfg where cfg = 'search_path=public, pg_temp')
        from pg_proc p where p.oid = raw.v1_oid
      ), false) from raw
    ) and (
      select coalesce((
        select exists (select 1 from unnest(coalesce(p.proconfig, array[]::text[])) cfg where cfg = 'search_path=public, pg_temp')
        from pg_proc p where p.oid = raw.v2_oid
      ), false) from raw
    ) then 'PASS' else 'FAIL' end,
    'both v1 and v2 currently have search_path pinned to exactly ''public, pg_temp'' — this patch preserves that '
      || 'pin unchanged (it schema-qualifies the ONE call site instead of widening the search_path); a FAIL here '
      || 'means the live definition no longer matches what this migration''s CREATE OR REPLACE assumes as the '
      || 'starting point'
  from raw
),
overall as (
  select
    case
      when bool_or(status = 'FAIL') then 'FAIL'
      when bool_or(status = 'REVIEW REQUIRED') then 'REVIEW REQUIRED'
      else 'PASS'
    end as status
  from checks
)
select check_name, status, details
from (
  select ord, check_name, status, details from checks
  union all
  select
    99,
    'OVERALL STATUS',
    overall.status,
    'PASS = safe to run wholesale-legal-pgcrypto-schema-fix-migration.sql. REVIEW REQUIRED = read the flagged '
      || 'row(s) yourself first (may just mean this patch already ran). FAIL = do NOT proceed — in particular, a '
      || 'FAIL on check 4 (extensions_schema_digest_confirmed) means this specific fix (extensions.digest) is not '
      || 'the right one for this database and needs re-diagnosis.'
  from overall
) t
order by ord;
