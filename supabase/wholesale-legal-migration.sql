-- ============================================================================
-- Wholesale legal bundle — Torays Boost Pro Legal Bundle v1.0 (6 documents),
-- clickwrap acceptance, and the price_updated_at surfacing needed by
-- Document 3 (Pricing Estimates & Independent Retail Pricing Disclaimer),
-- Section 5
-- ============================================================================
-- Additive follow-up to wholesale-migration.sql, wholesale-navigation-
-- migration.sql, wholesale-pricing-intelligence-migration.sql,
-- wholesale-service-atomic-save-migration.sql, and
-- wholesale-price-tiers-migration.sql. Run in the same Supabase project's
-- SQL Editor, AFTER all five of those have already run at least once.
--
-- Scope of this file, exactly:
--   1. wholesale_legal_documents — one row per published/superseded/draft
--      version of the 6-document bundle, EN+ES content as jsonb, a
--      content_hash, and an immutability guard once published (a published
--      row's legal text can never be edited or deleted in place — only
--      superseded by publishing a new version).
--   2. wholesale_legal_acceptances — one immutable, append-only row per
--      acceptance, with all 5 checkboxes enforced true at the CHECK-
--      constraint level (never just in application code), the representative
--      name/title, and the exact content_hash accepted.
--   3. wholesale_services.price_updated_at — a nullable column backfilled
--      from existing wholesale_price_history rows, kept current by a trigger
--      that fires ONLY when one of the 6 real price fields changes (never on
--      a name/notes-only edit).
--   4. Two new RPCs — wholesale_publish_legal_document (admin publishes a new
--      version, atomically supersedes the previous one) and
--      wholesale_accept_legal_terms (a shop's representative accepts,
--      atomically validated and recorded) — both SECURITY INVOKER,
--      service_role only, same posture as every other wholesale_* RPC.
--   5. A corrected, narrower fix to wholesale_price_history.service_id's
--      foreign key: today it is ON DELETE CASCADE (confirmed by
--      wholesale-legal-preflight.sql), which means deleting a
--      wholesale_services row silently deletes its own price audit trail —
--      exactly the kind of record the Electronic Consent & Records
--      Disclosure (Document 6, Section 1) and the Privacy & Data Security
--      Policy (Document 4, Section 10) commit to keeping. This migration
--      changes that one foreign key to ON DELETE RESTRICT, so a service with
--      real price history can no longer be deleted at all (it must be
--      deactivated instead) — this is the single schema change in this file
--      that touches pre-existing data-loss behavior, not a purely additive
--      one, hence the dedicated preflight zero-orphan check before it runs.
--
-- Idempotent throughout — IF NOT EXISTS / a guarded DROP ... IF EXISTS
-- before every ADD CONSTRAINT / CREATE OR REPLACE FUNCTION / CREATE TRIGGER
-- — wrapped in one explicit transaction: if anything fails, Postgres rolls
-- back everything, never a half-applied schema.
--
-- No DELETE, no DROP TABLE, no DROP COLUMN anywhere in this file. Every
-- existing row in wholesale_services/wholesale_price_history keeps every
-- value it already has.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. wholesale_legal_documents — versioned EN/ES bundle content.
-- ----------------------------------------------------------------------------
create table if not exists wholesale_legal_documents (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  status text not null default 'draft' check (status in ('draft', 'published', 'superseded')),
  content_en jsonb not null,
  content_es jsonb not null,
  content_hash text not null,
  published_at timestamptz,
  published_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Every published/draft/superseded row must carry all 6 documents in both
-- languages — never a partial bundle. Checked as a table CHECK (not just in
-- the RPC below) so this holds regardless of which code path ever inserts a
-- row.
alter table wholesale_legal_documents drop constraint if exists wholesale_legal_documents_content_keys_en;
alter table wholesale_legal_documents add constraint wholesale_legal_documents_content_keys_en check (
  content_en ?& array['access_agreement','pricing_policy','pricing_disclaimer',
                       'privacy_security','repair_warranty_terms','econsent_disclosure']
);
alter table wholesale_legal_documents drop constraint if exists wholesale_legal_documents_content_keys_es;
alter table wholesale_legal_documents add constraint wholesale_legal_documents_content_keys_es check (
  content_es ?& array['access_agreement','pricing_policy','pricing_disclaimer',
                       'privacy_security','repair_warranty_terms','econsent_disclosure']
);

-- At most one 'published' row, ever — this is the "one live version" rule
-- the whole feature depends on, enforced at the database level (a partial
-- unique index on a constant expression, scoped by the WHERE clause) rather
-- than merely by the publish RPC's own UPDATE-then-INSERT
-- ordering, so it holds even against a hand-run INSERT.
create unique index if not exists idx_wholesale_legal_documents_one_published
  on wholesale_legal_documents ((true)) where status = 'published';
create index if not exists idx_wholesale_legal_documents_status
  on wholesale_legal_documents(status);

-- ----------------------------------------------------------------------------
-- 2. wholesale_legal_acceptances — append-only acceptance records.
-- ----------------------------------------------------------------------------
create table if not exists wholesale_legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references wholesale_shops(id) on delete restrict,
  device_id uuid references wholesale_devices(id) on delete set null,
  session_id uuid references wholesale_sessions(id) on delete set null,
  legal_document_id uuid not null references wholesale_legal_documents(id) on delete restrict,
  representative_name text not null check (length(btrim(representative_name)) between 1 and 200),
  representative_title text not null check (length(btrim(representative_title)) between 1 and 200),
  confirms_authority boolean not null,
  accepts_terms_privacy boolean not null,
  understands_tiers_optional boolean not null,
  understands_independent_pricing boolean not null,
  accepts_confidentiality boolean not null,
  -- Schema-level enforcement of "all 5 boxes checked" — the exact same rule
  -- wholesale_accept_legal_terms() validates in application code below, kept
  -- true even against a hand-run INSERT that bypasses the RPC.
  constraint wholesale_legal_acceptances_all_boxes_checked check (
    confirms_authority and accepts_terms_privacy and understands_tiers_optional
    and understands_independent_pricing and accepts_confidentiality
  ),
  content_hash text not null,
  locale text not null check (locale in ('en', 'es')),
  ip text,
  user_agent text,
  accepted_at timestamptz not null default now()
);

