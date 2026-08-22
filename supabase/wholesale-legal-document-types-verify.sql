-- ============================================================================
-- Verify — run AFTER wholesale-legal-document-types-migration.sql
-- ============================================================================
-- Same safety convention as wholesale-legal-verify.sql: several checks below
-- can only be confirmed by actually attempting a write and observing whether
-- Postgres accepts or rejects it, so the ENTIRE file is wrapped in one
-- explicit transaction that ends in ROLLBACK, never COMMIT. Safe to run any
-- time, as many times as you want, forever, even against a database that
-- already has a real published master_agreement document (see checks 10-12
-- below for the same "reuse an existing published row rather than
-- unconditionally inserting a second one" discipline wholesale-legal-
-- verify.sql's check 10 already established, applied per document_type
-- here).
--
-- Scope note, matching wholesale-legal-verify.sql's own precedent exactly:
-- this file tests the SCHEMA (columns, constraints, the per-type unique
-- index, the widened immutability guard) via direct SQL manipulation, and
-- the two new RPCs' EXISTENCE/SIGNATURE/GRANTS structurally — it does NOT
-- call either RPC (wholesale_publish_legal_document_v2 /
-- wholesale_accept_estimate_disclaimer), because doing so would require
-- fabricating a synthetic admin profile / shop row in whatever database this
-- file is run against, which the original wholesale-legal-verify.sql
-- deliberately never does either. Full RPC BEHAVIOR (validation branches,
-- supersede-scoped-by-type, cross-type rejection) is proven once, for real,
-- against an isolated throwaway pglite instance — never against Supabase —
-- documented in this quartet's own migration file header.
--
-- Every synthetic row this file creates is tagged with the literal marker
-- '__wsldt_verify__' in a text field, same convention (distinct prefix so it
-- can never be confused with wholesale-legal-verify.sql's own
-- '__wsl_verify__' rows if both are ever run back to back).
--
-- NO explicit SAVEPOINT / ROLLBACK TO SAVEPOINT / COMMIT anywhere inside a DO
-- block (Postgres syntax error if attempted). Every "attempt X, undo it if it
-- unexpectedly succeeds" check below uses PL/pgSQL's own implicit
-- subtransaction mechanism — a nested `begin ... exception ... end` block —
-- with the same custom-SQLSTATE sentinel convention as every other verify
-- file in this project: 'ZZ001' marks "the operation unexpectedly succeeded"
-- (stays FAIL), 'ZZ002' marks "our own deliberate full-cleanup rollback, not
-- a real error."
-- ============================================================================

begin;

create temporary table _wsldt_verify_results (
  ord int,
  check_name text,
  status text,
  details text
) on commit drop;

-- ----------------------------------------------------------------------------
-- Structural checks (1-6): columns, constraints, index, RPC signatures/grants.
-- ----------------------------------------------------------------------------
insert into _wsldt_verify_results
select 1, 'document_type_column_and_check_constraint',
  case when
    exists (select 1 from information_schema.columns where table_schema='public' and table_name='wholesale_legal_documents' and column_name='document_type')
    and exists (
      select 1 from pg_constraint c join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace
      where n.nspname='public' and t.relname='wholesale_legal_documents' and c.conname='wholesale_legal_documents_document_type_check'
    )
  then 'PASS' else 'FAIL' end,
  'wholesale_legal_documents.document_type column and its CHECK (in master_agreement/estimate_disclaimer) both present';

insert into _wsldt_verify_results
select 2, 'version_composite_unique_constraint_present',
  case when exists (
    select 1 from pg_constraint c join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace
    where n.nspname='public' and t.relname='wholesale_legal_documents'
      and c.conname='wholesale_legal_documents_version_document_type_key' and c.contype='u'
  ) then 'PASS' else 'FAIL' end,
  'wholesale_legal_documents_version_document_type_key (unique on (document_type, version)) exists — check 11 below tests it actually behaves as scoped-per-type';

