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
  "public.wholesale_update_service_full(\n  uuid, uuid, text, text, boolean, text, numeric, numeric, numeric, text, numeric, numeric\n)";

describe("migration file: wrapping, idempotency, and additivity", () => {
  it("is wrapped in an explicit transaction", () => {
    const lines = migration.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines.indexOf("commit;")).toBeGreaterThan(0);
  });

  it("creates public.wholesale_update_service_full with the full 12-argument signature covering name/notes/tag/price/pricing-intelligence", () => {
    expect(migrationCode).toContain("create or replace function public.wholesale_update_service_full(");
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

  it("the one DELETE this function has is the scoped microsoldering-tag removal — never a bare/unscoped delete, never touching services or history", () => {
    const deletes = migrationCode.match(/delete from [\w.]+[^;]*;/g) || [];
    expect(deletes).toHaveLength(1);
    expect(deletes[0]).toContain("delete from public.wholesale_service_tags");
    expect(deletes[0]).toContain("service_id = p_service_id");
    expect(deletes[0]).toContain("tag_id = v_tag_id");
    expect(deletes[0]).not.toContain("wholesale_services");
    expect(deletes[0]).not.toContain("wholesale_price_history");
  });

  it("no longer claims 'No DELETE' — the header honestly describes the one scoped DELETE instead", () => {
    // The claim wraps across several "-- "-prefixed comment lines — join
    // them into flowing prose before matching, rather than assuming the
    // whole sentence sits on one physical line.
    const migrationProse = migration
      .split("\n")
      .map((line) => line.replace(/^--\s?/, ""))
      .join(" ")
      .replace(/\s+/g, " ");
    expect(migration).not.toMatch(/No DELETE, no DROP/);
    expect(migration).toContain("The only DELETE anywhere in this file lives");
    expect(migrationProse).toContain("it never touches a service row, a wholesale_price_history row, or any other tag");
  });

  it("no comment claims to preserve or use the removed sibling RPC by name — it was removed before production", () => {
    expect(migration).not.toContain("wholesale_update_service_pricing_intelligence");
  });

  it("every table/function reference is schema-qualified with public. — function definition, body statements, and REVOKE/GRANT", () => {
    expect(migrationCode).toContain("create or replace function public.wholesale_update_service_full(");
    expect(migrationCode).toContain("v_old public.wholesale_services%rowtype;");
    expect(migrationCode).toContain("from public.profiles");
    expect(migrationCode).toContain("from public.wholesale_services");
    expect(migrationCode).toContain("update public.wholesale_services");
    expect(migrationCode).toContain("from public.wholesale_tags");
    expect(migrationCode).toContain("from public.wholesale_service_tags");
    expect(migrationCode).toContain("insert into public.wholesale_service_tags");
    expect(migrationCode).toContain("delete from public.wholesale_service_tags");
    expect(migrationCode).toContain("insert into public.wholesale_price_history");
    expect(migrationCode).toContain("revoke execute on function public.wholesale_update_service_full(");
    expect(migrationCode).toContain("grant execute on function public.wholesale_update_service_full(");
  });
});

describe("migration file: never touches the existing per-concern RPC", () => {
  it("never redefines wholesale_update_service_price", () => {
    expect(migrationCode).not.toMatch(/create or replace function public\.wholesale_update_service_price\(/);
  });

  it("creates exactly one function in this file", () => {
    const defs = migrationCode.match(/create or replace function [\w.]+\(/g) || [];
    expect(defs).toEqual(["create or replace function public.wholesale_update_service_full("]);
  });
});

describe("migration file: validates every field before writing anything, mirroring wholesale_update_service_price's price rules exactly", () => {
  it("validates admin, name, notes, is_microsoldering-not-null, currency, pricing_type, price shape, recommended_price, and target_margin_percent, in that order, all before the row lock", () => {
    const adminIdx = migrationCode.indexOf("role = 'admin' and status = 'approved'");
    const nameIdx = migrationCode.indexOf("invalid_name");
    const notesIdx = migrationCode.indexOf("invalid_notes");
    const microsolderingNullIdx = migrationCode.indexOf("invalid_is_microsoldering");
    const currencyIdx = migrationCode.indexOf("invalid_currency");
    const pricingTypeIdx = migrationCode.indexOf("invalid_pricing_type");
    const fixedShapeIdx = migrationCode.indexOf("invalid_fixed_price");
    const rangeShapeIdx = migrationCode.indexOf("invalid_range_price");
    const quoteShapeIdx = migrationCode.indexOf("invalid_quote_price");
    const recommendedIdx = migrationCode.indexOf("invalid_recommended_price");
    const marginIdx = migrationCode.indexOf("invalid_target_margin_percent");
    const lockIdx = migrationCode.indexOf("for update");
    for (const idx of [
      adminIdx, nameIdx, notesIdx, microsolderingNullIdx, currencyIdx, pricingTypeIdx,
      fixedShapeIdx, rangeShapeIdx, quoteShapeIdx, recommendedIdx, marginIdx, lockIdx,
    ]) {
      expect(idx).toBeGreaterThan(-1);
    }
    expect(adminIdx).toBeLessThan(nameIdx);
    expect(nameIdx).toBeLessThan(notesIdx);
    expect(notesIdx).toBeLessThan(microsolderingNullIdx);
    expect(microsolderingNullIdx).toBeLessThan(currencyIdx);
    expect(currencyIdx).toBeLessThan(pricingTypeIdx);
    expect(pricingTypeIdx).toBeLessThan(fixedShapeIdx);
    expect(fixedShapeIdx).toBeLessThan(rangeShapeIdx);
    expect(rangeShapeIdx).toBeLessThan(quoteShapeIdx);
    expect(quoteShapeIdx).toBeLessThan(recommendedIdx);
    expect(recommendedIdx).toBeLessThan(marginIdx);
    expect(marginIdx).toBeLessThan(lockIdx);
  });

  it("pricing_type is restricted to the 3 valid values", () => {
    expect(migrationCode).toMatch(/p_pricing_type not in \('fixed', 'range', 'quote'\)/);
  });

  it("p_pricing_type NULL is rejected explicitly by the same guard, before the row lock or any write", () => {
    expect(migrationCode).toContain(
      "if p_pricing_type is null or p_pricing_type not in ('fixed', 'range', 'quote') then"
    );
    const nullCheckIdx = migrationCode.indexOf("if p_pricing_type is null or p_pricing_type not in");
    const lockIdx = migrationCode.indexOf("for update");
    const updateIdx = migrationCode.indexOf("update public.wholesale_services");
    expect(nullCheckIdx).toBeGreaterThan(-1);
    expect(nullCheckIdx).toBeLessThan(lockIdx);
    expect(nullCheckIdx).toBeLessThan(updateIdx);
  });

  it("only the literal value 'quote' can ever reach the quote branch — NULL and every other value are already rejected by the guard above", () => {
    // The elsif/else chain is a plpgsql if/elsif/else, not a CASE with its
    // own independent NULL handling — by the time execution reaches this
    // chain, p_pricing_type is null OR not in ('fixed','range','quote')
    // has already raised and returned control out of the function. So the
    // only value that can fall through to the final `else` (the quote
    // branch) is the literal string 'quote': not NULL (rejected above),
    // not 'fixed' (caught by the first `if`), not 'range' (caught by the
    // `elsif`), and not any other string (rejected above).
    const rangeElsifIdx = migrationCode.indexOf("elsif p_pricing_type = 'range' then");
    const quoteElseIdx = migrationCode.indexOf("else", rangeElsifIdx);
    const quoteRaiseIdx = migrationCode.indexOf("invalid_quote_price", quoteElseIdx);
    expect(rangeElsifIdx).toBeGreaterThan(-1);
    expect(quoteElseIdx).toBeGreaterThan(rangeElsifIdx);
    expect(quoteRaiseIdx).toBeGreaterThan(quoteElseIdx);
    // The quote branch itself never re-checks p_pricing_type against
    // 'quote' — there is nothing left for it to be, structurally.
    const quoteBranch = migrationCode.slice(quoteElseIdx, quoteRaiseIdx);
    expect(quoteBranch).not.toContain("p_pricing_type");
  });

  it("currency is pinned to 'USD', exactly like wholesale_update_service_price", () => {
    expect(migrationCode).toContain("if p_currency is distinct from 'USD' then");
    expect(migrationCode).toContain("raise exception 'invalid_currency';");
  });

  it("'fixed' requires a non-negative fixed_price and null min/max — mirrors wholesale_services_pricing_values_check", () => {
    const idx = migrationCode.indexOf("if p_pricing_type = 'fixed' then");
    const block = migrationCode.slice(idx, migrationCode.indexOf("invalid_fixed_price", idx) + 40);
    expect(block).toContain("p_fixed_price is null or p_fixed_price < 0");
    expect(block).toContain("p_price_min is not null or p_price_max is not null");
  });

  it("'range' requires non-negative min/max with min <= max and a null fixed_price", () => {
    const idx = migrationCode.indexOf("elsif p_pricing_type = 'range' then");
    const block = migrationCode.slice(idx, migrationCode.indexOf("invalid_range_price", idx) + 40);
    expect(block).toContain("p_fixed_price is not null");
    expect(block).toContain("p_price_min is null or p_price_min < 0");
    expect(block).toContain("p_price_max is null or p_price_max < 0");
    expect(block).toContain("p_price_min > p_price_max");
  });

  it("'quote' requires fixed_price/min/max to all be null", () => {
    // "-- quote" is a comment stripped out of migrationCode — anchor off
    // the range branch's exception instead, then take the next "else".
    const rangeEndIdx = migrationCode.indexOf("invalid_range_price");
    const idx = migrationCode.indexOf("else", rangeEndIdx);
    const block = migrationCode.slice(idx, migrationCode.indexOf("invalid_quote_price", idx) + 40);
    expect(block).toContain("p_fixed_price is not null or p_price_min is not null or p_price_max is not null");
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

  it("p_is_microsoldering NULL is rejected explicitly — never silently coalesced to false", () => {
    expect(migrationCode).toContain("if p_is_microsoldering is null then");
    expect(migrationCode).toContain("raise exception 'invalid_is_microsoldering';");
    expect(migrationCode).not.toMatch(/coalesce\(p_is_microsoldering/);
    expect(migrationCode).toContain("v_want_tag := p_is_microsoldering;");
  });
});

describe("migration file: requesting Microsoldering without the tag row raises and saves nothing", () => {
  it("raises microsoldering_tag_missing when the tag is wanted but wholesale_tags has no 'microsoldering' row", () => {
    expect(migrationCode).toContain("if v_want_tag and v_tag_id is null then");
    expect(migrationCode).toContain("raise exception 'microsoldering_tag_missing';");
  });

  it("this check happens before the UPDATE and before the no-op guard's write path — no partial save is possible", () => {
    const checkIdx = migrationCode.indexOf("if v_want_tag and v_tag_id is null then");
    const updateIdx = migrationCode.indexOf("update public.wholesale_services");
    expect(checkIdx).toBeGreaterThan(-1);
    expect(updateIdx).toBeGreaterThan(checkIdx);
  });
});

describe("migration file: one atomic write — service row, tag, and AT MOST ONE history row together", () => {
  it("locks the service row with SELECT ... FOR UPDATE before any write", () => {
    expect(migrationCode).toMatch(/select \* into v_old\s*\n\s*from public\.wholesale_services\s*\n\s*where id = p_service_id\s*\n\s*for update;/);
  });

  it("resolves the microsoldering tag the same read-then-write-only-if-different way as setMicrosolderingTag() in the API layer — never blind delete-then-reinsert", () => {
    expect(migrationCode).toContain("select id into v_tag_id from public.wholesale_tags where slug = 'microsoldering'");
    expect(migrationCode).toMatch(/if v_want_tag and not v_has_tag then\s*\n\s*insert into public\.wholesale_service_tags/);
    expect(migrationCode).toMatch(/elsif not v_want_tag and v_has_tag then\s*\n\s*delete from public\.wholesale_service_tags/);
  });

  it("has a no-op guard covering ALL fields (name/notes/pricing/recommended/margin/tag) that returns before any write", () => {
    const unchangedIdx = migrationCode.indexOf("v_unchanged :=");
    const returnUnchangedIdx = migrationCode.indexOf("return 'unchanged';");
    const updateIdx = migrationCode.indexOf("update public.wholesale_services");
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
    const updateIdx = migrationCode.indexOf("update public.wholesale_services");
    const nextSemicolon = migrationCode.indexOf(";", updateIdx);
    const updateStmt = migrationCode.slice(updateIdx, nextSemicolon);
    for (const col of [
      "name = p_name", "notes = p_notes", "pricing_type = p_pricing_type", "fixed_price = p_fixed_price",
      "recommended_price = p_recommended_price", "target_margin_percent = p_target_margin_percent",
    ]) {
      expect(updateStmt).toContain(col);
    }
  });

  it("computes v_price_fields_changed as a NARROWER condition than v_unchanged — name/notes/tag alone must not count as a price change", () => {
    const idx = migrationCode.indexOf("v_price_fields_changed := not (");
    expect(idx).toBeGreaterThan(-1);
    const block = migrationCode.slice(idx, migrationCode.indexOf(");", idx));
    for (const field of [
      "v_old.pricing_type", "v_old.fixed_price", "v_old.price_min", "v_old.price_max",
      "v_old.currency", "v_old.recommended_price", "v_old.target_margin_percent",
    ]) {
      expect(block).toContain(field);
    }
    // name, notes, and the tag are deliberately absent from this narrower check.
    expect(block).not.toContain("v_old.name");
    expect(block).not.toContain("v_old.notes");
    expect(block).not.toContain("v_has_tag");
  });

  it("the wholesale_price_history insert is wrapped in 'if v_price_fields_changed then' — never unconditional", () => {
    const idx = migrationCode.indexOf("if v_price_fields_changed then");
    expect(idx).toBeGreaterThan(-1);
    const insertIdx = migrationCode.indexOf("insert into public.wholesale_price_history", idx);
    expect(insertIdx).toBeGreaterThan(idx);
    expect(insertIdx).toBeLessThan(migrationCode.indexOf("end if;", idx));
  });

  it("inserts at most ONE wholesale_price_history row, populating both the price half and the pricing-intelligence half together", () => {
    const inserts = migrationCode.match(/insert into public\.wholesale_price_history/g) || [];
    expect(inserts).toHaveLength(1);
    const insertIdx = migrationCode.indexOf("insert into public.wholesale_price_history");
    const nextSemicolon = migrationCode.indexOf(";", insertIdx);
    const insertStmt = migrationCode.slice(insertIdx, nextSemicolon);
    expect(insertStmt).toContain("old_pricing_type");
    expect(insertStmt).toContain("new_fixed_price");
    expect(insertStmt).toContain("old_recommended_price");
    expect(insertStmt).toContain("new_target_margin_percent");
  });

  it("returns 'updated' only after the history-insert decision, never before — and the whole body is one statement, so any failure rolls back every earlier write in the same call", () => {
    const insertDecisionIdx = migrationCode.indexOf("if v_price_fields_changed then");
    const returnUpdatedIdx = migrationCode.lastIndexOf("return 'updated';");
    expect(returnUpdatedIdx).toBeGreaterThan(insertDecisionIdx);
    // The file-level "commit;" belongs to the migration's OWN begin/commit
    // wrapper (checked elsewhere) — inside the function body itself
    // (between "as $$" and the closing "$$;"), there must be no nested
    // COMMIT/ROLLBACK: correctness rests entirely on Postgres's normal
    // function-body atomicity, not on any special-cased error handling
    // this function would otherwise need.
    const bodyStart = migrationCode.indexOf("as $$");
    const bodyEnd = migrationCode.indexOf("$$;", bodyStart);
    const functionBody = migrationCode.slice(bodyStart, bodyEnd);
    expect(functionBody).not.toMatch(/\bcommit\b\s*;/i);
    expect(functionBody.toLowerCase()).not.toMatch(/\brollback\b/);
  });
});

describe("migration file: security posture matches the existing RPC", () => {
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

const preflightCode = stripComments(preflight);

const PRICE_RPC_IDENTITY_ARGS =
  "p_service_id uuid, p_admin_id uuid, p_pricing_type text, p_fixed_price numeric, p_price_min numeric, p_price_max numeric, p_currency text";
const FULL_RPC_IDENTITY_ARGS =
  "p_service_id uuid, p_admin_id uuid, p_name text, p_notes text, p_is_microsoldering boolean, p_pricing_type text, p_fixed_price numeric, p_price_min numeric, p_price_max numeric, p_currency text, p_recommended_price numeric, p_target_margin_percent numeric";

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

  it("is a single statement — exactly one semicolon outside of any string literal", () => {
    const withoutStringLiterals = preflightCode.replace(/'(?:[^']|'')*'/g, "''");
    const statementTerminators = (withoutStringLiterals.match(/;/g) || []).length;
    expect(statementTerminators).toBe(1);
  });

  it("checks that the existing RPC is untouched, not just that the new one is new", () => {
    expect(preflight).toContain("existing_rpcs_untouched");
    expect(preflight).toContain("wholesale_update_service_price");
    expect(preflight).not.toContain("wholesale_update_service_pricing_intelligence");
  });

  it("no longer describes the migration's RPC as a bare 'SIBLING function' — names wholesale_update_service_full explicitly", () => {
    expect(preflight).not.toMatch(/adds a SIBLING function, never modifies it/);
    expect(preflight).toContain("creates a SIBLING RPC, wholesale_update_service_full");
  });

  it("the first branch of the checks CTE explicitly names all 4 output columns (ord, check_name, status, details) — regression for a missing 'as details' alias", () => {
    // Only the FIRST branch of a UNION ALL fixes the result set's column
    // names; every later branch inherits them positionally regardless of
    // its own aliases (or lack thereof). If the first branch's 4th column
    // is unaliased, Postgres assigns it an auto-generated name, and the
    // final `select ord, check_name, status, details from checks` breaks
    // with "column details does not exist" — a bug invisible to any
    // string-based test that doesn't check for the alias explicitly.
    const checksIdx = preflightCode.indexOf("checks as (");
    expect(checksIdx).toBeGreaterThan(-1);
    const firstUnionIdx = preflightCode.indexOf("union all", checksIdx);
    expect(firstUnionIdx).toBeGreaterThan(checksIdx);
    const firstBranch = preflightCode.slice(checksIdx, firstUnionIdx);
    expect(firstBranch).toMatch(/\bas ord\b/);
    expect(firstBranch).toMatch(/\bas check_name\b/);
    expect(firstBranch).toMatch(/\bas status\b/);
    expect(firstBranch).toMatch(/\bas details\b/);
  });
});

describe("preflight file: every metadata lookup is schema-qualified to public", () => {
  it("every information_schema.tables/columns check is scoped to table_schema = 'public'", () => {
    const tableBlocks = preflightCode.match(/information_schema\.tables[\s\S]{0,80}?\)/g) || [];
    const columnBlocks = preflightCode.match(/information_schema\.columns[\s\S]{0,120}?\)/g) || [];
    expect(tableBlocks.length).toBe(5); // services, history, tags, service_tags, profiles
    expect(columnBlocks.length).toBe(6); // 2 services columns + 4 history columns
    for (const block of [...tableBlocks, ...columnBlocks]) {
      expect(block, `missing table_schema = 'public' guard near: ${block.slice(0, 80)}`).toMatch(/table_schema = 'public'/);
    }
  });

  it("every pg_proc function lookup joins pg_namespace and restricts to nspname = 'public'", () => {
    const blocks = preflightCode.match(/from pg_proc[\s\S]{0,260}?\)/g) || [];
    // price RPC: name-count, exact-match count (2); full RPC: name-count, exact-match count (2)
    expect(blocks.length).toBe(4);
    for (const block of blocks) {
      expect(block).toContain("pg_namespace");
      expect(block).toContain("nspname = 'public'");
    }
  });

  it("rejects a same-named function living in a different schema — a bare, schema-less pg_proc/information_schema match is never trusted", () => {
    expect(preflightCode).not.toMatch(/from information_schema\.tables\s+where\s+table_name/);
    expect(preflightCode).not.toMatch(/from information_schema\.columns\s+where\s+table_name/);
    expect(preflightCode).not.toMatch(/from pg_proc\s+where\s+proname/);
  });
});

describe("preflight file: the 4 pricing-intelligence history columns are checked individually, all 4 required", () => {
  it("checks each column name individually, never a single proxy column standing in for all four", () => {
    for (const col of ["old_recommended_price", "new_recommended_price", "old_target_margin_percent", "new_target_margin_percent"]) {
      expect(preflightCode).toContain(`column_name = '${col}'`);
    }
    expect(preflightCode).not.toContain("history_has_pricing_intelligence_columns");
  });

  it("the prerequisite check requires the AND of all 4 individual flags, not just one", () => {
    const idx = preflightCode.indexOf("history_has_all_pricing_intelligence_columns");
    expect(idx).toBeGreaterThan(-1);
    const derivedStart = preflightCode.indexOf("derived as (");
    expect(derivedStart).toBeGreaterThan(-1);
    expect(derivedStart).toBeLessThan(idx);
    const region = preflightCode.slice(derivedStart, idx);
    for (const flag of [
      "history_has_old_recommended_price",
      "history_has_new_recommended_price",
      "history_has_old_target_margin_percent",
      "history_has_new_target_margin_percent",
    ]) {
      expect(region).toContain(flag);
    }
    expect(region).toMatch(/\band\b/);
    expect(region).not.toMatch(/\bor\b/);
  });

  it("any single missing column (each of the 4, individually) fails the prerequisite check — a small truth-table regression", () => {
    // Mirrors the AND logic locked in above: if even one of the four is
    // false, the AND (and therefore prerequisite_objects_exist) is false.
    function passesPrerequisite(flags) {
      return flags.every(Boolean);
    }
    const O = false, X = true;
    expect(passesPrerequisite([O, X, X, X])).toBe(false); // missing old_recommended_price
    expect(passesPrerequisite([X, O, X, X])).toBe(false); // missing new_recommended_price
    expect(passesPrerequisite([X, X, O, X])).toBe(false); // missing old_target_margin_percent
    expect(passesPrerequisite([X, X, X, O])).toBe(false); // missing new_target_margin_percent
    expect(passesPrerequisite([X, X, X, X])).toBe(true);
  });
});

describe("preflight file: the Microsoldering tag row itself is checked, not just the wholesale_tags table", () => {
  it("uses EXISTS against public.wholesale_tags filtered to slug = 'microsoldering', exposing only a boolean", () => {
    // "exposing only a boolean" — EXISTS(SELECT 1 FROM ...) never selects
    // the tag's id, name, or any other real column value, only whether a
    // matching row is present.
    expect(preflightCode).toContain("exists (select 1 from public.wholesale_tags where slug = 'microsoldering')");
    expect(preflightCode).toContain("as microsoldering_tag_row_exists");
  });

  it("is its own check row (PASS/FAIL), referencing the removed-RPC-adjacent failure mode it exists to catch", () => {
    expect(preflightCode).toContain("'microsoldering_tag_row_exists'");
    expect(preflightCode).toContain("case when microsoldering_tag_row_exists then 'PASS' else 'FAIL' end");
    expect(preflightCode).toContain("microsoldering_tag_missing");
  });
});

describe("preflight file: existing price RPC is verified by exact signature, not just proname", () => {
  it("requires name_matches = 1 AND exact_matches = 1 to PASS, an overload or wrong signature is never silently accepted", () => {
    const idx = preflightCode.indexOf("'existing_rpcs_untouched'");
    expect(idx).toBeGreaterThan(-1);
    const passLine = preflightCode.slice(idx, preflightCode.indexOf("then 'PASS'", idx));
    expect(passLine).toContain("price_rpc_name_matches = 1");
    expect(passLine).toContain("price_rpc_exact_matches = 1");
  });

  it(`compares pg_get_function_identity_arguments against the exact expected signature: "${PRICE_RPC_IDENTITY_ARGS}"`, () => {
    expect(preflightCode).toContain(`pg_get_function_identity_arguments(p.oid) = '${PRICE_RPC_IDENTITY_ARGS}'`);
  });

  it("a wrong signature or an unexpected overload produces REVIEW REQUIRED, never PASS", () => {
    const idx = preflightCode.indexOf("select 3, 'existing_rpcs_untouched'");
    const caseStart = preflightCode.indexOf("case", idx);
    const caseEnd = preflightCode.indexOf("end,\n    case", caseStart);
    const statusExpr = preflightCode.slice(caseStart, caseEnd);
    expect(statusExpr).toContain("when price_rpc_name_matches = 1 and price_rpc_exact_matches = 1 then 'PASS'");
    expect(statusExpr).toContain("else 'REVIEW REQUIRED'");
    expect(statusExpr).not.toMatch(/else 'PASS'/);
    expect(preflightCode).toContain("unexpected overload must never silently pass this check");
    expect(preflightCode).toContain("does not match the expected signature — name alone is never treated as a match");
  });
});

describe("preflight file: wholesale_update_service_full signature is derived from the migration file itself", () => {
  it(`the expected 12-argument identity signature matches the migration's declared parameter list exactly: "${FULL_RPC_IDENTITY_ARGS}"`, () => {
    expect(preflightCode).toContain(`pg_get_function_identity_arguments(p.oid) = '${FULL_RPC_IDENTITY_ARGS}'`);
    // Cross-check against the actual migration file — every parameter name
    // this preflight expects must appear, in order, in the real CREATE
    // FUNCTION signature, so the two files can never silently drift apart.
    const paramOrder = FULL_RPC_IDENTITY_ARGS.split(", ").map((p) => p.split(" ")[0]);
    let cursor = migrationCode.indexOf("create or replace function public.wholesale_update_service_full(");
    expect(cursor).toBeGreaterThan(-1);
    for (const param of paramOrder) {
      const nextIdx = migrationCode.indexOf(param, cursor);
      expect(nextIdx, `parameter ${param} not found in migration signature after position ${cursor}`).toBeGreaterThan(-1);
      cursor = nextIdx;
    }
  });

  it("clean state (never applied) requires zero functions by that name — name_matches = 0", () => {
    const idx = preflightCode.indexOf("'already_applied'");
    const block = preflightCode.slice(idx, preflightCode.indexOf("from derived", idx));
    expect(block).toContain("full_rpc_name_matches = 0 then 'PASS'");
  });

  it("already-applied state requires exactly one function AND the exact expected signature — name_matches = 1 AND exact_matches = 1", () => {
    const idx = preflightCode.indexOf("'already_applied'");
    const block = preflightCode.slice(idx, preflightCode.indexOf("from derived", idx));
    expect(block).toContain("full_rpc_name_matches = 1 and full_rpc_exact_matches = 1 then 'PASS'");
  });

  it("a wrong signature (name matches, identity doesn't) or an extra overload (name_matches > 1) both fall through to REVIEW REQUIRED, never PASS", () => {
    const idx = preflightCode.indexOf("select 4, 'already_applied'");
    const caseStart = preflightCode.indexOf("case", idx);
    const caseEnd = preflightCode.indexOf("end,\n    case", caseStart);
    const statusExpr = preflightCode.slice(caseStart, caseEnd);
    // Only the two explicit branches above may say PASS — everything else
    // in this CASE must resolve to REVIEW REQUIRED (the implicit ELSE).
    const passCount = (statusExpr.match(/then 'PASS'/g) || []).length;
    expect(passCount).toBe(2);
    expect(statusExpr).toContain("else 'REVIEW REQUIRED'");
    expect(preflightCode).toContain("does not match the signature this migration creates");
    expect(preflightCode).toContain("an unexpected overload must never be silently accepted as \"already applied\"");
  });
});

const verifyCode = stripComments(verify);

describe("verify file: read-only, single consolidated result — same convention as the preflight", () => {
  it("contains no write/DDL statement, and never invokes either RPC directly (no bare wholesale_update_service_full(...) / wholesale_update_service_price(...) call)", () => {
    const forbidden = ["insert into", "update ", "delete from", "alter table", "create table", "drop table", "create or replace function"];
    const lower = verify.toLowerCase();
    for (const kw of forbidden) {
      expect(lower, `verify contains forbidden keyword "${kw}"`).not.toContain(kw);
    }
    // Every mention of the RPC names in this file must be as a string
    // literal (proname = '...') or inside an introspection function call
    // (pg_get_function_identity_arguments(...), pg_get_functiondef(...)),
    // never as `select wholesale_update_service_full(` — an actual call.
    expect(verifyCode).not.toMatch(/[^_.]\bwholesale_update_service_full\s*\(/);
    expect(verifyCode).not.toMatch(/[^_.]\bwholesale_update_service_price\s*\(/);
  });

  it("produces exactly one final SELECT with check_name/status/details columns and an OVERALL STATUS row", () => {
    expect(verify).toContain("'OVERALL STATUS'");
    expect(verify).toMatch(/select check_name, status, details/);
    expect(verify).toMatch(/order by ord;\s*$/);
  });

  it("is a single statement — exactly one semicolon outside of any string literal", () => {
    const withoutStringLiterals = verifyCode.replace(/'(?:[^']|'')*'/g, "''");
    const statementTerminators = (withoutStringLiterals.match(/;/g) || []).length;
    expect(statementTerminators).toBe(1);
  });

  it("never mentions the removed sibling RPC anywhere, comments included", () => {
    expect(verify).not.toContain("wholesale_update_service_pricing_intelligence");
  });
});

describe("verify file: every pg_proc lookup is schema-qualified to public — cross-schema matches never trusted", () => {
  it("every NAME-based pg_proc lookup (filtered by proname) joins pg_namespace and restricts to nspname = 'public'", () => {
    const blocks = verifyCode.match(/from pg_proc[\s\S]{0,260}?\)/g) || [];
    const nameBasedBlocks = blocks.filter((b) => b.includes("proname"));
    // full RPC: name-count, exact-match count, oid lookup (3)
    // price RPC: name-count, exact-match count, full-args lookup, pronargdefaults lookup (4)
    expect(nameBasedBlocks.length).toBe(7);
    for (const block of nameBasedBlocks) {
      expect(block).toContain("pg_namespace");
      expect(block).toContain("nspname = 'public'");
    }
  });

  it("the OID-based lookups in full_rpc_meta never re-derive the function by name — they filter by raw.full_rpc_oid, itself already resolved from a schema-qualified lookup above", () => {
    const blocks = verifyCode.match(/from pg_proc[\s\S]{0,260}?\)/g) || [];
    const oidBasedBlocks = blocks.filter((b) => !b.includes("proname"));
    expect(oidBasedBlocks.length).toBe(4); // returns_text, lang_plpgsql, security_invoker, search_path_pinned
    for (const block of oidBasedBlocks) {
      expect(block).not.toContain("proname");
      expect(block).toMatch(/p\.oid = raw\.full_rpc_oid/);
    }
  });

  it("never queries pg_proc with a bare, schema-less proname filter", () => {
    expect(verifyCode).not.toMatch(/from pg_proc\s+where\s+proname/);
    expect(verifyCode).not.toMatch(/from pg_proc\s+p\s+where\s+p\.proname/);
  });

  it("the one information_schema.columns spot check is scoped to table_schema = 'public'", () => {
    const idx = verifyCode.indexOf("information_schema.columns");
    expect(idx).toBeGreaterThan(-1);
    const block = verifyCode.slice(idx, verifyCode.indexOf(")", idx) + 1);
    expect(block).toContain("table_schema = 'public'");
  });
});

describe("verify file: full RPC verified by exact 12-argument signature — an overload never silently passes", () => {
  it("requires name_matches = 1 AND exact_matches = 1 to PASS", () => {
    const idx = verifyCode.indexOf("'full_rpc_exact_signature'");
    expect(idx).toBeGreaterThan(-1);
    const passLine = verifyCode.slice(idx, verifyCode.indexOf("then 'PASS'", idx));
    expect(passLine).toContain("full_rpc_name_matches = 1");
    expect(passLine).toContain("full_rpc_exact_matches = 1");
  });

  it("compares pg_get_function_identity_arguments against the full 12-argument expected string", () => {
    expect(verifyCode).toContain(
      "pg_get_function_identity_arguments(p.oid) = 'p_service_id uuid, p_admin_id uuid, p_name text, p_notes text, p_is_microsoldering boolean, p_pricing_type text, p_fixed_price numeric, p_price_min numeric, p_price_max numeric, p_currency text, p_recommended_price numeric, p_target_margin_percent numeric'"
    );
  });

  it("an overload (name_matches > 1) is distinguished from a wrong signature (name_matches = 1, exact_matches = 0) and from 'not found' — none of the three PASS", () => {
    expect(verifyCode).toContain("does not exist at all");
    expect(verifyCode).toContain("an unexpected overload must never be treated as PASS");
    expect(verifyCode).toContain("name alone is never treated as a match");
  });
});

describe("verify file: full RPC metadata — return type, language, security mode, search_path", () => {
  it("checks prorettype = text, language = plpgsql, NOT prosecdef (SECURITY INVOKER), and a pinned search_path", () => {
    expect(verifyCode).toContain("as returns_text");
    expect(verifyCode).toContain("p.prorettype = 'text'::regtype");
    expect(verifyCode).toContain("as lang_plpgsql");
    expect(verifyCode).toContain("l.lanname = 'plpgsql'");
    expect(verifyCode).toContain("as security_invoker");
    expect(verifyCode).toContain("not p.prosecdef");
    expect(verifyCode).toContain("as search_path_pinned");
    expect(verifyCode).toContain("cfg = 'search_path=public, pg_temp'");
  });

  it("the check requires all four together, and depends on the exact-signature match", () => {
    const idx = verifyCode.indexOf("'full_rpc_return_language_security'");
    const block = verifyCode.slice(idx, verifyCode.indexOf("from raw, full_rpc_meta", idx));
    expect(block).toContain("full_rpc_exact_matches = 1");
    expect(block).toContain("returns_text");
    expect(block).toContain("lang_plpgsql");
    expect(block).toContain("security_invoker");
    expect(block).toContain("search_path_pinned");
  });
});

describe("verify file: full RPC EXECUTE grants — service_role only, PUBLIC explicitly checked", () => {
  it("checks service_role/anon/authenticated/PUBLIC using has_function_privilege on the exact-matched oid", () => {
    expect(verifyCode).toContain("has_function_privilege('service_role', raw.full_rpc_oid, 'EXECUTE')");
    expect(verifyCode).toContain("has_function_privilege('anon', raw.full_rpc_oid, 'EXECUTE')");
    expect(verifyCode).toContain("has_function_privilege('authenticated', raw.full_rpc_oid, 'EXECUTE')");
    expect(verifyCode).toContain("has_function_privilege('public', raw.full_rpc_oid, 'EXECUTE')");
  });

  it("insecure grants (any of anon/authenticated/PUBLIC true, or service_role false) fail the check", () => {
    const idx = verifyCode.indexOf("'full_rpc_execute_grants'");
    const block = verifyCode.slice(idx, verifyCode.indexOf("from raw, full_rpc_meta", idx));
    expect(block).toContain("service_role_can_execute");
    expect(block).toContain("not anon_can_execute");
    expect(block).toContain("not authenticated_can_execute");
    expect(block).toContain("not public_can_execute");
  });
});

describe("verify file: full RPC critical protections — read from the ACTUAL installed function body, not the migration file", () => {
  it("uses pg_get_functiondef on the exact-matched oid, never the migration source on disk", () => {
    expect(verifyCode).toContain("pg_get_functiondef(raw.full_rpc_oid)");
  });

  it("requires every one of the audited fixes to be present in the installed definition", () => {
    const idx = verifyCode.indexOf("'full_rpc_critical_protections'");
    const block = verifyCode.slice(idx, verifyCode.indexOf("from raw, full_rpc_meta", idx));
    for (const marker of [
      "p_is_microsoldering is null",
      "p_pricing_type is null",
      "p_currency is distinct from ''USD''",
      "invalid_fixed_price",
      "invalid_range_price",
      "invalid_quote_price",
      "microsoldering_tag_missing",
      "v_unchanged",
      "v_price_fields_changed",
      "if v_price_fields_changed then",
    ]) {
      expect(block, `missing check for "${marker}"`).toContain(marker);
    }
  });

  it("an installed definition missing any one audited fix (e.g. a stale pre-fix deploy) fails this check — simulated truth table", () => {
    // Mirrors the AND-of-10 logic locked in above: this function stands in
    // for `functiondef like '%marker%'` for each of the 10 required
    // substrings — if even one marker is absent from the installed
    // definition, the check must fail, never silently pass because the
    // other nine matched.
    function passesCriticalProtections(markersPresent) {
      return markersPresent.every(Boolean);
    }
    const allPresent = new Array(10).fill(true);
    expect(passesCriticalProtections(allPresent)).toBe(true);
    for (let i = 0; i < allPresent.length; i++) {
      const missingOne = [...allPresent];
      missingOne[i] = false; // e.g. a stale definition still missing the v_price_fields_changed guard
      expect(passesCriticalProtections(missingOne)).toBe(false);
    }
  });
});

describe("verify file: existing price RPC — exact signature, and the USD default verified separately from identity", () => {
  it("requires name_matches = 1 AND exact_matches = 1 for the price RPC too", () => {
    const idx = verifyCode.indexOf("'price_rpc_exact_signature'");
    expect(idx).toBeGreaterThan(-1);
    const passLine = verifyCode.slice(idx, verifyCode.indexOf("then 'PASS'", idx));
    expect(passLine).toContain("price_rpc_name_matches = 1");
    expect(passLine).toContain("price_rpc_exact_matches = 1");
  });

  it("the identity-arguments comparison omits DEFAULT — pg_get_function_identity_arguments never includes it", () => {
    expect(verifyCode).toContain(
      "pg_get_function_identity_arguments(p.oid) = 'p_service_id uuid, p_admin_id uuid, p_pricing_type text, p_fixed_price numeric, p_price_min numeric, p_price_max numeric, p_currency text'"
    );
    expect(verifyCode).not.toMatch(/pg_get_function_identity_arguments\([^)]*\)\s*=\s*'[^']*DEFAULT/);
  });

  it("the currency default is checked separately via pg_get_function_arguments + pronargdefaults, both required together", () => {
    expect(verifyCode).toContain("price_rpc_currency_default");
    expect(verifyCode).toContain("pg_get_function_arguments(p.oid)");
    expect(verifyCode).toContain("p.pronargdefaults");
    expect(verifyCode).toContain(
      "price_rpc_full_args = 'p_service_id uuid, p_admin_id uuid, p_pricing_type text, p_fixed_price numeric, p_price_min numeric, p_price_max numeric, p_currency text DEFAULT ''USD''::text'"
    );
    expect(verifyCode).toContain("price_rpc_nargdefaults = 1");
  });
});

describe("verify file: OVERALL STATUS is computed, PASS only if every prior check passed", () => {
  it("uses bool_or(status = 'FAIL') over the checks CTE — a single FAIL anywhere fails the summary", () => {
    const overallIdx = verifyCode.indexOf("overall as (");
    expect(overallIdx).toBeGreaterThan(-1);
    const block = verifyCode.slice(overallIdx, verifyCode.indexOf(")\nselect check_name", overallIdx) || verifyCode.length);
    expect(block).toContain("bool_or(status = 'FAIL')");
    expect(block).toContain("from checks");
  });

  it("does not claim a POST-MIGRATION SUMMARY with columns it no longer computes — replaced by the same check_name/status/details/OVERALL STATUS shape as the preflight", () => {
    expect(verify).not.toContain("POST-MIGRATION SUMMARY");
    expect(verify).not.toContain("overall_status");
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
