-- ============================================================================
-- Dynamic Equipment Type cards — run AFTER
-- wholesale-dynamic-equipment-types-preflight.sql reports OVERALL STATUS
-- PASS (or every REVIEW REQUIRED row has been read and confirmed correct).
-- ============================================================================
-- Two independent things happen in this one migration:
--
--   1. Three new columns on wholesale_equipment_types make every home card's
--      presentation fully DESK-administrable: `name_es` (Spanish display
--      name), `image_focus_x`/`image_focus_y` (normalized 0-100 crop-focus
--      point — NOT a raw CSS string; DESK's admin UI presents this as a 3x3
--      visual grid or a drag control, never a text field an admin types CSS
--      into), and `full_bleed_photo` (edge-to-edge photo treatment on/off).
--
--   2. PlayStation 5, Xbox Series X, and Nintendo Switch/Switch OLED move
--      from being wholesale_categories rows nested under a "Video Consoles"
--      equipment type into being real, independent wholesale_equipment_types
--      rows of their own — permanently eliminating the need for the
--      Website's client-side PROMOTED_CATEGORY_SLUGS hack, rather than
--      making that hack data-driven. See the mapping table below.
--
-- CATEGORY -> EQUIPMENT TYPE MAPPING (explicit, per requirement):
--   wholesale_categories row untouched (same id, same slug, same services,
--   same price_history) — only its equipment_type_id FK is repointed:
--
--     categories.slug = 'ps5'           : video-consoles -> NEW equipment_types row, slug 'ps5'
--     categories.slug = 'xbox-series-x' : video-consoles -> NEW equipment_types row, slug 'xbox-series-x'
--     categories.slug = 'switch'        : video-consoles -> NEW equipment_types row, slug 'switch'
--
--   Nothing else moves. No service is duplicated, re-created, or re-parented
--   — every wholesale_services row keeps the exact same category_id it had
--   before this migration; every wholesale_price_history row keeps the exact
--   same service_id. Only the CATEGORY's own parent (equipment_type_id)
--   changes, once, for exactly these 3 rows.
--
-- CUTOVER SAFETY (requirement: zero window with duplicate or missing cards):
-- This migration does NOT by itself create a duplicate-card risk against the
-- CURRENT (pre-this-change) Website code — verified by hand-tracing
-- buildWholesaleWizardCatalog's promotion logic against the post-migration
-- schema: old code, run against the new schema, still shows the promoted
-- categories exactly once each (now via the "promoted" branch reading a
-- single-category equipment type instead of a multi-category one — the
-- OUTPUT card is identical either way, same id, same image-fallback
-- behavior). The one real risk is the OPPOSITE order: NEW Website code (with
-- the promotion hack already removed) deployed BEFORE this migration has run
-- would make PS5/Xbox/Switch vanish (nested, unreachable, under a still-
-- undifferentiated Video Consoles equipment type). The Website-side change
-- accompanying this migration therefore ships a backward-compatible bridge
-- (see wholesaleWizardCatalog.js's own header comment) that deduplicates by
-- slug against whatever equipment types the API actually returns, so BOTH
-- deployment orders converge to the same correct 8-card view — this
-- migration is safe to run before, after, or interleaved with that Website
-- deploy. It is NOT safe to run before/without ever deploying that Website
-- change at all (old code + old schema is the only combination this
-- migration doesn't need to reason about, since neither side has changed).
--
-- Idempotent: column adds use "if not exists", the 3 new equipment-type rows
-- use "on conflict (slug) do nothing", every UPDATE has a guard clause that
-- makes a second run a no-op, and the 2 new functions are CREATE OR REPLACE.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Three new columns on wholesale_equipment_types.
-- ----------------------------------------------------------------------------
alter table wholesale_equipment_types add column if not exists name_es text;
-- Nullable on purpose — null/empty means "no Spanish name entered in DESK
-- yet, show the English name" (see wholesaleCatalogI18n.js's own existing
-- "lookup miss degrades to English, never blank" contract; this is the same
-- contract moved onto the row). NOT sourced from, and does not replace, the
-- existing hardcoded translation dictionary for the 5 equipment types that
-- already have entries there — that dictionary keeps working as a fallback
-- for those 5 until someone fills in name_es for them too; this column only
-- matters immediately for brand-new/renamed cards going forward.

alter table wholesale_equipment_types add column if not exists image_focus_x numeric(5, 2) not null default 50.00;
alter table wholesale_equipment_types add column if not exists image_focus_y numeric(5, 2) not null default 50.00;
alter table wholesale_equipment_types drop constraint if exists wholesale_equipment_types_image_focus_x_check;
alter table wholesale_equipment_types add constraint wholesale_equipment_types_image_focus_x_check
  check (image_focus_x >= 0 and image_focus_x <= 100);
alter table wholesale_equipment_types drop constraint if exists wholesale_equipment_types_image_focus_y_check;
alter table wholesale_equipment_types add constraint wholesale_equipment_types_image_focus_y_check
  check (image_focus_y >= 0 and image_focus_y <= 100);
-- Normalized percentage along each axis (0 = left/top, 50 = center,
-- 100 = right/bottom), NEVER a raw CSS string — DESK's admin UI is a visual
-- 3x3 grid (or drag control); this is the one and only reason these are two
-- bounded numerics instead of a single free-text object-position column. The
-- Website composes `${x}% ${y}%` at render time; there is no path for an
-- admin (or anyone) to inject arbitrary CSS through this pair of numbers.

alter table wholesale_equipment_types add column if not exists full_bleed_photo boolean not null default false;
-- Replaces the WHOLESALE_FULL_BLEED_PHOTO_SLUGS constant that used to live
-- in EquipmentTypeCard.jsx. Only takes visible effect when the card also has
-- an active photo (same "no photo -> icon fallback, never a broken full-
-- bleed card" gate EquipmentTypeCard.jsx already applies today) -- toggling
-- this on before a photo is uploaded is a harmless no-op.

-- ----------------------------------------------------------------------------
-- 2. Three new equipment_types rows — PlayStation 5, Xbox Series X, Nintendo
--    Switch/Switch OLED. is_tag_lens is always false (these are ordinary
--    equipment types, not a lens card like Microsoldering). Spanish name is
--    the same as the English name for all 3 — these are brand names,
--    identical in both languages by design, not a missing-translation gap.
--    sort_order set to a temporary placeholder here; the real final order
--    for all 8 cards is assigned explicitly in step 4 below, in one place,
--    so the "visual order" requirement has exactly one source of truth in
--    this file rather than being implied by insertion order.
-- ----------------------------------------------------------------------------
insert into wholesale_equipment_types (slug, name, name_es, is_tag_lens, active, sort_order) values
  ('ps5', 'PlayStation 5', 'PlayStation 5', false, true, 900),
  ('xbox-series-x', 'Xbox Series X', 'Xbox Series X', false, true, 901),
  ('switch', 'Nintendo Switch / Switch OLED', 'Nintendo Switch / Switch OLED', false, true, 902)
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- 3. Re-point the 3 EXISTING category rows to their new equipment type. Same
--    category id, same slug, same services, same price_history — nothing
--    recreated. Guarded so a second run only touches rows that still need
--    it (idempotent).
-- ----------------------------------------------------------------------------
update wholesale_categories set equipment_type_id = (
  select id from wholesale_equipment_types where slug = wholesale_categories.slug and is_tag_lens = false
), updated_at = now()
where wholesale_categories.slug in ('ps5', 'xbox-series-x', 'switch')
  and equipment_type_id is distinct from (
    select id from wholesale_equipment_types where slug = wholesale_categories.slug and is_tag_lens = false
  );

-- ----------------------------------------------------------------------------
-- 4. Re-own any EXISTING category-level photo for these 3 to the new
--    equipment-type-level slot, so an already-uploaded photo (if any) is
--    preserved rather than orphaned. No-op if none exists yet (expected —
--    per current operational state, only Microsoldering has a photo
--    uploaded so far, and PS5's photo is prepared but not yet uploaded).
-- ----------------------------------------------------------------------------
update wholesale_images set
  equipment_type_id = c.equipment_type_id,
  category_id = null
from wholesale_categories c
where wholesale_images.category_id = c.id
  and c.slug in ('ps5', 'xbox-series-x', 'switch');

-- ----------------------------------------------------------------------------
-- 5. Explicit final sort_order for the full, exact requested visual order —
--    the single source of truth for card position, independent of whatever
--    each row's sort_order happened to be before this migration. Safe to
--    re-run (plain idempotent assignment, not a relative swap). A slug that
--    doesn't match any row is simply a no-op UPDATE (0 rows affected), never
--    an error — see the preflight's check 8 for confirming these slugs
--    match your actual seeded data before relying on this step.
-- ----------------------------------------------------------------------------
update wholesale_equipment_types set sort_order = 1, updated_at = now() where slug = 'microsoldering';
update wholesale_equipment_types set sort_order = 2, updated_at = now() where slug = 'iphone';
update wholesale_equipment_types set sort_order = 3, updated_at = now() where slug = 'ipad';
update wholesale_equipment_types set sort_order = 4, updated_at = now() where slug = 'gaming-laptops';
update wholesale_equipment_types set sort_order = 5, updated_at = now() where slug = 'ps5';
update wholesale_equipment_types set sort_order = 6, updated_at = now() where slug = 'xbox-series-x';
update wholesale_equipment_types set sort_order = 7, updated_at = now() where slug = 'switch';
update wholesale_equipment_types set sort_order = 8, updated_at = now() where slug = 'controllers';

-- ----------------------------------------------------------------------------
-- 6. Hide "Video Consoles" if (and only if) it now has zero categories left.
--    Never deleted — same "hide, don't delete" posture as everywhere else in
--    this schema. Guarded by NOT EXISTS so this is safe to re-run, and safe
--    even if Video Consoles unexpectedly still has other categories (it
--    simply stays active in that case, matching preflight check 6's
--    warning).
-- ----------------------------------------------------------------------------
update wholesale_equipment_types set active = false, updated_at = now()
where slug = 'video-consoles'
  and not exists (
    select 1 from wholesale_categories where equipment_type_id = wholesale_equipment_types.id
  );

-- ----------------------------------------------------------------------------
-- 7. Atomic reorder RPC — replaces the existing swapSortOrder() two-PATCH
--    pattern (two independent, non-transactional REST calls) for equipment
--    types specifically. One transaction, row-locked, real atomicity.
-- ----------------------------------------------------------------------------
create or replace function public.wholesale_swap_equipment_type_sort_order(
  p_admin_id uuid, p_id_a uuid, p_id_b uuid
) returns void
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_sort_a int;
  v_sort_b int;
begin
  if not exists (select 1 from public.profiles where id = p_admin_id and role = 'admin' and status = 'approved') then
    raise exception 'invalid_admin';
  end if;
  if p_id_a is null or p_id_b is null or p_id_a = p_id_b then
    raise exception 'invalid_ids';
  end if;

  select sort_order into v_sort_a from wholesale_equipment_types where id = p_id_a for update;
  select sort_order into v_sort_b from wholesale_equipment_types where id = p_id_b for update;
  if v_sort_a is null or v_sort_b is null then
    raise exception 'equipment_type_not_found';
  end if;

  update wholesale_equipment_types set sort_order = v_sort_b, updated_at = now() where id = p_id_a;
  update wholesale_equipment_types set sort_order = v_sort_a, updated_at = now() where id = p_id_b;
end;
$$;
revoke execute on function public.wholesale_swap_equipment_type_sort_order(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.wholesale_swap_equipment_type_sort_order(uuid, uuid, uuid) to service_role;

-- ----------------------------------------------------------------------------
-- 8. Delete RPC — real deletion, but only for a genuinely empty equipment
--    type, and only with an explicit confirmation flag. "Related data
--    exists" is answered by exactly one question: does ANY wholesale_
--    categories row still point at this equipment type? If yes, refuse --
--    every service, price, tier, and price_history row hangs off a category,
--    so "zero categories" is both necessary AND sufficient proof nothing
--    downstream would be silently destroyed (a category can never itself be
--    deleted out from under a service with price_history either --
--    wholesale_price_history.service_id is ON DELETE RESTRICT, so a cascade
--    delete of a non-empty category would already fail loudly on its own,
--    but this RPC never even attempts a cascade -- it refuses up front).
--    A tag-lens row (Microsoldering) can never be deleted through this RPC
--    at all, regardless of confirmation, since it is not something DESK's
--    "create new card" flow can produce and losing it would break the whole
--    tag-lens navigation path. Returns the deleted photo's storage_path (or
--    an empty string) so the CALLER can also delete the actual Storage
--    object -- this function only touches the database row, never Storage
--    directly.
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
