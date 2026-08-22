-- ============================================================================
-- Global service warranty — one setting, applies to every quote
-- ============================================================================
-- Additive follow-up to wholesale-pricing-intelligence-migration.sql (which
-- created wholesale_portal_settings). Run in the same Supabase project's SQL
-- Editor, AFTER that migration has already run at least once.
--
-- Scope of this file, exactly: 4 new nullable-where-appropriate columns on
-- the EXISTING wholesale_portal_settings singleton row, one CHECK constraint
-- enforcing "if enabled, duration must be a positive, reasonably-bounded
-- number of days", and ONE NEW function, wholesale_update_portal_settings_v2.
-- This is a GLOBAL setting — configured once from DESK's Wholesale Shops ->
-- Catalog -> Pricing & Sales Settings panel, applied automatically to every
-- quote on the Website. There is no per-service, per-category, or
-- per-equipment-type warranty concept anywhere in this file: wholesale_
-- services, wholesale_categories, wholesale_equipment_types, and
-- wholesale_price_history are completely untouched.
--
-- ----------------------------------------------------------------------------
-- SAME two-RPC design already established by wholesale-price-tiers-
-- migration.sql for wholesale_update_service_full_v2, for the identical
-- reason: CREATE OR REPLACE FUNCTION only replaces a function with the SAME
-- argument list. wholesale_update_portal_settings (v1) takes 6 arguments;
-- adding 4 more warranty parameters would not "extend" it — it would create
-- a second, ambiguous overload reachable by the exact call PostgREST already
-- makes today. This file avoids that entirely:
--   1. Leaves wholesale_update_portal_settings() (v1, 6 arguments) COMPLETELY
--      UNTOUCHED — not read, not replaced, not referenced anywhere below.
--      Any caller still using v1 keeps working exactly as before; it simply
--      has no knowledge the 4 new warranty columns exist, so it never writes
--      them (they keep whatever value they already have — the column
--      DEFAULTs on first creation, or whatever a v2 caller set since).
--   2. Creates ONE NEW function, wholesale_update_portal_settings_v2, with
--      its own full 10-argument signature (the original 6 plus
--      p_warranty_enabled/p_warranty_duration_days/p_warranty_terms_en/
--      p_warranty_terms_es as ordinary, always-required parameters — no
--      optional-tristate flag, since v2's whole purpose is to manage all 10
--      fields together). DESK calls v2 explicitly, by its own distinct name.
-- ----------------------------------------------------------------------------
--
-- Old-caller safety without relying on v1 knowing about warranty: the CHECK
-- constraint below is a TABLE constraint, enforced on every UPDATE against
-- wholesale_portal_settings regardless of which function issued it. If v1 is
-- ever called after warranty has been configured, it does not touch the
-- warranty columns at all (they are not among its 6 parameters), so the
-- already-stored, already-valid warranty configuration is left exactly as it
-- was — there is no code path, old or new, that can silently corrupt it.
--
-- Idempotent throughout — IF NOT EXISTS / a guarded DROP ... IF EXISTS before
-- every ADD CONSTRAINT / CREATE OR REPLACE FUNCTION — wrapped in one explicit
-- transaction: if anything fails, Postgres rolls back everything, never a
-- half-applied schema.
--
-- No DELETE, no DROP TABLE, no DROP COLUMN, no data loss anywhere in this
-- file. Every existing column on the wholesale_portal_settings row (default
-- margin, rounding rule, Sales module flags) keeps its current value
-- untouched; the 4 new columns default to "warranty off" and add nothing
-- else until an admin explicitly configures it from DESK. No service price,
-- photo, description, recommendation, or history row is read or written by
-- this file at all.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. wholesale_portal_settings — the 4 new warranty columns.
--    warranty_enabled: NOT NULL, defaults false — "off" is always a valid,
--    unambiguous starting state, never NULL/tristate.
--    warranty_duration_days / warranty_terms_en / warranty_terms_es: nullable
--    — legal to be null/blank regardless of warranty_enabled's value; the
--    CHECK constraint below is what actually requires a positive duration
--    WHEN warranty is enabled, not a NOT NULL column constraint (which would
--    make "off" and "no duration yet" indistinguishable during data entry).
-- ----------------------------------------------------------------------------
alter table wholesale_portal_settings add column if not exists warranty_enabled boolean not null default false;
alter table wholesale_portal_settings add column if not exists warranty_duration_days integer;
alter table wholesale_portal_settings add column if not exists warranty_terms_en text;
alter table wholesale_portal_settings add column if not exists warranty_terms_es text;

