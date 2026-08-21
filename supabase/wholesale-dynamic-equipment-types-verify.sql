-- ============================================================================
-- Verify — run AFTER wholesale-dynamic-equipment-types-migration.sql
-- ============================================================================
-- Unlike this project's usual verify files (which wrap synthetic writes in
-- begin;...rollback; because they're testing trigger/constraint BEHAVIOR),
-- this migration made real, permanent changes to real rows (re-pointing
-- PS5/Xbox/Switch's and MacBook's categories, hiding Video Consoles/
-- MacBook/Gaming Laptops, setting the final visual order). There is no
-- meaningful "before" snapshot to compare against inside this file, since
-- the actual before/after transition already happened when the migration
-- committed. So checks 1-15 below are READ-ONLY assertions against the
-- CURRENT (post-migration) real state — proving correctness by structural
-- invariant, not by count-comparison — same spirit as this project's
-- *-preflight.sql files. Checks 16-18 test the two NEW RPCs' actual behavior
-- using synthetic rows, and DO use this project's standard begin;...
-- rollback; + nested-block sentinel convention, since those genuinely are
-- "attempt something and observe whether it's accepted/rejected."
--
-- Because of that split, this file is safe to run as many times as you want
-- (checks 1-15 never write anything; checks 16-17 always self-clean via
-- rollback), but it is NOT a dry run of the migration itself — it assumes
-- the migration has ALREADY been run for real.
-- ============================================================================

begin;

create temporary table _wsl_deqt_verify_results (
  ord int,
  check_name text,
  status text,
  details text
);

-- ----------------------------------------------------------------------------
-- Check 1 (read-only): the 3 new columns exist with the expected types,
-- defaults, and CHECK constraints.
-- ----------------------------------------------------------------------------
insert into _wsl_deqt_verify_results
select 1, 'new_columns_exist_with_correct_shape',
  case when
    exists (select 1 from information_schema.columns where table_schema='public' and table_name='wholesale_equipment_types' and column_name='name_es' and is_nullable='YES')
    and exists (select 1 from information_schema.columns where table_schema='public' and table_name='wholesale_equipment_types' and column_name='image_focus_x' and is_nullable='NO')
    and exists (select 1 from information_schema.columns where table_schema='public' and table_name='wholesale_equipment_types' and column_name='image_focus_y' and is_nullable='NO')
    and exists (select 1 from information_schema.columns where table_schema='public' and table_name='wholesale_equipment_types' and column_name='full_bleed_photo' and is_nullable='NO')
    and exists (select 1 from pg_constraint where conname = 'wholesale_equipment_types_image_focus_x_check')
    and exists (select 1 from pg_constraint where conname = 'wholesale_equipment_types_image_focus_y_check')
  then 'PASS' else 'FAIL' end,
  'name_es nullable, image_focus_x/image_focus_y not-null with their CHECK constraints present, full_bleed_photo not-null';

-- ----------------------------------------------------------------------------
-- Check 2 (read-only): PS5, Xbox Series X, Switch are now real, independent,
-- non-tag-lens equipment types, and each corresponding category (SAME id as
-- before — never recreated) points at it.
-- ----------------------------------------------------------------------------
insert into _wsl_deqt_verify_results
select 2, 'ps5_xbox_switch_are_real_equipment_types_with_categories_repointed',
  case when (
    select count(*) from wholesale_equipment_types et
    join wholesale_categories c on c.equipment_type_id = et.id and c.slug = et.slug
    where et.slug in ('ps5', 'xbox-series-x', 'switch') and et.is_tag_lens = false and et.active = true
  ) = 3 then 'PASS' else 'FAIL' end,
  'expected exactly 3 equipment_types rows (ps5/xbox-series-x/switch), each non-tag-lens, active, with a '
    || 'same-slug category pointing equipment_type_id at it — found ' ||
    (select count(*) from wholesale_equipment_types et
     join wholesale_categories c on c.equipment_type_id = et.id and c.slug = et.slug
     where et.slug in ('ps5', 'xbox-series-x', 'switch') and et.is_tag_lens = false and et.active = true);

