import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Regression coverage for the immutability defense-in-depth patch, added
 * after a real Supabase run revealed that
 * wholesale_legal_documents_immutability_guard() protected a row's content
 * based solely on `published_at is not null` — a single signal. A row with
 * status='published'/'superseded' but published_at accidentally NULL was not
 * protected. wholesale-legal-migration.sql was already executed in
 * production, so this fix ships as a small, standalone patch quartet
 * (preflight/migration/verify/rollback) rather than an edit to that already-
 * applied file.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const supabaseDir = join(__dirname, "..", "supabase");

const preflight = readFileSync(join(supabaseDir, "wholesale-legal-immutability-patch-preflight.sql"), "utf8");
const migration = readFileSync(join(supabaseDir, "wholesale-legal-immutability-patch-migration.sql"), "utf8");
const verify = readFileSync(join(supabaseDir, "wholesale-legal-immutability-patch-verify.sql"), "utf8");
const rollback = readFileSync(join(supabaseDir, "wholesale-legal-immutability-patch-rollback.sql"), "utf8");
const mainMigration = readFileSync(join(supabaseDir, "wholesale-legal-migration.sql"), "utf8");
const mainRollback = readFileSync(join(supabaseDir, "wholesale-legal-rollback.sql"), "utf8");

function stripComments(sql) {
  return sql.replace(/--[^\n]*/g, "");
}

describe("wholesale-legal-immutability-patch-preflight.sql: read-only gate before the patch", () => {
  it("is read-only — no insert/update/delete/alter/create/drop statement", () => {
    expect(preflight).not.toMatch(/\binsert into\b|\bupdate\s+\w+\s+set\b|\bdelete from\b|\balter table\b|\bcreate table\b|\bdrop table\b/i);
  });

  it("flags any existing published/superseded row with a null published_at, with offending row details", () => {
    expect(preflight).toMatch(/where status in \('published', 'superseded'\) and published_at is null/);
    expect(preflight).toContain("zero_published_or_superseded_rows_with_null_published_at");
    expect(preflight).toContain("offender_details");
  });

  it("confirms the guard function/trigger prerequisite from wholesale-legal-migration.sql already exists", () => {
    expect(preflight).toContain("wholesale_legal_documents_immutability_guard");
    expect(preflight).toContain("trg_wholesale_legal_documents_immutability");
  });

  it("produces a single OVERALL STATUS row", () => {
    expect(preflight).toContain("'OVERALL STATUS'");
  });
});

describe("wholesale-legal-immutability-patch-migration.sql: the two-layer fix", () => {
  it("is wrapped in an explicit begin;/commit; transaction", () => {
    const lines = migration.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines.indexOf("commit;")).toBeGreaterThan(lines.indexOf("begin;"));
  });

  it("adds the published_at-required-for-published/superseded CHECK constraint, idempotently (drop-then-add)", () => {
    expect(migration).toContain("drop constraint if exists wholesale_legal_documents_published_requires_published_at");
    expect(migration).toMatch(/add constraint wholesale_legal_documents_published_requires_published_at check \(\s*status not in \('published', 'superseded'\) or published_at is not null\s*\)/);
  });

  it("widens the immutability guard's entry condition to check status OR published_at, for both the DELETE branch and the UPDATE branch", () => {
    const fnBlock = migration.match(/wholesale_legal_documents_immutability_guard\(\)[\s\S]*?\$\$;/)[0];
    const entryConditions = fnBlock.match(/old\.status in \('published', 'superseded'\) or old\.published_at is not null/g);
    expect(entryConditions, "expected the widened condition to appear once for DELETE and once for UPDATE").not.toBeNull();
    expect(entryConditions.length).toBe(2);
  });

  it("does not change the set of protected columns (content_en, content_es, content_hash, version, published_at, published_by)", () => {
    const fnBlock = migration.match(/wholesale_legal_documents_immutability_guard\(\)[\s\S]*?\$\$;/)[0];
    for (const col of ["content_en", "content_es", "content_hash", "version", "published_at", "published_by"]) {
      expect(fnBlock).toContain(`new.${col} is distinct from old.${col}`);
    }
  });

  it("preserves the exact original exception messages", () => {
    expect(migration).toContain("cannot_delete_published_legal_document");
    expect(migration).toContain("cannot_modify_published_legal_document_content");
  });

  it("does not touch or re-declare the trigger itself (CREATE OR REPLACE FUNCTION is sufficient; no CREATE TRIGGER / DROP TRIGGER here)", () => {
    expect(migration).not.toMatch(/create trigger|drop trigger/i);
  });

  it("never modifies wholesale-legal-migration.sql or re-runs any of its own steps (no CREATE TABLE, no RPC definitions — this file's own header prose legitimately NAMES those RPCs to explain context, so comments are stripped first)", () => {
    const body = stripComments(migration);
    expect(body).not.toMatch(/create table/i);
    expect(body).not.toContain("wholesale_publish_legal_document");
    expect(body).not.toContain("wholesale_accept_legal_terms");
  });

  it("no DELETE, DROP TABLE, or DROP COLUMN anywhere (this patch never touches rows or removes data-bearing objects)", () => {
    const stripped = migration
      .split("\n")
      .map((l) => (l.trimStart().startsWith("--") ? "" : l))
      .join("\n");
    expect(stripped).not.toMatch(/\bdelete from\b/i);
    expect(stripped).not.toMatch(/\bdrop table\b/i);
    expect(stripped).not.toMatch(/\bdrop column\b/i);
  });
});