-- Enabled -> duration must be a positive, reasonably-bounded number of days
-- (3650 = 10 years, generous enough for any real warranty this business
-- would ever offer, and a guard against an obvious data-entry mistake like
-- an extra zero). Disabled -> the column may be anything, including null —
-- this constraint places zero requirement on it, matching "si está
-- desactivada, no exigir duración" exactly. A schema-level guarantee,
-- independent of and in addition to the RPC's own explicit validation below
-- (same "never leave it to the CHECK constraint alone, but never rely on
-- application code alone either" pattern already used throughout this
-- project — see wholesale_services_price_tiers_check for the same
-- two-layer approach).
alter table wholesale_portal_settings drop constraint if exists wholesale_portal_settings_warranty_duration_check;
alter table wholesale_portal_settings add constraint wholesale_portal_settings_warranty_duration_check
  check (
    warranty_enabled = false
    or (warranty_duration_days is not null and warranty_duration_days > 0 and warranty_duration_days <= 3650)
  );

-- ----------------------------------------------------------------------------
-- 2. wholesale_update_portal_settings_v2 — a NEW, distinctly-named function.
--    wholesale_update_portal_settings() (v1, 6 arguments) is NOT referenced,
--    read, or replaced anywhere below — it is left byte-for-byte as it was
--    after wholesale-pricing-intelligence-migration.sql. v2's body is v1's
--    body verbatim, PLUS: 4 new required parameters, inline validation
--    mirroring wholesale_portal_settings_warranty_duration_check exactly,
--    and those 4 columns folded into the existing UPDATE/no-op comparison.
--    No history table involved (same as v1 — this is a global config row,
--    not a per-service price; updated_at/updated_by on the row itself is the
--    audit trail).
-- ----------------------------------------------------------------------------
create or replace function wholesale_update_portal_settings_v2(
  p_admin_id uuid,
  p_default_target_margin_percent numeric,
  p_rounding_rule text,
  p_sales_visible boolean,
  p_sales_status text,
  p_sales_entry_blocked boolean,
  p_warranty_enabled boolean,
  p_warranty_duration_days integer,
  p_warranty_terms_en text,
  p_warranty_terms_es text
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

  if p_warranty_enabled is null then
    raise exception 'invalid_warranty_enabled';
  end if;

  -- Mirrors wholesale_portal_settings_warranty_duration_check exactly,
  -- checked here explicitly so a bad request gets a clear, specific
  -- rejection reason instead of a generic constraint-violation error.
  -- Disabled -> no requirement on duration/terms at all (never exigir texto
  -- ni duración). Enabled -> duration required, positive, capped at 3650
  -- days; the EN terms text is required (the Website always has at least an
  -- English audience), the ES terms text is optional (fallback to EN at
  -- read time — see resolveWarrantyTerms in the website code).
  if p_warranty_enabled then
    if p_warranty_duration_days is null or p_warranty_duration_days <= 0 or p_warranty_duration_days > 3650 then
      raise exception 'invalid_warranty_duration_days';
    end if;
    if p_warranty_terms_en is null or length(btrim(p_warranty_terms_en)) = 0 then
      raise exception 'invalid_warranty_terms_en';
    end if;
  end if;

  if p_warranty_terms_en is not null and length(p_warranty_terms_en) > 2000 then
    raise exception 'invalid_warranty_terms_en';
  end if;

  if p_warranty_terms_es is not null and length(p_warranty_terms_es) > 2000 then
    raise exception 'invalid_warranty_terms_es';
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
     and v_old.warranty_enabled is not distinct from p_warranty_enabled
     and v_old.warranty_duration_days is not distinct from p_warranty_duration_days
     and v_old.warranty_terms_en is not distinct from p_warranty_terms_en
     and v_old.warranty_terms_es is not distinct from p_warranty_terms_es
  then
    return 'unchanged';
  end if;

  update wholesale_portal_settings
    set default_target_margin_percent = p_default_target_margin_percent,
        rounding_rule = p_rounding_rule,
        sales_visible = p_sales_visible,
        sales_status = p_sales_status,
        sales_entry_blocked = p_sales_entry_blocked,
        warranty_enabled = p_warranty_enabled,
        warranty_duration_days = p_warranty_duration_days,
        warranty_terms_en = p_warranty_terms_en,
        warranty_terms_es = p_warranty_terms_es,
        updated_at = now(),
        updated_by = p_admin_id
    where id = 1;

  return 'updated';
end;
$$;

revoke execute on function wholesale_update_portal_settings_v2(uuid, numeric, text, boolean, text, boolean, boolean, integer, text, text) from public, anon, authenticated;
grant execute on function wholesale_update_portal_settings_v2(uuid, numeric, text, boolean, text, boolean, boolean, integer, text, text) to service_role;

commit;

-- ============================================================================
-- Not part of the transaction above, on purpose — read this, do not run it
-- as part of this file:
--
--   Run supabase/wholesale-global-warranty-preflight.sql BEFORE this file,
--   and supabase/wholesale-global-warranty-verify.sql AFTER.
--
--   supabase/wholesale-global-warranty-rollback.sql documents how to undo
--   every object this file creates, for reference only — it is never run
--   automatically and is not part of this migration. Its non-destructive
--   path only ever drops the 4 new columns and wholesale_update_portal_
--   settings_v2 — it never touches wholesale_update_portal_settings() (v1),
--   the wholesale_portal_settings table itself, or any other column on it,
--   because this migration never touched them either.
-- ============================================================================
