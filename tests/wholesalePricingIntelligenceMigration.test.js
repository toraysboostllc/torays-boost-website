import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const supabaseDir = join(__dirname, "..", "supabase");
const migration = readFileSync(join(supabaseDir, "wholesale-pricing-intelligence-migration.sql"), "utf8");
const preflight = readFileSync(join(supabaseDir, "wholesale-pricing-intelligence-preflight.sql"), "utf8");
const verify = readFileSync(join(supabaseDir, "wholesale-pricing-intelligence-verify.sql"), "utf8");
const rollback = readFileSync(join(supabaseDir, "wholesale-pricing-intelligence-rollback.sql"), "utf8");

/** Same comment-stripping helper as wholesaleImagesMigration.test.js —
 *  duplicated on purpose, same reasoning: no shared test-utility module
 *  exists in this repo yet, and these files are small enough that adding
 *  one isn't worth it. */
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

/**
 * Text-based structural checks — there's no live Postgres here, so these
 * can't prove the SQL actually runs (that only happens once it's really
 * executed against Supabase, still not done at the time these tests were
 * written). What they DO prove: the file contains exactly the additive
 * objects the approved plan calls for, with the idempotency/security guards
 * every prior wholesale migration in this repo already established — and,
 * just as importantly, that it does NOT touch the objects the plan
 * explicitly said to leave alone (wholesale_update_service_price's
 * signature, wholesale_equipment_types/wholesale_categories relations,
 * the `active` column's meaning).
 */

describe("migration file: wrapping and idempotency", () => {
  it("is wrapped in an explicit transaction", () => {
    const lines = migration.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines.indexOf("commit;")).toBeGreaterThan(0);
  });

  it("creates wholesale_portal_settings as a singleton table (pinned id=1, CHECK enforced)", () => {
    expect(migrationCode).toMatch(/create table if not exists wholesale_portal_settings/);
    expect(migrationCode).toMatch(/id int primary key default 1 check \(id = 1\)/);
    expect(migrationCode).toMatch(/insert into wholesale_portal_settings \(id\) values \(1\)\s*on conflict \(id\) do nothing/);
  });

  it("adds recommended_price and target_margin_percent to wholesale_services with ADD COLUMN IF NOT EXISTS", () => {
    expect(migrationCode).toMatch(/alter table wholesale_services add column if not exists recommended_price numeric\(10, 2\)/);
    expect(migrationCode).toMatch(/alter table wholesale_services add column if not exists target_margin_percent numeric\(5, 2\)/);
  });

  it("adds all 4 pricing-intelligence columns to wholesale_price_history with ADD COLUMN IF NOT EXISTS", () => {
    for (const col of ["old_recommended_price", "new_recommended_price", "old_target_margin_percent", "new_target_margin_percent"]) {
      expect(migrationCode).toMatch(new RegExp(`alter table wholesale_price_history add column if not exists ${col}`));
    }
  });

  it("every 'add constraint <name>' is preceded by a matching 'drop constraint if exists <name>'", () => {
    const addMatches = [...migrationCode.matchAll(/add constraint (\w+)/g)].map((m) => m[1]);
    expect(addMatches.length).toBeGreaterThanOrEqual(2);
    for (const name of addMatches) {
      expect(migrationCode, `constraint "${name}" has no matching DROP ... IF EXISTS before it`).toMatch(
        new RegExp(`drop constraint if exists ${name}`)
      );
    }
  });

  it("target_margin_percent CHECK constraint rejects >= 100 and negative values", () => {
    expect(migrationCode).toMatch(
      /check \(target_margin_percent is null or \(target_margin_percent >= 0 and target_margin_percent < 100\)\)/
    );
  });

  it("recommended_price CHECK constraint rejects negative values, allows null", () => {
    expect(migrationCode).toMatch(/check \(recommended_price is null or recommended_price >= 0\)/);
  });

  it("rounding_rule CHECK constraint is limited to the 4 approved options", () => {
    expect(migrationCode).toMatch(/rounding_rule text not null default 'nearest_1'/);
    expect(migrationCode).toMatch(/check \(rounding_rule in \('none', 'nearest_1', 'nearest_5', 'charm_99'\)\)/);
  });

  it("default_target_margin_percent defaults to 40 and is bounded [0, 100)", () => {
    expect(migrationCode).toMatch(/default_target_margin_percent numeric\(5, 2\) not null default 40/);
    expect(migrationCode).toMatch(
      /check \(default_target_margin_percent >= 0 and default_target_margin_percent < 100\)/
    );
  });

  it("sales module fields default to visible + maintenance + entry blocked", () => {
    expect(migrationCode).toMatch(/sales_visible boolean not null default true/);
    expect(migrationCode).toMatch(/sales_status text not null default 'maintenance'/);
    expect(migrationCode).toMatch(/sales_entry_blocked boolean not null default true/);
  });
});

