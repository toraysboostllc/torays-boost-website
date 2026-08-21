-- ============================================================================
-- Verify — run AFTER wholesale-catalog-architecture-fix-migration.sql
-- ============================================================================
-- Same split as wholesale-dynamic-equipment-types-verify.sql: checks 1-3 and
-- 4-12 are READ-ONLY assertions against the CURRENT (post-fix) real state
-- (check 3 in particular confirms ZERO microsoldering tag relationships
-- remain ANYWHERE, not merely that the 56 known targets were retracted);
-- checks 13-14 exercise the updated wholesale_delete_equipment_type RPC's
-- real behavior using synthetic rows, wrapped in this file's own begin;...
-- rollback; (self-cleaning). Safe to re-run any time.
-- ============================================================================

begin;

create temporary table _wsl_cafix_verify_results (
  ord int, check_name text, status text, details text
);

-- ----------------------------------------------------------------------------
-- Check 1 (read-only): new columns/index exist with the expected shape.
-- ----------------------------------------------------------------------------
insert into _wsl_cafix_verify_results
select 1, 'new_columns_and_index_exist_with_correct_shape',
  case when
    exists (select 1 from information_schema.columns where table_schema='public' and table_name='wholesale_equipment_types' and column_name='catalog_mode' and is_nullable='NO')
    and exists (select 1 from pg_constraint where conname = 'wholesale_equipment_types_catalog_mode_check')
    and exists (select 1 from information_schema.columns where table_schema='public' and table_name='wholesale_services' and column_name='name_es' and is_nullable='YES')
    and exists (select 1 from information_schema.columns where table_schema='public' and table_name='wholesale_services' and column_name='description_en' and is_nullable='YES')
    and exists (select 1 from information_schema.columns where table_schema='public' and table_name='wholesale_services' and column_name='description_es' and is_nullable='YES')
    and exists (select 1 from pg_indexes where indexname = 'uq_wholesale_images_service')
  then 'PASS' else 'FAIL' end,
  'catalog_mode not-null with its CHECK constraint, services.name_es/description_en/description_es all nullable, uq_wholesale_images_service present';