create index if not exists idx_wholesale_legal_acceptances_shop on wholesale_legal_acceptances(shop_id);
create index if not exists idx_wholesale_legal_acceptances_shop_doc on wholesale_legal_acceptances(shop_id, legal_document_id);
create index if not exists idx_wholesale_legal_acceptances_accepted_at on wholesale_legal_acceptances(accepted_at desc);

alter table wholesale_legal_documents enable row level security;
alter table wholesale_legal_acceptances enable row level security;
-- No new policies — same "RLS enabled, zero policies, deny anon/authenticated,
-- service_role only" posture wholesale-migration.sql already established for
-- every other wholesale_* table. See that file's header for the reasoning.

-- ----------------------------------------------------------------------------
-- 3. wholesale_services.price_updated_at — Document 3 (Pricing Estimates &
--    Independent Retail Pricing Disclaimer), Section 5: "The Portal may
--    display the date on which the relevant service pricing was last
--    changed ... For a service without a verifiable pricing history, this
--    date may not be shown until the first recorded price change — Torays
--    Boost will not display an invented or estimated date." Backfilled from
--    real wholesale_price_history rows only — a service with zero history
--    rows is backfilled to null, never today's date or any other guess.
-- ----------------------------------------------------------------------------
alter table wholesale_services add column if not exists price_updated_at timestamptz;

update wholesale_services ws
  set price_updated_at = (
    select max(ph.changed_at) from wholesale_price_history ph where ph.service_id = ws.id
  )
  where price_updated_at is null;

create index if not exists idx_wholesale_services_price_updated_at on wholesale_services(price_updated_at desc);

