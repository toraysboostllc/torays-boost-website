import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const supabaseDir = join(__dirname, "..", "supabase");
const migration = readFileSync(join(supabaseDir, "wholesale-images-migration.sql"), "utf8");
const preflight = readFileSync(join(supabaseDir, "wholesale-images-preflight.sql"), "utf8");
const verify = readFileSync(join(supabaseDir, "wholesale-images-verify.sql"), "utf8");
const rollback = readFileSync(join(supabaseDir, "wholesale-images-rollback.sql"), "utf8");

/** Same comment-stripping helper as wholesaleNavigationMigration.test.js —
 *  duplicated on purpose (that file's own header explains why: no shared
 *  test-utility module exists in this repo yet, and these files are small
 *  enough that adding one isn't worth it). */
function stripComments(sql) {
  return sql
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("--");
      return idx === -1 ? line : line.slice(0, idx);
    })
    .filter((line) => line.trim().length > 0)
    .join("\n");
}
const migrationCode = stripComments(migration);
const preflightCode = stripComments(preflight);
const verifyCode = stripComments(verify);
const rollbackCode = stripComments(rollback);

/**
 * These tests read the migration SQL as text — there's no live Postgres or
 * Storage here, so they can't prove the SQL actually runs (that only
 * happens once it's really executed against Supabase, still not done).
 * What they DO prove: the file structurally contains every idempotency
 * guard and constraint Fase 3A's approved plan requires — most importantly,
 * that the "one cover photo per Equipment Type, one photo per category"
 * scope decision is enforced by real unique indexes, not just documented as
 * an intention.
 */

describe("migration file: wrapping and idempotency", () => {
  it("is wrapped in an explicit transaction", () => {
    const lines = migration.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines.indexOf("commit;")).toBeGreaterThan(0);
  });

  it("uses ADD COLUMN IF NOT EXISTS for all 4 new columns", () => {
    for (const col of ["mime_type", "size_bytes", "uploaded_by", "uploaded_at"]) {
      expect(migration).toMatch(new RegExp(`add column if not exists ${col}\\b`));
    }
  });

  it("every 'add constraint <name>' is preceded by a matching 'drop constraint if exists <name>'", () => {
    const addMatches = [...migration.matchAll(/add constraint (\w+)/g)].map((m) => m[1]);
    expect(addMatches.length).toBeGreaterThanOrEqual(2);
    for (const name of addMatches) {
      expect(migration, `constraint "${name}" has no matching DROP ... IF EXISTS before it`).toMatch(
        new RegExp(`drop constraint if exists ${name}\\b`)
      );
    }
  });

  it("uses CREATE UNIQUE INDEX IF NOT EXISTS / CREATE INDEX IF NOT EXISTS for every new index", () => {
    const badUnique = migration.match(/create unique index (?!if not exists)\S+/gi) || [];
    expect(badUnique).toEqual([]);
    const badIndex = migration.match(/create index (?!if not exists)\S+/gi) || [];
    expect(badIndex).toEqual([]);
  });

  it("upserts the Storage bucket with ON CONFLICT (id) DO UPDATE, not a bare INSERT", () => {
    expect(migration).toMatch(/insert into storage\.buckets[\s\S]*?on conflict \(id\) do update set/);
  });

  it("never drops or renames a column or table — only adds", () => {
    expect(migrationCode).not.toMatch(/drop column/i);
    expect(migrationCode).not.toMatch(/drop table/i);
    expect(migrationCode).not.toMatch(/rename column/i);
    expect(migrationCode).not.toMatch(/rename to/i);
  });
});

describe("migration file: Fase 3A scope — exactly one photo per Equipment Type, one per category, no gallery", () => {
  it("creates a unique partial index on equipment_type_id", () => {
    const stmt = migration.match(/create unique index if not exists uq_wholesale_images_equipment_type\s*\n\s*on wholesale_images\(equipment_type_id\) where equipment_type_id is not null;/);
    expect(stmt).toBeTruthy();
  });

  it("creates a unique partial index on category_id", () => {
    const stmt = migration.match(/create unique index if not exists uq_wholesale_images_category\s*\n\s*on wholesale_images\(category_id\) where category_id is not null;/);
    expect(stmt).toBeTruthy();
  });

  it("does NOT create a unique index on service_id — per-service photos are explicitly out of scope for Fase 3A", () => {
    expect(migration).not.toMatch(/unique index[\s\S]{0,60}service_id/);
  });

  it("documents that per-service photos and multi-photo galleries are out of scope", () => {
    expect(migration).toMatch(/out of scope/i);
    expect(migration).toMatch(/gallery/i);
  });
});

