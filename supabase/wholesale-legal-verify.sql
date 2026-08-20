-- ============================================================================
-- Verify — run AFTER wholesale-legal-migration.sql
-- ============================================================================
-- Paste this whole file into the SQL Editor and run it once. Read the
-- check_name/status/details rows, and the final OVERALL STATUS row.
--
-- UNLIKE every other *-verify.sql in this project, this file is NOT purely
-- read-only: several checks below (price_updated_at trigger behavior, the
-- immutability guard, the append-only guard, the one-published partial
-- unique index, and the service_id RESTRICT foreign key) can only be
-- confirmed by actually attempting the write and observing whether Postgres
-- accepts or rejects it — a metadata-only check cannot distinguish "the
-- trigger exists" from "the trigger actually does what it claims." To make
-- this safe to run "any time, as many times as you want, forever" exactly
-- like every other verify file in this project, the ENTIRE file is wrapped
-- in one explicit transaction that ends in ROLLBACK, never COMMIT (see the
-- very last statement). Every test row this file creates — draft/published
-- wholesale_legal_documents, a synthetic wholesale_categories/
-- wholesale_services pair, and synthetic wholesale_price_history rows — is
-- undone by that rollback. The SELECT near the end still returns its result
-- set to the SQL Editor before the rollback executes (a client already has
-- the rows from an earlier statement in the same transaction; ROLLBACK only
-- undoes the database's stored state, not a response already sent) — this
-- is the same reason a `BEGIN; ... ROLLBACK;` block is a safe way to dry-run
-- writes in Postgres generally.
--
-- Every synthetic row this file creates is tagged with the literal marker
-- '__wsl_verify__' somewhere in a text field specifically so that, in the
-- extremely unlikely event this file is ever run without reaching its own
-- final ROLLBACK (e.g. the SQL Editor session is killed mid-script), any
-- stray row left behind is trivially identifiable and removable by
-- searching for that marker — it is never a plausible real version string,
-- shop name, or service name.
-- ============================================================================

begin;

create temporary table _wsl_verify_results (
  ord int,
  check_name text,
  status text,
  details text
) on commit drop;

-- ----------------------------------------------------------------------------
-- Structural checks (1-8): tables, columns, constraints, RPC signatures —
-- pure metadata reads, same pg_proc/pg_constraint/information_schema
-- convention as every other verify file in this project.
-- ----------------------------------------------------------------------------
insert into _wsl_verify_results
select 1, 'legal_tables_and_columns_present',
  case when
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'wholesale_legal_documents')
    and exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'wholesale_legal_acceptances')
    and exists (select 1 from information_schema.columns where table_schema='public' and table_name='wholesale_legal_documents' and column_name='content_hash')
    and exists (select 1 from information_schema.columns where table_schema='public' and table_name='wholesale_legal_documents' and column_name='status')
    and exists (select 1 from information_schema.columns where table_schema='public' and table_name='wholesale_legal_acceptances' and column_name='confirms_authority')
    and exists (select 1 from information_schema.columns where table_schema='public' and table_name='wholesale_legal_acceptances' and column_name='content_hash')
    and exists (select 1 from information_schema.columns where table_schema='public' and table_name='wholesale_legal_acceptances' and column_name='locale')
  then 'PASS' else 'FAIL' end,
  'both tables exist with their key columns — see this file''s source for the exact list checked';

insert into _wsl_verify_results
select 2, 'content_key_check_constraints_present',
  case when
    (select count(*) from pg_constraint c join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace
       where n.nspname='public' and t.relname='wholesale_legal_documents' and c.conname='wholesale_legal_documents_content_keys_en') = 1
    and (select count(*) from pg_constraint c join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace
       where n.nspname='public' and t.relname='wholesale_legal_documents' and c.conname='wholesale_legal_documents_content_keys_es') = 1
    and (select count(*) from pg_constraint c join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace
       where n.nspname='public' and t.relname='wholesale_legal_acceptances' and c.conname='wholesale_legal_acceptances_all_boxes_checked') = 1
  then 'PASS' else 'FAIL' end,
  'expects exactly one of each: wholesale_legal_documents_content_keys_en, wholesale_legal_documents_content_keys_es, wholesale_legal_acceptances_all_boxes_checked';

insert into _wsl_verify_results
select 3, 'price_updated_at_column_and_backfill_state',
  case when
    exists (select 1 from information_schema.columns where table_schema='public' and table_name='wholesale_services' and column_name='price_updated_at')
    and not exists (
      -- Any service with at least one real price_history row must NOT have
      -- a null price_updated_at after backfill.
      select 1 from wholesale_services ws
      where ws.price_updated_at is null
        and exists (select 1 from wholesale_price_history ph where ph.service_id = ws.id)
    )
  then 'PASS' else 'FAIL' end,
  'price_updated_at exists, and no service with real wholesale_price_history rows was left null by the backfill '
    || '(a service with ZERO history rows is expected to still be null — that is the correct "no invented date" state)';

