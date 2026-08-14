-- ============================================================================
-- Initial wholesale catalog — GENERATED, do not edit by hand.
-- Source of truth: scripts/wholesaleCatalogSeed.data.js
-- Regenerate with: node scripts/generate-wholesale-seed-sql.mjs
--
-- Run this in the Supabase SQL Editor immediately after wholesale-migration.sql.
-- This is the ONLY way the initial catalog gets loaded — no script, no Service
-- Role Key typed into a terminal, nothing to end up in shell history.
--
-- Idempotent: every insert uses ON CONFLICT (slug) DO NOTHING, matched against
-- the stable `slug` column — safe to run more than once, and never overwrites a
-- row already edited from TORAYS BOOST DESK.
-- Wrapped in BEGIN/COMMIT: if anything below fails, Postgres rolls back the whole
-- file, never a half-loaded catalog.
-- Everything is created inactive; review and activate from DESK.
-- ============================================================================

begin;

-- iPhone 7 / 8 / X / XR / XS / XS Max / 11 / 11 Pro / 11 Pro Max
insert into wholesale_categories (slug, name, notes, diagnostic_fee, diagnostic_description, active, sort_order)
values ('iphone-7-11', 'iPhone 7 / 8 / X / XR / XS / XS Max / 11 / 11 Pro / 11 Pro Max', null, null, 'The diagnostic fee covers the technician time needed to inspect, test, and identify the fault.', false, 1)
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'iphone-7-11__no-power', id, 'No Power', 'range', null, 70, 90, null, false, 0
from wholesale_categories where slug = 'iphone-7-11'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'iphone-7-11__boot-loop', id, 'Boot Loop', 'range', null, 70, 90, null, false, 1
from wholesale_categories where slug = 'iphone-7-11'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'iphone-7-11__no-charge-board', id, 'No Charge – Board Repair', 'range', null, 70, 90, null, false, 2
from wholesale_categories where slug = 'iphone-7-11'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'iphone-7-11__no-wifi-bt-board', id, 'No Wi-Fi / Bluetooth – Board Repair', 'fixed', 80, null, null, null, false, 3
from wholesale_categories where slug = 'iphone-7-11'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'iphone-7-11__save-data-recovery', id, 'Save Phone + Data Recovery', 'fixed', 180, null, null, null, false, 4
from wholesale_categories where slug = 'iphone-7-11'
on conflict (slug) do nothing;

-- iPhone 12 / 13 / 14
insert into wholesale_categories (slug, name, notes, diagnostic_fee, diagnostic_description, active, sort_order)
values ('iphone-12-14', 'iPhone 12 / 13 / 14', null, null, 'The diagnostic fee covers the technician time needed to inspect, test, and identify the fault.', false, 2)
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'iphone-12-14__no-power', id, 'No Power', 'range', null, 90, 120, null, false, 0
from wholesale_categories where slug = 'iphone-12-14'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'iphone-12-14__boot-loop', id, 'Boot Loop', 'fixed', 100, null, null, null, false, 1
from wholesale_categories where slug = 'iphone-12-14'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'iphone-12-14__no-charge-board', id, 'No Charge – Board Repair', 'fixed', 100, null, null, null, false, 2
from wholesale_categories where slug = 'iphone-12-14'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'iphone-12-14__no-wifi-bt-board', id, 'No Wi-Fi / Bluetooth – Board Repair', 'fixed', 100, null, null, null, false, 3
from wholesale_categories where slug = 'iphone-12-14'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'iphone-12-14__save-data-recovery', id, 'Save Phone + Data Recovery', 'fixed', 180, null, null, null, false, 4
from wholesale_categories where slug = 'iphone-12-14'
on conflict (slug) do nothing;

