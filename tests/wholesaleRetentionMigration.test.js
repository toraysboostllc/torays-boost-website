import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const supabaseDir = join(__dirname, "..", "supabase");
const preflight = readFileSync(join(supabaseDir, "wholesale-retention-preflight.sql"), "utf8");
const migration = readFileSync(join(supabaseDir, "wholesale-retention-migration.sql"), "utf8");
const verify = readFileSync(join(supabaseDir, "wholesale-retention-verify.sql"), "utf8");
const rollback = readFileSync(join(supabaseDir, "wholesale-retention-rollback.sql"), "utf8");

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

describe("wholesale-retention-preflight.sql: read-only", () => {
  it("contains no write statement (insert/update/delete/alter/create/drop)", () => {
    expect(preflight).not.toMatch(/\binsert into\b|\bupdate\s+\w+\s+set\b|\bdelete from\b|\balter table\b|\bcreate table\b|\bdrop table\b/i);
  });

  it("checks that wholesale_retention_runs does not already exist", () => {
    expect(preflight).toContain("wholesale_retention_runs");
    expect(preflight).toContain("retention_runs_table_does_not_already_exist");
  });

  it("checks for pre-existing overloads of wholesale_run_data_retention", () => {
    expect(preflight).toContain("retention_rpc_has_no_pre_existing_overload");
    expect(preflight).toContain("pg_proc");
  });

  it("checks prerequisite wholesale_access_log columns (ip/user_agent/created_at)", () => {
    expect(preflight).toContain("access_log_has_ip");
    expect(preflight).toContain("access_log_has_user_agent");
    expect(preflight).toContain("access_log_has_created_at");
  });

  it("ends with an OVERALL STATUS row", () => {
    expect(preflight).toContain("'OVERALL STATUS'");
  });
});