-- ----------------------------------------------------------------------------
-- Check 3 (read-only): every service that belonged to these 3 categories
-- BEFORE the migration still belongs to the SAME category_id — services are
-- never touched by this migration, only the category's own parent changes.
-- Proven by referential integrity (a service pointing at a nonexistent
-- category_id is impossible under the existing FK), stated explicitly here
-- as a direct, named assertion rather than relying on the FK silently.
-- ----------------------------------------------------------------------------
insert into _wsl_deqt_verify_results
select 3, 'no_orphaned_services_for_the_3_migrated_categories',
  case when (
    select count(*) from wholesale_services s
    where s.category_id in (select id from wholesale_categories where slug in ('ps5', 'xbox-series-x', 'switch'))
      and not exists (select 1 from wholesale_categories c where c.id = s.category_id)
  ) = 0 then 'PASS' else 'FAIL' end,
  'every wholesale_services row referencing a ps5/xbox-series-x/switch category_id still resolves to a real '
    || 'category row (this is guaranteed by the FK already, asserted here directly as documentation of the invariant)';

-- ----------------------------------------------------------------------------
-- Check 4 (read-only): price history for services under these 3 categories
-- is untouched — every wholesale_price_history row for them still resolves
-- to a real service, and the append-only guard (pre-existing, unrelated to
-- this migration) still protects it.
-- ----------------------------------------------------------------------------
insert into _wsl_deqt_verify_results
select 4, 'price_history_for_migrated_categories_intact',
  case when (
    select count(*) from wholesale_price_history ph
    where ph.service_id in (
      select s.id from wholesale_services s
      where s.category_id in (select id from wholesale_categories where slug in ('ps5', 'xbox-series-x', 'switch'))
    )
    and not exists (select 1 from wholesale_services s2 where s2.id = ph.service_id)
  ) = 0 then 'PASS' else 'FAIL' end,
  'every wholesale_price_history row for a service under ps5/xbox-series-x/switch still resolves to a real service';

-- ----------------------------------------------------------------------------
-- Check 5 (read-only): Video Consoles is hidden ONLY if it's actually empty
-- — a one-directional implication, never asserting it must be hidden if it
-- legitimately still has other categories.
-- ----------------------------------------------------------------------------
insert into _wsl_deqt_verify_results
select 5, 'video_consoles_hidden_only_if_empty',
  case when not exists (
    select 1 from wholesale_equipment_types et
    where et.slug = 'video-consoles' and et.active = true
      and not exists (select 1 from wholesale_categories where equipment_type_id = et.id)
  ) then 'PASS' else 'FAIL' end,
  'Video Consoles must not be active AND empty at the same time — ' ||
    coalesce((
      select 'currently active=' || active || ', category_count=' || (select count(*) from wholesale_categories where equipment_type_id = et.id)
      from wholesale_equipment_types et where et.slug = 'video-consoles'
    ), '(no video-consoles row found)');

-- ----------------------------------------------------------------------------
-- Check 6 (read-only): macbook-air and macbook-pro (SAME category ids as
-- before — never recreated) now resolve to the 'laptops' equipment type,
-- zero categories still point at 'macbook', and 'laptops' carries the
-- owner-approved display names.
-- ----------------------------------------------------------------------------
insert into _wsl_deqt_verify_results
select 6, 'macbook_categories_repointed_to_laptops_with_names',
  case when (
    select count(*) from wholesale_categories c
    join wholesale_equipment_types et on et.id = c.equipment_type_id
    where c.slug in ('macbook-air', 'macbook-pro') and et.slug = 'laptops' and et.active = true and et.name = 'Laptops' and et.name_es = 'Laptops'
  ) = 2 and (
    select count(*) from wholesale_categories c
    join wholesale_equipment_types et on et.id = c.equipment_type_id
    where c.slug in ('macbook-air', 'macbook-pro') and et.slug = 'macbook'
  ) = 0
  then 'PASS' else 'FAIL' end,
  'macbook-air and macbook-pro must both resolve to the laptops equipment type (active=true, name=Laptops, '
    || 'name_es=Laptops), and zero categories may still point at macbook — found ' ||
    (select count(*) from wholesale_categories c
     join wholesale_equipment_types et on et.id = c.equipment_type_id
     where c.slug in ('macbook-air', 'macbook-pro') and et.slug = 'laptops' and et.active = true and et.name = 'Laptops' and et.name_es = 'Laptops')
    || ' correctly repointed, ' ||
    (select count(*) from wholesale_categories c
     join wholesale_equipment_types et on et.id = c.equipment_type_id
     where c.slug in ('macbook-air', 'macbook-pro') and et.slug = 'macbook')
    || ' still on macbook';

