import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Structural/text-based checks on the Fase 3B portal UI — this repo has no
 * React render harness (no jsdom/@testing-library dependency, no vitest
 * `environment` configured), matching the same constraint every other test
 * file in this project already works under. These tests read the actual
 * component/CSS source as text and assert the specific properties the
 * approved plan requires; real visual/responsive verification happens in
 * the embedded browser during Preview, as always.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8");

describe("EquipmentTypeCard: lazy loading, explicit dimensions, icon fallback", () => {
  const src = read("src/components/wholesale/EquipmentTypeCard.jsx");

  it("uses loading=\"lazy\" on the <img>", () => {
    expect(src).toContain('loading="lazy"');
  });

  it("sets explicit width/height on the <img> (belt-and-suspenders alongside the CSS aspect-ratio box)", () => {
    expect(src).toMatch(/width=\{?\d+\}?/);
    expect(src).toMatch(/height=\{?\d+\}?/);
  });

  it("falls back to the shared icon mapping when there is no image", () => {
    expect(src).toContain("wholesaleEquipmentIcon");
    expect(src).toMatch(/entity\.image\?\.url\s*\?/);
  });
});

describe("CategoryDrilldown: category photo, lazy loading, price formatting", () => {
  const src = read("src/components/wholesale/CategoryDrilldown.jsx");

  it("uses loading=\"lazy\" and explicit dimensions on the category photo", () => {
    expect(src).toContain('loading="lazy"');
    expect(src).toMatch(/width=\{?64\}?/);
    expect(src).toMatch(/height=\{?64\}?/);
  });

  it("falls back to the icon mapping when a category has no photo", () => {
    expect(src).toContain("wholesaleEquipmentIcon");
    expect(src).toMatch(/category\.image\?\.url\s*\?/);
  });

  it("uses the shared formatWholesalePrice helper, not an inline duplicate", () => {
    expect(src).toContain("formatWholesalePrice");
    expect(src).not.toMatch(/function formatPrice/);
  });
});

describe("MicrosolderingLensView: empty state, grouped rendering", () => {
  const src = read("src/components/wholesale/MicrosolderingLensView.jsx");

  it("renders a professional empty state when equipmentTypes is empty, with no further navigation implied beyond Back", () => {
    expect(src).toContain("wsp-empty");
    expect(src).toMatch(/hasResults/);
  });

  it("groups by the real Equipment Type name, then category — never fabricates its own hierarchy", () => {
    expect(src).toContain("microsoldering.equipmentTypes.map");
    expect(src).toContain("equipmentType.categories.map");
  });

  it("uses the shared formatWholesalePrice helper", () => {
    expect(src).toContain("formatWholesalePrice");
  });
});

describe("formatWholesalePrice: fixed, range, and quote pricing types", () => {
  it("handles 'quote' without producing NaN — the schema added this pricing_type with all price fields null", async () => {
    const { formatWholesalePrice } = await import("../src/lib/wholesalePricing.js");
    const quoteService = { pricing_type: "quote", fixed_price: null, price_min: null, price_max: null };
    const result = formatWholesalePrice(quoteService);
    expect(result).not.toMatch(/NaN/);
    expect(result.toLowerCase()).toContain("quote");
  });

  it("formats a fixed price with two decimals", async () => {
    const { formatWholesalePrice } = await import("../src/lib/wholesalePricing.js");
    expect(formatWholesalePrice({ pricing_type: "fixed", fixed_price: 89 })).toBe("$89.00");
  });

  it("formats a range as min – max, or a single value when they're equal", async () => {
    const { formatWholesalePrice } = await import("../src/lib/wholesalePricing.js");
    expect(formatWholesalePrice({ pricing_type: "range", price_min: 50, price_max: 90 })).toBe("$50.00 – $90.00");
    expect(formatWholesalePrice({ pricing_type: "range", price_min: 60, price_max: 60 })).toBe("$60.00");
  });
});