describe("migration file: never touches what the plan said to leave alone", () => {
  it("never modifies wholesale_update_service_price (no 'create or replace function wholesale_update_service_price(' for the price RPC)", () => {
    // The new RPC name contains this as a substring
    // (wholesale_update_service_pricing_intelligence), so match the exact
    // old signature's opening line, not just the name fragment.
    expect(migrationCode).not.toMatch(/create or replace function wholesale_update_service_price\(/);
  });

  it("never creates a sibling pricing-intelligence RPC — recommended_price/target_margin_percent are saved exclusively via wholesale_update_service_full", () => {
    expect(migrationCode).not.toMatch(/wholesale_update_service_pricing_intelligence/);
  });

  it("never touches wholesale_equipment_types or wholesale_categories.equipment_type_id", () => {
    expect(migrationCode).not.toMatch(/alter table wholesale_equipment_types/);
    expect(migrationCode).not.toMatch(/alter table wholesale_categories/);
    expect(migrationCode).not.toMatch(/equipment_type_id/);
  });

  it("never adds a status/draft/published column to wholesale_categories or wholesale_services", () => {
    expect(migrationCode).not.toMatch(/add column if not exists status/);
    expect(migrationCode).not.toMatch(/'draft'/);
    expect(migrationCode).not.toMatch(/'published'/);
  });

  it("never adds an updated_by column to wholesale_categories or wholesale_services", () => {
    expect(migrationCode).not.toMatch(/wholesale_services add column if not exists updated_by/);
    expect(migrationCode).not.toMatch(/wholesale_categories add column if not exists updated_by/);
  });

  it("contains no DELETE, DROP TABLE, or DROP COLUMN statement", () => {
    expect(migrationCode.toLowerCase()).not.toMatch(/\bdelete from\b/);
    expect(migrationCode.toLowerCase()).not.toMatch(/\bdrop table\b/);
    expect(migrationCode.toLowerCase()).not.toMatch(/\bdrop column\b/);
  });
});

describe("migration file: security posture matches every existing wholesale RPC/table", () => {
  it("the new RPC is SECURITY INVOKER with search_path pinned", () => {
    const rpcBlocks = migrationCode.split("create or replace function").slice(1);
    expect(rpcBlocks.length).toBe(1);
    for (const block of rpcBlocks) {
      expect(block).toContain("security invoker");
      expect(block).toContain("set search_path = public, pg_temp");
    }
  });

  it("the new RPC validates the admin against profiles(role='admin', status='approved') before writing", () => {
    expect(migrationCode).toMatch(
      /select 1 from profiles where id = p_admin_id and role = 'admin' and status = 'approved'/g
    );
    expect((migrationCode.match(/role = 'admin' and status = 'approved'/g) || []).length).toBe(1);
  });

  it("EXECUTE on the new RPC is revoked from public/anon/authenticated and granted only to service_role", () => {
    expect(migrationCode).toContain(
      "revoke execute on function wholesale_update_portal_settings(uuid, numeric, text, boolean, text, boolean) from public, anon, authenticated;"
    );
    expect(migrationCode).toContain(
      "grant execute on function wholesale_update_portal_settings(uuid, numeric, text, boolean, text, boolean) to service_role;"
    );
  });

  it("the RPC uses SELECT ... FOR UPDATE for row-lock concurrency safety", () => {
    expect((migrationCode.match(/for update;/g) || []).length).toBe(1);
  });

  it("the RPC has a no-op guard returning 'unchanged' before writing", () => {
    expect((migrationCode.match(/return 'unchanged';/g) || []).length).toBe(1);
    expect((migrationCode.match(/return 'updated';/g) || []).length).toBe(1);
  });

  it("explicitly NULL-checks every non-numeric-checked parameter (rounding_rule, sales_visible, sales_status, sales_entry_blocked)", () => {
    expect(migrationCode).toMatch(/p_rounding_rule is null or p_rounding_rule not in/);
    expect(migrationCode).toMatch(/if p_sales_visible is null then/);
    expect(migrationCode).toMatch(/p_sales_status is null or p_sales_status not in/);
    expect(migrationCode).toMatch(/if p_sales_entry_blocked is null then/);
  });

  it("raises settings_row_missing if the singleton row is not found after the row lock, and never returns before that check", () => {
    const lockIdx = migrationCode.indexOf("select * into v_old from wholesale_portal_settings where id = 1 for update");
    const notFoundIdx = migrationCode.indexOf("if not found then", lockIdx);
    const raiseIdx = migrationCode.indexOf("raise exception 'settings_row_missing'", notFoundIdx);
    expect(lockIdx).toBeGreaterThan(-1);
    expect(notFoundIdx).toBeGreaterThan(lockIdx);
    expect(raiseIdx).toBeGreaterThan(notFoundIdx);
  });

  it("wholesale_portal_settings has RLS enabled with zero policies (deny-all-except-service_role)", () => {
    expect(migrationCode).toContain("alter table wholesale_portal_settings enable row level security;");
    expect(migrationCode).not.toMatch(/create policy .* on wholesale_portal_settings/);
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

  it("checks that the existing price RPC is untouched, not just that pricing-intelligence objects are new", () => {
    expect(preflight).toContain("existing_price_rpc_untouched");
    expect(preflight).toContain("wholesale_update_service_price");
  });
});

const preflightCode = stripComments(preflight);

describe("preflight file: metadata-only — every check must survive running BEFORE any pricing-intelligence column exists", () => {
  // Regression coverage for a real bug: the original preflight ran
  // `select count(*) from wholesale_services where recommended_price is not
  // null` directly. Postgres resolves every column reference at parse/plan
  // time regardless of whether any row would match, so on a database that
  // has never run this migration (recommended_price doesn't exist yet) that
  // query fails outright with "column does not exist" — the preflight would
  // error out before ever producing its OVERALL STATUS row, defeating its
  // entire purpose. It also used to run a bare `select count(*) from
  // wholesale_services` to report service counts — if wholesale_services
  // itself didn't exist, THAT query would also fail before the CTE could
  // ever reach the row reporting FAIL for the missing table. Both classes
  // of bug are impossible if every check is metadata-only (information_
  // schema / pg_catalog), which is what these tests lock in.

  it("never has a direct FROM against wholesale_services, wholesale_price_history, wholesale_portal_settings, or profiles — only their names as string literals inside information_schema lookups", () => {
    expect(preflightCode).not.toMatch(/from wholesale_services\b/);
    expect(preflightCode).not.toMatch(/from wholesale_price_history\b/);
    expect(preflightCode).not.toMatch(/from wholesale_portal_settings\b/);
    expect(preflightCode).not.toMatch(/from profiles\b/);
  });

  it("never references recommended_price/target_margin_percent as a real column — only as a column_name string literal", () => {
    expect(preflightCode).not.toMatch(/where recommended_price\b/);
    expect(preflightCode).not.toMatch(/where target_margin_percent\b/);
    expect(preflightCode).not.toMatch(/recommended_price is not null/);
    expect(preflightCode).not.toMatch(/target_margin_percent is not null/);
    // the only legitimate appearances are as quoted column_name values
    expect(preflightCode).toContain("column_name = 'recommended_price'");
    expect(preflightCode).toContain("column_name = 'target_margin_percent'");
  });

  it("never runs a bare count(*) against any wholesale_ table", () => {
    expect(preflightCode.toLowerCase()).not.toMatch(/count\(\*\)\s*\)?\s*from\s+wholesale_/);
  });

  it("no longer computes the recommended_price/target_margin_percent row counts — that lives exclusively in the verify file now", () => {
    expect(preflightCode).not.toContain("services_with_manual_recommended_price");
    expect(preflightCode).not.toContain("services_with_target_margin");
    expect(preflightCode).not.toContain("total_services");
    expect(verify).toContain("services_with_recommended_price");
    expect(verify).toContain("services_with_target_margin");
  });

  it("every information_schema.tables/columns lookup is scoped to table_schema = 'public'", () => {
    const blocks = preflightCode.match(/information_schema\.(?:tables|columns)[\s\S]{0,160}?\)/g) || [];
    expect(blocks.length).toBeGreaterThanOrEqual(8); // 4 table checks + 6 column checks, generously bounded
    for (const block of blocks) {
      expect(block, `missing table_schema = 'public' guard near: ${block.slice(0, 80)}`).toMatch(/table_schema = 'public'/);
    }
  });

  it("every pg_proc function lookup joins pg_namespace and restricts to nspname = 'public'", () => {
    const blocks = preflightCode.match(/from pg_proc[\s\S]{0,220}?\)/g) || [];
    expect(blocks.length).toBe(2); // portal-settings RPC, existing price RPC
    for (const block of blocks) {
      expect(block).toContain("pg_namespace");
      expect(block).toContain("nspname = 'public'");
    }
  });

  it("checks all 4 pricing-intelligence history columns individually", () => {
    for (const col of ["old_recommended_price", "new_recommended_price", "old_target_margin_percent", "new_target_margin_percent"]) {
      expect(preflightCode).toContain(`column_name = '${col}'`);
    }
  });

  it("the file never claims to use pg_constraint anywhere, comments included — it only ever uses information_schema and pg_proc/pg_namespace", () => {
    expect(preflight).not.toContain("pg_constraint");
  });

  it("is still a single statement (one chain of CTEs, one final SELECT) and remains read-only", () => {
    // Multiple `select` keywords are expected (each CTE, each UNION ALL
    // branch) — this just confirms the file is still one WITH...SELECT
    // statement, not several statements separated by semicolons.
    const selects = preflightCode.match(/\bselect\b/gi) || [];
    const statementTerminators = (preflightCode.match(/;/g) || []).length;
    expect(statementTerminators).toBe(1);
    expect(selects.length).toBeGreaterThan(1);
  });
});

