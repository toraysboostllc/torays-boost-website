-- ============================================================================
-- Easy Search initial device directory — GENERATED, do not edit by hand.
-- Source of truth: scripts/wholesaleEasySearchSeed.data.js
-- Regenerate with: node scripts/generate-wholesale-easy-search-seed-sql.mjs
--
-- Run this in the Supabase SQL Editor immediately after
-- wholesale-easy-search-migration.sql has verified PASS.
--
-- Idempotent: a model insert is guarded by WHERE NOT EXISTS on its own
-- (brand, commercial_name) pair (neither table has a natural short slug the
-- way wholesale_categories does), and every code insert uses
-- ON CONFLICT (normalized_code) DO NOTHING — safe to run more than once, and
-- never overwrites a row an admin has already edited from Desk's Easy Search
-- panel. Wrapped in BEGIN/COMMIT: if anything below fails, Postgres rolls back
-- the whole file, never a half-loaded directory.
--
-- catalog_model_id is intentionally left unset (null) for every row — see
-- wholesaleEasySearchSeed.data.js's own header for why linking each device to
-- a real Wholesale catalog Model is a Desk admin task, not something this seed
-- safely infers.
-- Everything is created active: true — this directory carries no pricing, so
-- there is nothing here for an admin to review/activate before it's safe to
-- show, unlike the priced catalog's own seed (which starts inactive).
-- ============================================================================

begin;

-- Apple iPhone 6
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Apple', 'iPhone 6', 'phone', 2014, '4.7" Retina HD', 'Apple A8', '1 GB', '16/64/128 GB', '8 MP', '1810 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Apple' and commercial_name = 'iPhone 6');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('A1549', 'A1549', null), ('A1586', 'A1586', null)) as code_data(code, normalized_code, region)
where m.brand = 'Apple' and m.commercial_name = 'iPhone 6'
on conflict (normalized_code) do nothing;

-- Apple iPhone 6 Plus
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Apple', 'iPhone 6 Plus', 'phone', 2014, '5.5" Retina HD', 'Apple A8', '1 GB', '16/64/128 GB', '8 MP OIS', '2915 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Apple' and commercial_name = 'iPhone 6 Plus');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('A1522', 'A1522', null), ('A1524', 'A1524', null)) as code_data(code, normalized_code, region)
where m.brand = 'Apple' and m.commercial_name = 'iPhone 6 Plus'
on conflict (normalized_code) do nothing;

-- Apple iPhone 6s
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Apple', 'iPhone 6s', 'phone', 2015, '4.7" Retina HD', 'Apple A9', '2 GB', '16/32/64/128 GB', '12 MP', '1715 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Apple' and commercial_name = 'iPhone 6s');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('A1633', 'A1633', null), ('A1688', 'A1688', null)) as code_data(code, normalized_code, region)
where m.brand = 'Apple' and m.commercial_name = 'iPhone 6s'
on conflict (normalized_code) do nothing;

-- Apple iPhone 6s Plus
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Apple', 'iPhone 6s Plus', 'phone', 2015, '5.5" Retina HD', 'Apple A9', '2 GB', '16/32/64/128 GB', '12 MP OIS', '2750 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Apple' and commercial_name = 'iPhone 6s Plus');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('A1634', 'A1634', null), ('A1687', 'A1687', null)) as code_data(code, normalized_code, region)
where m.brand = 'Apple' and m.commercial_name = 'iPhone 6s Plus'
on conflict (normalized_code) do nothing;

-- Apple iPhone 7
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Apple', 'iPhone 7', 'phone', 2016, '4.7" Retina HD', 'Apple A10 Fusion', '2 GB', '32/128/256 GB', '12 MP OIS', '1960 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Apple' and commercial_name = 'iPhone 7');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('A1660', 'A1660', null), ('A1778', 'A1778', null)) as code_data(code, normalized_code, region)
where m.brand = 'Apple' and m.commercial_name = 'iPhone 7'
on conflict (normalized_code) do nothing;

-- Apple iPhone 7 Plus
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Apple', 'iPhone 7 Plus', 'phone', 2016, '5.5" Retina HD', 'Apple A10 Fusion', '3 GB', '32/128/256 GB', 'Doble 12 MP', '2900 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Apple' and commercial_name = 'iPhone 7 Plus');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('A1661', 'A1661', null), ('A1784', 'A1784', null)) as code_data(code, normalized_code, region)
where m.brand = 'Apple' and m.commercial_name = 'iPhone 7 Plus'
on conflict (normalized_code) do nothing;