-- iPhone 15 / 16 / 17
insert into wholesale_categories (slug, name, notes, diagnostic_fee, diagnostic_description, active, sort_order)
values ('iphone-15-17', 'iPhone 15 / 16 / 17', 'ATA / Level 3 Repair', null, 'The diagnostic fee covers the technician time needed to inspect, test, and identify the fault.', false, 3)
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'iphone-15-17__no-power', id, 'No Power', 'fixed', 150, null, null, null, false, 0
from wholesale_categories where slug = 'iphone-15-17'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'iphone-15-17__boot-loop', id, 'Boot Loop', 'fixed', 150, null, null, null, false, 1
from wholesale_categories where slug = 'iphone-15-17'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'iphone-15-17__no-charge-board', id, 'No Charge – Board Repair', 'fixed', 150, null, null, null, false, 2
from wholesale_categories where slug = 'iphone-15-17'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'iphone-15-17__no-wifi-bt-board', id, 'No Wi-Fi / Bluetooth – Board Repair', 'fixed', 160, null, null, null, false, 3
from wholesale_categories where slug = 'iphone-15-17'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'iphone-15-17__save-data-recovery', id, 'Save Phone + Data Recovery', 'range', null, 200, 250, null, false, 4
from wholesale_categories where slug = 'iphone-15-17'
on conflict (slug) do nothing;

-- iPad 7th / 8th / 9th Generation
insert into wholesale_categories (slug, name, notes, diagnostic_fee, diagnostic_description, active, sort_order)
values ('ipad-7-8-9', 'iPad 7th / 8th / 9th Generation', null, null, 'The diagnostic fee covers the technician time needed to inspect, test, and identify the fault.', false, 4)
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ipad-7-8-9__charging-port', id, 'Charging Port Replacement', 'fixed', 55, null, null, null, false, 0
from wholesale_categories where slug = 'ipad-7-8-9'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ipad-7-8-9__charging-ic', id, 'Charging IC Replacement', 'fixed', 60, null, null, null, false, 1
from wholesale_categories where slug = 'ipad-7-8-9'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ipad-7-8-9__backlight', id, 'Backlight Repair', 'fixed', 50, null, null, null, false, 2
from wholesale_categories where slug = 'ipad-7-8-9'
on conflict (slug) do nothing;

-- iPad 10th Generation
insert into wholesale_categories (slug, name, notes, diagnostic_fee, diagnostic_description, active, sort_order)
values ('ipad-10', 'iPad 10th Generation', null, null, 'The diagnostic fee covers the technician time needed to inspect, test, and identify the fault.', false, 5)
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ipad-10__charging-port', id, 'Charging Port Replacement', 'fixed', 75, null, null, null, false, 0
from wholesale_categories where slug = 'ipad-10'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ipad-10__no-power', id, 'No Power', 'range', null, 90, 120, null, false, 1
from wholesale_categories where slug = 'ipad-10'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ipad-10__no-wifi-bt-board', id, 'No Wi-Fi / Bluetooth – Board Repair', 'fixed', 100, null, null, null, false, 2
from wholesale_categories where slug = 'ipad-10'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ipad-10__backlight', id, 'Backlight Repair', 'fixed', 75, null, null, null, false, 3
from wholesale_categories where slug = 'ipad-10'
on conflict (slug) do nothing;

-- iPad 11th Generation
insert into wholesale_categories (slug, name, notes, diagnostic_fee, diagnostic_description, active, sort_order)
values ('ipad-11', 'iPad 11th Generation', null, null, 'The diagnostic fee covers the technician time needed to inspect, test, and identify the fault.', false, 6)
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ipad-11__charging-ic-no-charge', id, 'Charging IC / No Charge (IC-caused)', 'fixed', 150, null, null, null, false, 0
from wholesale_categories where slug = 'ipad-11'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ipad-11__no-power', id, 'No Power', 'fixed', 90, null, null, 'Applies when diagnostics confirm the fault is NOT the Charging IC. If the Charging IC is the cause, the price is $150.', false, 1
from wholesale_categories where slug = 'ipad-11'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ipad-11__no-wifi-bt-board', id, 'No Wi-Fi / Bluetooth – Board Repair', 'fixed', 100, null, null, null, false, 2
from wholesale_categories where slug = 'ipad-11'
on conflict (slug) do nothing;