insert into _wsldt_verify_results
select 3, 'content_shape_check_constraints_present',
  case when
    (select count(*) from pg_constraint c join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace
       where n.nspname='public' and t.relname='wholesale_legal_documents' and c.conname='wholesale_legal_documents_content_shape_en') = 1
    and (select count(*) from pg_constraint c join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace
       where n.nspname='public' and t.relname='wholesale_legal_documents' and c.conname='wholesale_legal_documents_content_shape_es') = 1
    and not exists (
      select 1 from pg_constraint c join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace
      where n.nspname='public' and t.relname='wholesale_legal_documents' and c.conname='wholesale_legal_documents_content_keys_en'
    )
  then 'PASS' else 'FAIL' end,
  'wholesale_legal_documents_content_shape_en/_es exist (the conditional-by-document_type replacements), and the old unconditional wholesale_legal_documents_content_keys_en is gone (renamed away, not merely added alongside)';

insert into _wsldt_verify_results
select 4, 'one_published_per_type_index_present',
  case when
    exists (select 1 from pg_indexes where schemaname='public' and tablename='wholesale_legal_documents' and indexname='idx_wholesale_legal_documents_one_published_per_type')
    and not exists (select 1 from pg_indexes where schemaname='public' and tablename='wholesale_legal_documents' and indexname='idx_wholesale_legal_documents_one_published')
  then 'PASS' else 'FAIL' end,
  'idx_wholesale_legal_documents_one_published_per_type exists, and the old table-wide idx_wholesale_legal_documents_one_published is gone (replaced, not merely supplemented) — check 12 below tests the new index actually scopes by type';

insert into _wsldt_verify_results
select 5, 'new_table_and_columns_present',
  case when
    exists (select 1 from information_schema.tables where table_schema='public' and table_name='wholesale_estimate_disclaimer_acceptances')
    and exists (select 1 from information_schema.columns where table_schema='public' and table_name='wholesale_estimate_disclaimer_acceptances' and column_name='accepts_terms')
    and exists (select 1 from information_schema.columns where table_schema='public' and table_name='wholesale_estimate_disclaimer_acceptances' and column_name='content_hash')
    and exists (select 1 from information_schema.columns where table_schema='public' and table_name='wholesale_estimate_disclaimer_acceptances' and column_name='locale')
    and exists (
      select 1 from pg_constraint c join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace
      where n.nspname='public' and t.relname='wholesale_estimate_disclaimer_acceptances'
        and c.conname='wholesale_estimate_disclaimer_acceptances_accepted_true'
    )
  then 'PASS' else 'FAIL' end,
  'wholesale_estimate_disclaimer_acceptances exists with its key columns and the accepts_terms=true CHECK';

insert into _wsldt_verify_results
select 6, 'rpc_signatures_and_grants',
  case when
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname='public' and p.proname='wholesale_publish_legal_document_v2'
       and pg_get_function_identity_arguments(p.oid) = 'p_admin_id uuid, p_document_type text, p_version text, p_content_en jsonb, p_content_es jsonb') = 1
    and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname='public' and p.proname='wholesale_publish_legal_document_v2') = 1
    and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname='public' and p.proname='wholesale_publish_legal_document') = 1
    and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname='public' and p.proname='wholesale_accept_estimate_disclaimer'
       and pg_get_function_identity_arguments(p.oid) = 'p_shop_id uuid, p_device_id uuid, p_session_id uuid, p_legal_document_id uuid, p_accepts_terms boolean, p_locale text, p_ip text, p_user_agent text') = 1
    and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname='public' and p.proname='wholesale_accept_estimate_disclaimer') = 1
    and (
      select has_function_privilege('service_role', p.oid, 'EXECUTE') and not has_function_privilege('anon', p.oid, 'EXECUTE')
        and not has_function_privilege('authenticated', p.oid, 'EXECUTE') and not has_function_privilege('public', p.oid, 'EXECUTE')
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname='public' and p.proname='wholesale_accept_estimate_disclaimer'
        and pg_get_function_identity_arguments(p.oid) = 'p_shop_id uuid, p_device_id uuid, p_session_id uuid, p_legal_document_id uuid, p_accepts_terms boolean, p_locale text, p_ip text, p_user_agent text'
    ) is true
    and (
      select has_function_privilege('service_role', p.oid, 'EXECUTE') and not has_function_privilege('anon', p.oid, 'EXECUTE')
        and not has_function_privilege('authenticated', p.oid, 'EXECUTE') and not has_function_privilege('public', p.oid, 'EXECUTE')
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname='public' and p.proname='wholesale_publish_legal_document_v2'
        and pg_get_function_identity_arguments(p.oid) = 'p_admin_id uuid, p_document_type text, p_version text, p_content_en jsonb, p_content_es jsonb'
    ) is true
  then 'PASS' else 'FAIL' end,
  'both new RPCs exist exactly once each with the exact expected argument list, service_role-only execute, AND wholesale_publish_legal_document (v1) still exists untouched alongside v2 (never replaced)';