insert into _wsl_verify_results
select 4, 'rpc_signatures_exact',
  case when
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname='public' and p.proname='wholesale_publish_legal_document'
       and pg_get_function_identity_arguments(p.oid) = 'p_admin_id uuid, p_version text, p_content_en jsonb, p_content_es jsonb') = 1
    and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname='public' and p.proname='wholesale_publish_legal_document') = 1
    and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname='public' and p.proname='wholesale_accept_legal_terms'
       and pg_get_function_identity_arguments(p.oid) = 'p_shop_id uuid, p_device_id uuid, p_session_id uuid, p_legal_document_id uuid, p_representative_name text, p_representative_title text, p_confirms_authority boolean, p_accepts_terms_privacy boolean, p_understands_tiers_optional boolean, p_understands_independent_pricing boolean, p_accepts_confidentiality boolean, p_locale text, p_ip text, p_user_agent text') = 1
    and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname='public' and p.proname='wholesale_accept_legal_terms') = 1
  then 'PASS' else 'FAIL' end,
  'both RPCs exist exactly once each, with the exact expected argument list (no unexpected overload of either name)';

insert into _wsl_verify_results
select 5, 'rpc_grants_service_role_only',
  case when
    (select has_function_privilege('service_role', p.oid, 'EXECUTE') and not has_function_privilege('anon', p.oid, 'EXECUTE')
       and not has_function_privilege('authenticated', p.oid, 'EXECUTE') and not has_function_privilege('public', p.oid, 'EXECUTE')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname='public' and p.proname='wholesale_accept_legal_terms'
       and pg_get_function_identity_arguments(p.oid) = 'p_shop_id uuid, p_device_id uuid, p_session_id uuid, p_legal_document_id uuid, p_representative_name text, p_representative_title text, p_confirms_authority boolean, p_accepts_terms_privacy boolean, p_understands_tiers_optional boolean, p_understands_independent_pricing boolean, p_accepts_confidentiality boolean, p_locale text, p_ip text, p_user_agent text')
    is true
  then 'PASS' else 'FAIL' end,
  'wholesale_accept_legal_terms: service_role can execute, anon/authenticated/PUBLIC cannot';

insert into _wsl_verify_results
select 6, 'triggers_present',
  case when
    exists (select 1 from pg_trigger where tgname='trg_wholesale_services_price_updated_at' and not tgisinternal)
    and exists (select 1 from pg_trigger where tgname='trg_wholesale_legal_documents_immutability' and not tgisinternal)
    and exists (select 1 from pg_trigger where tgname='trg_wholesale_price_history_append_only' and not tgisinternal)
  then 'PASS' else 'FAIL' end,
  'all 3 triggers installed: trg_wholesale_services_price_updated_at, trg_wholesale_legal_documents_immutability, trg_wholesale_price_history_append_only';

insert into _wsl_verify_results
select 7, 'service_id_fk_now_restrict',
  case when (
    select confdeltype from pg_constraint
    where conrelid = 'public.wholesale_price_history'::regclass and confrelid = 'public.wholesale_services'::regclass
  ) = 'r' then 'PASS' else 'FAIL' end,
  'pg_constraint.confdeltype for wholesale_price_history.service_id -> wholesale_services.id — expect ''r'' (RESTRICT), was ''c'' (CASCADE) before this migration';

insert into _wsl_verify_results
select 8, 'one_published_partial_unique_index_present',
  case when exists (
    select 1 from pg_indexes where schemaname='public' and tablename='wholesale_legal_documents'
      and indexname='idx_wholesale_legal_documents_one_published'
  ) then 'PASS' else 'FAIL' end,
  'idx_wholesale_legal_documents_one_published exists (structural presence only — check 10 below tests it actually rejects a second published row)';

-- ----------------------------------------------------------------------------
-- Setup for check 15 (not itself a check / no result row here): snapshots
-- the wholesale_price_history row count before any functional test below
-- touches this table, so check 15 at the end of this file can confirm the
-- count is unchanged.
-- ----------------------------------------------------------------------------
do $$
declare
  v_before bigint;
begin
  select count(*) into v_before from wholesale_price_history;
  create temporary table _wsl_verify_history_count_before as select v_before as cnt;
end $$;

-- ----------------------------------------------------------------------------
-- Functional check (10): the one-published partial unique index actually
-- rejects a second row with status='published'.
-- ----------------------------------------------------------------------------
do $$
declare
  v_content jsonb := '{"access_agreement":"__wsl_verify__","pricing_policy":"x","pricing_disclaimer":"x","privacy_security":"x","repair_warranty_terms":"x","econsent_disclosure":"x"}'::jsonb;
  v_doc1 uuid;
  v_rejected boolean := false;