-- iPad Pro 11" — 1st, 2nd & 3rd Generation
insert into wholesale_categories (slug, name, notes, diagnostic_fee, diagnostic_description, active, sort_order)
values ('ipad-pro-11-123', 'iPad Pro 11" — 1st, 2nd & 3rd Generation', null, null, 'The diagnostic fee covers the technician time needed to inspect, test, and identify the fault.', false, 7)
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ipad-pro-11-123__no-power', id, 'No Power', 'fixed', 85, null, null, null, false, 0
from wholesale_categories where slug = 'ipad-pro-11-123'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ipad-pro-11-123__boot-loop', id, 'Boot Loop', 'fixed', 85, null, null, null, false, 1
from wholesale_categories where slug = 'ipad-pro-11-123'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ipad-pro-11-123__no-charge-board', id, 'No Charge – Board Repair', 'fixed', 85, null, null, null, false, 2
from wholesale_categories where slug = 'ipad-pro-11-123'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ipad-pro-11-123__no-wifi-bt-board', id, 'No Wi-Fi / Bluetooth – Board Repair', 'fixed', 95, null, null, null, false, 3
from wholesale_categories where slug = 'ipad-pro-11-123'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ipad-pro-11-123__save-data-recovery', id, 'Save Device + Data Recovery', 'fixed', 165, null, null, null, false, 4
from wholesale_categories where slug = 'ipad-pro-11-123'
on conflict (slug) do nothing;

-- iPad Pro 12.9" — 1st, 2nd & 3rd Generation
insert into wholesale_categories (slug, name, notes, diagnostic_fee, diagnostic_description, active, sort_order)
values ('ipad-pro-129-123', 'iPad Pro 12.9" — 1st, 2nd & 3rd Generation', null, null, 'The diagnostic fee covers the technician time needed to inspect, test, and identify the fault.', false, 8)
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ipad-pro-129-123__no-power', id, 'No Power', 'fixed', 85, null, null, null, false, 0
from wholesale_categories where slug = 'ipad-pro-129-123'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ipad-pro-129-123__boot-loop', id, 'Boot Loop', 'fixed', 85, null, null, null, false, 1
from wholesale_categories where slug = 'ipad-pro-129-123'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ipad-pro-129-123__no-charge-board', id, 'No Charge – Board Repair', 'fixed', 85, null, null, null, false, 2
from wholesale_categories where slug = 'ipad-pro-129-123'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ipad-pro-129-123__no-wifi-bt-board', id, 'No Wi-Fi / Bluetooth – Board Repair', 'fixed', 95, null, null, null, false, 3
from wholesale_categories where slug = 'ipad-pro-129-123'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ipad-pro-129-123__save-data-recovery', id, 'Save Device + Data Recovery', 'fixed', 165, null, null, null, false, 4
from wholesale_categories where slug = 'ipad-pro-129-123'
on conflict (slug) do nothing;

-- iPad Pro 11" — 4th Generation & Newer
insert into wholesale_categories (slug, name, notes, diagnostic_fee, diagnostic_description, active, sort_order)
values ('ipad-pro-11-4plus', 'iPad Pro 11" — 4th Generation & Newer', null, null, 'The diagnostic fee covers the technician time needed to inspect, test, and identify the fault.', false, 9)
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ipad-pro-11-4plus__no-power', id, 'No Power', 'fixed', 100, null, null, null, false, 0
from wholesale_categories where slug = 'ipad-pro-11-4plus'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ipad-pro-11-4plus__boot-loop', id, 'Boot Loop', 'fixed', 100, null, null, null, false, 1
from wholesale_categories where slug = 'ipad-pro-11-4plus'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ipad-pro-11-4plus__no-charge-board', id, 'No Charge – Board Repair', 'fixed', 100, null, null, null, false, 2
from wholesale_categories where slug = 'ipad-pro-11-4plus'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ipad-pro-11-4plus__no-wifi-bt-board', id, 'No Wi-Fi / Bluetooth – Board Repair', 'fixed', 110, null, null, null, false, 3
from wholesale_categories where slug = 'ipad-pro-11-4plus'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ipad-pro-11-4plus__save-data-recovery', id, 'Save Device + Data Recovery', 'fixed', 180, null, null, null, false, 4
from wholesale_categories where slug = 'ipad-pro-11-4plus'
on conflict (slug) do nothing;