-- Apple iPhone SE (1ª gen)
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Apple', 'iPhone SE (1ª gen)', 'phone', 2016, '4.0" Retina', 'Apple A9', '2 GB', '16/32/64/128 GB', '12 MP', '1624 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Apple' and commercial_name = 'iPhone SE (1ª gen)');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('A1662', 'A1662', null), ('A1723', 'A1723', null)) as code_data(code, normalized_code, region)
where m.brand = 'Apple' and m.commercial_name = 'iPhone SE (1ª gen)'
on conflict (normalized_code) do nothing;

-- Apple iPhone 8
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Apple', 'iPhone 8', 'phone', 2017, '4.7" Retina HD', 'Apple A11 Bionic', '2 GB', '64/128/256 GB', '12 MP OIS', '1821 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Apple' and commercial_name = 'iPhone 8');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('A1863', 'A1863', null), ('A1905', 'A1905', null)) as code_data(code, normalized_code, region)
where m.brand = 'Apple' and m.commercial_name = 'iPhone 8'
on conflict (normalized_code) do nothing;

-- Apple iPhone X
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Apple', 'iPhone X', 'phone', 2017, '5.8" Super Retina OLED', 'Apple A11 Bionic', '3 GB', '64/256 GB', 'Doble 12 MP OIS', '2716 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Apple' and commercial_name = 'iPhone X');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('A1865', 'A1865', null), ('A1901', 'A1901', null)) as code_data(code, normalized_code, region)
where m.brand = 'Apple' and m.commercial_name = 'iPhone X'
on conflict (normalized_code) do nothing;

-- Apple iPhone XR
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Apple', 'iPhone XR', 'phone', 2018, '6.1" Liquid Retina LCD', 'Apple A12 Bionic', '3 GB', '64/128/256 GB', '12 MP OIS', '2942 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Apple' and commercial_name = 'iPhone XR');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('A1984', 'A1984', null), ('A2105', 'A2105', null)) as code_data(code, normalized_code, region)
where m.brand = 'Apple' and m.commercial_name = 'iPhone XR'
on conflict (normalized_code) do nothing;

-- Apple iPhone XS Max
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Apple', 'iPhone XS Max', 'phone', 2018, '6.5" Super Retina OLED', 'Apple A12 Bionic', '4 GB', '64/256/512 GB', 'Doble 12 MP OIS', '3174 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Apple' and commercial_name = 'iPhone XS Max');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('A1921', 'A1921', null), ('A2101', 'A2101', null)) as code_data(code, normalized_code, region)
where m.brand = 'Apple' and m.commercial_name = 'iPhone XS Max'
on conflict (normalized_code) do nothing;

-- Apple iPhone 11
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Apple', 'iPhone 11', 'phone', 2019, '6.1" Liquid Retina LCD', 'Apple A13 Bionic', '4 GB', '64/128/256 GB', 'Doble 12 MP (W/UW)', '3110 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Apple' and commercial_name = 'iPhone 11');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('A2111', 'A2111', null), ('A2221', 'A2221', null)) as code_data(code, normalized_code, region)
where m.brand = 'Apple' and m.commercial_name = 'iPhone 11'
on conflict (normalized_code) do nothing;

-- Apple iPhone 11 Pro Max
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Apple', 'iPhone 11 Pro Max', 'phone', 2019, '6.5" Super Retina XDR OLED', 'Apple A13 Bionic', '4 GB', '64/256/512 GB', 'Triple 12+12+12 MP', '3969 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Apple' and commercial_name = 'iPhone 11 Pro Max');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('A2161', 'A2161', null), ('A2218', 'A2218', 'US'), ('A2220', 'A2220', null)) as code_data(code, normalized_code, region)
where m.brand = 'Apple' and m.commercial_name = 'iPhone 11 Pro Max'
on conflict (normalized_code) do nothing;

-- Apple iPhone 12
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Apple', 'iPhone 12', 'phone', 2020, '6.1" Super Retina XDR OLED', 'Apple A14 Bionic', '4 GB', '64/128/256 GB', 'Doble 12 MP', '2815 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Apple' and commercial_name = 'iPhone 12');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('A2172', 'A2172', null), ('A2403', 'A2403', null)) as code_data(code, normalized_code, region)
where m.brand = 'Apple' and m.commercial_name = 'iPhone 12'
on conflict (normalized_code) do nothing;

