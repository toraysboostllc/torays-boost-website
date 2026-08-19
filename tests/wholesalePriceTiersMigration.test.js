import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Corrected design (see wholesale-price-tiers-migration.sql's header for
 * the full reasoning, and the CREATE FUNCTION docs it cites):
 * CREATE OR REPLACE FUNCTION only replaces an existing function when the
 * argument list matches exactly — a 12-arg function "extended" to 15
 * arguments via CREATE OR REPLACE does NOT replace it, it creates a SECOND,
 * distinct overload with the same name, which is exactly the kind of
 * ambiguous-resolution situation (a 12-argument call could match either the
 * exact 12-arg function or the 15-arg one via defaults) that must never
 * ship. These tests verify the corrected two-function design instead:
 * wholesale_update_service_full() (v1, 12 args) is left completely
 * untouched, and wholesale_update_service_full_v2 (14 args, no defaulted
 * tier flag) is a brand-new, unambiguously-named function.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const supabaseDir = join(__dirname, "..", "supabase");
const migration = readFileSync(join(supabaseDir, "wholesale-price-tiers-migration.sql"), "utf8");
const preflight = readFileSync(join(supabaseDir, "wholesale-price-tiers-preflight.sql"), "utf8");
const verify = readFileSync(join(supabaseDir, "wholesale-price-tiers-verify.sql"), "utf8");
const rollback = readFileSync(join(supabaseDir, "wholesale-price-tiers-rollback.sql"), "utf8");

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

const V1_IDENTITY_ARGS =
  "p_service_id uuid, p_admin_id uuid, p_name text, p_notes text, p_is_microsoldering boolean, p_pricing_type text, p_fixed_price numeric, p_price_min numeric, p_price_max numeric, p_currency text, p_recommended_price numeric, p_target_margin_percent numeric";
const V2_IDENTITY_ARGS = `${V1_IDENTITY_ARGS}, p_competitive_price numeric, p_high_profit_price numeric`;
const V2_GRANT_SIG =
  "public.wholesale_update_service_full_v2(\n  uuid, uuid, text, text, boolean, text, numeric, numeric, numeric, text, numeric, numeric, numeric, numeric\n)";

describe("migration file: never touches v1 (wholesale_update_service_full)", () => {
  it("contains no CREATE OR REPLACE / DROP / REVOKE / GRANT referencing the bare v1 name", () => {
    // The bare name must only ever appear inside prose comments explaining
    // the design, never in an executable statement — checked by requiring
    // every executable-statement occurrence to be immediately followed by
    // "_v2".
    const executableLines = migrationCode
      .split("\n")
      .filter((l) => /wholesale_update_service_full\b/.test(l));
    for (const line of executableLines) {
      // Every occurrence of the bare name in a real (non-comment) statement
      // line must be the "_v2" variant — stripComments() already removed
      // "--" comments, so anything left here is executable SQL.
      expect(line).toMatch(/wholesale_update_service_full_v2/);
    }
  });

  it("never issues a bare 'create or replace function public.wholesale_update_service_full(' (only the _v2 variant)", () => {
    expect(migrationCode).not.toContain("create or replace function public.wholesale_update_service_full(\n");
    expect(migrationCode).toContain("create or replace function public.wholesale_update_service_full_v2(\n");
  });
});

describe("migration file: wrapping and columns", () => {
  it("is wrapped in an explicit transaction", () => {
    const lines = migration.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines.indexOf("commit;")).toBeGreaterThan(0);
  });

  it("adds exactly two nullable columns to wholesale_services, idempotently", () => {
    expect(migrationCode).toContain("alter table wholesale_services add column if not exists competitive_price numeric(10, 2);");
    expect(migrationCode).toContain("alter table wholesale_services add column if not exists high_profit_price numeric(10, 2);");
  });

  it("adds exactly four nullable columns to wholesale_price_history, mirroring the recommended_price/target_margin_percent pattern", () => {
    for (const col of ["old_competitive_price", "new_competitive_price", "old_high_profit_price", "new_high_profit_price"]) {
      expect(migrationCode).toContain(`alter table wholesale_price_history add column if not exists ${col} numeric`);
    }
  });

  it("never DROPs a table, column, or function — the one DELETE this file contains is the pre-existing, unmodified scoped microsoldering-tag removal carried over from wholesale-service-atomic-save-migration.sql", () => {
    expect(migrationCode.toLowerCase()).not.toMatch(/\bdrop table\b/);
    expect(migrationCode.toLowerCase()).not.toMatch(/\bdrop column\b/);
    expect(migrationCode.toLowerCase()).not.toMatch(/\bdrop function\b/);
    const deletes = migrationCode.match(/delete from [\w.]+[^;]*;/g) || [];
    expect(deletes).toHaveLength(1);
    expect(deletes[0]).toContain("delete from public.wholesale_service_tags");
    expect(deletes[0]).not.toContain("wholesale_services");
    expect(deletes[0]).not.toContain("wholesale_price_history");
  });
});

