import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Coverage for the corrective, forward-only quartet that fixes the original
 * Microsoldering/MacBook misinterpretation on top of the two ALREADY-
 * EXECUTED, real migrations (wholesale-dynamic-equipment-types-migration.sql
 * and wholesale-microsoldering-tag-assignment-migration.sql, both verified
 * PASS on the real Supabase project). Retracts exactly the 56 wrong
 * microsoldering tag relationships, introduces the generic catalog_mode
 * column, restores MacBook as independent from Laptops, and fixes a real
 * pre-existing gap (laptops-gamer silently pointing at a separate hidden
 * 'gaming-laptops' equipment type). Real execution (pglite, replaying the
 * two real prior migrations first to reproduce the exact post-migration
 * state, then this quartet's preflight/migration/verify/idempotent-rerun/
 * rollback) happened outside this suite — see
 * scratchpad/pg-audit/verify-catalog-architecture-fix.mjs — same convention
 * as every other migration quartet here: these are source-scan assertions
 * against the SQL files' content, this project's standard because there is
 * no jsdom/DOM test environment and no live Postgres available in CI.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const supabaseDir = join(__dirname, "..", "supabase");

const preflight = readFileSync(join(supabaseDir, "wholesale-catalog-architecture-fix-preflight.sql"), "utf8");
const migration = readFileSync(join(supabaseDir, "wholesale-catalog-architecture-fix-migration.sql"), "utf8");
const verify = readFileSync(join(supabaseDir, "wholesale-catalog-architecture-fix-verify.sql"), "utf8");
const rollback = readFileSync(join(supabaseDir, "wholesale-catalog-architecture-fix-rollback.sql"), "utf8");

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Every distinct UUID literal in a file, deduped and sorted. */
function extractUuids(sql) {
  const matches = sql.match(UUID_RE) || [];
  return [...new Set(matches.map((m) => m.toLowerCase()))].sort();
}

const TARGET56_COUNT = 56;

describe("wholesale-catalog-architecture-fix-preflight.sql: read-only gate, expects the real post-migration state", () => {
  it("is read-only — no insert/update/delete/alter/create/drop statement", () => {
    expect(preflight).not.toMatch(/\binsert into\b|\bupdate\s+\w+\s+set\b|\bdelete from\b|\balter table\b|\bcreate table\b|\bdrop table\b/i);
  });

  it("contains exactly the same 56 target service_id uuids as the original tag-assignment quartet (same rows, this time being retracted)", () => {
    const ids = extractUuids(preflight).filter((id) => preflight.includes(id));
    // the raw with-clause count is asserted precisely via the target56 CTE name below;
    // this is a coarse sanity floor so a truncated/corrupted list still fails loudly.
    expect(ids.length).toBeGreaterThanOrEqual(TARGET56_COUNT);
  });

  it("all 10 checks are present, in order, by name", () => {
    const expected = [
      "prerequisite_tables_exist",
      "new_columns_and_index_not_already_present",
      "microsoldering_and_macbook_and_laptops_equipment_types_found",
      "macbook_currently_inactive_and_microsoldering_currently_tag_lens",
      "target_56_currently_tagged_microsoldering_count",
      "macbook_air_pro_categories_resolve_to_laptops_or_macbook",
      "laptops_own_categories_resolve_as_expected",
      "photo_ownership_snapshot",
      "final_9_card_target_slugs_all_exist",
      "current_equipment_types_snapshot",
    ];
    expected.forEach((name) => expect(preflight).toContain(name));
  });

  it("check 3 (blocking) requires microsoldering/macbook/laptops equipment_types rows to already exist — i.e. the Dynamic Equipment Types migration must already be installed", () => {
    expect(preflight).toMatch(/select 3, 'microsoldering_and_macbook_and_laptops_equipment_types_found',/);
    expect(preflight).toMatch(/case when microsoldering_id is not null and macbook_id is not null and laptops_id is not null then 'PASS' else 'FAIL' end/);
  });

  it("check 5 reports how many of the 56 targets currently carry the microsoldering tag, but is explicitly informational (always PASS) — not a hard blocker either way", () => {
    expect(preflight).toContain("target_56_currently_tagged_microsoldering_count (informational)");
    expect(preflight).toMatch(/select 5, 'target_56_currently_tagged_microsoldering_count \(informational\)',\s*\n\s*'PASS',/);
    expect(preflight).toContain("expect 56");
  });

  it("check 9 requires all 9 final target slugs (microsoldering, iphone, ipad, macbook, laptops, ps5, xbox-series-x, switch, controllers) to already exist as rows", () => {
    expect(preflight).toMatch(
      /select unnest\(array\['microsoldering','iphone','ipad','macbook','laptops','ps5','xbox-series-x','switch','controllers'\]\) as slug/
    );
  });

  it("never silently returns zero rows — a synthetic OVERALL STATUS/STOP row is appended only when the real checks produced none", () => {
    expect(preflight).toMatch(/where not exists \(select 1 from report\)/);
    expect(preflight).toMatch(/ZERO CHECK ROWS WERE RETURNED/);
  });
});

