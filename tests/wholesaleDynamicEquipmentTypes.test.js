import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Coverage for the dynamic-equipment-types migration: 3 new columns
 * (name_es, image_focus_x/y, full_bleed_photo) on wholesale_equipment_types,
 * PlayStation 5 / Xbox Series X / Nintendo Switch converted from categories
 * nested under "Video Consoles" into real equipment_types rows, MacBook's
 * categories merged onto the 'laptops' equipment type (macbook and
 * gaming-laptops hidden as historical-compatibility rows, never deleted),
 * the exact owner-approved 8-card visual order, and the two new admin RPCs
 * (atomic reorder, guarded delete). This project has no jsdom/DOM test
 * environment and no live Postgres available in CI — these are source-scan
 * assertions against the SQL files' content, the same convention already
 * used throughout this suite for every other migration quartet. A separate,
 * real-execution audit (pglite, outside this test suite) is what actually
 * proves these statements behave correctly against real data.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const supabaseDir = join(__dirname, "..", "supabase");

const preflight = readFileSync(join(supabaseDir, "wholesale-dynamic-equipment-types-preflight.sql"), "utf8");
const migration = readFileSync(join(supabaseDir, "wholesale-dynamic-equipment-types-migration.sql"), "utf8");
const verify = readFileSync(join(supabaseDir, "wholesale-dynamic-equipment-types-verify.sql"), "utf8");
const rollback = readFileSync(join(supabaseDir, "wholesale-dynamic-equipment-types-rollback.sql"), "utf8");

function stripComments(sql) {
  return sql.replace(/--[^\n]*/g, "");
}

describe("wholesale-dynamic-equipment-types-preflight.sql: read-only gate before the migration", () => {
  it("is read-only — no insert/update/delete/alter/create/drop statement", () => {
    expect(preflight).not.toMatch(/\binsert into\b|\bupdate\s+\w+\s+set\b|\bdelete from\b|\balter table\b|\bcreate table\b|\bdrop table\b/i);
  });

  it("checks the new columns and RPCs don't already exist, and flags a slug collision on the 3 promoted slugs", () => {
    expect(preflight).toContain("new_columns_not_already_present");
    expect(preflight).toContain("new_rpcs_not_already_present");
    expect(preflight).toContain("no_slug_collision_for_new_equipment_type_rows");
    expect(preflight).toMatch(/slug in \('ps5', 'xbox-series-x', 'switch'\)/);
  });

  it("enumerates Video Consoles' current categories and the full current equipment_types list for hand review before running the migration", () => {
    expect(preflight).toContain("video_consoles_current_categories");
    expect(preflight).toContain("current_equipment_types_snapshot");
    expect(preflight).toMatch(/READ BY HAND/);
  });

  it("checks that both 'laptops' and 'macbook' resolve to real rows before the migration tries to re-point against them", () => {
    expect(preflight).toContain("laptops_and_macbook_equipment_types_found");
    expect(preflight).toMatch(/laptops_id is not null and macbook_id is not null/);
  });

  it("enumerates macbook's current categories (expect exactly macbook-air, macbook-pro) for hand review", () => {
    expect(preflight).toContain("macbook_current_categories");
    expect(preflight).toContain("macbook_categories_found_with_current_relations");
    expect(preflight).toMatch(/'macbook-air', 'macbook-pro'/);
  });

  it("flags REVIEW REQUIRED (not FAIL, not silently ignored) when both macbook AND laptops already have their own photo — the one edge case the migration's guard would leave un-transferred", () => {
    expect(preflight).toContain("macbook_and_laptops_photo_collision_check");
    expect(preflight).toMatch(/then 'REVIEW REQUIRED' else 'PASS' end/);
  });

  it("produces a single OVERALL STATUS row", () => {
    expect(preflight).toContain("'OVERALL STATUS'");
  });
});