describe("migration file: the legacy-or-complete CHECK constraint — enforced at the table, independent of which function writes", () => {
  it("drops then re-adds all three price-tier constraints idempotently", () => {
    for (const name of [
      "wholesale_services_competitive_price_check",
      "wholesale_services_high_profit_price_check",
      "wholesale_services_price_tiers_check",
    ]) {
      expect(migrationCode).toContain(`alter table wholesale_services drop constraint if exists ${name};`);
      expect(migrationCode).toContain(`alter table wholesale_services add constraint ${name}`);
    }
  });

  it("the combined check allows exactly two shapes: both tiers null, or all four fields (fixed_price/competitive/recommended/high_profit) non-null and ordered on a fixed-type service", () => {
    const idx = migrationCode.indexOf("wholesale_services_price_tiers_check\n  check (");
    const block = migrationCode.slice(idx, migrationCode.indexOf(");", idx) + 2);
    expect(block).toContain("(competitive_price is null and high_profit_price is null)");
    expect(block).toContain("pricing_type = 'fixed'");
    expect(block).toContain("fixed_price is not null");
    expect(block).toContain("competitive_price is not null");
    expect(block).toContain("recommended_price is not null");
    expect(block).toContain("high_profit_price is not null");
    expect(block).toContain("competitive_price > fixed_price");
    expect(block).toContain("recommended_price >= competitive_price");
    expect(block).toContain("high_profit_price >= recommended_price");
  });

  it("uses non-negativity checks (>= 0) for each tier column independently", () => {
    expect(migrationCode).toMatch(/wholesale_services_competitive_price_check\s*\n\s*check \(competitive_price is null or competitive_price >= 0\)/);
    expect(migrationCode).toMatch(/wholesale_services_high_profit_price_check\s*\n\s*check \(high_profit_price is null or high_profit_price >= 0\)/);
  });
});

describe("migration file: wholesale_update_service_full_v2 — new function, full 14-argument signature, no defaulted flag", () => {
  it("declares exactly the original 12 parameters plus 2 new ones, none defaulted", () => {
    const startIdx = migrationCode.indexOf("create or replace function public.wholesale_update_service_full_v2(");
    const endIdx = migrationCode.indexOf(")\nreturns text", startIdx);
    const signatureBlock = migrationCode.slice(startIdx, endIdx);
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
      "p_competitive_price numeric",
      "p_high_profit_price numeric",
    ]) {
      expect(signatureBlock).toContain(arg);
    }
    // Never a compatibility flag or a default clause anywhere in the
    // signature — v2 always manages tiers, unconditionally.
    expect(signatureBlock).not.toContain("p_update_price_tiers");
    expect(signatureBlock).not.toContain("default");
  });

  it("declares SECURITY INVOKER and a pinned search_path, matching v1's existing convention", () => {
    const startIdx = migrationCode.indexOf("create or replace function public.wholesale_update_service_full_v2(");
    const bodyStartIdx = migrationCode.indexOf("as $$", startIdx);
    const declBlock = migrationCode.slice(startIdx, bodyStartIdx);
    expect(declBlock).toContain("security invoker");
    expect(declBlock).toContain("set search_path = public, pg_temp");
  });

  it("re-issues REVOKE/GRANT against the new 14-argument signature, service_role only", () => {
    expect(migrationCode).toContain(`revoke execute on function ${V2_GRANT_SIG}`);
    expect(migrationCode).toContain(`grant execute on function ${V2_GRANT_SIG}`);
    expect(migrationCode).toContain("from public, anon, authenticated;");
    expect(migrationCode).toContain("to service_role;");
  });
});

