-- ============================================================================
-- Rollback — reverses wholesale-catalog-architecture-fix-migration.sql ONLY,
-- restoring the exact state established by the two ALREADY-EXECUTED prior
-- migrations (wholesale-dynamic-equipment-types-migration.sql and
-- wholesale-microsoldering-tag-assignment-migration.sql). It does NOT touch
-- anything either of THOSE files' own rollbacks would touch beyond what
-- this fix itself changed.
-- ============================================================================
-- Before any of that: a safety gate (step 0, right after begin;) confirms the
-- database is actually in the CORRECTED state this fix produces — zero
-- microsoldering tag relationships anywhere, and microsoldering currently
-- catalog_mode='direct_services' — aborting the whole transaction via RAISE
-- EXCEPTION if not, rather than reinserting the 56 tags on top of an
-- unexpected state.
--
-- Reverses, in order: (1) macbook-air/macbook-pro re-pointed back to
-- 'laptops', 'macbook' hidden again; (2) sort_order restored to the 8-card
-- sequence with macbook pushed back to 101 (gaming-laptops/video-consoles
-- shift to 102/103, matching the prior migration's own numbering exactly);
-- (3) microsoldering's is_tag_lens/source_mode/source_tag_id restored to
-- tag_lens-active; (4) the 56 tag relationships RE-INSERTED (restoring the
-- prior — wrong, but already-verified-and-real — assigned state, since
-- that is what existed immediately before this fix ran); (5) the delete RPC
-- restored to its is_tag_lens-aware form.
--
-- catalog_mode / wholesale_services.name_es / description_en / description_es
-- / uq_wholesale_images_service are LEFT IN PLACE — an optional, clearly
-- separate final step below can drop them, matching this project's existing
-- convention (see wholesale-dynamic-equipment-types-rollback.sql's own
-- optional final step for source_mode/source_tag_id) of never dropping
-- schema as part of the unconditional/default rollback path.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 0. Safety gate — confirm we are starting from the expected CORRECTED
--    state (this fix's migration actually applied: zero microsoldering tag
--    relationships remain anywhere, and microsoldering is currently
--    catalog_mode='direct_services') before reinserting the 56 tag
--    relationships below. Running this rollback against an unexpected state
--    — the fix never applied, only partially applied, or already rolled
--    back and then re-tagged by hand since — could silently duplicate or
--    misrepresent the restored data. RAISE EXCEPTION aborts the whole
--    transaction instead of guessing.
-- ----------------------------------------------------------------------------
do $$
declare
  v_current_tag_count int;
  v_catalog_mode text;
begin
  select count(*) into v_current_tag_count
  from wholesale_service_tags st
  join wholesale_tags t on t.id = st.tag_id
  where t.slug = 'microsoldering';
  if v_current_tag_count <> 0 then
    raise exception 'catalog_architecture_rollback_aborted: expected ZERO microsoldering tag relationships before rolling back (the corrected state this fix produces), found % — this is not the expected corrected state; investigate before re-running (has the fix migration actually run? has something re-tagged services since?)', v_current_tag_count;
  end if;

  select catalog_mode into v_catalog_mode from wholesale_equipment_types where slug = 'microsoldering';
  if v_catalog_mode is distinct from 'direct_services' then
    raise exception 'catalog_architecture_rollback_aborted: expected microsoldering.catalog_mode = ''direct_services'' (the corrected state) before rolling back, found % — this is not the expected corrected state; investigate before re-running', coalesce(v_catalog_mode, 'NULL');
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 1. Re-point macbook-air/macbook-pro back to 'laptops'; hide 'macbook'
--    again (name left as-is — this migration's own rename to "MacBook" is
--    presumed to already match macbook's pre-existing name; nothing here
--    depends on that being true either way).
-- ----------------------------------------------------------------------------
update wholesale_categories set equipment_type_id = (
  select id from wholesale_equipment_types where slug = 'laptops'
), updated_at = now()
where slug in ('macbook-air', 'macbook-pro')
  and equipment_type_id = (select id from wholesale_equipment_types where slug = 'macbook')
  and equipment_type_id is distinct from (select id from wholesale_equipment_types where slug = 'laptops');

update wholesale_equipment_types set active = false, updated_at = now()
where slug = 'macbook' and active = true;

-- Reverse the laptops-gamer re-point back onto the separate 'gaming-laptops'
-- equipment type it pointed at before this fix (see the migration file's
-- own header for why this was a real, pre-existing gap this fix corrected —
-- rolling back restores that exact prior state, not a new one).
update wholesale_categories set equipment_type_id = (
  select id from wholesale_equipment_types where slug = 'gaming-laptops'
), updated_at = now()
where slug = 'laptops-gamer'
  and equipment_type_id = (select id from wholesale_equipment_types where slug = 'laptops')
  and equipment_type_id is distinct from (select id from wholesale_equipment_types where slug = 'gaming-laptops');

-- ----------------------------------------------------------------------------
-- 2. Restore sort_order to the 8-card sequence the dynamic-equipment-types
--    migration established, one atomic statement, same collision-free
--    technique.
-- ----------------------------------------------------------------------------
update wholesale_equipment_types t set
  sort_order = m.new_sort_order,
  updated_at = now()
from (values
  ('microsoldering',   1),
  ('iphone',           2),
  ('ipad',             3),
  ('laptops',          4),
  ('ps5',              5),
  ('xbox-series-x',    6),
  ('switch',           7),
  ('controllers',      8),
  ('macbook',        101),
  ('gaming-laptops', 102),
  ('video-consoles', 103)
) as m(slug, new_sort_order)
where t.slug = m.slug
  and t.sort_order is distinct from m.new_sort_order;

-- ----------------------------------------------------------------------------
-- 3. Restore microsoldering to tag_lens-active.
-- ----------------------------------------------------------------------------
update wholesale_equipment_types set
  is_tag_lens = true,
  source_mode = 'tag_lens',
  source_tag_id = (select id from wholesale_tags where slug = 'microsoldering'),
  catalog_mode = 'grouped',
  updated_at = now()
where slug = 'microsoldering';

-- ----------------------------------------------------------------------------
-- 4. Re-insert the 56 tag relationships this fix removed — restoring the
--    exact prior (wrong, but real, already-verified) assigned state.
--    ON CONFLICT DO NOTHING, same idempotent posture as the original
--    assignment migration.
-- ----------------------------------------------------------------------------
do $$
declare
  v_tag_id uuid;
  v_reinserted int;
begin
  select id into v_tag_id from wholesale_tags where slug = 'microsoldering';
  if v_tag_id is null then
    raise notice 'microsoldering tag not found — cannot restore the 56 relationships (0 rows reinserted)';
  else
    insert into wholesale_service_tags (service_id, tag_id)
    select target.service_id, v_tag_id
    from unnest(array[
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
    ]::uuid[]) as target(service_id)
    on conflict (service_id, tag_id) do nothing;
    get diagnostics v_reinserted = row_count;
    raise notice 'reinserted % of 56 microsoldering tag relationships (the rest were presumably already present)', v_reinserted;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 5. Restore wholesale_delete_equipment_type to its is_tag_lens-aware form
--    (exact copy of wholesale-dynamic-equipment-types-migration.sql's own
--    version of this function).
-- ----------------------------------------------------------------------------
create or replace function public.wholesale_delete_equipment_type(
  p_admin_id uuid, p_equipment_type_id uuid, p_confirm boolean
) returns text
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_is_tag_lens boolean;
  v_category_count int;
  v_image_storage_path text;
begin
  if not exists (select 1 from public.profiles where id = p_admin_id and role = 'admin' and status = 'approved') then
    raise exception 'invalid_admin';
  end if;
  if p_confirm is distinct from true then
    raise exception 'confirmation_required';
  end if;

  select is_tag_lens into v_is_tag_lens from wholesale_equipment_types where id = p_equipment_type_id for update;
  if v_is_tag_lens is null then
    raise exception 'equipment_type_not_found';
  end if;
  if v_is_tag_lens then
    raise exception 'cannot_delete_tag_lens_equipment_type';
  end if;

  select count(*) into v_category_count from wholesale_categories where equipment_type_id = p_equipment_type_id;
  if v_category_count > 0 then
    raise exception 'equipment_type_has_categories';
  end if;

  select storage_path into v_image_storage_path from wholesale_images where equipment_type_id = p_equipment_type_id;

  delete from wholesale_equipment_types where id = p_equipment_type_id;

  return coalesce(v_image_storage_path, '');
end;
$$;
revoke execute on function public.wholesale_delete_equipment_type(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.wholesale_delete_equipment_type(uuid, uuid, boolean) to service_role;

commit;

-- ============================================================================
-- OPTIONAL — run separately, only if you also want the new columns/index
-- gone entirely (not required to undo the WRONG behavior; they are inert
-- and unused once the data-level rollback above has run). Uncomment and run
-- by hand if desired:
--
-- alter table wholesale_equipment_types drop constraint if exists wholesale_equipment_types_catalog_mode_check;
-- alter table wholesale_equipment_types drop column if exists catalog_mode;
-- alter table wholesale_services drop column if exists name_es;
-- alter table wholesale_services drop column if exists description_en;
-- alter table wholesale_services drop column if exists description_es;
-- drop index if exists uq_wholesale_images_service;
-- ============================================================================
