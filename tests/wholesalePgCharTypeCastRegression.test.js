import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Regression test for a real production failure: Supabase rejected
 * wholesale-legal-preflight.sql with
 *   ERROR 42725: operator is not unique: unknown || "char"
 * because `coalesce(service_fk_deltype, '(none)')` mixed pg_catalog's
 * internal "char" type (pg_constraint.confdeltype, selected without a cast)
 * with an untyped string literal — Postgres could not pick a single ||
 * operator for the concatenation that followed. The fix casts the value to
 * `text` once, at the source (`confdeltype::text`), so every downstream
 * coalesce/concatenation/comparison operates on a real, unambiguous text
 * value.
 *
 * This file scans all 8 legal-bundle SQL scripts for the whole family of
 * pg_catalog columns backed by the internal "char" type — not just
 * confdeltype — so a future addition (e.g. a check reading
 * pg_class.relkind or pg_proc.provolatile) cannot reintroduce the same bug
 * silently. It strips SQL line comments and single-quoted string literals
 * before scanning, so a column name merely mentioned in prose (comments,
 * descriptive text passed to a result row) never produces a false failure —
 * only a genuine, live SQL reference to the column counts.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const supabaseDir = join(__dirname, "..", "supabase");

const FILES = [
  "wholesale-legal-preflight.sql",
  "wholesale-legal-migration.sql",
  "wholesale-legal-verify.sql",
  "wholesale-legal-rollback.sql",
  "wholesale-retention-preflight.sql",
  "wholesale-retention-migration.sql",
  "wholesale-retention-verify.sql",
  "wholesale-retention-rollback.sql",
];

// The well-known pg_catalog columns backed by the internal "char" type —
// the exact type family that triggers "operator is not unique: unknown ||
// "char"" when concatenated/coalesced with text without an explicit cast.
// (pg_proc.prosecdef, by contrast, is boolean — not in this list, and not
// affected by this bug family.)
const PG_CHAR_TYPE_COLUMNS = [
  "confdeltype",
  "contype",
  "relkind",
  "provolatile",
  "proparallel",
  "prokind",
  "typtype",
  "attidentity",
  "attgenerated",
];

/** Strips `-- ...` line comments and single-quoted string literals (SQL
 *  escapes an embedded quote as '') from a SQL source string, so a column
 *  name that only ever appears in prose can never be mistaken for a live
 *  reference to the actual pg_catalog column. */
function stripSqlCommentsAndStrings(sql) {
  let out = sql.replace(/--[^\n]*/g, "");
  out = out.replace(/'(?:[^']|'')*'/g, "''");
  return out;
}

/** Every live occurrence of a "char"-typed pg_catalog column name must be
 *  immediately followed by `::text` (or another explicit cast) at its
 *  point of selection — this is what actually fixed the production error,
 *  and what must never regress. */
function findUncastCharColumnUsages(strippedSql) {
  const findings = [];
  for (const col of PG_CHAR_TYPE_COLUMNS) {
    const re = new RegExp(`\\b${col}\\b(?!\\s*::)`, "g");
    let m;
    while ((m = re.exec(strippedSql)) !== null) {
      findings.push({ column: col, index: m.index });
    }
  }
  return findings;
}

describe("regression: pg_catalog \"char\"-type columns are always cast to text before use", () => {
  for (const file of FILES) {
    it(`${file}: no uncast reference to any "char"-typed pg_catalog column (confdeltype, relkind, provolatile, etc.)`, () => {
      const raw = readFileSync(join(supabaseDir, file), "utf8");
      const stripped = stripSqlCommentsAndStrings(raw);
      const findings = findUncastCharColumnUsages(stripped);
      expect(
        findings,
        `found uncast "char"-type column reference(s): ${JSON.stringify(findings)} — every occurrence must be written as e.g. "confdeltype::text", never bare, to avoid Postgres error 42725 (operator is not unique: unknown || "char")`
      ).toEqual([]);
    });
  }

  it("wholesale-legal-preflight.sql: the specific line that failed in production now casts confdeltype at the source (service_fk_deltype is derived as text)", () => {
    const preflight = readFileSync(join(supabaseDir, "wholesale-legal-preflight.sql"), "utf8");
    expect(preflight).toContain("select confdeltype::text from pg_constraint");
    expect(preflight).toContain("as service_fk_deltype");
    // The exact expression that raised ERROR 42725 in production — still
    // present (the fix is upstream, not a rewrite of this line), and now
    // safe because service_fk_deltype is real text.
    expect(preflight).toContain("coalesce(service_fk_deltype, '(none)')");
  });

  it("wholesale-legal-verify.sql: the FK-restrict check also casts confdeltype explicitly, not just the preflight file", () => {
    const verify = readFileSync(join(supabaseDir, "wholesale-legal-verify.sql"), "utf8");
    expect(verify).toContain("select confdeltype::text from pg_constraint");
  });
});