describe("migration file: metadata columns are independently validated, not just what the client claims", () => {
  it("mime_type is constrained to exactly 'image/webp'", () => {
    expect(migration).toMatch(/check \(mime_type = 'image\/webp'\)/);
  });

  it("size_bytes is constrained to (0, 5242880] — never zero, never over 5 MB", () => {
    expect(migration).toMatch(/check \(size_bytes > 0 and size_bytes <= 5242880\)/);
  });

  it("uploaded_by references profiles with ON DELETE SET NULL, same audit-preserving pattern as wholesale_price_history.changed_by", () => {
    expect(migration).toMatch(/uploaded_by uuid references profiles\(id\) on delete set null/);
  });
});

describe("migration file: private Storage bucket, WebP-only, 5 MB cap, no public access", () => {
  it("creates the bucket with public = false", () => {
    const stmt = migration.match(/insert into storage\.buckets[\s\S]*?values \('wholesale-images', 'wholesale-images', false, 5242880, array\['image\/webp'\]\)/);
    expect(stmt).toBeTruthy();
  });

  it("the bucket id matches what api/wholesale-admin.js's images resource will reference", () => {
    expect(migration).toContain("'wholesale-images'");
  });

  it("adds zero storage.objects RLS policies — deny-all by omission, same posture as every wholesale_* table", () => {
    expect(migrationCode).not.toMatch(/create policy/i);
    expect(migrationCode).not.toMatch(/storage\.objects/i);
  });

  it("documents why no anon/authenticated policy is added", () => {
    expect(migration).toMatch(/deny-all/i);
  });
});

