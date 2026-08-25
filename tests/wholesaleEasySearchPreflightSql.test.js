import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { newDb } from "pg-mem";

/**
 * Real SQL execution coverage for wholesale-easy-search-preflight.sql —
 * added after a real Postgres run (Carlos's TEST Supabase project) failed
 * with `ERROR: 42703: column "details" does not exist`, a bug none of the
 * existing tests caught because nothing anywhere in this repo actually
 * EXECUTED this file's SQL before now — every other check on these
 * migration files (wholesaleEasySearchSeedSql.test.js etc.) is structural/
 * textual, never a real SQL engine.
 *
 * pg-mem (github.com/oguimbal/pg-mem) is a real, in-memory Postgres-
 * compatible SQL parser + executor — the closest thing to "real Postgres"
 * available in this sandboxed test environment (no docker/psql/postgres
 * binary here). It is NOT a 100%-faithful Postgres: it implements very few
 * built-in functions (e.g. no to_regclass) and only a thin slice of the
 * system catalogs (e.g. pg_class has no reltuples column here) — which is
 * exactly why wholesale-easy-search-preflight.sql avoids both of those
 * entirely, rather than working around pg-mem's gaps with something real
 * Postgres would accept but this test couldn't verify. Within what it DOES
 * support (information_schema.tables, CTEs, UNION ALL, CASE, boolean/int
 * ::text casts), it enforces real Postgres column-resolution semantics —
 * which is exactly the class of bug this file exists to catch: the exact
 * "column does not exist" error Carlos hit is reproduced verbatim by
 * scenario A below against the UNFIXED file (see git history), and caught
 * by this test now for any future regression.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, "..", "supabase", "wholesale-easy-search-preflight.sql");
const preflightSql = readFileSync(sqlPath, "utf8");

/** Runs the real preflight.sql against a fresh in-memory database prepared
 *  by `setupFn`, returning the row array. Throws (test fails) if the SQL
 *  itself errors — this is the whole point: an execution error here IS a
 *  test failure, not something structural text-matching could ever catch. */
function runPreflight(setupFn) {
  const db = newDb();
  setupFn(db);
  return db.public.many(preflightSql);
}

describe("wholesale-easy-search-preflight.sql: executes without error under real Postgres SQL semantics", () => {
  it("runs successfully against a clean pre-migration database (wholesale_categories exists, Easy Search tables do not) — the exact scenario Carlos's TEST run hit", () => {
    const rows = runPreflight((db) => {
      db.public.none(`create table wholesale_categories (id uuid primary key, name text);`);
    });
    expect(rows.length).toBeGreaterThan(0);
  });

  it("every returned row has all 4 contract columns, never undefined — this is the exact bug that shipped: 'details' was silently absent from the CTE's output column list", () => {
    const rows = runPreflight((db) => {
      db.public.none(`create table wholesale_categories (id uuid primary key, name text);`);
    });
    for (const row of rows) {
      expect(row).toHaveProperty("check_number");
      expect(row).toHaveProperty("check_name");
      expect(row).toHaveProperty("status");
      expect(row).toHaveProperty("details");
      expect(typeof row.details).toBe("string");
      expect(row.details.length).toBeGreaterThan(0);
    }
  });
});

describe("wholesale-easy-search-preflight.sql: PASS/STOP contract across all 3 real scenarios", () => {
  it("clean first run (categories exists, Easy Search tables absent) -> exactly 3 rows, all PASS", () => {
    const rows = runPreflight((db) => {
      db.public.none(`create table wholesale_categories (id uuid primary key, name text);`);
    });
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.check_number)).toEqual([1, 2, 99]);
    expect(rows.every((r) => r.status === "PASS")).toBe(true);
  });

  it("wholesale_categories missing entirely -> check 1 STOP, check 2 PASS, overall STOP — never a crash", () => {
    const rows = runPreflight(() => {});
    expect(rows).toHaveLength(3);
    const byNumber = Object.fromEntries(rows.map((r) => [r.check_number, r.status]));
    expect(byNumber[1]).toBe("STOP");
    expect(byNumber[2]).toBe("PASS");
    expect(byNumber[99]).toBe("STOP");
  });

  it("wholesale_device_models already exists -> check 1 PASS, check 2 STOP, overall STOP", () => {
    const rows = runPreflight((db) => {
      db.public.none(`create table wholesale_categories (id uuid primary key, name text);`);
      db.public.none(`create table wholesale_device_models (id uuid primary key);`);
    });
    const byNumber = Object.fromEntries(rows.map((r) => [r.check_number, r.status]));
    expect(byNumber[1]).toBe("PASS");
    expect(byNumber[2]).toBe("STOP");
    expect(byNumber[99]).toBe("STOP");
  });

  it("wholesale_device_model_codes already exists (the other half of check 2) -> also STOP", () => {
    const rows = runPreflight((db) => {
      db.public.none(`create table wholesale_categories (id uuid primary key, name text);`);
      db.public.none(`create table wholesale_device_model_codes (id uuid primary key);`);
    });
    const byNumber = Object.fromEntries(rows.map((r) => [r.check_number, r.status]));
    expect(byNumber[2]).toBe("STOP");
    expect(byNumber[99]).toBe("STOP");
  });

  it("overall (check 99) is STOP if ANY check is STOP, never averaged/partial-PASS", () => {
    const rows = runPreflight(() => {}); // categories missing -> check 1 STOP alone
    const overall = rows.find((r) => r.check_number === 99);
    expect(overall.status).toBe("STOP");
  });
});
