import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

/**
 * Regression coverage for a real Vercel runtime error captured on
 * 2026-08-22, publishing an Estimate Disclaimer version in a live Preview
 * (deployment dpl_7oxbthDzMc7H9CJ8iJ6wJckrx7XD):
 *
 *   [wholesale-admin/legal] publishEstimateDisclaimer failed:
 *   supabase_rest_failed: 404 {"code":"42883","details":null,
 *   "hint":"No function matches the given name and argument types. You
 *   might need to add explicit type casts.",
 *   "message":"function digest(text, unknown) does not exist"}
 *
 * Root cause: this Supabase project has pgcrypto (which provides digest())
 * installed in the `extensions` schema — Supabase's own default when an
 * extension is enabled via its dashboard, never `public`. Both
 * wholesale_publish_legal_document (v1, wholesale-legal-migration.sql) and
 * wholesale_publish_legal_document_v2 (v2, wholesale-legal-document-types-
 * migration.sql) are declared `security invoker set search_path = public,
 * pg_temp` — that SET clause overrides the calling session's search_path
 * for the function body only, and never included `extensions`, so the
 * unqualified digest() call could never resolve on this project. v1 has
 * the exact same latent defect; it had simply never been exercised against
 * a real Supabase publish before v2 was (see this quartet's own preflight
 * for the full evidence chain).
 *
 * Fix ships as a small, standalone patch quartet (preflight/migration/
 * verify/rollback) — wholesale-legal-migration.sql and wholesale-legal-
 * document-types-migration.sql (both already executed in production) are
 * left completely untouched.
 *
 * Part 1 (below) is a REAL, executable reproduction: an isolated pglite
 * Postgres instance with pgcrypto explicitly installed into an `extensions`
 * schema (never `public`), running the ACTUAL v1/v2 function bodies read
 * verbatim from the real, already-committed migration files on disk — not
 * retyped by hand. Confirms the exact reported error (message + SQLSTATE
 * 42883) reproduces, then applies wholesale-legal-pgcrypto-schema-fix-
 * migration.sql (also read verbatim from disk) and confirms both RPCs now
 * publish successfully with a verifiably-correct SHA-256 hash, then applies
 * wholesale-legal-pgcrypto-schema-fix-rollback.sql (verbatim) and confirms
 * the exact original bug reopens — full fix/rollback round-trip.
 *
 * Part 2 (below) is structural/source-scan regression coverage, same
 * convention as wholesaleLegalImmutabilityPatch.test.js.
 *
 * Isolation note: this test builds a MINIMAL standalone schema (just the
 * columns wholesale_publish_legal_document/_v2 actually touch on profiles
 * and wholesale_legal_documents) rather than running the full real
 * migrations end to end — the function BODIES under test are copied
 * verbatim from the real files either way, so this does not weaken what's
 * being proven about the digest() bug/fix; it only skips schema surface
 * (CHECK constraints, triggers, indexes) this bug has nothing to do with.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const supabaseDir = join(__dirname, "..", "supabase");

const preflight = readFileSync(join(supabaseDir, "wholesale-legal-pgcrypto-schema-fix-preflight.sql"), "utf8");
const migration = readFileSync(join(supabaseDir, "wholesale-legal-pgcrypto-schema-fix-migration.sql"), "utf8");
const verify = readFileSync(join(supabaseDir, "wholesale-legal-pgcrypto-schema-fix-verify.sql"), "utf8");
const rollback = readFileSync(join(supabaseDir, "wholesale-legal-pgcrypto-schema-fix-rollback.sql"), "utf8");
const v1MainMigration = readFileSync(join(supabaseDir, "wholesale-legal-migration.sql"), "utf8");
const v2MainMigration = readFileSync(join(supabaseDir, "wholesale-legal-document-types-migration.sql"), "utf8");

function stripComments(sql) {
  return sql.replace(/--[^\n]*/g, "");
}

/** Pulls a single `create or replace function public.<name>(...) ... $$;`
 *  block out of a larger SQL file, verbatim — never hand-retyped. */
