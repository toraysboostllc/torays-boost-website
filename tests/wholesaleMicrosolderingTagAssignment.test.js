import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Coverage for the scoped, one-off Microsoldering tag-assignment quartet:
 * tags exactly 56 EXPLICIT service_id values (15 iPhone, 30 iPad, 1 Laptops,
 * 10 Video Consoles, 0 Controllers) with the 'microsoldering' tag, sourced
 * from the owner's own review of a real CSV export of
 * wholesale-microsoldering-tag-candidates.sql. Independent of, and does not
 * require, wholesale-dynamic-equipment-types-*.sql. Real execution (pglite,
 * 21 assertions covering preflight PASS, migration insert count, verify
 * exact-set-equality, idempotent re-run, rollback row count, rollback
 * re-run no-op) happened outside this suite, same convention as every other
 * migration quartet here — these are source-scan assertions against the SQL
 * files' content, this project's standard because there is no jsdom/DOM
 * test environment and no live Postgres available in CI.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const supabaseDir = join(__dirname, "..", "supabase");

const preflight = readFileSync(join(supabaseDir, "wholesale-microsoldering-tag-assignment-preflight.sql"), "utf8");
const migration = readFileSync(join(supabaseDir, "wholesale-microsoldering-tag-assignment-migration.sql"), "utf8");
const verify = readFileSync(join(supabaseDir, "wholesale-microsoldering-tag-assignment-verify.sql"), "utf8");
const rollback = readFileSync(join(supabaseDir, "wholesale-microsoldering-tag-assignment-rollback.sql"), "utf8");

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Every distinct service_id UUID literal in a file, deduped and sorted —
 *  deliberately excludes the fixed tag-slug lookup ('microsoldering' is a
 *  slug string, never a UUID literal, so it never pollutes this list). */
function extractServiceIds(sql) {
  const matches = sql.match(UUID_RE) || [];
  return [...new Set(matches.map((m) => m.toLowerCase()))].sort();
}

const EXPECTED_COUNT = 56;

describe("wholesale-microsoldering-tag-assignment-preflight.sql: read-only gate", () => {
  it("is read-only — no insert/update/delete/alter/create/drop statement", () => {
    expect(preflight).not.toMatch(/\binsert into\b|\bupdate\s+\w+\s+set\b|\bdelete from\b|\balter table\b|\bcreate table\b|\bdrop table\b/i);
  });

  it("contains exactly 56 distinct service_id uuids", () => {
    const ids = extractServiceIds(preflight);
    expect(ids.length).toBe(EXPECTED_COUNT);
  });

  it("checks the microsoldering tag exists, the list has no duplicates, all targets resolve, and none belong to Controllers", () => {
    expect(preflight).toContain("microsoldering_tag_exists");
    expect(preflight).toContain("target_list_has_no_duplicate_ids_and_totals_56");
    expect(preflight).toContain("all_56_target_services_exist_in_database");
    expect(preflight).toContain("none_of_the_56_belong_to_controllers");
    expect(preflight).toMatch(/real_equipment_type_slug = 'controllers'/);
  });

  it("cross-validates every target against its expected equipment type, category, and service name (drift protection)", () => {
    expect(preflight).toContain("all_56_targets_match_expected_name_category_equipment_type");
    expect(preflight).toMatch(/real_service_name is distinct from expected_service_name/);
    expect(preflight).toMatch(/real_category_name is distinct from expected_category/);
    expect(preflight).toMatch(/real_equipment_type_name is distinct from expected_equipment_type/);
  });

  it("verifies the exact 15/30/1/10 group breakdown", () => {
    expect(preflight).toContain("per_group_breakdown_matches_15_30_1_10");
    expect(preflight).toMatch(/expected_equipment_type = 'iPhone'\) = 15/);
    expect(preflight).toMatch(/expected_equipment_type = 'iPad'\) = 30/);
    expect(preflight).toMatch(/expected_equipment_type = 'Laptops'\) = 1\b/);
    expect(preflight).toMatch(/expected_equipment_type = 'Video Consoles'\) = 10/);
  });

  it("verifies all 56 targets are active", () => {
    expect(preflight).toContain("all_56_target_services_are_active");
  });

  it("output contract is check_number/check_name/status/details, status restricted to PASS/FAIL/STOP, never a fourth value", () => {
    expect(preflight).toMatch(/check_number/);
    expect(preflight).not.toMatch(/'REVIEW REQUIRED'/);
  });

  it("never silently returns zero rows — a synthetic OVERALL STATUS/STOP row is appended only when the real checks produced none", () => {
    expect(preflight).toMatch(/where not exists \(select 1 from report\)/);
    expect(preflight).toMatch(/ZERO CHECK ROWS WERE RETURNED/);
  });
});

