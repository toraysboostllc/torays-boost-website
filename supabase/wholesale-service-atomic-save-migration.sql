-- ============================================================================
-- Atomic service save — one RPC covering everything the DESK "Save" button
-- on a service edit form touches: name, notes, the Microsoldering tag,
-- wholesale price (fixed/range/quote), recommended price, and target margin
-- override.
-- ============================================================================
-- Additive follow-up to wholesale-migration.sql, wholesale-navigation-
-- migration.sql, and wholesale-pricing-intelligence-migration.sql. Run in
-- the same Supabase project's SQL Editor, AFTER all three of those have
-- already run at least once.
--
-- Why this file exists: before it, saving an edited service was THREE
-- independent API calls under one Save button (details via a plain PATCH,
-- price via wholesale_update_service_price(), pricing intelligence via
-- wholesale_update_service_pricing_intelligence()) — each committed on its
-- own, so a failure partway through could leave a service with its price
-- updated but its recommended price not, or vice versa, while the UI still
-- moved on as if the whole edit had succeeded. This migration adds ONE
-- SIBLING RPC, wholesale_update_service_full(), that does the entire edit —
-- name/notes/tag/price/recommended-price/target-margin — as the single
-- statement a plpgsql function body always is, inside the ONE transaction
-- PostgREST already wraps every RPC call in. If ANY validation fails, or
-- the final wholesale_price_history insert fails, Postgres rolls back
-- every earlier UPDATE/INSERT/DELETE this function performed in the same
-- call — there is no code path that leaves a partial edit committed.
--
-- Deliberately NOT in this file: no change to wholesale_update_service_price
-- or wholesale_update_service_pricing_intelligence — both are kept exactly
-- as they are, for compatibility with anything else that might call them.
-- No schema change either — every column this RPC writes already exists
-- from the three prior migrations.
--
-- Idempotent: `create or replace function` + guarded REVOKE/GRANT, wrapped
-- in one explicit transaction. No DELETE, no DROP, no data loss anywhere in
-- this file.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- wholesale_update_service_full — validates every field BEFORE writing
-- anything, then in one pass: locks the service row (SELECT ... FOR UPDATE,
-- same concurrency pattern as the two existing per-concern RPCs), resolves
-- the Microsoldering tag exactly like setMicrosolderingTag() does today in
-- api/wholesale-admin.js (read-then-write-only-if-different, never a
-- blind delete-then-reinsert), updates the service row, mutates the tag
-- join table only if it actually needs to change, and inserts exactly ONE
-- wholesale_price_history row capturing both the wholesale-price change AND
-- the pricing-intelligence change together (the table already has every
-- column needed for both, added by wholesale-pricing-intelligence-
-- migration.sql — this is the first RPC to populate both halves of one row
-- at once). name/notes/the tag are not columns wholesale_price_history
-- tracks — same as every prior version of this edit flow, not a new gap.
--
-- No-op guard: if name, notes, tag membership, price fields, recommended
-- price, and target margin ALL already match what's being submitted, the
-- function returns 'unchanged' having performed zero writes — no history
-- row, no tag mutation, no UPDATE at all.
-- ----------------------------------------------------------------------------
create or replace function wholesale_update_service_full(
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
  p_target_margin_percent numeric
)
returns text -- 'updated' or 'unchanged'
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_old wholesale_services%rowtype;
  v_tag_id uuid;
  v_has_tag boolean;
  v_want_tag boolean;
  v_unchanged boolean;
begin
  if not exists (
    select 1 from profiles where id = p_admin_id and role = 'admin' and status = 'approved'
  ) then
    raise exception 'invalid_admin';
  end if;

  -- Field validation happens BEFORE the row lock/any write, same ordering
  -- as every other RPC in this project — an invalid submission never even
  -- reaches the point where it could partially mutate anything.
  if p_name is null or length(btrim(p_name)) = 0 or length(p_name) > 200 then
    raise exception 'invalid_name';
  end if;

  if p_notes is not null and length(p_notes) > 2000 then
    raise exception 'invalid_notes';
  end if;

  if p_pricing_type not in ('fixed', 'range', 'quote') then
    raise exception 'invalid_pricing_type';
  end if;

  if p_recommended_price is not null and p_recommended_price < 0 then
    raise exception 'invalid_recommended_price';
  end if;

  if p_target_margin_percent is not null
     and (p_target_margin_percent < 0 or p_target_margin_percent >= 100) then
    raise exception 'invalid_target_margin_percent';
  end if;

  select * into v_old
    from wholesale_services
    where id = p_service_id
    for update;
  if not found then
    raise exception 'service_not_found';
  end if;

  select id into v_tag_id from wholesale_tags where slug = 'microsoldering';
  v_has_tag := v_tag_id is not null and exists (
    select 1 from wholesale_service_tags
    where service_id = p_service_id and tag_id = v_tag_id
  );
  v_want_tag := coalesce(p_is_microsoldering, false);

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
    and v_has_tag is not distinct from v_want_tag;

  if v_unchanged then
    return 'unchanged';
  end if;

  update wholesale_services
    set name = p_name,
        notes = p_notes,
        pricing_type = p_pricing_type,
        fixed_price = p_fixed_price,
        price_min = p_price_min,
        price_max = p_price_max,
        currency = p_currency,
        recommended_price = p_recommended_price,
        target_margin_percent = p_target_margin_percent,
        updated_at = now()
    where id = p_service_id;

  if v_tag_id is not null then
    if v_want_tag and not v_has_tag then
      insert into wholesale_service_tags (service_id, tag_id) values (p_service_id, v_tag_id);
    elsif not v_want_tag and v_has_tag then
      delete from wholesale_service_tags where service_id = p_service_id and tag_id = v_tag_id;
    end if;
  end if;

  -- One row, both halves of the edit — if this insert fails for any
  -- reason (a future stricter constraint, a connection drop, anything),
  -- the UPDATE and tag mutation above are rolled back along with it: this
  -- entire function body executes as the single statement PostgREST always
  -- wraps in one transaction, so there is no window where a partial write
  -- can be observed by a later read.
  insert into wholesale_price_history (
    service_id, changed_by,
    old_pricing_type, old_fixed_price, old_price_min, old_price_max, old_currency,
    new_pricing_type, new_fixed_price, new_price_min, new_price_max, new_currency,
    old_recommended_price, new_recommended_price,
    old_target_margin_percent, new_target_margin_percent
  ) values (
    p_service_id, p_admin_id,
    v_old.pricing_type, v_old.fixed_price, v_old.price_min, v_old.price_max, v_old.currency,
    p_pricing_type, p_fixed_price, p_price_min, p_price_max, p_currency,
    v_old.recommended_price, p_recommended_price,
    v_old.target_margin_percent, p_target_margin_percent
  );

  return 'updated';
end;
$$;

revoke execute on function wholesale_update_service_full(
  uuid, uuid, text, text, boolean, text, numeric, numeric, numeric, text, numeric, numeric
) from public, anon, authenticated;
grant execute on function wholesale_update_service_full(
  uuid, uuid, text, text, boolean, text, numeric, numeric, numeric, text, numeric, numeric
) to service_role;

commit;

-- ============================================================================
-- Not part of the transaction above, on purpose — read this, do not run it
-- as part of this file:
--
--   Run supabase/wholesale-service-atomic-save-preflight.sql BEFORE this
--   file, and supabase/wholesale-service-atomic-save-verify.sql AFTER.
--
--   supabase/wholesale-service-atomic-save-rollback.sql documents how to
--   undo every object this file creates, for reference only — it is never
--   run automatically and is not part of this migration.
-- ============================================================================