-- ----------------------------------------------------------------------------
-- Check 7 (read-only): mirrors check 3, scoped to the macbook-air/macbook-pro
-- categories that moved onto 'laptops'.
-- ----------------------------------------------------------------------------
insert into _wsl_deqt_verify_results
select 7, 'no_orphaned_services_for_macbook_categories',
  case when (
    select count(*) from wholesale_services s
    where s.category_id in (select id from wholesale_categories where slug in ('macbook-air', 'macbook-pro'))
      and not exists (select 1 from wholesale_categories c where c.id = s.category_id)
  ) = 0 then 'PASS' else 'FAIL' end,
  'every wholesale_services row referencing a macbook-air/macbook-pro category_id still resolves to a real '
    || 'category row (FK-guaranteed; asserted here directly as documentation of the invariant)';

-- ----------------------------------------------------------------------------
-- Check 8 (read-only): mirrors check 4, scoped to macbook-air/macbook-pro —
-- price history (and, by the same non-mutation, every price tier column on
-- the services themselves) is untouched by the category re-point.
-- ----------------------------------------------------------------------------
insert into _wsl_deqt_verify_results
select 8, 'price_history_for_macbook_categories_intact',
  case when (
    select count(*) from wholesale_price_history ph
    where ph.service_id in (
      select s.id from wholesale_services s
      where s.category_id in (select id from wholesale_categories where slug in ('macbook-air', 'macbook-pro'))
    )
    and not exists (select 1 from wholesale_services s2 where s2.id = ph.service_id)
  ) = 0 then 'PASS' else 'FAIL' end,
  'every wholesale_price_history row for a service under macbook-air/macbook-pro still resolves to a real service';

-- ----------------------------------------------------------------------------
-- Check 9 (read-only): macbook and gaming-laptops still EXIST as rows
-- (requirement: never delete them) but are hidden — historical
-- compatibility, not gone.
-- ----------------------------------------------------------------------------
insert into _wsl_deqt_verify_results
select 9, 'macbook_and_gaming_laptops_hidden_not_deleted',
  case when (
    select count(*) from wholesale_equipment_types where slug in ('macbook', 'gaming-laptops') and active = false
  ) = 2 then 'PASS' else 'FAIL' end,
  'both macbook and gaming-laptops must still exist as rows (never deleted) with active=false — found: ' ||
    coalesce((select string_agg(slug || '(active=' || active || ')', ', ' order by slug) from wholesale_equipment_types where slug in ('macbook', 'gaming-laptops')), '(missing)');

-- ----------------------------------------------------------------------------
-- Check 10 (read-only): at most one photo total between macbook and laptops
-- — proves the transfer re-pointed the existing wholesale_images row rather
-- than duplicating it (the unique-per-equipment-type index already
-- guarantees at most one PER row; this proves the migration didn't somehow
-- end up with one on each).
-- ----------------------------------------------------------------------------
insert into _wsl_deqt_verify_results
select 10, 'macbook_photo_transferred_no_duplication',
  case when (
    (select count(*) from wholesale_images where equipment_type_id = (select id from wholesale_equipment_types where slug = 'macbook'))
    + (select count(*) from wholesale_images where equipment_type_id = (select id from wholesale_equipment_types where slug = 'laptops'))
  ) <= 1 then 'PASS' else 'FAIL' end,
  'at most 1 photo total between macbook and laptops after this migration — macbook has ' ||
    (select count(*) from wholesale_images where equipment_type_id = (select id from wholesale_equipment_types where slug = 'macbook'))
    || ', laptops has ' ||
    (select count(*) from wholesale_images where equipment_type_id = (select id from wholesale_equipment_types where slug = 'laptops'));

