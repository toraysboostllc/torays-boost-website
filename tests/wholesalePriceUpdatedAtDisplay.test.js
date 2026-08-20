import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { formatWholesaleDate } from "../src/lib/wholesaleLocale.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const resultPanelSrc = readFileSync(join(root, "src/components/wholesale/WholesaleResultPanel.jsx"), "utf8");

describe("formatWholesaleDate: never fabricates a date", () => {
  it("returns null for null (a service with no recorded price_history yet)", () => {
    expect(formatWholesaleDate(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(formatWholesaleDate(undefined)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(formatWholesaleDate("")).toBeNull();
  });

  it("returns null for a malformed date string (never Invalid Date / NaN leaking through)", () => {
    expect(formatWholesaleDate("not-a-real-date")).toBeNull();
  });

  it("returns a real formatted date for a valid ISO timestamp", () => {
    const result = formatWholesaleDate("2026-03-01T00:00:00.000Z", { language: "en" });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe("Invalid Date");
  });

  it("formats in Spanish when language: 'es' is passed, still a real date", () => {
    const result = formatWholesaleDate("2026-03-01T00:00:00.000Z", { language: "es" });
    expect(typeof result).toBe("string");
    expect(result).not.toBe("Invalid Date");
  });
});

describe("WholesaleResultPanel.jsx: price_updated_at rendering never fabricates a date", () => {
  it("renders formatDate(service.price_updated_at) with an explicit '—' fallback via the priceUpdatedNone key, never a bare formatDate() call that could show 'null'/'undefined'", () => {
    expect(resultPanelSrc).toContain('formatDate(service.price_updated_at) || t("result.priceUpdatedNone")');
  });

  it("never hardcodes today's date, Date.now(), or `new Date()` as a fallback for a missing price_updated_at", () => {
    expect(resultPanelSrc).not.toMatch(/Date\.now\(\)|new Date\(\)/);
  });

  it("destructures formatDate from useWholesaleLocale — reuses the shared locale-aware formatter, does not hand-roll its own date formatting", () => {
    expect(resultPanelSrc).toMatch(/const \{ t, formatPrice, formatDate, language \} = useWholesaleLocale\(\);/);
  });
});
