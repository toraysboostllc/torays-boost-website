-- ============================================================================
-- Catalog architecture fix — FORWARD-ONLY correction on top of the ALREADY-
-- EXECUTED wholesale-dynamic-equipment-types-migration.sql and
-- wholesale-microsoldering-tag-assignment-migration.sql (both verified PASS
-- on the real Supabase project). Run AFTER
-- wholesale-catalog-architecture-fix-preflight.sql reports OVERALL STATUS
-- PASS. Does NOT invoke either of those two migrations' own rollback files —
-- this is a genuinely new, self-contained correction of the CURRENT state,
-- not an undo.
-- ============================================================================
-- WHY THIS EXISTS: the two already-executed migrations implemented the wrong
-- concept for Microsoldering (a tag-based "lens" filtering services out of
-- other equipment types) and wrongly folded MacBook into "Laptops" (based on
-- an earlier, since-corrected reading of which slug was empty vs populated).
-- The owner's actual model is: Equipment Type -> Group/Model -> Fault ->
-- Price, with Microsoldering as its OWN card of independent, directly-owned
-- services (never an aggregation of other equipment types' services), and
-- MacBook as its own independent card, separate from Laptops.
--
-- FIVE independent things happen in this one migration:
--
--   1. Retract the 56 wrong microsoldering tag relationships — SAME 56
--      explicit service_id values as
--      wholesale-microsoldering-tag-assignment-migration.sql inserted (15
--      iPhone, 30 iPad, 1 Laptops, 10 Video Consoles), removed by a single
--      scoped DELETE keyed on (tag_id, service_id) — never touches any
--      other tag, on these 56 services or any other. This is functionally
--      identical to running that migration's own rollback file, but is
--      restated here, self-contained, per the owner's explicit instruction
--      not to invoke the existing rollback automatically.
--
--   2. Two new, GENERIC columns replace the tag-based mechanism entirely:
--        - wholesale_equipment_types.catalog_mode ('grouped' |
--          'direct_services') — 'grouped' (the default, unchanged for every
--          existing row and every new row DESK's create form produces) means
--          "categories/models live under this equipment type, exactly as
--          today"; 'direct_services' means "services attach directly, no
--          model-selection layer" — the new Microsoldering. Nothing here is
--          keyed to the 'microsoldering' slug; a second direct_services card
--          DESK creates later works identically, zero code change.
--        - wholesale_services.name_es / description_en / description_es —
--          nullable, generic i18n/content columns available to EVERY
--          service (not just direct_services ones), matching the exact
--          fallback convention wholesale_equipment_types.name_es already
--          established (empty/null -> show the English value, never blank).
--      is_tag_lens and source_mode/source_tag_id (added by the prior
--      migration) are left in the schema, UNCHANGED in shape, but the
--      microsoldering row's OWN values are reset to their neutral defaults
--      (source_mode='direct', source_tag_id=null, is_tag_lens=false) —
--      catalog_mode is the new, sole signal Website/DESK read going
--      forward. The columns are not dropped (a strictly additive, low-risk
--      posture for a forward-only fix); nothing reads them as a decision
--      input anymore after this migration and the accompanying code change.
--
--   3. wholesale_images gains a genuinely enforced "one photo per service"
--      unique index (uq_wholesale_images_service), completing the same
--      pattern wholesale-images-migration.sql already applied to
--      equipment_type_id/category_id — service_id ownership was already a
--      real, indexed FK column in that table (Fase 1 design), deliberately
--      left unconstrained "out of scope" at the time. This migration does
--      NOT insert or touch any wholesale_images row — no content is
--      invented; this only makes an already-supported ownership type
--      collision-safe the same way the other two already are.
--
--   4. MacBook restored as an independent, active equipment type: its 2
--      EXISTING categories (macbook-air, macbook-pro — same ids, same
--      services, same price_history, same price tiers, nothing recreated)
--      are re-pointed from 'laptops' back to 'macbook' (the exact reverse of
--      the prior migration's step 6), and 'macbook' itself is reactivated
--      (active=true) with display names "MacBook"/"MacBook".
--
--      AUDIT FINDING while building this fix, not previously known/stated:
--      'laptops-gamer' ("Gaming Laptops") — an EXISTING category, seeded
--      alongside 'laptops-normal' ("Laptops (Standard)") — has actually
--      been pointing at a SEPARATE, already-hidden equipment_types row
--      (slug 'gaming-laptops') this entire time, via
--      wholesale-navigation-migration.sql's own original backfill, NOT at
--      'laptops'. Neither prior migration touched this. Because
--      'gaming-laptops' the equipment type was hidden as a historical-
--      compatibility row by wholesale-dynamic-equipment-types-migration.sql
--      (on the reasonable assumption at the time that it was dead/unused),
--      'laptops-gamer' has been silently invisible on the portal ever
--      since — a real, pre-existing gap, not something either of the two
--      already-executed migrations broke, and not something previously
--      reported. The owner's explicit structure ("Laptops → Laptops
--      Standard / Gaming Laptops") requires it under 'laptops'. This step
--      re-points 'laptops-gamer' (same category id, same services if any —
--      the seed itself ships it with zero, so this is a zero-risk
--      structural move either way) from 'gaming-laptops' to 'laptops', so
--      it finally surfaces correctly, and now-genuinely-empty
--      'gaming-laptops' stays hidden, historical, never deleted — same
--      posture as every other retired row in this schema.
--
--      PHOTOS ARE DELIBERATELY NOT AUTO-REASSIGNED. The prior migration
--      moved macbook's equipment-type-level photo (if it had one, and only
--      if 'laptops' didn't already have its own) onto 'laptops'. Whether
--      that transfer actually happened, and whether 'laptops' might since
--      have received an unrelated new photo of its own from DESK, cannot be
--      safely reconstructed from data alone — reversing it automatically
--      would be a content decision this migration is not authorized to
--      make. Current photo ownership (macbook vs laptops) is reported by
--      both the preflight and verify files below so the owner can move a
--      photo from DESK's existing upload UI afterward if desired — this is
--      a documented assumption, not an oversight.
--
--   5. Final visual order — 9 exterior cards, ONE atomic
--      UPDATE ... FROM (VALUES ...) statement (same collision-free
--      technique as the prior migration's own step 9 — Postgres evaluates
--      every row's new value from the OLD snapshot before applying any of
--      them, so no two rows ever share a sort_order, not even transiently):
--        1 Microsoldering, 2 iPhone, 3 iPad, 4 MacBook, 5 Laptops,
--        6 PlayStation 5, 7 Xbox Series X, 8 Nintendo Switch / Switch OLED,
--        9 Controllers.
--      video-consoles and gaming-laptops remain hidden, historical-
--      compatibility rows (never deleted), pushed further out of the 1-9
--      range (101, 102 — unchanged from the prior migration).
--
-- The wholesale_delete_equipment_type RPC is also replaced (CREATE OR
-- REPLACE, same signature) to drop its is_tag_lens-specific refusal branch
-- — deletion is now governed ONLY by "does this equipment type still have
-- any category" (the same rule every other equipment type already lived
-- under), which composes correctly with catalog_mode='direct_services'
-- WITHOUT any special case: a direct_services card with zero services has
-- zero categories too (DESK only ever creates its one internal category
-- lazily, on the first service saved under it — see the accompanying DESK
-- code change), so it is deletable while genuinely empty and protected the
-- instant it has real content, exactly like a 'grouped' card already is.
--
-- Idempotent: column adds use "if not exists", the tag DELETE only removes
-- rows that still exist, every UPDATE has a guard clause that makes a
-- second run a no-op, and the RPC is CREATE OR REPLACE.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Retract the 56 wrong microsoldering tag relationships.
-- ----------------------------------------------------------------------------
delete from wholesale_service_tags
where tag_id = (select id from wholesale_tags where slug = 'microsoldering')
  and service_id = any(array[
    -- iPhone (15)
    'a0f00a68-9ac4-4007-ba41-5cecd4cbbb11', '6721d13b-0a6c-4e98-a3a6-3919f875d118', '0b973865-f8c3-40e1-9336-b341190bb6ec',
    'e974ab6e-678b-4d9e-90f2-2562f2eaa73e', '274402df-7a6f-43f0-becf-8e894117c905', 'e307b624-9782-4572-87cd-b8347ef3f173',
    '793773d3-4eeb-4510-8aa4-68b018219cae', '88463850-bab8-45d7-b25d-c4178d9a12d9', '184e1c3c-e6ea-4350-8212-ccc825d0912a',
    '8fc803f8-c255-4dd7-bfb0-1c7849002b3d', '76f1c27e-2bd6-4862-a697-6c3e44f0d0ac', '1845ff3b-081f-4c85-8b0b-0ed9cda4a00f',
    'fc58450f-6e70-46ce-a97e-7e51ffc0a4b9', '9eb35062-4abd-4317-bef2-7c61d3716f4a', 'b4aa9434-1b1b-41bb-bb0d-a13604d47bfe',
    -- iPad (30)
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
    -- Laptops (1)
    '57b10620-7b41-4ebe-9020-9f79d42bc84a',
    -- Video Consoles (10)
    'f4fc9f51-84ca-4661-a379-34aa567d868c', '7e7ba07a-adcc-4586-848a-b38b11238597', 'f9ea9e54-247a-48a6-9df9-39468bb3f0e7',
    'f5c0605b-e163-4b3d-bf1e-544c48311ce4', '3f2886b8-1716-4525-a712-d6c681a74a3b', 'e19cdf0a-1de7-456c-8644-f71f5fa6ff7e',
    '44f199ad-8c7a-46ba-8a20-90903ada7fd8', 'ee9dd812-2b16-4442-9ec0-54c6858bf537', 'c68b7f11-353c-4163-b04d-2ef7555ae271',
    '729d78b6-1534-458e-a741-c594a8a8f7d0'
  ]::uuid[]);

-- ----------------------------------------------------------------------------
-- 2. catalog_mode — generic replacement for is_tag_lens as a Website/DESK
--    decision input.
-- ----------------------------------------------------------------------------
alter table wholesale_equipment_types add column if not exists catalog_mode text not null default 'grouped';
alter table wholesale_equipment_types drop constraint if exists wholesale_equipment_types_catalog_mode_check;
alter table wholesale_equipment_types add constraint wholesale_equipment_types_catalog_mode_check
  check (catalog_mode in ('grouped', 'direct_services'));

update wholesale_equipment_types set
  catalog_mode = 'direct_services',
  is_tag_lens = false,
  source_mode = 'direct',
  source_tag_id = null,
  updated_at = now()
where slug = 'microsoldering'
  and (catalog_mode is distinct from 'direct_services' or is_tag_lens is distinct from false or source_mode is distinct from 'direct' or source_tag_id is not null);

-- ----------------------------------------------------------------------------
-- 3. name_es / description_en / description_es on wholesale_services —
--    generic, nullable, no data inserted.
-- ----------------------------------------------------------------------------
alter table wholesale_services add column if not exists name_es text;
alter table wholesale_services add column if not exists description_en text;
alter table wholesale_services add column if not exists description_es text;

-- ----------------------------------------------------------------------------
-- 4. Complete the "exactly one photo per owner" pattern for the service_id
--    ownership type wholesale_images already structurally supports.
-- ----------------------------------------------------------------------------
create unique index if not exists uq_wholesale_images_service
  on wholesale_images(service_id) where service_id is not null;

-- ----------------------------------------------------------------------------
-- 5. Restore MacBook: re-point its 2 existing categories back from 'laptops'
--    to 'macbook' (same category ids, same services, same price_history,
--    same tiers — nothing recreated), then reactivate + rename 'macbook'.
--    Guarded so a second run only touches rows that still need it.
-- ----------------------------------------------------------------------------
update wholesale_categories set equipment_type_id = (
  select id from wholesale_equipment_types where slug = 'macbook'
), updated_at = now()
where slug in ('macbook-air', 'macbook-pro')
  and equipment_type_id = (select id from wholesale_equipment_types where slug = 'laptops')
  and equipment_type_id is distinct from (select id from wholesale_equipment_types where slug = 'macbook');

update wholesale_equipment_types set
  active = true, name = 'MacBook', name_es = 'MacBook', updated_at = now()
where slug = 'macbook'
  and (active is distinct from true or name is distinct from 'MacBook' or name_es is distinct from 'MacBook');

-- Re-point 'laptops-gamer' onto 'laptops' from the separate, already-hidden
-- 'gaming-laptops' equipment type it has pointed at since the original
-- navigation migration's own backfill (see this file's header — real
-- pre-existing gap, found while building this fix). Same category id, same
-- services if any, nothing recreated.
update wholesale_categories set equipment_type_id = (
  select id from wholesale_equipment_types where slug = 'laptops'
), updated_at = now()
where slug = 'laptops-gamer'
  and equipment_type_id = (select id from wholesale_equipment_types where slug = 'gaming-laptops')
  and equipment_type_id is distinct from (select id from wholesale_equipment_types where slug = 'laptops');

-- ----------------------------------------------------------------------------
-- 6. Final visual order — 9 exterior cards, ONE atomic statement, same
--    collision-free technique as the prior migration's step 9.
-- ----------------------------------------------------------------------------
update wholesale_equipment_types t set
  sort_order = m.new_sort_order,
  updated_at = now()
from (values
  ('microsoldering',   1),
  ('iphone',           2),
  ('ipad',             3),
  ('macbook',          4),
  ('laptops',          5),
  ('ps5',              6),
  ('xbox-series-x',    7),
  ('switch',           8),
  ('controllers',      9),
  ('video-consoles', 101),
  ('gaming-laptops', 102)
) as m(slug, new_sort_order)
where t.slug = m.slug
  and t.sort_order is distinct from m.new_sort_order;

-- ----------------------------------------------------------------------------
-- 7. Delete RPC — drop the is_tag_lens-specific refusal branch. Deletion is
--    now governed only by "zero categories still point at this row", which
--    already composes correctly with catalog_mode='direct_services' (see
--    this file's own header) without any special case.
-- ----------------------------------------------------------------------------
create or replace function public.wholesale_delete_equipment_type(
  p_admin_id uuid, p_equipment_type_id uuid, p_confirm boolean
) returns text
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_exists boolean;
  v_category_count int;
  v_image_storage_path text;
begin
  if not exists (select 1 from public.profiles where id = p_admin_id and role = 'admin' and status = 'approved') then
    raise exception 'invalid_admin';
  end if;
  if p_confirm is distinct from true then
    raise exception 'confirmation_required';
  end if;

  select true into v_exists from wholesale_equipment_types where id = p_equipment_type_id for update;
  if v_exists is null then
    raise exception 'equipment_type_not_found';
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
