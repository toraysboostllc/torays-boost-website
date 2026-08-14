/**
 * Pure function: turns WHOLESALE_CATALOG_SEED into the SQL text for
 * supabase/wholesale-seed-initial-catalog.sql. No file I/O here on
 * purpose — generate-wholesale-seed-sql.mjs does the writing, and
 * tests/wholesaleSeedSql.test.js calls this directly to confirm the
 * committed .sql file hasn't drifted from the JS data it's generated from.
 */
import { WHOLESALE_CATALOG_SEED, DIAGNOSTIC_DESCRIPTION } from "./wholesaleCatalogSeed.data.js";

function sqlStr(value) {
  return value == null ? "null" : `'${String(value).replace(/'/g, "''")}'`;
}
function sqlNum(value) {
  return value == null ? "null" : String(value);
}
function sqlBool(value) {
  return value ? "true" : "false";
}

export function generateWholesaleSeedSql() {
  const lines = [];
  lines.push("-- ============================================================================");
  lines.push("-- Initial wholesale catalog — GENERATED, do not edit by hand.");
  lines.push("-- Source of truth: scripts/wholesaleCatalogSeed.data.js");
  lines.push("-- Regenerate with: node scripts/generate-wholesale-seed-sql.mjs");
  lines.push("--");
  lines.push("-- Run this in the Supabase SQL Editor immediately after wholesale-migration.sql.");
  lines.push("-- This is the ONLY way the initial catalog gets loaded — no script, no Service");
  lines.push("-- Role Key typed into a terminal, nothing to end up in shell history.");
  lines.push("--");
  lines.push("-- Idempotent: every insert uses ON CONFLICT (slug) DO NOTHING, matched against");
  lines.push("-- the stable `slug` column — safe to run more than once, and never overwrites a");
  lines.push("-- row already edited from TORAYS BOOST DESK.");
  lines.push("-- Wrapped in BEGIN/COMMIT: if anything below fails, Postgres rolls back the whole");
  lines.push("-- file, never a half-loaded catalog.");
  lines.push("-- Everything is created inactive; review and activate from DESK.");
  lines.push("-- ============================================================================");
  lines.push("");
  lines.push("begin;");
  lines.push("");

  for (const cat of WHOLESALE_CATALOG_SEED) {
    lines.push(`-- ${cat.name}`);
    lines.push("insert into wholesale_categories (slug, name, notes, diagnostic_fee, diagnostic_description, active, sort_order)");
    lines.push(
      `values (${sqlStr(cat.slug)}, ${sqlStr(cat.name)}, ${sqlStr(cat.notes)}, ${sqlNum(null)}, ${sqlStr(
        DIAGNOSTIC_DESCRIPTION
      )}, ${sqlBool(false)}, ${sqlNum(cat.sortOrder)})`
    );
    lines.push("on conflict (slug) do nothing;");
    lines.push("");

    cat.services.forEach((s, i) => {
      const fixedPrice = s.pricingType === "fixed" ? s.fixedPrice : null;
      const priceMin = s.pricingType === "range" ? s.priceMin : null;
      const priceMax = s.pricingType === "range" ? s.priceMax : null;
      lines.push("insert into wholesale_services (slug, category_id, name, pricing_type, fixed_price, price_min, price_max, notes, active, sort_order)");
      lines.push(
        `select ${sqlStr(s.slug)}, id, ${sqlStr(s.name)}, ${sqlStr(s.pricingType)}, ${sqlNum(fixedPrice)}, ${sqlNum(priceMin)}, ${sqlNum(
          priceMax
        )}, ${sqlStr(s.notes)}, ${sqlBool(false)}, ${sqlNum(i)}`
      );
      lines.push(`from wholesale_categories where slug = ${sqlStr(cat.slug)}`);
      lines.push("on conflict (slug) do nothing;");
      lines.push("");
    });
  }

  lines.push("commit;");

  return lines.join("\n");
}
