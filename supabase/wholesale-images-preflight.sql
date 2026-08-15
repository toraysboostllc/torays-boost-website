-- ============================================================================
-- Preflight — read-only sanity check, run BEFORE wholesale-images-migration.sql
-- ============================================================================
-- Every statement below is a SELECT. This file never inserts, updates,
-- deletes, alters, creates, or drops anything, and never calls any RPC or
-- stored function.
--
-- Order of operations:
--   1. Run this file. Read the results against the "expect ..." comments.
--   2. Only if everything matches, run wholesale-images-migration.sql.
--   3. Run wholesale-images-verify.sql to confirm the migration landed.
--
-- Deliberately never read or shown by any query in this file: any shop name,
-- code hash, device/session token hash, cookie value, or API/service-role
-- key — this file only ever touches wholesale_images and storage.buckets.
-- ============================================================================

-- 1. Does wholesale_images already have the 4 new columns? Expect all FALSE
--    on a fresh environment; all TRUE if this migration already ran once
--    (safe either way — the migration itself is idempotent).
select
  exists (select 1 from information_schema.columns where table_name = 'wholesale_images' and column_name = 'mime_type') as has_mime_type,
  exists (select 1 from information_schema.columns where table_name = 'wholesale_images' and column_name = 'size_bytes') as has_size_bytes,
  exists (select 1 from information_schema.columns where table_name = 'wholesale_images' and column_name = 'uploaded_by') as has_uploaded_by,
  exists (select 1 from information_schema.columns where table_name = 'wholesale_images' and column_name = 'uploaded_at') as has_uploaded_at;

-- 2. THE CRITICAL GATE — any equipment type or category that already has
--    MORE THAN ONE image row would make the migration's unique-index
--    creation fail outright. wholesale_images is expected to be completely
--    empty in production today (this is the first time anything ever writes
--    to it), so this should always return zero rows — this query exists to
--    verify that expectation, not assume it.
select equipment_type_id, count(*) as image_count
from wholesale_images
where equipment_type_id is not null
group by equipment_type_id
having count(*) > 1;
-- expect ZERO rows

select category_id, count(*) as image_count
from wholesale_images
where category_id is not null
group by category_id
having count(*) > 1;
-- expect ZERO rows

-- 3. Current row count and owner-type breakdown — informational, confirms
--    the empty-table assumption directly rather than only by absence of
--    duplicates.
select
  (select count(*) from wholesale_images) as total_images,                                          -- expect 0
  (select count(*) from wholesale_images where equipment_type_id is not null) as equipment_type_images, -- expect 0
  (select count(*) from wholesale_images where category_id is not null) as category_images,          -- expect 0
  (select count(*) from wholesale_images where service_id is not null) as service_images;            -- expect 0

-- 4. Does the wholesale-images Storage bucket already exist, and if so, with
--    what config? Informational — the migration's ON CONFLICT DO UPDATE
--    handles either case (absent or already present) safely.
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'wholesale-images';
-- expect ZERO rows on a fresh environment, or one row matching the
-- migration's declared config (public=false, file_size_limit=5242880,
-- allowed_mime_types={image/webp}) if this migration already ran

-- ----------------------------------------------------------------------------
-- 5. Storage policy audit — a private bucket is NOT enough on its own if a
--    broad, pre-existing policy on storage.objects already grants public or
--    anon access that happens to cover this bucket. Every policy that
--    applies to storage.objects at all is listed here — name, roles, the
--    operation it gates (cmd), and both of its boolean expressions (qual
--    for USING, with_check for WITH CHECK) — so a human can actually read
--    what each one does, not just how many exist.
--
--    This file does NOT attempt to parse `qual`/`with_check` to "prove" a
--    policy excludes the wholesale-images bucket — a Postgres boolean
--    expression is arbitrary code, and a SQL script cannot soundly decide
--    what it does or doesn't match. Instead: ANY policy whose roles include
--    public or anon is flagged POLICY_REVIEW_REQUIRED, full stop. A human
--    must read its qual/with_check and confirm it cannot ever match this
--    bucket before treating this as safe. Never auto-cleared to PASS.
-- ----------------------------------------------------------------------------
select
  policyname,
  roles,
  cmd,
  qual,
  with_check,
  case
    when roles && array['public', 'anon']::name[] then 'POLICY_REVIEW_REQUIRED'
    else 'not public/anon — lower risk, still worth a read'
  end as review_status
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
-- expect ZERO rows on a fresh Supabase project (no custom Storage policies
-- yet). Any row with review_status = 'POLICY_REVIEW_REQUIRED' must be read
-- and understood by a human BEFORE running wholesale-images-migration.sql —
-- it may already grant public/anon access this bucket would inherit.

-- ============================================================================
-- 6. PRE-FLIGHT SUMMARY — one row, every check above collapsed into it.
--    overall_status is a 3-state result, never a false PASS:
--      'PASS'            — zero duplicate owners AND zero public/anon
--                           storage.objects policies found.
--      'REVIEW REQUIRED'  — zero duplicate owners, but at least one public/
--                           anon storage.objects policy exists — a human
--                           must read query 5's rows before proceeding.
--      'FAIL'             — duplicate owners exist; the migration's unique
--                           indexes would fail to create.
-- ============================================================================
with duplicate_equipment_type_owners as (
  select count(*) as n from (
    select equipment_type_id from wholesale_images
    where equipment_type_id is not null
    group by equipment_type_id having count(*) > 1
  ) x
),
duplicate_category_owners as (
  select count(*) as n from (
    select category_id from wholesale_images
    where category_id is not null
    group by category_id having count(*) > 1
  ) x
),
storage_policy_check as (
  select exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and roles && array['public', 'anon']::name[]
  ) as has_public_or_anon_storage_policy
),
counts as (
  select
    (select count(*) from wholesale_images) as total_images,
    (select count(*) from wholesale_images where equipment_type_id is not null) as equipment_type_images,
    (select count(*) from wholesale_images where category_id is not null) as category_images,
    (select count(*) from wholesale_images where service_id is not null) as service_images,
    exists (select 1 from storage.buckets where id = 'wholesale-images') as bucket_exists
)
select
  counts.total_images,
  counts.equipment_type_images,
  counts.category_images,
  counts.service_images,
  counts.bucket_exists,
  duplicate_equipment_type_owners.n as duplicate_equipment_type_owner_count,
  duplicate_category_owners.n as duplicate_category_owner_count,
  storage_policy_check.has_public_or_anon_storage_policy,
  case
    when storage_policy_check.has_public_or_anon_storage_policy then 'POLICY_REVIEW_REQUIRED'
    else 'no public/anon storage.objects policy found'
  end as storage_policy_status,
  case
    when duplicate_equipment_type_owners.n > 0 or duplicate_category_owners.n > 0
    then 'FAIL'
    when storage_policy_check.has_public_or_anon_storage_policy
    then 'REVIEW REQUIRED'
    else 'PASS'
  end as overall_status
from counts, duplicate_equipment_type_owners, duplicate_category_owners, storage_policy_check;
