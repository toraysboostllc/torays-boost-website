import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { generateWholesaleSeedSql } from "../scripts/generateWholesaleSeedSql.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlFilePath = join(__dirname, "..", "supabase", "wholesale-seed-initial-catalog.sql");

describe("supabase/wholesale-seed-initial-catalog.sql matches the JS source data", () => {
  it("is byte-for-byte what generateWholesaleSeedSql() produces right now", () => {
    const committed = readFileSync(sqlFilePath, "utf8");
    const freshlyGenerated = generateWholesaleSeedSql();
    expect(committed).toBe(freshlyGenerated);
  });

  it("has exactly 21 category inserts and 74 service inserts, each with ON CONFLICT (slug) DO NOTHING", () => {
    const sql = readFileSync(sqlFilePath, "utf8");
    const categoryInserts = sql.match(/insert into wholesale_categories/g) || [];
    const serviceInserts = sql.match(/insert into wholesale_services/g) || [];
    const conflictClauses = sql.match(/on conflict \(slug\) do nothing;/g) || [];
    expect(categoryInserts).toHaveLength(21);
    expect(serviceInserts).toHaveLength(74);
    expect(conflictClauses).toHaveLength(21 + 74);
  });

  it("places the ATA / Level 3 Repair note on the category row only", () => {
    const sql = readFileSync(sqlFilePath, "utf8");
    const categoryLine = sql.split("\n").find((l) => l.includes("'iphone-15-17'") && l.startsWith("values"));
    expect(categoryLine).toContain("ATA / Level 3 Repair");
  });

  it("is wrapped in an explicit transaction — fails whole, rolls back whole", () => {
    const sql = readFileSync(sqlFilePath, "utf8");
    const lines = sql.split("\n").filter((l) => l.trim().length > 0);
    expect(lines.find((l) => l.trim() === "begin;")).toBeTruthy();
    expect(lines[lines.length - 1].trim()).toBe("commit;");
  });
});