-- ----------------------------------------------------------------------------
-- Functional check (7): document_type CHECK actually rejects an invalid value.
-- ----------------------------------------------------------------------------
do $$
declare
  v_rejected boolean := false;
begin
  begin
    insert into wholesale_legal_documents (document_type, version, status, content_en, content_es, content_hash)
      values ('not_a_real_type', '__wsldt_verify__ bad-type', 'draft', '{"body":"x"}'::jsonb, '{"body":"x"}'::jsonb, '__wsldt_verify__ hash');
    raise exception '__wsldt_verify_unexpected_success__' using errcode = 'ZZ001';
  exception
    when sqlstate 'ZZ001' then null;
    when others then v_rejected := true;
  end;
  insert into _wsldt_verify_results values (
    7, 'document_type_check_rejects_invalid_value',
    case when v_rejected then 'PASS' else 'FAIL' end,
    'attempted INSERT with document_type=''not_a_real_type'' — expected a check_violation; rejected=' || v_rejected
  );
end $$;

-- ----------------------------------------------------------------------------
-- Functional check (8): content-shape CHECK is genuinely conditional, not
-- "either shape is fine for any type" — an estimate_disclaimer row with the
-- OLD 6-key shape (no 'body') must be rejected, and a master_agreement row
-- with only 'body' (no 6 keys) must also be rejected.
-- ----------------------------------------------------------------------------
do $$
declare
  v_six_key jsonb := '{"access_agreement":"x","pricing_policy":"x","pricing_disclaimer":"x","privacy_security":"x","repair_warranty_terms":"x","econsent_disclosure":"x"}'::jsonb;
  v_body_only jsonb := '{"body":"__wsldt_verify__ estimate text"}'::jsonb;
  v_estimate_with_six_keys_rejected boolean := false;
  v_master_with_body_only_rejected boolean := false;
begin
  begin
    insert into wholesale_legal_documents (document_type, version, status, content_en, content_es, content_hash)
      values ('estimate_disclaimer', '__wsldt_verify__ wrong-shape-1', 'draft', v_six_key, v_six_key, '__wsldt_verify__ hash');
    raise exception '__wsldt_verify_unexpected_success__' using errcode = 'ZZ001';
  exception
    when sqlstate 'ZZ001' then null;
    when others then v_estimate_with_six_keys_rejected := true;
  end;

  begin
    insert into wholesale_legal_documents (document_type, version, status, content_en, content_es, content_hash)
      values ('master_agreement', '__wsldt_verify__ wrong-shape-2', 'draft', v_body_only, v_body_only, '__wsldt_verify__ hash');
    raise exception '__wsldt_verify_unexpected_success__' using errcode = 'ZZ001';
  exception
    when sqlstate 'ZZ001' then null;
    when others then v_master_with_body_only_rejected := true;
  end;

  insert into _wsldt_verify_results values (
    8, 'content_shape_check_is_genuinely_conditional_per_type',
    case when v_estimate_with_six_keys_rejected and v_master_with_body_only_rejected then 'PASS' else 'FAIL' end,
    'estimate_disclaimer with the 6-key master shape rejected=' || v_estimate_with_six_keys_rejected
      || '; master_agreement with only a body key rejected=' || v_master_with_body_only_rejected
      || ' — expect true, true (each type''s content requirement is enforced independently, not an OR-anything-goes check)'
  );