describe("preflight.sql: a single consolidated statement, compatible with Supabase SQL Editor showing only one result table", () => {
  it("is exactly ONE statement (a single trailing semicolon in the comment-stripped file)", () => {
    const statements = preflightCode.split(";").map((s) => s.trim()).filter(Boolean);
    expect(statements).toHaveLength(1);
    const stmt = statements[0].toLowerCase();
    expect(stmt.startsWith("with") || stmt.startsWith("select")).toBe(true);
  });

  it("contains no data-modifying or schema-modifying statement", () => {
    // Scoped to actual statement shapes, not bare words: this file's own
    // details/status text legitimately uses "create"/"update" as ordinary
    // English verbs describing what wholesale-images-migration.sql does
    // (e.g. "the migration will create it", "via its own idempotent
    // upsert") — a bare \bcreate\b/\bupdate\b would false-positive on that
    // prose. What actually matters is that no real DDL/DML statement shape
    // appears anywhere in this file.
    for (const forbidden of [
      /\binsert into\b/i,
      /\bupdate\s+\w+\s+set\b/i,
      /\bdelete from\b/i,
      /\balter\s+(table|column|index)\b/i,
      /\bcreate\s+(or replace\s+)?(table|index|unique index|policy|function|extension)\b/i,
      /\bdrop\s+(table|index|column|constraint|policy|function)\b/i,
    ]) {
      expect(preflightCode).not.toMatch(forbidden);
    }
  });

  it("checks for pre-existing duplicate owners on both equipment_type_id and category_id — the exact condition that would break the migration's unique indexes", () => {
    expect(preflightCode).toMatch(/where equipment_type_id is not null\s*\n\s*group by equipment_type_id having count\(\*\) > 1/);
    expect(preflightCode).toMatch(/where category_id is not null\s*\n\s*group by category_id having count\(\*\) > 1/);
  });

  it("references the migration file it gates, by name", () => {
    expect(preflight).toMatch(/wholesale-images-migration\.sql/);
  });

  it("never reads a shop name, code hash, token hash, or cookie", () => {
    for (const forbidden of [/code_hash/i, /device_token_hash/i, /session_token_hash/i, /\bcookie/i]) {
      expect(preflightCode).not.toMatch(forbidden);
    }
  });

  it("final output has exactly the 3 recommended columns: check_name, status, details", () => {
    const finalSelect = preflightCode.slice(preflightCode.lastIndexOf("select check_name, status, details"));
    expect(finalSelect).toMatch(/^select check_name, status, details/);
  });

  it("produces a row for every required check: columns, duplicate owners, existing images, bucket state, bucket config, storage policies total, public/anon policies, and a final OVERALL STATUS row", () => {
    for (const checkName of [
      "columns_present",
      "duplicate_owners",
      "existing_images",
      "bucket_exists",
      "bucket_config_private_webp_5mb",
      "storage_objects_policies_total",
      "storage_public_anon_policies",
    ]) {
      expect(preflight, `missing check row: ${checkName}`).toContain(`'${checkName}'`);
    }
    expect(preflight).toContain("'OVERALL STATUS'");
  });

  it("every check row's status is computed as PASS, REVIEW REQUIRED, or FAIL — no other literal status value appears", () => {
    const checksBlock = preflightCode.slice(preflightCode.indexOf("checks as ("), preflightCode.indexOf("overall as ("));
    // Status literals ('PASS', 'FAIL', 'REVIEW REQUIRED') and details
    // literals (full sentences, plus the singular/plural "y"/"ies" suffix
    // literal used for "polic(y/ies)") both appear as "then '...'"/
    // "else '...'" inside this block. Status literals are the only ones
    // that are both short AND entirely uppercase letters/spaces — every
    // details literal and grammar-suffix literal is either long or
    // lowercase, so this filter cannot mistake one for a status value.
    const candidates = [...checksBlock.matchAll(/(?:then|else) '([^']*)'/g)]
      .map((m) => m[1])
      .filter((s) => s.length <= 20 && /^[A-Z ]+$/.test(s));
    expect(candidates.length).toBeGreaterThan(0);
    const allowed = new Set(["PASS", "REVIEW REQUIRED", "FAIL"]);
    for (const lit of candidates) {
      expect(allowed.has(lit), `unexpected short literal that looks like a status value: "${lit}"`).toBe(true);
    }
  });

  it("the duplicate_owners row is the one FAIL-capable check tied directly to the migration's unique-index gate", () => {
    const row = preflightCode.slice(preflightCode.indexOf("'duplicate_owners'"), preflightCode.indexOf("'existing_images'"));
    expect(row).toMatch(/dup_equipment_type_owners = 0 and dup_category_owners = 0.*?then 'PASS'/s);
    expect(row).toMatch(/else 'FAIL'/);
  });

  it("OVERALL STATUS aggregates every check row's status: any FAIL wins, else any REVIEW REQUIRED wins, else PASS", () => {
    const overallCte = preflightCode.slice(preflightCode.indexOf("overall as ("), preflightCode.indexOf(")\nselect check_name"));
    expect(overallCte).toMatch(/bool_or\(status = 'FAIL'\)\s*then 'FAIL'/);
    expect(overallCte).toMatch(/bool_or\(status = 'REVIEW REQUIRED'\)\s*then 'REVIEW REQUIRED'/);
    expect(overallCte).toMatch(/else 'PASS'/);
    expect(overallCte).toMatch(/from checks/);
  });

  it("the final OVERALL STATUS row is unioned from the overall CTE, not hardcoded", () => {
    expect(preflightCode).toMatch(/99,\s*\n\s*'OVERALL STATUS',\s*\n\s*overall\.status/);
  });

  it("orders the output by an internal ord column that never leaks into the final 3-column result", () => {
    const finalSelect = preflightCode.slice(preflightCode.lastIndexOf("select check_name, status, details"));
    expect(finalSelect).toMatch(/order by ord;$/);
    expect(finalSelect.split("\n")[0]).not.toMatch(/\bord\b/);
  });
});

