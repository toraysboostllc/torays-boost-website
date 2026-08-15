-- ============================================================================
-- Wholesale original photos — Fase 3A (DESK-administered cover photos)
-- ============================================================================
-- Additive follow-up to wholesale-navigation-migration.sql, which already
-- created wholesale_images (three nullable owner FKs + exactly-one-owner
-- CHECK + RLS enabled/zero policies) and the private-by-construction posture
-- every wholesale_* table shares. Run in the same Supabase project's SQL
-- Editor, AFTER wholesale-navigation-migration.sql has already run.
--
-- Scope of this file, exactly: four new metadata columns on wholesale_images
-- (mime_type, size_bytes, uploaded_by, uploaded_at), two unique partial
-- indexes enforcing the Fase 3A scope decision — ONE cover photo per
-- Equipment Type and ONE photo per category/model, never a gallery — and the
-- private Storage bucket (`wholesale-images`) those photos live in, created
-- and configured entirely by SQL against storage.buckets so this step is
-- reviewable and re-runnable exactly like every other migration in this
-- repo, not a manual dashboard click nobody can diff.
--
-- Explicitly OUT of scope for this file (per Fase 3A's approved plan):
-- photos per SERVICE (service_id stays a valid owner in the existing CHECK,
-- but gets no unique index here — that is a later phase, if ever), more than
-- one photo per owner (a real gallery), and any change to the website's
-- frontend or runtime API (api/wholesale-prices.js, api/_lib/wholesaleDb.js,
-- src/pages/*) — those stay completely untouched by this migration; DESK's
-- own API/UI changes are separate application code, not SQL, and are also
-- not part of this file.
--
-- Idempotent throughout — every column uses ADD COLUMN IF NOT EXISTS, every
-- constraint is DROP ... IF EXISTS before ADD, every index uses IF NOT
-- EXISTS, and the bucket upsert uses ON CONFLICT (id) DO UPDATE so re-running
-- this file always converges the bucket's config back to what this file
-- declares rather than erroring on a bucket that already exists. The whole
-- file is wrapped in one explicit transaction: if anything fails, Postgres
-- rolls back everything, never a half-applied schema.
--
-- IMPORTANT — the two unique indexes (step 2 below) will FAIL to create if
-- wholesale_images already has two or more rows sharing the same non-null
-- equipment_type_id or category_id. Run wholesale-images-preflight.sql
-- FIRST and confirm it reports zero duplicate owners before running this
-- file — wholesale_images is expected to be completely empty in production
-- today (no photo has ever been uploaded through this not-yet-built
-- feature), so this should be a non-issue, but the preflight check exists so
-- that expectation is verified, not assumed.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Metadata columns — what the server independently re-validated about the
--    uploaded object (see api/wholesale-admin.js's "images" resource,
--    confirmUpload action), not what the browser merely claimed.
--
--    uploaded_by is `on delete set null` (not cascade), same reasoning as
--    wholesale_price_history.changed_by: if an admin's profile is later
--    removed, the historical record of who uploaded a still-live photo
--    should not vanish or take the photo down with it — only the "who"
--    goes blank.
-- ----------------------------------------------------------------------------
alter table wholesale_images add column if not exists mime_type text not null default 'image/webp';
alter table wholesale_images add column if not exists size_bytes integer not null default 0;
alter table wholesale_images add column if not exists uploaded_by uuid references profiles(id) on delete set null;
alter table wholesale_images add column if not exists uploaded_at timestamptz not null default now();

-- Every stored image must actually be the one format this feature ever
-- accepts. Mirrors the bucket's own allowed_mime_types restriction (step 4)
-- as belt-and-suspenders — a row can never claim a mime_type the bucket
-- itself would have refused to store.
alter table wholesale_images drop constraint if exists wholesale_images_mime_type_check;
alter table wholesale_images add constraint wholesale_images_mime_type_check
  check (mime_type = 'image/webp');

-- 5 MB hard ceiling (5 * 1024 * 1024), matching the bucket's file_size_limit
-- (step 4) and api/wholesale-admin.js's own re-validation of the real
-- uploaded object. 0 is rejected too — size_bytes is only ever written from
-- Storage's own reported metadata for a real object, so a genuine 0-byte
-- value here means confirmUpload's revalidation step did not run correctly,
-- not a legitimate empty photo.
alter table wholesale_images drop constraint if exists wholesale_images_size_bytes_check;
alter table wholesale_images add constraint wholesale_images_size_bytes_check
  check (size_bytes > 0 and size_bytes <= 5242880);

-- ----------------------------------------------------------------------------
-- 2. Fase 3A scope, enforced at the schema level, not just in application
--    code: exactly one cover photo per Equipment Type, exactly one photo per
--    category/model — never a gallery, never a duplicate. Partial (`where
--    ... is not null`) because wholesale_images also allows a service_id
--    owner (from the original Fase 1 design) that this file deliberately
--    does not constrain — see the file header's "explicitly out of scope"
--    note. A concurrent double-confirm (two admins finishing an upload for
--    the same owner at nearly the same moment) is turned into a clean
--    constraint-violation error by this index, not a silent second row.
-- ----------------------------------------------------------------------------
create unique index if not exists uq_wholesale_images_equipment_type
  on wholesale_images(equipment_type_id) where equipment_type_id is not null;
create unique index if not exists uq_wholesale_images_category
  on wholesale_images(category_id) where category_id is not null;

-- ----------------------------------------------------------------------------
-- 3. Read/query helper indexes — cheap, and this table will be read on every
--    DESK "images" list call and (later, once the website's own runtime is
--    authorized) every shop-facing catalog load.
-- ----------------------------------------------------------------------------
create index if not exists idx_wholesale_images_uploaded_by on wholesale_images(uploaded_by);

-- ----------------------------------------------------------------------------
-- 4. Storage bucket — private, WebP-only, 5 MB hard cap, enforced by Storage
--    itself as a second, independent layer beneath the two CHECK constraints
--    above and api/wholesale-admin.js's own application-level validation.
--    `public = false`: no anonymous read of any kind, ever — every read this
--    feature ever performs (DESK's admin preview today; the website's
--    catalog, once THAT repo's runtime is separately authorized) goes
--    through a short-lived signed URL, never a public bucket URL.
--
--    ON CONFLICT (id) DO UPDATE makes this self-correcting on re-run: if the
--    bucket already exists (created by an earlier partial run of this file,
--    or by hand in the dashboard) but with different settings, running this
--    file again brings it back to exactly this declared config instead of
--    silently leaving stale settings in place.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wholesale-images', 'wholesale-images', false, 5242880, array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- 5. storage.objects RLS — deliberately untouched. Supabase enables RLS on
--    storage.objects with zero policies by default, meaning anon/
--    authenticated already cannot read or write ANY object in this (or any)
--    bucket directly; only the service_role key (used exclusively inside
--    api/wholesale-admin.js's server-side Storage calls, never sent to the
--    browser) bypasses RLS. This file adds no anon/authenticated policy for
--    this bucket, on purpose — the exact same "deny-all by omission" posture
--    every wholesale_* table already has (see wholesale-navigation-
--    migration.sql step 9). Every read the browser ever performs on an
--    object in this bucket goes through a signed URL the server issued,
--    never a direct authenticated/anon Storage request.
-- ----------------------------------------------------------------------------

commit;

-- ============================================================================
-- Not part of the transaction above, on purpose — read this, do not run it
-- as part of this file:
--
--   Run supabase/wholesale-images-preflight.sql BEFORE this file — it is the
--   gate that confirms wholesale_images has no pre-existing duplicate owner
--   before step 2 above tries to build a unique index over it.
--
--   Run supabase/wholesale-images-verify.sql AFTER this file, to confirm the
--   columns/constraints/indexes/bucket all landed exactly as declared.
--
--   supabase/wholesale-images-rollback.sql documents how to undo every
--   object this file creates, for reference only — it is never run
--   automatically and is not part of this migration.
-- ============================================================================