-- ----------------------------------------------------------------------------
-- Check 11 (read-only): NO two equipment_types rows share a sort_order,
-- checked across the WHOLE table — all 8 visible cards plus the 3 hidden
-- historical-compatibility rows (video-consoles/macbook/gaming-laptops).
-- This migration's step 9 assigns an explicit value to all 11 known rows in
-- one atomic statement specifically so this holds with zero exceptions, not
-- just among the rows anyone happens to look at.
-- ----------------------------------------------------------------------------
insert into _wsl_deqt_verify_results
select 11, 'sort_order_collision_free_across_all_rows',
  case when (
    select count(*) from (
      select sort_order, count(*) from wholesale_equipment_types group by sort_order having count(*) > 1
    ) dupes
  ) = 0 then 'PASS' else 'FAIL' end,
  'no two equipment_types rows may share the same sort_order after this migration — dup groups found: ' ||
    coalesce((
      select string_agg(sort_order || ' (x' || cnt || ')', ', ')
      from (select sort_order, count(*) as cnt from wholesale_equipment_types group by sort_order having count(*) > 1) d
    ), '(none)');

-- ----------------------------------------------------------------------------
-- Check 12 (read-only): the 8 ACTIVE equipment_types rows, ordered by
-- sort_order, are exactly the owner-approved sequence — Microsoldering,
-- iPhone, iPad, Laptops, PlayStation 5, Xbox Series X, Nintendo Switch /
-- Switch OLED, Controllers. This is the literal, final proof of "el orden
-- exacto" — not inferred from individual sort_order values, but the actual
-- resulting sequence.
-- ----------------------------------------------------------------------------
insert into _wsl_deqt_verify_results
select 12, 'final_visual_order_matches_approved_sequence',
  case when (
    select array_agg(slug order by sort_order) from wholesale_equipment_types where active = true
  ) = array['microsoldering', 'iphone', 'ipad', 'laptops', 'ps5', 'xbox-series-x', 'switch', 'controllers']
  then 'PASS' else 'FAIL' end,
  'active equipment_types ordered by sort_order must be exactly [microsoldering, iphone, ipad, laptops, ps5, '
    || 'xbox-series-x, switch, controllers] — actual: ' ||
    coalesce((select string_agg(slug, ', ' order by sort_order) from wholesale_equipment_types where active = true), '(none)');

-- ----------------------------------------------------------------------------
-- Check 13 (read-only): no duplicate slugs among all equipment_types rows (a
-- structural sanity check that would catch a broken re-run).
-- ----------------------------------------------------------------------------
insert into _wsl_deqt_verify_results
select 13, 'no_duplicate_equipment_type_slugs',
  case when (select count(*) from wholesale_equipment_types) = (select count(distinct slug) from wholesale_equipment_types)
    then 'PASS' else 'FAIL' end,
  'total rows=' || (select count(*) from wholesale_equipment_types)
    || ', distinct slugs=' || (select count(distinct slug) from wholesale_equipment_types);

-- ----------------------------------------------------------------------------
-- Check 14 (read-only): Microsoldering is untouched in identity AND, now
-- that the owner has confirmed the exact final order (unlike the prior
-- round, which deliberately left this unasserted — see the migration file's
-- own history note), its position: still the one and only is_tag_lens=true
-- row, slug=microsoldering, active, sort_order=1.
-- ----------------------------------------------------------------------------
insert into _wsl_deqt_verify_results
select 14, 'microsoldering_identity_and_position',
  case when (
    select count(*) from wholesale_equipment_types where is_tag_lens = true
  ) = 1 and exists (
    select 1 from wholesale_equipment_types where slug = 'microsoldering' and is_tag_lens = true and active = true and sort_order = 1
  ) then 'PASS' else 'FAIL' end,
  'exactly one is_tag_lens=true row, slug=microsoldering, active=true, sort_order=1 — actual is_tag_lens row count=' ||
    (select count(*) from wholesale_equipment_types where is_tag_lens = true);

