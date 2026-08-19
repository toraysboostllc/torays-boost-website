import { describe, it, expect } from "vitest";
import {
  SUPPORTED_LANGUAGES,
  SUPPORTED_COUNTRIES,
  SUPPORTED_CURRENCIES,
  detectInitialWholesaleLanguage,
  parseStoredWholesaleLocale,
  formatWholesalePrice,
} from "../src/lib/wholesaleLocale.js";

describe("SUPPORTED_* constants: exactly what the approved spec allows today", () => {
  it("only English and Spanish", () => {
    expect(SUPPORTED_LANGUAGES).toEqual(["en", "es"]);
  });

  it("only the United States", () => {
    expect(SUPPORTED_COUNTRIES).toEqual(["US"]);
  });

  it("only USD", () => {
    expect(SUPPORTED_CURRENCIES).toEqual(["USD"]);
  });
});

describe("detectInitialWholesaleLanguage: saved preference always wins over browser language", () => {
  it("uses the saved preference when one exists, ignoring the browser language entirely", () => {
    const result = detectInitialWholesaleLanguage(
      () => "es",
      () => "en-US"
    );
    expect(result).toBe("es");
  });

  it("falls back to browser language only when nothing was saved", () => {
    const result = detectInitialWholesaleLanguage(
      () => null,
      () => "es-MX"
    );
    expect(result).toBe("es");
  });

  it("browser language 'en-US' with nothing saved resolves to 'en'", () => {
    const result = detectInitialWholesaleLanguage(
      () => null,
      () => "en-US"
    );
    expect(result).toBe("en");
  });

  it("an unrecognized browser language (e.g. French) defaults to English, never crashes", () => {
    const result = detectInitialWholesaleLanguage(
      () => null,
      () => "fr-FR"
    );
    expect(result).toBe("en");
  });

  it("a corrupted/invalid saved value (not 'en' or 'es') is ignored, falls through to browser language", () => {
    const result = detectInitialWholesaleLanguage(
      () => "fr",
      () => "es-ES"
    );
    expect(result).toBe("es");
  });

  it("handles missing getter functions gracefully (SSR/build-time safety)", () => {
    expect(detectInitialWholesaleLanguage(undefined, undefined)).toBe("en");
  });

  it("handles a browser language getter that returns null/undefined", () => {
    expect(detectInitialWholesaleLanguage(() => null, () => null)).toBe("en");
  });
});

describe("parseStoredWholesaleLocale: never throws on bad input", () => {
  it("parses a valid JSON blob", () => {
    expect(parseStoredWholesaleLocale('{"language":"es","country":"US","currency":"USD"}')).toEqual({
      language: "es",
      country: "US",
      currency: "USD",
    });
  });

  it("returns null for missing/empty input", () => {
    expect(parseStoredWholesaleLocale(null)).toBeNull();
    expect(parseStoredWholesaleLocale("")).toBeNull();
    expect(parseStoredWholesaleLocale(undefined)).toBeNull();
  });

  it("returns null for malformed JSON instead of throwing", () => {
    expect(parseStoredWholesaleLocale("{not valid json")).toBeNull();
  });

  it("returns null for valid JSON that isn't an object (e.g. a bare string or number)", () => {
    expect(parseStoredWholesaleLocale('"just a string"')).toBeNull();
    expect(parseStoredWholesaleLocale("42")).toBeNull();
  });
});

describe("formatWholesalePrice: Intl.NumberFormat, never manual string concatenation", () => {
  it("formats a whole-dollar amount with the $ sign and .00", () => {
    expect(formatWholesalePrice(150, { language: "en", currency: "USD" })).toBe("$150.00");
  });

  it("formats a cents amount correctly", () => {
    expect(formatWholesalePrice(150.94, { language: "en", currency: "USD" })).toBe("$150.94");
  });

  it("formats identically in currency terms for es (USD is USD regardless of language — grouping/decimal style may differ, the numeric content must not)", () => {
    const en = formatWholesalePrice(1234.5, { language: "en", currency: "USD" });
    const es = formatWholesalePrice(1234.5, { language: "es", currency: "USD" });
    expect(en).toContain("1,234.50");
    expect(en.startsWith("$")).toBe(true);
    expect(es).toMatch(/1,234\.50|1234\.50/); // es-US grouping can render either way depending on ICU data
  });

  it("returns an em dash placeholder for non-finite/invalid amounts instead of 'NaN' or '$undefined'", () => {
    expect(formatWholesalePrice(NaN)).toBe("—");
    expect(formatWholesalePrice(undefined)).toBe("—");
    expect(formatWholesalePrice(null)).toBe("—");
    expect(formatWholesalePrice("150")).toBe("—");
    expect(formatWholesalePrice(Infinity)).toBe("—");
  });

  it("defaults to English/USD formatting when called with no options", () => {
    expect(formatWholesalePrice(80)).toBe("$80.00");
  });
});