describe("preflight file: check 3 correctly distinguishes 'no history columns at all' from 'some but not all' — regression for a real bug", () => {
  // The bug: a single `history_has_pricing_intelligence_columns` flag (AND
  // of all 4 columns) was TRUE only when all 4 existed, but the "nothing
  // exists yet" PASS branch checked its NEGATION — which is true whenever
  // FEWER THAN 4 exist, i.e. also true for 1, 2, or 3. A database with
  // exactly one stray history column (and every other new object absent)
  // would satisfy that branch and be misreported as "PASS — none of the
  // new objects exist yet", when in fact something partial exists. Fixed
  // by splitting into two flags — history_has_all_pricing_intelligence_columns
  // (AND, required for "fully applied") and
  // history_has_any_pricing_intelligence_column (OR, whose negation is
  // required for "nothing exists yet") — so a partial state satisfies
  // neither PASS branch and correctly falls through to REVIEW REQUIRED.

  it("the old ambiguous flag name is gone completely — only the _all/_any pair remains", () => {
    expect(preflightCode).not.toMatch(/\bhistory_has_pricing_intelligence_columns\b/);
    expect(preflightCode).toContain("history_has_all_pricing_intelligence_columns");
    expect(preflightCode).toContain("history_has_any_pricing_intelligence_column");
  });

  it("history_has_all_pricing_intelligence_columns is the AND (never OR) of all 4 individual flags", () => {
    const derivedStart = preflightCode.indexOf("derived as (");
    const allAliasEnd = preflightCode.indexOf("as history_has_all_pricing_intelligence_columns");
    expect(derivedStart).toBeGreaterThan(-1);
    expect(allAliasEnd).toBeGreaterThan(derivedStart);
    const region = preflightCode.slice(derivedStart, allAliasEnd);
    for (const col of [
      "history_has_old_recommended_price",
      "history_has_new_recommended_price",
      "history_has_old_target_margin_percent",
      "history_has_new_target_margin_percent",
    ]) {
      expect(region).toContain(col);
    }
    expect(region).toMatch(/\band\b/);
    expect(region).not.toMatch(/\bor\b/);
  });

  it("history_has_any_pricing_intelligence_column is the OR (never AND) of all 4 individual flags", () => {
    const allAliasEnd = preflightCode.indexOf("as history_has_all_pricing_intelligence_columns");
    const anyAliasEnd = preflightCode.indexOf("as history_has_any_pricing_intelligence_column");
    expect(allAliasEnd).toBeGreaterThan(-1);
    expect(anyAliasEnd).toBeGreaterThan(allAliasEnd);
    const region = preflightCode.slice(allAliasEnd, anyAliasEnd);
    for (const col of [
      "history_has_old_recommended_price",
      "history_has_new_recommended_price",
      "history_has_old_target_margin_percent",
      "history_has_new_target_margin_percent",
    ]) {
      expect(region).toContain(col);
    }
    expect(region).toMatch(/\bor\b/);
    expect(region).not.toMatch(/\band\b/);
  });

  it("the 'fully applied' PASS branch (both status and details CASE) requires the ALL flag, never the ANY flag", () => {
    const branches = preflightCode.match(/when settings_table_exists[\s\S]{0,220}?then '[^']*'/g) || [];
    expect(branches.length).toBe(2); // one in the status CASE, one in the details CASE
    for (const branch of branches) {
      expect(branch).toContain("history_has_all_pricing_intelligence_columns");
      expect(branch).not.toContain("history_has_any_pricing_intelligence_column");
    }
  });

  it("the 'nothing exists yet' PASS branch (both status and details CASE) requires NOT the ANY flag, never the ALL flag", () => {
    const branches = preflightCode.match(/when not settings_table_exists[\s\S]{0,260}?then '[^']*'/g) || [];
    expect(branches.length).toBe(2); // one in the status CASE, one in the details CASE
    for (const branch of branches) {
      expect(branch).toContain("not history_has_any_pricing_intelligence_column");
      expect(branch).not.toContain("history_has_all_pricing_intelligence_columns");
    }
  });

  it("the partial-state details string reports all 4 individual history flags by name, not just an aggregate", () => {
    const detailsIdx = preflightCode.indexOf("'partial state —");
    const detailsEnd = preflightCode.indexOf("from derived", detailsIdx);
    expect(detailsIdx).toBeGreaterThan(-1);
    expect(detailsEnd).toBeGreaterThan(detailsIdx);
    const details = preflightCode.slice(detailsIdx, detailsEnd);
    for (const col of [
      "history_has_old_recommended_price",
      "history_has_new_recommended_price",
      "history_has_old_target_margin_percent",
      "history_has_new_target_margin_percent",
    ]) {
      expect(details).toContain(col);
    }
  });

  // A small, self-contained truth-table simulation of the design documented
  // above — not a substitute for testing the real SQL against real
  // Postgres (no live database exists in this test environment), but it
  // locks in the CORRECT all/any boolean semantics independently of the
  // structural checks above, so a future edit that keeps the right flag
  // NAMES but reintroduces wrong AND/OR logic would still be caught here.
  function classify(flags) {
    const all = flags.every(Boolean);
    const any = flags.some(Boolean);
    if (all) return "PASS_applied";
    if (!any) return "PASS_clean";
    return "REVIEW_REQUIRED";
  }
  const O = false, X = true; // small readability aid for the truth table below

  it("exactly one history column present (each of the 4, individually) => REVIEW REQUIRED, never mistaken for clean", () => {
    expect(classify([X, O, O, O])).toBe("REVIEW_REQUIRED"); // only old_recommended_price
    expect(classify([O, X, O, O])).toBe("REVIEW_REQUIRED"); // only new_recommended_price
    expect(classify([O, O, X, O])).toBe("REVIEW_REQUIRED"); // only old_target_margin_percent
    expect(classify([O, O, O, X])).toBe("REVIEW_REQUIRED"); // only new_target_margin_percent
  });

  it("any pair or trio of the 4 columns => REVIEW REQUIRED", () => {
    expect(classify([X, X, O, O])).toBe("REVIEW_REQUIRED");
    expect(classify([X, O, X, O])).toBe("REVIEW_REQUIRED");
    expect(classify([O, X, O, X])).toBe("REVIEW_REQUIRED");
    expect(classify([O, X, X, X])).toBe("REVIEW_REQUIRED");
    expect(classify([X, X, X, O])).toBe("REVIEW_REQUIRED");
  });

  it("none of the 4 columns => clean (PASS, 'nothing exists yet')", () => {
    expect(classify([O, O, O, O])).toBe("PASS_clean");
  });

  it("all 4 columns => applied (PASS, 'already ran')", () => {
    expect(classify([X, X, X, X])).toBe("PASS_applied");
  });
});