-- ----------------------------------------------------------------------------
-- Check 2 (read-only): all 56 previously-wrong target ids no longer carry
-- the microsoldering tag — 0/56, exact.
-- ----------------------------------------------------------------------------
with target56(service_id) as (
  select unnest(array[
    'a0f00a68-9ac4-4007-ba41-5cecd4cbbb11', '6721d13b-0a6c-4e98-a3a6-3919f875d118', '0b973865-f8c3-40e1-9336-b341190bb6ec',
    'e974ab6e-678b-4d9e-90f2-2562f2eaa73e', '274402df-7a6f-43f0-becf-8e894117c905', 'e307b624-9782-4572-87cd-b8347ef3f173',
    '793773d3-4eeb-4510-8aa4-68b018219cae', '88463850-bab8-45d7-b25d-c4178d9a12d9', '184e1c3c-e6ea-4350-8212-ccc825d0912a',
    '8fc803f8-c255-4dd7-bfb0-1c7849002b3d', '76f1c27e-2bd6-4862-a697-6c3e44f0d0ac', '1845ff3b-081f-4c85-8b0b-0ed9cda4a00f',
    'fc58450f-6e70-46ce-a97e-7e51ffc0a4b9', '9eb35062-4abd-4317-bef2-7c61d3716f4a', 'b4aa9434-1b1b-41bb-bb0d-a13604d47bfe',
    '810e5d83-9d4f-4054-88bc-1b4d594df507', '636f607c-9309-4333-b55f-593d828969f8', 'd2b908d0-3b52-44b5-861d-9292eb1d76db',
    '107334b5-c393-4a6e-8a3c-e3a866243941', '49eec112-14d2-4bf2-8b57-3f56af695b59', '422ee991-da3c-4205-a824-55dced29e0e4',
    'f6f55860-7bb8-49cd-bea4-0728297d411a', '1da74cd6-a77d-4241-a7e9-0326c83b86d8', '9c11aad9-05db-4b83-8610-da8f8dd9db74',
    '2ad18346-f573-42e9-9dd3-e598f6bd2af6', '6c14e379-8fda-481b-97db-dc4c97cf0dc6', '4d1e1173-f6d1-46ee-acdf-1ae009369775',
    '1541f85b-b339-4531-9874-0a88dd30f6b9', '074db437-e782-4f15-9c2d-83f12c516ae3', 'bd5b071c-8fb6-441a-a268-c202956a8374',
    'ac6b2d48-d2c9-42fa-a9a0-0343c85ebadd', '46b2b85a-3fda-4351-8337-e2f88ecbc862', '19dba538-6f48-4816-b653-38d281c3a9af',
    '1f3ee4cc-3296-478a-b289-4cdb60886fd7', 'aa5defaa-7447-41e6-a912-893ef7c98ccc', 'c338bb8b-0868-4cad-8fef-ef6edd25d504',
    '376cdb7d-688e-4f59-8a6b-eb2810a4ffdb', '734c6029-697e-4600-86eb-aff7ba4fdcbb', '6f808c14-ad4d-41f4-a244-b5b918cacbc2',
    '69e2c3c8-1f1d-4cc1-8633-f95419b1b865', 'd04e15f2-07f3-4162-ac44-1488c25eeb00', '425e5397-6232-4ea6-a9a8-fd568a6726f0',
    'f316d870-bee9-4364-975e-ea8a6653c483', 'c20368d9-ae49-407b-85ae-c1a91d154fff', '409aa2d3-206c-4f30-ad88-cef2de9699a1',
    '57b10620-7b41-4ebe-9020-9f79d42bc84a',
    'f4fc9f51-84ca-4661-a379-34aa567d868c', '7e7ba07a-adcc-4586-848a-b38b11238597', 'f9ea9e54-247a-48a6-9df9-39468bb3f0e7',
    'f5c0605b-e163-4b3d-bf1e-544c48311ce4', '3f2886b8-1716-4525-a712-d6c681a74a3b', 'e19cdf0a-1de7-456c-8644-f71f5fa6ff7e',
    '44f199ad-8c7a-46ba-8a20-90903ada7fd8', 'ee9dd812-2b16-4442-9ec0-54c6858bf537', 'c68b7f11-353c-4163-b04d-2ef7555ae271',
    '729d78b6-1534-458e-a741-c594a8a8f7d0'
  ]::uuid[]) as service_id
),
still_tagged as (
  select t.service_id from target56 t
  join wholesale_service_tags st on st.service_id = t.service_id
  join wholesale_tags tag on tag.id = st.tag_id and tag.slug = 'microsoldering'
)
insert into _wsl_cafix_verify_results
select 2, 'all_56_wrong_tags_retracted',
  case when (select count(*) from still_tagged) = 0 then 'PASS' else 'FAIL' end,
  'remaining wrong-tagged rows among the 56 = ' || (select count(*) from still_tagged) || ' (must be 0) — still tagged: ' ||
    coalesce((select string_agg(service_id::text, ', ') from still_tagged), '(none)');

-- ----------------------------------------------------------------------------
-- Check 3 (read-only): ZERO microsoldering tag relationships remain
-- ANYWHERE in the whole table — a stronger claim than check 2, which only
-- confirms the 56 known targets specifically. Meaningful precisely because
-- the migration's own step 0 safety gate already proved (inside the same
-- transaction, immediately before its DELETE ran) that the tag set was
-- EXACTLY those 56 beforehand — if that held, deleting exactly those 56
-- must leave the table at 0, not merely "no longer contains the 56 we knew
-- about". Catches a service that was ALSO tagged outside the known 56 and
-- therefore never targeted by the DELETE.
-- ----------------------------------------------------------------------------
insert into _wsl_cafix_verify_results
select 3, 'zero_microsoldering_tag_relationships_exist_anywhere',
  case when (
    select count(*) from wholesale_service_tags st
    join wholesale_tags t on t.id = st.tag_id
    where t.slug = 'microsoldering'
  ) = 0 then 'PASS' else 'FAIL' end,
  'total microsoldering-tagged relationships remaining anywhere = ' || (
    select count(*) from wholesale_service_tags st join wholesale_tags t on t.id = st.tag_id where t.slug = 'microsoldering'
  ) || ' (must be 0 — the tag mechanism is fully retired by this fix, not merely reduced to a smaller set)';