-- Apple iPhone 12 Pro Max
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Apple', 'iPhone 12 Pro Max', 'phone', 2020, '6.7" Super Retina XDR OLED', 'Apple A14 Bionic', '6 GB', '128/256/512 GB', 'Triple 12+12+12 MP + LiDAR', '3687 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Apple' and commercial_name = 'iPhone 12 Pro Max');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('A2342', 'A2342', null), ('A2411', 'A2411', null)) as code_data(code, normalized_code, region)
where m.brand = 'Apple' and m.commercial_name = 'iPhone 12 Pro Max'
on conflict (normalized_code) do nothing;

-- Apple iPhone SE (2ª gen)
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Apple', 'iPhone SE (2ª gen)', 'phone', 2020, '4.7" Retina HD', 'Apple A13 Bionic', '3 GB', '64/128/256 GB', '12 MP OIS', '1821 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Apple' and commercial_name = 'iPhone SE (2ª gen)');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('A2275', 'A2275', null), ('A2296', 'A2296', null)) as code_data(code, normalized_code, region)
where m.brand = 'Apple' and m.commercial_name = 'iPhone SE (2ª gen)'
on conflict (normalized_code) do nothing;

-- Apple iPhone 13
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Apple', 'iPhone 13', 'phone', 2021, '6.1" Super Retina XDR OLED', 'Apple A15 Bionic', '4 GB', '128/256/512 GB', 'Doble 12 MP', '3227 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Apple' and commercial_name = 'iPhone 13');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('A2482', 'A2482', null), ('A2633', 'A2633', null)) as code_data(code, normalized_code, region)
where m.brand = 'Apple' and m.commercial_name = 'iPhone 13'
on conflict (normalized_code) do nothing;

-- Apple iPhone 13 Pro Max
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Apple', 'iPhone 13 Pro Max', 'phone', 2021, '6.7" Super Retina XDR ProMotion', 'Apple A15 Bionic', '6 GB', '128/256/512GB / 1TB', 'Triple 12+12+12 MP + LiDAR', '4352 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Apple' and commercial_name = 'iPhone 13 Pro Max');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('A2484', 'A2484', null), ('A2643', 'A2643', null)) as code_data(code, normalized_code, region)
where m.brand = 'Apple' and m.commercial_name = 'iPhone 13 Pro Max'
on conflict (normalized_code) do nothing;

-- Apple iPhone 14
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Apple', 'iPhone 14', 'phone', 2022, '6.1" Super Retina XDR OLED', 'Apple A15 Bionic', '6 GB', '128/256/512 GB', 'Doble 12 MP', '3279 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Apple' and commercial_name = 'iPhone 14');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('A2649', 'A2649', null), ('A2882', 'A2882', null)) as code_data(code, normalized_code, region)
where m.brand = 'Apple' and m.commercial_name = 'iPhone 14'
on conflict (normalized_code) do nothing;

-- Apple iPhone 14 Pro Max
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Apple', 'iPhone 14 Pro Max', 'phone', 2022, '6.7" LTPO Super Retina XDR', 'Apple A16 Bionic', '6 GB', '128/256/512GB / 1TB', '48 MP + 12 MP + 12 MP + LiDAR', '4323 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Apple' and commercial_name = 'iPhone 14 Pro Max');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('A2651', 'A2651', null), ('A2894', 'A2894', null)) as code_data(code, normalized_code, region)
where m.brand = 'Apple' and m.commercial_name = 'iPhone 14 Pro Max'
on conflict (normalized_code) do nothing;

-- Apple iPhone SE (3ª gen)
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Apple', 'iPhone SE (3ª gen)', 'phone', 2022, '4.7" Retina HD', 'Apple A15 Bionic', '4 GB', '64/128/256 GB', '12 MP OIS', '2018 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Apple' and commercial_name = 'iPhone SE (3ª gen)');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('A2595', 'A2595', null), ('A2783', 'A2783', null)) as code_data(code, normalized_code, region)
where m.brand = 'Apple' and m.commercial_name = 'iPhone SE (3ª gen)'
on conflict (normalized_code) do nothing;

-- Apple iPhone 15
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Apple', 'iPhone 15', 'phone', 2023, '6.1" Super Retina XDR OLED', 'Apple A16 Bionic', '6 GB', '128/256/512 GB', 'Doble 48+12 MP', '3349 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Apple' and commercial_name = 'iPhone 15');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('A2846', 'A2846', null), ('A3090', 'A3090', null)) as code_data(code, normalized_code, region)
where m.brand = 'Apple' and m.commercial_name = 'iPhone 15'
on conflict (normalized_code) do nothing;