-- iPad Pro 12.9" — 4th Generation & Newer
insert into wholesale_categories (slug, name, notes, diagnostic_fee, diagnostic_description, active, sort_order)
values ('ipad-pro-129-4plus', 'iPad Pro 12.9" — 4th Generation & Newer', null, null, 'The diagnostic fee covers the technician time needed to inspect, test, and identify the fault.', false, 10)
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ipad-pro-129-4plus__no-power', id, 'No Power', 'fixed', 100, null, null, null, false, 0
from wholesale_categories where slug = 'ipad-pro-129-4plus'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ipad-pro-129-4plus__boot-loop', id, 'Boot Loop', 'fixed', 100, null, null, null, false, 1
from wholesale_categories where slug = 'ipad-pro-129-4plus'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ipad-pro-129-4plus__no-charge-board', id, 'No Charge – Board Repair', 'fixed', 100, null, null, null, false, 2
from wholesale_categories where slug = 'ipad-pro-129-4plus'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ipad-pro-129-4plus__no-wifi-bt-board', id, 'No Wi-Fi / Bluetooth – Board Repair', 'fixed', 110, null, null, null, false, 3
from wholesale_categories where slug = 'ipad-pro-129-4plus'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ipad-pro-129-4plus__save-data-recovery', id, 'Save Device + Data Recovery', 'fixed', 180, null, null, null, false, 4
from wholesale_categories where slug = 'ipad-pro-129-4plus'
on conflict (slug) do nothing;

-- MacBook Air
insert into wholesale_categories (slug, name, notes, diagnostic_fee, diagnostic_description, active, sort_order)
values ('macbook-air', 'MacBook Air', null, null, 'The diagnostic fee covers the technician time needed to inspect, test, and identify the fault.', false, 11)
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'macbook-air__board-repair', id, 'Board Repair', 'range', null, 100, 120, null, false, 0
from wholesale_categories where slug = 'macbook-air'
on conflict (slug) do nothing;

-- MacBook Pro
insert into wholesale_categories (slug, name, notes, diagnostic_fee, diagnostic_description, active, sort_order)
values ('macbook-pro', 'MacBook Pro', null, null, 'The diagnostic fee covers the technician time needed to inspect, test, and identify the fault.', false, 12)
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'macbook-pro__board-repair', id, 'Board Repair', 'range', null, 120, 180, null, false, 0
from wholesale_categories where slug = 'macbook-pro'
on conflict (slug) do nothing;

-- PlayStation 5
insert into wholesale_categories (slug, name, notes, diagnostic_fee, diagnostic_description, active, sort_order)
values ('ps5', 'PlayStation 5', null, null, 'The diagnostic fee covers the technician time needed to inspect, test, and identify the fault.', false, 13)
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ps5__hdmi-board-level', id, 'HDMI Repair – Board Level', 'fixed', 80, null, null, null, false, 0
from wholesale_categories where slug = 'ps5'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ps5__hdmi-board-only', id, 'HDMI Replacement – Board Only', 'fixed', 45, null, null, 'Customer provides the motherboard only. No guarantee of full functionality after installation because the console was not disassembled by Torays Boost and other damages cannot be verified.', false, 1
from wholesale_categories where slug = 'ps5'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ps5__no-power-board', id, 'No Power – Board Repair', 'range', null, 120, 150, null, false, 2
from wholesale_categories where slug = 'ps5'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ps5__no-wifi-bt-board', id, 'No Wi-Fi / Bluetooth – Board Repair', 'fixed', 130, null, null, null, false, 3
from wholesale_categories where slug = 'ps5'
on conflict (slug) do nothing;

