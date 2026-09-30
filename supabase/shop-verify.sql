-- =============================================================================
-- Tienda — VERIFY (read-only). Run after shop-migration.sql; every ok = true.
-- =============================================================================
select 'tables_exist' as check_name,
       count(*) = 11 as ok,
       string_agg(table_name, ', ' order by table_name) as detail
from information_schema.tables
where table_schema = 'public' and table_name in (
  'shop_products', 'shop_orders', 'shop_order_items', 'shop_refunds',
  'shop_payment_events', 'shop_admin_sessions',
  'shop_customers', 'shop_customer_links', 'shop_customer_sessions', 'shop_email_log', 'shop_settings'
);

select 'rls_enabled_everywhere_no_policies' as check_name,
       bool_and(c.relrowsecurity) and not exists (
         select 1 from pg_policies where schemaname = 'public' and tablename like 'shop\_%'
       ) as ok,
       'anon/publishable key must not reach any shop table' as detail
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'shop\_%';

select 'functions_exist' as check_name,
       count(*) = 3 as ok,
       string_agg(proname, ', ' order by proname) as detail
from pg_proc
where proname in ('shop_create_order', 'shop_mark_order_paid', 'shop_record_refund');

select 'bucket_public_5mb' as check_name,
       exists (select 1 from storage.buckets where id = 'shop-product-images' and public and file_size_limit = 5242880) as ok,
       'shop-product-images: public read, 5 MB per file' as detail;

-- Informative: compare with the same row from shop-preflight.sql — the
-- list of DESK / Wholesale tables must be exactly the same as before.
select 'existing_non_shop_tables_after' as check_name,
       true as ok,
       count(*) || ' tables: ' || string_agg(table_name, ', ' order by table_name) as detail
from information_schema.tables
where table_schema = 'public' and table_name not like 'shop\_%';