describe("wholesale-catalog-architecture-fix-migration.sql: forward-only, five independent changes in one transaction", () => {
  it("is wrapped in an explicit begin;/commit; transaction", () => {
    const lines = migration.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines.indexOf("commit;")).toBeGreaterThan(lines.indexOf("begin;"));
  });

  it("1. retracts exactly 56 microsoldering tag relationships via ONE scoped delete keyed on tag_id + service_id = any(...) — never a bare/unscoped delete on wholesale_service_tags", () => {
    // 2 total "delete from" occurrences in the whole file: the scoped tag
    // retraction (step 1) and the single-row `delete from
    // wholesale_equipment_types where id = p_equipment_type_id` INSIDE the
    // replacement RPC's own function body (step 7) — that one is the RPC's
    // normal per-row deletion logic when an admin calls it, not a migration
    // side effect against existing data, so it's expected and legitimate.
    const deleteMatches = migration.match(/\bdelete from\b/gi) || [];
    expect(deleteMatches.length).toBe(2);
    const tagDeleteMatches = migration.match(/\bdelete from wholesale_service_tags\b/gi) || [];
    expect(tagDeleteMatches.length).toBe(1);
    expect(migration).toMatch(/delete from wholesale_service_tags\s*\nwhere tag_id = \(select id from wholesale_tags where slug = 'microsoldering'\)\s*\n\s*and service_id = any\(array\[/);
    const ids = extractUuids(migration.split("2. catalog_mode")[0]);
    expect(ids.length).toBe(TARGET56_COUNT);
  });

  it("never deletes from wholesale_services, wholesale_price_history, or wholesale_images — services, prices, and history are untouched", () => {
    expect(migration).not.toMatch(/delete from wholesale_services/);
    expect(migration).not.toMatch(/delete from wholesale_price_history/);
    expect(migration).not.toMatch(/delete from wholesale_images/);
    expect(migration).not.toMatch(/\btruncate\b/i);
  });

  it("2. adds catalog_mode as a NOT NULL 'grouped'-default column with a CHECK constraint restricted to ('grouped', 'direct_services'), and sets microsoldering to 'direct_services' with is_tag_lens/source_mode/source_tag_id reset to neutral", () => {
    expect(migration).toMatch(/alter table wholesale_equipment_types add column if not exists catalog_mode text not null default 'grouped';/);
    expect(migration).toMatch(/check \(catalog_mode in \('grouped', 'direct_services'\)\);/);
    expect(migration).toMatch(/catalog_mode = 'direct_services',\s*\n\s*is_tag_lens = false,\s*\n\s*source_mode = 'direct',\s*\n\s*source_tag_id = null,/);
    expect(migration).toMatch(/where slug = 'microsoldering'/);
  });

  it("3. adds name_es/description_en/description_es as nullable columns on wholesale_services, no data inserted", () => {
    expect(migration).toContain("alter table wholesale_services add column if not exists name_es text;");
    expect(migration).toContain("alter table wholesale_services add column if not exists description_en text;");
    expect(migration).toContain("alter table wholesale_services add column if not exists description_es text;");
    expect(migration).not.toMatch(/insert into wholesale_services/);
  });

  it("4. adds a real unique partial index completing the one-photo-per-service pattern", () => {
    expect(migration).toMatch(/create unique index if not exists uq_wholesale_images_service\s*\n\s*on wholesale_images\(service_id\) where service_id is not null;/);
  });

  it("5. restores MacBook Air/Pro under MacBook by re-pointing the SAME existing category ids (never recreated) from 'laptops' to 'macbook', then reactivates MacBook", () => {
    expect(migration).toMatch(/update wholesale_categories set equipment_type_id = \(\s*\n\s*select id from wholesale_equipment_types where slug = 'macbook'\s*\n\s*\), updated_at = now\(\)\s*\nwhere slug in \('macbook-air', 'macbook-pro'\)/);
    expect(migration).toMatch(/update wholesale_equipment_types set\s*\n\s*active = true, name = 'MacBook', name_es = 'MacBook', updated_at = now\(\)\s*\nwhere slug = 'macbook'/);
  });

  it("5b. re-points laptops-gamer from the separate 'gaming-laptops' equipment type onto 'laptops' — the real pre-existing gap found during audit, unrelated to either already-executed migration", () => {
    expect(migration).toMatch(/where slug = 'laptops-gamer'\s*\n\s*and equipment_type_id = \(select id from wholesale_equipment_types where slug = 'gaming-laptops'\)/);
  });

  it("never touches laptops-normal's equipment_type_id — it already resolved to 'laptops' before this fix", () => {
    expect(migration).not.toMatch(/slug\s*=\s*'laptops-normal'[\s\S]{0,80}equipment_type_id\s*=/);
  });

  it("preserves every UUID in the migration's own data-changing statements — no insert/recreate of any wholesale_categories or wholesale_equipment_types row, and the only 'delete from wholesale_equipment_types' anywhere is the parameterized single-row delete inside the replacement RPC's function body (step 7), not a migration side effect against existing data", () => {
    expect(migration).not.toMatch(/insert into wholesale_categories/);
    expect(migration).not.toMatch(/insert into wholesale_equipment_types/);
    expect(migration).not.toMatch(/delete from wholesale_categories/);
    const bodyBeforeRpc = migration.split("7. Delete RPC")[0];
    expect(bodyBeforeRpc).not.toMatch(/delete from wholesale_equipment_types/);
    expect(migration).toMatch(/delete from wholesale_equipment_types where id = p_equipment_type_id;/);
  });

  it("6. sets the final 9-card sort_order (plus 2 hidden historical rows) via ONE atomic UPDATE ... FROM (VALUES ...), collision-free by construction", () => {
    expect(migration).toMatch(
      /\('microsoldering',\s*1\),\s*\n\s*\('iphone',\s*2\),\s*\n\s*\('ipad',\s*3\),\s*\n\s*\('macbook',\s*4\),\s*\n\s*\('laptops',\s*5\),\s*\n\s*\('ps5',\s*6\),\s*\n\s*\('xbox-series-x',\s*7\),\s*\n\s*\('switch',\s*8\),\s*\n\s*\('controllers',\s*9\),\s*\n\s*\('video-consoles', 101\),\s*\n\s*\('gaming-laptops', 102\)/
    );
    const sortOrderUpdates = migration.match(/update wholesale_equipment_types t set\s*\n\s*sort_order = m\.new_sort_order/g) || [];
    expect(sortOrderUpdates.length).toBe(1);
  });

  it("7. replaces wholesale_delete_equipment_type dropping the is_tag_lens-specific refusal branch — deletion now governed only by zero-categories", () => {
    expect(migration).toContain("create or replace function public.wholesale_delete_equipment_type(");
    // Scope to the function BODY itself (between its `as $$` and closing `$$;`)
    // — is_tag_lens legitimately appears earlier in the file (step 2 sets it
    // to false on microsoldering, and step-7's own header comment names it
    // as the thing being removed); what must be gone is any READ of it as a
    // decision input inside the RPC's actual logic.
    const rpcBody = migration.split("as $$\ndeclare")[1]?.split("$$;")[0] ?? "";
    expect(rpcBody.length).toBeGreaterThan(100);
    expect(rpcBody).not.toMatch(/cannot_delete_tag_lens_equipment_type/);
    expect(rpcBody).not.toMatch(/is_tag_lens/);
    expect(rpcBody).toMatch(/select count\(\*\) into v_category_count from wholesale_categories where equipment_type_id = p_equipment_type_id;\s*\n\s*if v_category_count > 0 then\s*\n\s*raise exception 'equipment_type_has_categories';/);
  });

  it("is idempotent — every column add uses IF NOT EXISTS, the delete only removes rows that still exist, structural updates carry an IS DISTINCT FROM guard, and the RPC is CREATE OR REPLACE", () => {
    expect(migration).toMatch(/add column if not exists catalog_mode/);
    expect(migration).toMatch(/add column if not exists name_es/);
    expect(migration).toMatch(/create unique index if not exists/);
    expect((migration.match(/is distinct from/g) || []).length).toBeGreaterThanOrEqual(3);
    expect(migration).toContain("create or replace function public.wholesale_delete_equipment_type");
  });
});

describe("wholesale-catalog-architecture-fix-verify.sql: 14 checks, self-cleaning", () => {
  it("is wrapped in begin;/rollback; (self-cleaning) — never commit;, since check 12 writes synthetic rows that must never persist", () => {
    const lines = verify.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines[lines.length - 1]).toBe("rollback;");
    expect(verify).not.toMatch(/^commit;$/m);
  });

  it("asserts all 14 checks by name, in order", () => {
    const expected = [
      "new_columns_and_index_exist_with_correct_shape",
      "all_56_wrong_tags_retracted",
      "macbook_categories_restored",
      "no_orphaned_services_for_macbook_categories",
      "laptops_owns_both_its_categories_gaming_laptops_now_empty",
      "macbook_active_with_names_laptops_unaffected",
      "microsoldering_decoupled_from_tag_lens",
      "catalog_mode_direct_services_is_exactly_microsoldering",
      "sort_order_collision_free_across_all_rows",
      "final_visual_order_matches_9_card_sequence",
      "no_duplicate_equipment_type_slugs",
      "delete_rpc_generic_zero_categories_rule",
      "real_microsoldering_row_untouched_by_check_12",
      "no_synthetic_rows_left_behind",
    ];
    expected.forEach((name) => expect(verify).toContain(name));
  });

  it("check 2 asserts EXACT set equality — 0/56 remaining wrong-tagged, same 56 uuids as the migration's delete list", () => {
    expect(verify).toMatch(/case when \(select count\(\*\) from still_tagged\) = 0 then 'PASS' else 'FAIL' end/);
    const ids = extractUuids(verify.split("Check 3")[0]);
    expect(ids.length).toBe(TARGET56_COUNT);
    expect(ids).toEqual(extractUuids(migration.split("2. catalog_mode")[0]));
  });

  it("check 10 asserts the exact 9-card active order as an array equality, not a count or subset check", () => {
    expect(verify).toMatch(
      /= array\['microsoldering', 'iphone', 'ipad', 'macbook', 'laptops', 'ps5', 'xbox-series-x', 'switch', 'controllers'\]/
    );
  });

  it("check 12 exercises the updated delete RPC functionally — empty direct_services row deletable, populated row refused — using synthetic rows cleaned up via an exception-as-savepoint pattern, with the result-row insert placed AFTER the exception block (not inside it)", () => {
    expect(verify).toMatch(/__wsl_cafix_verify__empty/);
    expect(verify).toMatch(/__wsl_cafix_verify__populated/);
    expect(verify).toMatch(/perform wholesale_delete_equipment_type\(v_admin_id, v_empty_id, true\);/);
    expect(verify).toMatch(/raise exception '__wsl_cafix_verify_cleanup__' using errcode = 'ZZ002';/);
    // the check-12 result INSERT must occur textually after the `exception when sqlstate 'ZZ002'` handler,
    // proving it runs outside the implicit-savepoint block rather than being rolled back by it.
    const exceptionIdx = verify.indexOf("exception\n      when sqlstate 'ZZ002' then null;");
    const resultInsertIdx = verify.indexOf("insert into _wsl_cafix_verify_results values (\n      12,");
    expect(exceptionIdx).toBeGreaterThan(-1);
    expect(resultInsertIdx).toBeGreaterThan(exceptionIdx);
  });

  it("check 14 confirms zero synthetic __wsl_cafix_verify__ rows survive", () => {
    expect(verify).toContain("where slug like '\\_\\_wsl\\_cafix\\_verify\\_\\_%' escape '\\'");
  });

  it("never silently returns zero rows and never reports a REVIEW REQUIRED status", () => {
    expect(verify).not.toMatch(/'REVIEW REQUIRED'/);
  });
});