const verifyCode = stripComments(verify);

describe("verify file: read-only, single consolidated result — same convention as the preflight", () => {
  it("contains no write/DDL statement anywhere", () => {
    const forbidden = ["insert into", "update ", "delete from", "alter table", "create table", "drop table", "create or replace function"];
    const lower = verify.toLowerCase();
    for (const kw of forbidden) {
      expect(lower, `verify contains forbidden keyword "${kw}"`).not.toContain(kw);
    }
  });

  it("produces exactly one final SELECT with check_name/status/details columns and an OVERALL STATUS row", () => {
    expect(verify).toContain("'OVERALL STATUS'");
    expect(verify).toMatch(/select check_name, status, details/);
    expect(verify).toMatch(/order by ord;\s*$/);
  });

  it("is a single statement — exactly one semicolon outside of any string literal", () => {
    // Strip SQL string literals ('...', with '' as the escaped-quote form)
    // before counting — a semicolon inside a details message (plain text
    // shown to whoever runs this file) is not a second statement.
    const withoutStringLiterals = verifyCode.replace(/'(?:[^']|'')*'/g, "''");
    const statementTerminators = (withoutStringLiterals.match(/;/g) || []).length;
    expect(statementTerminators).toBe(1);
  });

  it("never mentions the removed sibling RPC anywhere, comments included", () => {
    expect(verify).not.toContain("wholesale_update_service_pricing_intelligence");
  });
});

