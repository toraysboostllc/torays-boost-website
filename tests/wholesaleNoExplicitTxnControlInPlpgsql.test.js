import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Regression test for a real production failure: Supabase rejected
 * wholesale-legal-verify.sql with
 *   ERROR 42601: syntax error at or near "to"
 * at a `rollback to savepoint ...;` statement inside a DO block. Postgres
 * does not allow SAVEPOINT / ROLLBACK TO SAVEPOINT / COMMIT (or any
 * explicit transaction control statement) inside PL/pgSQL — a DO block or
 * a function body. The correct mechanism for "attempt something, and undo
 * it if it unexpectedly succeeds" inside PL/pgSQL is a nested
 * `begin ... exception ... end` block, which Postgres treats as an
 * implicit subtransaction: entering the EXCEPTION clause (whether from a
 * real error or from a deliberate `raise exception` sentinel) automatically
 * rolls back everything done since that nested block's own BEGIN.
 *
 * This file scans all 8 legal-bundle SQL scripts for SAVEPOINT/ROLLBACK
 * TO/explicit COMMIT appearing INSIDE a `do $$ ... $$` block or a
 * `create or replace function ... $$ ... $$` body — the only place these
 * are actually forbidden. A top-level `begin;`/`commit;`/`rollback;` that
 * wraps an entire script (outside any DO block or function) is normal SQL
 * client-level transaction control and is explicitly allowed — every one
 * of these 8 files legitimately starts with `begin;` and ends with either
 * `commit;` or `rollback;` at the top level.
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

/** Strips `-- ...` line comments and single-quoted string literals (SQL
 *  escapes an embedded quote as ''), so a mention of "savepoint" or
 *  "commit" only in prose (comments explaining this very fix, for example)
 *  is never mistaken for live SQL. */
function stripSqlCommentsAndStrings(sql) {
  let out = sql.replace(/--[^\n]*/g, "");
  out = out.replace(/'(?:[^']|'')*'/g, "''");
  return out;
}

/** Extracts every `do $$ ... $$;` block and every
 *  `create or replace function ... $$ ... $$;` body from a (comment/string
 *  -stripped) SQL source, returning just the PL/pgSQL regions where
 *  transaction control is actually forbidden. */
function extractPlpgsqlRegions(strippedSql) {
  const regions = [];
  const doRe = /do\s+\$\$[\s\S]*?\$\$;/gi;
  let m;
  while ((m = doRe.exec(strippedSql)) !== null) regions.push(m[0]);
  const fnRe = /create or replace function[\s\S]*?\$\$;/gi;
  while ((m = fnRe.exec(strippedSql)) !== null) regions.push(m[0]);
  return regions;
}

describe("regression: no explicit SAVEPOINT / ROLLBACK TO / COMMIT inside any DO block or function body", () => {
  for (const file of FILES) {
    it(`${file}: every do $$ ... $$ block and function body is free of SAVEPOINT/ROLLBACK TO/explicit COMMIT`, () => {
      const raw = readFileSync(join(supabaseDir, file), "utf8");
      const stripped = stripSqlCommentsAndStrings(raw);
      const regions = extractPlpgsqlRegions(stripped);

      const violations = [];
      for (const region of regions) {
        if (/\bsavepoint\b/i.test(region)) violations.push({ region: region.slice(0, 80) + "…", issue: "SAVEPOINT" });
        if (/\brollback\s+to\b/i.test(region)) violations.push({ region: region.slice(0, 80) + "…", issue: "ROLLBACK TO" });
        // A bare "commit;" or "rollback;" (no "to") inside a DO/function
        // body is ALSO invalid PL/pgSQL — explicit transaction control of
        // any kind is disallowed there, not just ROLLBACK TO specifically.
        if (/(?:^|\s);?\s*commit\s*;/im.test(region)) violations.push({ region: region.slice(0, 80) + "…", issue: "explicit COMMIT" });
      }

      expect(
        violations,
        `found explicit transaction control inside a DO block or function body: ${JSON.stringify(violations)} — ` +
          `Postgres rejects this with ERROR 42601 ("syntax error at or near..."); use a nested ` +
          `begin/exception/end block instead (PL/pgSQL's implicit subtransaction)`
      ).toEqual([]);
    });
  }

  it("sanity: this scanner actually finds a DO block in wholesale-legal-verify.sql (proves the extractor isn't silently matching nothing)", () => {
    const raw = readFileSync(join(supabaseDir, "wholesale-legal-verify.sql"), "utf8");
    const stripped = stripSqlCommentsAndStrings(raw);
    const regions = extractPlpgsqlRegions(stripped);
    expect(regions.length).toBeGreaterThan(5);
  });

  it("sanity: the scanner would have caught the original bug — simulating the pre-fix SAVEPOINT pattern inside a DO block is detected", () => {
    const simulatedBroken = `
do $$
begin
  savepoint _test_sp;
  begin
    insert into some_table values (1);
    rollback to savepoint _test_sp;
  exception when others then
    rollback to savepoint _test_sp;
  end;
end $$;
`;
    const regions = extractPlpgsqlRegions(stripSqlCommentsAndStrings(simulatedBroken));
    expect(regions.length).toBe(1);
    expect(/\bsavepoint\b/i.test(regions[0])).toBe(true);
    expect(/\brollback\s+to\b/i.test(regions[0])).toBe(true);
  });

  // The two *-preflight.sql files are pure read-only SELECT scripts (a
  // single WITH ... SELECT) with no writes of any kind — they never wrap
  // in begin;/commit;/rollback; at all, by design (nothing to roll back).
  // Only the migration/verify/rollback files use top-level transaction
  // control.
  const FILES_WITH_TOP_LEVEL_TXN = FILES.filter((f) => !f.endsWith("-preflight.sql"));

  it("the 2 preflight files remain pure read-only (no begin;/commit;/rollback; at all — nothing to wrap)", () => {
    for (const file of FILES.filter((f) => f.endsWith("-preflight.sql"))) {
      const raw = readFileSync(join(supabaseDir, file), "utf8");
      const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
      expect(lines.find((l) => l === "begin;"), `${file}: unexpectedly has a top-level begin;`).toBeFalsy();
    }
  });

  it("top-level begin;/commit;/rollback; wrapping the whole script (outside any DO block or function) remains present and untouched in every migration/verify/rollback file — this is allowed and expected, not what this test prohibits", () => {
    for (const file of FILES_WITH_TOP_LEVEL_TXN) {
      const raw = readFileSync(join(supabaseDir, file), "utf8");
      const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
      expect(lines.find((l) => l === "begin;"), `${file}: missing top-level begin;`).toBeTruthy();
      // The rollback.sql files end with a commented-out "fully destructive
      // Section 2" (see wholesale-*-rollback.sql's own header) — their
      // real, executing top-level commit; is the last statement of
      // Section 1, not necessarily the file's very last trimmed line.
      const hasTopLevelCommitOrRollback = lines.some((l) => l === "commit;" || l === "rollback;");
      expect(hasTopLevelCommitOrRollback, `${file}: no top-level commit; or rollback; found anywhere`).toBe(true);
    }
  });
});