describe("wholesale-dynamic-equipment-types-migration.sql: schema additions", () => {
  it("is wrapped in an explicit begin;/commit; transaction", () => {
    const lines = migration.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines.indexOf("commit;")).toBeGreaterThan(lines.indexOf("begin;"));
  });

  it("adds name_es (nullable), image_focus_x/y (not-null, 0-100 CHECK), and full_bleed_photo (not-null default false), idempotently", () => {
    expect(migration).toContain("add column if not exists name_es text;");
    expect(migration).toMatch(/add column if not exists image_focus_x numeric\(5, 2\) not null default 50\.00;/);
    expect(migration).toMatch(/add column if not exists image_focus_y numeric\(5, 2\) not null default 50\.00;/);
    expect(migration).toMatch(/add column if not exists full_bleed_photo boolean not null default false;/);
    expect(migration).toContain("wholesale_equipment_types_image_focus_x_check");
    expect(migration).toContain("wholesale_equipment_types_image_focus_y_check");
    expect(migration).toMatch(/check \(image_focus_x >= 0 and image_focus_x <= 100\)/);
    expect(migration).toMatch(/check \(image_focus_y >= 0 and image_focus_y <= 100\)/);
  });

  it("never introduces a free-text CSS object-position COLUMN — only bounded numeric X/Y (the admin-facing control is a visual grid/drag, never typed CSS; this file's own comments legitimately NAME 'object-position' in prose to explain that choice, so comments are stripped first)", () => {
    const body = stripComments(migration);
    expect(body).not.toMatch(/object.?position/i);
    expect(body).not.toMatch(/image_object_position/);
  });
});

