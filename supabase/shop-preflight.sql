-- =============================================================================
-- Tienda — PREFLIGHT (read-only). Run before shop-migration.sql.
-- Changes NOTHING. Every row must say ok = true before migrating.
--
-- What the migration touches (and nothing else):
--   * NEW tables shop_*, sequence shop_order_number_seq, functions shop_*
--   * ONE new Storage bucket: shop-product-images
-- It never alters, drops or writes DESK tables (torays_kv, profiles, …),
-- wholesale_* tables, or any existing bucket/function. Quote doesn't use
-- the database at all.
-- =============================================================================
select 'no_existing_shop_tables' as check_name,
       count(*) = 0 as ok,
       coalesce(string_agg(table_name, ', '), 'none — clean install') as detail
from information_schema.tables
where table_schema = 'public' and table_name like 'shop\_%';

select 'no_existing_shop_functions' as check_name,
       count(*) = 0 as ok,
       coalesce(string_agg(p.proname, ', '), 'none') as detail
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'shop\_%';

select 'no_existing_shop_sequence' as check_name,
       not exists (select 1 from pg_class where relkind = 'S' and relname = 'shop_order_number_seq') as ok,
       'shop_order_number_seq' as detail;

select 'gen_random_uuid_available' as check_name,
       exists (select 1 from pg_proc where proname = 'gen_random_uuid') as ok,
       'built into Postgres 13+ (Supabase ships 15+)' as detail;

select 'storage_schema_present' as check_name,
       exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') as ok,
       'Supabase Storage must be enabled for product photos' as detail;

select 'bucket_name_free' as check_name,
       not exists (select 1 from storage.buckets where id = 'shop-product-images') as ok,
       'a bucket named shop-product-images must not exist yet' as detail;

-- Informative (not a gate): the DESK / Wholesale tables that exist today,
-- so you can compare the same list after migrating — it must be identical.
select 'existing_non_shop_tables_before' as check_name,
       true as ok,
       count(*) || ' tables: ' || string_agg(table_name, ', ' order by table_name) as detail
from information_schema.tables
where table_schema = 'public' and table_name not like 'shop\_%';
