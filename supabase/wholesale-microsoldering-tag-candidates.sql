-- ============================================================================
-- Microsoldering tag candidates — read-only inspection query
-- ============================================================================
-- Purpose: help the owner decide, by hand, which currently active services
-- should be tagged 'microsoldering' so that check 14
-- (microsoldering_tagged_active_service_count) in
-- wholesale-dynamic-equipment-types-preflight.sql stops reporting STOP
-- (0 tagged active services, confirmed on a real Supabase run). This file
-- does NOT tag anything itself — it is pure SELECT, nothing else.
--
-- STRICTLY READ-ONLY: no insert/update/delete/alter/create/drop anywhere in
-- this file. Safe to run directly in the Supabase SQL Editor against
-- Production — it cannot change any data, on this table or any other.
--
-- Scope: every ACTIVE service (wholesale_services.active = true), regardless
-- of whether its category or equipment type happen to be active/visible
-- right now — visibility is reported as columns below, not used to filter
-- rows out, so nothing is hidden from this review.
--
-- Columns:
--   service_id                    — wholesale_services.id
--   service_name                  — wholesale_services.name
--   equipment_type                — the REAL owning equipment type's name
--                                    (via category.equipment_type_id), never
--                                    the Microsoldering tag-lens row itself —
--                                    a service belongs to its real device
--                                    category; Microsoldering is a lens over
--                                    tagged services, not a home for them.
--                                    NULL only in the defensive edge case of
--                                    a category with no equipment_type_id set
--                                    (not possible from DESK today, but not
--                                    enforced by a DB constraint either).
--   category                      — wholesale_categories.name
--   model_or_device_family        — NOTE: this schema has no separate
--                                    "model" column. The category itself IS
--                                    the model/device-family grouping (e.g.
--                                    'iPhone 15 / 16 / 17', 'MacBook Air',
--                                    'PS5 Slim') — the service name carries
--                                    the fault/repair type, not the model.
--                                    This column intentionally mirrors
--                                    `category` under the name asked for; it
--                                    is real data (category.name), not a
--                                    fabricated field — there is nothing
--                                    more granular to expose.
--   current_tags                  — every tag already on the service
--                                    (string_agg of wholesale_tags.name,
--                                    alphabetical), or '(none)' if untagged.
--   already_tagged_microsoldering — true if 'microsoldering' is already
--                                    among current_tags for this service.
--                                    Expected all false today (check 14's
--                                    STOP with tagged_active_service_count=0
--                                    already confirmed that on the real
--                                    database), kept here so a re-run after
--                                    a partial tagging pass is still useful.
--   service_active                — wholesale_services.active
--   category_active                — wholesale_categories.active
--   equipment_type_active          — wholesale_equipment_types.active
--   visible_on_portal              — service_active AND category_active AND
--                                    equipment_type_active, the exact same
--                                    three-table AND the real portal uses
--                                    (listActiveEquipmentTypes /
--                                    listActiveCatalog in
--                                    api/_lib/wholesaleDb.js each filter
--                                    active=eq.true independently) — not a
--                                    new/invented visibility rule.
--
-- Ordered by equipment type, then category, then service — sort_order first
-- (the real portal ordering), name second as a stable tiebreaker, exactly
-- the `order=sort_order.asc,name.asc` convention already used everywhere
-- else in api/_lib/wholesaleDb.js.
-- ============================================================================

select
  s.id as service_id,
  s.name as service_name,
  et.name as equipment_type,
  c.name as category,
  c.name as model_or_device_family,
  coalesce(
    (
      select string_agg(t.name, ', ' order by t.name)
      from wholesale_service_tags st
      join wholesale_tags t on t.id = st.tag_id
      where st.service_id = s.id
    ),
    '(none)'
  ) as current_tags,
  exists (
    select 1
    from wholesale_service_tags st
    join wholesale_tags t on t.id = st.tag_id
    where st.service_id = s.id and t.slug = 'microsoldering'
  ) as already_tagged_microsoldering,
  s.active as service_active,
  c.active as category_active,
  et.active as equipment_type_active,
  (s.active and coalesce(c.active, false) and coalesce(et.active, false)) as visible_on_portal
from wholesale_services s
join wholesale_categories c on c.id = s.category_id
left join wholesale_equipment_types et on et.id = c.equipment_type_id
where s.active = true
order by
  et.sort_order nulls last, et.name nulls last,
  c.sort_order, c.name,
  s.sort_order, s.name;
