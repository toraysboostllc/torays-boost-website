-- ============================================================================
-- Read-only verification for wholesale-navigation-migration.sql
-- ============================================================================
-- Run this AFTER wholesale-navigation-migration.sql, in the Supabase SQL
-- Editor. Every statement here is a SELECT — nothing here writes, updates,
-- deletes, or alters anything. Safe to run as many times as you want, at
-- any point, forever.
--
-- This is the gate for the NOT NULL step described in
-- wholesale-navigation-migration.sql's closing comment: do not run
-- `alter table wholesale_categories alter column equipment_type_id set not
-- null` (that is a separate script, not included in this repo yet) until
-- query 1 below returns zero rows.
-- ============================================================================

-- 1. Any category still missing its equipment type? Must be EMPTY before the
--    column can safely become NOT NULL. If this returns rows, either the
--    backfill missed a slug (fix the migration and re-run it — it's
--    idempotent) or a brand-new category was created without one via DESK.
select id, slug, name, sort_order
from wholesale_categories
where equipment_type_id is null
order by sort_order;

-- 2. Sanity check: exactly 21 categories, exactly 74 services, exactly 8
--    equipment types (7 real + 1 tag-lens) — confirms nothing was
--    duplicated or lost by the migration.
select
  (select count(*) from wholesale_categories) as category_count,          -- expect 21
  (select count(*) from wholesale_services) as service_count,             -- expect 74
  (select count(*) from wholesale_equipment_types) as equipment_type_count, -- expect 8
  (select count(*) from wholesale_equipment_types where is_tag_lens) as tag_lens_count; -- expect 1

-- 3. Every category maps to exactly one equipment type — no category
--    silently mapped twice by two different UPDATE statements (would be
--    impossible given each slug appears once across the 21, but this is the
--    query that proves it rather than assumes it).
select equipment_type_id, count(*) as categories_mapped
from wholesale_categories
where equipment_type_id is not null
group by equipment_type_id
order by categories_mapped desc;

-- 4. Nothing this migration should never touch actually changed: prices,
--    active flags, slugs, sort_order, and notes on every category/service
--    should be byte-for-byte what they were before. This query alone can't
--    prove "unchanged over time" without a prior snapshot — pair it with a
--    manual diff against a pre-migration export if you want full confidence
--    — but it does confirm the *shape* nothing structural broke: every
--    price still satisfies the new pricing_type/value constraint.
select id, slug, pricing_type, fixed_price, price_min, price_max
from wholesale_services
where not (
  (pricing_type = 'fixed' and fixed_price is not null and price_min is null and price_max is null)
  or (pricing_type = 'range' and fixed_price is null and price_min is not null and price_max is not null)
  or (pricing_type = 'quote' and fixed_price is null and price_min is null and price_max is null)
);
-- expect ZERO rows — any row returned here is a service whose price shape
-- doesn't match its own pricing_type, which should be structurally
-- impossible given the CHECK constraint, so this is a belt-and-suspenders
-- check, not the primary guarantee.

-- 5. Which 8 equipment types exist, in what order, and how many categories/
--    services currently sit under each — a quick eyeball of the mapping
--    from section 5 of the plan doc, run against the real data.
select
  et.slug, et.name, et.is_tag_lens, et.sort_order, et.active,
  count(distinct c.id) as categories,
  count(s.id) filter (where s.id is not null) as services
from wholesale_equipment_types et
left join wholesale_categories c on c.equipment_type_id = et.id
left join wholesale_services s on s.category_id = c.id
group by et.id, et.slug, et.name, et.is_tag_lens, et.sort_order, et.active
order by et.sort_order;

-- 6. Every service's currency is exactly 'USD' — belt-and-suspenders, same
--    spirit as query 4: this should be structurally impossible given
--    wholesale_services_currency_check, so a row here means the constraint
--    itself is missing or broken, not that this query is the primary
--    guarantee.
select id, slug, currency
from wholesale_services
where currency is distinct from 'USD';
-- expect ZERO rows