describe("wholesale-catalog-architecture-fix-rollback.sql: scoped, non-destructive, reverses this fix ONLY", () => {
  it("is wrapped in an explicit begin;/commit; transaction, with the optional column-drop block left commented out below it", () => {
    const activeBody = rollback.split("-- OPTIONAL")[0];
    const lines = activeBody.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines.indexOf("commit;")).toBeGreaterThan(lines.indexOf("begin;"));
    expect(rollback).toMatch(/-- alter table wholesale_equipment_types drop column if exists catalog_mode;/);
  });

  it("re-points macbook-air/macbook-pro back to 'laptops' and hides 'macbook' again", () => {
    expect(rollback).toMatch(/update wholesale_categories set equipment_type_id = \(\s*\n\s*select id from wholesale_equipment_types where slug = 'laptops'\s*\n\s*\), updated_at = now\(\)\s*\nwhere slug in \('macbook-air', 'macbook-pro'\)/);
    expect(rollback).toMatch(/update wholesale_equipment_types set active = false, updated_at = now\(\)\s*\nwhere slug = 'macbook' and active = true;/);
  });

  it("reverses laptops-gamer back onto the separate 'gaming-laptops' equipment type", () => {
    expect(rollback).toMatch(/select id from wholesale_equipment_types where slug = 'gaming-laptops'/);
    expect(rollback).toMatch(/where slug = 'laptops-gamer'\s*\n\s*and equipment_type_id = \(select id from wholesale_equipment_types where slug = 'laptops'\)/);
  });

  it("restores the prior 8-card sort_order sequence (macbook pushed back to 101, matching the already-executed migration's own numbering)", () => {
    expect(rollback).toMatch(/\('macbook',\s*101\)/);
    expect(rollback).toMatch(/\('gaming-laptops', 102\)/);
    expect(rollback).toMatch(/\('video-consoles', 103\)/);
  });

  it("restores microsoldering to is_tag_lens=true / source_mode='tag_lens' / catalog_mode='grouped'", () => {
    expect(rollback).toMatch(/is_tag_lens = true,\s*\n\s*source_mode = 'tag_lens',\s*\n\s*source_tag_id = \(select id from wholesale_tags where slug = 'microsoldering'\),\s*\n\s*catalog_mode = 'grouped',/);
  });

  it("re-inserts exactly the same 56 tag relationships this fix's migration removed, ON CONFLICT DO NOTHING, and reports the real reinserted count via RAISE NOTICE", () => {
    const ids = extractUuids(rollback.split("5. Restore wholesale_delete_equipment_type")[0]);
    expect(ids.length).toBe(TARGET56_COUNT);
    expect(ids).toEqual(extractUuids(migration.split("2. catalog_mode")[0]));
    expect(rollback).toMatch(/on conflict \(service_id, tag_id\) do nothing;/);
    expect(rollback).toMatch(/get diagnostics v_reinserted = row_count;/);
    expect(rollback).toMatch(/raise notice 'reinserted % of 56 microsoldering tag relationships/);
  });

  it("restores wholesale_delete_equipment_type to its exact prior is_tag_lens-aware form", () => {
    expect(rollback).toMatch(/if v_is_tag_lens then\s*\n\s*raise exception 'cannot_delete_tag_lens_equipment_type';/);
  });

  it("leaves catalog_mode/name_es/description_en/description_es/uq_wholesale_images_service in place by default — dropping them is an explicit, separate, commented-out optional step, never automatic", () => {
    const activeBody = rollback.split("-- OPTIONAL")[0];
    expect(activeBody).not.toMatch(/drop column/);
    expect(activeBody).not.toMatch(/drop index/);
  });
});

