-- ============================================================================
-- Wholesale pricing intelligence — recommended price + target margin +
-- rounding + Torays Boost Sales module config
-- ============================================================================
-- Additive follow-up to wholesale-migration.sql and
-- wholesale-navigation-migration.sql. Run in the same Supabase project's SQL
-- Editor, AFTER both of those have already run at least once.
--
-- Scope of this file, exactly: one new singleton settings table
-- (wholesale_portal_settings), two new nullable columns on
-- wholesale_services (recommended_price, target_margin_percent), four new
-- nullable columns on wholesale_price_history (so the SAME audit table can
-- also record a pricing-intelligence change, not a second audit table), and
-- a hardened wholesale_update_portal_settings RPC. The existing
-- wholesale_update_service_price RPC's signature, behavior, and every
-- existing call site are untouched by this file. Saving a service's
-- recommended_price/target_margin_percent is done exclusively through
-- wholesale_update_service_full (wholesale-service-atomic-save-migration.sql)
-- — no sibling RPC for those two columns exists in this file; an earlier
-- draft of this migration briefly introduced one
-- (wholesale_update_service_pricing_intelligence) but it was audited as
-- fully disconnected from the UI after wholesale_update_service_full
-- shipped, and removed before this migration ever ran in production.
--
-- Deliberately NOT in this file (owner's explicit decision, see the
-- conversation this migration was approved in): no new equipment types for
-- PS5/Xbox/Switch (that split is now handled entirely by a presentation-only
-- adapter in the website code, never a schema change — wholesale_categories/
-- wholesale_equipment_types relations are 100% untouched here), no
-- category-level target_margin_percent, no draft/published status column
-- (active stays the single visible/published toggle it already is), no
-- updated_by column on wholesale_categories/wholesale_services (the existing
-- wholesale_price_history.changed_by, extended below, is reused instead of
-- adding a new "who touched this row last" column).
--
-- Idempotent throughout — IF NOT EXISTS / ON CONFLICT DO NOTHING / a guarded
-- DROP ... IF EXISTS before every ADD CONSTRAINT — wrapped in one explicit
-- transaction: if anything fails, Postgres rolls back everything, never a
-- half-applied schema. GRANT/REVOKE are inherently idempotent.
--
-- No DELETE, no DROP TABLE, no DROP COLUMN, no data loss anywhere in this
-- file. Every existing row in wholesale_services/wholesale_price_history
-- keeps every value it already has; the new columns are nullable and add
-- nothing to any row until an admin explicitly sets them from DESK.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. wholesale_portal_settings — a single-row config table (classic
--    "singleton table" shape: primary key pinned to the literal value 1,
--    enforced by the CHECK below, so a second row can never exist). Holds
--    the global fallback margin/rounding rule used when a service has no
--    manual recommended_price and no per-service target_margin_percent, plus
--    the Torays Boost Sales module's visibility/status/entry-block flags.
-- ----------------------------------------------------------------------------
create table if not exists wholesale_portal_settings (
  id int primary key default 1 check (id = 1),
  default_target_margin_percent numeric(5, 2) not null default 40
    check (default_target_margin_percent >= 0 and default_target_margin_percent < 100),
  rounding_rule text not null default 'nearest_1'
    check (rounding_rule in ('none', 'nearest_1', 'nearest_5', 'charm_99')),
  sales_visible boolean not null default true,
  sales_status text not null default 'maintenance'
    check (sales_status in ('maintenance', 'active')),
  sales_entry_blocked boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null
);

insert into wholesale_portal_settings (id) values (1)
on conflict (id) do nothing;

alter table wholesale_portal_settings enable row level security;
-- No policies added, on purpose — same deny-all-except-service_role posture
-- as every other wholesale_* table. Read/written exclusively from
-- api/wholesale-admin.js (DESK, writes) and api/wholesale-prices.js (website,
-- reads only) with the service-role key.

-- ----------------------------------------------------------------------------
-- 2. wholesale_services — the two columns a service actually needs for
--    pricing intelligence. Both nullable: a service with neither set falls
--    all the way back to wholesale_portal_settings.default_target_margin_percent
--    at read time (application logic, not a DB default, so changing the
--    global default retroactively affects every service that has no
--    override — exactly the fallback behavior specified).
-- ----------------------------------------------------------------------------
alter table wholesale_services add column if not exists recommended_price numeric(10, 2);
alter table wholesale_services add column if not exists target_margin_percent numeric(5, 2);

alter table wholesale_services drop constraint if exists wholesale_services_recommended_price_check;
alter table wholesale_services add constraint wholesale_services_recommended_price_check
  check (recommended_price is null or recommended_price >= 0);

alter table wholesale_services drop constraint if exists wholesale_services_target_margin_percent_check;
alter table wholesale_services add constraint wholesale_services_target_margin_percent_check
  check (target_margin_percent is null or (target_margin_percent >= 0 and target_margin_percent < 100));

