-- ============================================================================
-- Verify — run AFTER wholesale-legal-pgcrypto-schema-fix-migration.sql
-- ============================================================================
-- Same safety convention as every other verify in this project that has to
-- prove a real write succeeds: the ENTIRE file is wrapped in one explicit
-- transaction that ends in ROLLBACK, never COMMIT. Safe to run any time, as
-- many times as you want, forever, even against a database with real
-- published master_agreement/estimate_disclaimer documents — this file
-- calls both RPCs for real (superseding whatever is currently published,
-- for the rest of THIS transaction only), and the final rollback restores
-- everything to exactly what it was.
--
-- Every synthetic row this file creates is tagged with the literal marker
-- '__wspcs_verify__' in a text field (version / role admin lookup), so it
-- is trivially identifiable if this file is ever interrupted before its own
-- final ROLLBACK. Admin profile: reused if an approved admin already
-- exists, synthesized (id, role, status only) otherwise — same discipline
-- already established in wholesale-retention-verify.sql.
-- ============================================================================

begin;

create temporary table _wspcs_verify_results (
  ord int,
  check_name text,
  status text,
  details text
);

-- ----------------------------------------------------------------------------
-- Structural checks (1-4): the installed function bodies now call
-- extensions.digest(...), never the bare unqualified digest(...), and every
-- other property (search_path, security mode, grants) is unchanged.
-- ----------------------------------------------------------------------------
do $$
declare
  v1_oid oid;
  v2_oid oid;
  v1_def text;
  v2_def text;
begin
  select p.oid into v1_oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'wholesale_publish_legal_document'
      and pg_get_function_identity_arguments(p.oid) = 'p_admin_id uuid, p_version text, p_content_en jsonb, p_content_es jsonb';
  select p.oid into v2_oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'wholesale_publish_legal_document_v2'
      and pg_get_function_identity_arguments(p.oid) = 'p_admin_id uuid, p_document_type text, p_version text, p_content_en jsonb, p_content_es jsonb';

  v1_def := (select pg_get_functiondef(v1_oid));
  v2_def := (select pg_get_functiondef(v2_oid));

  insert into _wspcs_verify_results values (
    1, 'v1_calls_extensions_digest',
    case when v1_def like '%encode(extensions.digest(%' and v1_def not like '%encode(digest(%' then 'PASS' else 'FAIL' end,
    'wholesale_publish_legal_document body contains encode(extensions.digest(...)) and no bare encode(digest(...))'
  );
  insert into _wspcs_verify_results values (
    2, 'v2_calls_extensions_digest',
    case when v2_def like '%encode(extensions.digest(%' and v2_def not like '%encode(digest(%' then 'PASS' else 'FAIL' end,
    'wholesale_publish_legal_document_v2 body contains encode(extensions.digest(...)) and no bare encode(digest(...))'
  );
  insert into _wspcs_verify_results values (
    3, 'search_path_still_pinned_public_pg_temp',
    case when (
      select exists (select 1 from unnest(coalesce(p.proconfig, array[]::text[])) cfg where cfg = 'search_path=public, pg_temp')
      from pg_proc p where p.oid = v1_oid
    ) and (
      select exists (select 1 from unnest(coalesce(p.proconfig, array[]::text[])) cfg where cfg = 'search_path=public, pg_temp')
      from pg_proc p where p.oid = v2_oid
    ) then 'PASS' else 'FAIL' end,
    'this patch never widened search_path to include extensions — both functions still pin exactly ''public, pg_temp'''
  );
  insert into _wspcs_verify_results values (
    4, 'grants_unchanged_service_role_only',
    case when
      has_function_privilege('service_role', v1_oid, 'EXECUTE') and not has_function_privilege('anon', v1_oid, 'EXECUTE')
        and not has_function_privilege('authenticated', v1_oid, 'EXECUTE') and not has_function_privilege('public', v1_oid, 'EXECUTE')
      and has_function_privilege('service_role', v2_oid, 'EXECUTE') and not has_function_privilege('anon', v2_oid, 'EXECUTE')
        and not has_function_privilege('authenticated', v2_oid, 'EXECUTE') and not has_function_privilege('public', v2_oid, 'EXECUTE')
    then 'PASS' else 'FAIL' end,
    'CREATE OR REPLACE FUNCTION preserves existing privileges when the signature is unchanged — confirms this '
      || 'patch did not need to (and did not) re-issue REVOKE/GRANT: service_role can still EXECUTE both, '
      || 'anon/authenticated/PUBLIC still cannot'
  );
