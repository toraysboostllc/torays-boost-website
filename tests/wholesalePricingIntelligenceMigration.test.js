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

  it("creates wholesale_update_service_pricing_intelligence as a genuinely separate function", () => {
    expect(migrationCode).toMatch(/create or replace function wholesale_update_service_pricing_intelligence\(/);
    expect(migrationCode).toContain("p_recommended_price numeric");
    expect(migrationCode).toContain("p_target_margin_percent numeric");
    expect(migrationCode).not.toContain("p_pricing_type");
    expect(migrationCode).not.toContain("p_fixed_price");
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
  it("both new RPCs are SECURITY INVOKER with search_path pinned", () => {
    const rpcBlocks = migrationCode.split("create or replace function").slice(1);
    expect(rpcBlocks.length).toBe(2);
    for (const block of rpcBlocks) {
      expect(block).toContain("security invoker");
      expect(block).toContain("set search_path = public, pg_temp");
    }
  });

  it("both new RPCs validate the admin against profiles(role='admin', status='approved') before writing", () => {
    expect(migrationCode).toMatch(
      /select 1 from profiles where id = p_admin_id and role = 'admin' and status = 'approved'/g
    );
    expect((migrationCode.match(/role = 'admin' and status = 'approved'/g) || []).length).toBe(2);
  });

  it("EXECUTE on both new RPCs is revoked from public/anon/authenticated and granted only to service_role", () => {
    expect(migrationCode).toContain(
      "revoke execute on function wholesale_update_service_pricing_intelligence(uuid, uuid, numeric, numeric) from public, anon, authenticated;"
    );
    expect(migrationCode).toContain(
      "grant execute on function wholesale_update_service_pricing_intelligence(uuid, uuid, numeric, numeric) to service_role;"
    );
    expect(migrationCode).toContain(
      "revoke execute on function wholesale_update_portal_settings(uuid, numeric, text, boolean, text, boolean) from public, anon, authenticated;"
    );
    expect(migrationCode).toContain(
      "grant execute on function wholesale_update_portal_settings(uuid, numeric, text, boolean, text, boolean) to service_role;"
    );
  });

  it("both RPCs use SELECT ... FOR UPDATE for row-lock concurrency safety", () => {
    expect((migrationCode.match(/for update;/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it("both RPCs have a no-op guard returning 'unchanged' before writing", () => {
    expect((migrationCode.match(/return 'unchanged';/g) || []).length).toBe(2);
    expect((migrationCode.match(/return 'updated';/g) || []).length).toBe(2);
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

describe("verify file: read-only, checks every object the migration creates", () => {
  it("contains no write/DDL statement anywhere", () => {
    const forbidden = ["insert into", "update ", "delete from", "alter table", "create table", "drop table", "create or replace function"];
    const lower = verify.toLowerCase();
    for (const kw of forbidden) {
      expect(lower, `verify contains forbidden keyword "${kw}"`).not.toContain(kw);
    }
  });

  it("confirms the existing wholesale_update_service_price signature is unchanged", () => {
    expect(verify).toContain("wholesale_update_service_price");
    expect(verify).toMatch(/pg_get_function_identity_arguments/);
  });

  it("confirms EXECUTE privileges via has_function_privilege for both new RPCs", () => {
    expect(verify).toContain("has_function_privilege('service_role'");
    expect(verify).toContain("has_function_privilege('anon'");
    expect(verify).toContain("has_function_privilege('authenticated'");
  });

  it("ends with a single-row POST-MIGRATION SUMMARY with an overall_status column", () => {
    expect(verify).toContain("POST-MIGRATION SUMMARY");
    expect(verify).toMatch(/overall_status/);
  });
});

describe("rollback file: reference-only, destructive, reverse order of creation", () => {
  it("is wrapped in an explicit transaction", () => {
    const lines = rollback.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines.indexOf("commit;")).toBeGreaterThan(0);
  });

  it("drops both new RPCs by exact signature", () => {
    expect(rollback).toContain("drop function if exists wholesale_update_portal_settings(uuid, numeric, text, boolean, text, boolean);");
    expect(rollback).toContain("drop function if exists wholesale_update_service_pricing_intelligence(uuid, uuid, numeric, numeric);");
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
