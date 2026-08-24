import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const supabaseDir = join(__dirname, "..", "supabase");
const migration = readFileSync(join(supabaseDir, "wholesale-remembered-sessions-migration.sql"), "utf8");
const preflight = readFileSync(join(supabaseDir, "wholesale-remembered-sessions-preflight.sql"), "utf8");
const verify = readFileSync(join(supabaseDir, "wholesale-remembered-sessions-verify.sql"), "utf8");
const rollback = readFileSync(join(supabaseDir, "wholesale-remembered-sessions-rollback.sql"), "utf8");

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
const rollbackCode = stripComments(rollback);
const preflightCode = stripComments(preflight);

/**
 * "Keep me signed in on this device" — SQL support for the checkbox.
 * Same text-based approach as every other migration test in this project
 * (no live Postgres here — these tests can't prove the SQL actually runs
 * against real Supabase, only that the file is structurally correct:
 * idempotent, additive-only, wrapped in a transaction, and touches nothing
 * beyond the one new column it documents).
 */

describe("migration.sql: additive, idempotent, single-column change", () => {
  it("is wrapped in an explicit transaction", () => {
    const lines = migration.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    const commitIdx = lines.indexOf("commit;");
    expect(commitIdx).toBeGreaterThan(0);
  });

  it("adds exactly one column, remembered, via ADD COLUMN IF NOT EXISTS", () => {
    expect(migration).toMatch(/alter table wholesale_sessions add column if not exists remembered boolean not null default true;/);
    const alters = migrationCode.match(/alter table\s+\S+/gi) || [];
    expect(alters).toHaveLength(1);
  });

  it("defaults to true — every session that existed before this migration behaves exactly as it always did", () => {
    expect(migration).toMatch(/remembered boolean not null default true/);
  });

  it("touches wholesale_sessions only — no other table is created, altered, or dropped", () => {
    expect(migrationCode).not.toMatch(/create table/i);
    for (const table of ["wholesale_shops", "wholesale_devices", "wholesale_access_log", "wholesale_categories", "wholesale_services", "wholesale_equipment_types"]) {
      expect(migrationCode).not.toMatch(new RegExp(`alter table ${table}\\b`));
    }
  });

  it("contains no DROP COLUMN, RENAME, or DROP TABLE anywhere in the forward migration", () => {
    expect(migrationCode).not.toMatch(/drop column/i);
    expect(migrationCode).not.toMatch(/rename column/i);
    expect(migrationCode).not.toMatch(/rename to/i);
    expect(migrationCode).not.toMatch(/drop table/i);
  });

  it("creates no new function/RPC and grants nothing — this is a pure schema change", () => {
    expect(migrationCode).not.toMatch(/create (or replace )?function/i);
    expect(migrationCode).not.toMatch(/\bgrant\b/i);
    expect(migrationCode).not.toMatch(/\brevoke\b/i);
  });

  it("re-running the file is safe (IF NOT EXISTS guards the only statement that creates anything)", () => {
    // The only schema-creating statement in the file is the ADD COLUMN IF
    // NOT EXISTS already asserted above — nothing else in this file creates
    // an object, so there is nothing else that could fail on a second run.
    const creating = migrationCode.match(/\balter table\b[\s\S]*?;/gi) || [];
    expect(creating).toHaveLength(1);
    expect(creating[0]).toMatch(/if not exists/i);
  });
});

describe("preflight.sql: read-only, references the right migration", () => {
  it("contains no data- or schema-modifying statement", () => {
    for (const forbidden of [/\binsert into\b/i, /\bupdate\b/i, /\bdelete from\b/i, /\balter\b/i, /\bcreate\b/i, /\bdrop\b/i, /\bgrant\b/i, /\brevoke\b/i]) {
      expect(preflightCode).not.toMatch(forbidden);
    }
  });

  it("names the migration file it precedes", () => {
    expect(preflight).toMatch(/wholesale-remembered-sessions-migration\.sql/);
  });

  it("never reads code_hash, token hashes, cookies, or user_agent/ip", () => {
    for (const forbidden of [/code_hash/i, /device_token_hash/i, /session_token_hash/i, /\bcookie/i, /\buser_agent\b/i]) {
      expect(preflightCode).not.toMatch(forbidden);
    }
  });
});

describe("verify.sql: read-only, checks the real column shape", () => {
  it("contains no data- or schema-modifying statement", () => {
    for (const forbidden of [/\binsert into\b/i, /\bupdate\b/i, /\bdelete from\b/i, /\balter\b/i, /\bcreate\b/i, /\bdrop\b/i]) {
      expect(verify).not.toMatch(forbidden);
    }
  });

  it("checks the column exists, is boolean, and is NOT NULL", () => {
    expect(verify).toMatch(/column_name = 'remembered'/);
    expect(verify).toMatch(/is_nullable = 'NO'/);
    expect(verify).toMatch(/data_type/);
  });

  it("checks that existing rows backfilled to true, not silently to false/null", () => {
    expect(verify).toMatch(/remembered is not true/);
  });
});

describe("rollback.sql: documented, non-destructive to every other column, never auto-run", () => {
  it("is not referenced by package.json or any script", () => {
    const pkg = readFileSync(join(__dirname, "..", "package.json"), "utf8");
    expect(pkg).not.toContain("wholesale-remembered-sessions-rollback");
  });

  it("is wrapped in begin/commit", () => {
    const lines = rollback.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines[lines.length - 1]).toBe("commit;");
  });

  it("drops exactly the one column this migration added, nothing else", () => {
    expect(rollback).toMatch(/alter table wholesale_sessions drop column if exists remembered;/);
    const alters = rollbackCode.match(/alter table\s+\S+/gi) || [];
    expect(alters).toHaveLength(1);
  });

  it("never touches wholesale_shops, wholesale_devices, or wholesale_access_log", () => {
    for (const table of ["wholesale_shops", "wholesale_devices", "wholesale_access_log"]) {
      expect(rollbackCode).not.toMatch(new RegExp(`\\b${table}\\b`));
    }
  });
});
