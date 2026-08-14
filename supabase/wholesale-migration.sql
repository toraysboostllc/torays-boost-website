-- ============================================================================
-- Wholesale pricing gateway — schema + RLS
-- ============================================================================
-- Run this ONCE in the Supabase SQL Editor for the TORAYS BOOST project
-- (same project already used by TORAYS BOOST DESK — SUPABASE_URL in
-- torays-boost.jsx / .env.example). Safe to run alongside the existing
-- schema: every object here is new and prefixed `wholesale_`, nothing
-- touches `profiles` or `torays_kv`.
--
-- Access model: the shop-code login is a CUSTOM auth scheme, not Supabase
-- Auth, so `auth.uid()`-based RLS policies don't apply here. Instead, RLS
-- is enabled with ZERO policies on every table below — in Postgres/Supabase
-- that means "deny all" for the anon and authenticated roles. The only way
-- in is the Supabase `service_role` key, which bypasses RLS by design and
-- is used exclusively inside the serverless functions in api/wholesale-*.js
-- and api/wholesale-admin-*.js — never in any client-side code.
-- ============================================================================

-- Wrapped in BEGIN/COMMIT on purpose (explicit, not relying on the SQL
-- Editor's own implicit-transaction handling of a multi-statement paste):
-- if anything below fails, Postgres rolls back everything in this file —
-- never a half-created schema. Every statement is also individually
-- idempotent (IF NOT EXISTS / CREATE OR REPLACE), so re-running the whole
-- file — after a rollback, or just to be safe — is always safe too.
begin;

create extension if not exists pgcrypto;

create table if not exists wholesale_shops (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code_hash text not null,
  status text not null default 'active' check (status in ('active', 'blocked')),
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  code_regenerated_at timestamptz
);

-- Every device — including a shop's very first one — starts 'pending' and
-- stays that way until an admin approves it from TORAYS BOOST DESK. There
-- is no auto-approval path anywhere in this schema or in api/wholesale-login.js.
create table if not exists wholesale_devices (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references wholesale_shops(id) on delete cascade,
  device_token_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'revoked')),
  user_agent text,
  first_seen_at timestamptz not null default now(),
  approved_at timestamptz,
  last_seen_at timestamptz
);

-- A session is only ever created for an already-approved device.
-- expires_at is set to now() + 30 days at login — "stays connected for 30
-- days" per the owner's spec. The admin can end one early via
-- api/wholesale-admin-sessions.js (sets revoked_at).
create table if not exists wholesale_sessions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references wholesale_shops(id) on delete cascade,
  device_id uuid not null references wholesale_devices(id) on delete cascade,
  session_token_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

-- The audit trail: "who logged in and when" (and the other lifecycle
-- events) — this is what the Wholesale Shops admin module in TORAYS BOOST
-- DESK reads to show the access log.
create table if not exists wholesale_access_log (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references wholesale_shops(id) on delete set null,
  device_id uuid references wholesale_devices(id) on delete set null,
  event text not null, -- 'login_success' | 'login_failed' | 'login_locked' |
                        -- 'device_pending' | 'device_approved' | 'device_rejected' |
                        -- 'shop_blocked' | 'shop_unblocked' | 'code_regenerated_full_reset' |
                        -- 'session_revoked' | 'session_expired'
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

-- Equipment types/categories (e.g. "iPhone", "PS5"). diagnostic_fee +
-- diagnostic_description + notes are per-category, editable from the
-- Catalog tab in the Wholesale Shops admin module — never edited directly
-- in Supabase. `notes` is for category-wide caveats (e.g. "ATA / Level 3
-- Repair" on iPhone 15/16/17) — service-level `notes` below stays for
-- clarifications specific to one repair.
-- `slug` is NOT shown/editable in the DESK UI. It's generated server-side
-- once, on creation, in api/wholesale-admin-categories.js /
-- wholesale-admin-services.js (never on update — renaming never changes
-- it) — this is the stable identity supabase/wholesale-seed-initial-catalog.sql
-- checks "does this already exist?" against. NOT NULL + unique: no row,
-- seeded or hand-created from
-- DESK, is ever allowed to exist without one.
create table if not exists wholesale_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  notes text,
  diagnostic_fee numeric(10, 2),
  diagnostic_description text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A repair/service line under a category. Either fixed_price is set, or
-- price_min+price_max are (pricing_type says which) — enforced in the
-- admin API, not with a CHECK constraint, to keep validation messages
-- friendly from api/wholesale-admin-services.js.
create table if not exists wholesale_services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique, -- same reasoning as wholesale_categories.slug, above
  category_id uuid not null references wholesale_categories(id) on delete cascade,
  name text not null,
  pricing_type text not null default 'fixed' check (pricing_type in ('fixed', 'range')),
  fixed_price numeric(10, 2),
  price_min numeric(10, 2),
  price_max numeric(10, 2),
  notes text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_wholesale_devices_shop on wholesale_devices(shop_id);
create index if not exists idx_wholesale_sessions_shop on wholesale_sessions(shop_id);
create index if not exists idx_wholesale_sessions_device on wholesale_sessions(device_id);
create index if not exists idx_wholesale_access_log_shop on wholesale_access_log(shop_id);
create index if not exists idx_wholesale_access_log_created on wholesale_access_log(created_at desc);
create index if not exists idx_wholesale_services_category on wholesale_services(category_id);

alter table wholesale_shops enable row level security;
alter table wholesale_devices enable row level security;
alter table wholesale_sessions enable row level security;
alter table wholesale_access_log enable row level security;
alter table wholesale_categories enable row level security;
alter table wholesale_services enable row level security;

-- No policies are created on purpose — with RLS enabled and no policies,
-- anon/authenticated get zero access to these tables. Only service_role
-- (server-side only) can read or write. Do not add anon/authenticated
-- policies here without re-checking that pricing data still can't leak
-- to a retail visitor.

-- ============================================================================
-- Full security reset on code regeneration
-- ============================================================================
-- Called via RPC (POST /rest/v1/rpc/wholesale_regenerate_shop_code) from
-- api/wholesale-admin-shops.js instead of doing separate REST calls, so the
-- code change + session revocation + device revocation + audit log entry
-- all happen in ONE Postgres transaction — either all of it lands or none
-- of it does, no partial state if a request gets interrupted mid-way.
create or replace function wholesale_regenerate_shop_code(p_shop_id uuid, p_code_hash text)
returns void
language plpgsql
as $$
begin
  update wholesale_shops
    set code_hash = p_code_hash,
        code_regenerated_at = now(),
        failed_attempts = 0,
        locked_until = null
    where id = p_shop_id;

  update wholesale_sessions
    set revoked_at = now()
    where shop_id = p_shop_id and revoked_at is null;

  -- Every device — approved or still pending — has to be re-approved after
  -- a full reset. History (first_seen_at, approved_at, etc.) is kept as-is
  -- on the row; only status flips, nothing is deleted.
  update wholesale_devices
    set status = 'revoked'
    where shop_id = p_shop_id and status in ('pending', 'approved');

  insert into wholesale_access_log (shop_id, event)
    values (p_shop_id, 'code_regenerated_full_reset');
end;
$$;

commit;
