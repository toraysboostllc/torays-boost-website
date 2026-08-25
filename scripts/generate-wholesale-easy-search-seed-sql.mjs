#!/usr/bin/env node
/**
 * Regenerates supabase/wholesale-easy-search-seed.sql from
 * scripts/wholesaleEasySearchSeed.data.js. Run this whenever that data file
 * changes — tests/wholesaleEasySearchSeedSql.test.js fails the build if the
 * committed .sql file and the JS data ever drift apart.
 *
 *   node scripts/generate-wholesale-easy-search-seed-sql.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { generateWholesaleEasySearchSeedSql } from "./generateWholesaleEasySearchSeedSql.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "..", "supabase", "wholesale-easy-search-seed.sql");

writeFileSync(outPath, generateWholesaleEasySearchSeedSql(), "utf8");
console.log(`Wrote ${outPath}`);
