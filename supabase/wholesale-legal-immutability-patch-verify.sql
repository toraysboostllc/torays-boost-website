-- ============================================================================
-- Verify — run AFTER wholesale-legal-immutability-patch-migration.sql
-- ============================================================================
-- Same safety convention as wholesale-legal-verify.sql: this file is NOT
-- purely read-only (it has to actually attempt writes to prove the new
-- constraint and the widened guard really reject what they claim to), so the
-- ENTIRE file is wrapped in one explicit transaction that ends in ROLLBACK,
-- never COMMIT. Safe to run any time, as many times as you want, forever.
--
-- Every synthetic row this file creates is tagged with the literal marker
-- '__wsl_verify__' in a text field, same convention as
-- wholesale-legal-verify.sql, for the same reason (trivially identifiable if
-- this file is ever interrupted before its own final ROLLBACK).
--
-- NO explicit SAVEPOINT / ROLLBACK TO SAVEPOINT / COMMIT anywhere inside a DO
-- block (Postgres ERROR 42601 if attempted). Every "attempt X, undo it if it
-- unexpectedly succeeds" check below uses PL/pgSQL's own implicit
-- subtransaction mechanism — a nested `begin ... exception ... end` block —
-- with the same custom-SQLSTATE sentinel convention as
-- wholesale-legal-verify.sql: 'ZZ001' marks "the operation unexpectedly
-- succeeded" (stays FAIL), 'ZZ002' marks "our own deliberate full-cleanup
-- rollback, not a real error" (used when a check's synthetic row would
-- otherwise be left protected/undeletable by the very guard it just proved
-- works).
-- ============================================================================

begin;

create temporary table _wsl_verify_results (
  ord int,
  check_name text,
  status text,
  details text
);

-- ----------------------------------------------------------------------------
-- Setup (not itself a check / no result row here): snapshots the
-- wholesale_legal_documents row count before any functional check below
-- touches this table, so the final check can confirm the count is unchanged
-- (every synthetic row created below is self-cleaning).
-- ----------------------------------------------------------------------------
do $$
declare
  v_before bigint;
begin
  select count(*) into v_before from wholesale_legal_documents;
  create temporary table _wsl_verify_doc_count_before as select v_before as cnt;
end $$;

-- ----------------------------------------------------------------------------
-- Functional check (1): the new CHECK constraint exists, named as the
-- migration created it.
-- ----------------------------------------------------------------------------
insert into _wsl_verify_results
select 1, 'constraint_exists_and_named_as_expected',
  case when exists (
    select 1 from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'wholesale_legal_documents'
      and con.conname = 'wholesale_legal_documents_published_requires_published_at'
  ) then 'PASS' else 'FAIL' end,
  'wholesale_legal_documents_published_requires_published_at exists (structural presence only — checks 2-3 '
    || 'below test it actually rejects bad data)';

-- ----------------------------------------------------------------------------
-- Functional check (2): the constraint actually rejects an INSERT with
-- status='published' and published_at omitted (null).
-- ----------------------------------------------------------------------------
do $$
declare
  v_content jsonb := '{"access_agreement":"__wsl_verify__","pricing_policy":"x","pricing_disclaimer":"x","privacy_security":"x","repair_warranty_terms":"x","econsent_disclosure":"x"}'::jsonb;
  v_rejected boolean := false;
begin
  begin
    insert into wholesale_legal_documents (version, status, content_en, content_es, content_hash)
      values ('__wsl_verify__ patch-pub-null', 'published', v_content, v_content, '__wsl_verify__ hash-pub-null');
    raise exception '__wsl_verify_unexpected_success__' using errcode = 'ZZ001';
  exception
    when sqlstate 'ZZ001' then
      null; -- unexpected success — v_rejected stays false (FAIL)
    when others then
      v_rejected := true; -- expected check_violation
  end;

  insert into _wsl_verify_results values (
    2, 'constraint_rejects_insert_published_without_published_at',
    case when v_rejected then 'PASS' else 'FAIL' end,
    'attempted INSERT with status=''published'', published_at omitted — expected a check_violation on '
      || 'wholesale_legal_documents_published_requires_published_at; rejected=' || v_rejected
  );
end $$;

-- ----------------------------------------------------------------------------
-- Functional check (3): same, for status='superseded'.
-- ----------------------------------------------------------------------------
do $$
declare
  v_content jsonb := '{"access_agreement":"__wsl_verify__","pricing_policy":"x","pricing_disclaimer":"x","privacy_security":"x","repair_warranty_terms":"x","econsent_disclosure":"x"}'::jsonb;
  v_rejected boolean := false;
