-- ============================================================================
-- Rollback for wholesale-images-migration.sql — REFERENCE ONLY
-- ============================================================================
-- This file is NOT run automatically by anything — no script, no test, no CI
-- step references it. It exists so that IF this migration is ever run for
-- real and needs to be undone, the exact, reviewed steps already exist
-- instead of being improvised under pressure.
--
-- Every statement below is destructive. Read wholesale-images-verify.sql
-- first if you want to know what's actually in these columns/bucket before
-- dropping anything. Run manually, one statement at a time, only with the
-- owner's explicit go-ahead for THIS specific rollback — the same bar as
-- running the forward migration in the first place.
--
-- wholesale_images itself (the table, its 3 owner FKs, its exactly-one-owner
-- CHECK) is NOT touched by this file — that table was created by
-- wholesale-navigation-migration.sql and is undone by THAT migration's own
-- rollback, not this one. This file only undoes what
-- wholesale-images-migration.sql added on top of it.
-- ============================================================================

begin;

-- Reverse order of creation.

-- 1. The two unique indexes.
drop index if exists uq_wholesale_images_equipment_type;
drop index if exists uq_wholesale_images_category;
drop index if exists idx_wholesale_images_uploaded_by;

-- 2. The two CHECK constraints and the 4 metadata columns.
alter table wholesale_images drop constraint if exists wholesale_images_size_bytes_check;
alter table wholesale_images drop constraint if exists wholesale_images_mime_type_check;
alter table wholesale_images drop column if exists mime_type;
alter table wholesale_images drop column if exists size_bytes;
alter table wholesale_images drop column if exists uploaded_by;
alter table wholesale_images drop column if exists uploaded_at;

commit;

-- ============================================================================
-- 3. The Storage bucket itself — NOT part of the transaction above, and
--    commented out on purpose. A bucket can only be deleted once it is
--    completely empty (Supabase's own Storage API rejects deleting a
--    non-empty bucket), so this step needs a human to first decide what
--    happens to any real, already-uploaded photos (keep them, migrate them
--    elsewhere, or genuinely discard them) — that decision does not belong
--    in an automated rollback script. Uncomment and run only after that
--    decision has been made and every object in the bucket has already been
--    removed deliberately:
--
--   delete from storage.buckets where id = 'wholesale-images';
-- ============================================================================