-- ----------------------------------------------------------------------------
-- Check 4 (read-only): macbook-air and macbook-pro resolve to 'macbook',
-- zero remain on 'laptops'.
-- ----------------------------------------------------------------------------
insert into _wsl_cafix_verify_results
select 4, 'macbook_categories_restored',
  case when (
    select count(*) from wholesale_categories c
    join wholesale_equipment_types et on et.id = c.equipment_type_id
    where c.slug in ('macbook-air', 'macbook-pro') and et.slug = 'macbook'
  ) = 2 and (
    select count(*) from wholesale_categories c
    join wholesale_equipment_types et on et.id = c.equipment_type_id
    where c.slug in ('macbook-air', 'macbook-pro') and et.slug = 'laptops'
  ) = 0
  then 'PASS' else 'FAIL' end,
  'on macbook=' || (select count(*) from wholesale_categories c join wholesale_equipment_types et on et.id = c.equipment_type_id where c.slug in ('macbook-air','macbook-pro') and et.slug = 'macbook')
    || ' (expect 2), still on laptops=' || (select count(*) from wholesale_categories c join wholesale_equipment_types et on et.id = c.equipment_type_id where c.slug in ('macbook-air','macbook-pro') and et.slug = 'laptops')
    || ' (expect 0)';

-- ----------------------------------------------------------------------------
-- Check 5 (read-only): mirrors the dynamic-equipment-types-verify pattern —
-- every service under macbook-air/macbook-pro still resolves to a real
-- category (never orphaned by the re-point).
-- ----------------------------------------------------------------------------
insert into _wsl_cafix_verify_results
select 5, 'no_orphaned_services_for_macbook_categories',
  case when (
    select count(*) from wholesale_services s
    where s.category_id in (select id from wholesale_categories where slug in ('macbook-air', 'macbook-pro'))
      and not exists (select 1 from wholesale_categories c where c.id = s.category_id)
  ) = 0 then 'PASS' else 'FAIL' end,
  'every wholesale_services row referencing a macbook-air/macbook-pro category_id still resolves to a real category row';