describe("verify file: every metadata lookup is schema-qualified to public", () => {
  it("every information_schema.tables/columns check is scoped to table_schema = 'public'", () => {
    const blocks = verifyCode.match(/information_schema\.columns[\s\S]{0,160}?\)/g) || [];
    expect(blocks.length).toBeGreaterThanOrEqual(14); // 2 services columns + 4 history columns x2 fields each, generously bounded
    for (const block of blocks) {
      expect(block, `missing table_schema = 'public' guard near: ${block.slice(0, 80)}`).toMatch(/table_schema = 'public'/);
    }
  });

  it("every pg_proc function lookup joins pg_namespace and restricts to nspname = 'public'", () => {
    const blocks = verifyCode.match(/from pg_proc[\s\S]{0,260}?\)/g) || [];
    // settings: name-count, exact-match count, oid lookup (3)
    // price: name-count, identity exact-match count, full-args lookup, pronargdefaults lookup (4)
    expect(blocks.length).toBe(7);
    for (const block of blocks) {
      expect(block).toContain("pg_namespace");
      expect(block).toContain("nspname = 'public'");
    }
  });

  it("the pg_class RLS check joins pg_namespace and restricts to nspname = 'public'", () => {
    const idx = verifyCode.indexOf("pg_class");
    expect(idx).toBeGreaterThan(-1);
    const block = verifyCode.slice(idx, verifyCode.indexOf(")", idx) + 1);
    expect(block).toContain("pg_namespace");
    expect(block).toContain("nspname = 'public'");
  });

  it("the pg_policies check is scoped to schemaname = 'public'", () => {
    expect(verifyCode).toMatch(/pg_policies\s+where\s+schemaname = 'public'/);
  });

  it("uses fully schema-qualified references for every direct table touch", () => {
    expect(verifyCode).toContain("public.wholesale_portal_settings");
    expect(verifyCode).toContain("public.wholesale_services");
    expect(verifyCode).toContain("public.wholesale_price_history");
    expect(verifyCode).toContain("'public.wholesale_services'::regclass");
  });
});