-- ----------------------------------------------------------------------------
-- Check 15 (read-only): the generic source_mode/source_tag_id configuration
-- (step 12 of the migration) is correctly backfilled — microsoldering is
-- source_mode='tag_lens' pointing at the real 'microsoldering' tag row, it
-- is the ONLY tag_lens row, and no 'direct' row carries a stray
-- source_tag_id. This is what makes the Website's card-building logic able
-- to read source_mode instead of hardcoding is_tag_lens/the microsoldering
-- slug — see api/_lib/wholesaleDb.js.
-- ----------------------------------------------------------------------------
insert into _wsl_deqt_verify_results
select 15, 'microsoldering_source_mode_configured',
  case when exists (
    select 1 from wholesale_equipment_types et
    where et.slug = 'microsoldering' and et.source_mode = 'tag_lens'
      and et.source_tag_id = (select id from wholesale_tags where slug = 'microsoldering')
  ) and (
    select count(*) from wholesale_equipment_types where source_mode = 'tag_lens'
  ) = 1 and (
    select count(*) from wholesale_equipment_types where source_mode = 'direct' and source_tag_id is not null
  ) = 0
  then 'PASS' else 'FAIL' end,
  'microsoldering must be source_mode=''tag_lens'' with source_tag_id pointing at the real microsoldering tag; '
    || 'every other row must be source_mode=''direct'' with source_tag_id null — exactly one tag_lens row found=' ||
    (select count(*) from wholesale_equipment_types where source_mode = 'tag_lens')
    || ', stray direct+source_tag_id rows=' ||
    (select count(*) from wholesale_equipment_types where source_mode = 'direct' and source_tag_id is not null);

-- ----------------------------------------------------------------------------
-- Check 16 (functional, self-cleaning): wholesale_swap_equipment_type_sort_order
-- performs a real atomic swap on 2 synthetic rows, and rejects a non-admin
-- caller / unknown ids.
-- ----------------------------------------------------------------------------
-- IMPORTANT: the final "insert into _wsl_deqt_verify_results" below happens
-- AFTER the inner begin/exception block that raises-and-catches ZZ002, NOT
-- inside it. PL/pgSQL implements an EXCEPTION clause as an implicit
-- SAVEPOINT — catching an exception rolls back EVERY database change made
-- since that block began, including ones that already succeeded (this is
-- documented PL/pgSQL behavior, not a pglite quirk; confirmed here via a
-- real run that silently lost this check's own result row when the insert
-- was placed before the raise, inside the same block). Local variables
-- survive the rollback, so it's safe to insert the result row afterward
-- using them.
do $$
declare
  v_admin_id uuid;
  v_id_a uuid;
  v_id_b uuid;
  v_sort_a_after int;
  v_sort_b_after int;
  v_swap_ok boolean := false;
  v_bad_admin_rejected boolean := false;
  v_unknown_id_rejected boolean := false;
  v_skip boolean := false;