-- Fires on UPDATE only, and only when one of the 6 real price fields
-- changed — a name/notes/tag-only edit must never bump this date, matching
-- the exact same "was this a pricing event" question
-- wholesale_update_service_full_v2's own v_price_fields_changed guard
-- already answers for the history-row-insert decision.
create or replace function public.wholesale_touch_service_price_updated_at()
returns trigger language plpgsql as $$
begin
  if (new.fixed_price is distinct from old.fixed_price)
     or (new.price_min is distinct from old.price_min)
     or (new.price_max is distinct from old.price_max)
     or (new.competitive_price is distinct from old.competitive_price)
     or (new.recommended_price is distinct from old.recommended_price)
     or (new.high_profit_price is distinct from old.high_profit_price)
  then
    new.price_updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_wholesale_services_price_updated_at on wholesale_services;
create trigger trg_wholesale_services_price_updated_at
  before update on wholesale_services
  for each row execute function public.wholesale_touch_service_price_updated_at();

-- ----------------------------------------------------------------------------
-- 4. Immutability guard for wholesale_legal_documents — once a row has
--    published_at set, its legal content/version/publication identity can
--    never be edited or deleted, only superseded by a NEW row (a new
--    version, published via wholesale_publish_legal_document below, which
--    flips the OLD row's status to 'superseded' — a status-only UPDATE this
--    guard explicitly still allows).
-- ----------------------------------------------------------------------------
create or replace function public.wholesale_legal_documents_immutability_guard()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'DELETE' then
    if old.published_at is not null then
      raise exception 'cannot_delete_published_legal_document';
    end if;
    return old;
  end if;
  if old.published_at is not null then
    if new.content_en is distinct from old.content_en
       or new.content_es is distinct from old.content_es
       or new.content_hash is distinct from old.content_hash
       or new.version is distinct from old.version
       or new.published_at is distinct from old.published_at
       or new.published_by is distinct from old.published_by
    then
      raise exception 'cannot_modify_published_legal_document_content';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_wholesale_legal_documents_immutability on wholesale_legal_documents;
create trigger trg_wholesale_legal_documents_immutability
  before update or delete on wholesale_legal_documents
  for each row execute function public.wholesale_legal_documents_immutability_guard();

-- ----------------------------------------------------------------------------
-- 5. wholesale_price_history.service_id — CASCADE -> RESTRICT. See this
--    file's header (point 5) for why. The constraint name below
--    (wholesale_price_history_service_id_fkey) is Postgres's own default
--    naming for an inline `references` clause with no explicit constraint
--    name — exactly what wholesale-navigation-migration.sql used to create
--    this column — and is confirmed by wholesale-legal-preflight.sql's
--    pg_constraint query before this file is ever run. IF EXISTS makes this
--    step safe to re-run (a second run finds the constraint already named
--    exactly this, already RESTRICT, and re-applies the identical
--    definition).
-- ----------------------------------------------------------------------------
alter table wholesale_price_history drop constraint if exists wholesale_price_history_service_id_fkey;
alter table wholesale_price_history
  add constraint wholesale_price_history_service_id_fkey
  foreign key (service_id) references wholesale_services(id) on delete restrict;

-- ----------------------------------------------------------------------------
-- 6. wholesale_price_history — append-only guard. This audit trail backs
--    the "price last updated" disclosure (Document 3, Section 5) and the
--    records-retention commitments in Documents 4 and 6 — it must never be
--    edited or deleted after the fact, by any caller, old or new.
-- ----------------------------------------------------------------------------
create or replace function public.wholesale_price_history_append_only_guard()
returns trigger language plpgsql as $$
begin
  raise exception 'wholesale_price_history_is_append_only';
end;
$$;

drop trigger if exists trg_wholesale_price_history_append_only on wholesale_price_history;
create trigger trg_wholesale_price_history_append_only
  before update or delete on wholesale_price_history
  for each row execute function public.wholesale_price_history_append_only_guard();

