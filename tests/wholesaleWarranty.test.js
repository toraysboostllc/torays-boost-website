import { describe, it, expect } from "vitest";
import { isWarrantyActive, resolveWarrantyTerms } from "../src/lib/wholesaleWarranty.js";

/**
 * Global service warranty (Wholesale Shops -> Catalog -> Pricing & Sales
 * Settings in DESK) — ONE setting for the whole portal, applied to every
 * quote alike. There is NO per-service, per-equipment-type, or per-model
 * warranty concept anywhere in this codebase — these two pure functions are
 * the entire decision surface, and neither one ever reads a service/equipo/
 * model object of any kind.
 */

describe("isWarrantyActive: renders the box only when enabled AND a real positive duration is present", () => {
  it("true when enabled with a positive duration", () => {
    expect(isWarrantyActive({ enabled: true, durationDays: 60, termsEn: "x", termsEs: null })).toBe(true);
  });

  it("false when disabled, regardless of what duration/terms happen to be stored", () => {
    expect(isWarrantyActive({ enabled: false, durationDays: 60, termsEn: "x", termsEs: "y" })).toBe(false);
  });

  it("false when the warranty object itself is null/undefined — never throws", () => {
    expect(isWarrantyActive(null)).toBe(false);
    expect(isWarrantyActive(undefined)).toBe(false);
  });

  it("false when enabled but duration is missing/zero/negative/non-finite — a malformed object (should never happen given the schema-level CHECK constraint) degrades to 'don't render', never a broken 'undefined-Day' box", () => {
    expect(isWarrantyActive({ enabled: true, durationDays: null })).toBe(false);
    expect(isWarrantyActive({ enabled: true, durationDays: 0 })).toBe(false);
    expect(isWarrantyActive({ enabled: true, durationDays: -5 })).toBe(false);
    expect(isWarrantyActive({ enabled: true })).toBe(false);
    expect(isWarrantyActive({ enabled: true, durationDays: NaN })).toBe(false);
  });
});

describe("resolveWarrantyTerms: EN/ES fallback, same pattern as resolveServiceDescription", () => {
  it("prefers the language-matched terms when both are set", () => {
    const w = { termsEn: "60 days, parts and labor.", termsEs: "60 días, piezas y mano de obra." };
    expect(resolveWarrantyTerms(w, "es")).toBe("60 días, piezas y mano de obra.");
    expect(resolveWarrantyTerms(w, "en")).toBe("60 days, parts and labor.");
  });

  it("falls back to English when Spanish terms aren't set, even in Spanish mode", () => {
    expect(resolveWarrantyTerms({ termsEn: "60 days, parts and labor.", termsEs: null }, "es")).toBe(
      "60 days, parts and labor."
    );
  });

  it("falls back to Spanish when English terms aren't set, even in English mode", () => {
    expect(resolveWarrantyTerms({ termsEn: null, termsEs: "60 días, piezas y mano de obra." }, "en")).toBe(
      "60 días, piezas y mano de obra."
    );
  });

  it("returns null (never an empty string) when neither language has terms — the title still renders, just no terms paragraph", () => {
    expect(resolveWarrantyTerms({ termsEn: null, termsEs: null }, "en")).toBeNull();
    expect(resolveWarrantyTerms({ termsEn: "   ", termsEs: "  " }, "en")).toBeNull();
  });

  it("never throws on a null/undefined warranty object", () => {
    expect(resolveWarrantyTerms(null, "en")).toBeNull();
    expect(resolveWarrantyTerms(undefined, "es")).toBeNull();
  });
});