begin
  begin
    insert into wholesale_legal_documents (version, status, content_en, content_es, content_hash)
      values ('__wsl_verify__ patch-sup-null', 'superseded', v_content, v_content, '__wsl_verify__ hash-sup-null');
    raise exception '__wsl_verify_unexpected_success__' using errcode = 'ZZ001';
  exception
    when sqlstate 'ZZ001' then
      null;
    when others then
      v_rejected := true;
  end;

  insert into _wsl_verify_results values (
    3, 'constraint_rejects_insert_superseded_without_published_at',
    case when v_rejected then 'PASS' else 'FAIL' end,
    'attempted INSERT with status=''superseded'', published_at omitted — expected a check_violation; rejected='
      || v_rejected
  );
end $$;

-- ----------------------------------------------------------------------------
-- Functional check (4): regression — draft rows are NOT required to carry
-- published_at. The constraint must not accidentally block ordinary draft
-- creation (the normal, common case).
-- ----------------------------------------------------------------------------
do $$
declare
  v_content jsonb := '{"access_agreement":"__wsl_verify__","pricing_policy":"x","pricing_disclaimer":"x","privacy_security":"x","repair_warranty_terms":"x","econsent_disclosure":"x"}'::jsonb;
  v_id uuid;
  v_ok boolean := false;
begin
  begin
    insert into wholesale_legal_documents (version, status, content_en, content_es, content_hash)
      values ('__wsl_verify__ patch-draft', 'draft', v_content, v_content, '__wsl_verify__ hash-draft')
      returning id into v_id;
    v_ok := true;
  exception
    when others then
      v_ok := false;
  end;

  -- Draft rows are never guard-protected (status not in published/superseded
  -- and published_at is null) — a plain DELETE is sufficient cleanup, no
  -- nested-rollback trick required.
  if v_id is not null then
    delete from wholesale_legal_documents where id = v_id;
  end if;

  insert into _wsl_verify_results values (
    4, 'constraint_allows_draft_without_published_at',
    case when v_ok then 'PASS' else 'FAIL' end,
    'attempted INSERT with status=''draft'', published_at omitted — expected success (drafts are unaffected); '
      || 'succeeded=' || v_ok
  );
end $$;