end $$;

-- ----------------------------------------------------------------------------
-- Functional check (9): regression — a correctly-shaped draft row of EACH
-- type can still be inserted (the new conditional CHECK doesn't accidentally
-- reject valid data of either shape). Self-cleaning via plain DELETE (drafts
-- are never guard-protected).
-- ----------------------------------------------------------------------------
do $$
declare
  v_six_key jsonb := '{"access_agreement":"x","pricing_policy":"x","pricing_disclaimer":"x","privacy_security":"x","repair_warranty_terms":"x","econsent_disclosure":"x"}'::jsonb;
  v_body_only jsonb := '{"body":"__wsldt_verify__ estimate text"}'::jsonb;
  v_master_id uuid;
  v_estimate_id uuid;
  v_master_ok boolean := false;
  v_estimate_ok boolean := false;
begin
  begin
    insert into wholesale_legal_documents (document_type, version, status, content_en, content_es, content_hash)
      values ('master_agreement', '__wsldt_verify__ valid-master-draft', 'draft', v_six_key, v_six_key, '__wsldt_verify__ hash')
      returning id into v_master_id;
    v_master_ok := true;
  exception when others then v_master_ok := false;
  end;

  begin
    insert into wholesale_legal_documents (document_type, version, status, content_en, content_es, content_hash)
      values ('estimate_disclaimer', '__wsldt_verify__ valid-estimate-draft', 'draft', v_body_only, v_body_only, '__wsldt_verify__ hash')
      returning id into v_estimate_id;
    v_estimate_ok := true;
  exception when others then v_estimate_ok := false;
  end;

  if v_master_id is not null then delete from wholesale_legal_documents where id = v_master_id; end if;
  if v_estimate_id is not null then delete from wholesale_legal_documents where id = v_estimate_id; end if;

  insert into _wsldt_verify_results values (
    9, 'valid_draft_of_each_type_still_accepted',
    case when v_master_ok and v_estimate_ok then 'PASS' else 'FAIL' end,
    'valid 6-key master_agreement draft inserted=' || v_master_ok
      || '; valid single-body estimate_disclaimer draft inserted=' || v_estimate_ok || ' — expect true, true'
  );
end $$;

-- ----------------------------------------------------------------------------
-- Functional check (10): (document_type, version) composite unique — the
-- SAME version string is legal across the two different types, but a
-- duplicate WITHIN one type is still rejected.
-- ----------------------------------------------------------------------------
do $$
declare
  v_body_only jsonb := '{"body":"__wsldt_verify__ x"}'::jsonb;
  v_master_id uuid;
  v_estimate_same_version_id uuid;
  v_cross_type_same_version_ok boolean := false;
  v_within_type_duplicate_rejected boolean := false;
