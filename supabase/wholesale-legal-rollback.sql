-- ============================================================================
-- Rollback for wholesale-legal-migration.sql — REFERENCE ONLY
-- ============================================================================
-- This file is NOT run automatically by anything — no script, no test, no CI
-- step references it. It exists so that IF this migration is ever run for
-- real and needs to be undone, the exact, reviewed steps already exist
-- instead of being improvised under pressure.
--
-- ****************************************************************************
-- WARNING — DESTRUCTIVE IF RUN AFTER REAL PRODUCTION USE. wholesale_legal_
-- acceptances is the ONLY record that a specific Shop representative agreed
-- to a specific version of the Torays Boost Pro legal bundle (name, title,
-- the 5 checkboxes, content_hash, locale, IP, user-agent, timestamp — see
-- Document 6, Electronic Consent & Records Disclosure, Section 1). Dropping
-- that table destroys that evidence permanently. Do not run section 2 of
-- this file against a database that has ever recorded a real shop's
-- acceptance unless you have already exported/archived
-- wholesale_legal_acceptances (and, if relevant, wholesale_legal_documents)
-- through some other means and genuinely intend to give up that record.
-- ****************************************************************************
--
-- IMPORTANT — this rollback does NOT, and must never, revert
-- wholesale_price_history.service_id's foreign key from RESTRICT back to
-- CASCADE. That FK correction (CASCADE -> RESTRICT) closes a real data-loss
-- path that existed independently of the legal-acceptance feature: deleting
-- a wholesale_services row used to silently delete its own price audit
-- trail. Reverting it back to CASCADE would knowingly reopen that data-loss
-- path — undoing the legal-acceptance feature is never, by itself, a reason
-- to do that. If a genuine, deliberate decision is later made to revert the
-- FK too, that must be its own separately reviewed migration, written and
-- approved on its own merits, not a side effect of running this file.
--
-- Order of operations below matches the drop order requested for this file:
-- triggers before the functions/columns/tables they depend on, so nothing
-- errors out on a dependency still referencing it.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Triggers and their functions, price_updated_at machinery first.
-- ----------------------------------------------------------------------------
drop trigger if exists trg_wholesale_price_history_append_only on wholesale_price_history;
drop function if exists public.wholesale_price_history_append_only_guard();

drop trigger if exists trg_wholesale_legal_documents_immutability on wholesale_legal_documents;
drop trigger if exists trg_wholesale_services_price_updated_at on wholesale_services;

drop function if exists public.wholesale_legal_documents_immutability_guard();
drop function if exists public.wholesale_touch_service_price_updated_at();

-- ----------------------------------------------------------------------------
-- 2. RPCs.
-- ----------------------------------------------------------------------------
drop function if exists public.wholesale_accept_legal_terms(
  uuid, uuid, uuid, uuid, text, text, boolean, boolean, boolean, boolean, boolean, text, text, text
);
drop function if exists public.wholesale_publish_legal_document(
  uuid, text, jsonb, jsonb
);

-- ----------------------------------------------------------------------------
-- 3. Tables — DESTRUCTIVE. See the warning at the top of this file. Comment
--    this section out (or stop after section 2 above) to disable the legal-
--    acceptance feature in code while keeping every acceptance record that
--    already exists.
-- ----------------------------------------------------------------------------
drop table if exists wholesale_legal_acceptances;
drop table if exists wholesale_legal_documents;

-- ----------------------------------------------------------------------------
-- 4. wholesale_services.price_updated_at column — OPTIONAL, independent of
--    section 3. Drop it separately if you want to keep the legal tables but
--    remove the "price last updated" display data.
-- ----------------------------------------------------------------------------
alter table wholesale_services drop column if exists price_updated_at;

-- ----------------------------------------------------------------------------
-- 5. wholesale_price_history.service_id foreign key — DELIBERATELY NOT
--    TOUCHED HERE. See the WARNING block at the top of this file. This
--    rollback leaves the FK exactly as wholesale-legal-migration.sql left
--    it (ON DELETE RESTRICT), on purpose.
-- ----------------------------------------------------------------------------

commit;
