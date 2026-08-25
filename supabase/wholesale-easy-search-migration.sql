-- ============================================================================
-- Easy Search — model-code lookup for the Wholesale portal
-- ============================================================================
-- Two new tables backing "Easy Search": a shop types a printed model code
-- (e.g. "A2218", "SM-S918U") and gets back real-world specs (brand,
-- commercial name, year, screen, processor, RAM, storage, main camera,
-- battery) — never a price. If the device is also tied to the existing
-- Wholesale catalog (catalog_model_id), the UI offers a button into the
-- existing, unmodified Equipment -> Model -> Failure/Service -> Price flow.
--
-- Run in the same Supabase project's SQL Editor AFTER
-- wholesale-easy-search-preflight.sql has reported PASS.
--
-- wholesale_device_models — one row per real-world device.
--   brand / device_category are free text on purpose (no CHECK enum) — this
--   repo's own convention is not to hardcode a catalog into a constraint;
--   the data lives in rows, validated at the application layer (Desk's admin
--   CSV import / form) instead.
--   catalog_model_id is NULLABLE and references wholesale_categories(id) —
--   the "Model" level of the existing catalog hierarchy
--   (wholesale_equipment_types -> wholesale_categories -> wholesale_services).
--   A non-null value here is exactly what makes the portal show "View
--   Services & Wholesale Prices". `on delete set null` (not cascade): if a
--   Model is ever deleted from the pricing catalog, the device's spec row
--   must not disappear with it — only the pricing link goes away.
--
-- wholesale_device_model_codes — one row per printed code. A device with a
--   combined label like "A1549 / A1586" becomes two independent rows here,
--   both pointing at the same device_model_id — that's the entire "alias"
--   mechanism, no separate alias table needed. normalized_code is the
--   uppercase, alphanumeric-only form ("A2218", not "a-2218") and is
--   UNIQUE across the whole table: the same real-world code can never be
--   attached to two different devices.
--
-- Idempotent throughout — "create table if not exists", "if not exists" on
-- every index, DROP-then-ADD on the one CHECK-equivalent (the unique
-- constraint, via "if not exists"). Wrapped in one explicit transaction.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. wholesale_device_models
-- ----------------------------------------------------------------------------
create table if not exists wholesale_device_models (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  commercial_name text not null,
  device_category text not null default 'phone',
  year int,
  screen text,
  processor text,
  ram text,
  storage text,
  main_camera text,
  battery text,
  catalog_model_id uuid references wholesale_categories(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table wholesale_device_models drop constraint if exists wholesale_device_models_brand_not_blank;
alter table wholesale_device_models add constraint wholesale_device_models_brand_not_blank
  check (btrim(brand) <> '');

alter table wholesale_device_models drop constraint if exists wholesale_device_models_commercial_name_not_blank;
alter table wholesale_device_models add constraint wholesale_device_models_commercial_name_not_blank
  check (btrim(commercial_name) <> '');

create index if not exists idx_wholesale_device_models_catalog_model on wholesale_device_models(catalog_model_id);
create index if not exists idx_wholesale_device_models_brand on wholesale_device_models(brand);
create index if not exists idx_wholesale_device_models_active on wholesale_device_models(active);

-- ----------------------------------------------------------------------------
-- 2. wholesale_device_model_codes
-- ----------------------------------------------------------------------------
create table if not exists wholesale_device_model_codes (
  id uuid primary key default gen_random_uuid(),
  device_model_id uuid not null references wholesale_device_models(id) on delete cascade,
  code text not null,
  normalized_code text not null,
  region text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table wholesale_device_model_codes drop constraint if exists wholesale_device_model_codes_code_not_blank;
alter table wholesale_device_model_codes add constraint wholesale_device_model_codes_code_not_blank
  check (btrim(code) <> '');

-- The one invariant Easy Search's search endpoint depends on: a normalized
-- code resolves to exactly one device, never an ambiguous match.
alter table wholesale_device_model_codes drop constraint if exists wholesale_device_model_codes_normalized_not_blank;
alter table wholesale_device_model_codes add constraint wholesale_device_model_codes_normalized_not_blank
  check (btrim(normalized_code) <> '');

create unique index if not exists uq_wholesale_device_model_codes_normalized
  on wholesale_device_model_codes(normalized_code);
create index if not exists idx_wholesale_device_model_codes_model on wholesale_device_model_codes(device_model_id);
create index if not exists idx_wholesale_device_model_codes_active on wholesale_device_model_codes(active);

-- ----------------------------------------------------------------------------
-- 3. updated_at auto-touch — same trigger shape used elsewhere in this repo
--    for tables with an updated_at column, so DESK edits don't have to
--    remember to set it by hand.
-- ----------------------------------------------------------------------------
create or replace function wholesale_easy_search_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_wholesale_device_models_touch_updated_at on wholesale_device_models;
create trigger trg_wholesale_device_models_touch_updated_at
  before update on wholesale_device_models
  for each row execute function wholesale_easy_search_touch_updated_at();

drop trigger if exists trg_wholesale_device_model_codes_touch_updated_at on wholesale_device_model_codes;
create trigger trg_wholesale_device_model_codes_touch_updated_at
  before update on wholesale_device_model_codes
  for each row execute function wholesale_easy_search_touch_updated_at();

-- ----------------------------------------------------------------------------
-- 4. RLS — enabled, zero policies. Same "deny-all by omission" posture as
--    every other wholesale_* table in this repo (see wholesale-migration.sql
--    and wholesale-navigation-migration.sql): anon/authenticated get zero
--    direct access; only the service_role key (used server-side only, in
--    api/wholesale-easy-search.js on the website and api/wholesale-admin.js
--    on Desk) can read or write these tables. No anon/authenticated policy
--    is added here, on purpose.
-- ----------------------------------------------------------------------------
alter table wholesale_device_models enable row level security;
alter table wholesale_device_model_codes enable row level security;

commit;

-- ============================================================================
-- Not part of the transaction above, on purpose — read this, do not run it
-- as part of this file:
--
--   Run supabase/wholesale-easy-search-preflight.sql BEFORE this file.
--
--   Run supabase/wholesale-easy-search-verify.sql AFTER this file, to
--   confirm every table/column/constraint/index/trigger/RLS setting landed
--   exactly as declared.
--
--   supabase/wholesale-easy-search-rollback.sql documents how to undo every
--   object this file creates, for reference only — it is never run
--   automatically and is not part of this migration. The actual "drop
--   table" statements are commented out there on purpose: dropping these
--   tables would destroy any device/code data an admin has already loaded
--   through Desk, which is never acceptable as an automated step.
--
--   Seed data (the verified Apple/Samsung catalog) ships as its own
--   separate, reviewed file — supabase/wholesale-easy-search-seed.sql,
--   generated from scripts/wholesaleEasySearchSeed.data.js the same way
--   wholesale-seed-initial-catalog.sql is generated from
--   scripts/wholesaleCatalogSeed.data.js — never hand-written, never part
--   of this schema migration.
-- ============================================================================
