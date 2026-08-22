import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Second, independent legal document type — "Estimate Disclaimer",
 * accepted IN PARALLEL with the existing 6-document master agreement
 * (neither replaces the other — see this quartet's migration header for
 * the full "why"). Additive follow-up to wholesale-legal-migration.sql AND
 * wholesale-legal-immutability-patch-migration.sql, both already executed
 * in production and left completely untouched. This quartet was proven
 * end-to-end against a real, isolated pglite Postgres instance (running
 * every file in this quartet verbatim from disk, plus an idempotency
 * re-run and a rollback pass) — never against Supabase. These tests are
 * structural/source-scan regression coverage, same convention as
 * wholesaleLegalImmutabilityPatch.test.js.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const supabaseDir = join(__dirname, "..", "supabase");

const preflight = readFileSync(join(supabaseDir, "wholesale-legal-document-types-preflight.sql"), "utf8");
const migration = readFileSync(join(supabaseDir, "wholesale-legal-document-types-migration.sql"), "utf8");
const verify = readFileSync(join(supabaseDir, "wholesale-legal-document-types-verify.sql"), "utf8");
const rollback = readFileSync(join(supabaseDir, "wholesale-legal-document-types-rollback.sql"), "utf8");

function stripComments(sql) {
  return sql.replace(/--[^\n]*/g, "");
}

describe("wholesale-legal-document-types-preflight.sql: read-only gate", () => {
  it("is read-only — no insert/update/delete/alter/create/drop statement", () => {
    expect(preflight).not.toMatch(/\binsert into\b|\bupdate\s+\w+\s+set\b|\bdelete from\b|\balter table\b|\bcreate table\b|\bdrop table\b/i);
  });

  it("confirms every prerequisite from the base migration and the immutability patch", () => {
    expect(preflight).toContain("wholesale_legal_documents");
    expect(preflight).toContain("wholesale_publish_legal_document");
    expect(preflight).toContain("wholesale_accept_legal_terms");
    expect(preflight).toContain("wholesale_legal_documents_published_requires_published_at");
  });

  it("confirms the exact constraint name (wholesale_legal_documents_version_key) the migration's DROP CONSTRAINT step targets", () => {
    expect(preflight).toContain("wholesale_legal_documents_version_key");
  });

  it("guards against a partial prior run (mix of new objects present/absent) as REVIEW REQUIRED, not a hard FAIL", () => {
    expect(preflight).toContain("A MIX of true/false means a previous run was interrupted partway");
  });

  it("produces a single OVERALL STATUS row", () => {
    expect(preflight).toContain("'OVERALL STATUS'");
  });
});