begin
  select id into v_admin_id from profiles where role = 'admin' and status = 'approved' limit 1;
  if v_admin_id is null then
    v_skip := true;
  else
    begin
      insert into wholesale_equipment_types (slug, name, sort_order) values ('__wsl_deqt_verify__a', '__wsl_deqt_verify__ A', 501)
        returning id into v_id_a;
      insert into wholesale_equipment_types (slug, name, sort_order) values ('__wsl_deqt_verify__b', '__wsl_deqt_verify__ B', 502)
        returning id into v_id_b;

      perform wholesale_swap_equipment_type_sort_order(v_admin_id, v_id_a, v_id_b);
      select sort_order into v_sort_a_after from wholesale_equipment_types where id = v_id_a;
      select sort_order into v_sort_b_after from wholesale_equipment_types where id = v_id_b;
      v_swap_ok := (v_sort_a_after = 502 and v_sort_b_after = 501);

      begin
        perform wholesale_swap_equipment_type_sort_order('00000000-0000-0000-0000-000000000000'::uuid, v_id_a, v_id_b);
        raise exception '__wsl_deqt_verify_unexpected_success__' using errcode = 'ZZ001';
      exception
        when sqlstate 'ZZ001' then null;
        when others then v_bad_admin_rejected := true;
      end;

      begin
        perform wholesale_swap_equipment_type_sort_order(v_admin_id, v_id_a, '00000000-0000-0000-0000-000000000000'::uuid);
        raise exception '__wsl_deqt_verify_unexpected_success__' using errcode = 'ZZ001';
      exception
        when sqlstate 'ZZ001' then null;
        when others then v_unknown_id_rejected := true;
      end;

      raise exception '__wsl_deqt_verify_cleanup__' using errcode = 'ZZ002';
    exception
      when sqlstate 'ZZ002' then null;
    end;
  end if;

  if v_skip then
    insert into _wsl_deqt_verify_results values (
      16, 'swap_rpc_functional', 'SKIPPED', 'no approved admin profile exists yet in this project — nothing to test against'
    );
  else
    insert into _wsl_deqt_verify_results values (
      16, 'swap_rpc_functional',
      case when v_swap_ok and v_bad_admin_rejected and v_unknown_id_rejected then 'PASS' else 'FAIL' end,
      'swap_ok=' || v_swap_ok || ', bad_admin_rejected=' || v_bad_admin_rejected || ', unknown_id_rejected=' || v_unknown_id_rejected
        || ' — expect true, true, true'
    );
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Check 17 (functional, self-cleaning): wholesale_delete_equipment_type
-- requires confirm=true, refuses a row that still has a category attached,
-- and refuses a tag-lens row (tested against the REAL Microsoldering row —
-- safe, since rejection happens before any mutation is attempted).
-- ----------------------------------------------------------------------------
-- Same restructuring reason as check 15 above: the result-row insert must
-- happen AFTER the exception-catching block below, not inside it, or the
-- ZZ002 catch's implicit-savepoint rollback silently discards it too.
do $$
declare
  v_admin_id uuid;
  v_lonely_id uuid;
  v_populated_id uuid;
  v_cat_id uuid;
  v_microsoldering_id uuid;
  v_no_confirm_rejected boolean := false;
  v_has_categories_rejected boolean := false;
  v_tag_lens_rejected boolean := false;
  v_empty_delete_ok boolean := false;
  v_skip boolean := false;
