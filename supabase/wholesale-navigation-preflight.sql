-- ============================================================================
-- Preflight — read-only sanity check, run BEFORE wholesale-navigation-migration.sql
-- ============================================================================
-- Every statement below is a SELECT. This file never inserts, updates,
-- deletes, alters, creates, or drops anything, and never calls any RPC or
-- stored function (wholesale_update_service_price, wholesale_regenerate_
-- shop_code, or otherwise). Built-in SQL functions used INSIDE a SELECT's
-- expression list — count(), coalesce(), md5(), string_agg() — are ordinary
-- read-only expression evaluation, not a write and not a call to anything
-- this project defines; that distinction is what "no function" means here.
--
-- Order of operations:
--   1. Run this file. Read the results against the "expect ..." comments.
--   2. Only if everything matches, run wholesale-navigation-migration.sql.
--   3. Run wholesale-navigation-verify.sql. Its final section repeats the
--      exact same two checksum queries as sections 6-7 below — diff those
--      two hashes against what THIS file printed. Identical hashes prove
--      the migration didn't alter a single category/service field it
--      promised not to touch; the migration is additive-only (new columns,
--      new tables, a new equipment_type_id relation) so an unchanged
--      checksum is the expected, passing outcome, not a coincidence.
--
-- Deliberately never read or shown by any query in this file:
-- wholesale_shops.code_hash, wholesale_devices.device_token_hash,
-- wholesale_sessions.session_token_hash, any cookie value, any API/service-
-- role key, and any shop name or other shop-identifying data. The 4
-- auth-related tables (wholesale_shops, wholesale_devices,
-- wholesale_sessions, wholesale_access_log) are touched only via
-- `count(*)` below — never a single column of their actual row data.
-- ============================================================================

-- 1. Core counts against the exact numbers this migration assumes.
select
  (select count(*) from wholesale_categories) as category_count,                     -- expect 21
  (select count(*) from wholesale_services) as service_count,                        -- expect 74
  (select count(*) from wholesale_categories where active) as active_category_count, -- expect 1
  (select count(*) from wholesale_services where active) as active_service_count;    -- expect 0

-- 2. Row counts ONLY (never row data) for the auth-related tables this
--    migration does not touch — confirms nothing here is unexpectedly
--    empty, without ever reading a name, a hash, an IP, or any other
--    shop-identifying value.
select
  (select count(*) from wholesale_shops) as shop_count,
  (select count(*) from wholesale_devices) as device_count,
  (select count(*) from wholesale_sessions) as session_count,
  (select count(*) from wholesale_access_log) as access_log_count;

-- 3. Duplicate or null category slugs — must be empty. The migration's
--    backfill (wholesale-navigation-migration.sql) matches categories to
--    their equipment type BY slug; a duplicate or null slug here means the
--    backfill could silently map the wrong row, or miss one entirely.
select slug, count(*) as occurrences
from wholesale_categories
group by slug
having slug is null or count(*) > 1;
-- expect ZERO rows

-- 4. Duplicate or null service slugs — same reasoning as query 3, this time
--    for the price-history/RPC layer instead of the equipment-type backfill
--    (the RPC identifies a service by id, not slug, but a duplicate/null
--    slug here would still mean the catalog data itself is corrupt).
select slug, count(*) as occurrences
from wholesale_services
group by slug
having slug is null or count(*) > 1;
-- expect ZERO rows

-- 5. Services whose stored price shape doesn't match their own pricing_type
--    — should be structurally impossible today (the ORIGINAL migration's
--    CHECK only allows 'fixed'/'range', and only application code writes
--    here), but this is the belt-and-suspenders confirmation BEFORE the
--    navigation migration widens that constraint to also allow 'quote'.
select id, slug, pricing_type, fixed_price, price_min, price_max
from wholesale_services
where not (
  (pricing_type = 'fixed' and fixed_price is not null and price_min is null and price_max is null)
  or (pricing_type = 'range' and fixed_price is null and price_min is not null and price_max is not null)
);
-- expect ZERO rows

-- 6. Categories checksum — one stable hash over every field this migration
--    promises never to change (slug, name, notes, diagnostic_fee,
--    diagnostic_description, active, sort_order), ordered deterministically
--    by slug so the same data always produces the same hash regardless of
--    physical row storage order. NULLs get an explicit sentinel ('␀') so a
--    real NULL can never be confused with a legitimate empty string. This
--    is a change-detection checksum, not a cryptographic one — its only job
--    is "did any of these fields move" between two points in time.
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

-- 7. Services checksum — same idea, over every field this migration
--    promises never to change: slug, category_id, name, pricing_type,
--    fixed_price, price_min, price_max, notes, active, sort_order.
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
