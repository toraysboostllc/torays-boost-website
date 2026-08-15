-- ============================================================================
-- Read-only verification for wholesale-images-migration.sql
-- ============================================================================
-- Run this AFTER wholesale-images-migration.sql, in the Supabase SQL Editor.
-- Every statement here is a SELECT — nothing here writes, updates, deletes,
-- or alters anything. Safe to run as many times as you want, at any point,
-- forever.
-- ============================================================================

-- 1. All 4 new columns exist, with the expected type/nullability/default.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_name = 'wholesale_images'
  and column_name in ('mime_type', 'size_bytes', 'uploaded_by', 'uploaded_at')
order by column_name;
-- expect exactly 4 rows: mime_type (text, NO, 'image/webp'::text),
-- size_bytes (integer, NO, 0), uploaded_by (uuid, YES, null),
-- uploaded_at (timestamp with time zone, NO, now())

-- 2. Both new CHECK constraints exist.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'wholesale_images'::regclass
  and conname in ('wholesale_images_mime_type_check', 'wholesale_images_size_bytes_check')
order by conname;
-- expect 2 rows

-- 3. Both unique partial indexes exist.
select indexname, indexdef
from pg_indexes
where tablename = 'wholesale_images'
  and indexname in ('uq_wholesale_images_equipment_type', 'uq_wholesale_images_category')
order by indexname;
-- expect 2 rows, each definition containing "UNIQUE" and "WHERE"

-- 4. Belt-and-suspenders: no duplicate owners actually made it past the
--    unique indexes (should be structurally impossible once the indexes
--    exist — a row here means the indexes are missing or were bypassed).
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

-- 5. Every stored row's mime_type/size_bytes actually satisfy the new
--    constraints — belt-and-suspenders, same spirit as query 4.
select id, mime_type, size_bytes
from wholesale_images
where mime_type is distinct from 'image/webp'
   or size_bytes <= 0
   or size_bytes > 5242880;
-- expect ZERO rows

-- 6. The wholesale-images bucket exists with exactly the declared config:
--    private, WebP-only, 5 MB cap.
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'wholesale-images';
-- expect exactly 1 row: public=false, file_size_limit=5242880,
-- allowed_mime_types={image/webp}

-- 7. RLS is still enabled on wholesale_images, with zero policies — this
--    migration never adds a policy, so this should read exactly the same as
--    right after wholesale-navigation-migration.sql ran.
select relrowsecurity
from pg_class
where relname = 'wholesale_images';
-- expect TRUE

select count(*) as policy_count
from pg_policies
where tablename = 'wholesale_images';
-- expect 0

-- ----------------------------------------------------------------------------
-- 8. Storage policy audit — same query and same reasoning as
--    wholesale-images-preflight.sql's query 5 (run this file's own header
--    comment there for the full explanation of why `qual`/`with_check` are
--    shown, not auto-parsed): this migration itself never creates a
--    storage.objects policy, but a pre-existing broad public/anon policy on
--    that table would still leave the bucket exposed regardless of what
--    this migration does. ANY policy with public/anon in `roles` is flagged
--    POLICY_REVIEW_REQUIRED and must be read by a human — never silently
--    cleared to PASS.
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
-- expect ZERO rows on a project with no custom Storage policies. Any row
-- with review_status = 'POLICY_REVIEW_REQUIRED' must be read and understood
-- — it may grant public/anon access this bucket inherits despite being
-- created as private.

-- ============================================================================
-- 9. POST-MIGRATION SUMMARY — one row, every check above collapsed into it.
-- ============================================================================
with columns_present as (
  select count(*) as n
  from information_schema.columns
  where table_name = 'wholesale_images'
    and column_name in ('mime_type', 'size_bytes', 'uploaded_by', 'uploaded_at')
),
constraints_present as (
  select count(*) as n
  from pg_constraint
  where conrelid = 'wholesale_images'::regclass
    and conname in ('wholesale_images_mime_type_check', 'wholesale_images_size_bytes_check')
),
indexes_present as (
  select count(*) as n
  from pg_indexes
  where tablename = 'wholesale_images'
    and indexname in ('uq_wholesale_images_equipment_type', 'uq_wholesale_images_category')
),
duplicate_equipment_type_owners as (
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
invalid_metadata as (
  select count(*) as n from wholesale_images
  where mime_type is distinct from 'image/webp'
     or size_bytes <= 0
     or size_bytes > 5242880
),
bucket as (
  select
    exists (select 1 from storage.buckets where id = 'wholesale-images') as exists,
    (select public from storage.buckets where id = 'wholesale-images') as is_public,
    (select file_size_limit from storage.buckets where id = 'wholesale-images') as size_limit
),
rls as (
  select
    (select relrowsecurity from pg_class where relname = 'wholesale_images') as rls_enabled,
    (select count(*) from pg_policies where tablename = 'wholesale_images') as policy_count
),
storage_policy_check as (
  select exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and roles && array['public', 'anon']::name[]
  ) as has_public_or_anon_storage_policy
)
select
  columns_present.n as columns_present_count,
  constraints_present.n as constraints_present_count,
  indexes_present.n as indexes_present_count,
  duplicate_equipment_type_owners.n as duplicate_equipment_type_owner_count,
  duplicate_category_owners.n as duplicate_category_owner_count,
  invalid_metadata.n as invalid_metadata_count,
  bucket.exists as bucket_exists,
  bucket.is_public as bucket_is_public,
  bucket.size_limit as bucket_size_limit,
  rls.rls_enabled,
  rls.policy_count,
  storage_policy_check.has_public_or_anon_storage_policy,
  case
    when storage_policy_check.has_public_or_anon_storage_policy then 'POLICY_REVIEW_REQUIRED'
    else 'no public/anon storage.objects policy found'
  end as storage_policy_status,
  -- 3-state result, same reasoning as the preflight summary: a public/anon
  -- storage.objects policy is never silently forgiven into a PASS, even if
  -- every other check here is otherwise perfect.
  case
    when not (
      columns_present.n = 4
      and constraints_present.n = 2
      and indexes_present.n = 2
      and duplicate_equipment_type_owners.n = 0
      and duplicate_category_owners.n = 0
      and invalid_metadata.n = 0
      and bucket.exists
      and bucket.is_public is not distinct from false
      and bucket.size_limit = 5242880
      and rls.rls_enabled
      and rls.policy_count = 0
    ) then 'FAIL'
    when storage_policy_check.has_public_or_anon_storage_policy then 'REVIEW REQUIRED'
    else 'PASS'
  end as overall_status
from columns_present, constraints_present, indexes_present, duplicate_equipment_type_owners,
     duplicate_category_owners, invalid_metadata, bucket, rls, storage_policy_check;