end $$;

-- ----------------------------------------------------------------------------
-- Setup for functional checks: one approved-admin profile (synthetic, or
-- reused if one already exists) — same discipline as
-- wholesale-retention-verify.sql.
-- ----------------------------------------------------------------------------
do $$
declare
  v_admin_id uuid;
begin
  select id into v_admin_id from profiles where role = 'admin' and status = 'approved' limit 1;
  if v_admin_id is null then
    insert into profiles (id, role, status) values (gen_random_uuid(), 'admin', 'approved')
      returning id into v_admin_id;
  end if;
  create temporary table _wspcs_verify_admin as select v_admin_id as admin_id;
end $$;

-- ----------------------------------------------------------------------------
-- Functional check (5): wholesale_publish_legal_document (v1) — the exact
-- reported failure mode, reproduced for v1's own call site. A successful
-- return proves digest() resolved; the returned content_hash is checked to
-- actually look like a real sha256 hex digest, not just a non-null value.
-- ----------------------------------------------------------------------------
do $$
declare
  v_content jsonb := '{"access_agreement":"__wspcs_verify__","pricing_policy":"x","pricing_disclaimer":"x","privacy_security":"x","repair_warranty_terms":"x","econsent_disclosure":"x"}'::jsonb;
  v_admin_id uuid := (select admin_id from _wspcs_verify_admin);
  v_id uuid;
  v_hash text;
  v_ok boolean := false;
  v_error text := null;
begin
  begin
    v_id := wholesale_publish_legal_document(v_admin_id, '__wspcs_verify__ v1-probe', v_content, v_content);
    select content_hash into v_hash from wholesale_legal_documents where id = v_id;
    v_ok := (v_id is not null) and (v_hash ~ '^[0-9a-f]{64}$');
  exception
    when others then
      v_error := sqlerrm;
  end;

  insert into _wspcs_verify_results values (
    5, 'v1_publish_succeeds_and_computes_a_real_sha256_hash',
    case when v_ok then 'PASS' else 'FAIL' end,
    case when v_error is not null
      then 'wholesale_publish_legal_document raised: ' || v_error || ' — expected a successful publish (this is '
        || 'the exact reported error class if the patch did not take)'
      else 'published, content_hash=' || coalesce(v_hash, '(null)') || ' — expect a 64-hex-char sha256 digest'
    end
  );
end $$;

-- ----------------------------------------------------------------------------
-- Functional check (6): wholesale_publish_legal_document_v2 — the EXACT
-- reported flow from the bug report (estimate_disclaimer, single 'body' key
-- per language, version "1"-style short string).
-- ----------------------------------------------------------------------------
do $$
declare
  v_content jsonb := '{"body":"__wspcs_verify__ estimate disclaimer text"}'::jsonb;
  v_admin_id uuid := (select admin_id from _wspcs_verify_admin);
  v_id uuid;
  v_hash text;
  v_doctype text;
  v_ok boolean := false;
  v_error text := null;
begin
  begin
    v_id := wholesale_publish_legal_document_v2(v_admin_id, 'estimate_disclaimer', '__wspcs_verify__ v2-probe', v_content, v_content);
    select content_hash, document_type into v_hash, v_doctype from wholesale_legal_documents where id = v_id;
    v_ok := (v_id is not null) and (v_hash ~ '^[0-9a-f]{64}$') and (v_doctype = 'estimate_disclaimer');
  exception
    when others then
      v_error := sqlerrm;
  end;

  insert into _wspcs_verify_results values (
    6, 'v2_estimate_disclaimer_publish_succeeds_reproducing_the_exact_reported_flow',
    case when v_ok then 'PASS' else 'FAIL' end,
    case when v_error is not null
      then 'wholesale_publish_legal_document_v2 raised: ' || v_error || ' — this is the exact bug report '
        || '(function digest(text, unknown) does not exist) if the patch did not take'
      else 'published, document_type=' || coalesce(v_doctype, '(null)') || ', content_hash=' || coalesce(v_hash, '(null)')
        || ' — expect estimate_disclaimer and a 64-hex-char sha256 digest'
    end
  );
end $$;

