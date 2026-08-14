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

-- ============================================================================
-- 8. PRE-FLIGHT SUMMARY — one row, every check above collapsed into it, so
--    running the whole preflight by hand is "run this file, read one row"
--    instead of scrolling through 7 separate result sets. Built with CTEs
--    (a WITH clause) — still a single SELECT statement, not a stored
--    function or a PL/pgSQL block; every CTE below is itself just a SELECT.
--    Shows the exact same 13 fields as queries 1-7 above, nothing new and
--    nothing sensitive: no shop name, no code, no hash, no token, no IP, no
--    user-agent — the 4 auth-related tables are still touched only via
--    count(*), exactly as in query 2.
--
--    overall_status is 'PASS' only when EVERY one of these holds:
--      category_count = 21, service_count = 74, active_category_count = 1,
--      active_service_count = 0, invalid_category_slug_count = 0,
--      invalid_service_slug_count = 0, invalid_price_count = 0.
--    Any other combination — including a count that's simply different from
--    expected, not just "invalid" — reports 'FAIL', so a single glance at
--    this one row is enough to decide whether it's safe to proceed to
--    wholesale-navigation-migration.sql.
-- ============================================================================
with counts as (
  select
    (select count(*) from wholesale_categories) as category_count,
    (select count(*) from wholesale_services) as service_count,
    (select count(*) from wholesale_categories where active) as active_category_count,
    (select count(*) from wholesale_services where active) as active_service_count,
    (select count(*) from wholesale_shops) as shop_count,
    (select count(*) from wholesale_devices) as device_count,
    (select count(*) from wholesale_sessions) as session_count,
    (select count(*) from wholesale_access_log) as access_log_count
),
invalid_category_slugs as (
  select count(*) as n from (
    select slug from wholesale_categories group by slug having slug is null or count(*) > 1
  ) x
),
invalid_service_slugs as (
  select count(*) as n from (
    select slug from wholesale_services group by slug having slug is null or count(*) > 1
  ) x
),
invalid_prices as (
  -- Pre-migration shape check: today pricing_type can only be 'fixed' or
  -- 'range' (the CHECK constraint this migration widens to also allow
  -- 'quote' has not run yet) — matches query 5 above exactly.
  select count(*) as n from wholesale_services
  where not (
    (pricing_type = 'fixed' and fixed_price is not null and price_min is null and price_max is null)
    or (pricing_type = 'range' and fixed_price is null and price_min is not null and price_max is not null)
  )
),
category_checksum as (
  select md5(string_agg(
    coalesce(slug, '␀') || '|' ||
    coalesce(name, '␀') || '|' ||
    coalesce(notes, '␀') || '|' ||
    coalesce(diagnostic_fee::text, '␀') || '|' ||
    coalesce(diagnostic_description, '␀') || '|' ||
    active::text || '|' ||
    sort_order::text,
    E'\n' order by slug
  )) as checksum
  from wholesale_categories
),
service_checksum as (
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
  )) as checksum
  from wholesale_services
)
select
  counts.category_count,
  counts.service_count,
  counts.active_category_count,
  counts.active_service_count,
  counts.shop_count,
  counts.device_count,
  counts.session_count,
  counts.access_log_count,
  invalid_category_slugs.n as invalid_category_slug_count,
  invalid_service_slugs.n as invalid_service_slug_count,
  invalid_prices.n as invalid_price_count,
  category_checksum.checksum as category_checksum,
  service_checksum.checksum as service_checksum,
  case
    when counts.category_count = 21
     and counts.service_count = 74
     and counts.active_category_count = 1
     and counts.active_service_count = 0
     and invalid_category_slugs.n = 0
     and invalid_service_slugs.n = 0
     and invalid_prices.n = 0
    then 'PASS'
    else 'FAIL'
  end as overall_status
from counts, invalid_category_slugs, invalid_service_slugs, invalid_prices, category_checksum, service_checksum;