-- ----------------------------------------------------------------------------
-- 3. wholesale_price_history — four new nullable columns so a
--    pricing-intelligence change (recommended_price / target_margin_percent)
--    is recorded in the SAME audit trail as a wholesale-price change,
--    reusing changed_by/changed_at rather than introducing a parallel table.
--    A row written by wholesale_update_service_price (existing RPC) leaves
--    these four columns null; a row written by
--    wholesale_update_service_full (wholesale-service-atomic-save-migration.sql)
--    leaves old_pricing_type/old_fixed_price/etc. null instead — never both
--    populated by the same call, and never required to be.
-- ----------------------------------------------------------------------------
alter table wholesale_price_history add column if not exists old_recommended_price numeric(10, 2);
alter table wholesale_price_history add column if not exists new_recommended_price numeric(10, 2);
alter table wholesale_price_history add column if not exists old_target_margin_percent numeric(5, 2);
alter table wholesale_price_history add column if not exists new_target_margin_percent numeric(5, 2);

-- ----------------------------------------------------------------------------
-- 4. RLS — wholesale_portal_settings already covered in step 1. No change to
--    RLS on wholesale_services or wholesale_price_history: both already have
--    RLS enabled with zero policies from prior migrations, and the two new
--    nullable columns on each don't change that posture at all.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 5. Atomic portal-settings update — admin-check/no-op-guard shape (SELECT
--    ... FOR UPDATE row lock for correct concurrent-edit ordering, no-op
--    guard so an unchanged resubmit writes nothing, SECURITY INVOKER since
--    only service_role — which already bypasses RLS — is ever granted
--    EXECUTE), for the single wholesale_portal_settings row. No history
--    table for this one (it's a global config row, not a per-service price)
--    — updated_by/updated_at on the row itself is the audit trail, matching
--    what DESK's admin UI needs to show ("last changed by X on date").
--    Every non-numeric-checked parameter is explicitly NULL-checked before
--    use (p_rounding_rule / p_sales_visible / p_sales_status /
--    p_sales_entry_blocked) — `x not in (...)` and `x is not distinct from`
--    both silently evaluate to NULL/false-like outcomes for a NULL input in
--    Postgres rather than raising, so a NULL that slips past the caller
--    would otherwise reach the UPDATE and either write NULL into a NOT NULL
--    column (raising a generic not-null-violation with no clear message) or,
--    for the boolean flags, simply fail to no-op correctly. The IF NOT FOUND
--    check after the row lock exists so this function can never claim
--    'updated' when the singleton row is somehow missing.
-- ----------------------------------------------------------------------------
create or replace function wholesale_update_portal_settings(
  p_admin_id uuid,
  p_default_target_margin_percent numeric,
  p_rounding_rule text,
  p_sales_visible boolean,
  p_sales_status text,
  p_sales_entry_blocked boolean
)
returns text -- 'updated' or 'unchanged'
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_old wholesale_portal_settings%rowtype;
begin
  if not exists (
    select 1 from profiles where id = p_admin_id and role = 'admin' and status = 'approved'
  ) then
    raise exception 'invalid_admin';
  end if;

  if p_default_target_margin_percent is null
     or p_default_target_margin_percent < 0 or p_default_target_margin_percent >= 100 then
    raise exception 'invalid_default_target_margin_percent';
  end if;

  if p_rounding_rule is null or p_rounding_rule not in ('none', 'nearest_1', 'nearest_5', 'charm_99') then
    raise exception 'invalid_rounding_rule';
  end if;

  if p_sales_visible is null then
    raise exception 'invalid_sales_visible';
  end if;

  if p_sales_status is null or p_sales_status not in ('maintenance', 'active') then
    raise exception 'invalid_sales_status';
  end if;

  if p_sales_entry_blocked is null then
    raise exception 'invalid_sales_entry_blocked';
  end if;

  select * into v_old from wholesale_portal_settings where id = 1 for update;
  if not found then
    raise exception 'settings_row_missing';
  end if;

  if v_old.default_target_margin_percent is not distinct from p_default_target_margin_percent
     and v_old.rounding_rule is not distinct from p_rounding_rule
     and v_old.sales_visible is not distinct from p_sales_visible
     and v_old.sales_status is not distinct from p_sales_status
     and v_old.sales_entry_blocked is not distinct from p_sales_entry_blocked
  then
    return 'unchanged';
  end if;

  update wholesale_portal_settings
    set default_target_margin_percent = p_default_target_margin_percent,
        rounding_rule = p_rounding_rule,
        sales_visible = p_sales_visible,
        sales_status = p_sales_status,
        sales_entry_blocked = p_sales_entry_blocked,
        updated_at = now(),
        updated_by = p_admin_id
    where id = 1;

  return 'updated';
end;
$$;

revoke execute on function wholesale_update_portal_settings(uuid, numeric, text, boolean, text, boolean) from public, anon, authenticated;
grant execute on function wholesale_update_portal_settings(uuid, numeric, text, boolean, text, boolean) to service_role;

commit;

-- ============================================================================
-- Not part of the transaction above, on purpose — read this, do not run it
-- as part of this file:
--
--   Run supabase/wholesale-pricing-intelligence-preflight.sql BEFORE this
--   file, and supabase/wholesale-pricing-intelligence-verify.sql AFTER.
--
--   supabase/wholesale-pricing-intelligence-rollback.sql documents how to
--   undo every object this file creates, for reference only — it is never
--   run automatically and is not part of this migration.
-- ============================================================================