-- Apple iPhone 15 Pro Max
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Apple', 'iPhone 15 Pro Max', 'phone', 2023, '6.7" LTPO Super Retina XDR', 'Apple A17 Pro', '8 GB', '256/512GB / 1TB', '48 MP + 12 MP + 12 MP Prisma', '4441 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Apple' and commercial_name = 'iPhone 15 Pro Max');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('A2849', 'A2849', null), ('A3106', 'A3106', null)) as code_data(code, normalized_code, region)
where m.brand = 'Apple' and m.commercial_name = 'iPhone 15 Pro Max'
on conflict (normalized_code) do nothing;

-- Apple iPhone 16
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Apple', 'iPhone 16', 'phone', 2024, '6.1" Super Retina XDR OLED', 'Apple A18', '8 GB', '128/256/512 GB', 'Doble 48+12 MP Fusion', '3561 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Apple' and commercial_name = 'iPhone 16');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('A3286', 'A3286', null), ('A3287', 'A3287', null)) as code_data(code, normalized_code, region)
where m.brand = 'Apple' and m.commercial_name = 'iPhone 16'
on conflict (normalized_code) do nothing;

-- Apple iPhone 16 Pro Max
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Apple', 'iPhone 16 Pro Max', 'phone', 2024, '6.9" LTPO Super Retina XDR', 'Apple A18 Pro', '8 GB', '128/256/512GB / 1TB', '48 MP + 48 MP + 12 MP Ultra', '4685 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Apple' and commercial_name = 'iPhone 16 Pro Max');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('A3295', 'A3295', null), ('A3296', 'A3296', null)) as code_data(code, normalized_code, region)
where m.brand = 'Apple' and m.commercial_name = 'iPhone 16 Pro Max'
on conflict (normalized_code) do nothing;

-- Apple iPhone 16e
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Apple', 'iPhone 16e', 'phone', 2025, '6.1" OLED Notch', 'Apple A18', '8 GB', '128/256 GB', '48 MP', '3279 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Apple' and commercial_name = 'iPhone 16e');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('A3212', 'A3212', 'US'), ('A3408', 'A3408', null), ('A3410', 'A3410', null), ('A3409', 'A3409', null)) as code_data(code, normalized_code, region)
where m.brand = 'Apple' and m.commercial_name = 'iPhone 16e'
on conflict (normalized_code) do nothing;

-- Apple iPhone 17 Pro Max
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Apple', 'iPhone 17 Pro Max', 'phone', 2025, '6.9" LTPO Super Retina Pro 120Hz', 'Apple A19 Pro', '12 GB', '256/512GB / 1TB', 'Triple 48+48+48 MP', '4850 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Apple' and commercial_name = 'iPhone 17 Pro Max');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('A3257', 'A3257', 'US'), ('A3525', 'A3525', null), ('A3527', 'A3527', null), ('A3526', 'A3526', null)) as code_data(code, normalized_code, region)
where m.brand = 'Apple' and m.commercial_name = 'iPhone 17 Pro Max'
on conflict (normalized_code) do nothing;

-- Apple iPhone 17e
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Apple', 'iPhone 17e', 'phone', 2026, '6.1" OLED, 2532x1170', 'Apple A19', null, '256/512 GB', '48MP Fusion Main + 12MP 2x Telephoto', 'Up to 26 hours video playback', true
where not exists (select 1 from wholesale_device_models where brand = 'Apple' and commercial_name = 'iPhone 17e');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('A3575', 'A3575', 'US'), ('A3635', 'A3635', null), ('A3634', 'A3634', null)) as code_data(code, normalized_code, region)
where m.brand = 'Apple' and m.commercial_name = 'iPhone 17e'
on conflict (normalized_code) do nothing;

-- Samsung Galaxy S5
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Samsung', 'Galaxy S5', 'phone', 2014, '5.1" FHD Super AMOLED', 'Snapdragon 801', '2 GB', '16/32 GB', '16 MP', '2800 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Samsung' and commercial_name = 'Galaxy S5');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('SM-G900F', 'SMG900F', 'Intl')) as code_data(code, normalized_code, region)
where m.brand = 'Samsung' and m.commercial_name = 'Galaxy S5'
on conflict (normalized_code) do nothing;

