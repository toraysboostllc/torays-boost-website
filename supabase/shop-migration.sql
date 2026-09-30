-- =============================================================================
-- Tienda Torays Boost (/tienda) — schema v1.
--
-- Run order: shop-preflight.sql -> shop-migration.sql -> shop-verify.sql.
-- Undo: shop-rollback.sql (drops everything this file creates).
--
-- Completely independent of the wholesale_* tables (Wholesale is being
-- retired separately — nothing here references it).
--
-- Security model: every table has Row Level Security ENABLED and NO
-- policies, so the public anon/publishable key (the same Supabase project
-- DESK uses) can read/write NOTHING here. Only api/shop.js, server-side,
-- with the secret/service key, touches these tables. Product photos live
-- in the public "shop-product-images" Storage bucket (read-only for the
-- public; uploads only through signed URLs minted by api/shop.js).
--
-- Money is always integer cents. Stock model:
--   shop_products.stock      = units on hand, not yet sold
--   available (at checkout)  = stock - units held by orders that are
--                              'pending_payment' with reserved_until > now(),
--                              or 'payment_review' (PayPal still deciding)
--   Stock is only decremented when PayPal CONFIRMS the payment
--   (shop_mark_order_paid) — never on order creation.
-- =============================================================================
begin;

create sequence if not exists shop_order_number_seq;

create table if not exists shop_products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  price_cents integer not null,
  condition text not null default 'new',
  category text not null default '',
  stock integer not null default 0,
  status text not null default 'draft',
  images jsonb not null default '[]'::jsonb,
  weight_oz numeric(8,2) not null default 16,
  length_in numeric(6,2) not null default 8,
  width_in numeric(6,2) not null default 6,
  height_in numeric(6,2) not null default 4,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table shop_products drop constraint if exists shop_products_title_len;
alter table shop_products add constraint shop_products_title_len check (char_length(title) between 1 and 140);
alter table shop_products drop constraint if exists shop_products_description_len;
alter table shop_products add constraint shop_products_description_len check (char_length(description) <= 5000);
alter table shop_products drop constraint if exists shop_products_price_range;
alter table shop_products add constraint shop_products_price_range check (price_cents between 1 and 10000000);
alter table shop_products drop constraint if exists shop_products_condition_valid;
alter table shop_products add constraint shop_products_condition_valid check (
  condition in ('new', 'open_box', 'refurbished', 'used_like_new', 'used_good', 'used_fair', 'for_parts')
);
alter table shop_products drop constraint if exists shop_products_stock_nonneg;
alter table shop_products add constraint shop_products_stock_nonneg check (stock between 0 and 100000);
alter table shop_products drop constraint if exists shop_products_status_valid;
alter table shop_products add constraint shop_products_status_valid check (status in ('draft', 'published'));
alter table shop_products drop constraint if exists shop_products_images_max5;
alter table shop_products add constraint shop_products_images_max5 check (
  jsonb_typeof(images) = 'array' and jsonb_array_length(images) <= 5
);
alter table shop_products drop constraint if exists shop_products_package_positive;
alter table shop_products add constraint shop_products_package_positive check (
  weight_oz > 0 and length_in > 0 and width_in > 0 and height_in > 0
);

create table if not exists shop_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  public_token text not null,
  environment text not null,
  status text not null default 'pending_payment',
  fulfillment text not null default 'shipping',
  language text not null default 'en',
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null default '',
  ship_line1 text,
  ship_line2 text not null default '',
  ship_city text,
  ship_state text,
  ship_zip text,
  ship_country text not null default 'US',
  items_cents integer not null,
  shipping_cents integer not null,
  tax_cents integer not null default 0,
  total_cents integer not null,
  currency text not null default 'USD',
  shipping_provider text,
  shipping_carrier text,
  shipping_service text,
  shipping_days integer,
  reserved_until timestamptz not null default (now() + interval '20 minutes'),
  paypal_order_id text unique,
  paypal_capture_id text unique,
  paypal_gross_cents integer,
  paypal_fee_cents integer,
  paypal_net_cents integer,
  paid_at timestamptz,
  oversold boolean not null default false,
  label_provider text,
  label_cost_cents integer,
  label_carrier text,
  label_service text,
  label_url text,
  tracking_number text,
  shipped_at timestamptz,
  ready_at timestamptz,
  picked_up_at timestamptz,
  admin_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table shop_orders drop constraint if exists shop_orders_status_valid;