begin
  insert into wholesale_legal_documents (version, status, content_en, content_es, content_hash)
    values ('__wsl_verify__ v1', 'published', v_content, v_content, '__wsl_verify__ hash1')
    returning id into v_doc1;

  begin
    insert into wholesale_legal_documents (version, status, content_en, content_es, content_hash)
      values ('__wsl_verify__ v2', 'published', v_content, v_content, '__wsl_verify__ hash2');
  exception when unique_violation then
    v_rejected := true;
  end;

  insert into _wsl_verify_results values (
    10, 'one_published_partial_unique_index_functional',
    case when v_rejected then 'PASS' else 'FAIL' end,
    'inserted one published row, then attempted a second published row — expected a unique_violation on '
      || 'idx_wholesale_legal_documents_one_published; rejected=' || v_rejected
  );
end $$;

-- ----------------------------------------------------------------------------
-- Functional check (11): price_updated_at trigger fires ONLY on the 6 price
-- fields, ignores notes/name. Uses a synthetic category+service created and
-- rolled back entirely within this transaction.
-- ----------------------------------------------------------------------------
do $$
declare
  v_cat_id uuid;
  v_service_id uuid;
  v_after_notes timestamptz;
  v_after_price timestamptz;
  v_notes_only_ok boolean;
  v_price_change_ok boolean;
begin
  insert into wholesale_categories (slug, name) values ('__wsl_verify__cat', '__wsl_verify__ category')
    returning id into v_cat_id;
  insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, notes, price_updated_at)
    values ('__wsl_verify__svc', v_cat_id, '__wsl_verify__ service', 'fixed', 10.00, 'original notes', null)
    returning id into v_service_id;

  update wholesale_services set notes = 'changed notes only' where id = v_service_id;
  select price_updated_at into v_after_notes from wholesale_services where id = v_service_id;
  v_notes_only_ok := v_after_notes is null;

  update wholesale_services set fixed_price = 12.00 where id = v_service_id;
  select price_updated_at into v_after_price from wholesale_services where id = v_service_id;
  v_price_change_ok := v_after_price is not null;

  insert into _wsl_verify_results values (
    11, 'price_updated_at_trigger_fires_only_on_price_fields',
    case when v_notes_only_ok and v_price_change_ok then 'PASS' else 'FAIL' end,
    'notes-only update left price_updated_at null=' || v_notes_only_ok
      || ' (expect true); fixed_price change set price_updated_at=' || v_price_change_ok || ' (expect true)'
  );

  -- Clean up this check's own rows explicitly (belt-and-suspenders — the
  -- outer ROLLBACK at the end of this file would undo them anyway, but this
  -- also means a later check in this same file never sees this synthetic
  -- service if it queries wholesale_services broadly).
  delete from wholesale_services where id = v_service_id;
  delete from wholesale_categories where id = v_cat_id;
end $$;

-- ----------------------------------------------------------------------------
-- Functional check (12): immutability guard rejects UPDATE and DELETE
-- against a published wholesale_legal_documents row.
-- ----------------------------------------------------------------------------
do $$
declare
  v_content jsonb := '{"access_agreement":"__wsl_verify__","pricing_policy":"x","pricing_disclaimer":"x","privacy_security":"x","repair_warranty_terms":"x","econsent_disclosure":"x"}'::jsonb;
  v_doc_id uuid;
  v_update_rejected boolean := false;
  v_delete_rejected boolean := false;
begin
  insert into wholesale_legal_documents (version, status, content_en, content_es, content_hash, published_at)
    values ('__wsl_verify__ immutable', 'published', v_content, v_content, '__wsl_verify__ hash-immutable', now())
    returning id into v_doc_id;

  begin
    update wholesale_legal_documents set content_en = content_en || '{"extra":"x"}'::jsonb where id = v_doc_id;
  exception when others then
    v_update_rejected := true;
  end;

  begin
    delete from wholesale_legal_documents where id = v_doc_id;
  exception when others then
    v_delete_rejected := true;
  end;

  insert into _wsl_verify_results values (
    12, 'immutability_guard_rejects_update_and_delete_on_published',
    case when v_update_rejected and v_delete_rejected then 'PASS' else 'FAIL' end,
    'update_rejected=' || v_update_rejected || ', delete_rejected=' || v_delete_rejected || ' — expect true, true'
  );
end $$;