describe("wholesale-dynamic-equipment-types-migration.sql: PS5/Xbox/Switch category -> equipment type mapping", () => {
  it("inserts exactly 3 new equipment_types rows (ps5, xbox-series-x, switch), all non-tag-lens, idempotently (on conflict do nothing)", () => {
    const insertBlock = migration.match(/insert into wholesale_equipment_types \(slug, name, name_es, is_tag_lens, active, sort_order\) values([\s\S]*?)on conflict \(slug\) do nothing;/);
    expect(insertBlock, "3-row insert block not found").toBeTruthy();
    const body = insertBlock[1];
    for (const slug of ["ps5", "xbox-series-x", "switch"]) {
      expect(body).toContain(`'${slug}'`);
    }
    // is_tag_lens is always false for these 3 -- every row in the VALUES
    // list has `false` as its 4th column.
    const rowLines = body.split("\n").filter((l) => l.trim().startsWith("("));
    expect(rowLines.length).toBe(3);
    for (const line of rowLines) {
      expect(line).toContain("false");
    }
  });

  it("re-points the 3 EXISTING category rows by slug — never recreates a category, never touches services/price_history directly", () => {
    const updateBlock = migration.match(/update wholesale_categories set equipment_type_id = \([\s\S]*?where wholesale_categories\.slug in \('ps5', 'xbox-series-x', 'switch'\)[\s\S]*?;/);
    expect(updateBlock, "category repoint UPDATE not found").toBeTruthy();
    expect(migration).not.toMatch(/insert into wholesale_categories[\s\S]*?'ps5'/);
    expect(migration).not.toMatch(/insert into wholesale_services/);
    expect(migration).not.toMatch(/insert into wholesale_price_history/);
  });

  it("the repoint UPDATE is guarded (idempotent) — a second run only touches rows that still need it", () => {
    const updateBlock = migration.match(/update wholesale_categories set equipment_type_id = \([\s\S]*?;/)[0];
    expect(updateBlock).toMatch(/is distinct from/);
  });

  it("re-owns any existing category-level photo for these 3 to the new equipment-type slot", () => {
    expect(migration).toMatch(/update wholesale_images set\s*\n\s*equipment_type_id = c\.equipment_type_id,\s*\n\s*category_id = null/);
    expect(migration).toMatch(/where wholesale_images\.category_id = c\.id\s*\n\s*and c\.slug in \('ps5', 'xbox-series-x', 'switch'\);/);
  });

  it("hides Video Consoles ONLY when it has zero remaining categories (never unconditionally, never deleted)", () => {
    const hideBlock = migration.match(/update wholesale_equipment_types set active = false[\s\S]*?where slug = 'video-consoles'[\s\S]*?;/);
    expect(hideBlock, "Video Consoles hide step not found").toBeTruthy();
    expect(hideBlock[0]).toMatch(/not exists \(\s*select 1 from wholesale_categories where equipment_type_id = wholesale_equipment_types\.id\s*\)/);
    expect(migration).not.toMatch(/delete from wholesale_equipment_types[\s\S]*?video-consoles/);
  });
});

describe("wholesale-dynamic-equipment-types-migration.sql: MacBook -> Laptops merge (owner decision, Option C)", () => {
  // The owner reviewed this round's audit (real seed data proved 'laptops'
  // and 'gaming-laptops' are both empty while 'macbook' has the only real,
  // populated laptop-adjacent categories) and chose: 'laptops' becomes the
  // one official card, macbook's content moves onto it by re-pointing
  // (never recreating), and macbook/gaming-laptops are hidden, never
  // deleted. These tests pin that exact decision.

  it("re-points macbook-air/macbook-pro onto 'laptops', guarded (idempotent) the same way the ps5/xbox/switch repoint is", () => {
    const block = migration.match(/update wholesale_categories set equipment_type_id = \(\s*select id from wholesale_equipment_types where slug = 'laptops' and is_tag_lens = false\s*\), updated_at = now\(\)\s*\nwhere equipment_type_id = \(select id from wholesale_equipment_types where slug = 'macbook' and is_tag_lens = false\)/);
    expect(block, "macbook -> laptops category repoint UPDATE not found").toBeTruthy();
    expect(migration).toMatch(/and equipment_type_id is distinct from \(\s*select id from wholesale_equipment_types where slug = 'laptops' and is_tag_lens = false\s*\);/);
  });

  it("never recreates a category, service, or price_history row for the macbook -> laptops merge", () => {
    expect(migration).not.toMatch(/insert into wholesale_categories[\s\S]*?'macbook/);
    expect(migration).not.toMatch(/insert into wholesale_services/);
    expect(migration).not.toMatch(/insert into wholesale_price_history/);
  });

  it("re-owns macbook's equipment-type-level photo onto 'laptops', guarded by NOT EXISTS so it never overwrites a photo laptops already has (no Storage duplication — only the owner column moves)", () => {
    const block = migration.match(/update wholesale_images set\s*\n\s*equipment_type_id = \(select id from wholesale_equipment_types where slug = 'laptops'\)\s*\nwhere equipment_type_id = \(select id from wholesale_equipment_types where slug = 'macbook'\)\s*\n\s*and not exists \(/);
    expect(block, "macbook -> laptops photo re-own UPDATE not found").toBeTruthy();
  });

  it("sets 'laptops'' display name to 'Laptops' in both English and Spanish, guarded so a second run is a no-op", () => {
    const block = migration.match(/update wholesale_equipment_types set\s*\n\s*name = 'Laptops', name_es = 'Laptops', updated_at = now\(\)\s*\nwhere slug = 'laptops'/);
    expect(block, "laptops name/name_es UPDATE not found").toBeTruthy();
    expect(migration).toMatch(/and \(name is distinct from 'Laptops' or name_es is distinct from 'Laptops'\);/);
  });

  it("hides macbook and gaming-laptops (active = false) — never a DELETE against either slug, anywhere in the file", () => {
    expect(migration).toMatch(/update wholesale_equipment_types set active = false, updated_at = now\(\)\s*\nwhere slug in \('macbook', 'gaming-laptops'\) and active = true;/);
    expect(migration).not.toMatch(/delete from wholesale_equipment_types[\s\S]*?'macbook'/);
    expect(migration).not.toMatch(/delete from wholesale_equipment_types[\s\S]*?'gaming-laptops'/);
  });

  it("the migration's own header documents the decision, the exact category mapping, and that macbook/gaming-laptops are hidden, not deleted", () => {
    expect(migration).toContain("Decision: 'laptops' becomes the");
    expect(migration).toMatch(/categories\.slug = 'macbook-air'\s+: macbook -> EXISTING equipment_types row, slug 'laptops'/);
    expect(migration).toMatch(/categories\.slug = 'macbook-pro'\s+: macbook -> EXISTING equipment_types row, slug 'laptops'/);
    expect(migration).toContain("NEVER deleted");
  });
});

describe("wholesale-dynamic-equipment-types-migration.sql: exact final visual order, assigned atomically to every row", () => {
  // The owner has now confirmed the exact final order and the Laptops
  // identity question, so — unlike the prior round of this migration, which
  // deliberately left every pre-existing row's sort_order untouched because
  // that was still unresolved — this migration now assigns the complete,
  // explicit order in one place.

  it("assigns the exact 8-card order plus 3 pushed-out-of-range historical rows in ONE UPDATE ... FROM (VALUES ...) statement — not a series of per-row statements", () => {
    const block = migration.match(/update wholesale_equipment_types t set\s*\n\s*sort_order = m\.new_sort_order,\s*\n\s*updated_at = now\(\)\s*\nfrom \(values([\s\S]*?)\) as m\(slug, new_sort_order\)\s*\nwhere t\.slug = m\.slug/);
    expect(block, "atomic VALUES-mapped sort_order UPDATE not found").toBeTruthy();
    const valuesBody = block[1];
    const expected = [
      ["microsoldering", 1],
      ["iphone", 2],
      ["ipad", 3],
      ["laptops", 4],
      ["ps5", 5],
      ["xbox-series-x", 6],
      ["switch", 7],
      ["controllers", 8],
      ["macbook", 101],
      ["gaming-laptops", 102],
      ["video-consoles", 103],
    ];
    for (const [slug, order] of expected) {
      expect(valuesBody, `missing ('${slug}', ${order})`).toMatch(new RegExp(`\\('${slug}',\\s*${order}\\)`));
    }
    // Exactly one UPDATE statement does the sort_order assignment for these
    // slugs -- not 11 separate statements (that would reintroduce the
    // transient-collision risk the single-statement design exists to avoid).
    const perSlugAssignments = migration.match(/^update wholesale_equipment_types set sort_order = /gm) || [];
    expect(perSlugAssignments).toHaveLength(0);
  });

  it("the historical-compatibility rows (macbook, gaming-laptops, video-consoles) get values strictly outside the 1-8 active range, so they can never collide with an active card's position", () => {
    const block = migration.match(/from \(values([\s\S]*?)\) as m\(slug, new_sort_order\)/)[1];
    for (const slug of ["macbook", "gaming-laptops", "video-consoles"]) {
      const match = block.match(new RegExp(`\\('${slug}',\\s*(\\d+)\\)`));
      expect(match, `no VALUES row for '${slug}'`).toBeTruthy();
      expect(Number(match[1])).toBeGreaterThan(8);
    }
  });

  it("the migration's header states the exact final order and points at the single atomic step that assigns it", () => {
    expect(migration).toMatch(/1 Microsoldering, 2 iPhone, 3 iPad, 4 Laptops, 5 PlayStation 5,/);
    expect(migration).toMatch(/6 Xbox Series X, 7 Nintendo Switch \/ Switch OLED, 8 Controllers\./);
  });
});

describe("wholesale-dynamic-equipment-types-migration.sql: two new RPCs, no live SAVEPOINT anywhere", () => {
  it("wholesale_swap_equipment_type_sort_order: validates admin, locks both rows, swaps atomically in one transaction, rejects mismatched/unknown ids", () => {
    const fn = migration.match(/wholesale_swap_equipment_type_sort_order\([\s\S]*?\$\$;/)[0];
    expect(fn).toContain("role = 'admin' and status = 'approved'");
    expect(fn).toContain("for update");
    expect(fn).toContain("raise exception 'invalid_ids';");
    expect(fn).toContain("raise exception 'equipment_type_not_found';");
  });

  it("wholesale_swap_equipment_type_sort_order is granted to service_role only", () => {
    expect(migration).toMatch(/revoke execute on function public\.wholesale_swap_equipment_type_sort_order\(uuid, uuid, uuid\) from public, anon, authenticated;/);
    expect(migration).toMatch(/grant execute on function public\.wholesale_swap_equipment_type_sort_order\(uuid, uuid, uuid\) to service_role;/);
  });

  it("wholesale_delete_equipment_type: requires explicit confirm=true, refuses a tag-lens row, refuses any row with categories still attached, returns the photo storage_path for the caller to clean up Storage separately", () => {
    const fn = migration.match(/wholesale_delete_equipment_type\([\s\S]*?\$\$;/)[0];
    expect(fn).toContain("role = 'admin' and status = 'approved'");
    expect(fn).toMatch(/if p_confirm is distinct from true then\s*\n\s*raise exception 'confirmation_required';/);
    expect(fn).toMatch(/if v_is_tag_lens then\s*\n\s*raise exception 'cannot_delete_tag_lens_equipment_type';/);
    expect(fn).toMatch(/if v_category_count > 0 then\s*\n\s*raise exception 'equipment_type_has_categories';/);
    expect(fn).toContain("select storage_path into v_image_storage_path");
    expect(fn).not.toMatch(/storage\.googleapis|fetch\(/); // never calls Storage itself — DB-layer only
  });

  it("wholesale_delete_equipment_type is granted to service_role only", () => {
    expect(migration).toMatch(/revoke execute on function public\.wholesale_delete_equipment_type\(uuid, uuid, boolean\) from public, anon, authenticated;/);
    expect(migration).toMatch(/grant execute on function public\.wholesale_delete_equipment_type\(uuid, uuid, boolean\) to service_role;/);
  });

  it("neither RPC contains a live SAVEPOINT/ROLLBACK TO (comments are fine)", () => {
    const stripped = stripComments(migration);
    expect(stripped).not.toMatch(/\bsavepoint\b/i);
    expect(stripped).not.toMatch(/\brollback to\b/i);
  });
});

describe("wholesale-dynamic-equipment-types-verify.sql: read-only real-data checks + self-cleaning RPC functional tests", () => {
  it("does NOT wrap the whole file in begin;/rollback; around the read-only checks the way other verify files do -- but the file still ends in rollback;, never commit;, and every synthetic write happens inside its own nested self-cleaning block", () => {
    const lines = verify.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines[lines.length - 1]).toBe("rollback;");
    expect(verify).not.toMatch(/\ncommit;/);
  });

  it("checks that PS5/Xbox/Switch are real, active, non-tag-lens equipment types with their same-slug category correctly repointed", () => {
    expect(verify).toContain("ps5_xbox_switch_are_real_equipment_types_with_categories_repointed");
    expect(verify).toMatch(/et\.slug in \('ps5', 'xbox-series-x', 'switch'\) and et\.is_tag_lens = false and et\.active = true/);
  });

  it("checks referential integrity for services and price_history under the migrated ps5/xbox/switch categories (relations preserved)", () => {
    expect(verify).toContain("no_orphaned_services_for_the_3_migrated_categories");
    expect(verify).toContain("price_history_for_migrated_categories_intact");
  });

  it("checks macbook-air/macbook-pro correctly resolve to 'laptops' (with the right names) and zero categories remain on macbook", () => {
    expect(verify).toContain("macbook_categories_repointed_to_laptops_with_names");
    expect(verify).toMatch(/et\.slug = 'laptops' and et\.active = true and et\.name = 'Laptops' and et\.name_es = 'Laptops'/);
  });

  it("checks referential integrity for services and price_history under the migrated macbook categories", () => {
    expect(verify).toContain("no_orphaned_services_for_macbook_categories");
    expect(verify).toContain("price_history_for_macbook_categories_intact");
  });

  it("checks macbook and gaming-laptops still exist (never deleted) but are hidden", () => {
    expect(verify).toContain("macbook_and_gaming_laptops_hidden_not_deleted");
    expect(verify).toMatch(/slug in \('macbook', 'gaming-laptops'\) and active = false/);
  });

  it("checks at most one photo total between macbook and laptops (proves the transfer moved ownership, never duplicated the row)", () => {
    expect(verify).toContain("macbook_photo_transferred_no_duplication");
  });

  it("checks zero sort_order collisions across the WHOLE table (all 11 known rows), and zero duplicate slugs overall", () => {
    expect(verify).toContain("sort_order_collision_free_across_all_rows");
    expect(verify).toContain("no_duplicate_equipment_type_slugs");
    expect(verify).not.toContain("sort_order_matches_requested_visual_order");
    expect(verify).not.toContain("new_rows_sort_order_collision_free");
  });

  it("checks the exact final active-row order matches the owner-approved 8-card sequence, literally, not just individual sort_order values", () => {
    expect(verify).toContain("final_visual_order_matches_approved_sequence");
    expect(verify).toMatch(/array\['microsoldering', 'iphone', 'ipad', 'laptops', 'ps5', 'xbox-series-x', 'switch', 'controllers'\]/);
  });

  it("checks Microsoldering's identity AND position — now that the owner has confirmed the final order, this asserts sort_order = 1 explicitly (unlike the prior round, which deliberately did not)", () => {
    expect(verify).toContain("microsoldering_identity_and_position");
    expect(verify).toMatch(/slug = 'microsoldering' and is_tag_lens = true and active = true and sort_order = 1/);
    expect(verify).not.toContain("microsoldering_untouched_identity");
  });

  it("functionally tests the swap RPC and the delete RPC's guards using the ZZ001/ZZ002 sentinel pattern, never a live SAVEPOINT", () => {
    const stripped = stripComments(verify);
    expect(stripped).not.toMatch(/\bsavepoint\b/i);
    expect(stripped).not.toMatch(/\brollback to\b/i);
    expect(verify).toContain("raise exception '__wsl_deqt_verify_unexpected_success__' using errcode = 'ZZ001';");
    expect(verify).toContain("raise exception '__wsl_deqt_verify_cleanup__' using errcode = 'ZZ002';");
  });

  it("attempts to delete the REAL Microsoldering row as part of proving the tag-lens guard, and separately re-confirms it still exists afterward", () => {
    expect(verify).toContain("v_microsoldering_id");
    expect(verify).toContain("microsoldering_row_survives_the_rejected_delete_attempt_in_check_16");
  });

  it("confirms zero synthetic rows are left behind after the functional checks", () => {
    expect(verify).toContain("no_synthetic_rows_left_behind");
    expect(verify).toContain("__wsl_deqt_verify__");
  });

  it("produces a single OVERALL STATUS row", () => {
    expect(verify).toContain("'OVERALL STATUS'");
  });
});

describe("wholesale-dynamic-equipment-types-rollback.sql: default path non-destructive, destructive sections clearly opt-in", () => {
  it("is wrapped in begin;/commit;", () => {
    const lines = rollback.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines.indexOf("commit;")).toBeGreaterThan(lines.indexOf("begin;"));
  });

  it("the executing (non-commented) part contains no DELETE or DROP COLUMN — only the RPC drops and the category re-point/reactivate steps", () => {
    const executingLines = rollback
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    expect(executingLines).not.toMatch(/\bdelete from wholesale_equipment_types\b/i);
    expect(executingLines).not.toMatch(/\bdrop column\b/i);
    expect(executingLines).toContain("drop function if exists public.wholesale_swap_equipment_type_sort_order");
    expect(executingLines).toContain("drop function if exists public.wholesale_delete_equipment_type");
  });

  it("re-points the 3 categories back to Video Consoles and reactivates it, executing (not commented out)", () => {
    const executingLines = rollback
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    expect(executingLines).toMatch(/equipment_type_id = \(select id from wholesale_equipment_types where slug = 'video-consoles'\)/);
    expect(executingLines).toMatch(/set active = true, sort_order = 6, updated_at = now\(\)\s*\nwhere slug = 'video-consoles';/);
  });

  it("re-points macbook-air/macbook-pro back to macbook, and reactivates macbook and gaming-laptops, executing (not commented out)", () => {
    const executingLines = rollback
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    expect(executingLines).toMatch(/equipment_type_id = \(select id from wholesale_equipment_types where slug = 'macbook'\)/);
    expect(executingLines).toMatch(/where slug in \('macbook-air', 'macbook-pro'\);/);
    expect(executingLines).toMatch(/set active = true, sort_order = 3, updated_at = now\(\)\s*\nwhere slug = 'macbook';/);
    expect(executingLines).toMatch(/set active = true, sort_order = 5, updated_at = now\(\)\s*\nwhere slug = 'gaming-laptops';/);
  });

  it("clears laptops' Spanish name and restores its sort_order, executing (not commented out) — English name is left as 'Laptops' since the seed already used that name before this migration ever ran", () => {
    const executingLines = rollback
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    expect(executingLines).toMatch(/set name_es = null, sort_order = 4, updated_at = now\(\)\s*\nwhere slug = 'laptops';/);
  });

  it("the destructive delete-equipment-types and drop-columns sections are commented out by default", () => {
    expect(rollback).toMatch(/-- delete from wholesale_equipment_types where slug in \('ps5', 'xbox-series-x', 'switch'\);/);
    expect(rollback).toMatch(/-- alter table wholesale_equipment_types drop column if exists name_es;/);
  });

  it("the optional macbook photo reversal is commented out by default and only fires on the exact transfer signature (laptops has one, macbook doesn't)", () => {
    expect(rollback).toMatch(/-- update wholesale_images set\n--\s+equipment_type_id = \(select id from wholesale_equipment_types where slug = 'macbook'\)\n-- where equipment_type_id/);
    expect(rollback).toMatch(/-- where equipment_type_id = \(select id from wholesale_equipment_types where slug = 'laptops'\)/);
  });
});