function extractFunction(sql, name) {
  const marker = `create or replace function public.${name}(`;
  const start = sql.indexOf(marker);
  if (start === -1) throw new Error(`function ${name} not found in source`);
  const end = sql.indexOf("\n$$;", start);
  if (end === -1) throw new Error(`end of function ${name} not found`);
  return sql.slice(start, end + 4);
}

const v1Original = extractFunction(v1MainMigration, "wholesale_publish_legal_document");
const v2Original = extractFunction(v2MainMigration, "wholesale_publish_legal_document_v2");
const v1Patched = extractFunction(migration, "wholesale_publish_legal_document");
const v2Patched = extractFunction(migration, "wholesale_publish_legal_document_v2");
const v1RolledBack = extractFunction(rollback, "wholesale_publish_legal_document");
const v2RolledBack = extractFunction(rollback, "wholesale_publish_legal_document_v2");

describe("Part 1 — real pglite reproduction: fails before the patch, works after, fails again after rollback", () => {
  let db;
  let adminId;
  const MASTER_CONTENT = {
    access_agreement: "x", pricing_policy: "x", pricing_disclaimer: "x",
    privacy_security: "x", repair_warranty_terms: "x", econsent_disclosure: "x",
  };
  const ESTIMATE_CONTENT = { body: "Prices shown are wholesale estimates only." };

  beforeAll(async () => {
    db = await PGlite.create({ extensions: { pgcrypto } });

    // Simulates a real Supabase project's default layout: pgcrypto lives in
    // `extensions`, never `public` — the exact fact the bug report's
    // preflight (check 4) confirms against the real database.
    await db.exec(`create schema if not exists extensions;`);
    await db.exec(`create extension if not exists pgcrypto with schema extensions;`);

    // Minimal standalone schema — only the columns the two RPCs under test
    // actually read/write. See the file header for why this is a legitimate
    // isolation of the digest() bug from the rest of the real schema.
    await db.exec(`
      create table public.profiles (
        id uuid primary key,
        role text,
        status text
      );
      create table public.wholesale_legal_documents (
        id uuid primary key default gen_random_uuid(),
        document_type text not null default 'master_agreement',
        version text,
        status text not null default 'draft',
        content_en jsonb,
        content_es jsonb,
        content_hash text,
        published_at timestamptz,
        published_by uuid
      );
    `);

    const admin = await db.query(`insert into public.profiles (id, role, status) values (gen_random_uuid(), 'admin', 'approved') returning id;`);
    adminId = admin.rows[0].id;
  });

  afterAll(async () => {
    await db.close();
  });

  it("sanity: pgcrypto's digest() is installed in extensions, not public — confirms the test harness actually matches the real project's layout", async () => {
    const result = await db.query(`
      select distinct n.nspname as schema
      from pg_depend d
      join pg_extension e on e.oid = d.refobjid
      join pg_proc p on p.oid = d.objid
      join pg_namespace n on n.oid = p.pronamespace
      where e.extname = 'pgcrypto' and p.proname = 'digest';
    `);
    const schemas = result.rows.map((r) => r.schema);
    expect(schemas).toContain("extensions");
    expect(schemas).not.toContain("public");
  });

  it("BEFORE the patch: v1 (wholesale_publish_legal_document), installed verbatim from wholesale-legal-migration.sql, reproduces the exact reported error", async () => {
    await db.exec(v1Original);
    await expect(
      db.query(
        `select wholesale_publish_legal_document($1, $2, $3, $4) as id;`,
        [adminId, "__wslpcs_test__ v1-before", JSON.stringify(MASTER_CONTENT), JSON.stringify(MASTER_CONTENT)]
      )
    ).rejects.toThrow(/function digest\(text, unknown\) does not exist/);
  });

  it("BEFORE the patch: v2 (wholesale_publish_legal_document_v2), installed verbatim from wholesale-legal-document-types-migration.sql, reproduces the EXACT reported flow (estimate_disclaimer, single body key)", async () => {
    await db.exec(v2Original);
    await expect(
      db.query(
        `select wholesale_publish_legal_document_v2($1, $2, $3, $4, $5) as id;`,
        [adminId, "estimate_disclaimer", "1", JSON.stringify(ESTIMATE_CONTENT), JSON.stringify(ESTIMATE_CONTENT)]
      )
    ).rejects.toThrow(/function digest\(text, unknown\) does not exist/);
  });

  it("nothing was written by either failed attempt above", async () => {
    const count = await db.query(`select count(*)::int as n from public.wholesale_legal_documents;`);
    expect(count.rows[0].n).toBe(0);
  });

  it("AFTER wholesale-legal-pgcrypto-schema-fix-migration.sql (installed verbatim): v1 now publishes successfully with a verifiably-correct SHA-256 hash", async () => {
    await db.exec(v1Patched);
    const result = await db.query(
      `select wholesale_publish_legal_document($1, $2, $3, $4) as id;`,
      [adminId, "__wslpcs_test__ v1-after", JSON.stringify(MASTER_CONTENT), JSON.stringify(MASTER_CONTENT)]
    );
    const id = result.rows[0].id;
    expect(id).toBeTruthy();
    const row = await db.query(`select content_hash, status, content_en::text as content_en_text, content_es::text as content_es_text from public.wholesale_legal_documents where id = $1;`, [id]);
    // Independently recomputed INSIDE Postgres, from the row's own stored
    // content_en/content_es (jsonb's own canonical ::text form, the same
    // input the RPC itself hashed) — never a JS-side JSON.stringify, whose
    // key-order/whitespace canonicalization does not match jsonb's and
    // would produce a false mismatch unrelated to the digest() bug/fix.
    const independent = await db.query(
      `select encode(extensions.digest($1::text || $2::text, 'sha256'), 'hex') as h;`,
      [row.rows[0].content_en_text, row.rows[0].content_es_text]
    );
    expect(row.rows[0].content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.rows[0].content_hash).toBe(independent.rows[0].h);
    expect(row.rows[0].status).toBe("published");
  });

  it("AFTER the patch: v2 now publishes the exact reported flow successfully (estimate_disclaimer, version '1', single body key per language)", async () => {
    await db.exec(v2Patched);
    const result = await db.query(
      `select wholesale_publish_legal_document_v2($1, $2, $3, $4, $5) as id;`,
      [adminId, "estimate_disclaimer", "1", JSON.stringify(ESTIMATE_CONTENT), JSON.stringify(ESTIMATE_CONTENT)]
    );
    const id = result.rows[0].id;
    expect(id).toBeTruthy();
    const row = await db.query(`select content_hash, document_type, status, content_en::text as content_en_text, content_es::text as content_es_text from public.wholesale_legal_documents where id = $1;`, [id]);
    const independent = await db.query(
      `select encode(extensions.digest($1::text || $2::text, 'sha256'), 'hex') as h;`,
      [row.rows[0].content_en_text, row.rows[0].content_es_text]
    );
    expect(row.rows[0].content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.rows[0].content_hash).toBe(independent.rows[0].h);
    expect(row.rows[0].document_type).toBe("estimate_disclaimer");
    expect(row.rows[0].status).toBe("published");
  });

  it("AFTER the patch: v2 also publishes a master_agreement version successfully — the fix is not scoped to only one document_type", async () => {
    await db.exec(v2Patched);
    const result = await db.query(
      `select wholesale_publish_legal_document_v2($1, $2, $3, $4, $5) as id;`,
      [adminId, "master_agreement", "__wslpcs_test__ v2-master-after", JSON.stringify(MASTER_CONTENT), JSON.stringify(MASTER_CONTENT)]
    );
    expect(result.rows[0].id).toBeTruthy();
  });

  it("AFTER wholesale-legal-pgcrypto-schema-fix-rollback.sql (installed verbatim): the exact original bug reopens for both v1 and v2", async () => {
    await db.exec(v1RolledBack);
    await db.exec(v2RolledBack);

    await expect(
      db.query(
        `select wholesale_publish_legal_document($1, $2, $3, $4) as id;`,
        [adminId, "__wslpcs_test__ v1-after-rollback", JSON.stringify(MASTER_CONTENT), JSON.stringify(MASTER_CONTENT)]
      )
    ).rejects.toThrow(/function digest\(text, unknown\) does not exist/);

    await expect(
      db.query(
        `select wholesale_publish_legal_document_v2($1, $2, $3, $4, $5) as id;`,
        [adminId, "estimate_disclaimer", "__wslpcs_test__ v2-after-rollback", JSON.stringify(ESTIMATE_CONTENT), JSON.stringify(ESTIMATE_CONTENT)]
      )
    ).rejects.toThrow(/function digest\(text, unknown\) does not exist/);
  });

  it("validation branches that never reach digest() are unaffected by the patch, before or after — invalid_admin still raises immediately", async () => {
    // Re-apply the patched versions so this check reflects the shipped state.
    await db.exec(v1Patched);
    await db.exec(v2Patched);
    await expect(
      db.query(
        `select wholesale_publish_legal_document_v2($1, $2, $3, $4, $5) as id;`,
        ["00000000-0000-0000-0000-000000000000", "estimate_disclaimer", "x", JSON.stringify(ESTIMATE_CONTENT), JSON.stringify(ESTIMATE_CONTENT)]
      )
    ).rejects.toThrow(/invalid_admin/);
  });
});