describe("verify file: settings singleton row", () => {
  it("checks the row count is exactly 1 and id = 1, as its own structural (non-tiered) check", () => {
    expect(verifyCode).toContain("settings_singleton_row");
    expect(verifyCode).toMatch(/settings_total_rows = 1 and settings_id1_rows = 1/);
  });

  it("checks the fresh-migration default values as a SEPARATE, tiered check (REVIEW REQUIRED, not FAIL, when they differ)", () => {
    const idx = verifyCode.indexOf("'settings_initial_values'");
    expect(idx).toBeGreaterThan(-1);
    const block = verifyCode.slice(idx, verifyCode.indexOf("from raw", idx));
    expect(block).toContain("settings_margin = 40");
    expect(block).toContain("settings_rounding_rule = 'nearest_1'");
    expect(block).toContain("settings_sales_visible = true");
    expect(block).toContain("settings_sales_status = 'maintenance'");
    expect(block).toContain("settings_sales_entry_blocked = true");
    expect(block).toContain("'REVIEW REQUIRED'");
    // A legitimate DESK edit must never be reported as FAIL — only the
    // "no row at all" branch may fall through to FAIL.
    expect(block).not.toMatch(/then 'FAIL'/);
  });
});

describe("verify file: individual column checks — 2 services + 4 history, never one combined aggregate, precision/scale included", () => {
  it("checks recommended_price and target_margin_percent individually, each requiring numeric(precision,scale)/nullable/no-default", () => {
    for (const check of ["services_recommended_price_column", "services_target_margin_percent_column"]) {
      expect(verifyCode).toContain(check);
    }
    const matches = verifyCode.match(/data_type = 'numeric' and \w+_is_nullable = 'YES' and \w+_column_default is null and \w+_precision = \d+ and \w+_scale = 2/g) || [];
    expect(matches.length).toBe(2);
    expect(verifyCode).toContain("rp_precision = 10 and rp_scale = 2");
    expect(verifyCode).toContain("tmp_precision = 5 and tmp_scale = 2");
  });

  it("checks all 4 pricing-intelligence history columns individually, each requiring numeric(precision,scale)/nullable", () => {
    for (const check of [
      "history_old_recommended_price_column",
      "history_new_recommended_price_column",
      "history_old_target_margin_percent_column",
      "history_new_target_margin_percent_column",
    ]) {
      expect(verifyCode).toContain(check);
    }
    // The two "_price" history columns are (10,2), the two "_percent" ones are (5,2)
    expect(verifyCode).toContain("h_orp_precision = 10 and h_orp_scale = 2");
    expect(verifyCode).toContain("h_nrp_precision = 10 and h_nrp_scale = 2");
    expect(verifyCode).toContain("h_otmp_precision = 5 and h_otmp_scale = 2");
    expect(verifyCode).toContain("h_ntmp_precision = 5 and h_ntmp_scale = 2");
  });
});

