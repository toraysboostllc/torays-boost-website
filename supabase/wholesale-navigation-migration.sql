-- ============================================================================
-- Wholesale visual navigation (Equipment → Model → Failure → Details) — Fase 1
-- ============================================================================
-- Additive follow-up to wholesale-migration.sql. Run in the same Supabase
-- project's SQL Editor, AFTER wholesale-migration.sql and
-- wholesale-seed-initial-catalog.sql have already run at least once.
--
-- Scope of this file, exactly: new tables (equipment types, tags, images,
-- price history), the new equipment_type_id relation on wholesale_categories,
-- the "quote" pricing type, an explicit currency column, the atomic
-- price-change RPC (locked to service_role only) with its own audit trail,
-- the 8 initial equipment-type/tag-lens rows, and the backfill of the 21
-- existing categories onto those rows.
--
-- Security hardening in this revision (all still unexecuted, unreviewed by
-- Postgres): the RPC explicitly REVOKEs EXECUTE from public/anon/authenticated
-- and GRANTs it only to service_role, runs as SECURITY INVOKER (never
-- DEFINER — see step 8), validates every input itself (admin existence,
-- service existence, currency, pricing_type, and per-type amount shape)
-- instead of trusting the CHECK constraint alone to catch bad calls, and
-- wholesale_images is redesigned from a generic owner_type/owner_id pair to
-- three nullable foreign keys with a CHECK guaranteeing exactly one is set —
-- a real, enforced reference, not just an untyped uuid. The RPC also reads
-- the row with SELECT ... FOR UPDATE (serializing concurrent price changes
-- on the same service, see the RPC's own comment for the exact sequence)
-- and skips both the UPDATE and the history INSERT entirely when the
-- submitted values are identical to what is already stored, returning
-- 'unchanged' instead of fabricating a no-op history row.
--
-- Explicitly OUT of scope for this file (deferred to a later phase, once
-- authorized): the "ficha profesional" columns on wholesale_services
-- (explanation/complexity/includes/excludes/warranty/estimated_time/
-- youtube_url), any change to DESK, any change to the wholesale-prices.js /
-- wholesale-admin.js APIs, any change to the seed generator. In particular,
-- Phase 2 (DESK's API layer) is what must make requireAdmin()'s own
-- server-resolved admin id the ONLY source of p_admin_id ever passed to the
-- RPC below — never a value read off the request body. This migration's
-- RPC signature (a uuid parameter, plus its own independent existence/role
-- check against `profiles`) is what makes that the only sane way to call it,
-- but the actual wiring is Phase 2 code, not SQL.
--
-- Untouched by this file, on purpose, by explicit requirement: every column
-- and row already in wholesale_shops, wholesale_devices, wholesale_sessions,
-- wholesale_access_log — and every price, active flag, slug, sort_order, and
-- note already on wholesale_categories/wholesale_services. This file only
-- ever ADDS relations/columns (equipment_type_id, currency) and a widened
-- price-type option ('quote') to those two tables; it never UPDATEs an
-- existing price, an existing `active` value, a slug, a sort_order, or a
-- note. The new `currency` column is backfilled to 'USD' for all 74 existing
-- rows via its own NOT NULL DEFAULT, in the same ALTER — no separate UPDATE.
--
-- Idempotent throughout — every object uses IF NOT EXISTS / ON CONFLICT DO
-- NOTHING / a guarded UPDATE / DROP ... IF EXISTS before every ADD
-- CONSTRAINT, and the whole file is wrapped in one explicit transaction: if
-- anything fails, Postgres rolls back everything, never a half-applied
-- schema. GRANT/REVOKE are inherently idempotent in Postgres (re-running
-- them is a no-op, never an error), so they need no extra guard.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Equipment types — the 8 cards on the portal's home screen (7 real
--    equipment types + Microsoldering as a tag-lens, see step 10 below).
-- ----------------------------------------------------------------------------
create table if not exists wholesale_equipment_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  -- true only for the single Microsoldering row: the shop-facing app treats
  -- a tag-lens equipment type as "browse services tagged <slug>, grouped by
  -- their REAL equipment/model" instead of "browse this type's own models".
  -- DESK still administers it (order/active/photo) through the exact same
  -- Equipment Types screen as every other row — no special-cased UI.
  is_tag_lens boolean not null default false,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_wholesale_equipment_types_sort on wholesale_equipment_types(sort_order);

-- ----------------------------------------------------------------------------
-- 2. wholesale_categories gains a relation to its equipment type. Nullable
--    for now — the backfill below (step 11) fills in all 21 existing rows,
--    but this file deliberately stops short of ALTER ... SET NOT NULL. That
--    is a second, separate script, run only after the read-only verification
--    query (see wholesale-navigation-verify.sql) confirms zero gaps.
-- ----------------------------------------------------------------------------
alter table wholesale_categories
  add column if not exists equipment_type_id uuid references wholesale_equipment_types(id);
create index if not exists idx_wholesale_categories_equipment_type on wholesale_categories(equipment_type_id);

-- ----------------------------------------------------------------------------
-- 3. Tags — administrable, many-to-many with services. Microsoldering is the
--    first tag seeded (step 10), but this is a general mechanism, not a
--    microsoldering-specific column — any future tag needs zero migration.
-- ----------------------------------------------------------------------------
create table if not exists wholesale_tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists wholesale_service_tags (
  service_id uuid not null references wholesale_services(id) on delete cascade,
  tag_id uuid not null references wholesale_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (service_id, tag_id)
);
create index if not exists idx_wholesale_service_tags_tag on wholesale_service_tags(tag_id);

-- ----------------------------------------------------------------------------
-- 4. Images — one table for equipment types, categories, and services.
--    Deliberately NOT a generic owner_type/owner_id pair: that pattern can't
--    be given a real foreign key (owner_id would have to point at whichever
--    table owner_type names, which vanilla Postgres can't express), so a bad
--    owner_id would silently point at nothing. Instead, three nullable FK
--    columns — each individually enforced by Postgres — plus a CHECK that
--    requires EXACTLY ONE of them to be set (never zero, never more than
--    one). `on delete cascade` on all three: if the equipment
--    type/category/service an image belongs to is ever deleted, its images
--    go with it rather than becoming orphaned rows. `storage_path` is a
--    bucket-relative path only, never a full URL — signed URLs only,
--    private bucket, nothing guessable.
-- ----------------------------------------------------------------------------
create table if not exists wholesale_images (
  id uuid primary key default gen_random_uuid(),
  equipment_type_id uuid references wholesale_equipment_types(id) on delete cascade,
  category_id uuid references wholesale_categories(id) on delete cascade,
  service_id uuid references wholesale_services(id) on delete cascade,
  storage_path text not null,
  alt_text text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table wholesale_images drop constraint if exists wholesale_images_exactly_one_owner;
alter table wholesale_images add constraint wholesale_images_exactly_one_owner
  check (
    (case when equipment_type_id is not null then 1 else 0 end
     + case when category_id is not null then 1 else 0 end
     + case when service_id is not null then 1 else 0 end) = 1
  );
create index if not exists idx_wholesale_images_equipment_type on wholesale_images(equipment_type_id) where equipment_type_id is not null;
create index if not exists idx_wholesale_images_category on wholesale_images(category_id) where category_id is not null;
create index if not exists idx_wholesale_images_service on wholesale_images(service_id) where service_id is not null;

-- ----------------------------------------------------------------------------
-- 5. Price history — one row per price change, written only by the atomic
--    RPC in step 8, never by a bare UPDATE from application code. Captures
--    currency alongside every other old/new field (step 6 adds currency to
--    wholesale_services itself). `changed_by` is `on delete set null` (not
--    cascade): if an admin's profile is ever removed later, the historical
--    record of what they changed and when must survive — only the "who"
--    goes blank, nothing about the change itself is lost.
-- ----------------------------------------------------------------------------
create table if not exists wholesale_price_history (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references wholesale_services(id) on delete cascade,
  changed_by uuid references profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  old_pricing_type text,
  old_fixed_price numeric(10, 2),
  old_price_min numeric(10, 2),
  old_price_max numeric(10, 2),
  old_currency text,
  new_pricing_type text,
  new_fixed_price numeric(10, 2),
  new_price_min numeric(10, 2),
  new_price_max numeric(10, 2),
  new_currency text
);
create index if not exists idx_wholesale_price_history_service on wholesale_price_history(service_id);
create index if not exists idx_wholesale_price_history_created on wholesale_price_history(changed_at desc);

-- ----------------------------------------------------------------------------
-- 6. Currency — every service is USD today; this makes that explicit and
--    enforced at the schema level instead of merely assumed. NOT NULL
--    DEFAULT 'USD' backfills all 74 existing rows in the same ALTER — no
--    separate UPDATE statement, no window where a row could have a null
--    currency. The CHECK constraint is deliberately just as strict as the
--    default: if a genuine second currency is ever needed, that is its own
--    reviewed migration, not a silent side effect of this one.
-- ----------------------------------------------------------------------------
alter table wholesale_services add column if not exists currency text not null default 'USD';
alter table wholesale_services drop constraint if exists wholesale_services_currency_check;
alter table wholesale_services add constraint wholesale_services_currency_check
  check (currency = 'USD');

-- ----------------------------------------------------------------------------
-- 7. "Consultar / sin precio" — a third pricing_type, alongside the existing
--    fixed/range, for services whose price depends on the diagnosis. Backed
--    by a real CHECK constraint (not just application-level validation) that
--    encodes ALL of: non-negative amounts, min <= max for range, and exactly
--    the right fields populated (never a stray number) for each type —
--    enforced no matter what code path writes to this table, present or
--    future. Verified against all 74 existing services (see
--    tests/wholesaleNavigationMigration.test.js) before this constraint is
--    ever proposed to run for real.
-- ----------------------------------------------------------------------------
alter table wholesale_services drop constraint if exists wholesale_services_pricing_type_check;
alter table wholesale_services add constraint wholesale_services_pricing_type_check
  check (pricing_type in ('fixed', 'range', 'quote'));

alter table wholesale_services drop constraint if exists wholesale_services_pricing_values_check;
alter table wholesale_services add constraint wholesale_services_pricing_values_check
  check (
    (pricing_type = 'fixed'
      and fixed_price is not null and fixed_price >= 0
      and price_min is null and price_max is null)
    or (pricing_type = 'range'
      and fixed_price is null
      and price_min is not null and price_min >= 0
      and price_max is not null and price_max >= 0
      and price_min <= price_max)
    or (pricing_type = 'quote'
      and fixed_price is null and price_min is null and price_max is null)
  );

-- ----------------------------------------------------------------------------
-- 8. Atomic price change + audit trail — ONE function, ONE transaction.
--    Every guard below raises and aborts the whole call (plpgsql rolls back
--    on exception), so there is no code path that updates the price without
--    also recording history, and no code path that records history for a
--    price that was actually rejected. The admin/service/currency/shape
--    checks are deliberately explicit here — not left to the CHECK
--    constraint alone — so a bad call gets a clear, specific rejection
--    reason instead of a generic constraint-violation error.
--
--    Called with the SERVICE ROLE key from api/wholesale-admin.js (DESK)
--    exactly like wholesale_regenerate_shop_code() already is. p_admin_id is
--    only ever what that trusted server-side code passes in — which admin
--    that is must come from requireAdmin()'s own resolution of the caller's
--    Supabase Auth token against `profiles`, never a value read straight off
--    the request body (Phase 2's API code, not this migration, is what
--    enforces that wiring). The admin-existence check below is this
--    function's own independent backstop: even if some future caller ever
--    got that wiring wrong, an id that isn't a real, currently-approved
--    admin in `profiles` is rejected before anything is written.
--
--    Concurrency: the row is read with `SELECT ... FOR UPDATE`, which takes
--    a row lock that is held until this function's transaction commits (or
--    rolls back). If two admins submit a price change for the SAME service
--    at nearly the same moment, they are serialized, not raced:
--      1. Admin A's call reaches `SELECT ... FOR UPDATE` first and acquires
--         the lock. It validates, updates the row A -> B, inserts a history
--         row (old = A, new = B), and its transaction commits, releasing
--         the lock.
--      2. Admin B's call was blocked at `SELECT ... FOR UPDATE` this whole
--         time (Postgres makes a second FOR UPDATE on the same row simply
--         wait, it does not error). Once A's lock is released, B's SELECT
--         proceeds and reads the row AS IT NOW STANDS — v_old is B, the
--         value A just wrote, not the stale A that B's own client may have
--         loaded onto its screen before submitting.
--      3. B's call then updates B -> C and inserts a SECOND history row
--         (old = B, new = C).
--    Net effect: the history is a correct, contiguous chain (A->B, B->C) —
--    never two rows that both claim `old = A`, which would misrepresent
--    what actually happened and make the audit trail wrong. Neither admin's
--    change is silently lost or overwritten by the other; B's write is
--    exactly what B asked for, applied on top of A's already-committed
--    change, in true submission order.
--
--    No-op guard: if every field B submits is identical to what is already
--    stored (pricing_type, fixed_price, price_min, price_max, currency, all
--    compared with `IS NOT DISTINCT FROM` so NULLs compare correctly), the
--    function returns 'unchanged' immediately — no UPDATE, no history row.
--    This keeps wholesale_price_history a record of real changes only: an
--    admin re-saving a form without changing anything (or two admins
--    independently "changing" a price to the value it already has) does not
--    fabricate a fake A -> A entry in the audit trail.
-- ----------------------------------------------------------------------------
create or replace function wholesale_update_service_price(
  p_service_id uuid,
  p_admin_id uuid,
  p_pricing_type text,
  p_fixed_price numeric,
  p_price_min numeric,
  p_price_max numeric,
  p_currency text default 'USD'
)
returns text -- 'updated' or 'unchanged'
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_old wholesale_services%rowtype;
begin
  if not exists (
    select 1 from profiles where id = p_admin_id and role = 'admin' and status = 'approved'
  ) then
    raise exception 'invalid_admin';
  end if;

  select * into v_old
    from wholesale_services
    where id = p_service_id
    for update;
  if not found then
    raise exception 'service_not_found';
  end if;

  if p_currency is distinct from 'USD' then
    raise exception 'invalid_currency';
  end if;

  if p_pricing_type not in ('fixed', 'range', 'quote') then
    raise exception 'invalid_pricing_type';
  end if;

  -- Mirrors wholesale_services_pricing_values_check exactly.
  if p_pricing_type = 'fixed' then
    if p_fixed_price is null or p_fixed_price < 0
       or p_price_min is not null or p_price_max is not null then
      raise exception 'invalid_fixed_price';
    end if;
  elsif p_pricing_type = 'range' then
    if p_fixed_price is not null
       or p_price_min is null or p_price_min < 0
       or p_price_max is null or p_price_max < 0
       or p_price_min > p_price_max then
      raise exception 'invalid_range_price';
    end if;
  else -- quote
    if p_fixed_price is not null or p_price_min is not null or p_price_max is not null then
      raise exception 'invalid_quote_price';
    end if;
  end if;

  if v_old.pricing_type is not distinct from p_pricing_type
     and v_old.fixed_price is not distinct from p_fixed_price
     and v_old.price_min is not distinct from p_price_min
     and v_old.price_max is not distinct from p_price_max
     and v_old.currency is not distinct from p_currency
  then
    return 'unchanged';
  end if;

  update wholesale_services
    set pricing_type = p_pricing_type,
        fixed_price = p_fixed_price,
        price_min = p_price_min,
        price_max = p_price_max,
        currency = p_currency,
        updated_at = now()
    where id = p_service_id;

  insert into wholesale_price_history (
    service_id, changed_by,
    old_pricing_type, old_fixed_price, old_price_min, old_price_max, old_currency,
    new_pricing_type, new_fixed_price, new_price_min, new_price_max, new_currency
  ) values (
    p_service_id, p_admin_id,
    v_old.pricing_type, v_old.fixed_price, v_old.price_min, v_old.price_max, v_old.currency,
    p_pricing_type, p_fixed_price, p_price_min, p_price_max, p_currency
  );

  return 'updated';
end;
$$;

-- Locked to service_role only. Postgres grants EXECUTE on a newly created
-- function to PUBLIC by default — meaning without the REVOKE below, anon and
-- authenticated really could call this RPC directly (RLS on the underlying
-- tables would likely still block the writes in a standard Supabase setup,
-- since anon/authenticated are not exempt from RLS, but this REVOKE removes
-- the attempt at the function-call layer entirely, before RLS is ever
-- reached — belt and suspenders, not reliance on a single layer).
--
-- SECURITY INVOKER (explicit, not just the implicit default) is correct
-- here, not SECURITY DEFINER: the only role ever granted EXECUTE is
-- service_role, which already bypasses RLS via its own role membership —
-- running this function AS service_role already reaches every row it needs
-- to. SECURITY DEFINER would run the function body as its OWNER regardless
-- of caller, which is unnecessary privilege escalation this function has no
-- reason to take on, so it is deliberately not used. search_path is pinned
-- anyway as cheap defense-in-depth even under INVOKER.
revoke execute on function wholesale_update_service_price(uuid, uuid, text, numeric, numeric, numeric, text) from public, anon, authenticated;
grant execute on function wholesale_update_service_price(uuid, uuid, text, numeric, numeric, numeric, text) to service_role;

-- ----------------------------------------------------------------------------
-- 9. RLS — identical posture to every existing wholesale_* table: enabled,
--    zero policies. That means deny-all for anon and authenticated; only the
--    service_role key (used exclusively inside serverless functions) can
--    reach these tables directly. The RPC above adds its own separate lock
--    (REVOKE/GRANT on the function itself) on top of this table-level
--    deny-all — two independent barriers, not one.
-- ----------------------------------------------------------------------------
alter table wholesale_equipment_types enable row level security;
alter table wholesale_tags enable row level security;
alter table wholesale_service_tags enable row level security;
alter table wholesale_images enable row level security;
alter table wholesale_price_history enable row level security;
-- No policies added — do not add anon/authenticated policies here without
-- re-checking that wholesale pricing/media still can't leak to a retail
-- visitor or an unapproved shop.

-- ----------------------------------------------------------------------------
-- 10. The 8 initial rows: 7 real equipment types + Microsoldering as the
--     tag-lens. Idempotent by slug — safe to run more than once, never
--     duplicates, never overwrites a name/order an admin may have already
--     edited from DESK after the first run.
-- ----------------------------------------------------------------------------
insert into wholesale_equipment_types (slug, name, sort_order) values
  ('iphone', 'iPhone', 1),
  ('ipad', 'iPad', 2),
  ('macbook', 'MacBook', 3),
  ('laptops', 'Laptops', 4),
  ('gaming-laptops', 'Gaming Laptops', 5),
  ('video-consoles', 'Video Consoles', 6),
  ('controllers', 'Controllers', 7)
on conflict (slug) do nothing;

insert into wholesale_equipment_types (slug, name, is_tag_lens, sort_order) values
  ('microsoldering', 'Microsoldering', true, 8)
on conflict (slug) do nothing;

insert into wholesale_tags (slug, name) values
  ('microsoldering', 'Microsoldering')
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- 11. Backfill — the 21 existing categories, mapped to their equipment type
--     by slug, exactly once each. Every UPDATE carries
--     "and equipment_type_id is null": a category that already has a value
--     (from a prior run of this same file, OR from an admin's own later
--     reassignment via DESK) is never touched again. Nothing here writes
--     price, active, slug, sort_order, or notes — only equipment_type_id.
-- ----------------------------------------------------------------------------
update wholesale_categories set equipment_type_id =
  (select id from wholesale_equipment_types where slug = 'iphone')
  where slug in ('iphone-7-11', 'iphone-12-14', 'iphone-15-17')
  and equipment_type_id is null;

update wholesale_categories set equipment_type_id =
  (select id from wholesale_equipment_types where slug = 'ipad')
  where slug in ('ipad-7-8-9', 'ipad-10', 'ipad-11', 'ipad-pro-11-123',
    'ipad-pro-129-123', 'ipad-pro-11-4plus', 'ipad-pro-129-4plus')
  and equipment_type_id is null;

update wholesale_categories set equipment_type_id =
  (select id from wholesale_equipment_types where slug = 'macbook')
  where slug in ('macbook-air', 'macbook-pro')
  and equipment_type_id is null;

update wholesale_categories set equipment_type_id =
  (select id from wholesale_equipment_types where slug = 'laptops')
  where slug = 'laptops-normal'
  and equipment_type_id is null;

update wholesale_categories set equipment_type_id =
  (select id from wholesale_equipment_types where slug = 'gaming-laptops')
  where slug = 'laptops-gamer'
  and equipment_type_id is null;

update wholesale_categories set equipment_type_id =
  (select id from wholesale_equipment_types where slug = 'video-consoles')
  where slug in ('ps5', 'xbox-series-x', 'switch')
  and equipment_type_id is null;

update wholesale_categories set equipment_type_id =
  (select id from wholesale_equipment_types where slug = 'controllers')
  where slug in ('ps5-dualsense', 'ps5-dualsense-edge', 'xbox-controller', 'xbox-elite-2')
  and equipment_type_id is null;

commit;

-- ============================================================================
-- Not part of the transaction above, on purpose — read this, do not run it
-- as part of this file:
--
--   Run supabase/wholesale-navigation-verify.sql AFTER this file, before
--   ever proposing `alter table wholesale_categories alter column
--   equipment_type_id set not null`. That NOT NULL step is intentionally a
--   separate, later script — not included here — gated on that verification
--   query returning zero rows.
--
--   supabase/wholesale-navigation-rollback.sql documents how to undo every
--   object this file creates, for reference only — it is never run
--   automatically and is not part of this migration.
-- ============================================================================