-- Xbox Series X
insert into wholesale_categories (slug, name, notes, diagnostic_fee, diagnostic_description, active, sort_order)
values ('xbox-series-x', 'Xbox Series X', null, null, 'The diagnostic fee covers the technician time needed to inspect, test, and identify the fault.', false, 14)
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'xbox-series-x__hdmi-board-level', id, 'HDMI Repair – Board Level', 'fixed', 90, null, null, null, false, 0
from wholesale_categories where slug = 'xbox-series-x'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'xbox-series-x__no-power-board', id, 'No Power – Board Repair', 'range', null, 120, 150, null, false, 1
from wholesale_categories where slug = 'xbox-series-x'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'xbox-series-x__no-wifi-bt-board', id, 'No Wi-Fi / Bluetooth – Board Repair', 'fixed', 130, null, null, null, false, 2
from wholesale_categories where slug = 'xbox-series-x'
on conflict (slug) do nothing;

-- Nintendo Switch / Switch OLED
insert into wholesale_categories (slug, name, notes, diagnostic_fee, diagnostic_description, active, sort_order)
values ('switch', 'Nintendo Switch / Switch OLED', null, null, 'The diagnostic fee covers the technician time needed to inspect, test, and identify the fault.', false, 15)
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'switch__charging-port', id, 'Charging Port Replacement', 'fixed', 65, null, null, null, false, 0
from wholesale_categories where slug = 'switch'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'switch__charging-ic', id, 'Charging IC Replacement', 'fixed', 65, null, null, null, false, 1
from wholesale_categories where slug = 'switch'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'switch__no-power-board', id, 'No Power – Board Repair', 'range', null, 70, 90, null, false, 2
from wholesale_categories where slug = 'switch'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'switch__no-wifi-bt-board', id, 'No Wi-Fi / Bluetooth – Board Repair', 'fixed', 80, null, null, null, false, 3
from wholesale_categories where slug = 'switch'
on conflict (slug) do nothing;

-- PlayStation 5 DualSense
insert into wholesale_categories (slug, name, notes, diagnostic_fee, diagnostic_description, active, sort_order)
values ('ps5-dualsense', 'PlayStation 5 DualSense', null, null, 'The diagnostic fee covers the technician time needed to inspect, test, and identify the fault.', false, 16)
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ps5-dualsense__battery', id, 'Battery Replacement', 'fixed', 20, null, null, null, false, 0
from wholesale_categories where slug = 'ps5-dualsense'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ps5-dualsense__tmr-pair', id, 'TMR Hall Joystick Upgrade – Pair', 'fixed', 25, null, null, null, false, 1
from wholesale_categories where slug = 'ps5-dualsense'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ps5-dualsense__thumbstick-cap-addon', id, 'Thumbstick Cap Replacement (add-on with TMR)', 'fixed', 5, null, null, 'Add-on price when done together with the TMR Hall Joystick Upgrade.', false, 2
from wholesale_categories where slug = 'ps5-dualsense'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ps5-dualsense__tmr-plus-caps', id, 'TMR + New Thumbstick Caps (bundle)', 'fixed', 30, null, null, null, false, 3
from wholesale_categories where slug = 'ps5-dualsense'
on conflict (slug) do nothing;

-- PlayStation 5 DualSense Edge
insert into wholesale_categories (slug, name, notes, diagnostic_fee, diagnostic_description, active, sort_order)
values ('ps5-dualsense-edge', 'PlayStation 5 DualSense Edge', null, null, 'The diagnostic fee covers the technician time needed to inspect, test, and identify the fault.', false, 17)
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ps5-dualsense-edge__battery', id, 'Battery Replacement', 'fixed', 20, null, null, null, false, 0
from wholesale_categories where slug = 'ps5-dualsense-edge'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ps5-dualsense-edge__tmr-modules', id, 'TMR Hall Joystick Upgrade – Modules', 'fixed', 45, null, null, null, false, 1
from wholesale_categories where slug = 'ps5-dualsense-edge'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ps5-dualsense-edge__thumbstick-cap-addon', id, 'Thumbstick Cap Replacement (add-on with TMR)', 'fixed', 5, null, null, 'Add-on price when done together with the TMR Hall Joystick Upgrade.', false, 2
from wholesale_categories where slug = 'ps5-dualsense-edge'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'ps5-dualsense-edge__tmr-plus-caps', id, 'TMR + New Thumbstick Caps (bundle)', 'fixed', 50, null, null, null, false, 3
from wholesale_categories where slug = 'ps5-dualsense-edge'
on conflict (slug) do nothing;