-- ----------------------------------------------------------------------------
-- Check 6 (read-only): laptops-normal AND laptops-gamer both resolve to
-- 'laptops' — laptops-normal always did; laptops-gamer is re-pointed here
-- from the separate 'gaming-laptops' equipment type it silently pointed at
-- since the original navigation migration (see migration file's header).
-- gaming-laptops itself is now genuinely empty (0 categories).
-- ----------------------------------------------------------------------------
insert into _wsl_cafix_verify_results
select 6, 'laptops_owns_both_its_categories_gaming_laptops_now_empty',
  case when (
    select count(*) from wholesale_categories c
    join wholesale_equipment_types et on et.id = c.equipment_type_id
    where c.slug in ('laptops-normal', 'laptops-gamer') and et.slug = 'laptops'
  ) = 2 and (
    select count(*) from wholesale_categories where equipment_type_id = (select id from wholesale_equipment_types where slug = 'gaming-laptops')
  ) = 0
  then 'PASS' else 'FAIL' end,
  'laptops-normal/laptops-gamer resolving to laptops = ' || (
    select count(*) from wholesale_categories c join wholesale_equipment_types et on et.id = c.equipment_type_id
    where c.slug in ('laptops-normal', 'laptops-gamer') and et.slug = 'laptops'
  ) || ' / 2, gaming-laptops remaining categories = ' || (
    select count(*) from wholesale_categories where equipment_type_id = (select id from wholesale_equipment_types where slug = 'gaming-laptops')
  ) || ' (expect 0)';

-- ----------------------------------------------------------------------------
-- Check 7 (read-only): macbook is active with the right names; laptops is
-- untouched (still active, still named Laptops).
-- ----------------------------------------------------------------------------
insert into _wsl_cafix_verify_results
select 7, 'macbook_active_with_names_laptops_unaffected',
  case when exists (
    select 1 from wholesale_equipment_types where slug = 'macbook' and active = true and name = 'MacBook' and name_es = 'MacBook'
  ) and exists (
    select 1 from wholesale_equipment_types where slug = 'laptops' and active = true and name = 'Laptops'
  ) then 'PASS' else 'FAIL' end,
  'macbook: ' || coalesce((select 'active=' || active || ', name=' || name || ', name_es=' || coalesce(name_es, 'NULL') from wholesale_equipment_types where slug = 'macbook'), '(not found)')
    || ' | laptops: ' || coalesce((select 'active=' || active || ', name=' || name from wholesale_equipment_types where slug = 'laptops'), '(not found)');

-- ----------------------------------------------------------------------------
-- Check 8 (read-only): microsoldering fully decoupled from tag_lens —
-- catalog_mode='direct_services', is_tag_lens=false, source_mode='direct',
-- source_tag_id null.
-- ----------------------------------------------------------------------------
insert into _wsl_cafix_verify_results
select 8, 'microsoldering_decoupled_from_tag_lens',
  case when exists (
    select 1 from wholesale_equipment_types
    where slug = 'microsoldering' and catalog_mode = 'direct_services' and is_tag_lens = false
      and source_mode = 'direct' and source_tag_id is null
  ) then 'PASS' else 'FAIL' end,
  coalesce((
    select 'catalog_mode=' || catalog_mode || ', is_tag_lens=' || is_tag_lens || ', source_mode=' || source_mode || ', source_tag_id=' || coalesce(source_tag_id::text, 'NULL')
    from wholesale_equipment_types where slug = 'microsoldering'
  ), '(microsoldering row not found)');

-- ----------------------------------------------------------------------------
-- Check 9 (read-only): exactly one row is catalog_mode='direct_services'
-- (microsoldering) — every other row is the default 'grouped'.
-- ----------------------------------------------------------------------------
insert into _wsl_cafix_verify_results
select 9, 'catalog_mode_direct_services_is_exactly_microsoldering',
  case when (
    select count(*) from wholesale_equipment_types where catalog_mode = 'direct_services'
  ) = 1 and exists (
    select 1 from wholesale_equipment_types where slug = 'microsoldering' and catalog_mode = 'direct_services'
  ) then 'PASS' else 'FAIL' end,
  'total direct_services rows=' || (select count(*) from wholesale_equipment_types where catalog_mode = 'direct_services')
    || ' — must be exactly 1, and it must be microsoldering';

-- ----------------------------------------------------------------------------
-- Check 10 (read-only): sort_order collision-free across ALL rows.
-- ----------------------------------------------------------------------------
insert into _wsl_cafix_verify_results
select 10, 'sort_order_collision_free_across_all_rows',
  case when (
    select count(*) from (select sort_order, count(*) from wholesale_equipment_types group by sort_order having count(*) > 1) dupes
  ) = 0 then 'PASS' else 'FAIL' end,
  'dup groups found: ' || coalesce((
    select string_agg(sort_order || ' (x' || cnt || ')', ', ')
    from (select sort_order, count(*) as cnt from wholesale_equipment_types group by sort_order having count(*) > 1) d
  ), '(none)');

-- ----------------------------------------------------------------------------
-- Check 11 (read-only): the 9 active equipment_types, ordered by sort_order,
-- are exactly the owner-approved sequence.
-- ----------------------------------------------------------------------------
insert into _wsl_cafix_verify_results
select 11, 'final_visual_order_matches_9_card_sequence',
  case when (
    select array_agg(slug order by sort_order) from wholesale_equipment_types where active = true
  ) = array['microsoldering', 'iphone', 'ipad', 'macbook', 'laptops', 'ps5', 'xbox-series-x', 'switch', 'controllers']
  then 'PASS' else 'FAIL' end,
  'actual: ' || coalesce((select string_agg(slug, ', ' order by sort_order) from wholesale_equipment_types where active = true), '(none)');

-- ----------------------------------------------------------------------------
-- Check 12 (read-only): no duplicate slugs (structural sanity).
-- ----------------------------------------------------------------------------
insert into _wsl_cafix_verify_results
select 12, 'no_duplicate_equipment_type_slugs',
  case when (select count(*) from wholesale_equipment_types) = (select count(distinct slug) from wholesale_equipment_types)
    then 'PASS' else 'FAIL' end,
  'total=' || (select count(*) from wholesale_equipment_types) || ', distinct slugs=' || (select count(distinct slug) from wholesale_equipment_types);

-- ----------------------------------------------------------------------------
-- Check 13 (functional, self-cleaning): the updated wholesale_delete_
-- equipment_type RPC deletes a genuinely empty synthetic row (mirrors a
-- fresh, empty catalog_mode='direct_services' card) and refuses a synthetic
-- row that still has a category attached — the SAME "zero categories" rule
-- now applied without any is_tag_lens special case.
-- ----------------------------------------------------------------------------
-- Result-row insert happens AFTER this block, not inside it — see
-- wholesale-dynamic-equipment-types-verify.sql's own comment on why
-- (PL/pgSQL EXCEPTION is an implicit SAVEPOINT; catching one rolls back
-- every change made since the block began, including ones already
-- committed within it — confirmed there by a real run, not assumed here).
do $$
declare
  v_admin_id uuid;
  v_empty_id uuid;
  v_populated_id uuid;
  v_cat_id uuid;
  v_empty_delete_ok boolean := false;
  v_populated_delete_rejected boolean := false;
  v_skip boolean := false;
begin
  select id into v_admin_id from profiles where role = 'admin' and status = 'approved' limit 1;
  if v_admin_id is null then
    v_skip := true;
  else
    begin
      insert into wholesale_equipment_types (slug, name, catalog_mode, sort_order) values ('__wsl_cafix_verify__empty', '__wsl_cafix_verify__ Empty', 'direct_services', 601)
        returning id into v_empty_id;
      insert into wholesale_equipment_types (slug, name, catalog_mode, sort_order) values ('__wsl_cafix_verify__populated', '__wsl_cafix_verify__ Populated', 'direct_services', 602)
        returning id into v_populated_id;
      insert into wholesale_categories (slug, name, equipment_type_id) values ('__wsl_cafix_verify__cat', '__wsl_cafix_verify__ category', v_populated_id)
        returning id into v_cat_id;

      perform wholesale_delete_equipment_type(v_admin_id, v_empty_id, true);
      v_empty_delete_ok := not exists (select 1 from wholesale_equipment_types where id = v_empty_id);

      begin
        perform wholesale_delete_equipment_type(v_admin_id, v_populated_id, true);
        raise exception '__wsl_cafix_verify_unexpected_success__' using errcode = 'ZZ001';
      exception
        when sqlstate 'ZZ001' then null;
        when others then v_populated_delete_rejected := true;
      end;

      raise exception '__wsl_cafix_verify_cleanup__' using errcode = 'ZZ002';
    exception
      when sqlstate 'ZZ002' then null;
    end;
  end if;

  if v_skip then
    insert into _wsl_cafix_verify_results values (
      13, 'delete_rpc_generic_zero_categories_rule', 'SKIPPED', 'no approved admin profile exists yet in this project — nothing to test against'
    );
  else
    insert into _wsl_cafix_verify_results values (
      13, 'delete_rpc_generic_zero_categories_rule',
      case when v_empty_delete_ok and v_populated_delete_rejected then 'PASS' else 'FAIL' end,
      'empty_direct_services_row_deleted=' || v_empty_delete_ok || ', populated_row_rejected=' || v_populated_delete_rejected
        || ' — expect true, true (no is_tag_lens special case involved in either outcome)'
    );
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Check 14 (read-only): the real microsoldering row was never touched by
-- check 13's synthetic tests above.
-- ----------------------------------------------------------------------------
insert into _wsl_cafix_verify_results
select 14, 'real_microsoldering_row_untouched_by_check_13',
  case when exists (select 1 from wholesale_equipment_types where slug = 'microsoldering') then 'PASS' else 'FAIL' end,
  'the real microsoldering row must still exist after check 13''s synthetic RPC tests';

-- ----------------------------------------------------------------------------
-- Final check: no synthetic __wsl_cafix_verify__ row left behind.
-- ----------------------------------------------------------------------------
insert into _wsl_cafix_verify_results
select 15, 'no_synthetic_rows_left_behind',
  case when (select count(*) from wholesale_equipment_types where slug like '\_\_wsl\_cafix\_verify\_\_%' escape '\') = 0
    then 'PASS' else 'FAIL' end,
  (select count(*) from wholesale_equipment_types where slug like '\_\_wsl\_cafix\_verify\_\_%' escape '\')::text;

-- ----------------------------------------------------------------------------
-- Final result set.
-- ----------------------------------------------------------------------------
select check_name, status, details
from (
  select ord, check_name, status, details from _wsl_cafix_verify_results
  union all
  select 99, 'OVERALL STATUS',
    case when bool_or(status = 'FAIL') then 'FAIL' else 'PASS' end,
    'PASS = the catalog architecture fix landed correctly and the updated delete RPC works as designed. FAIL = '
      || 'investigate before trusting DESK/Website changes that depend on this migration.'
  from _wsl_cafix_verify_results
) t
order by ord;

-- Check 13's synthetic writes are undone here; every other check never
-- wrote anything to begin with. Safe to re-run this file any time.
rollback;