-- ----------------------------------------------------------------------------
-- 7. wholesale_publish_legal_document — admin-only, atomically supersedes
--    whatever was published before (if anything) and inserts the new
--    published row in the same transaction PostgREST already wraps this
--    call in.
-- ----------------------------------------------------------------------------
create or replace function public.wholesale_publish_legal_document(
  p_admin_id uuid, p_version text, p_content_en jsonb, p_content_es jsonb
) returns uuid
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare v_hash text; v_id uuid;
begin
  if not exists (select 1 from public.profiles where id = p_admin_id and role = 'admin' and status = 'approved') then
    raise exception 'invalid_admin';
  end if;
  if p_version is null or length(btrim(p_version)) = 0 then
    raise exception 'invalid_version';
  end if;
  v_hash := encode(digest(p_content_en::text || p_content_es::text, 'sha256'), 'hex');
  update public.wholesale_legal_documents set status = 'superseded' where status = 'published';
  insert into public.wholesale_legal_documents
    (version, status, content_en, content_es, content_hash, published_at, published_by)
  values (p_version, 'published', p_content_en, p_content_es, v_hash, now(), p_admin_id)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.wholesale_publish_legal_document(
  uuid, text, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.wholesale_publish_legal_document(
  uuid, text, jsonb, jsonb
) to service_role;

-- ----------------------------------------------------------------------------
-- 8. wholesale_accept_legal_terms — the clickwrap RPC itself. Re-validates
--    every one of the 5 checkboxes, the representative name/title, the
--    locale, that the document being accepted is the CURRENTLY published one
--    (never a stale/superseded id a stale client tab might submit), and that
--    the shop is active — all inside the single statement PostgREST wraps
--    in one transaction, so a partially-valid acceptance can never be
--    recorded.
-- ----------------------------------------------------------------------------
create or replace function public.wholesale_accept_legal_terms(
  p_shop_id uuid, p_device_id uuid, p_session_id uuid, p_legal_document_id uuid,
  p_representative_name text, p_representative_title text,
  p_confirms_authority boolean, p_accepts_terms_privacy boolean,
  p_understands_tiers_optional boolean, p_understands_independent_pricing boolean,
  p_accepts_confidentiality boolean, p_locale text, p_ip text, p_user_agent text
) returns uuid
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare v_doc public.wholesale_legal_documents%rowtype; v_id uuid;
begin
  if not (p_confirms_authority and p_accepts_terms_privacy and p_understands_tiers_optional
          and p_understands_independent_pricing and p_accepts_confidentiality) then
    raise exception 'all_boxes_required';
  end if;
  if p_representative_name is null or length(btrim(p_representative_name)) = 0 or length(p_representative_name) > 200 then
    raise exception 'invalid_representative_name';
  end if;
  if p_representative_title is null or length(btrim(p_representative_title)) = 0 or length(p_representative_title) > 200 then
    raise exception 'invalid_representative_title';
  end if;
  if p_locale not in ('en', 'es') then
    raise exception 'invalid_locale';
  end if;
  select * into v_doc from public.wholesale_legal_documents where id = p_legal_document_id and status = 'published';
  if not found then
    raise exception 'document_not_published';
  end if;
  if not exists (select 1 from public.wholesale_shops where id = p_shop_id and status = 'active') then
    raise exception 'shop_not_active';
  end if;
  insert into wholesale_legal_acceptances
    (shop_id, device_id, session_id, legal_document_id, representative_name, representative_title,
     confirms_authority, accepts_terms_privacy, understands_tiers_optional,
     understands_independent_pricing, accepts_confidentiality, content_hash, locale, ip, user_agent)
  values (p_shop_id, p_device_id, p_session_id, p_legal_document_id, btrim(p_representative_name), btrim(p_representative_title),
     true, true, true, true, true, v_doc.content_hash, p_locale, p_ip, p_user_agent)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.wholesale_accept_legal_terms(
  uuid, uuid, uuid, uuid, text, text, boolean, boolean, boolean, boolean, boolean, text, text, text
) from public, anon, authenticated;
grant execute on function public.wholesale_accept_legal_terms(
  uuid, uuid, uuid, uuid, text, text, boolean, boolean, boolean, boolean, boolean, text, text, text
) to service_role;

commit;

-- ============================================================================
-- Not part of the transaction above, on purpose — read this, do not run it
-- as part of this file:
--
--   Run supabase/wholesale-legal-preflight.sql BEFORE this file, and
--   supabase/wholesale-legal-verify.sql AFTER.
--
--   supabase/wholesale-legal-rollback.sql documents how to undo every object
--   this file creates, for reference only — it is never run automatically
--   and is not part of this migration. Its non-destructive path never
--   reverts the service_id foreign key from RESTRICT back to CASCADE — see
--   that file's own header for why.
-- ============================================================================