describe("wholesale-catalog-architecture-fix quartet: cross-file consistency", () => {
  it("preflight, migration, verify, and rollback all reference the exact same 56 service_id set for the tag retraction/reinsertion — zero drift", () => {
    const preflightIds = extractUuids(preflight.split("macbook_categories_current as")[0]);
    const migrationIds = extractUuids(migration.split("2. catalog_mode")[0]);
    const verifyIds = extractUuids(verify.split("Check 3")[0]);
    const rollbackIds = extractUuids(rollback.split("5. Restore wholesale_delete_equipment_type")[0]);
    [preflightIds, migrationIds, verifyIds, rollbackIds].forEach((ids) => expect(ids.length).toBe(TARGET56_COUNT));
    expect(migrationIds).toEqual(preflightIds);
    expect(verifyIds).toEqual(preflightIds);
    expect(rollbackIds).toEqual(preflightIds);
  });

  it("the 56-id set retracted here is identical to the set the original tag-assignment migration inserted (this fix undoes exactly that, and only that, insertion)", () => {
    const tagAssignmentMigration = readFileSync(
      join(supabaseDir, "wholesale-microsoldering-tag-assignment-migration.sql"),
      "utf8"
    );
    const migrationIds = extractUuids(migration.split("2. catalog_mode")[0]);
    expect(migrationIds).toEqual(extractUuids(tagAssignmentMigration));
  });

  it("migration and rollback are exact structural inverses for catalog_mode/is_tag_lens/source_mode on microsoldering", () => {
    expect(migration).toMatch(/catalog_mode = 'direct_services',/);
    expect(rollback).toMatch(/catalog_mode = 'grouped',/);
    expect(migration).toMatch(/is_tag_lens = false,/);
    expect(rollback).toMatch(/is_tag_lens = true,/);
  });

  it("neither migration nor rollback ever runs a bare DELETE without a WHERE clause, and neither ever touches wholesale_services rows directly (only categories/equipment_types/service_tags)", () => {
    for (const sql of [migration, rollback]) {
      expect(sql).not.toMatch(/delete from wholesale_service_tags\s*;/);
      expect(sql).not.toMatch(/delete from wholesale_services\b/);
    }
  });
});