begin
  insert into wholesale_legal_documents (document_type, version, status, content_en, content_es, content_hash)
    values ('master_agreement', '__wsldt_verify__ shared-version', 'draft',
            '{"access_agreement":"x","pricing_policy":"x","pricing_disclaimer":"x","privacy_security":"x","repair_warranty_terms":"x","econsent_disclosure":"x"}'::jsonb,
            '{"access_agreement":"x","pricing_policy":"x","pricing_disclaimer":"x","privacy_security":"x","repair_warranty_terms":"x","econsent_disclosure":"x"}'::jsonb,
            '__wsldt_verify__ hash')
    returning id into v_master_id;

  begin
    insert into wholesale_legal_documents (document_type, version, status, content_en, content_es, content_hash)
      values ('estimate_disclaimer', '__wsldt_verify__ shared-version', 'draft', v_body_only, v_body_only, '__wsldt_verify__ hash')
      returning id into v_estimate_same_version_id;
    v_cross_type_same_version_ok := true;
  exception when others then v_cross_type_same_version_ok := false;
  end;

  begin
    insert into wholesale_legal_documents (document_type, version, status, content_en, content_es, content_hash)
      values ('estimate_disclaimer', '__wsldt_verify__ shared-version', 'draft', v_body_only, v_body_only, '__wsldt_verify__ hash-dup');
    raise exception '__wsldt_verify_unexpected_success__' using errcode = 'ZZ001';
  exception
    when sqlstate 'ZZ001' then null;
    when others then v_within_type_duplicate_rejected := true;
  end;

  delete from wholesale_legal_documents where id = v_master_id;
  if v_estimate_same_version_id is not null then delete from wholesale_legal_documents where id = v_estimate_same_version_id; end if;

  insert into _wsldt_verify_results values (
    10, 'version_uniqueness_is_scoped_by_document_type',
    case when v_cross_type_same_version_ok and v_within_type_duplicate_rejected then 'PASS' else 'FAIL' end,
    'same version string across master_agreement and estimate_disclaimer accepted=' || v_cross_type_same_version_ok
      || '; duplicate version WITHIN estimate_disclaimer rejected=' || v_within_type_duplicate_rejected
      || ' — expect true, true'
  );
end $$;

-- ----------------------------------------------------------------------------
-- Functional check (11): one-published-per-type index — reuses whichever
-- published row of each type already exists (real production data or a
-- throwaway sentinel), same "never unconditionally insert a second published
-- row" discipline as wholesale-legal-verify.sql's check 10. Proves: (a) a
-- published master_agreement and a published estimate_disclaimer coexist
-- without conflict, (b) a second published row of the SAME type is rejected.
--
-- Cleanup note: a plain DELETE against a row this check just published would
-- itself be rejected by the immutability guard (a published row can never be
-- deleted via plain DELETE — that is the guard correctly working, proven
-- separately by check 12). So, exactly like wholesale-legal-verify.sql's
-- check 13 (the append-only-guard test), the entire creation-and-probe
-- sequence below is wrapped in ONE outer nested begin/exception/end block
-- that deliberately raises its own '__wsldt_verify_cleanup__' sentinel
-- (ZZ002) at the end to force the whole block — including any sentinel rows
-- this check itself inserted — to roll back together. When a real published
-- row is REUSED instead of a sentinel being created, that branch performs no
-- INSERT at all, so the outer rollback has nothing of that type to undo and
-- the real row is left completely untouched.
-- ----------------------------------------------------------------------------
do $$
declare
  v_master_published_id uuid;
  v_estimate_published_id uuid;
  v_master_mode text;
  v_estimate_mode text;
  v_coexist_ok boolean;
  v_second_master_rejected boolean := false;
  v_second_estimate_rejected boolean := false;
