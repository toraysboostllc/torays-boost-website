-- =============================================================================
-- Tienda — ROLLBACK. DESTRUCTIVE: removes every product, order and refund
-- row of the store. Export the sales log first (panel -> Sales -> CSV).
-- The bucket row is removed only if it is already empty (Storage refuses
-- otherwise) — delete the photos from the Supabase dashboard first.
-- =============================================================================
begin;
drop function if exists shop_record_refund(uuid, jsonb);
drop function if exists shop_mark_order_paid(uuid, jsonb);
drop function if exists shop_create_order(jsonb);
drop table if exists shop_settings;
drop table if exists shop_email_log;
drop table if exists shop_customer_sessions;
drop table if exists shop_customer_links;
drop table if exists shop_customers;
drop table if exists shop_admin_sessions;
drop table if exists shop_payment_events;
drop table if exists shop_refunds;
drop table if exists shop_order_items;
drop table if exists shop_orders;
drop table if exists shop_products;
drop sequence if exists shop_order_number_seq;
delete from storage.buckets where id = 'shop-product-images'
  and not exists (select 1 from storage.objects where bucket_id = 'shop-product-images');
commit;