-- ----------------------------------------------------------------------------
-- Functional check (5): defense-in-depth — the WIDENED GUARD ITSELF (not the
-- new constraint) still blocks UPDATE/DELETE on a row whose status is
-- 'published' even if published_at is somehow NULL. Once the constraint from
-- this patch is in place, that exact row shape can never be created through
-- ordinary SQL — which is the whole point — so this check temporarily drops
-- the constraint INSIDE a nested block that is guaranteed to roll back
-- (Postgres DDL is fully transactional; dropping a constraint inside a
-- subtransaction that rolls back restores it), constructs the anomalous row,
-- proves the guard alone rejects both UPDATE and DELETE against it, then
-- force-rolls-back the whole nested block — undoing the constraint drop AND
-- the synthetic row together. v_update_rejected/v_delete_rejected are plain
-- local variables, not transactional, so they survive that rollback intact
-- (same technique wholesale-legal-verify.sql's check 13 uses).
-- ----------------------------------------------------------------------------
do $$
declare
  v_content jsonb := '{"access_agreement":"__wsl_verify__","pricing_policy":"x","pricing_disclaimer":"x","privacy_security":"x","repair_warranty_terms":"x","econsent_disclosure":"x"}'::jsonb;
  v_id uuid;
  v_update_rejected boolean := false;
  v_delete_rejected boolean := false;
begin
  begin
    alter table wholesale_legal_documents
      drop constraint if exists wholesale_legal_documents_published_requires_published_at;

    insert into wholesale_legal_documents (version, status, content_en, content_es, content_hash)
      values ('__wsl_verify__ patch-guard-anomaly', 'published', v_content, v_content, '__wsl_verify__ hash-guard-anomaly')
      returning id into v_id;
    -- v_id now names a row with status='published' and published_at IS NULL
    -- — the exact anomalous state this whole patch exists to make
    -- unreachable in normal operation. Confirm the GUARD (not the
    -- constraint, which is currently dropped) still refuses to let it be
    -- touched.

    begin
      update wholesale_legal_documents set content_en = content_en || '{"extra":"x"}'::jsonb where id = v_id;
      raise exception '__wsl_verify_unexpected_success__' using errcode = 'ZZ001';
    exception
      when sqlstate 'ZZ001' then
        null; -- unexpected success — v_update_rejected stays false (FAIL)
      when others then
        v_update_rejected := true; -- the widened guard correctly blocked it
    end;

    begin
      delete from wholesale_legal_documents where id = v_id;
      raise exception '__wsl_verify_unexpected_success__' using errcode = 'ZZ001';
    exception
      when sqlstate 'ZZ001' then
        null;
      when others then
        v_delete_rejected := true;
    end;

    -- Force the whole outer block (the constraint drop AND the anomalous
    -- insert) to roll back now that both outcomes are captured.
    raise exception '__wsl_verify_cleanup__' using errcode = 'ZZ002';
  exception
    when sqlstate 'ZZ002' then
      null; -- expected: our own deliberate full-cleanup rollback, not a real error
  end;

  insert into _wsl_verify_results values (
    5, 'guard_blocks_published_with_null_published_at_defense_in_depth',
    case when v_update_rejected and v_delete_rejected then 'PASS' else 'FAIL' end,
    'constraint temporarily dropped inside a rolled-back nested block; constructed a status=''published'' row '
      || 'with published_at NULL; update_rejected=' || v_update_rejected || ', delete_rejected=' || v_delete_rejected
      || ' — expect true, true. A FAIL here means the guard is relying on published_at alone again — the '
      || 'defense-in-depth this patch adds has regressed'
  );
end $$;

-- ----------------------------------------------------------------------------
-- Functional check (6): regression — the guard's widening must NOT block the
-- one legitimate status-only transition wholesale_publish_legal_document
-- performs (published -> superseded, no content/published_at/published_by
-- change). Uses its own synthetic published row, never a real document.
-- ----------------------------------------------------------------------------
do $$
declare
  v_content jsonb := '{"access_agreement":"__wsl_verify__","pricing_policy":"x","pricing_disclaimer":"x","privacy_security":"x","repair_warranty_terms":"x","econsent_disclosure":"x"}'::jsonb;
  v_id uuid;
  v_transition_ok boolean := false;
  v_status_after text;
begin
  begin
    insert into wholesale_legal_documents (version, status, content_en, content_es, content_hash, published_at)
      values ('__wsl_verify__ patch-transition', 'published', v_content, v_content, '__wsl_verify__ hash-transition', now())
      returning id into v_id;

    -- The exact shape of wholesale_publish_legal_document's own supersede
    -- step: a status-only UPDATE, nothing else touched.
    update wholesale_legal_documents set status = 'superseded' where id = v_id;

    select status into v_status_after from wholesale_legal_documents where id = v_id;
    v_transition_ok := (v_status_after = 'superseded');

    -- This row is now status='superseded' with published_at set — fully
    -- guard-protected under the new widened condition, same as any real
    -- superseded document. A plain DELETE would itself be rejected (correct
    -- behavior), so cleanup requires forcing this whole block to roll back.
    raise exception '__wsl_verify_cleanup__' using errcode = 'ZZ002';
  exception
    when sqlstate 'ZZ002' then
      null;
  end;

  insert into _wsl_verify_results values (
    6, 'guard_still_allows_legitimate_published_to_superseded_transition',
    case when v_transition_ok then 'PASS' else 'FAIL' end,
    'attempted a status-only UPDATE from ''published'' to ''superseded'' (no other column touched) — expected '
      || 'success, matching wholesale_publish_legal_document''s own supersede step; status after update='
      || coalesce(v_status_after, '(update itself failed)') || ' — expect ''superseded'''
  );
end $$;

-- ----------------------------------------------------------------------------
-- Final check (7): wholesale_legal_documents row count is unchanged from the
-- snapshot taken before any functional check above — confirms every
-- synthetic row this file created was genuinely self-cleaning.
-- ----------------------------------------------------------------------------
insert into _wsl_verify_results
select 7, 'legal_documents_row_count_unchanged',
  case when (select count(*) from wholesale_legal_documents) = (select cnt from _wsl_verify_doc_count_before)
    then 'PASS' else 'FAIL' end,
  'count before this file''s functional checks=' || (select cnt from _wsl_verify_doc_count_before)
    || ', count now=' || (select count(*) from wholesale_legal_documents)
    || ' — expect equal (every synthetic row above is self-cleaning via a nested-block rollback or an explicit '
    || 'DELETE)';

-- ----------------------------------------------------------------------------
-- Final result set.
-- ----------------------------------------------------------------------------
select check_name, status, details
from (
  select ord, check_name, status, details from _wsl_verify_results
  union all
  select
    99,
    'OVERALL STATUS',
    case
      when bool_or(status = 'FAIL') then 'FAIL'
      when bool_or(status = 'REVIEW REQUIRED') then 'REVIEW REQUIRED'
      else 'PASS'
    end,
    'PASS = the immutability defense-in-depth patch is installed and verified working. FAIL = investigate '
      || 'before trusting this hardening.'
  from _wsl_verify_results
) t
order by ord;

-- Nothing above is ever committed — every synthetic row this file created is
-- undone here. Re-run this file safely as many times as you want, forever.
rollback;