-- Samsung Galaxy Note 4
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Samsung', 'Galaxy Note 4', 'phone', 2014, '5.7" QHD Super AMOLED', 'Snapdragon 805 / Exynos 5433', '3 GB', '32 GB', '16 MP OIS', '3220 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Samsung' and commercial_name = 'Galaxy Note 4');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('SM-N910F', 'SMN910F', 'Intl')) as code_data(code, normalized_code, region)
where m.brand = 'Samsung' and m.commercial_name = 'Galaxy Note 4'
on conflict (normalized_code) do nothing;

-- Samsung Galaxy S6
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Samsung', 'Galaxy S6', 'phone', 2015, '5.1" QHD Super AMOLED', 'Exynos 7420', '3 GB', '32/64/128 GB', '16 MP OIS', '2550 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Samsung' and commercial_name = 'Galaxy S6');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('SM-G920F', 'SMG920F', 'Intl')) as code_data(code, normalized_code, region)
where m.brand = 'Samsung' and m.commercial_name = 'Galaxy S6'
on conflict (normalized_code) do nothing;

-- Samsung Galaxy Note 5
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Samsung', 'Galaxy Note 5', 'phone', 2015, '5.7" QHD Super AMOLED', 'Exynos 7420', '4 GB', '32/64 GB', '16 MP OIS', '3000 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Samsung' and commercial_name = 'Galaxy Note 5');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('SM-N920F', 'SMN920F', 'Intl')) as code_data(code, normalized_code, region)
where m.brand = 'Samsung' and m.commercial_name = 'Galaxy Note 5'
on conflict (normalized_code) do nothing;

-- Samsung Galaxy S7
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Samsung', 'Galaxy S7', 'phone', 2016, '5.1" QHD Super AMOLED', 'Snapdragon 820 / Exynos 8890', '4 GB', '32/64 GB', '12 MP Dual Pixel', '3000 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Samsung' and commercial_name = 'Galaxy S7');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('SM-G930F', 'SMG930F', 'Intl'), ('SM-G930U', 'SMG930U', 'US')) as code_data(code, normalized_code, region)
where m.brand = 'Samsung' and m.commercial_name = 'Galaxy S7'
on conflict (normalized_code) do nothing;

-- Samsung Galaxy J7 (2016)
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Samsung', 'Galaxy J7 (2016)', 'phone', 2016, '5.5" HD Super AMOLED', 'Exynos 7870', '2 GB', '16 GB', '13 MP', '3300 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Samsung' and commercial_name = 'Galaxy J7 (2016)');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('SM-J710F', 'SMJ710F', 'Intl')) as code_data(code, normalized_code, region)
where m.brand = 'Samsung' and m.commercial_name = 'Galaxy J7 (2016)'
on conflict (normalized_code) do nothing;

-- Samsung Galaxy S8
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Samsung', 'Galaxy S8', 'phone', 2017, '5.8" QHD+ Infinity Display', 'Snapdragon 835 / Exynos 8895', '4 GB', '64 GB', '12 MP Dual Pixel', '3000 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Samsung' and commercial_name = 'Galaxy S8');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('SM-G950F', 'SMG950F', 'Intl'), ('SM-G950U', 'SMG950U', 'US'), ('SM-G950U1', 'SMG950U1', 'US')) as code_data(code, normalized_code, region)
where m.brand = 'Samsung' and m.commercial_name = 'Galaxy S8'
on conflict (normalized_code) do nothing;

-- Samsung Galaxy Note 8
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Samsung', 'Galaxy Note 8', 'phone', 2017, '6.3" QHD+ Infinity Display', 'Snapdragon 835 / Exynos 8895', '6 GB', '64/128/256 GB', 'Doble 12 MP OIS', '3300 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Samsung' and commercial_name = 'Galaxy Note 8');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('SM-N950F', 'SMN950F', 'Intl'), ('SM-N950U', 'SMN950U', 'US'), ('SM-N950U1', 'SMN950U1', 'US')) as code_data(code, normalized_code, region)
where m.brand = 'Samsung' and m.commercial_name = 'Galaxy Note 8'
on conflict (normalized_code) do nothing;

-- Samsung Galaxy S9+
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Samsung', 'Galaxy S9+', 'phone', 2018, '6.2" QHD+ Super AMOLED', 'Snapdragon 845 / Exynos 9810', '6 GB', '64/128/256 GB', 'Doble 12 MP (Var. Apertura)', '3500 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Samsung' and commercial_name = 'Galaxy S9+');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('SM-G965F', 'SMG965F', 'Intl'), ('SM-G965U', 'SMG965U', 'US'), ('SM-G965U1', 'SMG965U1', 'US')) as code_data(code, normalized_code, region)
where m.brand = 'Samsung' and m.commercial_name = 'Galaxy S9+'
on conflict (normalized_code) do nothing;