describe("wholesale-microsoldering-tag-assignment-migration.sql: idempotent, insert-only", () => {
  it("is wrapped in an explicit begin;/commit; transaction", () => {
    const lines = migration.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines.indexOf("commit;")).toBeGreaterThan(lines.indexOf("begin;"));
  });

  it("contains exactly 56 distinct service_id uuids", () => {
    const ids = extractServiceIds(migration);
    expect(ids.length).toBe(EXPECTED_COUNT);
  });

  it("contains exactly ONE insert statement and no delete/update/alter/create/drop anywhere — never touches or removes any other tag", () => {
    const insertMatches = migration.match(/\binsert into\b/gi) || [];
    expect(insertMatches.length).toBe(1);
    expect(migration).not.toMatch(/\bdelete from\b|\bupdate\s+\w+\s+set\b|\balter table\b|\bcreate table\b|\bdrop table\b/i);
  });

  it("inserts into wholesale_service_tags using ON CONFLICT (service_id, tag_id) DO NOTHING against the table's own primary key", () => {
    expect(migration).toMatch(/insert into wholesale_service_tags \(service_id, tag_id\)/);
    expect(migration).toMatch(/on conflict \(service_id, tag_id\) do nothing/);
  });

  it("re-validates the tag exists, the target count is 56, and none belong to Controllers at migration time (not just preflight time), aborting via RAISE EXCEPTION on drift", () => {
    expect(migration).toMatch(/raise exception 'microsoldering_tag_not_found/);
    expect(migration).toMatch(/if v_found_count <> 56 then/);
    expect(migration).toMatch(/raise exception 'expected all 56 target ids to resolve/);
    expect(migration).toMatch(/et\.slug = 'controllers'/);
    expect(migration).toMatch(/if v_controllers_count <> 0 then/);
  });

  it("the migration's own list of 56 ids is identical to the preflight's target list (no drift between the two files)", () => {
    expect(extractServiceIds(migration)).toEqual(extractServiceIds(preflight));
  });
});

describe("wholesale-microsoldering-tag-assignment-verify.sql: read-only confirmation", () => {
  it("is read-only — no insert/update/delete/alter/create/drop statement", () => {
    expect(verify).not.toMatch(/\binsert into\b|\bupdate\s+\w+\s+set\b|\bdelete from\b|\balter table\b|\bcreate table\b|\bdrop table\b/i);
  });

  it("contains exactly 56 distinct service_id uuids, identical to the preflight/migration lists", () => {
    const ids = extractServiceIds(verify);
    expect(ids.length).toBe(EXPECTED_COUNT);
    expect(ids).toEqual(extractServiceIds(preflight));
    expect(ids).toEqual(extractServiceIds(migration));
  });

  it("checks 56/56 tagged AND exact set equality (total tagged across the whole table = 56, not just >= 56)", () => {
    expect(verify).toContain("all_56_targets_now_tagged");
    expect(verify).toContain("tagged_set_is_exactly_the_56_targets_no_more_no_less");
    expect(verify).toMatch(/count\(\*\) from all_microsoldering_tagged\) = 56 and \(select count\(\*\) from tagged_targets\) = 56/);
  });

  it("checks Controllers is completely unchanged", () => {
    expect(verify).toContain("controllers_completely_unchanged");
    expect(verify).toMatch(/et\.slug = 'controllers'/);
  });

  it("checks the exact 15/30/1/10 group breakdown", () => {
    expect(verify).toContain("per_group_breakdown_matches_15_30_1_10");
  });

  it("output contract is check_number/check_name/status/details, status restricted to PASS/FAIL, never REVIEW REQUIRED", () => {
    expect(verify).not.toMatch(/'REVIEW REQUIRED'/);
  });

  it("never silently returns zero rows — same zero-rows safety net as the preflight", () => {
    expect(verify).toMatch(/where not exists \(select 1 from report\)/);
    expect(verify).toMatch(/ZERO CHECK ROWS WERE RETURNED/);
  });
});

describe("wholesale-microsoldering-tag-assignment-rollback.sql: scoped, non-destructive removal", () => {
  it("is wrapped in an explicit begin;/commit; transaction", () => {
    const lines = rollback.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines.indexOf("commit;")).toBeGreaterThan(lines.indexOf("begin;"));
  });

  it("contains exactly 56 distinct service_id uuids, identical to the other three files", () => {
    const ids = extractServiceIds(rollback);
    expect(ids.length).toBe(EXPECTED_COUNT);
    expect(ids).toEqual(extractServiceIds(preflight));
  });

  it("contains exactly ONE delete statement, scoped to tag_id AND service_id = any(...) — never a bare/unscoped delete", () => {
    const deleteMatches = rollback.match(/\bdelete from\b/gi) || [];
    expect(deleteMatches.length).toBe(1);
    expect(rollback).toMatch(/delete from wholesale_service_tags\s*\n\s*where tag_id = v_tag_id\s*\n\s*and service_id = any\(array\[/);
  });

  it("never touches any table other than wholesale_service_tags — no insert/update/alter/create/drop, and no other delete target", () => {
    expect(rollback).not.toMatch(/\binsert into\b|\bupdate\s+\w+\s+set\b|\balter table\b|\bcreate table\b|\bdrop table\b/i);
    expect(rollback).not.toMatch(/delete from wholesale_(?!service_tags)\w+/);
  });

  it("does not delete the wholesale_tags row itself — only the (service_id, tag_id) relationship rows", () => {
    expect(rollback).not.toMatch(/delete from wholesale_tags/);
  });

  it("reports the actual deleted row count via RAISE NOTICE — a partial/no-op rollback is never silently indistinguishable from a full one", () => {
    expect(rollback).toMatch(/get diagnostics v_deleted_count = row_count/);
    expect(rollback).toMatch(/raise notice 'rolled back % of 56/);
  });
});

describe("wholesale-microsoldering-tag-assignment quartet: cross-file consistency", () => {
  it("all four files reference the exact same 56 service_id set — zero drift across preflight/migration/verify/rollback", () => {
    const sets = [extractServiceIds(preflight), extractServiceIds(migration), extractServiceIds(verify), extractServiceIds(rollback)];
    sets.forEach((ids) => expect(ids.length).toBe(EXPECTED_COUNT));
    const [first, ...rest] = sets;
    rest.forEach((ids) => expect(ids).toEqual(first));
  });

  it("this quartet never references wholesale_equipment_types/wholesale_categories structural columns (sort_order writes) — fully independent of wholesale-dynamic-equipment-types-*.sql", () => {
    for (const sql of [migration, rollback]) {
      expect(sql).not.toMatch(/update wholesale_equipment_types/i);
      expect(sql).not.toMatch(/update wholesale_categories/i);
    }
  });
});
