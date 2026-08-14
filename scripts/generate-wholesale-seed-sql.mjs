#!/usr/bin/env node
/**
 * Regenerates supabase/wholesale-seed-initial-catalog.sql from
 * scripts/wholesaleCatalogSeed.data.js. Run this whenever that data file
 * changes — tests/wholesaleSeedSql.test.js fails the build if the
 * committed .sql file and the JS data ever drift apart.
 *
 *   node scripts/generate-wholesale-seed-sql.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { generateWholesaleSeedSql } from "./generateWholesaleSeedSql.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "..", "supabase", "wholesale-seed-initial-catalog.sql");

writeFileSync(outPath, generateWholesaleSeedSql(), "utf8");
console.log(`Wrote ${outPath}`);