describe("verify file: RPC exact-signature checks — require exactly one function by name AND an exact identity match, an overload never silently passes", () => {
  it("the settings RPC check requires name_matches = 1 AND exact_matches = 1, not either alone", () => {
    expect(verifyCode).toContain("settings_rpc_exact_signature");
    const idx = verifyCode.indexOf("'settings_rpc_exact_signature'");
    const passLine = verifyCode.slice(idx, verifyCode.indexOf("then 'PASS'", idx));
    expect(passLine).toContain("settings_rpc_name_matches = 1");
    expect(passLine).toContain("settings_rpc_exact_matches = 1");
    expect(verifyCode).toContain(
      "pg_get_function_identity_arguments(p.oid) = 'p_admin_id uuid, p_default_target_margin_percent numeric, p_rounding_rule text, p_sales_visible boolean, p_sales_status text, p_sales_entry_blocked boolean'"
    );
    expect(verifyCode).toContain("name alone is never treated as a match");
    expect(verifyCode).toContain("an unexpected overload must never silently pass this check");
  });

  it("the price RPC check requires name_matches = 1 AND exact_matches = 1, comparing identity arguments WITHOUT a DEFAULT clause", () => {
    expect(verifyCode).toContain("price_rpc_exact_signature");
    const idx = verifyCode.indexOf("'price_rpc_exact_signature'");
    const passLine = verifyCode.slice(idx, verifyCode.indexOf("then 'PASS'", idx));
    expect(passLine).toContain("price_rpc_name_matches = 1");
    expect(passLine).toContain("price_rpc_exact_matches = 1");
    // Regression: pg_get_function_identity_arguments omits default values —
    // comparing it against a string WITH a DEFAULT clause could never match.
    expect(verifyCode).toContain(
      "pg_get_function_identity_arguments(p.oid) = 'p_service_id uuid, p_admin_id uuid, p_pricing_type text, p_fixed_price numeric, p_price_min numeric, p_price_max numeric, p_currency text'"
    );
    expect(verifyCode).not.toMatch(/pg_get_function_identity_arguments\([^)]*\)\s*=\s*'[^']*DEFAULT/);
  });

  it("a name-only match is distinguished from 'not found at all' and from 'multiple overloads' in the details text", () => {
    expect(verifyCode).toContain("does not exist at all");
    expect(verifyCode).toContain("argument list does not match the expected signature");
    expect(verifyCode).toContain("functions named wholesale_update_portal_settings exist in public");
    expect(verifyCode).toContain("functions named wholesale_update_service_price exist in public");
  });
});

describe("verify file: price RPC currency default — verified separately from the identity signature, via two independent signals", () => {
  it("uses pg_get_function_arguments (full args, defaults included) compared against the exact expected string", () => {
    expect(verifyCode).toContain("price_rpc_currency_default");
    expect(verifyCode).toContain("pg_get_function_arguments(p.oid)");
    expect(verifyCode).toContain(
      "price_rpc_full_args = 'p_service_id uuid, p_admin_id uuid, p_pricing_type text, p_fixed_price numeric, p_price_min numeric, p_price_max numeric, p_currency text DEFAULT ''USD''::text'"
    );
  });

  it("also cross-checks pronargdefaults = 1 as an independent second signal, not full_args alone", () => {
    expect(verifyCode).toContain("p.pronargdefaults");
    expect(verifyCode).toContain("price_rpc_nargdefaults = 1");
  });

  it("depends on the price RPC's exact identity signature already matching — never evaluated in isolation", () => {
    const idx = verifyCode.indexOf("'price_rpc_currency_default'");
    const block = verifyCode.slice(idx, verifyCode.indexOf("then 'PASS'", idx));
    expect(block).toContain("price_rpc_name_matches = 1");
    expect(block).toContain("price_rpc_exact_matches = 1");
  });
});

describe("verify file: EXECUTE grants on the exact-matched RPC — service_role only, PUBLIC included", () => {
  it("checks service_role/anon/authenticated/PUBLIC, using the oid resolved from the exact-signature match", () => {
    expect(verifyCode).toContain("has_function_privilege('service_role', raw.settings_rpc_oid, 'EXECUTE')");
    expect(verifyCode).toContain("has_function_privilege('anon', raw.settings_rpc_oid, 'EXECUTE')");
    expect(verifyCode).toContain("has_function_privilege('authenticated', raw.settings_rpc_oid, 'EXECUTE')");
    expect(verifyCode).toContain("has_function_privilege('public', raw.settings_rpc_oid, 'EXECUTE')");
  });

  it("the grants check fails if the exact-signature RPC wasn't found (or an overload exists), rather than silently passing", () => {
    const idx = verifyCode.indexOf("'settings_rpc_execute_grants'");
    expect(idx).toBeGreaterThan(-1);
    const block = verifyCode.slice(idx, verifyCode.indexOf("from raw, grants", idx));
    expect(block).toContain("settings_rpc_name_matches = 1");
    expect(block).toContain("settings_rpc_exact_matches = 1 and settings_service_role_can_execute");
  });
});