-- Samsung Galaxy A7 (2018)
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Samsung', 'Galaxy A7 (2018)', 'phone', 2018, '6.0" FHD+ Super AMOLED', 'Exynos 7885', '4/6 GB', '64/128 GB', 'Triple 24+8+5 MP', '3300 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Samsung' and commercial_name = 'Galaxy A7 (2018)');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('SM-A750F', 'SMA750F', 'Intl')) as code_data(code, normalized_code, region)
where m.brand = 'Samsung' and m.commercial_name = 'Galaxy A7 (2018)'
on conflict (normalized_code) do nothing;

-- Samsung Galaxy S10+
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Samsung', 'Galaxy S10+', 'phone', 2019, '6.4" QHD+ Dynamic AMOLED', 'Snapdragon 855 / Exynos 9820', '8/12 GB', '128/512GB / 1TB', 'Triple 12+12+16 MP', '4100 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Samsung' and commercial_name = 'Galaxy S10+');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('SM-G975F', 'SMG975F', 'Intl'), ('SM-G975U', 'SMG975U', 'US'), ('SM-G975U1', 'SMG975U1', 'US')) as code_data(code, normalized_code, region)
where m.brand = 'Samsung' and m.commercial_name = 'Galaxy S10+'
on conflict (normalized_code) do nothing;

-- Samsung Galaxy A50
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Samsung', 'Galaxy A50', 'phone', 2019, '6.4" FHD+ Super AMOLED', 'Exynos 9610', '4/6 GB', '64/128 GB', 'Triple 25+8+5 MP', '4000 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Samsung' and commercial_name = 'Galaxy A50');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('SM-A505F', 'SMA505F', 'Intl'), ('SM-A505U', 'SMA505U', 'US'), ('SM-A505U1', 'SMA505U1', 'US')) as code_data(code, normalized_code, region)
where m.brand = 'Samsung' and m.commercial_name = 'Galaxy A50'
on conflict (normalized_code) do nothing;

-- Samsung Galaxy Fold
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Samsung', 'Galaxy Fold', 'phone', 2019, '7.3" QHD+ Dynamic AMOLED Fold', 'Snapdragon 855', '12 GB', '512 GB', 'Triple 12+12+16 MP', '4380 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Samsung' and commercial_name = 'Galaxy Fold');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('SM-F900F', 'SMF900F', 'Intl'), ('SM-F900U', 'SMF900U', 'US'), ('SM-F900U1', 'SMF900U1', 'US')) as code_data(code, normalized_code, region)
where m.brand = 'Samsung' and m.commercial_name = 'Galaxy Fold'
on conflict (normalized_code) do nothing;

-- Samsung Galaxy S20 Ultra
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Samsung', 'Galaxy S20 Ultra', 'phone', 2020, '6.9" QHD+ Dynamic AMOLED 2X', 'Snapdragon 865 / Exynos 990', '12/16 GB', '128/256/512 GB', '108 MP + 48 MP + 12 MP', '5000 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Samsung' and commercial_name = 'Galaxy S20 Ultra');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('SM-G988F', 'SMG988F', 'Intl'), ('SM-G988U', 'SMG988U', 'US'), ('SM-G988U1', 'SMG988U1', 'US')) as code_data(code, normalized_code, region)
where m.brand = 'Samsung' and m.commercial_name = 'Galaxy S20 Ultra'
on conflict (normalized_code) do nothing;

-- Samsung Galaxy A51
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Samsung', 'Galaxy A51', 'phone', 2020, '6.5" FHD+ Super AMOLED', 'Exynos 9611', '4/6/8 GB', '64/128 GB', 'Cuádruple 48+12+5+5 MP', '4000 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Samsung' and commercial_name = 'Galaxy A51');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('SM-A515F', 'SMA515F', 'Intl'), ('SM-A515U', 'SMA515U', 'US'), ('SM-A515U1', 'SMA515U1', 'US')) as code_data(code, normalized_code, region)
where m.brand = 'Samsung' and m.commercial_name = 'Galaxy A51'
on conflict (normalized_code) do nothing;