describe("verify.sql: read-only, confirms every object the migration promises", () => {
  it("contains no data-modifying or schema-modifying statement", () => {
    for (const forbidden of [/\binsert into\b/i, /\bupdate\b/i, /\bdelete from\b/i, /\balter\b/i, /\bcreate\b/i, /\bdrop\b/i]) {
      expect(verifyCode).not.toMatch(forbidden);
    }
  });

  it("confirms all 4 columns via information_schema", () => {
    expect(verify).toMatch(/mime_type', 'size_bytes', 'uploaded_by', 'uploaded_at'/);
  });

  it("confirms both CHECK constraints via pg_constraint", () => {
    expect(verify).toMatch(/wholesale_images_mime_type_check/);
    expect(verify).toMatch(/wholesale_images_size_bytes_check/);
  });

  it("confirms both unique indexes via pg_indexes", () => {
    expect(verify).toMatch(/uq_wholesale_images_equipment_type/);
    expect(verify).toMatch(/uq_wholesale_images_category/);
  });

  it("confirms the bucket's exact declared config (private, 5 MB, webp-only)", () => {
    expect(verify).toMatch(/from storage\.buckets\s*\nwhere id = 'wholesale-images'/);
  });

  it("confirms RLS is still enabled with zero policies on wholesale_images", () => {
    expect(verify).toMatch(/relrowsecurity/);
    expect(verify).toMatch(/pg_policies/);
  });

  it("includes a POST-MIGRATION SUMMARY whose FAIL branch covers every structural check above", () => {
    expect(verify).toMatch(/POST-MIGRATION SUMMARY/);
    const summary = verifyCode.slice(verifyCode.indexOf("with columns_present"));
    for (const cond of [
      "columns_present.n = 4",
      "constraints_present.n = 2",
      "indexes_present.n = 2",
      "duplicate_equipment_type_owners.n = 0",
      "duplicate_category_owners.n = 0",
      "invalid_metadata.n = 0",
      "bucket.exists",
      "bucket.size_limit = 5242880",
      "rls.rls_enabled",
      "rls.policy_count = 0",
    ]) {
      expect(summary, `missing structural condition: ${cond}`).toContain(cond);
    }
  });

  it("the summary's overall_status is a 3-state result (PASS/REVIEW REQUIRED/FAIL), never collapsed to a binary PASS/FAIL", () => {
    const summary = verifyCode.slice(verifyCode.indexOf("with columns_present"));
    expect(summary).toMatch(/then 'FAIL'/);
    expect(summary).toMatch(/then 'REVIEW REQUIRED'/);
    expect(summary).toMatch(/else 'PASS'/);
  });

  it("overall_status can only be PASS if has_public_or_anon_storage_policy is false — a public/anon Storage policy always downgrades it to REVIEW REQUIRED, never silently ignored", () => {
    const summary = verifyCode.slice(verifyCode.indexOf("with columns_present"));
    const statusCase = summary.slice(summary.lastIndexOf("case", summary.indexOf("when not (")), summary.indexOf("end as overall_status"));
    expect(statusCase.length).toBeGreaterThan(0);
    expect(statusCase).toMatch(/storage_policy_check\.has_public_or_anon_storage_policy[\s\S]{0,20}then 'REVIEW REQUIRED'/);
  });
});

describe("verify.sql: storage.objects policy audit — never a false PASS (verify.sql's own standalone listing query, untouched by this round)", () => {
  it("lists policyname/roles/cmd/qual/with_check for every storage.objects policy as a real, standalone query", () => {
    expect(verify).toMatch(/select\s*\n\s*policyname,\s*\n\s*roles,\s*\n\s*cmd,\s*\n\s*qual,\s*\n\s*with_check/);
    expect(verify).toMatch(/from pg_policies\s*\nwhere schemaname = 'storage' and tablename = 'objects'/);
  });

  it("flags any public/anon policy via the roles && array['public','anon'] overlap check — never trying to parse qual/with_check to prove safety", () => {
    expect(verify).toMatch(/roles && array\['public', 'anon'\]::name\[\]/);
  });

  it("the migration itself creates zero storage.objects policies — the audit exists to catch a PRE-EXISTING one, not something this file adds", () => {
    expect(migrationCode).not.toMatch(/create policy/i);
    expect(migrationCode).not.toMatch(/storage\.objects/i);
  });
});

describe("preflight.sql: storage.objects policy audit — folded into the consolidated table, not a separate result set", () => {
  it("computes the public/anon policy count using the same roles && array['public','anon'] overlap check as verify.sql", () => {
    expect(preflightCode).toMatch(/roles && array\['public', 'anon'\]::name\[\]/);
  });

  it("documents why qual/with_check are never auto-parsed to certify safety", () => {
    expect(preflight).toMatch(/cannot soundly decide/);
    expect(preflight).toMatch(/[Nn]ever auto-cleared to PASS/i);
  });

  it("raw CTE aggregates the actual policyname/roles/cmd/qual/with_check of every public/anon policy as JSON — the real audit data, not a query to run separately", () => {
    const rawCte = preflightCode.slice(preflightCode.indexOf("with raw as ("), preflightCode.indexOf("checks as ("));
    expect(rawCte).toMatch(/jsonb_agg\(\s*\n\s*jsonb_build_object\(/);
    for (const field of ["'policyname', policyname", "'roles', to_jsonb\\(roles\\)", "'cmd', cmd", "'qual', qual", "'with_check', with_check"]) {
      expect(rawCte, `missing field in jsonb_build_object: ${field}`).toMatch(new RegExp(field));
    }
    expect(rawCte).toContain("as storage_public_anon_policies_json");
  });

  it("the jsonb_agg draws from the exact same public/anon overlap filter as the count, not a different or looser condition", () => {
    const jsonSubquery = preflightCode.slice(
      preflightCode.indexOf("jsonb_agg("),
      preflightCode.indexOf("as storage_public_anon_policies_json")
    );
    expect(jsonSubquery).toMatch(/from pg_policies\s*\n\s*where schemaname = 'storage' and tablename = 'objects'\s*\n\s*and roles && array\['public', 'anon'\]::name\[\]/);
  });

  it("the storage_public_anon_policies row's details cell is the JSON payload itself (or the literal 'none'), never a SELECT statement as text", () => {
    const row = preflightCode.slice(preflightCode.indexOf("'storage_public_anon_policies'"), preflightCode.indexOf("'storage_public_anon_policies'") + 400);
    expect(row).toContain("storage_public_anon_policies_json::text");
    expect(row).toMatch(/when storage_public_anon_policy_count = 0 then 'none'/);
    // the old design's embedded-query-as-text is gone from this row entirely
    expect(row).not.toMatch(/select policyname, roles, cmd, qual, with_check from pg_policies/);
  });

  it("jsonb_agg orders by policyname for deterministic output across runs", () => {
    const jsonSubquery = preflightCode.slice(preflightCode.indexOf("jsonb_agg("), preflightCode.indexOf("as storage_public_anon_policies_json"));
    expect(jsonSubquery).toMatch(/\)\s*order by policyname\s*\n\s*\)/);
  });

  it("uses only the 3 standardized status labels (PASS/REVIEW REQUIRED/FAIL) — never the old POLICY_REVIEW_REQUIRED label", () => {
    expect(preflight).not.toContain("POLICY_REVIEW_REQUIRED");
  });
});

describe("rollback.sql: documented, destructive, never auto-run", () => {
  it("is not referenced by any other file in the repo", () => {
    const pkg = readFileSync(join(__dirname, "..", "package.json"), "utf8");
    expect(pkg).not.toContain("wholesale-images-rollback");
  });

  it("is wrapped in begin/commit for the reversible part", () => {
    const lines = rollback.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines.find((l) => l === "commit;")).toBeTruthy();
  });

  it("drops both unique indexes and both CHECK constraints", () => {
    expect(rollback).toMatch(/drop index if exists uq_wholesale_images_equipment_type/);
    expect(rollback).toMatch(/drop index if exists uq_wholesale_images_category/);
    expect(rollback).toMatch(/drop constraint if exists wholesale_images_mime_type_check/);
    expect(rollback).toMatch(/drop constraint if exists wholesale_images_size_bytes_check/);
  });

  it("drops all 4 metadata columns", () => {
    for (const col of ["mime_type", "size_bytes", "uploaded_by", "uploaded_at"]) {
      expect(rollback).toMatch(new RegExp(`drop column if exists ${col}\\b`));
    }
  });

  it("never drops the wholesale_images table itself — that belongs to wholesale-navigation-migration.sql's own rollback", () => {
    expect(rollbackCode).not.toMatch(/drop table/i);
  });

  it("the bucket deletion is commented out, not an executable statement in the file", () => {
    // The only "delete from storage.buckets" text in the raw file must be
    // inside a comment block (i.e. absent once comments are stripped).
    expect(rollback).toContain("delete from storage.buckets where id = 'wholesale-images';");
    expect(rollbackCode).not.toMatch(/delete from storage\.buckets/i);
  });
});