alter table shop_orders add constraint shop_orders_status_valid check (status in (
  'pending_payment', 'payment_review', 'payment_failed', 'cancelled',
  'paid', 'shipped', 'ready_for_pickup', 'picked_up', 'partially_refunded', 'refunded'
));
alter table shop_orders drop constraint if exists shop_orders_language_valid;
alter table shop_orders add constraint shop_orders_language_valid check (language in ('en', 'es'));
alter table shop_orders drop constraint if exists shop_orders_fulfillment_valid;
alter table shop_orders add constraint shop_orders_fulfillment_valid check (
  (fulfillment = 'shipping' and ship_line1 is not null and ship_city is not null and ship_state is not null
     and ship_zip is not null and shipping_provider is not null and shipping_carrier is not null and shipping_service is not null)
  or (fulfillment = 'pickup' and shipping_cents = 0)
);
alter table shop_orders drop constraint if exists shop_orders_environment_valid;
alter table shop_orders add constraint shop_orders_environment_valid check (environment in ('dev', 'sandbox', 'live'));
alter table shop_orders drop constraint if exists shop_orders_amounts_valid;
alter table shop_orders add constraint shop_orders_amounts_valid check (
  items_cents > 0 and shipping_cents >= 0 and tax_cents >= 0
  and total_cents = items_cents + shipping_cents + tax_cents
);
alter table shop_orders drop constraint if exists shop_orders_carriers_valid;
alter table shop_orders add constraint shop_orders_carriers_valid check (
  (shipping_carrier is null or shipping_carrier in ('USPS', 'UPS'))
  and (label_carrier is null or label_carrier in ('USPS', 'UPS'))
);
alter table shop_orders drop constraint if exists shop_orders_label_cost_nonneg;
alter table shop_orders add constraint shop_orders_label_cost_nonneg check (label_cost_cents is null or label_cost_cents >= 0);

create index if not exists idx_shop_orders_status on shop_orders (status);
create index if not exists idx_shop_orders_paid_at on shop_orders (paid_at);
create index if not exists idx_shop_orders_created_at on shop_orders (created_at desc);

create table if not exists shop_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references shop_orders (id) on delete cascade,
  product_id uuid references shop_products (id) on delete set null,
  title text not null,
  condition text not null,
  unit_price_cents integer not null,
  quantity integer not null
);
alter table shop_order_items drop constraint if exists shop_order_items_qty_range;
alter table shop_order_items add constraint shop_order_items_qty_range check (quantity between 1 and 99);
alter table shop_order_items drop constraint if exists shop_order_items_price_pos;
alter table shop_order_items add constraint shop_order_items_price_pos check (unit_price_cents > 0);
create index if not exists idx_shop_order_items_order on shop_order_items (order_id);
create index if not exists idx_shop_order_items_product on shop_order_items (product_id);

-- One row per PayPal refund (or chargeback reversal). amount_cents is what
-- the buyer got back; fee_returned_cents is the part of the original PayPal
-- fee PayPal gave back; net_cents is what actually left the seller balance
-- (amount - fee_returned). All three straight from PayPal's own
-- seller_payable_breakdown — never computed by us.
create table if not exists shop_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references shop_orders (id) on delete cascade,
  paypal_refund_id text not null unique,
  kind text not null default 'refund',
  status text not null,
  amount_cents integer not null,
  fee_returned_cents integer not null default 0,
  net_cents integer not null,
  restocked boolean not null default false,
  source text not null,
  created_at timestamptz not null default now()
);
alter table shop_refunds drop constraint if exists shop_refunds_kind_valid;
alter table shop_refunds add constraint shop_refunds_kind_valid check (kind in ('refund', 'reversal'));
alter table shop_refunds drop constraint if exists shop_refunds_source_valid;
alter table shop_refunds add constraint shop_refunds_source_valid check (source in ('admin', 'webhook'));
create index if not exists idx_shop_refunds_order on shop_refunds (order_id);

