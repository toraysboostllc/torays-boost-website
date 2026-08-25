/**
 * Pure function: turns EASY_SEARCH_DEVICE_SEED into the SQL text for
 * supabase/wholesale-easy-search-seed.sql. No file I/O here on purpose —
 * generate-wholesale-easy-search-seed-sql.mjs does the writing, and
 * tests/wholesaleEasySearchSeedSql.test.js calls this directly to confirm
 * the committed .sql file hasn't drifted from the JS data it's generated
 * from. Mirrors scripts/generateWholesaleSeedSql.js's shape.
 */
import { EASY_SEARCH_DEVICE_SEED } from "./wholesaleEasySearchSeed.data.js";
import { normalizeEasySearchCode } from "../src/lib/wholesaleEasySearch.js";

function sqlStr(value) {
  return value == null ? "null" : `'${String(value).replace(/'/g, "''")}'`;
}
function sqlNum(value) {
  return value == null ? "null" : String(value);
}

export function generateWholesaleEasySearchSeedSql() {
  const lines = [];
  lines.push("-- ============================================================================");
  lines.push("-- Easy Search initial device directory — GENERATED, do not edit by hand.");
  lines.push("-- Source of truth: scripts/wholesaleEasySearchSeed.data.js");
  lines.push("-- Regenerate with: node scripts/generate-wholesale-easy-search-seed-sql.mjs");
  lines.push("--");
  lines.push("-- Run this in the Supabase SQL Editor immediately after");
  lines.push("-- wholesale-easy-search-migration.sql has verified PASS.");
  lines.push("--");
  lines.push("-- Idempotent: a model insert is guarded by WHERE NOT EXISTS on its own");
  lines.push("-- (brand, commercial_name) pair (neither table has a natural short slug the");
  lines.push("-- way wholesale_categories does), and every code insert uses");
  lines.push("-- ON CONFLICT (normalized_code) DO NOTHING — safe to run more than once, and");
  lines.push("-- never overwrites a row an admin has already edited from Desk's Easy Search");
  lines.push("-- panel. Wrapped in BEGIN/COMMIT: if anything below fails, Postgres rolls back");
  lines.push("-- the whole file, never a half-loaded directory.");
  lines.push("--");
  lines.push("-- catalog_model_id is intentionally left unset (null) for every row — see");
  lines.push("-- wholesaleEasySearchSeed.data.js's own header for why linking each device to");
  lines.push("-- a real Wholesale catalog Model is a Desk admin task, not something this seed");
  lines.push("-- safely infers.");
  lines.push("-- Everything is created active: true — this directory carries no pricing, so");
  lines.push("-- there is nothing here for an admin to review/activate before it's safe to");
  lines.push("-- show, unlike the priced catalog's own seed (which starts inactive).");
  lines.push("-- ============================================================================");
  lines.push("");
  lines.push("begin;");
  lines.push("");

  for (const device of EASY_SEARCH_DEVICE_SEED) {
    lines.push(`-- ${device.brand} ${device.commercialName}`);
    lines.push(
      "insert into wholesale_device_models (brand, commercial_name, device_category, year, screen, processor, ram, storage, main_camera, battery, active)"
    );
    lines.push(
      `select ${sqlStr(device.brand)}, ${sqlStr(device.commercialName)}, ${sqlStr(device.deviceCategory)}, `
        + `${sqlNum(device.year)}, ${sqlStr(device.screen)}, ${sqlStr(device.processor)}, ${sqlStr(device.ram)}, `
        + `${sqlStr(device.storage)}, ${sqlStr(device.mainCamera)}, ${sqlStr(device.battery)}, true`
    );
    lines.push(
      `where not exists (select 1 from wholesale_device_models where brand = ${sqlStr(device.brand)} `
        + `and commercial_name = ${sqlStr(device.commercialName)});`
    );
    lines.push("");

    const codeValues = device.codes
      .map((c) => `(${sqlStr(c.code)}, ${sqlStr(normalizeEasySearchCode(c.code))}, ${sqlStr(c.region)})`)
      .join(", ");
    lines.push("insert into wholesale_device_model_codes (device_model_id, code, normalized_code, region, active)");
    lines.push("select m.id, code_data.code, code_data.normalized_code, code_data.region, true");
    lines.push("from wholesale_device_models m");
    lines.push(`cross join (values ${codeValues}) as code_data(code, normalized_code, region)`);
    lines.push(`where m.brand = ${sqlStr(device.brand)} and m.commercial_name = ${sqlStr(device.commercialName)}`);
    lines.push("on conflict (normalized_code) do nothing;");
    lines.push("");
  }

  lines.push("commit;");

  return lines.join("\n");
}
