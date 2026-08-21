-- ============================================================================
-- Rollback — reverses wholesale-microsoldering-tag-assignment-migration.sql
-- ============================================================================
-- Removes EXCLUSIVELY the 56 (service_id, tag_id='microsoldering') pairs
-- this migration creates — same 56 explicit ids, same list, as the
-- preflight/migration/verify files. Nothing else in wholesale_service_tags
-- is touched: no other tag, on these 56 services or any other service, is
-- read or written. Does not delete the 'microsoldering' tag row itself
-- (wholesale_tags), does not touch wholesale_services/wholesale_categories/
-- wholesale_equipment_types in any way.
--
-- Wrapped in an explicit transaction. Reports (via RAISE NOTICE, visible in
-- the Supabase SQL Editor's Logs/Messages panel) exactly how many rows were
-- actually deleted, so a partial/no-op rollback is never silently
-- indistinguishable from a full one.
-- ============================================================================

begin;

do $$
declare
  v_tag_id uuid;
  v_deleted_count int;
begin
  select id into v_tag_id from wholesale_tags where slug = 'microsoldering';
  if v_tag_id is null then
    raise notice 'microsoldering tag not found — nothing to roll back (0 rows deleted)';
    return;
  end if;

  delete from wholesale_service_tags
  where tag_id = v_tag_id
    and service_id = any(array[
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
    ]::uuid[]);

  get diagnostics v_deleted_count = row_count;
  raise notice 'rolled back % of 56 microsoldering tag relationships (the rest were presumably never tagged, or already rolled back)', v_deleted_count;
end $$;

commit;
