import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const supabaseDir = join(__dirname, "..", "supabase");
const migration = readFileSync(join(supabaseDir, "wholesale-retention-migration.sql"), "utf8");

/** Isolates the wholesale_run_data_retention function body so the
 *  "never touches the 3 protected tables" checks below can't accidentally
 *  pass just because those table names appear in this file's prose comments
 *  (they do, deliberately, in the header documenting what the procedure
 *  must never touch). */
function functionBody() {
  const match = migration.match(
    /create or replace function public\.wholesale_run_data_retention[\s\S]*?\$\$;/
  );
  expect(match, "wholesale_run_data_retention function definition not found").toBeTruthy();
  return match[0];
}

describe("wholesale-retention-migration.sql: wrapping and safety", () => {
  it("is wrapped in an explicit begin;/commit; transaction", () => {
    const lines = migration.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines.indexOf("commit;")).toBeGreaterThan(lines.indexOf("begin;"));
  });

  it("creates the audit-log table idempotently", () => {
    expect(migration).toContain("create table if not exists wholesale_retention_runs");
  });

  it("the retention-run audit table requires retention_days > 0 (no silent zero/negative row)", () => {
    expect(migration).toContain("check (retention_days > 0)");
  });

  it("p_retention_days has NO default in the function signature — every call must supply it explicitly, matching the 'no baked-in legal period' requirement", () => {
    const signature = migration.match(/create or replace function public\.wholesale_run_data_retention\(([\s\S]*?)\) returns/)[1];
    expect(signature).toContain("p_retention_days integer");
    expect(signature).not.toMatch(/p_retention_days integer\s*default/);
  });

  it("p_dry_run defaults to true — the only default in the signature, and it's a safety default, not a retention-period default", () => {
    const signature = migration.match(/create or replace function public\.wholesale_run_data_retention\(([\s\S]*?)\) returns/)[1];
    expect(signature).toMatch(/p_dry_run boolean default true/);
  });

  it("rejects a non-positive retention_days before touching any data", () => {
    const body = functionBody();
    expect(body).toContain("if p_retention_days is null or p_retention_days <= 0 then");
    expect(body).toContain("raise exception 'invalid_retention_days'");
  });

  it("validates the admin the same way every other admin-facing wholesale RPC does (role='admin' and status='approved', re-checked server-side)", () => {
    const body = functionBody();
    expect(body).toMatch(/role = 'admin' and status = 'approved'/);
    expect(body).toContain("raise exception 'invalid_admin'");
  });

  it("dry-run mode performs no UPDATE — the UPDATE statement is reachable only through the else branch of `if p_dry_run`", () => {
    const body = functionBody();
    const ifIndex = body.indexOf("if p_dry_run then");
    const elseIndex = body.indexOf("else", ifIndex);
    const updateIndex = body.indexOf("update wholesale_access_log");
    expect(ifIndex).toBeGreaterThan(-1);
    expect(updateIndex).toBeGreaterThan(elseIndex);
  });

  it("every call — dry-run or real — inserts exactly one row into wholesale_retention_runs (the operation log)", () => {
    const body = functionBody();
    expect(body).toContain("insert into wholesale_retention_runs");
    // Only one INSERT in the whole function body, positioned after both the
    // dry-run and real branches (i.e. it always runs, not just on one path).
    const inserts = body.match(/insert into wholesale_retention_runs/g);
    expect(inserts.length).toBe(1);
  });

  it("touches ONLY wholesale_access_log — never wholesale_legal_documents, wholesale_legal_acceptances, or wholesale_price_history anywhere in the function body", () => {
    const body = functionBody();
    expect(body).toContain("wholesale_access_log");
    expect(body).not.toContain("wholesale_legal_documents");
    expect(body).not.toContain("wholesale_legal_acceptances");
    expect(body).not.toContain("wholesale_price_history");
  });

  it("anonymizes (sets ip/user_agent to null) rather than deleting rows — the access-log event/timestamp trail survives", () => {
    const body = functionBody();
    expect(body).toContain("set ip = null, user_agent = null");
    expect(body).not.toMatch(/delete\s+from\s+wholesale_access_log/i);
  });

  it("both new database objects are service_role-only (revoke public/anon/authenticated, grant service_role)", () => {
    expect(migration).toContain(
      "revoke execute on function public.wholesale_run_data_retention(uuid, integer, boolean)\n  from public, anon, authenticated;"
    );
    expect(migration).toContain(
      "grant execute on function public.wholesale_run_data_retention(uuid, integer, boolean)\n  to service_role;"
    );
  });

  it("rollback guidance never mentions reverting the append-only guards on the 3 protected tables (this procedure adds no new object to any of them)", () => {
    const rollbackBlock = migration.slice(migration.indexOf("ROLLBACK:"));
    expect(rollbackBlock).not.toContain("wholesale_legal_documents_immutability");
    expect(rollbackBlock).not.toContain("wholesale_price_history_append_only");
  });
});