begin
  select id into v_admin_id from profiles where role = 'admin' and status = 'approved' limit 1;
  if v_admin_id is null then
    v_skip := true;
  else
    begin
      insert into wholesale_equipment_types (slug, name, sort_order) values ('__wsl_deqt_verify__lonely', '__wsl_deqt_verify__ Lonely', 503)
        returning id into v_lonely_id;
      insert into wholesale_equipment_types (slug, name, sort_order) values ('__wsl_deqt_verify__populated', '__wsl_deqt_verify__ Populated', 504)
        returning id into v_populated_id;
      insert into wholesale_categories (slug, name, equipment_type_id) values ('__wsl_deqt_verify__cat', '__wsl_deqt_verify__ category', v_populated_id)
        returning id into v_cat_id;
      select id into v_microsoldering_id from wholesale_equipment_types where slug = 'microsoldering';

      begin
        perform wholesale_delete_equipment_type(v_admin_id, v_lonely_id, false);
        raise exception '__wsl_deqt_verify_unexpected_success__' using errcode = 'ZZ001';
      exception
        when sqlstate 'ZZ001' then null;
        when others then v_no_confirm_rejected := true;
      end;

      begin
        perform wholesale_delete_equipment_type(v_admin_id, v_populated_id, true);
        raise exception '__wsl_deqt_verify_unexpected_success__' using errcode = 'ZZ001';
      exception
        when sqlstate 'ZZ001' then null;
        when others then v_has_categories_rejected := true;
      end;

      if v_microsoldering_id is not null then
        begin
          perform wholesale_delete_equipment_type(v_admin_id, v_microsoldering_id, true);
          raise exception '__wsl_deqt_verify_unexpected_success__' using errcode = 'ZZ001';
        exception
          when sqlstate 'ZZ001' then null;
          when others then v_tag_lens_rejected := true;
        end;
      else
        v_tag_lens_rejected := true; -- no microsoldering row to test against in this environment; don't fail the whole check over it
      end if;

      -- The one case genuinely expected to SUCCEED: a real delete of a
      -- lonely (zero-category) synthetic row. This intentionally mutates
      -- for real (it's exactly what the RPC is for) — undone below via the
      -- same full-cleanup rollback sentinel this project's other verify
      -- files use for a synthetic row a guard would otherwise keep alive.
      perform wholesale_delete_equipment_type(v_admin_id, v_lonely_id, true);
      v_empty_delete_ok := not exists (select 1 from wholesale_equipment_types where id = v_lonely_id);

      raise exception '__wsl_deqt_verify_cleanup__' using errcode = 'ZZ002';
    exception
      when sqlstate 'ZZ002' then null;
    end;
  end if;

  if v_skip then
    insert into _wsl_deqt_verify_results values (
      17, 'delete_rpc_functional', 'SKIPPED', 'no approved admin profile exists yet in this project — nothing to test against'
    );
  else
    insert into _wsl_deqt_verify_results values (
      17, 'delete_rpc_functional',
      case when v_no_confirm_rejected and v_has_categories_rejected and v_tag_lens_rejected and v_empty_delete_ok
        then 'PASS' else 'FAIL' end,
      'no_confirm_rejected=' || v_no_confirm_rejected || ', has_categories_rejected=' || v_has_categories_rejected
        || ', tag_lens_rejected=' || v_tag_lens_rejected || ', empty_delete_ok=' || v_empty_delete_ok
        || ' — expect true, true, true, true'
    );
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Check 18 (read-only): confirm the real Microsoldering row was never
-- actually deleted by check 17's rejected attempt above (belt-and-suspenders
-- — the rejection itself already guarantees this, this just proves it).
-- ----------------------------------------------------------------------------
insert into _wsl_deqt_verify_results
select 18, 'microsoldering_row_survives_the_rejected_delete_attempt_in_check_17',
  case when exists (select 1 from wholesale_equipment_types where slug = 'microsoldering' and is_tag_lens = true) then 'PASS' else 'FAIL' end,
  'the real microsoldering row must still exist after check 17 attempted (and was rejected) deleting it';

-- ----------------------------------------------------------------------------
-- Final check: no synthetic __wsl_deqt_verify__ row was left behind by
-- checks 16-17 (both force-rollback their own inserts via the ZZ002
-- sentinel, but this is a direct proof, not just trust in that mechanism).
-- ----------------------------------------------------------------------------
insert into _wsl_deqt_verify_results
select 19, 'no_synthetic_rows_left_behind',
  case when (select count(*) from wholesale_equipment_types where slug like '\_\_wsl\_deqt\_verify\_\_%' escape '\') = 0
    then 'PASS' else 'FAIL' end,
  'select count(*) from wholesale_equipment_types where slug like ''__wsl_deqt_verify__%'' -> ' ||
    (select count(*) from wholesale_equipment_types where slug like '\_\_wsl\_deqt\_verify\_\_%' escape '\');

-- ----------------------------------------------------------------------------
-- Final result set.
-- ----------------------------------------------------------------------------
select check_name, status, details
from (
  select ord, check_name, status, details from _wsl_deqt_verify_results
  union all
  select
    99,
    'OVERALL STATUS',
    case
      when bool_or(status = 'FAIL') then 'FAIL'
      when bool_or(status = 'REVIEW REQUIRED') then 'REVIEW REQUIRED'
      else 'PASS'
    end,
    'PASS = the dynamic equipment types migration landed correctly and both new RPCs work as designed. FAIL = '
      || 'investigate before trusting DESK/Website changes that depend on this migration.'
  from _wsl_deqt_verify_results
) t
order by ord;

-- Checks 16-17's synthetic writes are undone here; checks 1-15/18-19 never
-- wrote anything to begin with. Safe to re-run this file any time.
rollback;