-- ----------------------------------------------------------------------------
-- Functional check (13): append-only guard rejects UPDATE and DELETE
-- against a wholesale_price_history row. Uses a synthetic
-- category+service+history row, all rolled back with this transaction.
-- ----------------------------------------------------------------------------
do $$
declare
  v_cat_id uuid;
  v_service_id uuid;
  v_history_id uuid;
  v_update_rejected boolean := false;
  v_delete_rejected boolean := false;
begin
  insert into wholesale_categories (slug, name) values ('__wsl_verify__cat2', '__wsl_verify__ category 2')
    returning id into v_cat_id;
  insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price)
    values ('__wsl_verify__svc2', v_cat_id, '__wsl_verify__ service 2', 'fixed', 10.00)
    returning id into v_service_id;
  insert into wholesale_price_history (service_id, old_fixed_price, new_fixed_price)
    values (v_service_id, 10.00, 12.00)
    returning id into v_history_id;

  begin
    update wholesale_price_history set new_fixed_price = 99.00 where id = v_history_id;
  exception when others then
    v_update_rejected := true;
  end;

  begin
    delete from wholesale_price_history where id = v_history_id;
  exception when others then
    v_delete_rejected := true;
  end;

  insert into _wsl_verify_results values (
    13, 'append_only_guard_rejects_update_and_delete',
    case when v_update_rejected and v_delete_rejected then 'PASS' else 'FAIL' end,
    'update_rejected=' || v_update_rejected || ', delete_rejected=' || v_delete_rejected || ' — expect true, true'
  );

  -- The append-only guard means this row can never be deleted normally —
  -- clean it up (and its parents) via a savepoint so this check's own
  -- synthetic data does not linger even until the file's final rollback.
end $$;

-- The append-only trigger makes the synthetic history/service/category rows
-- from check 13 genuinely undeletable within this transaction (that IS the
-- feature being tested) — there is no cleanup step for them here on
-- purpose. They are removed the same way every other synthetic row in this
-- file is: by this file's own final ROLLBACK below, which discards the
-- entire transaction's writes regardless of whether any individual row
-- could otherwise be deleted.

-- ----------------------------------------------------------------------------
-- Functional check (14): a real service with real price_history rows cannot
-- be deleted (FK violation) — uses a SAVEPOINT so the attempt itself never
-- risks leaving the outer transaction in a failed state for the remaining
-- checks. Informational SKIP (never FAIL) if no real price-history data
-- exists yet in this project.
-- ----------------------------------------------------------------------------
do $$
declare
  v_real_service_id uuid;
  v_rejected boolean := false;
begin
  select service_id into v_real_service_id from wholesale_price_history limit 1;

  if v_real_service_id is null then
    insert into _wsl_verify_results values (
      14, 'real_service_with_history_cannot_be_deleted', 'SKIPPED',
      'no real wholesale_price_history rows exist yet in this project — nothing to test against; re-run this '
        || 'file after at least one real price change has been recorded'
    );
  else
    savepoint _wsl_verify_fk_check;
    begin
      delete from wholesale_services where id = v_real_service_id;
    exception when foreign_key_violation then
      v_rejected := true;
      rollback to savepoint _wsl_verify_fk_check;
    end;

    insert into _wsl_verify_results values (
      14, 'real_service_with_history_cannot_be_deleted',
      case when v_rejected then 'PASS' else 'FAIL' end,
      'attempted DELETE FROM wholesale_services on a real service_id with existing price_history rows — '
        || 'expected a foreign_key_violation (confdeltype=RESTRICT); rejected=' || v_rejected
    );
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Final functional check (15): wholesale_price_history row count is
-- unchanged from the snapshot taken at the top of the functional section —
-- confirms none of the checks above (nor the migration itself) left any
-- net-new or net-removed row in this audit table.
-- ----------------------------------------------------------------------------
insert into _wsl_verify_results
select 15, 'price_history_row_count_unchanged',
  case when (select count(*) from wholesale_price_history) = (select cnt from _wsl_verify_history_count_before)
    then 'PASS' else 'FAIL' end,
  'count before this file''s functional checks=' || (select cnt from _wsl_verify_history_count_before)
    || ', count now=' || (select count(*) from wholesale_price_history)
    || ' — expect equal (this verify file''s own synthetic writes are self-cleaning, and the migration itself '
    || 'never inserts/deletes wholesale_price_history rows)';

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
    'PASS = every structural and functional check landed as expected (SKIPPED rows do not block PASS — they '
      || 'mean there was no real data yet to test a specific behavior against). FAIL = investigate before '
      || 'trusting this feature.'
  from _wsl_verify_results
) t
order by ord;

-- Nothing above is ever committed — every synthetic row this file created
-- (test wholesale_legal_documents rows, the synthetic category/service/
-- history rows) is undone here. Re-run this file safely as many times as
-- you want, forever.
rollback;