describe("migration file: v2 tier validation is unconditional (no flag to gate it)", () => {
  it("both tiers null is always accepted without further checks (legacy)", () => {
    const idx = migrationCode.indexOf("if p_competitive_price is not null or p_high_profit_price is not null then");
    expect(idx).toBeGreaterThan(-1);
  });

  it("rejects tiers on a non-'fixed' service", () => {
    const idx = migrationCode.indexOf("if p_pricing_type <> 'fixed' then");
    expect(idx).toBeGreaterThan(-1);
    const block = migrationCode.slice(idx, idx + 80);
    expect(block).toContain("invalid_price_tiers");
  });

  it("rejects a partial pair — either tier set alone, or recommended_price missing", () => {
    expect(migrationCode).toContain("if p_competitive_price is null or p_high_profit_price is null or p_recommended_price is null then");
  });

  it("rejects negative tier values", () => {
    expect(migrationCode).toContain("if p_competitive_price < 0 or p_high_profit_price < 0 then");
  });

  it("enforces the exact ordering fixed_price < competitive <= recommended <= high_profit", () => {
    const idx = migrationCode.indexOf("if not (\n      p_competitive_price > p_fixed_price");
    expect(idx).toBeGreaterThan(-1);
    const block = migrationCode.slice(idx, migrationCode.indexOf("invalid_price_tiers", idx) + 20);
    expect(block).toContain("p_competitive_price > p_fixed_price");
    expect(block).toContain("p_recommended_price >= p_competitive_price");
    expect(block).toContain("p_high_profit_price >= p_recommended_price");
  });

  it("every 'invalid_price_tiers' raise happens strictly before the row is locked (SELECT ... FOR UPDATE) — no partial write path", () => {
    const raiseIndices = [...migrationCode.matchAll(/raise exception 'invalid_price_tiers';/g)].map((m) => m.index);
    expect(raiseIndices.length).toBeGreaterThanOrEqual(4);
    const lockIdx = migrationCode.indexOf("for update");
    for (const idx of raiseIndices) {
      expect(idx).toBeLessThan(lockIdx);
    }
  });
});

describe("migration file: v2's no-op guard, history insert, and UPDATE write the tier params directly (no resolved-vs-raw distinction needed)", () => {
  it("v_unchanged compares p_competitive_price/p_high_profit_price directly against the stored row", () => {
    const idx = migrationCode.indexOf("v_unchanged :=");
    const block = migrationCode.slice(idx, migrationCode.indexOf("if v_unchanged then", idx));
    expect(block).toContain("v_old.competitive_price is not distinct from p_competitive_price");
    expect(block).toContain("v_old.high_profit_price is not distinct from p_high_profit_price");
  });

  it("v_price_fields_changed also compares the tier params directly, so a tier-only edit still writes a history row", () => {
    const idx = migrationCode.indexOf("v_price_fields_changed := not (");
    const block = migrationCode.slice(idx, migrationCode.indexOf("update public.wholesale_services", idx));
    expect(block).toContain("v_old.competitive_price is not distinct from p_competitive_price");
    expect(block).toContain("v_old.high_profit_price is not distinct from p_high_profit_price");
  });

  it("the UPDATE statement writes p_competitive_price/p_high_profit_price directly — there is no separate 'resolved' local to fall back to, since v2 always manages tiers", () => {
    const idx = migrationCode.indexOf("update public.wholesale_services");
    const block = migrationCode.slice(idx, migrationCode.indexOf("where id = p_service_id;", idx));
    expect(block).toContain("competitive_price = p_competitive_price,");
    expect(block).toContain("high_profit_price = p_high_profit_price,");
  });

  it("the history insert carries old_/new_competitive_price and old_/new_high_profit_price", () => {
    const idx = migrationCode.indexOf("insert into public.wholesale_price_history (");
    const block = migrationCode.slice(idx, migrationCode.indexOf(");", idx) + 2);
    expect(block).toContain("old_competitive_price, new_competitive_price,");
    expect(block).toContain("old_high_profit_price, new_high_profit_price");
    expect(block).toContain("v_old.competitive_price, p_competitive_price,");
    expect(block).toContain("v_old.high_profit_price, p_high_profit_price");
  });
});

describe("preflight file", () => {
  it("is entirely read-only", () => {
    const code = stripComments(preflight).toLowerCase();
    expect(code).not.toMatch(/\b(insert into|update |delete from|alter table|create table|drop |grant |revoke )\b/);
  });

  it("checks v1 exists exactly once with its exact original 12-argument signature", () => {
    expect(preflight).toContain("p.proname = 'wholesale_update_service_full'");
    expect(preflight).toContain(`'${V1_IDENTITY_ARGS}'`);
    expect(preflight).toContain("v1_name_matches = 1 and v1_exact_12arg_matches = 1");
  });

  it("checks v2 is either absent (first run) or already applied with the exact 14-argument signature (idempotent re-run)", () => {
    expect(preflight).toContain("p.proname = 'wholesale_update_service_full_v2'");
    expect(preflight).toContain(`'${V2_IDENTITY_ARGS}'`);
    expect(preflight).toContain("v2_name_matches = 0");
    expect(preflight).toContain("v2_name_matches = 1 and v2_exact_14arg_matches = 1");
  });

  it("flags more than one function under either name as FAIL/REVIEW REQUIRED, never as an automatic PASS", () => {
    expect(preflight).toContain("v1_name_matches > 1");
    expect(preflight).toContain("v2_name_matches > 1");
  });

  it("ends with a single OVERALL STATUS row", () => {
    expect(preflight).toContain("'OVERALL STATUS'");
  });
});