begin
  begin
    select id into v_master_published_id from wholesale_legal_documents where status = 'published' and document_type = 'master_agreement' limit 1;
    if v_master_published_id is null then
      v_master_mode := 'created throwaway sentinel';
      insert into wholesale_legal_documents (document_type, version, status, content_en, content_es, content_hash, published_at)
        values ('master_agreement', '__wsldt_verify__ pub-master', 'published',
                '{"access_agreement":"x","pricing_policy":"x","pricing_disclaimer":"x","privacy_security":"x","repair_warranty_terms":"x","econsent_disclosure":"x"}'::jsonb,
                '{"access_agreement":"x","pricing_policy":"x","pricing_disclaimer":"x","privacy_security":"x","repair_warranty_terms":"x","econsent_disclosure":"x"}'::jsonb,
                '__wsldt_verify__ hash', now())
        returning id into v_master_published_id;
    else
      v_master_mode := 'reused existing published row id=' || v_master_published_id;
    end if;

    select id into v_estimate_published_id from wholesale_legal_documents where status = 'published' and document_type = 'estimate_disclaimer' limit 1;
    if v_estimate_published_id is null then
      v_estimate_mode := 'created throwaway sentinel';
      insert into wholesale_legal_documents (document_type, version, status, content_en, content_es, content_hash, published_at)
        values ('estimate_disclaimer', '__wsldt_verify__ pub-estimate', 'published', '{"body":"x"}'::jsonb, '{"body":"x"}'::jsonb, '__wsldt_verify__ hash', now())
        returning id into v_estimate_published_id;
    else
      v_estimate_mode := 'reused existing published row id=' || v_estimate_published_id;
    end if;

    -- Both now coexist as published, simultaneously — the point of check (a).
    v_coexist_ok := (
      (select status from wholesale_legal_documents where id = v_master_published_id) = 'published'
      and (select status from wholesale_legal_documents where id = v_estimate_published_id) = 'published'
    );

    begin
      insert into wholesale_legal_documents (document_type, version, status, content_en, content_es, content_hash, published_at)
        values ('master_agreement', '__wsldt_verify__ pub-master-2', 'published',
                '{"access_agreement":"x","pricing_policy":"x","pricing_disclaimer":"x","privacy_security":"x","repair_warranty_terms":"x","econsent_disclosure":"x"}'::jsonb,
                '{"access_agreement":"x","pricing_policy":"x","pricing_disclaimer":"x","privacy_security":"x","repair_warranty_terms":"x","econsent_disclosure":"x"}'::jsonb,
                '__wsldt_verify__ hash', now());
      raise exception '__wsldt_verify_unexpected_success__' using errcode = 'ZZ001';
    exception
      when sqlstate 'ZZ001' then null;
      when others then v_second_master_rejected := true;
    end;

    begin
      insert into wholesale_legal_documents (document_type, version, status, content_en, content_es, content_hash, published_at)
        values ('estimate_disclaimer', '__wsldt_verify__ pub-estimate-2', 'published', '{"body":"x"}'::jsonb, '{"body":"x"}'::jsonb, '__wsldt_verify__ hash', now());
      raise exception '__wsldt_verify_unexpected_success__' using errcode = 'ZZ001';
    exception
      when sqlstate 'ZZ001' then null;
      when others then v_second_estimate_rejected := true;
    end;

    -- Force the whole outer block (including any sentinel INSERTs above) to
    -- roll back now that every outcome is captured — the only way to undo a
    -- row the immutability guard has already (correctly) made undeletable
    -- via plain DELETE.
    raise exception '__wsldt_verify_cleanup__' using errcode = 'ZZ002';
  exception
    when sqlstate 'ZZ002' then null; -- expected: our own deliberate full-cleanup rollback, not a real error
  end;

  insert into _wsldt_verify_results values (
    11, 'one_published_per_type_index_functional',
    case when v_coexist_ok and v_second_master_rejected and v_second_estimate_rejected then 'PASS' else 'FAIL' end,
    'master_agreement: ' || v_master_mode || '; estimate_disclaimer: ' || v_estimate_mode
      || '; both simultaneously published=' || v_coexist_ok
      || '; second published master_agreement rejected=' || v_second_master_rejected
      || '; second published estimate_disclaimer rejected=' || v_second_estimate_rejected
      || ' — expect true, true, true'
  );
end $$;

-- ----------------------------------------------------------------------------
-- Functional check (12): the widened immutability guard rejects a
-- document_type change on an already-published row (regardless of which
-- type). Reuses whatever published master_agreement row exists (real or a
-- throwaway sentinel), same "attempt against real data is safe here because
-- the mutation is expected to be REJECTED and wrapped in a nested rollback
-- block" reasoning as wholesale-legal-verify.sql's check 12 — and, same as
-- check 11 above, a sentinel this check itself publishes cannot be cleaned
-- up via plain DELETE (the guard correctly rejects that too), so the whole
-- sentinel-creation-and-probe sequence is wrapped in one outer nested
-- begin/exception/end block that force-rolls-back via its own
-- '__wsldt_verify_cleanup__' (ZZ002) sentinel at the end.
-- ----------------------------------------------------------------------------
do $$
declare
  v_doc_id uuid;
  v_mode text;
  v_type_change_rejected boolean := false;