describe("Part 2 — wholesale-legal-pgcrypto-schema-fix-preflight.sql: read-only diagnostic gate", () => {
  it("is read-only — no insert/update/delete/create/drop statement (ALTER TABLE excluded from this repo-wide guard only because it doesn't apply here at all — this file has none)", () => {
    expect(preflight).not.toMatch(/\binsert into\b|\bupdate\s+\w+\s+set\b|\bdelete from\b|\bcreate table\b|\bdrop table\b|\bcreate or replace function\b/i);
  });

  it("confirms both affected functions exist with their exact current signatures before proceeding", () => {
    expect(preflight).toContain("wholesale_publish_legal_document");
    expect(preflight).toContain("p_admin_id uuid, p_version text, p_content_en jsonb, p_content_es jsonb");
    expect(preflight).toContain("wholesale_publish_legal_document_v2");
    expect(preflight).toContain("p_admin_id uuid, p_document_type text, p_version text, p_content_en jsonb, p_content_es jsonb");
  });

  it("locates pgcrypto's digest() via pg_depend -> pg_extension (never a bare name match that a same-named unrelated function could satisfy)", () => {
    expect(preflight).toContain("pg_depend d");
    expect(preflight).toContain("pg_extension e on e.oid = d.refobjid");
  });

  it("explicitly confirms extensions.digest specifically — the one fact this whole patch depends on", () => {
    expect(preflight).toContain("extensions_digest_exists");
    expect(preflight).toMatch(/n\.nspname = 'extensions'/);
  });

  it("confirms v1 and v2 currently call the bare, unqualified digest() — the expected pre-patch state", () => {
    expect(preflight).toContain("v1_currently_unqualified_digest_call_as_expected");
    expect(preflight).toContain("v2_currently_unqualified_digest_call_as_expected");
    expect(preflight).toContain("v1_def like '%encode(digest(%'");
    expect(preflight).toContain("v2_def like '%encode(digest(%'");
  });

  it("confirms search_path is currently pinned to exactly 'public, pg_temp' on both functions", () => {
    expect(preflight).toContain("v1_and_v2_search_path_pinned_as_expected");
    expect(preflight).toContain("search_path=public, pg_temp");
  });

  it("a FAIL on extensions_digest_exists is called out explicitly as meaning this specific fix is wrong for the database — not silently proceeding", () => {
    expect(preflight).toContain("FAIL on check 4 (extensions_schema_digest_confirmed)");
    expect(preflight).toContain("the right one for this database and needs re-diagnosis.");
  });

  it("produces a single OVERALL STATUS row", () => {
    expect(preflight).toContain("'OVERALL STATUS'");
  });
});