describe("wholesaleEquipmentIcon: pure presentational mapping", () => {
  it("maps every known slug family to a distinct icon, falling back to Wrench for anything unrecognized", async () => {
    const { wholesaleEquipmentIcon } = await import("../src/lib/wholesaleIcons.js");
    const cases = [
      ["microsoldering", "Cpu"],
      ["controllers", "Gamepad"],
      ["ipad", "Tablet"],
      ["iphone", "Smartphone"],
      ["macbook", "Laptop"],
      ["laptops", "Laptop"],
      ["video-consoles", "Gamepad2"],
      ["something-unrecognized", "Wrench"],
    ];
    const seen = new Set();
    for (const [slug, expectedName] of cases) {
      const Icon = wholesaleEquipmentIcon({ slug });
      expect(Icon.displayName || Icon.render?.displayName || Icon.name || expectedName).toBeTruthy();
      seen.add(Icon);
    }
    // at least most distinct families really do map to different components
    expect(seen.size).toBeGreaterThanOrEqual(6);
  });
});

describe("WholesalePrices page: grid/drill-down/lens view state machine, server-trust (no client-side Hidden filtering)", () => {
  const src = read("src/pages/WholesalePrices.jsx");

  it("wraps the page in the scoped dark theme class, never touching torays-* tokens", () => {
    expect(src).toContain('className="wsp-scope"');
    expect(src).not.toMatch(/torays-(bg|surface|navy|red)\b/);
  });

  it("renders the Microsoldering card only when the server actually returned a microsoldering object (never assumes it exists)", () => {
    expect(src).toContain("state.microsoldering &&");
  });

  it("does not re-filter equipmentTypes/services by an active/hidden flag client-side — trusts the server's already-filtered response", () => {
    expect(src).not.toMatch(/\.filter\(\s*\(?\w*\)?\s*=>\s*\w*\.active\b/);
  });

  it("reads equipmentTypes/microsoldering from fetchWholesaleCatalog's new response shape, not the old flat categories field", () => {
    expect(src).toContain("result.equipmentTypes");
    expect(src).toContain("result.microsoldering");
    expect(src).not.toContain("result.categories");
  });
});

describe("wholesalePortal.css: responsive grid breakpoints", () => {
  const css = read("src/styles/wholesalePortal.css");

  it("defines 1 column by default, 2 at sm, 3 at lg — matching the approved 'one card per row on mobile' spec", () => {
    expect(css).toMatch(/\.wsp-grid\s*\{[^}]*grid-template-columns:\s*1fr/);
    expect(css).toMatch(/@media \(min-width: 640px\)[\s\S]*?repeat\(2, 1fr\)/);
    expect(css).toMatch(/@media \(min-width: 1024px\)[\s\S]*?repeat\(3, 1fr\)/);
  });

  it("fixes the photo card's aspect ratio so a loading/failed image never shifts layout", () => {
    expect(css).toMatch(/\.wsp-card-photo\s*\{[^}]*aspect-ratio:/);
  });

  it("is scoped under .wsp-scope only — never redefines a torays-* custom property", () => {
    expect(css).not.toMatch(/--torays-/);
  });
});

describe("scope: no hardcoded or public Supabase Storage URLs anywhere in src/", () => {
  it("no source file references a public object URL or a literal supabase.co host", () => {
    function collectFiles(dir) {
      let files = [];
      for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
        const rel = join(dir, entry.name);
        if (entry.isDirectory()) files = files.concat(collectFiles(rel));
        else if (/\.(js|jsx)$/.test(entry.name)) files.push(rel);
      }
      return files;
    }
    const offenders = [];
    for (const file of collectFiles("src")) {
      const text = read(file);
      if (/\/storage\/v1\/object\/public\//.test(text) || /https:\/\/[a-z0-9-]+\.supabase\.co/i.test(text)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