begin
  begin
    select id into v_doc_id from wholesale_legal_documents where status = 'published' and document_type = 'master_agreement' limit 1;
    if v_doc_id is null then
      v_mode := 'created throwaway sentinel';
      insert into wholesale_legal_documents (document_type, version, status, content_en, content_es, content_hash, published_at)
        values ('master_agreement', '__wsldt_verify__ guard-type-change', 'published',
                '{"access_agreement":"x","pricing_policy":"x","pricing_disclaimer":"x","privacy_security":"x","repair_warranty_terms":"x","econsent_disclosure":"x"}'::jsonb,
                '{"access_agreement":"x","pricing_policy":"x","pricing_disclaimer":"x","privacy_security":"x","repair_warranty_terms":"x","econsent_disclosure":"x"}'::jsonb,
                '__wsldt_verify__ hash', now())
        returning id into v_doc_id;
    else
      v_mode := 'reused existing published row id=' || v_doc_id;
    end if;

    begin
      update wholesale_legal_documents set document_type = 'estimate_disclaimer' where id = v_doc_id;
      raise exception '__wsldt_verify_unexpected_success__' using errcode = 'ZZ001';
    exception
      when sqlstate 'ZZ001' then null;
      when others then v_type_change_rejected := true;
    end;

    raise exception '__wsldt_verify_cleanup__' using errcode = 'ZZ002';
  exception
    when sqlstate 'ZZ002' then null; -- expected: our own deliberate full-cleanup rollback, not a real error
  end;

  insert into _wsldt_verify_results values (
    12, 'immutability_guard_rejects_document_type_change_on_published',
    case when v_type_change_rejected then 'PASS' else 'FAIL' end,
    'mode: ' || v_mode || '; attempted UPDATE ... SET document_type on a published row — expected the guard to '
      || 'reject it; rejected=' || v_type_change_rejected
  );
end $$;

-- ----------------------------------------------------------------------------
-- Final check (13): wholesale_legal_documents row count is unchanged from
-- before this file's functional checks — confirms every synthetic/sentinel
-- row created above is genuinely self-cleaning.
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from wholesale_legal_documents where version like '__wsldt_verify__%') then
    insert into _wsldt_verify_results values (
      13, 'no_leftover_synthetic_rows', 'FAIL',
      'a row matching version like ''__wsldt_verify__%'' still exists after this file''s own cleanup — investigate '
        || 'which check above failed to clean up after itself'
    );
  else
    insert into _wsldt_verify_results values (
      13, 'no_leftover_synthetic_rows', 'PASS',
      'zero rows with a version matching ''__wsldt_verify__%'' remain — every synthetic/sentinel row this file '
        || 'created was cleaned up by its own check'
    );
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Final result set.
-- ----------------------------------------------------------------------------
select check_name, status, details
from (
  select ord, check_name, status, details from _wsldt_verify_results
  union all
  select
    99,
    'OVERALL STATUS',
    case
      when bool_or(status = 'FAIL') then 'FAIL'
      when bool_or(status = 'REVIEW REQUIRED') then 'REVIEW REQUIRED'
      else 'PASS'
    end,
    'PASS = the second document type (estimate_disclaimer) is installed and its schema-level guarantees are '
      || 'verified working, without disturbing the existing master_agreement type or its own already-verified '
      || 'guarantees. FAIL = investigate before trusting this feature.'
  from _wsldt_verify_results
) t
order by ord;

-- Nothing above is ever committed — every synthetic row this file created is
-- undone here. Re-run this file safely as many times as you want, forever.
rollback;