describe("Part 3 — wholesale-legal-pgcrypto-schema-fix-migration.sql: the narrowest possible fix", () => {
  it("is wrapped in an explicit begin;/commit; transaction", () => {
    const lines = migration.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines.indexOf("commit;")).toBeGreaterThan(lines.indexOf("begin;"));
  });

  it("touches exactly two functions, both via CREATE OR REPLACE with their existing exact signatures", () => {
    const matches = migration.match(/create or replace function public\.\w+\(/g) || [];
    expect(matches.length).toBe(2);
    expect(migration).toContain("create or replace function public.wholesale_publish_legal_document(\n  p_admin_id uuid, p_version text, p_content_en jsonb, p_content_es jsonb\n)");
    expect(migration).toContain("create or replace function public.wholesale_publish_legal_document_v2(\n  p_admin_id uuid, p_document_type text, p_version text, p_content_en jsonb, p_content_es jsonb\n)");
  });

  it("preserves security invoker and search_path = public, pg_temp on both function declarations — never widened to include extensions", () => {
    const stripped = stripComments(migration);
    const occurrences = stripped.match(/language plpgsql security invoker set search_path = public, pg_temp/g) || [];
    expect(occurrences.length).toBe(2);
    expect(migration).not.toContain("search_path = public, extensions");
    expect(migration).not.toContain("search_path = extensions, public");
  });

  it("schema-qualifies exactly the digest() call site — extensions.digest(...) appears exactly twice in actual SQL, bare unqualified digest( never appears in actual SQL (header prose narrating the fix is stripped first)", () => {
    const body = stripComments(migration);
    const qualified = body.match(/encode\(extensions\.digest\(/g) || [];
    expect(qualified.length).toBe(2);
    const withoutQualified = body.split("extensions.digest(").join("");
    expect(withoutQualified).not.toMatch(/\bdigest\(/);
  });

  it("never re-issues REVOKE/GRANT — CREATE OR REPLACE with an unchanged signature preserves existing privileges automatically", () => {
    expect(migration).not.toMatch(/revoke execute|grant execute/i);
  });

  it("touches no table schema, trigger, or index — no ALTER TABLE/CREATE TRIGGER/CREATE INDEX anywhere; the INSERT/UPDATE that do appear are the two functions' own pre-existing, unchanged supersede-then-insert logic, not new top-level DML", () => {
    const stripped = stripComments(migration);
    expect(stripped).not.toMatch(/\balter table\b/i);
    expect(stripped).not.toMatch(/\bcreate trigger\b|\bcreate index\b/i);
    expect(stripped).not.toMatch(/\bdelete from\b|\bdrop table\b|\bdrop column\b/i);
    // Every INSERT/UPDATE present is inside one of the two function bodies
    // (byte-identical to the pre-existing logic, proven separately below) —
    // never a bare top-level statement outside `create or replace function`.
    const outsideFunctions = stripped.replace(/create or replace function[\s\S]*?\$\$;/g, "");
    expect(outsideFunctions).not.toMatch(/\binsert into\b|\bupdate\s+\w+\s+set\b/i);
  });

  it("v1's function body, with extensions.digest normalized back to digest, is byte-identical to the currently-installed body in wholesale-legal-migration.sql (every validation, the global supersede UPDATE, the INSERT column list — nothing else changed)", () => {
    const normalized = v1Patched.split("extensions.digest(").join("digest(");
    expect(normalized).toBe(v1Original);
  });

  it("v2's function body, with extensions.digest normalized back to digest, is byte-identical to the currently-installed body in wholesale-legal-document-types-migration.sql (including the document_type-scoped supersede comment/UPDATE — nothing else changed)", () => {
    const normalized = v2Patched.split("extensions.digest(").join("digest(");
    expect(normalized).toBe(v2Original);
  });

  it("never touches wholesale_accept_legal_terms or wholesale_accept_estimate_disclaimer — neither calls digest(), neither is affected", () => {
    const body = stripComments(migration);
    expect(body).not.toContain("wholesale_accept_legal_terms");
    expect(body).not.toContain("wholesale_accept_estimate_disclaimer");
  });
});

describe("Part 4 — wholesale-legal-pgcrypto-schema-fix-verify.sql: wrapped in begin;/rollback;, calls both RPCs for real", () => {
  it("starts with begin; and ends with rollback; (never commit;)", () => {
    const lines = verify.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines[lines.length - 1]).toBe("rollback;");
    expect(verify).not.toMatch(/\ncommit;/);
  });

  it("reuses an existing approved admin profile if one exists, only synthesizing one (id, role, status) otherwise — same discipline as wholesale-retention-verify.sql", () => {
    expect(verify).toContain("select id into v_admin_id from profiles where role = 'admin' and status = 'approved' limit 1;");
    expect(verify).toContain("insert into profiles (id, role, status) values (gen_random_uuid(), 'admin', 'approved')");
  });

  it("actually calls wholesale_publish_legal_document (v1) for real, not just a structural/signature check", () => {
    expect(verify).toMatch(/v_id := wholesale_publish_legal_document\(v_admin_id, '__wspcs_verify__ v1-probe', v_content, v_content\);/);
  });

  it("actually calls wholesale_publish_legal_document_v2 for real, reproducing the exact reported flow (estimate_disclaimer, single body key)", () => {
    expect(verify).toMatch(/v_id := wholesale_publish_legal_document_v2\(v_admin_id, 'estimate_disclaimer', '__wspcs_verify__ v2-probe', v_content, v_content\);/);
    expect(verify).toContain(`v_content jsonb := '{"body":"__wspcs_verify__ estimate disclaimer text"}'::jsonb;`);
  });

  it("also exercises v2 with document_type='master_agreement' — the fix is proven for both types v2 can publish", () => {
    expect(verify).toContain("v2_master_agreement_publish_also_succeeds");
  });

  it("checks the returned content_hash actually looks like a real sha256 hex digest, not just non-null", () => {
    const occurrences = verify.match(/~ '\^\[0-9a-f\]\{64\}\$'/g) || [];
    expect(occurrences.length).toBeGreaterThanOrEqual(3);
  });

  it("confirms grants are unchanged (service_role only) via has_function_privilege — never re-checks by re-issuing GRANT", () => {
    expect(verify).toContain("grants_unchanged_service_role_only");
    expect(verify).toContain("has_function_privilege('service_role', v1_oid, 'EXECUTE')");
  });

  it("regression: invalid_admin still rejects before ever reaching the digest() line, and writes nothing", () => {
    expect(verify).toContain("invalid_admin_still_rejected_before_reaching_digest");
  });

  it("every synthetic row is tagged with the __wspcs_verify__ marker", () => {
    expect(verify).toContain("__wspcs_verify__");
  });

  it("produces a single OVERALL STATUS row", () => {
    expect(verify).toContain("'OVERALL STATUS'");
  });
});

describe("Part 5 — wholesale-legal-pgcrypto-schema-fix-rollback.sql: non-destructive, restores the exact pre-patch bodies", () => {
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

  it("v1's restored body is byte-identical to the ORIGINAL function defined in wholesale-legal-migration.sql", () => {
    expect(v1RolledBack).toBe(v1Original);
  });

  it("v2's restored body is byte-identical to the ORIGINAL function defined in wholesale-legal-document-types-migration.sql", () => {
    expect(v2RolledBack).toBe(v2Original);
  });

  it("never re-issues REVOKE/GRANT here either", () => {
    expect(rollback).not.toMatch(/revoke execute|grant execute/i);
  });
});

describe("Part 6 — v1 and v2 are patched consistently with each other", () => {
  it("both patched functions schema-qualify with the exact same 'extensions.digest(' spelling", () => {
    expect(v1Patched).toContain("extensions.digest(p_content_en::text || p_content_es::text, 'sha256')");
    expect(v2Patched).toContain("extensions.digest(p_content_en::text || p_content_es::text, 'sha256')");
  });
});