-- 7. Every wholesale_images row has exactly one owner set — again
--    belt-and-suspenders alongside wholesale_images_exactly_one_owner: this
--    should be structurally impossible, so any row returned here means the
--    CHECK constraint is missing or was bypassed.
select id, equipment_type_id, category_id, service_id
from wholesale_images
where (
  (case when equipment_type_id is not null then 1 else 0 end
   + case when category_id is not null then 1 else 0 end
   + case when service_id is not null then 1 else 0 end)
) <> 1;
-- expect ZERO rows

-- 8. No service was ever accidentally left in — or converted to — 'quote'
--    by this migration. Nothing in wholesale-navigation-migration.sql ever
--    sets pricing_type on an existing row (the migration only widens the
--    CHECK constraint to allow 'quote' as an option for FUTURE admin edits
--    via the RPC; it never assigns it to any of the original rows), so this
--    must return zero rows immediately after the migration runs. A
--    non-zero result here later is not a migration bug — it means an admin
--    genuinely changed that service's pricing to "Consultar" through the
--    RPC (wholesale_update_service_price), which is expected/allowed from
--    that point on; this query is only meaningful as a BEFORE/AFTER-the-
--    migration check, not an ongoing invariant.
select id, slug, pricing_type
from wholesale_services
where pricing_type = 'quote';
-- expect ZERO rows immediately after this migration runs

-- 9. Every one of the 74 pre-existing services still has a price shape that
--    round-trips to the exact same displayed price as before this migration
--    (fixed -> "$X.XX", range -> "$min – $max"). This migration never runs
--    an UPDATE against fixed_price/price_min/price_max/pricing_type for any
--    existing row — the only new thing added to those rows is `currency`,
--    which nothing in the app renders yet (see
--    tests/wholesaleNavigationMigration.test.js's "74 real services convert
--    with zero visible price change" suite for the exhaustive, per-service
--    version of this check run against the actual seed data). This query is
--    the live-database equivalent: it should return exactly 74 rows, and
--    every `pricing_type` must still be 'fixed' or 'range' (never 'quote'),
--    matching query 8 above.
select id, slug, pricing_type, fixed_price, price_min, price_max, currency
from wholesale_services
order by slug;
-- expect exactly 74 rows, pricing_type only 'fixed' or 'range', currency = 'USD' on every row

-- 10. Categories checksum — byte-for-byte the SAME query as
--     wholesale-navigation-preflight.sql's query 6, run BEFORE this
--     migration. Compare the two hashes: identical means this migration
--     changed none of slug/name/notes/diagnostic_fee/diagnostic_description/
--     active/sort_order on any existing category — exactly what it promises.
select md5(string_agg(
  coalesce(slug, '␀') || '|' ||
  coalesce(name, '␀') || '|' ||
  coalesce(notes, '␀') || '|' ||
  coalesce(diagnostic_fee::text, '␀') || '|' ||
  coalesce(diagnostic_description, '␀') || '|' ||
  active::text || '|' ||
  sort_order::text,
  E'\n' order by slug
)) as categories_checksum
from wholesale_categories;

-- 11. Services checksum — byte-for-byte the SAME query as
--     wholesale-navigation-preflight.sql's query 7, run BEFORE this
--     migration. Compare the two hashes: identical means this migration
--     changed none of slug/category_id/name/pricing_type/fixed_price/
--     price_min/price_max/notes/active/sort_order on any existing service —
--     the only new thing any existing row gained is `currency`, which is
--     deliberately NOT part of this checksum (it never existed before this
--     migration, so a before/after diff of a field that didn't exist before
--     would be meaningless).
select md5(string_agg(
  coalesce(slug, '␀') || '|' ||
  coalesce(category_id::text, '␀') || '|' ||
  coalesce(name, '␀') || '|' ||
  coalesce(pricing_type, '␀') || '|' ||
  coalesce(fixed_price::text, '␀') || '|' ||
  coalesce(price_min::text, '␀') || '|' ||
  coalesce(price_max::text, '␀') || '|' ||
  coalesce(notes, '␀') || '|' ||
  active::text || '|' ||
  sort_order::text,
  E'\n' order by slug
)) as services_checksum
from wholesale_services;