describe("wholesale-legal-immutability-patch-verify.sql: wrapped in begin;/rollback;, no live SAVEPOINT anywhere", () => {
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

  it("every synthetic row is tagged with the __wsl_verify__ marker", () => {
    expect(verify).toContain("__wsl_verify__");
  });

  it("functionally tests the constraint rejects status='published' and status='superseded' with published_at omitted", () => {
    expect(verify).toContain("constraint_rejects_insert_published_without_published_at");
    expect(verify).toContain("constraint_rejects_insert_superseded_without_published_at");
  });

  it("functionally tests that draft rows are unaffected (regression guard against over-blocking)", () => {
    expect(verify).toContain("constraint_allows_draft_without_published_at");
  });

  it("check 5: proves the GUARD ITSELF (not just the constraint) blocks a status='published' row with published_at NULL, by temporarily dropping the constraint inside a nested block guaranteed to roll back", () => {
    const match = verify.match(/-- Functional check \(5\)[\s\S]*?end \$\$;/);
    expect(match, "check 5 do $$ block not found").toBeTruthy();
    const body = match[0];
    expect(body).toContain("drop constraint if exists wholesale_legal_documents_published_requires_published_at");
    expect(body).toContain("guard_blocks_published_with_null_published_at_defense_in_depth");
    // Isolated via the same ZZ001 (unexpected-success)/ZZ002 (deliberate
    // full-cleanup) sentinel pattern as the main verify file's check 13 —
    // never a live SAVEPOINT.
    expect(body).toContain("raise exception '__wsl_verify_unexpected_success__' using errcode = 'ZZ001';");
    expect(body).toContain("raise exception '__wsl_verify_cleanup__' using errcode = 'ZZ002';");
    const stripped = stripComments(body);
    expect(stripped).not.toMatch(/\bsavepoint\b/i);
  });

  it("check 6: proves the legitimate published -> superseded status-only transition (the RPC's own supersede step) still succeeds under the widened guard", () => {
    const match = verify.match(/-- Functional check \(6\)[\s\S]*?end \$\$;/);
    expect(match, "check 6 do $$ block not found").toBeTruthy();
    const body = match[0];
    expect(body).toContain("guard_still_allows_legitimate_published_to_superseded_transition");
    expect(body).toMatch(/update wholesale_legal_documents set status = 'superseded' where id = v_id;/);
  });

  it("final check confirms wholesale_legal_documents' row count is unchanged from a snapshot taken before the functional checks — every synthetic row is self-cleaning", () => {
    expect(verify).toContain("select count(*) into v_before from wholesale_legal_documents;");
    expect(verify).toContain("legal_documents_row_count_unchanged");
  });

  it("produces a single OVERALL STATUS row", () => {
    expect(verify).toContain("'OVERALL STATUS'");
  });
});

describe("wholesale-legal-immutability-patch-rollback.sql: non-destructive, reference-only", () => {
  it("is wrapped in begin;/commit;", () => {
    const lines = rollback.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines.indexOf("commit;")).toBeGreaterThan(lines.indexOf("begin;"));
  });

  it("contains no DELETE, DROP TABLE, or DROP COLUMN — this rollback never destroys data", () => {
    const stripped = rollback
      .split("\n")
      .map((l) => (l.trimStart().startsWith("--") ? "" : l))
      .join("\n");
    expect(stripped).not.toMatch(/\bdelete from\b/i);
    expect(stripped).not.toMatch(/\bdrop table\b/i);
    expect(stripped).not.toMatch(/\bdrop column\b/i);
  });

  it("drops only the constraint this patch added", () => {
    expect(rollback).toContain("drop constraint if exists wholesale_legal_documents_published_requires_published_at");
  });

  it("restores the guard function to its exact pre-patch form (published_at alone, no status check)", () => {
    const fnBlock = rollback.match(/wholesale_legal_documents_immutability_guard\(\)[\s\S]*?\$\$;/)[0];
    expect(fnBlock).not.toMatch(/old\.status in \('published', 'superseded'\)/);
    expect(fnBlock).toContain("old.published_at is not null");
  });

  it("restored function is byte-identical in logic to the ORIGINAL function defined in wholesale-legal-migration.sql (same exception messages, same protected columns)", () => {
    const rollbackFn = rollback.match(/create or replace function public\.wholesale_legal_documents_immutability_guard\(\)[\s\S]*?\$\$;/)[0];
    const originalFn = mainMigration.match(/create or replace function public\.wholesale_legal_documents_immutability_guard\(\)[\s\S]*?\$\$;/)[0];
    // Normalize whitespace before comparing so incidental indentation
    // differences between the two files don't cause a false mismatch.
    const normalize = (s) => s.replace(/\s+/g, " ").trim();
    expect(normalize(rollbackFn)).toBe(normalize(originalFn));
  });
});

describe("wholesale-legal-rollback.sql: unaffected by this patch, on purpose", () => {
  it("still drops the same trigger/function names this patch reuses — no new trigger/function name was introduced that would need its own drop step", () => {
    expect(mainRollback).toContain("drop trigger if exists trg_wholesale_legal_documents_immutability on wholesale_legal_documents;");
    expect(mainRollback).toContain("drop function if exists public.wholesale_legal_documents_immutability_guard();");
  });
});