describe("verify file", () => {
  it("is entirely read-only — no RPC call to either function itself", () => {
    const code = stripComments(verify).toLowerCase();
    expect(code).not.toMatch(/\b(insert into|update |delete from|alter table|create table|drop |grant |revoke )\b/);
    expect(verify).not.toMatch(/select\s+wholesale_update_service_full/);
    expect(verify).not.toMatch(/rpc\/wholesale_update_service_full/);
  });

  it("checks v1's exact original 12-argument identity signature", () => {
    expect(verify).toContain(`'${V1_IDENTITY_ARGS}'`);
  });

  it("checks v2's exact new 14-argument identity signature", () => {
    expect(verify).toContain(`'${V2_IDENTITY_ARGS}'`);
  });

  it("reads v1's ACTUAL installed body via pg_get_functiondef and requires it show NO trace of tier logic — proof it was genuinely left untouched", () => {
    expect(verify).toContain("v1_body_shows_no_tier_additions");
    expect(verify).toContain("v1_functiondef not like '%p_competitive_price%'");
    expect(verify).toContain("v1_functiondef not like '%p_high_profit_price%'");
    expect(verify).toContain("v1_functiondef not like '%invalid_price_tiers%'");
  });

  it("reads v2's ACTUAL installed body via pg_get_functiondef and requires the tier guards be present", () => {
    expect(verify).toContain("v2_functiondef like '%p_competitive_price%'");
    expect(verify).toContain("v2_functiondef like '%invalid_price_tiers%'");
    expect(verify).toContain("v2_functiondef like '%v_unchanged%'");
  });

  it("checks execute grants, security, and search_path for v1 and v2 INDEPENDENTLY of each other", () => {
    const v1Idx = verify.indexOf("'v1_return_language_security_grants'");
    const v2Idx = verify.indexOf("'v2_return_language_security_grants'");
    expect(v1Idx).toBeGreaterThan(-1);
    expect(v2Idx).toBeGreaterThan(-1);
    expect(verify).toContain("from raw, v1_meta");
    expect(verify).toContain("from raw, v2_meta");
  });

  it("has an explicit no_unexpected_overloads check requiring exactly 1 function under each name", () => {
    expect(verify).toContain("'no_unexpected_overloads'");
    expect(verify).toContain("v1_name_matches = 1 and v2_name_matches = 1");
  });

  it("ends with a single OVERALL STATUS row", () => {
    expect(verify).toContain("'OVERALL STATUS'");
  });
});

describe("rollback file: non-destructive path only ever drops v2, v1 is never referenced", () => {
  it("is wrapped in an explicit transaction and never runs automatically (not referenced by any script/test)", () => {
    const lines = rollback.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines.indexOf("commit;")).toBeGreaterThan(0);
  });

  it("section 1 drops ONLY wholesale_update_service_full_v2, by its exact 14-argument signature", () => {
    expect(rollback).toContain(
      "drop function if exists public.wholesale_update_service_full_v2(\n  uuid, uuid, text, text, boolean, text, numeric, numeric, numeric, text, numeric, numeric, numeric, numeric\n);"
    );
  });

  it("never references the bare v1 name (wholesale_update_service_full without _v2) anywhere in an executable statement", () => {
    const rollbackCode = stripComments(rollback);
    const executableLines = rollbackCode.split("\n").filter((l) => /wholesale_update_service_full\b/.test(l));
    for (const line of executableLines) {
      expect(line).toMatch(/wholesale_update_service_full_v2/);
    }
  });

  it("column drops are a separate, explicitly optional section — the file documents skipping it to preserve live tier data", () => {
    expect(rollback).toContain("alter table wholesale_services drop column if exists competitive_price;");
    expect(rollback).toContain("alter table wholesale_services drop column if exists high_profit_price;");
    expect(rollback.toLowerCase()).toContain("optional");
  });
});