-- Samsung Galaxy S21 Ultra
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Samsung', 'Galaxy S21 Ultra', 'phone', 2021, '6.8" QHD+ Dynamic AMOLED 2X', 'Snapdragon 888 / Exynos 2100', '12/16 GB', '128/256/512 GB', '108 MP + 10 MP + 10 MP + 12 MP', '5000 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Samsung' and commercial_name = 'Galaxy S21 Ultra');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('SM-G998B', 'SMG998B', 'Intl'), ('SM-G998U', 'SMG998U', 'US'), ('SM-G998U1', 'SMG998U1', 'US')) as code_data(code, normalized_code, region)
where m.brand = 'Samsung' and m.commercial_name = 'Galaxy S21 Ultra'
on conflict (normalized_code) do nothing;

-- Samsung Galaxy A52s 5G
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Samsung', 'Galaxy A52s 5G', 'phone', 2021, '6.5" FHD+ Super AMOLED 120Hz', 'Snapdragon 778G 5G', '6/8 GB', '128/256 GB', 'Cuádruple 64+12+5+5 MP', '4500 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Samsung' and commercial_name = 'Galaxy A52s 5G');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('SM-A528B', 'SMA528B', 'Intl')) as code_data(code, normalized_code, region)
where m.brand = 'Samsung' and m.commercial_name = 'Galaxy A52s 5G'
on conflict (normalized_code) do nothing;

-- Samsung Galaxy S22 Ultra
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Samsung', 'Galaxy S22 Ultra', 'phone', 2022, '6.8" Dynamic AMOLED 2X 120Hz', 'Snapdragon 8 Gen 1 / Exynos 2200', '8/12 GB', '128/256/512GB / 1TB', '108 MP + 10 MP + 10 MP + 12 MP', '5000 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Samsung' and commercial_name = 'Galaxy S22 Ultra');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('SM-S908B', 'SMS908B', 'Intl'), ('SM-S908U', 'SMS908U', 'US'), ('SM-S908U1', 'SMS908U1', 'US')) as code_data(code, normalized_code, region)
where m.brand = 'Samsung' and m.commercial_name = 'Galaxy S22 Ultra'
on conflict (normalized_code) do nothing;

-- Samsung Galaxy A53 5G
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Samsung', 'Galaxy A53 5G', 'phone', 2022, '6.5" FHD+ Super AMOLED 120Hz', 'Exynos 1280', '4/6/8 GB', '128/256 GB', 'Cuádruple 64+12+5+5 MP', '5000 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Samsung' and commercial_name = 'Galaxy A53 5G');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('SM-A536B', 'SMA536B', 'Intl'), ('SM-A536U', 'SMA536U', 'US'), ('SM-A536U1', 'SMA536U1', 'US')) as code_data(code, normalized_code, region)
where m.brand = 'Samsung' and m.commercial_name = 'Galaxy A53 5G'
on conflict (normalized_code) do nothing;

-- Samsung Galaxy S23 Ultra
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Samsung', 'Galaxy S23 Ultra', 'phone', 2023, '6.8" Dynamic AMOLED 2X 120Hz', 'Snapdragon 8 Gen 2 f. Galaxy', '8/12 GB', '256/512GB / 1TB', '200 MP + 10 MP + 10 MP + 12 MP', '5000 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Samsung' and commercial_name = 'Galaxy S23 Ultra');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('SM-S918B', 'SMS918B', 'Intl'), ('SM-S918U', 'SMS918U', 'US'), ('SM-S918U1', 'SMS918U1', 'US')) as code_data(code, normalized_code, region)
where m.brand = 'Samsung' and m.commercial_name = 'Galaxy S23 Ultra'
on conflict (normalized_code) do nothing;

-- Samsung Galaxy A54 5G
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Samsung', 'Galaxy A54 5G', 'phone', 2023, '6.4" FHD+ Super AMOLED 120Hz', 'Exynos 1380', '6/8 GB', '128/256 GB', 'Triple 50+12+5 MP', '5000 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Samsung' and commercial_name = 'Galaxy A54 5G');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('SM-A546B', 'SMA546B', 'Intl'), ('SM-A546U', 'SMA546U', 'US'), ('SM-A546U1', 'SMA546U1', 'US')) as code_data(code, normalized_code, region)
where m.brand = 'Samsung' and m.commercial_name = 'Galaxy A54 5G'
on conflict (normalized_code) do nothing;