-- Xbox Series X/S Controller
insert into wholesale_categories (slug, name, notes, diagnostic_fee, diagnostic_description, active, sort_order)
values ('xbox-controller', 'Xbox Series X/S Controller', null, null, 'The diagnostic fee covers the technician time needed to inspect, test, and identify the fault.', false, 18)
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'xbox-controller__battery-service', id, 'Rechargeable Battery Pack / Battery Terminal Service', 'fixed', 20, null, null, 'Standard Xbox controller uses AA batteries or a rechargeable battery pack — not an internal battery.', false, 0
from wholesale_categories where slug = 'xbox-controller'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'xbox-controller__tmr-pair', id, 'TMR Hall Joystick Upgrade – Pair', 'fixed', 25, null, null, null, false, 1
from wholesale_categories where slug = 'xbox-controller'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'xbox-controller__thumbstick-cap-addon', id, 'Thumbstick Cap Replacement (add-on with TMR)', 'fixed', 5, null, null, 'Add-on price when done together with the TMR Hall Joystick Upgrade.', false, 2
from wholesale_categories where slug = 'xbox-controller'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'xbox-controller__tmr-plus-caps', id, 'TMR + New Thumbstick Caps (bundle)', 'fixed', 30, null, null, null, false, 3
from wholesale_categories where slug = 'xbox-controller'
on conflict (slug) do nothing;

-- Xbox Elite Series 2 Controller
insert into wholesale_categories (slug, name, notes, diagnostic_fee, diagnostic_description, active, sort_order)
values ('xbox-elite-2', 'Xbox Elite Series 2 Controller', null, null, 'The diagnostic fee covers the technician time needed to inspect, test, and identify the fault.', false, 19)
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'xbox-elite-2__internal-battery', id, 'Internal Battery Replacement', 'fixed', 20, null, null, null, false, 0
from wholesale_categories where slug = 'xbox-elite-2'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'xbox-elite-2__tmr-pair', id, 'TMR Hall Joystick Upgrade – Pair', 'fixed', 45, null, null, null, false, 1
from wholesale_categories where slug = 'xbox-elite-2'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'xbox-elite-2__thumbstick-cap-addon', id, 'Thumbstick Cap Replacement (add-on with TMR)', 'fixed', 5, null, null, 'Add-on price when done together with the TMR Hall Joystick Upgrade.', false, 2
from wholesale_categories where slug = 'xbox-elite-2'
on conflict (slug) do nothing;

insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)
select 'xbox-elite-2__tmr-plus-caps', id, 'TMR + New Thumbstick Caps (bundle)', 'fixed', 50, null, null, null, false, 3
from wholesale_categories where slug = 'xbox-elite-2'
on conflict (slug) do nothing;

-- Laptops (Standard)
insert into wholesale_categories (slug, name, notes, diagnostic_fee, diagnostic_description, active, sort_order)
values ('laptops-normal', 'Laptops (Standard)', null, null, 'The diagnostic fee covers the technician time needed to inspect, test, and identify the fault.', false, 20)
on conflict (slug) do nothing;

-- Gaming Laptops
insert into wholesale_categories (slug, name, notes, diagnostic_fee, diagnostic_description, active, sort_order)
values ('laptops-gamer', 'Gaming Laptops', null, null, 'The diagnostic fee covers the technician time needed to inspect, test, and identify the fault.', false, 21)
on conflict (slug) do nothing;

commit;