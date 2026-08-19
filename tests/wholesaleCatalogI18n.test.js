import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { translateCatalogLabel } from "../src/lib/wholesaleCatalogI18n.js";
import { WHOLESALE_CATALOG_SEED } from "../scripts/wholesaleCatalogSeed.data.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

describe("translateCatalogLabel: display-only translation, never touches the stored value", () => {
  it("returns the raw name unchanged for English, regardless of whether a translation exists", () => {
    expect(translateCatalogLabel("Controllers", "en")).toBe("Controllers");
    expect(translateCatalogLabel("No Power", "en")).toBe("No Power");
    expect(translateCatalogLabel("A totally unmapped name", "en")).toBe("A totally unmapped name");
  });

  it('translates "Controllers" to "Controles" in Spanish — the explicit required fix', () => {
    expect(translateCatalogLabel("Controllers", "es")).toBe("Controles");
  });

  it("falls back to the original English name in Spanish when no translation is mapped — never blank, never throws", () => {
    expect(translateCatalogLabel("A totally unmapped name", "es")).toBe("A totally unmapped name");
  });

  it("never mutates or re-derives the input — same string identity semantics as a pure lookup", () => {
    const raw = "PlayStation 5";
    // No ES entry exists for this literal brand/model name — passthrough.
    expect(translateCatalogLabel(raw, "es")).toBe(raw);
  });

  it("handles null/undefined/non-string input without throwing", () => {
    expect(translateCatalogLabel(null, "es")).toBeNull();
    expect(translateCatalogLabel(undefined, "es")).toBeUndefined();
    expect(translateCatalogLabel("", "es")).toBe("");
  });
});

describe("translateCatalogLabel: every distinct service name in the real seed catalog has a Spanish mapping", () => {
  it("no service name from scripts/wholesaleCatalogSeed.data.js falls through to English under Spanish", () => {
    const allServiceNames = new Set();
    for (const category of WHOLESALE_CATALOG_SEED) {
      for (const service of category.services) {
        allServiceNames.add(service.name);
      }
    }
    expect(allServiceNames.size).toBeGreaterThan(0);
    const untranslated = [...allServiceNames].filter((name) => translateCatalogLabel(name, "es") === name);
    expect(untranslated).toEqual([]);
  });

  it("every category/model name is either deliberately identical in Spanish (proper nouns/model numbers) or has a real translation — spot-checks", () => {
    // Proper nouns / model numbers stay identical in both languages — not a
    // missing translation, a deliberate no-op.
    expect(translateCatalogLabel("MacBook Air", "es")).toBe("MacBook Air");
    expect(translateCatalogLabel("iPhone 12 / 13 / 14", "es")).toBe("iPhone 12 / 13 / 14");
    // Real translations.
    expect(translateCatalogLabel("Xbox Series X/S Controller", "es")).toBe("Control Xbox Series X/S");
    expect(translateCatalogLabel("Laptops (Standard)", "es")).toBe("Laptops (Estándar)");
    expect(translateCatalogLabel("Gaming Laptops", "es")).toBe("Laptops Gamer");
  });
});

describe("Components wire translateCatalogLabel in for every catalog-sourced name they render", () => {
  it("EquipmentTypeCard translates entity.name for display, but keeps the raw value for alt text fallback and onClick untouched", () => {
    const src = read("src/components/wholesale/EquipmentTypeCard.jsx");
    expect(src).toContain(
      'import { translateCatalogLabel } from "../../lib/wholesaleCatalogI18n.js";'
    );
    expect(src).toContain("const displayName = translateCatalogLabel(entity.name, language);");
    expect(src).toContain("{displayName}");
  });

  it("WholesaleWizard translates each Falla (service) name in the fault list", () => {
    const src = read("src/components/wholesale/WholesaleWizard.jsx");
    expect(src).toContain(
      'import { translateCatalogLabel } from "../../lib/wholesaleCatalogI18n.js";'
    );
    expect(src).toContain("{translateCatalogLabel(service.name, language)}");
  });
});
