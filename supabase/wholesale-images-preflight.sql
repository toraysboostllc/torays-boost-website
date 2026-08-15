-- ============================================================================
-- Preflight — read-only sanity check, run BEFORE wholesale-images-migration.sql
-- ============================================================================
-- ONE statement, ONE result table. Supabase's SQL Editor only surfaces the
-- result of the query it decides to display when a script has multiple
-- statements — running the previous multi-query version of this file left
-- the useful checks (the policy audit, the PASS/REVIEW REQUIRED/FAIL
-- summary) invisible, with only an earlier, purely informational query ever
-- shown. Every check below is instead a row in a single consolidated table
-- (check_name, status, details), produced by exactly one SELECT — paste
-- this whole file into the SQL Editor and run it once; there is nothing
-- else to scroll past.
--
-- Still entirely read-only: only SELECT/WITH, nothing that inserts,
-- updates, deletes, alters, creates, drops, or calls any RPC/stored
-- function. Never reads or shows any shop name, code hash, device/session
-- token hash, cookie value, or API/service-role key — this file only ever
-- touches wholesale_images, storage.buckets, and pg_policies (storage.
-- objects policy metadata only, never actual object rows).
--
-- The storage_public_anon_policies row's `details` cell embeds the actual
-- policyname/roles/cmd/qual/with_check of every matching policy as JSON —
-- the full audit lands in this same one result table, never a second query
-- you have to remember to run separately. This file still never tries to
-- PARSE those qual/with_check expressions to auto-decide whether a policy
-- can reach the wholesale-images bucket — a Postgres boolean expression is
-- arbitrary code, and this script cannot soundly decide that on its own.
-- It only surfaces the raw definitions for a human to read; nothing here
-- silently upgrades that row to PASS on your behalf.
--
-- Order of operations:
--   1. Run this file. Read the check_name/status/details rows, and the
--      final OVERALL STATUS row.
--   2. Only if OVERALL STATUS is PASS, run wholesale-images-migration.sql.
--      REVIEW REQUIRED means read the flagged row(s) yourself and decide —
--      never treat it as an automatic go-ahead. FAIL means fix what's
--      flagged first; the migration would not apply cleanly as-is.
--   3. Run wholesale-images-verify.sql afterward to confirm it landed.
-- ============================================================================

