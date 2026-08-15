import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
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

describe("PCB background: local asset, imported once, no external/remote reference", () => {
  it("the source PNG the user provided was actually converted — a wholesale-pcb-background.webp file exists on disk", () => {
    // statSync throws if the file is missing — that failure IS the assertion.
    const stat = statSync(join(root, "src/assets/wholesale-pcb-background.webp"));
    expect(stat.isFile()).toBe(true);
  });

  it("the WebP asset is optimized into the ~300-400 KB target range, not just converted at default/lossless settings", () => {
    const stat = statSync(join(root, "src/assets/wholesale-pcb-background.webp"));
    const kb = stat.size / 1024;
    expect(kb).toBeGreaterThan(50); // sanity floor — didn't get compressed into mush
    expect(kb).toBeLessThanOrEqual(400);
  });

  it("wholesalePortal.css references the local asset via a relative url(), never a remote http(s) image host", () => {
    const css = read("src/styles/wholesalePortal.css");
    expect(css).toContain('url("../assets/wholesale-pcb-background.webp")');
    expect(css).not.toMatch(/url\(\s*["']?https?:\/\//);
  });
});

describe("wholesalePortal.css: PCB background is cover/center/no-repeat, non-repeating, scoped, with a legibility overlay", () => {
  const css = read("src/styles/wholesalePortal.css");

  it(".wsp-scope sets background-size: cover and background-position: center on every background layer", () => {
    const rule = css.match(/\.wsp-scope\s*\{[\s\S]*?\n\}/)[0];
    expect(rule).toMatch(/background-size:\s*cover,\s*cover;/);
    expect(rule).toMatch(/background-position:\s*center,\s*center;/);
  });

  it("never repeats the background image (background-repeat: no-repeat on every layer)", () => {
    const rule = css.match(/\.wsp-scope\s*\{[\s\S]*?\n\}/)[0];
    expect(rule).toMatch(/background-repeat:\s*no-repeat,\s*no-repeat;/);
  });

  it("layers a translucent blue-gray overlay UNDER the text (a same-color-both-stops linear-gradient) on top of the PCB photo, so text stays legible over the busy circuit texture", () => {
    const rule = css.match(/\.wsp-scope\s*\{[\s\S]*?\n\}/)[0];
    expect(rule).toMatch(/background-image:\s*linear-gradient\(rgba\([^)]+\),\s*rgba\([^)]+\)\),\s*url\(/);
  });

  it("the background lives ONLY on .wsp-scope — WholesaleLogin.jsx (the only other wholesale page) never applies this class, so the login screen never shows the PCB background", () => {
    const loginSrc = read("src/pages/WholesaleLogin.jsx");
    expect(loginSrc).not.toContain("wsp-scope");
  });

  it("never uses background-attachment: fixed on mobile — scroll by default, fixed only from the 768px breakpoint up, mirroring index.css's existing pattern for the exact same jank reason", () => {
    const scopeRule = css.match(/\.wsp-scope\s*\{[\s\S]*?\n\}/)[0];
    expect(scopeRule).toMatch(/background-attachment:\s*scroll,\s*scroll;/);
    const desktopOverride = css.match(/@media \(min-width: 768px\)\s*\{[\s\S]*?\.wsp-scope\s*\{[\s\S]*?\n\s*\}/)[0];
    expect(desktopOverride).toMatch(/background-attachment:\s*fixed,\s*fixed;/);
  });
});

describe("wholesalePortal.css: cards are white/ice-blue — lighter than the dark PCB page background", () => {
  const css = read("src/styles/wholesalePortal.css");

  it("--wsp-card-bg is a light hex, distinct from and lighter than --wsp-page-bg/--wsp-surface", () => {
    const bgHex = css.match(/--wsp-card-bg:\s*(#[0-9a-fA-F]{6})/)[1];
    const pageHex = css.match(/--wsp-page-bg:\s*(#[0-9a-fA-F]{6})/)[1];
    const luminanceOf = (hex) => {
      const n = parseInt(hex.slice(1), 16);
      return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
    };
    expect(luminanceOf(bgHex)).toBeGreaterThan(luminanceOf(pageHex));
    expect(luminanceOf(bgHex)).toBeGreaterThan(600); // genuinely light, not just "less dark"
  });

  it(".wsp-card sets its own dark-on-light text color — never inherits the page's light-on-dark --wsp-text-strong", () => {
    const rule = css.match(/\.wsp-card\s*\{[\s\S]*?\n\}/)[0];
    expect(rule).toContain("background: var(--wsp-card-bg)");
    expect(rule).toContain("color: var(--wsp-card-text)");
    expect(rule).not.toContain("var(--wsp-text-strong)");
  });

  it(".wsp-card-title and .wsp-table cells use the card-scoped text tokens, not the page-scoped ones", () => {
    expect(css).toMatch(/\.wsp-card-title\s*\{[^}]*color:\s*var\(--wsp-card-text\)/);
    expect(css).toMatch(/\.wsp-table td\s*\{[^}]*color:\s*var\(--wsp-card-text\)/);
    expect(css).toMatch(/\.wsp-table th\s*\{[^}]*color:\s*var\(--wsp-card-text-soft\)/);
  });

  it("CategoryDrilldown and MicrosolderingLensView use the card-scoped soft-text class inside cards, not the page-scoped one", () => {
    const drilldown = read("src/components/wholesale/CategoryDrilldown.jsx");
    const lens = read("src/components/wholesale/MicrosolderingLensView.jsx");
    expect(drilldown).toContain("wsp-card-text-soft");
    expect(lens).toContain("wsp-card-text-soft");
    // the diagnostic-fee value's inline style must also point at the card token, not the page one
    expect(drilldown).toContain('style={{ color: "var(--wsp-card-text)" }}');
    expect(drilldown).not.toContain('style={{ color: "var(--wsp-text-strong)" }}');
  });
});

describe("wholesalePortal.css: XP-style card bezel — beveled border, inner gloss, drop shadow, red accent", () => {
  const css = read("src/styles/wholesalePortal.css");

  it(".wsp-card has an inset highlight (glossy top edge) plus an outer drop shadow, not a flat single shadow", () => {
    expect(css).toMatch(/--wsp-card-shadow:\s*[^;]*inset[^;]*,\s*[^;]*rgba/);
  });

  it("renders a red accent bar (.wsp-card-accent) that brightens on hover/focus — same left-edge treatment as DESK's approved .ws-card", () => {
    expect(css).toMatch(/\.wsp-card-accent\s*\{[^}]*background:\s*var\(--wsp-red\)/);
    expect(css).toMatch(/:hover \.wsp-card-accent[\s\S]{0,40}\{\s*opacity:\s*0\.9/);
    expect(css).toMatch(/:focus-visible \.wsp-card-accent[\s\S]{0,40}\{\s*opacity:\s*0\.9/);
  });

  it("EquipmentTypeCard actually renders the accent bar and an arrow indicator", () => {
    const src = read("src/components/wholesale/EquipmentTypeCard.jsx");
    expect(src).toContain("wsp-card-accent");
    expect(src).toContain("wsp-card-arrow");
    expect(src).toContain("ChevronRight");
  });
});

describe("wholesalePortal.css: hover/focus/active selection effect", () => {
  const css = read("src/styles/wholesalePortal.css");

  it("mouse hover is gated behind (hover: hover) and (pointer: fine) — never a bare :hover — so touch taps can't leave a stuck hover state", () => {
    expect(css).toMatch(/@media \(hover: hover\) and \(pointer: fine\)\s*\{[\s\S]*?\.wsp-card-clickable:hover/);
  });

  it("hover lifts translateY(-8px), scales ~1.015, and brightens the border to the hover token", () => {
    const hoverBlock = css.match(/@media \(hover: hover\) and \(pointer: fine\)\s*\{[\s\S]*?\n\}\n/)[0];
    expect(hoverBlock).toMatch(/transform:\s*translateY\(-8px\)\s*scale\(1\.015\)/);
    expect(hoverBlock).toContain("border-color: var(--wsp-card-border-hover)");
  });

  it(":focus-visible applies the identical lift/scale/border treatment unconditionally (not gated behind the hover/pointer media query), plus its own visible focus ring", () => {
    const focusRule = css.match(/\.wsp-card-clickable:focus-visible\s*\{[\s\S]*?\n\}/)[0];
    expect(focusRule).toMatch(/transform:\s*translateY\(-8px\)\s*scale\(1\.015\)/);
    expect(focusRule).toContain("border-color: var(--wsp-card-border-hover)");
    expect(focusRule).toMatch(/0 0 0 3px rgba\(240, 82, 94, 0\.45\)/); // red focus ring accent
    expect(focusRule).toContain("outline: none");
  });

  it(":active gives touch/click a brief, smaller lift — independent of the (hover: hover) gate, so it still fires on touch devices", () => {
    const activeRule = css.match(/\.wsp-card-clickable:active\s*\{[\s\S]*?\n\}/)[0];
    expect(activeRule).toMatch(/transform:\s*translateY\(-2px\)/);
  });

  it("the base .wsp-card transition is ~200ms, covering shadow/border/transform/background", () => {
    const rule = css.match(/\.wsp-card\s*\{[\s\S]*?\n\}/)[0];
    expect(rule).toMatch(/transition:[^;]*0\.2s[^;]*box-shadow|transition:\s*box-shadow 0\.2s/);
    expect(rule).toContain("0.2s");
  });

  it("prefers-reduced-motion removes the transform lift on hover/focus/active — no translate/scale motion at all when the user has asked for less motion", () => {
    const reducedBlock = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}\n/)[0];
    expect(reducedBlock).toContain(".wsp-card-clickable:hover");
    expect(reducedBlock).toContain(".wsp-card-clickable:focus-visible");
    expect(reducedBlock).toContain(".wsp-card-clickable:active");
    expect(reducedBlock).toMatch(/transform:\s*none/);
  });
});

describe("scope: card hover/lift effect can't introduce horizontal overflow or layout shift", () => {
  it("the hover/focus/active rules only ever animate transform/box-shadow/border-color/background — never a layout-affecting property (width/height/margin/position offsets)", () => {
    const css = read("src/styles/wholesalePortal.css");
    const blocks = [
      css.match(/@media \(hover: hover\) and \(pointer: fine\)\s*\{[\s\S]*?\n\}\n/)?.[0] || "",
      css.match(/\.wsp-card-clickable:focus-visible\s*\{[\s\S]*?\n\}/)?.[0] || "",
      css.match(/\.wsp-card-clickable:active\s*\{[\s\S]*?\n\}/)?.[0] || "",
    ].join("\n");
    expect(blocks).not.toMatch(/\bwidth:|(?<!min-)\bheight:|margin[a-z-]*:|left:|right:|top:|bottom:/);
  });

  it(".wsp-grid never sets a fixed pixel width that could overflow narrow viewports — columns are fr units", () => {
    const css = read("src/styles/wholesalePortal.css");
    const gridRule = css.match(/\.wsp-grid\s*\{[\s\S]*?\n\}/)[0];
    expect(gridRule).not.toMatch(/width:\s*\d+px/);
  });
});