-- Samsung Galaxy Z Fold5
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Samsung', 'Galaxy Z Fold5', 'phone', 2023, '7.6" Dynamic AMOLED 2X Fold', 'Snapdragon 8 Gen 2 f. Galaxy', '12 GB', '256/512GB / 1TB', 'Triple 50+10+12 MP', '4400 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Samsung' and commercial_name = 'Galaxy Z Fold5');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('SM-F946B', 'SMF946B', 'Intl'), ('SM-F946U', 'SMF946U', 'US'), ('SM-F946U1', 'SMF946U1', 'US')) as code_data(code, normalized_code, region)
where m.brand = 'Samsung' and m.commercial_name = 'Galaxy Z Fold5'
on conflict (normalized_code) do nothing;

-- Samsung Galaxy S24 Ultra
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Samsung', 'Galaxy S24 Ultra', 'phone', 2024, '6.8" Dynamic AMOLED 2X Flat', 'Snapdragon 8 Gen 3 f. Galaxy', '12 GB', '256/512GB / 1TB', '200 MP + 50 MP + 10 MP + 12 MP', '5000 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Samsung' and commercial_name = 'Galaxy S24 Ultra');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('SM-S928B', 'SMS928B', 'Intl'), ('SM-S928U', 'SMS928U', 'US'), ('SM-S928U1', 'SMS928U1', 'US')) as code_data(code, normalized_code, region)
where m.brand = 'Samsung' and m.commercial_name = 'Galaxy S24 Ultra'
on conflict (normalized_code) do nothing;

-- Samsung Galaxy A55 5G
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Samsung', 'Galaxy A55 5G', 'phone', 2024, '6.6" FHD+ Super AMOLED 120Hz', 'Exynos 1480', '8/12 GB', '128/256 GB', 'Triple 50+12+5 MP', '5000 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Samsung' and commercial_name = 'Galaxy A55 5G');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('SM-A556B', 'SMA556B', 'Intl')) as code_data(code, normalized_code, region)
where m.brand = 'Samsung' and m.commercial_name = 'Galaxy A55 5G'
on conflict (normalized_code) do nothing;

-- Samsung Galaxy S25 Ultra
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Samsung', 'Galaxy S25 Ultra', 'phone', 2025, '6.86" Dynamic AMOLED 2X Slim', 'Snapdragon 8 Elite f. Galaxy', '12/16 GB', '256/512GB / 1TB', '200 MP + 50 MP + 50 MP + 12 MP', '5000 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Samsung' and commercial_name = 'Galaxy S25 Ultra');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('SM-S938B', 'SMS938B', 'Intl'), ('SM-S938U', 'SMS938U', 'US'), ('SM-S938U1', 'SMS938U1', 'US')) as code_data(code, normalized_code, region)
where m.brand = 'Samsung' and m.commercial_name = 'Galaxy S25 Ultra'
on conflict (normalized_code) do nothing;

-- Samsung Galaxy A56 5G
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Samsung', 'Galaxy A56 5G', 'phone', 2025, '6.6" Super AMOLED 120Hz', 'Exynos 1580', '8 GB', '128/256 GB', 'Triple 50+12+5 MP', '5000 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Samsung' and commercial_name = 'Galaxy A56 5G');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('SM-A566B', 'SMA566B', 'Intl'), ('SM-A566U', 'SMA566U', 'US'), ('SM-A566U1', 'SMA566U1', 'US')) as code_data(code, normalized_code, region)
where m.brand = 'Samsung' and m.commercial_name = 'Galaxy A56 5G'
on conflict (normalized_code) do nothing;

-- Samsung Galaxy S26 Ultra
insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)
select 'Samsung', 'Galaxy S26 Ultra', 'phone', 2026, '6.9" Dynamic AMOLED 2X UltraFlat', 'Snapdragon 8 Gen 5 / Exynos 2600', '16 GB', '256/512GB / 1TB', '200 MP + 50 MP + 50 MP + 50 MP', '5100 mAh', true
where not exists (select 1 from wholesale_device_models where brand = 'Samsung' and commercial_name = 'Galaxy S26 Ultra');

insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)
select m.id, code_data.code, code_data.normalized_code, code_data.region, true
from wholesale_device_models m
cross join (values ('SM-S948B', 'SMS948B', 'Intl'), ('SM-S948U', 'SMS948U', 'US'), ('SM-S948U1', 'SMS948U1', 'US')) as code_data(code, normalized_code, region)
where m.brand = 'Samsung' and m.commercial_name = 'Galaxy S26 Ultra'
on conflict (normalized_code) do nothing;

commit;