-- ----------------------------------------------------------------------------
-- Functional check (7): v2 with document_type='master_agreement' also
-- resolves digest() correctly — the fix is not accidentally scoped to only
-- one of the two document types v2 can publish.
-- ----------------------------------------------------------------------------
do $$
declare
  v_content jsonb := '{"access_agreement":"__wspcs_verify__","pricing_policy":"x","pricing_disclaimer":"x","privacy_security":"x","repair_warranty_terms":"x","econsent_disclosure":"x"}'::jsonb;
  v_admin_id uuid := (select admin_id from _wspcs_verify_admin);
  v_id uuid;
  v_hash text;
  v_ok boolean := false;
  v_error text := null;
begin
  begin
    v_id := wholesale_publish_legal_document_v2(v_admin_id, 'master_agreement', '__wspcs_verify__ v2-master-probe', v_content, v_content);
    select content_hash into v_hash from wholesale_legal_documents where id = v_id;
    v_ok := (v_id is not null) and (v_hash ~ '^[0-9a-f]{64}$');
  exception
    when others then
      v_error := sqlerrm;
  end;

  insert into _wspcs_verify_results values (
    7, 'v2_master_agreement_publish_also_succeeds',
    case when v_ok then 'PASS' else 'FAIL' end,
    case when v_error is not null then 'wholesale_publish_legal_document_v2 (master_agreement) raised: ' || v_error
      else 'published, content_hash=' || coalesce(v_hash, '(null)') end
  );
end $$;

-- ----------------------------------------------------------------------------
-- Functional check (8): validation branches that never reach the digest()
-- line are unaffected — invalid_admin still raises, and never leaves a row
-- behind. Regression guard against the patch accidentally changing
-- validation order or behavior.
-- ----------------------------------------------------------------------------
do $$
declare
  v_content jsonb := '{"body":"x"}'::jsonb;
  v_rejected boolean := false;
  v_count_before int;
  v_count_after int;
begin
  select count(*) into v_count_before from wholesale_legal_documents;
  begin
    perform wholesale_publish_legal_document_v2(gen_random_uuid(), 'estimate_disclaimer', '__wspcs_verify__ should-not-publish', v_content, v_content);
  exception
    when others then
      v_rejected := (sqlerrm = 'invalid_admin');
  end;
  select count(*) into v_count_after from wholesale_legal_documents;

  insert into _wspcs_verify_results values (
    8, 'invalid_admin_still_rejected_before_reaching_digest',
    case when v_rejected and v_count_after = v_count_before then 'PASS' else 'FAIL' end,
    'called with a random, non-admin uuid — expected invalid_admin, raised before ever reaching the digest() line; '
      || 'rejected_with_expected_message=' || v_rejected || ', row count unchanged=' || (v_count_after = v_count_before)
  );
end $$;

-- ----------------------------------------------------------------------------
-- Final check (9): every table this file touched is completely unaffected
-- once this whole transaction rolls back — confirmed here structurally (the
-- file ends in ROLLBACK below, never COMMIT) rather than by a row-count
-- snapshot, since check 5-7 deliberately DO change wholesale_legal_documents
-- (supersede + insert) for the rest of this transaction, by design, and
-- undoing that is exactly what ROLLBACK below is for.
-- ----------------------------------------------------------------------------
insert into _wspcs_verify_results
select 9, 'entire_file_ends_in_rollback_never_commit',
  'PASS',
  'structural guarantee, not a runtime check — see the final statement of this file';

-- ----------------------------------------------------------------------------
-- Final result set.
-- ----------------------------------------------------------------------------
select check_name, status, details
from (
  select ord, check_name, status, details from _wspcs_verify_results
  union all
  select
    99,
    'OVERALL STATUS',
    case
      when bool_or(status = 'FAIL') then 'FAIL'
      when bool_or(status = 'REVIEW REQUIRED') then 'REVIEW REQUIRED'
      else 'PASS'
    end,
    'PASS = the pgcrypto schema-qualification patch is installed and both RPCs publish successfully. FAIL = '
      || 'investigate before trusting this fix — check 5/6/7''s details carry the exact raised error, if any.'
  from _wspcs_verify_results
) t
order by ord;

-- Nothing above is ever committed — every synthetic row (including the
-- supersede of any real currently-published document) this file created or
-- touched is undone here. Re-run this file safely as many times as you
-- want, forever.
rollback;