describe("wholesale-legal-document-types-migration.sql: additive, never touches v1 objects", () => {
  it("is wrapped in an explicit begin;/commit; transaction", () => {
    const lines = migration.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines.indexOf("commit;")).toBeGreaterThan(lines.indexOf("begin;"));
  });

  it("never references wholesale_publish_legal_document (v1) or wholesale_accept_legal_terms in a CREATE OR REPLACE/DROP — only names them in prose", () => {
    const body = stripComments(migration);
    expect(body).not.toMatch(/create or replace function public\.wholesale_publish_legal_document\(/);
    expect(body).not.toMatch(/create or replace function public\.wholesale_accept_legal_terms\(/);
    expect(body).not.toMatch(/drop function/i);
  });

  it("document_type column defaults every existing (and future v1-inserted) row to 'master_agreement', with a CHECK constraint", () => {
    expect(migration).toContain("add column if not exists document_type text not null default 'master_agreement'");
    expect(migration).toMatch(/check \(document_type in \('master_agreement', 'estimate_disclaimer'\)\)/);
  });

  it("rescopes version uniqueness from global to (document_type, version), dropping the old constraint by its confirmed name", () => {
    expect(migration).toContain("drop constraint if exists wholesale_legal_documents_version_key");
    expect(migration).toMatch(/add constraint wholesale_legal_documents_version_document_type_key\s*\n?\s*unique \(document_type, version\)/);
  });

  it("replaces the unconditional content-key CHECKs with conditional-by-type ones, preserving the master_agreement 6-key list byte-for-byte", () => {
    expect(migration).toContain("drop constraint if exists wholesale_legal_documents_content_keys_en");
    expect(migration).toContain("drop constraint if exists wholesale_legal_documents_content_keys_es");
    expect(migration).toMatch(/document_type = 'master_agreement' and content_en \?& array\['access_agreement','pricing_policy','pricing_disclaimer',\s*\n\s*'privacy_security','repair_warranty_terms','econsent_disclosure'\]/);
    expect(migration).toMatch(/document_type = 'estimate_disclaimer' and content_en \? 'body'/);
    expect(migration).toMatch(/document_type = 'estimate_disclaimer' and content_es \? 'body'/);
  });

  it("rescopes the one-published index from table-wide to per-document_type", () => {
    expect(migration).toContain("drop index if exists idx_wholesale_legal_documents_one_published;");
    expect(migration).toMatch(/create unique index if not exists idx_wholesale_legal_documents_one_published_per_type\s*\n\s*on wholesale_legal_documents \(document_type\) where status = 'published';/);
  });

  it("widens the immutability guard to also protect document_type, preserving the immutability-patch's status-OR-published_at entry condition and the same function name (no trigger re-declaration)", () => {
    const fnBlock = migration.match(/wholesale_legal_documents_immutability_guard\(\)[\s\S]*?\$\$;/)[0];
    const entryConditions = fnBlock.match(/old\.status in \('published', 'superseded'\) or old\.published_at is not null/g);
    expect(entryConditions?.length).toBe(2);
    expect(fnBlock).toContain("new.document_type is distinct from old.document_type");
    expect(migration).not.toMatch(/create trigger|drop trigger/i);
  });

  it("creates a NEW, separate wholesale_estimate_disclaimer_acceptances table — never widens the existing wholesale_legal_acceptances table", () => {
    expect(migration).toContain("create table if not exists wholesale_estimate_disclaimer_acceptances");
    expect(migration).not.toMatch(/alter table wholesale_legal_acceptances/);
    expect(migration).toMatch(/check \(accepts_terms = true\)/);
    // Scoped to the CREATE TABLE statement itself, not the whole file — the
    // header prose legitimately mentions "representative_name/title" once,
    // in a sentence explaining that this new table deliberately does NOT
    // widen the existing wholesale_legal_acceptances table with those
    // columns (see this migration's own point 6).
    const tableBlock = migration.slice(migration.indexOf("create table if not exists wholesale_estimate_disclaimer_acceptances"), migration.indexOf(");", migration.indexOf("create table if not exists wholesale_estimate_disclaimer_acceptances")));
    expect(tableBlock).not.toContain("representative_name");
    expect(tableBlock).not.toContain("representative_title");
  });

  it("enables RLS on the new table with no new policies (service_role-only posture)", () => {
    expect(migration).toContain("alter table wholesale_estimate_disclaimer_acceptances enable row level security;");
    expect(migration).not.toMatch(/create policy.*wholesale_estimate_disclaimer_acceptances/is);
  });

  it("wholesale_publish_legal_document_v2 is a distinct, new function — supersede is scoped by document_type", () => {
    expect(migration).toMatch(/create or replace function public\.wholesale_publish_legal_document_v2\(\s*\n\s*p_admin_id uuid, p_document_type text, p_version text, p_content_en jsonb, p_content_es jsonb\s*\n\s*\)/);
    expect(migration).toMatch(/update public\.wholesale_legal_documents set status = 'superseded'\s*\n\s*where status = 'published' and document_type = p_document_type;/);
    expect(migration).toContain("grant execute on function public.wholesale_publish_legal_document_v2(");
    expect(migration).toContain("to service_role;");
    expect(migration).toMatch(/revoke execute on function public\.wholesale_publish_legal_document_v2\([\s\S]*?from public, anon, authenticated;/);
  });

  it("wholesale_accept_estimate_disclaimer re-validates the checkbox in SQL, requires the CURRENT published estimate_disclaimer (rejects other types/stale ids), no representative name/title parameters", () => {
    // Anchored to the real CREATE OR REPLACE FUNCTION statement, not the
    // bare function name — the header prose (point 7 of this file's
    // overview) also mentions "wholesale_accept_estimate_disclaimer(" with
    // an opening paren, which a bare-name match would latch onto first.
    const fnBlock = migration.match(/create or replace function public\.wholesale_accept_estimate_disclaimer\([\s\S]*?\$\$;/)[0];
    expect(fnBlock).toContain("if not p_accepts_terms then");
    expect(fnBlock).toContain("raise exception 'checkbox_required';");
    expect(fnBlock).toMatch(/where id = p_legal_document_id and status = 'published' and document_type = 'estimate_disclaimer';/);
    expect(fnBlock).not.toContain("p_representative_name");
    expect(fnBlock).not.toContain("p_representative_title");
    expect(migration).toContain("grant execute on function public.wholesale_accept_estimate_disclaimer(");
  });

  it("both new RPCs are security invoker, revoked from public/anon/authenticated, granted only to service_role", () => {
    for (const fn of ["wholesale_publish_legal_document_v2", "wholesale_accept_estimate_disclaimer"]) {
      const idx = migration.indexOf(`function public.${fn}(`);
      const block = migration.slice(idx, migration.indexOf("$$;", idx) + 3);
      expect(block).toContain("security invoker");
    }
    expect(migration).toMatch(/revoke execute on function public\.wholesale_publish_legal_document_v2\([\s\S]*?from public, anon, authenticated;/);
    expect(migration).toMatch(/revoke execute on function public\.wholesale_accept_estimate_disclaimer\([\s\S]*?from public, anon, authenticated;/);
  });

  it("no DELETE, DROP TABLE, or DROP COLUMN anywhere (purely additive to existing rows)", () => {
    const stripped = migration
      .split("\n")
      .map((l) => (l.trimStart().startsWith("--") ? "" : l))
      .join("\n");
    expect(stripped).not.toMatch(/\bdelete from\b/i);
    expect(stripped).not.toMatch(/\bdrop table\b/i);
    expect(stripped).not.toMatch(/\bdrop column\b/i);
  });
});

describe("wholesale-legal-document-types-verify.sql: wrapped in begin;/rollback;, no live SAVEPOINT anywhere", () => {
  it("starts with begin; and ends with rollback; (never commit;)", () => {
    const lines = verify.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines[lines.length - 1]).toBe("rollback;");
    expect(verify).not.toMatch(/\ncommit;/);
  });

  it("contains no LIVE SAVEPOINT/ROLLBACK TO anywhere (comments explaining the design are fine)", () => {
    const body = stripComments(verify);
    expect(body).not.toMatch(/\bsavepoint\b/i);
    expect(body).not.toMatch(/\brollback to\b/i);
  });

  it("every synthetic row is tagged with the __wsldt_verify__ marker, distinct from the base file's __wsl_verify__", () => {
    expect(verify).toContain("__wsldt_verify__");
  });

  it("tests the content-shape CHECK is genuinely conditional, not either-shape-for-any-type (cross-type rejection both directions)", () => {
    expect(verify).toContain("content_shape_check_is_genuinely_conditional_per_type");
    expect(verify).toContain("v_estimate_with_six_keys_rejected");
    expect(verify).toContain("v_master_with_body_only_rejected");
  });

  it("tests version uniqueness is scoped per type (same version legal across types, duplicate rejected within one type)", () => {
    expect(verify).toContain("version_uniqueness_is_scoped_by_document_type");
  });

  it("tests the one-published-per-type index functionally: coexistence across types, rejection within a type — and never leaves a published sentinel behind (force-rolled-back via a ZZ002 cleanup sentinel, since a plain DELETE on a published row is correctly rejected by the guard)", () => {
    const match = verify.match(/-- Functional check \(11\)[\s\S]*?end \$\$;/);
    expect(match, "check 11 do $$ block not found").toBeTruthy();
    const body = match[0];
    expect(body).toContain("one_published_per_type_index_functional");
    expect(body).not.toMatch(/\bdelete from wholesale_legal_documents\b/);
    expect(body).toContain("raise exception '__wsldt_verify_cleanup__' using errcode = 'ZZ002';");
  });

  it("tests the widened guard rejects a document_type change on a published row, same force-rollback cleanup discipline (never a plain DELETE against a published sentinel)", () => {
    const match = verify.match(/-- Functional check \(12\)[\s\S]*?end \$\$;/);
    expect(match, "check 12 do $$ block not found").toBeTruthy();
    const body = match[0];
    expect(body).toContain("immutability_guard_rejects_document_type_change_on_published");
    expect(body).not.toMatch(/\bdelete from wholesale_legal_documents\b/);
    expect(body).toContain("raise exception '__wsldt_verify_cleanup__' using errcode = 'ZZ002';");
  });

  it("checks 11-12 reuse an existing published row per type rather than unconditionally inserting a second one — safe to run against real production data", () => {
    expect(verify).toContain("reused existing published row id=");
  });

  it("does not call either new RPC directly (same scope discipline as wholesale-legal-verify.sql, which never calls wholesale_accept_legal_terms/wholesale_publish_legal_document either) — RPC behavior is proven once via pglite instead", () => {
    const body = stripComments(verify);
    expect(body).not.toMatch(/select\s+wholesale_publish_legal_document_v2\(/i);
    expect(body).not.toMatch(/select\s+wholesale_accept_estimate_disclaimer\(/i);
  });

  it("final check confirms zero leftover rows matching the synthetic marker", () => {
    expect(verify).toContain("no_leftover_synthetic_rows");
  });

  it("produces a single OVERALL STATUS row", () => {
    expect(verify).toContain("'OVERALL STATUS'");
  });
});

describe("wholesale-legal-document-types-rollback.sql: destructive-if-real-data warnings present, and never touches v1 objects", () => {
  it("is wrapped in begin;/commit;", () => {
    const lines = rollback.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines.indexOf("commit;")).toBeGreaterThan(lines.indexOf("begin;"));
  });

  it("warns explicitly before dropping wholesale_estimate_disclaimer_acceptances (destructive) and before restoring pre-migration constraints (only safe with zero estimate_disclaimer rows)", () => {
    expect(rollback).toMatch(/WARNING/);
    expect(rollback).toContain("drop table if exists wholesale_estimate_disclaimer_acceptances;");
  });

  it("restores the immutability guard to its pre-this-migration form (status-OR-published_at preserved from the earlier patch, document_type removed from the protected-column list)", () => {
    const fnBlock = rollback.match(/wholesale_legal_documents_immutability_guard\(\)[\s\S]*?\$\$;/)[0];
    expect(fnBlock).toContain("old.status in ('published', 'superseded') or old.published_at is not null");
    expect(fnBlock).not.toContain("new.document_type is distinct from old.document_type");
  });

  it("restores the original table-wide one-published index and the original global version unique constraint", () => {
    expect(rollback).toContain("create unique index if not exists idx_wholesale_legal_documents_one_published");
    expect(rollback).toMatch(/add constraint wholesale_legal_documents_version_key unique \(version\)/);
  });

  it("never references or drops wholesale_publish_legal_document (v1) or wholesale_accept_legal_terms", () => {
    const body = stripComments(rollback);
    expect(body).not.toContain("wholesale_publish_legal_document(");
    expect(body).not.toContain("wholesale_accept_legal_terms(");
  });

  it("drops document_type last, after every dependent object", () => {
    const typeColIdx = rollback.indexOf("drop column if exists document_type");
    const tableDropIdx = rollback.indexOf("drop table if exists wholesale_estimate_disclaimer_acceptances");
    const indexIdx = rollback.indexOf("idx_wholesale_legal_documents_one_published_per_type");
    expect(typeColIdx).toBeGreaterThan(tableDropIdx);
    expect(typeColIdx).toBeGreaterThan(indexIdx);
  });
});
