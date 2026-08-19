-- ============================================================================
-- Wholesale price tiers — Silver (Competitive) / Purple (Recommended) /
-- Gold (High Profit) per-service pricing, Phase 1
-- ============================================================================
-- Additive follow-up to wholesale-migration.sql, wholesale-navigation-
-- migration.sql, wholesale-pricing-intelligence-migration.sql, and
-- wholesale-service-atomic-save-migration.sql. Run in the same Supabase
-- project's SQL Editor, AFTER all four of those have already run at least
-- once.
--
-- Scope of this file, exactly: two new nullable columns on
-- wholesale_services (competitive_price, high_profit_price — Purple reuses
-- the EXISTING recommended_price column unchanged, same meaning, same data,
-- no rename), a table CHECK enforcing "legacy (both null) or complete and
-- ordered (both set, alongside a non-null recommended_price, on a 'fixed'
-- service only)", four new nullable columns on wholesale_price_history for
-- the same audit trail wholesale-pricing-intelligence-migration.sql already
-- extended once, and ONE NEW function, wholesale_update_service_full_v2 —
-- see the corrected design note immediately below for why this is a new
-- function and not an extension of the existing one.
--
-- Phase 1 scope, deliberately: tiers apply ONLY to pricing_type = 'fixed'
-- services — 'range' and 'quote' services are completely untouched by this
-- feature and keep exactly the single-price experience they have today.
-- Widening to range/quote is an explicit future decision, not implied here.
--
-- ----------------------------------------------------------------------------
-- CORRECTED DESIGN — two distinct RPCs, never one overloaded name
-- ----------------------------------------------------------------------------
-- An earlier draft of this migration tried to "extend" wholesale_update_
-- service_full() by CREATE OR REPLACE-ing it with 3 new trailing DEFAULTed
-- parameters (12 args -> 15 args), reasoning that CREATE OR REPLACE would
-- keep it as the same function. That reasoning was wrong and this migration
-- does NOT do that. Per the CREATE FUNCTION documentation
-- (https://www.postgresql.org/docs/current/sql-createfunction.html):
-- "CREATE OR REPLACE FUNCTION ... if a function of the same name exists in
-- the same schema with the SAME ARGUMENT TYPES, it will be replaced" —
-- REPLACE only fires when the argument list matches exactly. A 15-argument
-- signature does not match a 12-argument one, so that statement would
-- actually have CREATED A SECOND, DISTINCT FUNCTION with the same name — an
-- overload — leaving the original 12-argument function fully intact
-- alongside it. Because the 3 new trailing parameters were declared with
-- DEFAULT, the 15-argument overload could ALSO be invoked with only 12
-- arguments — meaning a plain 12-argument call would then have two matching
-- candidates (the exact 12-arg function, and the 15-arg one via defaults),
-- which is exactly the ambiguous-overload situation Postgres's own function
-- resolution rules warn against, and which PostgREST (the layer every
-- caller here actually goes through) is known to resolve unreliably when it
-- happens. This file never creates that situation.
--
-- The corrected design instead:
--   1. Leaves wholesale_update_service_full() (12 arguments) COMPLETELY
--      UNTOUCHED — not read, not replaced, not referenced by CREATE OR
--      REPLACE anywhere in this file. Every existing caller (any DESK
--      deployment that predates this feature) keeps calling exactly that
--      function, by that exact name and signature, forever, with zero
--      change in behavior: it still never writes competitive_price/
--      high_profit_price, so a tier pair a newer DESK already configured on
--      a service is never touched by an old caller — not because of a flag
--      inside a shared function, but because the old function simply has no
--      knowledge those columns exist. See "old-caller safety" note below
--      for what DOES still protect the table itself.
--   2. Creates ONE NEW function, wholesale_update_service_full_v2, with an
--      unambiguous name and its own full 14-argument signature (the
--      original 12 plus p_competitive_price/p_high_profit_price as two
--      ordinary, always-required parameters — no boolean "am I managing
--      tiers this call" flag, because v2 is a dedicated function that
--      ALWAYS manages tiers; there is nothing to gate). New DESK deployments
--      call v2 explicitly, by its own distinct name. There is exactly one
--      function per name; PostgREST/Postgres never has to choose between
--      overloads for either name.
--
-- Old-caller safety without relying on the old function knowing about
-- tiers: the CHECK constraint below (wholesale_services_price_tiers_check)
-- is a TABLE constraint, not something wholesale_update_service_full() (v1)
-- enforces itself — it applies to every UPDATE against wholesale_services
-- regardless of which function issued it. If an old DESK calls v1 and
-- changes fixed_price or recommended_price in a way that would break the
-- ordering of tier values ALREADY stored on that row (e.g. raising
-- fixed_price above an already-set competitive_price), Postgres rejects the
-- UPDATE outright with a constraint violation — v1's transaction aborts,
-- nothing commits, and the previously-stored tier values are left exactly
-- as they were. There is no code path, old or new, that can silently null
-- or reorder a configured tier.
--
-- Idempotent throughout — IF NOT EXISTS / a guarded DROP ... IF EXISTS
-- before every ADD CONSTRAINT / CREATE OR REPLACE FUNCTION — wrapped in one
-- explicit transaction: if anything fails, Postgres rolls back everything,
-- never a half-applied schema.
--
-- No DELETE, no DROP TABLE, no DROP COLUMN, no data loss anywhere in this
-- file. Every existing row in wholesale_services/wholesale_price_history
-- keeps every value it already has; the new columns are nullable and add
-- nothing to any row until an admin explicitly configures all three tiers
-- from DESK. wholesale_update_service_full() (v1) is not altered in any way
-- by this file.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. wholesale_services — the two new tier columns. Both nullable: a
--    service with neither set is the "legacy" state (unchanged single-price
--    experience). recommended_price (already exists, unchanged) becomes the
--    Purple/Recommended tier's price the moment both new columns are set.
-- ----------------------------------------------------------------------------
alter table wholesale_services add column if not exists competitive_price numeric(10, 2);
alter table wholesale_services add column if not exists high_profit_price numeric(10, 2);

alter table wholesale_services drop constraint if exists wholesale_services_competitive_price_check;
alter table wholesale_services add constraint wholesale_services_competitive_price_check
  check (competitive_price is null or competitive_price >= 0);

alter table wholesale_services drop constraint if exists wholesale_services_high_profit_price_check;
alter table wholesale_services add constraint wholesale_services_high_profit_price_check
  check (high_profit_price is null or high_profit_price >= 0);

-- The single rule this whole feature is built around: no partial tier
-- configuration is ever a legal row, at the schema level, independent of
-- any application-code validation above it, AND independent of which
-- function (v1 or v2) issued the UPDATE. Exactly two shapes pass:
--   (a) competitive_price and high_profit_price both null — legacy,
--       single-price mode, recommended_price keeps its own existing
--       (independent, already-validated) meaning and optionality.
--   (b) pricing_type = 'fixed', and competitive_price, recommended_price,
--       high_profit_price, and fixed_price all non-null, ordered
--       fixed_price < competitive_price <= recommended_price <= high_profit_price.
-- Any other combination (one tier set and the other blank, tiers set on a
-- range/quote service, tiers out of order) is rejected by Postgres itself,
-- even if every application-layer check upstream of it were ever bypassed —
-- this is also what stops an old DESK (calling v1, which has no idea tiers
-- exist) from ever leaving a service in a broken/inconsistent tier state:
-- any edit that would break the ordering of already-stored tier values is
-- rejected outright, never silently adjusted.
alter table wholesale_services drop constraint if exists wholesale_services_price_tiers_check;
alter table wholesale_services add constraint wholesale_services_price_tiers_check
  check (
    (competitive_price is null and high_profit_price is null)
    or (
      pricing_type = 'fixed'
      and fixed_price is not null
      and competitive_price is not null
      and recommended_price is not null
      and high_profit_price is not null
      and competitive_price > fixed_price
      and recommended_price >= competitive_price
      and high_profit_price >= recommended_price
    )
  );

-- ----------------------------------------------------------------------------
-- 2. wholesale_price_history — four new nullable columns, same reuse-the-
--    existing-audit-table pattern wholesale-pricing-intelligence-migration.sql
--    already established for recommended_price/target_margin_percent. A row
--    written before this migration (or written by v1, which never touches
--    these columns) simply leaves these four columns null.
-- ----------------------------------------------------------------------------
alter table wholesale_price_history add column if not exists old_competitive_price numeric(10, 2);
alter table wholesale_price_history add column if not exists new_competitive_price numeric(10, 2);
alter table wholesale_price_history add column if not exists old_high_profit_price numeric(10, 2);
alter table wholesale_price_history add column if not exists new_high_profit_price numeric(10, 2);

-- ----------------------------------------------------------------------------
-- 3. wholesale_update_service_full_v2 — a NEW, distinctly-named function.
--    wholesale_update_service_full() (v1, 12 arguments) is NOT referenced,
--    read, or replaced anywhere below — it is left byte-for-byte as it was
--    after wholesale-service-atomic-save-migration.sql. v2's body is v1's
--    body verbatim, PLUS: two new required parameters
--    (p_competitive_price, p_high_profit_price — no default, no boolean
--    gate, since this function's entire purpose is to manage them),
--    inline validation mirroring wholesale_services_price_tiers_check
--    exactly, and those two columns folded into the existing UPDATE,
--    v_unchanged/v_price_fields_changed comparisons, and history INSERT.
-- ----------------------------------------------------------------------------
create or replace function public.wholesale_update_service_full_v2(
  p_service_id uuid,
  p_admin_id uuid,
  p_name text,
  p_notes text,
  p_is_microsoldering boolean,
  p_pricing_type text,
  p_fixed_price numeric,
  p_price_min numeric,
  p_price_max numeric,
  p_currency text,
  p_recommended_price numeric,
  p_target_margin_percent numeric,
  p_competitive_price numeric,
  p_high_profit_price numeric
)
returns text -- 'updated' or 'unchanged'
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_old public.wholesale_services%rowtype;
  v_tag_id uuid;
  v_has_tag boolean;
  v_want_tag boolean;
  v_unchanged boolean;
  v_price_fields_changed boolean;
begin
  if not exists (
    select 1 from public.profiles where id = p_admin_id and role = 'admin' and status = 'approved'
  ) then
    raise exception 'invalid_admin';
  end if;

  if p_name is null or length(btrim(p_name)) = 0 or length(p_name) > 200 then
    raise exception 'invalid_name';
  end if;

  if p_notes is not null and length(p_notes) > 2000 then
    raise exception 'invalid_notes';
  end if;

  if p_is_microsoldering is null then
    raise exception 'invalid_is_microsoldering';
  end if;

  if p_currency is distinct from 'USD' then
    raise exception 'invalid_currency';
  end if;

  if p_pricing_type is null or p_pricing_type not in ('fixed', 'range', 'quote') then
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

  if p_recommended_price is not null and p_recommended_price < 0 then
    raise exception 'invalid_recommended_price';
  end if;

  if p_target_margin_percent is not null
     and (p_target_margin_percent < 0 or p_target_margin_percent >= 100) then
    raise exception 'invalid_target_margin_percent';
  end if;

  -- Price tiers — always validated by this function (v2 has no "am I
  -- managing tiers this call" flag; managing tiers is its whole purpose).
  -- Mirrors wholesale_services_price_tiers_check exactly, checked here
  -- explicitly (same "never leave it to the CHECK constraint alone"
  -- reasoning as every other validation in this function) so a bad request
  -- gets a clear, specific rejection reason instead of a generic
  -- constraint-violation error. Both null is always legal (legacy/no
  -- tiers); anything else must be the complete, ordered, fixed-type-only
  -- trio.
  if p_competitive_price is not null or p_high_profit_price is not null then
    if p_pricing_type <> 'fixed' then
      raise exception 'invalid_price_tiers';
    end if;
    if p_competitive_price is null or p_high_profit_price is null or p_recommended_price is null then
      raise exception 'invalid_price_tiers';
    end if;
    if p_competitive_price < 0 or p_high_profit_price < 0 then
      raise exception 'invalid_price_tiers';
    end if;
    if not (
      p_competitive_price > p_fixed_price
      and p_recommended_price >= p_competitive_price
      and p_high_profit_price >= p_recommended_price
    ) then
      raise exception 'invalid_price_tiers';
    end if;
  end if;

  select * into v_old
    from public.wholesale_services
    where id = p_service_id
    for update;
  if not found then
    raise exception 'service_not_found';
  end if;

  select id into v_tag_id from public.wholesale_tags where slug = 'microsoldering';
  v_has_tag := v_tag_id is not null and exists (
    select 1 from public.wholesale_service_tags
    where service_id = p_service_id and tag_id = v_tag_id
  );
  v_want_tag := p_is_microsoldering;

  if v_want_tag and v_tag_id is null then
    raise exception 'microsoldering_tag_missing';
  end if;

  v_unchanged :=
    v_old.name is not distinct from p_name
    and v_old.notes is not distinct from p_notes
    and v_old.pricing_type is not distinct from p_pricing_type
    and v_old.fixed_price is not distinct from p_fixed_price
    and v_old.price_min is not distinct from p_price_min
    and v_old.price_max is not distinct from p_price_max
    and v_old.currency is not distinct from p_currency
    and v_old.recommended_price is not distinct from p_recommended_price
    and v_old.target_margin_percent is not distinct from p_target_margin_percent
    and v_old.competitive_price is not distinct from p_competitive_price
    and v_old.high_profit_price is not distinct from p_high_profit_price
    and v_has_tag is not distinct from v_want_tag;

  if v_unchanged then
    return 'unchanged';
  end if;

  -- A narrower question than v_unchanged above: whether a PRICE-relevant
  -- field changed (including the two tier columns), not whether anything at
  -- all changed. A name/notes/tag-only edit still updates the row and
  -- returns 'updated' below, but it is not a pricing event and must never
  -- fabricate a wholesale_price_history row that implies one.
  v_price_fields_changed := not (
    v_old.pricing_type is not distinct from p_pricing_type
    and v_old.fixed_price is not distinct from p_fixed_price
    and v_old.price_min is not distinct from p_price_min
    and v_old.price_max is not distinct from p_price_max
    and v_old.currency is not distinct from p_currency
    and v_old.recommended_price is not distinct from p_recommended_price
    and v_old.target_margin_percent is not distinct from p_target_margin_percent
    and v_old.competitive_price is not distinct from p_competitive_price
    and v_old.high_profit_price is not distinct from p_high_profit_price
  );

  update public.wholesale_services
    set name = p_name,
        notes = p_notes,
        pricing_type = p_pricing_type,
        fixed_price = p_fixed_price,
        price_min = p_price_min,
        price_max = p_price_max,
        currency = p_currency,
        recommended_price = p_recommended_price,
        target_margin_percent = p_target_margin_percent,
        competitive_price = p_competitive_price,
        high_profit_price = p_high_profit_price,
        updated_at = now()
    where id = p_service_id;

  if v_tag_id is not null then
    if v_want_tag and not v_has_tag then
      insert into public.wholesale_service_tags (service_id, tag_id) values (p_service_id, v_tag_id);
    elsif not v_want_tag and v_has_tag then
      delete from public.wholesale_service_tags where service_id = p_service_id and tag_id = v_tag_id;
    end if;
  end if;

  -- Exactly one row, and only when a price-relevant field actually
  -- changed — if this insert fails for any reason, the UPDATE and tag
  -- mutation above are rolled back along with it: this entire function
  -- body executes as the single statement PostgREST always wraps in one
  -- transaction, so there is no window where a partial write can be
  -- observed by a later read.
  if v_price_fields_changed then
    insert into public.wholesale_price_history (
      service_id, changed_by,
      old_pricing_type, old_fixed_price, old_price_min, old_price_max, old_currency,
      new_pricing_type, new_fixed_price, new_price_min, new_price_max, new_currency,
      old_recommended_price, new_recommended_price,
      old_target_margin_percent, new_target_margin_percent,
      old_competitive_price, new_competitive_price,
      old_high_profit_price, new_high_profit_price
    ) values (
      p_service_id, p_admin_id,
      v_old.pricing_type, v_old.fixed_price, v_old.price_min, v_old.price_max, v_old.currency,
      p_pricing_type, p_fixed_price, p_price_min, p_price_max, p_currency,
      v_old.recommended_price, p_recommended_price,
      v_old.target_margin_percent, p_target_margin_percent,
      v_old.competitive_price, p_competitive_price,
      v_old.high_profit_price, p_high_profit_price
    );
  end if;

  return 'updated';
end;
$$;

revoke execute on function public.wholesale_update_service_full_v2(
  uuid, uuid, text, text, boolean, text, numeric, numeric, numeric, text, numeric, numeric, numeric, numeric
) from public, anon, authenticated;
grant execute on function public.wholesale_update_service_full_v2(
  uuid, uuid, text, text, boolean, text, numeric, numeric, numeric, text, numeric, numeric, numeric, numeric
) to service_role;

commit;

-- ============================================================================
-- Not part of the transaction above, on purpose — read this, do not run it
-- as part of this file:
--
--   Run supabase/wholesale-price-tiers-preflight.sql BEFORE this file, and
--   supabase/wholesale-price-tiers-verify.sql AFTER.
--
--   supabase/wholesale-price-tiers-rollback.sql documents how to undo every
--   object this file creates, for reference only — it is never run
--   automatically and is not part of this migration. Its non-destructive
--   path only ever drops wholesale_update_service_full_v2 — it never
--   touches wholesale_update_service_full() (v1), because this migration
--   never touched it either.
-- ============================================================================
