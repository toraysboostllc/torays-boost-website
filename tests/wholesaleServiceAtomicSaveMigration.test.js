import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const supabaseDir = join(__dirname, "..", "supabase");
const migration = readFileSync(join(supabaseDir, "wholesale-service-atomic-save-migration.sql"), "utf8");
const preflight = readFileSync(join(supabaseDir, "wholesale-service-atomic-save-preflight.sql"), "utf8");
const verify = readFileSync(join(supabaseDir, "wholesale-service-atomic-save-verify.sql"), "utf8");
const rollback = readFileSync(join(supabaseDir, "wholesale-service-atomic-save-rollback.sql"), "utf8");

/** Same comment-stripping helper as the other migration test files. */
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

const FULL_RPC_SIG =
  "wholesale_update_service_full(\n  uuid, uuid, text, text, boolean, text, numeric, numeric, numeric, text, numeric, numeric\n)";

describe("migration file: wrapping, idempotency, and additivity", () => {
  it("is wrapped in an explicit transaction", () => {
    const lines = migration.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines.indexOf("commit;")).toBeGreaterThan(0);
  });

  it("creates wholesale_update_service_full with the full 12-argument signature covering name/notes/tag/price/pricing-intelligence", () => {
    expect(migrationCode).toContain("create or replace function wholesale_update_service_full(");
    for (const arg of [
      "p_service_id uuid",
      "p_admin_id uuid",
      "p_name text",
      "p_notes text",
      "p_is_microsoldering boolean",
      "p_pricing_type text",
      "p_fixed_price numeric",
      "p_price_min numeric",
      "p_price_max numeric",
      "p_currency text",
      "p_recommended_price numeric",
      "p_target_margin_percent numeric",
    ]) {
      expect(migrationCode).toContain(arg);
    }
  });

  it("adds no column, no table, no constraint — a pure function addition", () => {
    expect(migrationCode.toLowerCase()).not.toMatch(/\balter table\b/);
    expect(migrationCode.toLowerCase()).not.toMatch(/\bcreate table\b/);
    expect(migrationCode.toLowerCase()).not.toMatch(/\badd constraint\b/);
  });

  it("contains no DROP TABLE or DROP COLUMN statement", () => {
    expect(migrationCode.toLowerCase()).not.toMatch(/\bdrop table\b/);
    expect(migrationCode.toLowerCase()).not.toMatch(/\bdrop column\b/);
  });

  it("the one DELETE this function has is the scoped microsoldering-tag removal — never a bare/unscoped delete", () => {
    const deletes = migrationCode.match(/delete from \w+[^;]*;/g) || [];
    expect(deletes).toHaveLength(1);
    expect(deletes[0]).toContain("delete from wholesale_service_tags");
    expect(deletes[0]).toContain("service_id = p_service_id");
    expect(deletes[0]).toContain("tag_id = v_tag_id");
  });
});

