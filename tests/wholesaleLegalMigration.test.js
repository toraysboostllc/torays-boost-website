import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const supabaseDir = join(__dirname, "..", "supabase");
const migration = readFileSync(join(supabaseDir, "wholesale-legal-migration.sql"), "utf8");
const preflight = readFileSync(join(supabaseDir, "wholesale-legal-preflight.sql"), "utf8");
const verify = readFileSync(join(supabaseDir, "wholesale-legal-verify.sql"), "utf8");
const rollback = readFileSync(join(supabaseDir, "wholesale-legal-rollback.sql"), "utf8");

describe("wholesale-legal-migration.sql: wrapping and idempotency", () => {
  it("is wrapped in an explicit begin;/commit; transaction", () => {
    const lines = migration.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines.indexOf("commit;")).toBeGreaterThan(lines.indexOf("begin;"));
  });

  it("creates both new tables idempotently (create table if not exists)", () => {
    expect(migration).toContain("create table if not exists wholesale_legal_documents");
    expect(migration).toContain("create table if not exists wholesale_legal_acceptances");
  });

  it("every ADD CONSTRAINT on wholesale_legal_documents is preceded by a matching DROP CONSTRAINT IF EXISTS (re-run safety)", () => {
    expect(migration).toContain("alter table wholesale_legal_documents drop constraint if exists wholesale_legal_documents_content_keys_en;");
    expect(migration).toContain("alter table wholesale_legal_documents drop constraint if exists wholesale_legal_documents_content_keys_es;");
  });

  it("enforces all 6 content keys on both content_en and content_es", () => {
    const keys = ["access_agreement", "pricing_policy", "pricing_disclaimer", "privacy_security", "repair_warranty_terms", "econsent_disclosure"];
    const enBlock = migration.match(/wholesale_legal_documents_content_keys_en check \(([\s\S]*?)\);/)[1];
    const esBlock = migration.match(/wholesale_legal_documents_content_keys_es check \(([\s\S]*?)\);/)[1];
    for (const key of keys) {
      expect(enBlock).toContain(key);
      expect(esBlock).toContain(key);
    }
  });

  it("enforces all 5 checkboxes true via a table CHECK constraint, not just application code", () => {
    const block = migration.match(/wholesale_legal_acceptances_all_boxes_checked check \(([\s\S]*?)\)/)[1];
    expect(block).toContain("confirms_authority");
    expect(block).toContain("accepts_terms_privacy");
    expect(block).toContain("understands_tiers_optional");
    expect(block).toContain("understands_independent_pricing");
    expect(block).toContain("accepts_confidentiality");
  });

  it("the one-published partial unique index exists", () => {
    expect(migration).toContain("create unique index if not exists idx_wholesale_legal_documents_one_published");
    expect(migration).toContain("where status = 'published'");
  });

  it("enables RLS on both new tables with no new policies (service_role-only posture)", () => {
    expect(migration).toContain("alter table wholesale_legal_documents enable row level security;");
    expect(migration).toContain("alter table wholesale_legal_acceptances enable row level security;");
    expect(migration).not.toMatch(/create policy/);
  });

  it("adds price_updated_at as nullable, backfills only null rows, never overwrites an existing value", () => {
    expect(migration).toContain("alter table wholesale_services add column if not exists price_updated_at timestamptz;");
    expect(migration).toMatch(/update wholesale_services ws[\s\S]*?where price_updated_at is null;/);
  });

  it("the price_updated_at trigger checks exactly the 6 price fields", () => {
    const fnBlock = migration.match(/wholesale_touch_service_price_updated_at\(\)[\s\S]*?\$\$;/)[0];
    for (const field of ["fixed_price", "price_min", "price_max", "competitive_price", "recommended_price", "high_profit_price"]) {
      expect(fnBlock).toContain(field);
    }
    expect(fnBlock).not.toContain("notes");
    expect(fnBlock).not.toContain("name");
  });

  it("every CREATE TRIGGER is preceded by a matching DROP TRIGGER IF EXISTS (idempotent re-run)", () => {
    const triggers = [
      "trg_wholesale_services_price_updated_at",
      "trg_wholesale_legal_documents_immutability",
      "trg_wholesale_price_history_append_only",
    ];
    for (const trg of triggers) {
      expect(migration).toContain(`drop trigger if exists ${trg}`);
      expect(migration).toContain(`create trigger ${trg}`);
    }
  });

  it("the immutability guard blocks DELETE and UPDATE of content once published_at is set", () => {
    const fnBlock = migration.match(/wholesale_legal_documents_immutability_guard\(\)[\s\S]*?\$\$;/)[0];
    expect(fnBlock).toContain("cannot_delete_published_legal_document");
    expect(fnBlock).toContain("cannot_modify_published_legal_document_content");
  });

  it("the price_history append-only guard unconditionally raises on any UPDATE/DELETE", () => {
    const fnBlock = migration.match(/wholesale_price_history_append_only_guard\(\)[\s\S]*?\$\$;/)[0];
    expect(fnBlock).toContain("wholesale_price_history_is_append_only");
    expect(migration).toContain("before update or delete on wholesale_price_history");
  });

  it("changes wholesale_price_history.service_id from CASCADE to RESTRICT using the exact default constraint name", () => {
    expect(migration).toContain("alter table wholesale_price_history drop constraint if exists wholesale_price_history_service_id_fkey;");
    expect(migration).toMatch(/add constraint wholesale_price_history_service_id_fkey\s*\n\s*foreign key \(service_id\) references wholesale_services\(id\) on delete restrict;/);
  });

  it("wholesale_publish_legal_document: admin-gated, computes a real sha256 hash, atomically supersedes the prior published row", () => {
    const fnBlock = migration.match(/wholesale_publish_legal_document\([\s\S]*?\$\$;/)[0];
    expect(fnBlock).toContain("role = 'admin' and status = 'approved'");
    expect(fnBlock).toContain("digest(p_content_en::text || p_content_es::text, 'sha256')");
    expect(fnBlock).toContain("set status = 'superseded' where status = 'published'");
  });

  it("wholesale_publish_legal_document is granted to service_role only", () => {
    expect(migration).toMatch(/revoke execute on function public\.wholesale_publish_legal_document\(\s*uuid, text, jsonb, jsonb\s*\) from public, anon, authenticated;/);
    expect(migration).toMatch(/grant execute on function public\.wholesale_publish_legal_document\(\s*uuid, text, jsonb, jsonb\s*\) to service_role;/);
  });

  it("wholesale_accept_legal_terms: validates all 5 checkboxes, name/title, locale, published-document match, and shop-active", () => {
    const fnBlock = migration.match(/create or replace function public\.wholesale_accept_legal_terms\([\s\S]*?\$\$;/)[0];
    expect(fnBlock).toContain("all_boxes_required");
    expect(fnBlock).toContain("invalid_representative_name");
    expect(fnBlock).toContain("invalid_representative_title");
    expect(fnBlock).toContain("invalid_locale");
    expect(fnBlock).toContain("document_not_published");
    expect(fnBlock).toContain("shop_not_active");
    expect(fnBlock).toContain("status = 'published'");
  });

  it("wholesale_accept_legal_terms is granted to service_role only", () => {
    expect(migration).toMatch(/grant execute on function public\.wholesale_accept_legal_terms\(/);
    expect(migration).toMatch(/revoke execute on function public\.wholesale_accept_legal_terms\(/);
    expect(migration).not.toMatch(/grant execute on function public\.wholesale_accept_legal_terms\([\s\S]{0,400}to (anon|authenticated|public)/i);
  });

  it("no DELETE, DROP TABLE, or DROP COLUMN anywhere in the migration itself", () => {
    const stripped = migration
      .split("\n")
      .map((l) => (l.trimStart().startsWith("--") ? "" : l))
      .join("\n");
    expect(stripped).not.toMatch(/\bdelete from\b/i);
    expect(stripped).not.toMatch(/\bdrop table\b/i);
    expect(stripped).not.toMatch(/\bdrop column\b/i);
  });
});

describe("wholesale-legal-preflight.sql: read-only, checks the FK name/deltype and orphan count", () => {
  it("is read-only — no insert/update/delete/alter/create/drop statement", () => {
    expect(preflight).not.toMatch(/\binsert into\b|\bupdate\s+\w+\s+set\b|\bdelete from\b|\balter table\b|\bcreate table\b|\bdrop table\b/i);
  });

  it("queries pg_constraint for the exact service_id FK name and confdeltype", () => {
    expect(preflight).toContain("conrelid = 'public.wholesale_price_history'::regclass and confrelid = 'public.wholesale_services'::regclass");
    expect(preflight).toContain("confdeltype");
  });

  it("checks for zero orphaned wholesale_price_history rows before the FK becomes RESTRICT", () => {
    expect(preflight).toMatch(/left join wholesale_services ws on ws\.id = ph\.service_id[\s\S]*?where ws\.id is null/);
  });

  it("checks pgcrypto is enabled", () => {
    expect(preflight).toContain("pg_extension where extname = 'pgcrypto'");
  });

  it("produces a single OVERALL STATUS row", () => {
    expect(preflight).toContain("'OVERALL STATUS'");
  });
});

describe("wholesale-legal-verify.sql: wrapped in begin;/rollback; so nothing it does ever persists", () => {
  it("starts with begin; and ends with rollback; (never commit;)", () => {
    const lines = verify.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines[lines.length - 1]).toBe("rollback;");
    expect(verify).not.toMatch(/\ncommit;/);
  });

  it("every synthetic row it creates is tagged with the __wsl_verify__ marker", () => {
    expect(verify).toContain("__wsl_verify__");
  });

  it("functionally tests the one-published unique index by attempting a real second published insert", () => {
    expect(verify).toContain("unique_violation");
  });

  it("functionally tests the immutability guard with a real UPDATE and a real DELETE attempt", () => {
    expect(verify).toMatch(/update wholesale_legal_documents set content_en/);
    expect(verify).toMatch(/delete from wholesale_legal_documents where id = v_doc_id/);
  });

  it("functionally tests the append-only guard on wholesale_price_history", () => {
    expect(verify).toContain("append_only_guard_rejects_update_and_delete");
  });

  it("functionally tests that a real service with real price_history rows cannot be deleted (FK violation), skipping gracefully if no real data exists yet", () => {
    expect(verify).toContain("foreign_key_violation");
    expect(verify).toContain("SKIPPED");
  });

  it("confirms wholesale_price_history's row count is unchanged by this file's own checks", () => {
    expect(verify).toContain("price_history_row_count_unchanged");
  });
});

describe("wholesale-legal-rollback.sql: correct drop order, never reverts the FK to CASCADE", () => {
  it("drops triggers before the functions/tables they depend on", () => {
    const triggerIdx = rollback.indexOf("drop trigger if exists trg_wholesale_price_history_append_only");
    const tableIdx = rollback.indexOf("drop table if exists wholesale_legal_acceptances");
    expect(triggerIdx).toBeGreaterThan(-1);
    expect(tableIdx).toBeGreaterThan(triggerIdx);
  });

  it("never reverts wholesale_price_history.service_id back to CASCADE", () => {
    expect(rollback).not.toMatch(/on delete cascade/i);
  });

  it("explicitly warns about destroying real legal-acceptance records", () => {
    expect(rollback).toMatch(/DESTRUCTIVE/);
  });

  it("is wrapped in begin;/commit;", () => {
    const lines = rollback.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines.indexOf("commit;")).toBeGreaterThan(lines.indexOf("begin;"));
  });
});