with raw as (
  select
    exists (select 1 from information_schema.columns where table_name = 'wholesale_images' and column_name = 'mime_type') as has_mime_type,
    exists (select 1 from information_schema.columns where table_name = 'wholesale_images' and column_name = 'size_bytes') as has_size_bytes,
    exists (select 1 from information_schema.columns where table_name = 'wholesale_images' and column_name = 'uploaded_by') as has_uploaded_by,
    exists (select 1 from information_schema.columns where table_name = 'wholesale_images' and column_name = 'uploaded_at') as has_uploaded_at,
    (select count(*) from wholesale_images) as total_images,
    (select count(*) from wholesale_images where equipment_type_id is not null) as equipment_type_images,
    (select count(*) from wholesale_images where category_id is not null) as category_images,
    (select count(*) from wholesale_images where service_id is not null) as service_images,
    (select count(*) from (
      select equipment_type_id from wholesale_images
      where equipment_type_id is not null
      group by equipment_type_id having count(*) > 1
    ) x) as dup_equipment_type_owners,
    (select count(*) from (
      select category_id from wholesale_images
      where category_id is not null
      group by category_id having count(*) > 1
    ) x) as dup_category_owners,
    exists (select 1 from storage.buckets where id = 'wholesale-images') as bucket_exists,
    (select public from storage.buckets where id = 'wholesale-images') as bucket_public,
    (select file_size_limit from storage.buckets where id = 'wholesale-images') as bucket_size_limit,
    (select allowed_mime_types from storage.buckets where id = 'wholesale-images') as bucket_mime_types,
    (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects') as storage_policy_count,
    (select count(*) from pg_policies
       where schemaname = 'storage' and tablename = 'objects'
         and roles && array['public', 'anon']::name[]) as storage_public_anon_policy_count,
    -- The real audit payload: policyname/roles/cmd/qual/with_check for
    -- every public/anon policy on storage.objects, as a JSON array — this
    -- is what lands directly in the details cell below, not a query to run
    -- separately. jsonb_agg() over zero matching rows returns NULL, which
    -- the details expression turns into the literal text 'none'.
    (select jsonb_agg(
       jsonb_build_object(
         'policyname', policyname,
         'roles', to_jsonb(roles),
         'cmd', cmd,
         'qual', qual,
         'with_check', with_check
       ) order by policyname
     )
     from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and roles && array['public', 'anon']::name[]
    ) as storage_public_anon_policies_json
),
-- Each row below is its own independent check against `raw` (a single row,
-- so every branch is a trivial cross join) — never parsing another check's
-- OUTPUT, only the same underlying facts. THE GATE for the migration's two
-- unique indexes is duplicate_owners; every other row is either
-- informational (PASS regardless) or a REVIEW REQUIRED flag for a human to
-- read before proceeding — nothing here is ever silently upgraded to PASS
-- by this file itself.
checks as (
  select 1 as ord, 'columns_present' as check_name,
    case
      when has_mime_type and has_size_bytes and has_uploaded_by and has_uploaded_at then 'PASS'
      when not has_mime_type and not has_size_bytes and not has_uploaded_by and not has_uploaded_at then 'PASS'
      else 'REVIEW REQUIRED'
    end as status,
    case
      when has_mime_type and has_size_bytes and has_uploaded_by and has_uploaded_at
        then 'all 4 columns already present (mime_type, size_bytes, uploaded_by, uploaded_at) — migration already ran, safe to re-run, it is idempotent'
      when not has_mime_type and not has_size_bytes and not has_uploaded_by and not has_uploaded_at
        then 'none of the 4 columns exist yet — expected state before running the migration for the first time'
      else 'partial state — mime_type=' || has_mime_type || ', size_bytes=' || has_size_bytes
        || ', uploaded_by=' || has_uploaded_by || ', uploaded_at=' || has_uploaded_at
        || ' — investigate before running the migration, a prior run may have failed partway through'
    end as details
  from raw

  union all

  select 2, 'duplicate_owners',
    case when dup_equipment_type_owners = 0 and dup_category_owners = 0 then 'PASS' else 'FAIL' end,
    case
      when dup_equipment_type_owners = 0 and dup_category_owners = 0
        then 'no equipment type or category already has more than one image row'
      else dup_equipment_type_owners || ' equipment type(s) and ' || dup_category_owners
        || ' categor(y/ies) already have more than one image row — the migration''s two unique partial '
        || 'indexes would fail to create — remove the duplicate rows in wholesale_images first'
    end
  from raw

  union all

  select 3, 'existing_images', 'PASS',
    'total=' || total_images || ', equipment_type-owned=' || equipment_type_images
      || ', category-owned=' || category_images || ', service-owned=' || service_images
      || ' (all 0 expected on an environment where this feature has never been used yet)'
  from raw

  union all

  select 4, 'bucket_exists', 'PASS',
    case
      when bucket_exists then 'the wholesale-images Storage bucket already exists'
      else 'the wholesale-images Storage bucket does not exist yet — the migration will create it'
    end
  from raw

  union all

  select 5, 'bucket_config_private_webp_5mb',
    case
      when not bucket_exists then 'PASS'
      when bucket_public is not distinct from false
        and bucket_size_limit = 5242880
        and bucket_mime_types = array['image/webp']::text[]
        then 'PASS'
      else 'REVIEW REQUIRED'
    end,
    case
      when not bucket_exists
        then 'not applicable yet — bucket not created, the migration will make it as private, WebP-only, 5 MB'
      when bucket_public is not distinct from false
        and bucket_size_limit = 5242880
        and bucket_mime_types = array['image/webp']::text[]
        then 'bucket already matches the expected config exactly: public=false, file_size_limit=5242880, allowed_mime_types={image/webp}'
      else 'bucket exists with a DIFFERENT config right now (public=' || coalesce(bucket_public::text, 'null')
        || ', file_size_limit=' || coalesce(bucket_size_limit::text, 'null')
        || ', allowed_mime_types=' || coalesce(bucket_mime_types::text, 'null')
        || ') — the migration will silently overwrite it to the expected config via its own idempotent upsert, '
        || 'review this if that bucket is already used for anything else'
    end
  from raw

  union all

  select 6, 'storage_objects_policies_total', 'PASS',
    storage_policy_count || ' total polic' || (case when storage_policy_count = 1 then 'y' else 'ies' end)
      || ' currently defined on storage.objects, across every role — informational only, see the next row for the actual risk check'
  from raw

  union all

  select 7, 'storage_public_anon_policies',
    case when storage_public_anon_policy_count = 0 then 'PASS' else 'REVIEW REQUIRED' end,
    -- The actual policyname/roles/cmd/qual/with_check of every public/anon
    -- policy, embedded right here as JSON — read this cell, there is
    -- nothing else you need to go run separately.
    case
      when storage_public_anon_policy_count = 0 then 'none'
      else storage_public_anon_policies_json::text
    end
  from raw
),
overall as (
  select
    case
      when bool_or(status = 'FAIL') then 'FAIL'
      when bool_or(status = 'REVIEW REQUIRED') then 'REVIEW REQUIRED'
      else 'PASS'
    end as status
  from checks
)
select check_name, status, details
from (
  select ord, check_name, status, details from checks
  union all
  select
    99,
    'OVERALL STATUS',
    overall.status,
    'PASS = safe to run wholesale-images-migration.sql. REVIEW REQUIRED = read every row above marked '
      || 'REVIEW REQUIRED yourself before deciding, never auto-cleared to PASS by this file. FAIL = fix the '
      || 'flagged row(s) first, the migration will not apply cleanly as-is.'
  from overall
) t
order by ord;
