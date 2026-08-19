import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { wholesaleTranslations } from "../src/i18n/wholesaleTranslations.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const contextSrc = read("src/i18n/WholesaleLocaleContext.jsx");
const mainTranslationsSrc = read("src/i18n/translations.js");

function flattenKeys(obj, prefix = "") {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "object" && value !== null ? flattenKeys(value, path) : [path];
  });
}

describe("wholesaleTranslations.js: EN and ES have exactly the same keys", () => {
  it("no key exists in one language and not the other", () => {
    const enKeys = flattenKeys(wholesaleTranslations.en).sort();
    const esKeys = flattenKeys(wholesaleTranslations.es).sort();
    expect(enKeys).toEqual(esKeys);
  });

  it("every string value is non-empty in both languages", () => {
    for (const lang of ["en", "es"]) {
      for (const key of flattenKeys(wholesaleTranslations[lang])) {
        const value = key.split(".").reduce((node, part) => node[part], wholesaleTranslations[lang]);
        expect(typeof value, `${lang}.${key}`).toBe("string");
        expect(value.trim().length, `${lang}.${key} is empty`).toBeGreaterThan(0);
      }
    }
  });

  it("the exact required strings from the approved spec are present verbatim in Spanish", () => {
    expect(wholesaleTranslations.es.progress.headline).toBe("Aumenta tu ganancia con Torays Boost");
    expect(wholesaleTranslations.es.progress.barLabel).toBe("Calculando tu precio mayorista…");
    expect(wholesaleTranslations.es.progress.stepEquipmentConfirmed).toBe("Equipo confirmado");
    expect(wholesaleTranslations.es.progress.stepFaultIdentified).toBe("Falla identificada");
    expect(wholesaleTranslations.es.progress.stepCalculating).toBe("Calculando oportunidad");
    expect(wholesaleTranslations.es.result.title).toBe("Precio listo");
    expect(wholesaleTranslations.es.result.shopPrice).toBe("Tu precio Shop");
    expect(wholesaleTranslations.es.result.recommendedPrice).toBe("Precio recomendado");
    expect(wholesaleTranslations.es.result.potentialProfit).toBe("Ganancia potencial");
    expect(wholesaleTranslations.es.result.estimatedMargin).toBe("Margen estimado");
    expect(wholesaleTranslations.es.result.customerPriceLabel).toBe("¿Cuánto cobrarás a tu cliente?");
    expect(wholesaleTranslations.es.result.keepCustomerNote).toBe("Tú mantienes a tu cliente. Nosotros hacemos la microsoldadura.");
    expect(wholesaleTranslations.es.result.disclaimer).toBe("Estimación antes de otros gastos.");
    expect(wholesaleTranslations.es.result.consultAnother).toBe("Consultar otro precio");
    expect(wholesaleTranslations.es.microsoldering.title).toBe("Microsoldadura");
    expect(wholesaleTranslations.es.microsoldering.subtitle).toBe("Reparación avanzada de placa");
    expect(wholesaleTranslations.es.portal.badge).toBe("Portal Mayorista");
    expect(wholesaleTranslations.es.portal.privateArea).toBe("Área privada");
    expect(wholesaleTranslations.es.portal.title).toBe("Consulta tus precios mayoristas");
    expect(wholesaleTranslations.es.sales.maintenanceMessage).toBe(
      "Torays Boost Sales está en mantenimiento. Próximamente podrás comprar piezas, equipos y accesorios con precios especiales para shops."
    );
  });

  it("welcome message uses {shopName} interpolation, never a hardcoded shop name", () => {
    expect(wholesaleTranslations.en.portal.welcome).toContain("{shopName}");
    expect(wholesaleTranslations.es.portal.welcome).toContain("{shopName}");
  });

  it("never mentions a guaranteed profit — 'potential'/'estimated' language only, per the explicit no-guarantees requirement", () => {
    const flatten = (obj) => Object.values(obj).flatMap((v) => (typeof v === "string" ? [v] : flatten(v)));
    for (const lang of ["en", "es"]) {
      const all = flatten(wholesaleTranslations[lang]).join(" ").toLowerCase();
      expect(all).not.toMatch(/guaranteed profit|ganancia garantizada|profit guarantee/);
    }
  });
});

describe("WholesaleLocaleContext.jsx: completely separate from the public site's LanguageContext", () => {
  it("never imports from LanguageContext.jsx or the public translations dictionary's translations object", () => {
    expect(contextSrc).not.toContain('from "./LanguageContext.jsx"');
    expect(contextSrc).not.toMatch(/import\s*\{\s*translations[,\s]/);
  });

  it("only reuses the generic formatTranslation() helper from translations.js — not its content", () => {
    expect(contextSrc).toContain('import { formatTranslation } from "./translations.js"');
  });

  it("imports its own dictionary and pure locale-logic module", () => {
    expect(contextSrc).toContain('from "./wholesaleTranslations.js"');
    expect(contextSrc).toContain('from "../lib/wholesaleLocale.js"');
  });

  it("exports WholesaleLocaleProvider and useWholesaleLocale", () => {
    expect(contextSrc).toContain("export function WholesaleLocaleProvider");
    expect(contextSrc).toContain("export function useWholesaleLocale");
  });

  it("useWholesaleLocale throws outside its own provider, same guard pattern as useLanguage", () => {
    expect(contextSrc).toMatch(/if \(!ctx\) throw new Error\(.*WholesaleLocaleProvider/);
  });

  it("country and currency are not exposed as setters — only language is switchable today", () => {
    expect(contextSrc).not.toContain("setCountry");
    expect(contextSrc).not.toContain("setCurrency");
    expect(contextSrc).toContain("setLanguage");
  });
});

describe("Scope: the public site's translations.js is untouched by this round beyond exporting formatTranslation (already existed)", () => {
  it("translations.js has no new wholesale-specific keys added to its own dictionary", () => {
    expect(mainTranslationsSrc).not.toMatch(/wholesalePortal|wholesaleWizard|wholesaleResult/);
  });
});
