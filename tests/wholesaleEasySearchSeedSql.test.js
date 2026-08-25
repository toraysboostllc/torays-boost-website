import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { generateWholesaleEasySearchSeedSql } from "../scripts/generateWholesaleEasySearchSeedSql.js";
import { EASY_SEARCH_DEVICE_SEED } from "../scripts/wholesaleEasySearchSeed.data.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlFilePath = join(__dirname, "..", "supabase", "wholesale-easy-search-seed.sql");

describe("supabase/wholesale-easy-search-seed.sql matches the JS source data", () => {
  it("is byte-for-byte what generateWholesaleEasySearchSeedSql() produces right now", () => {
    const committed = readFileSync(sqlFilePath, "utf8");
    const freshlyGenerated = generateWholesaleEasySearchSeedSql();
    expect(committed).toBe(freshlyGenerated);
  });

  it("has exactly 55 devices (28 Apple + 27 Samsung) and one code-insert block per device", () => {
    const apple = EASY_SEARCH_DEVICE_SEED.filter((d) => d.brand === "Apple");
    const samsung = EASY_SEARCH_DEVICE_SEED.filter((d) => d.brand === "Samsung");
    expect(apple).toHaveLength(28);
    expect(samsung).toHaveLength(27);

    const sql = readFileSync(sqlFilePath, "utf8");
    const modelInserts = sql.match(/insert into wholesale_device_models/g) || [];
    const codeInserts = sql.match(/insert into wholesale_device_model_codes/g) || [];
    expect(modelInserts).toHaveLength(55);
    expect(codeInserts).toHaveLength(55);
  });

  it("never includes A2214 as a code anywhere (verified not a real iPhone model number)", () => {
    const sql = readFileSync(sqlFilePath, "utf8");
    expect(sql).not.toMatch(/'A2214'/);
  });

  it("attaches A2218 to iPhone 11 Pro Max with region US", () => {
    const device = EASY_SEARCH_DEVICE_SEED.find((d) => d.commercialName === "iPhone 11 Pro Max");
    const code = device.codes.find((c) => c.code === "A2218");
    expect(code.region).toBe("US");
  });

  it("attaches A3575 to iPhone 17e, not iPhone 17 Pro Max", () => {
    const proMax = EASY_SEARCH_DEVICE_SEED.find((d) => d.commercialName === "iPhone 17 Pro Max");
    const seventeenE = EASY_SEARCH_DEVICE_SEED.find((d) => d.commercialName === "iPhone 17e");
    expect(proMax.codes.some((c) => c.code === "A3575")).toBe(false);
    expect(proMax.year).toBe(2025);
    expect(seventeenE.codes.some((c) => c.code === "A3575")).toBe(true);
  });

  it("replaces the CSV's wrong 'iPhone SE (4a gen)/A3300' with iPhone 16e", () => {
    expect(EASY_SEARCH_DEVICE_SEED.some((d) => d.commercialName.includes("SE (4"))).toBe(false);
    const sixteenE = EASY_SEARCH_DEVICE_SEED.find((d) => d.commercialName === "iPhone 16e");
    expect(sixteenE).toBeTruthy();
    expect(sixteenE.codes.map((c) => c.code)).toEqual(["A3212", "A3408", "A3410", "A3409"]);
  });

  it("gives the Galaxy S23 Ultra all three explicit test codes (B, U, U1)", () => {
    const device = EASY_SEARCH_DEVICE_SEED.find((d) => d.commercialName === "Galaxy S23 Ultra");
    expect(device.codes.map((c) => c.code).sort()).toEqual(["SM-S918B", "SM-S918U", "SM-S918U1"]);
  });

  it("adds no fabricated US code for the 9 Samsung models confirmed to never have had one", () => {
    const noUsCode = ["Galaxy S5", "Galaxy Note 4", "Galaxy S6", "Galaxy Note 5", "Galaxy J7 (2016)", "Galaxy A7 (2018)", "Galaxy A52s 5G", "Galaxy A55 5G"];
    for (const name of noUsCode) {
      const device = EASY_SEARCH_DEVICE_SEED.find((d) => d.commercialName === name);
      expect(device, `expected a seed row for ${name}`).toBeTruthy();
      expect(device.codes).toHaveLength(1);
      expect(device.codes[0].region).toBe("Intl");
    }
  });

  it("splits every combined 'A1549 / A1586'-style CSV cell into independent code rows on the same device", () => {
    const iphone6 = EASY_SEARCH_DEVICE_SEED.find((d) => d.commercialName === "iPhone 6");
    expect(iphone6.codes.map((c) => c.code)).toEqual(["A1549", "A1586"]);
  });

  it("leaves catalog_model_id unset for every seeded row — no insert column list mentions it at all (the header comment explaining why is fine, prose isn't code)", () => {
    const sql = readFileSync(sqlFilePath, "utf8");
    const insertLines = sql.split("\n").filter((l) => l.startsWith("insert into wholesale_device_models") || l.startsWith("select 'Apple'") || l.startsWith("select 'Samsung'"));
    for (const line of insertLines) {
      expect(line).not.toContain("catalog_model_id");
    }
  });

  it("is idempotent — every model insert is guarded by WHERE NOT EXISTS, every code insert by ON CONFLICT DO NOTHING", () => {
    const sql = readFileSync(sqlFilePath, "utf8");
    const modelGuards = sql.match(/where not exists \(select 1 from wholesale_device_models/g) || [];
    const codeConflicts = sql.match(/on conflict \(normalized_code\) do nothing;/g) || [];
    expect(modelGuards).toHaveLength(55);
    expect(codeConflicts).toHaveLength(55);
  });

  it("is wrapped in an explicit transaction — fails whole, rolls back whole", () => {
    const sql = readFileSync(sqlFilePath, "utf8");
    const lines = sql.split("\n").filter((l) => l.trim().length > 0);
    expect(lines.find((l) => l.trim() === "begin;")).toBeTruthy();
    expect(lines[lines.length - 1].trim()).toBe("commit;");
  });
});