describe("wholesale-retention-migration.sql: wrapping and idempotency", () => {
  it("is wrapped in an explicit begin;/commit; transaction", () => {
    const lines = migration.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines.indexOf("commit;")).toBeGreaterThan(lines.indexOf("begin;"));
  });

  it("creates the audit-log table idempotently", () => {
    expect(migration).toContain("create table if not exists wholesale_retention_runs");
  });

  it("the retention-run audit table requires retention_days > 0, and rows_matched/rows_affected >= 0 (no silent negative/zero-bypass row)", () => {
    expect(migration).toContain("check (retention_days > 0)");
    expect(migration).toContain("check (rows_matched >= 0)");
    expect(migration).toContain("check (rows_affected >= 0)");
  });

  it("wholesale_retention_runs has its own append-only guard trigger, idempotently created (drop if exists before create)", () => {
    expect(migration).toContain("drop trigger if exists trg_wholesale_retention_runs_append_only on wholesale_retention_runs;");
    expect(migration).toContain("create trigger trg_wholesale_retention_runs_append_only");
    expect(migration).toMatch(/before update or delete on wholesale_retention_runs/);
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

  it("rejects a non-positive OR over-the-ceiling retention_days before touching any data", () => {
    const body = functionBody();
    expect(body).toContain("if p_retention_days is null or p_retention_days <= 0 or p_retention_days > 3650 then");
    expect(body).toContain("raise exception 'invalid_retention_days'");
  });

  it("validates the admin the same way every other admin-facing wholesale RPC does (role='admin' and status='approved', re-checked server-side)", () => {
    const body = functionBody();
    expect(body).toMatch(/role = 'admin' and status = 'approved'/);
    expect(body).toContain("raise exception 'invalid_admin'");
  });

  it("the function is SECURITY INVOKER with an explicit search_path, same posture as every other wholesale_* RPC", () => {
    expect(migration).toMatch(/language plpgsql security invoker set search_path = public, pg_temp/);
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

  it("anonymizes (sets ip/user_agent to null) rather than deleting rows — the access-log event/timestamp trail survives, and no DELETE statement exists anywhere in this file", () => {
    const body = functionBody();
    expect(body).toContain("set ip = null, user_agent = null");
    expect(migration).not.toMatch(/^\s*delete\s+from\s/im);
  });

  it("both the RPC and wholesale_retention_runs are service_role-only (revoke public/anon/authenticated, grant service_role)", () => {
    expect(migration).toContain(
      "revoke execute on function public.wholesale_run_data_retention(uuid, integer, boolean)\n  from public, anon, authenticated;"
    );
    expect(migration).toContain(
      "grant execute on function public.wholesale_run_data_retention(uuid, integer, boolean)\n  to service_role;"
    );
    expect(migration).toContain("alter table wholesale_retention_runs enable row level security;");
  });
});

describe("wholesale-retention-verify.sql: wrapped in begin;/rollback; so nothing it does ever persists", () => {
  it("starts with begin; and ends with rollback; (never commit;)", () => {
    const lines = verify.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines[lines.length - 1]).toBe("rollback;");
    expect(verify).not.toMatch(/\ncommit;/);
  });

  it("tags every synthetic row with a unique, unmistakable marker", () => {
    expect(verify).toContain("__wsr_verify__");
  });

  it("checks the RPC has no overloads (count = 1) and the exact expected identity arguments", () => {
    expect(verify).toContain("rpc_exists_exactly_once_no_overloads");
    expect(verify).toContain("p_admin_id uuid, p_retention_days integer, p_dry_run boolean");
  });

  it("checks SECURITY INVOKER (prosecdef=false) and an explicit search_path in proconfig", () => {
    expect(verify).toContain("not p.prosecdef");
    expect(verify).toMatch(/proconfig.*search_path/s);
  });

  it("checks grants are service_role-only", () => {
    expect(verify).toContain("has_function_privilege('service_role'");
    expect(verify).toContain("not has_function_privilege('anon'");
    expect(verify).toContain("not has_function_privilege('authenticated'");
    expect(verify).toContain("not has_function_privilege('public'");
  });

  it("functionally proves dry-run never modifies the matched row and logs rows_affected=0", () => {
    expect(verify).toContain("dry_run_is_fully_read_only");
    expect(verify).toMatch(/rows_affected.*= 0/);
  });

  it("functionally proves a real run anonymizes only the matched old row (never a recent one) and never changes the row count (no DELETE)", () => {
    expect(verify).toContain("real_run_anonymizes_only_old_ip_user_agent_never_deletes");
    expect(verify).toContain("v_count_before = v_count_after");
  });

  it("functionally proves the 3 protected tables are untouched across the whole verify run", () => {
    expect(verify).toContain("never_touches_legal_documents_acceptances_or_price_history");
  });

  it("functionally proves invalid retention_days (null/0/negative/over-max) and an invalid admin are all rejected and write no audit row", () => {
    expect(verify).toContain("invalid_inputs_rejected_and_write_no_audit_row");
    expect(verify).toContain("v_runs_before = v_runs_after");
  });

  it("functionally proves idempotent re-run excludes already-anonymized rows from rows_matched", () => {
    expect(verify).toContain("idempotent_rerun_excludes_already_anonymized_rows");
  });

  it("functionally proves the append-only guard on wholesale_retention_runs itself rejects UPDATE and DELETE", () => {
    expect(verify).toContain("retention_runs_append_only_guard_rejects_update_and_delete");
  });

  it("ends with an OVERALL STATUS row", () => {
    expect(verify).toContain("'OVERALL STATUS'");
  });
});

describe("wholesale-retention-rollback.sql: default path is non-destructive, preserves run records", () => {
  it("Section 1 (the only part that actually executes) drops only the callable function, never wholesale_retention_runs", () => {
    const section1 = rollback.slice(0, rollback.indexOf("-- SECTION 2 — FULLY DESTRUCTIVE. Not executed"));
    expect(section1).toContain("drop function if exists public.wholesale_run_data_retention(uuid, integer, boolean);");
    expect(section1).not.toMatch(/drop table if exists wholesale_retention_runs/);
  });

  it("Section 1 leaves the append-only guard trigger on wholesale_retention_runs enabled — never drops it", () => {
    const section1 = rollback.slice(0, rollback.indexOf("-- SECTION 2 — FULLY DESTRUCTIVE. Not executed"));
    expect(section1).not.toMatch(/drop trigger.*trg_wholesale_retention_runs_append_only/);
  });

  it("the fully destructive Section 2 is commented out (never executes as part of this file)", () => {
    const section2 = rollback.slice(rollback.indexOf("-- SECTION 2 — FULLY DESTRUCTIVE. Not executed"));
    const codeLines = section2.split("\n").filter((l) => l.trim().length > 0 && !l.trim().startsWith("--"));
    expect(codeLines).toHaveLength(0);
  });

  it("Section 2's reference text still documents dropping wholesale_retention_runs and its trigger, for a deliberate full teardown later", () => {
    expect(rollback).toContain("-- drop table if exists wholesale_retention_runs;");
    expect(rollback).toContain("-- drop trigger if exists trg_wholesale_retention_runs_append_only on wholesale_retention_runs;");
  });

  it("carries an explicit DESTRUCTIVE warning for Section 2", () => {
    expect(rollback).toMatch(/DESTRUCTIVE/);
  });

  it("Section 1 is wrapped in begin;/commit;", () => {
    const section1 = rollback.slice(0, rollback.indexOf("-- SECTION 2 — FULLY DESTRUCTIVE. Not executed"));
    const lines = section1.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines.indexOf("commit;")).toBeGreaterThan(lines.indexOf("begin;"));
  });
});