describe("verify file: CHECK constraints verified by condition content, not just by name existing", () => {
  it("looks up each constraint's real definition via pg_get_constraintdef", () => {
    expect(verifyCode).toContain("pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.wholesale_services'::regclass and conname = 'wholesale_services_recommended_price_check'");
    expect(verifyCode).toContain("pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.wholesale_services'::regclass and conname = 'wholesale_services_target_margin_percent_check'");
  });

  it("requires the recommended_price definition to actually allow null or require >= 0, not just exist", () => {
    const idx = verifyCode.indexOf("'services_check_constraints'");
    const block = verifyCode.slice(idx, verifyCode.indexOf("then 'PASS'", idx));
    expect(block).toMatch(/rp_check_def ~\* 'recommended_price\\s\+is\\s\+null'/);
    expect(block).toMatch(/rp_check_def ~\* 'recommended_price\\s\*>=\\s\*\\\(\?0'/);
  });

  it("requires the target_margin_percent definition to actually allow null or require 0 <= value < 100, not just exist", () => {
    const idx = verifyCode.indexOf("'services_check_constraints'");
    const block = verifyCode.slice(idx, verifyCode.indexOf("then 'PASS'", idx));
    expect(block).toMatch(/tmp_check_def ~\* 'target_margin_percent\\s\+is\\s\+null'/);
    expect(block).toMatch(/tmp_check_def ~\* 'target_margin_percent\\s\*>=\\s\*\\\(\?0'/);
    expect(block).toMatch(/tmp_check_def ~\* 'target_margin_percent\\s\*<\\s\*\\\(\?100'/);
  });

  it("still requires both constraints to exist by name (count = 1 each)", () => {
    expect(verifyCode).toContain("rp_check_count = 1 and tmp_check_count = 1");
  });
});

describe("verify file: RLS scoped to public.wholesale_portal_settings only", () => {
  it("requires RLS enabled and zero policies", () => {
    expect(verifyCode).toContain("settings_rls_zero_policies");
    expect(verifyCode).toMatch(/settings_rls_enabled and settings_policy_count = 0/);
  });
});

describe("verify file: pricing-intelligence usage counts are informational only", () => {
  it("the usage check is hardcoded PASS — counts can never cause FAIL or REVIEW REQUIRED", () => {
    const idx = verifyCode.indexOf("'services_pricing_intelligence_usage'");
    expect(idx).toBeGreaterThan(-1);
    const nextComma = verifyCode.indexOf(",", idx + "'services_pricing_intelligence_usage',".length);
    const statusExpr = verifyCode.slice(idx, nextComma + 1);
    expect(statusExpr).toContain("'PASS'");
  });

  it("reports both service-level overrides and the history audit-row count", () => {
    expect(verifyCode).toContain("services_with_recommended_price");
    expect(verifyCode).toContain("services_with_target_margin");
    expect(verifyCode).toContain("history_rows_with_pricing_intelligence");
  });
});

describe("verify file: OVERALL STATUS is computed, never hardcoded", () => {
  it("uses the same 3-tier bool_or(FAIL) / bool_or(REVIEW REQUIRED) / PASS logic as the preflight", () => {
    const overallIdx = verifyCode.indexOf("overall as (");
    expect(overallIdx).toBeGreaterThan(-1);
    const block = verifyCode.slice(overallIdx, verifyCode.indexOf(")\nselect check_name", overallIdx) || verifyCode.length);
    expect(block).toContain("bool_or(status = 'FAIL')");
    expect(block).toContain("bool_or(status = 'REVIEW REQUIRED')");
    expect(block).toContain("from checks");
  });

  it("does not claim to compute anything the summary row doesn't actually check", () => {
    // Regression: the old POST-MIGRATION SUMMARY row named counts it never
    // validated as pass/fail inputs. The new OVERALL STATUS row's message
    // only describes the two real outcomes this file can report.
    expect(verify).not.toContain("POST-MIGRATION SUMMARY");
  });
});

describe("rollback file: reference-only, destructive, reverse order of creation", () => {
  it("is wrapped in an explicit transaction", () => {
    const lines = rollback.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines.indexOf("commit;")).toBeGreaterThan(0);
  });

  it("drops the new RPC by exact signature, and never mentions the removed sibling RPC", () => {
    expect(rollback).toContain("drop function if exists wholesale_update_portal_settings(uuid, numeric, text, boolean, text, boolean);");
    expect(rollback).not.toContain("wholesale_update_service_pricing_intelligence");
  });

  it("drops wholesale_portal_settings entirely", () => {
    expect(rollback).toMatch(/drop table if exists wholesale_portal_settings;/);
  });

  it("never mentions wholesale_update_service_price — this rollback must not be able to touch it", () => {
    expect(rollback).not.toContain("wholesale_update_service_price(");
  });

  it("documents that it is reference-only, never run automatically", () => {
    expect(rollback.toLowerCase()).toContain("reference only");
    expect(rollback.toLowerCase()).toContain("not run automatically");
  });
});
