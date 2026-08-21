import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Coverage for the dynamic-equipment-types migration: 3 new columns
 * (name_es, image_focus_x/y, full_bleed_photo) on wholesale_equipment_types,
 * PlayStation 5 / Xbox Series X / Nintendo Switch converted from categories
 * nested under "Video Consoles" into real equipment_types rows, the exact
 * requested 8-card visual order, and the two new admin RPCs (atomic reorder,
 * guarded delete). This project has no jsdom/DOM test environment and no
 * live Postgres available in CI — these are source-scan assertions against
 * the SQL files' content, the same convention already used throughout this
 * suite for every other migration quartet.
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

describe("wholesale-dynamic-equipment-types-migration.sql: does NOT guess a final visual order — collision-free placeholder for the 3 new rows only", () => {
  // A prior version of this migration hardcoded sort_order = 1..8 against 8
  // specific slugs, including the assumption that 'gaming-laptops' is the
  // "Laptops" card. A real audit (replaying the actual seed data against an
  // isolated Postgres instance) proved that assumption wrong: 'laptops' and
  // 'gaming-laptops' are both seeded with zero services (empty placeholder
  // categories), while 'macbook' — not even part of the approved card list —
  // has real, populated categories. Hardcoding per-slug sort_order values
  // for rows this migration doesn't actually know the real state of risks
  // silent, non-erroring collisions (sort_order has no uniqueness
  // constraint). These tests pin the corrected, honest design instead.

  it("only ps5/xbox-series-x/switch get their sort_order touched by this migration — no hardcoded assumption about which slug is 'Laptops'", () => {
    // Scope to statements that assign sort_order by slug (this migration's step 5).
    // wholesale_swap_equipment_type_sort_order's own body also contains
    // "update wholesale_equipment_types set sort_order = ..." lines (it swaps
    // two existing rows' values by id, not slug) — those are a different,
    // pre-existing, already-tested RPC and must not be counted here.
    const sortBySlugStatements = migration.match(/update wholesale_equipment_types set sort_order = \([\s\S]*?where slug = '[^']+';/g) || [];
    expect(sortBySlugStatements).toHaveLength(3);
    for (const slug of ["ps5", "xbox-series-x", "switch"]) {
      expect(sortBySlugStatements.some((l) => l.includes(`where slug = '${slug}'`))).toBe(true);
    }
    expect(migration).not.toMatch(/where slug = 'gaming-laptops'/);
    expect(migration).not.toMatch(/where slug = 'laptops'/);
    expect(migration).not.toMatch(/where slug = 'macbook'/);
  });

  it("each of the 3 new rows gets a sort_order strictly greater than every existing row (collision-free by construction, never a hardcoded literal)", () => {
    const sortBlock = migration.match(/update wholesale_equipment_types set sort_order = \(([\s\S]*?)\), updated_at = now\(\) where slug = 'ps5';/);
    expect(sortBlock, "ps5 sort_order assignment not found").toBeTruthy();
    expect(sortBlock[1]).toContain("select coalesce(max(sort_order), 0) + 1 from wholesale_equipment_types");
  });

  it("the migration's own header documents WHY it stopped short of a final order, referencing the real audit finding, not just asserting a design choice", () => {
    expect(migration).toMatch(/'laptops' and\s+'gaming-laptops' are seeded as empty/);
    expect(migration).toContain("'macbook'");
    expect(migration).toContain("never mentioned in the approved 8-card list");
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
  it("does NOT wrap the whole file in begin;/rollback; around checks 1-8 the way other verify files do -- but the file still ends in rollback;, never commit;, and every synthetic write happens inside its own nested self-cleaning block", () => {
    const lines = verify.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines[lines.length - 1]).toBe("rollback;");
    expect(verify).not.toMatch(/\ncommit;/);
  });

  it("checks that PS5/Xbox/Switch are real, active, non-tag-lens equipment types with their same-slug category correctly repointed", () => {
    expect(verify).toContain("ps5_xbox_switch_are_real_equipment_types_with_categories_repointed");
    expect(verify).toMatch(/et\.slug in \('ps5', 'xbox-series-x', 'switch'\) and et\.is_tag_lens = false and et\.active = true/);
  });

  it("checks referential integrity for services and price_history under the migrated categories (relations preserved)", () => {
    expect(verify).toContain("no_orphaned_services_for_the_3_migrated_categories");
    expect(verify).toContain("price_history_for_migrated_categories_intact");
  });

  it("checks the 3 new rows get a collision-free sort_order and zero duplicate slugs overall (order-safety + duplicate-prevention coverage, not a hardcoded final order)", () => {
    expect(verify).toContain("new_rows_sort_order_collision_free");
    expect(verify).toContain("no_duplicate_equipment_type_slugs");
    expect(verify).not.toContain("sort_order_matches_requested_visual_order");
  });

  it("checks Microsoldering's identity is untouched — does NOT assert a specific sort_order, since this migration deliberately never reassigns it", () => {
    expect(verify).toContain("microsoldering_untouched_identity");
    expect(verify).toMatch(/is_tag_lens = true\s*\n\s*\) = 1 and exists/);
    expect(verify).not.toContain("microsoldering_untouched_and_first_in_order");
    expect(verify).not.toMatch(/slug = 'microsoldering' and is_tag_lens = true and sort_order = 1/);
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
    expect(verify).toContain("microsoldering_row_survives_the_rejected_delete_attempt_in_check_10");
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

  it("the executing (non-commented) part contains no DELETE or DROP COLUMN — only the RPC drops and the category re-point/reactivate", () => {
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
    expect(executingLines).toMatch(/set active = true, updated_at = now\(\)\s*\nwhere slug = 'video-consoles';/);
  });

  it("the destructive delete-equipment-types and drop-columns sections are commented out by default", () => {
    expect(rollback).toMatch(/-- delete from wholesale_equipment_types where slug in \('ps5', 'xbox-series-x', 'switch'\);/);
    expect(rollback).toMatch(/-- alter table wholesale_equipment_types drop column if exists name_es;/);
  });
});