-- PayPal webhook log — the primary key is PayPal's own event id, so a
-- redelivered event is recognized and never applied twice.
create table if not exists shop_payment_events (
  id text primary key,
  event_type text not null,
  resource_id text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);

create table if not exists shop_admin_sessions (
  token_hash text primary key,
  email text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- Store settings edited from the panel (one row, id = 1). Pickup:
--  pickup_area     — shown publicly (e.g. "Kendall, Miami"), never the street;
--  pickup_address  — exact address, ONLY sent in the "ready for pickup" email;
--  pickup_hours    — [{ "day": 0-6 (0 = Sunday), "open": "HH:MM", "close": "HH:MM" }],
--                    Miami local time, shown to the customer before paying.
-- Shipping: the owner sets what the customer pays per option — labels are
-- bought by hand in Pirate Ship, so there are no live carrier rates here.
--  shipping_options — [{ "id", "carrier": "USPS"|"UPS", "service",
--                        "price_cents", "days_min", "days_max", "enabled" }]
create table if not exists shop_settings (
  id integer primary key default 1,
  pickup_enabled boolean not null default false,
  pickup_area text not null default 'Kendall, Miami',
  pickup_address text not null default '',
  pickup_hours jsonb not null default '[]'::jsonb,
  pickup_notes text not null default '',
  shipping_options jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table shop_settings drop constraint if exists shop_settings_shipping_array;
alter table shop_settings add constraint shop_settings_shipping_array check (
  jsonb_typeof(shipping_options) = 'array' and jsonb_array_length(shipping_options) <= 10
);
alter table shop_settings drop constraint if exists shop_settings_single_row;
alter table shop_settings add constraint shop_settings_single_row check (id = 1);
alter table shop_settings drop constraint if exists shop_settings_hours_array;
alter table shop_settings add constraint shop_settings_hours_array check (
  jsonb_typeof(pickup_hours) = 'array' and jsonb_array_length(pickup_hours) <= 7
);
-- Pickup can't be switched on without an address and at least one day:
-- the "ready" email must always carry both.
alter table shop_settings drop constraint if exists shop_settings_pickup_complete;
alter table shop_settings add constraint shop_settings_pickup_complete check (
  not pickup_enabled or (char_length(btrim(pickup_address)) > 0 and jsonb_array_length(pickup_hours) > 0)
);
insert into shop_settings (id) values (1) on conflict (id) do nothing;

-- Optional customer accounts — PASSWORDLESS, and deliberately NOT Supabase
-- Auth: that auth is the DESK staff login (a signup there becomes a
-- pending staff profile). A customer proves they own an email by opening a
-- one-time link; the account is just their saved details + order history.
create table if not exists shop_customers (
  email text primary key,
  name text not null default '',
  phone text not null default '',
  line1 text not null default '',
  line2 text not null default '',
  city text not null default '',
  state text not null default '',
  zip text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists shop_customer_links (
  token_hash text primary key,
  email text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index if not exists idx_shop_customer_links_email on shop_customer_links (email, created_at desc);

create table if not exists shop_customer_sessions (
  token_hash text primary key,
  email text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- Every email the store sends (or failed to send). Also the idempotency
-- guard: one confirmation / one "ready for pickup" per order.
create table if not exists shop_email_log (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references shop_orders (id) on delete cascade,
  kind text not null,
  recipient text not null,
  status text not null,
  provider_id text,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists idx_shop_email_log_order on shop_email_log (order_id, kind);

alter table shop_products enable row level security;
alter table shop_orders enable row level security;
alter table shop_order_items enable row level security;
alter table shop_refunds enable row level security;
alter table shop_payment_events enable row level security;
alter table shop_admin_sessions enable row level security;
alter table shop_customers enable row level security;
alter table shop_customer_links enable row level security;
alter table shop_customer_sessions enable row level security;
alter table shop_email_log enable row level security;
alter table shop_settings enable row level security;

-- -----------------------------------------------------------------------------
-- shop_create_order(p jsonb) -> jsonb
-- Atomically: locks every product row involved, checks it is published and
-- has enough AVAILABLE units (stock minus live reservations), prices the
-- items from the database (never from the request), and inserts the order
-- + its items as 'pending_payment' holding a 20-minute reservation.
-- Raises 'product_unavailable:<id>' / 'insufficient_stock:<id>'.
-- -----------------------------------------------------------------------------
create or replace function shop_create_order(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_items jsonb := p -> 'items';
  v_line record;
  v_prod shop_products%rowtype;
  v_held integer;
  v_items_cents bigint := 0;
  v_shipping integer := (p ->> 'shipping_cents')::integer;
  v_order_id uuid;
  v_number text;
begin
  if v_items is null or jsonb_typeof(v_items) <> 'array'
     or jsonb_array_length(v_items) < 1 or jsonb_array_length(v_items) > 20 then
    raise exception 'invalid_items';
  end if;
  if v_shipping is null or v_shipping < 0 then
    raise exception 'invalid_shipping';
  end if;

  -- Lock in a stable (id) order so two concurrent checkouts never deadlock.
  for v_line in
    select (e ->> 'product_id')::uuid as product_id, sum((e ->> 'quantity')::integer) as qty
    from jsonb_array_elements(v_items) e
    group by 1
    order by 1
  loop
    if v_line.qty is null or v_line.qty < 1 or v_line.qty > 99 then
      raise exception 'invalid_quantity:%', v_line.product_id;
    end if;
    select * into v_prod from shop_products where id = v_line.product_id for update;
    if not found or v_prod.status <> 'published' then
      raise exception 'product_unavailable:%', v_line.product_id;
    end if;
    select coalesce(sum(oi.quantity), 0) into v_held
    from shop_order_items oi
    join shop_orders o on o.id = oi.order_id
    where oi.product_id = v_line.product_id
      and (o.status = 'payment_review'
           or (o.status = 'pending_payment' and o.reserved_until > now()));
    if v_prod.stock - v_held < v_line.qty then
      raise exception 'insufficient_stock:%', v_line.product_id;
    end if;
    v_items_cents := v_items_cents + v_prod.price_cents::bigint * v_line.qty;
  end loop;

  v_number := 'TB-' || to_char(now() at time zone 'America/New_York', 'YYYY') || '-'
              || lpad(nextval('shop_order_number_seq')::text, 4, '0');

  insert into shop_orders (
    order_number, public_token, environment, fulfillment, language,
    customer_name, customer_email, customer_phone,
    ship_line1, ship_line2, ship_city, ship_state, ship_zip, ship_country,
    items_cents, shipping_cents, tax_cents, total_cents,
    shipping_provider, shipping_carrier, shipping_service, shipping_days
  ) values (
    v_number, p ->> 'public_token', p ->> 'environment', coalesce(p ->> 'fulfillment', 'shipping'),
    case when p ->> 'language' = 'es' then 'es' else 'en' end,
    p ->> 'customer_name', p ->> 'customer_email', coalesce(p ->> 'customer_phone', ''),
    nullif(p ->> 'ship_line1', ''), coalesce(p ->> 'ship_line2', ''), nullif(p ->> 'ship_city', ''),
    nullif(p ->> 'ship_state', ''), nullif(p ->> 'ship_zip', ''), 'US',
    v_items_cents, v_shipping, 0, v_items_cents + v_shipping,
    nullif(p ->> 'shipping_provider', ''), nullif(p ->> 'shipping_carrier', ''), nullif(p ->> 'shipping_service', ''),
    nullif(p ->> 'shipping_days', '')::integer
  ) returning id into v_order_id;

  insert into shop_order_items (order_id, product_id, title, condition, unit_price_cents, quantity)
  select v_order_id, sp.id, sp.title, sp.condition, sp.price_cents, l.qty
  from (
    select (e ->> 'product_id')::uuid as product_id, sum((e ->> 'quantity')::integer) as qty
    from jsonb_array_elements(v_items) e group by 1
  ) l
  join shop_products sp on sp.id = l.product_id;

  return jsonb_build_object(
    'id', v_order_id,
    'order_number', v_number,
    'items_cents', v_items_cents,
    'shipping_cents', v_shipping,
    'tax_cents', 0,
    'total_cents', v_items_cents + v_shipping
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- shop_mark_order_paid(p_order_id uuid, p jsonb) -> jsonb
-- Called ONLY after PayPal reports the capture COMPLETED. Idempotent: an
-- order already paid/shipped/refunded is returned untouched. Decrements
-- stock; if stock is already short (reservation expired and someone else
-- bought the last unit meanwhile) the order is still recorded as paid —
-- the money was received — but flagged oversold for the admin.
-- -----------------------------------------------------------------------------
create or replace function shop_mark_order_paid(p_order_id uuid, p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_order shop_orders%rowtype;
  v_line record;
  v_oversold boolean := false;
  v_stock integer;
begin
  select * into v_order from shop_orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;
  if v_order.status in ('paid', 'shipped', 'ready_for_pickup', 'picked_up', 'partially_refunded', 'refunded') then
    return jsonb_build_object('status', v_order.status, 'already', true);
  end if;

  for v_line in
    select product_id, quantity from shop_order_items
    where order_id = p_order_id and product_id is not null
    order by product_id
  loop
    select stock into v_stock from shop_products where id = v_line.product_id for update;
    if v_stock is null then
      continue;
    end if;
    if v_stock < v_line.quantity then
      v_oversold := true;
    end if;
    update shop_products
      set stock = greatest(v_stock - v_line.quantity, 0), updated_at = now()
      where id = v_line.product_id;
  end loop;

  update shop_orders set
    status = 'paid',
    paid_at = coalesce(nullif(p ->> 'paid_at', '')::timestamptz, now()),
    paypal_capture_id = p ->> 'capture_id',
    paypal_gross_cents = (p ->> 'gross_cents')::integer,
    paypal_fee_cents = (p ->> 'fee_cents')::integer,
    paypal_net_cents = (p ->> 'net_cents')::integer,
    oversold = v_oversold,
    updated_at = now()
  where id = p_order_id;

  return jsonb_build_object('status', 'paid', 'already', false, 'oversold', v_oversold);
end;
$$;

-- -----------------------------------------------------------------------------
-- shop_record_refund(p_order_id uuid, p jsonb) -> jsonb
-- Idempotent on paypal_refund_id (the admin endpoint and the webhook can
-- both report the same refund). Optionally puts the units back in stock
-- (only on the first insert, and only when asked). Recomputes the order's
-- refund status from the sum of COMPLETED refunds.
-- -----------------------------------------------------------------------------
create or replace function shop_record_refund(p_order_id uuid, p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_order shop_orders%rowtype;
  v_inserted boolean := false;
  v_refunded bigint;
  v_restock boolean := coalesce((p ->> 'restock')::boolean, false);
  v_new_status text;
begin
  select * into v_order from shop_orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  insert into shop_refunds (order_id, paypal_refund_id, kind, status, amount_cents, fee_returned_cents, net_cents, restocked, source)
  values (
    p_order_id, p ->> 'paypal_refund_id', coalesce(p ->> 'kind', 'refund'), p ->> 'status',
    (p ->> 'amount_cents')::integer, coalesce((p ->> 'fee_returned_cents')::integer, 0),
    (p ->> 'net_cents')::integer, v_restock, p ->> 'source'
  )
  on conflict (paypal_refund_id) do update
    set status = excluded.status,
        fee_returned_cents = excluded.fee_returned_cents,
        net_cents = excluded.net_cents
  returning (xmax = 0) into v_inserted;

  if v_inserted and v_restock then
    update shop_products sp
      set stock = sp.stock + oi.quantity, updated_at = now()
      from shop_order_items oi
      where oi.order_id = p_order_id and oi.product_id = sp.id;
  end if;

  select coalesce(sum(amount_cents), 0) into v_refunded
  from shop_refunds where order_id = p_order_id and status = 'COMPLETED';

  if v_order.status in ('paid', 'shipped', 'ready_for_pickup', 'picked_up', 'partially_refunded', 'refunded') and v_refunded > 0 then
    v_new_status := case when v_refunded >= v_order.total_cents then 'refunded' else 'partially_refunded' end;
    update shop_orders set status = v_new_status, updated_at = now() where id = p_order_id;
  else
    v_new_status := v_order.status;
  end if;

  return jsonb_build_object('inserted', v_inserted, 'status', v_new_status, 'refunded_cents', v_refunded);
end;
$$;

-- Product photos: public read (they are shown on a public store), writes
-- only via signed upload URLs from the server. 5 MB cap per file.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-product-images', 'shop-product-images', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

commit;