describe("migration file: never touches the two existing per-concern RPCs", () => {
  it("never redefines wholesale_update_service_price or wholesale_update_service_pricing_intelligence", () => {
    expect(migrationCode).not.toMatch(/create or replace function wholesale_update_service_price\(/);
    expect(migrationCode).not.toMatch(/create or replace function wholesale_update_service_pricing_intelligence\(/);
  });

  it("creates exactly one function in this file", () => {
    const defs = migrationCode.match(/create or replace function \w+\(/g) || [];
    expect(defs).toEqual(["create or replace function wholesale_update_service_full("]);
  });
});

describe("migration file: validates every field before writing anything", () => {
  it("validates admin, name, notes, pricing_type, recommended_price, and target_margin_percent, in that order, all before the row lock", () => {
    const adminIdx = migrationCode.indexOf("role = 'admin' and status = 'approved'");
    const nameIdx = migrationCode.indexOf("invalid_name");
    const notesIdx = migrationCode.indexOf("invalid_notes");
    const pricingTypeIdx = migrationCode.indexOf("invalid_pricing_type");
    const recommendedIdx = migrationCode.indexOf("invalid_recommended_price");
    const marginIdx = migrationCode.indexOf("invalid_target_margin_percent");
    const lockIdx = migrationCode.indexOf("for update");
    for (const idx of [adminIdx, nameIdx, notesIdx, pricingTypeIdx, recommendedIdx, marginIdx, lockIdx]) {
      expect(idx).toBeGreaterThan(-1);
    }
    expect(adminIdx).toBeLessThan(nameIdx);
    expect(nameIdx).toBeLessThan(notesIdx);
    expect(notesIdx).toBeLessThan(pricingTypeIdx);
    expect(pricingTypeIdx).toBeLessThan(recommendedIdx);
    expect(recommendedIdx).toBeLessThan(marginIdx);
    expect(marginIdx).toBeLessThan(lockIdx);
  });

  it("pricing_type is restricted to the 3 valid values", () => {
    expect(migrationCode).toMatch(/p_pricing_type not in \('fixed', 'range', 'quote'\)/);
  });

  it("recommended_price rejects negative values, allows null", () => {
    expect(migrationCode).toMatch(/p_recommended_price is not null and p_recommended_price < 0/);
  });

  it("target_margin_percent is bounded [0, 100), allows null", () => {
    expect(migrationCode).toMatch(
      /p_target_margin_percent is not null\s*\n\s*and \(p_target_margin_percent < 0 or p_target_margin_percent >= 100\)/
    );
  });

  it("name must be non-empty and at most 200 chars", () => {
    expect(migrationCode).toMatch(/length\(btrim\(p_name\)\) = 0 or length\(p_name\) > 200/);
  });
});

describe("migration file: one atomic write — service row, tag, and ONE history row together", () => {
  it("locks the service row with SELECT ... FOR UPDATE before any write", () => {
    expect(migrationCode).toMatch(/select \* into v_old\s*\n\s*from wholesale_services\s*\n\s*where id = p_service_id\s*\n\s*for update;/);
  });

  it("resolves the microsoldering tag the same read-then-write-only-if-different way as setMicrosolderingTag() in the API layer — never blind delete-then-reinsert", () => {
    expect(migrationCode).toContain("select id into v_tag_id from wholesale_tags where slug = 'microsoldering'");
    expect(migrationCode).toMatch(/if v_want_tag and not v_has_tag then\s*\n\s*insert into wholesale_service_tags/);
    expect(migrationCode).toMatch(/elsif not v_want_tag and v_has_tag then\s*\n\s*delete from wholesale_service_tags/);
  });

  it("has a no-op guard covering ALL fields (name/notes/pricing/recommended/margin/tag) that returns before any write", () => {
    const unchangedIdx = migrationCode.indexOf("v_unchanged :=");
    const returnUnchangedIdx = migrationCode.indexOf("return 'unchanged';");
    const updateIdx = migrationCode.indexOf("update wholesale_services");
    expect(unchangedIdx).toBeGreaterThan(-1);
    expect(returnUnchangedIdx).toBeGreaterThan(unchangedIdx);
    expect(updateIdx).toBeGreaterThan(returnUnchangedIdx);
    const guard = migrationCode.slice(unchangedIdx, returnUnchangedIdx);
    for (const field of [
      "v_old.name", "v_old.notes", "v_old.pricing_type", "v_old.fixed_price", "v_old.price_min",
      "v_old.price_max", "v_old.currency", "v_old.recommended_price", "v_old.target_margin_percent", "v_has_tag",
    ]) {
      expect(guard).toContain(field);
    }
  });

  it("updates name/notes/pricing/recommended/margin in one UPDATE statement", () => {
    const updateIdx = migrationCode.indexOf("update wholesale_services");
    const nextSemicolon = migrationCode.indexOf(";", updateIdx);
    const updateStmt = migrationCode.slice(updateIdx, nextSemicolon);
    for (const col of [
      "name = p_name", "notes = p_notes", "pricing_type = p_pricing_type", "fixed_price = p_fixed_price",
      "recommended_price = p_recommended_price", "target_margin_percent = p_target_margin_percent",
    ]) {
      expect(updateStmt).toContain(col);
    }
  });

  it("inserts exactly ONE wholesale_price_history row, populating both the price half and the pricing-intelligence half together", () => {
    const inserts = migrationCode.match(/insert into wholesale_price_history/g) || [];
    expect(inserts).toHaveLength(1);
    const insertIdx = migrationCode.indexOf("insert into wholesale_price_history");
    const nextSemicolon = migrationCode.indexOf(";", insertIdx);
    const insertStmt = migrationCode.slice(insertIdx, nextSemicolon);
    expect(insertStmt).toContain("old_pricing_type");
    expect(insertStmt).toContain("new_fixed_price");
    expect(insertStmt).toContain("old_recommended_price");
    expect(insertStmt).toContain("new_target_margin_percent");
  });

  it("returns 'updated' only after the history insert, never before", () => {
    const insertIdx = migrationCode.indexOf("insert into wholesale_price_history");
    const returnUpdatedIdx = migrationCode.lastIndexOf("return 'updated';");
    expect(returnUpdatedIdx).toBeGreaterThan(insertIdx);
  });
});

describe("migration file: security posture matches the two existing RPCs", () => {
  it("is SECURITY INVOKER with search_path pinned", () => {
    expect(migrationCode).toContain("security invoker");
    expect(migrationCode).toContain("set search_path = public, pg_temp");
  });

  it("validates the admin against profiles(role='admin', status='approved') before writing", () => {
    expect(migrationCode).toContain("role = 'admin' and status = 'approved'");
  });

  it(`EXECUTE is revoked from public/anon/authenticated and granted only to service_role for ${FULL_RPC_SIG}`, () => {
    expect(migrationCode).toContain(`revoke execute on function ${FULL_RPC_SIG} from public, anon, authenticated;`);
    expect(migrationCode).toContain(`grant execute on function ${FULL_RPC_SIG} to service_role;`);
  });
});

describe("preflight file: read-only, single consolidated result", () => {
  it("contains no write/DDL statement anywhere", () => {
    const forbidden = ["insert into", "update ", "delete from", "alter table", "create table", "drop table", "create or replace function"];
    const lower = preflight.toLowerCase();
    for (const kw of forbidden) {
      expect(lower, `preflight contains forbidden keyword "${kw}"`).not.toContain(kw);
    }
  });

  it("produces exactly one final SELECT with an OVERALL STATUS row", () => {
    expect(preflight).toContain("'OVERALL STATUS'");
    expect(preflight).toMatch(/order by ord;\s*$/);
  });

  it("checks that both existing RPCs are untouched, not just that the new one is new", () => {
    expect(preflight).toContain("existing_rpcs_untouched");
    expect(preflight).toContain("wholesale_update_service_price");
    expect(preflight).toContain("wholesale_update_service_pricing_intelligence");
  });
});

describe("verify file: read-only, checks the new RPC and confirms the existing two are untouched", () => {
  it("contains no write/DDL statement anywhere", () => {
    const forbidden = ["insert into", "update ", "delete from", "alter table", "create table", "drop table", "create or replace function"];
    const lower = verify.toLowerCase();
    for (const kw of forbidden) {
      expect(lower, `verify contains forbidden keyword "${kw}"`).not.toContain(kw);
    }
  });

  it("confirms wholesale_update_service_full's signature via pg_get_function_identity_arguments", () => {
    expect(verify).toContain("wholesale_update_service_full");
    expect(verify).toMatch(/pg_get_function_identity_arguments/);
  });

  it("confirms both existing RPCs are unchanged", () => {
    expect(verify).toContain("wholesale_update_service_price");
    expect(verify).toContain("wholesale_update_service_pricing_intelligence");
  });

  it("ends with a single-row POST-MIGRATION SUMMARY with an overall_status column", () => {
    expect(verify).toContain("POST-MIGRATION SUMMARY");
    expect(verify).toMatch(/overall_status/);
  });
});

describe("rollback file: reference-only, destructive, drops only the new function", () => {
  it("is wrapped in an explicit transaction", () => {
    const lines = rollback.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines.indexOf("commit;")).toBeGreaterThan(0);
  });

  it("drops only wholesale_update_service_full by exact signature", () => {
    expect(rollback).toContain("drop function if exists wholesale_update_service_full(");
  });

  it("never mentions the two existing RPCs — this rollback must not be able to touch them", () => {
    expect(rollback).not.toContain("wholesale_update_service_price(");
    expect(rollback).not.toContain("wholesale_update_service_pricing_intelligence(");
  });

  it("documents that it is reference-only, never run automatically", () => {
    expect(rollback.toLowerCase()).toContain("reference only");
    expect(rollback.toLowerCase()).toContain("not run automatically");
  });
});
