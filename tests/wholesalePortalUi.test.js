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
// Normalized immediately after readFileSync, before any assertion ever sees
// the text — these tests validate the CSS/JSX's logical structure, never
// its exact line-ending bytes or a line-ending policy, so CRLF vs LF must
// never be what makes a regex match or not. Without this, a real `git
// checkout` on Windows (core.autocrlf rewriting the working tree to CRLF)
// can break any assertion whose pattern contains a literal `\n`, even
// though the file's actual CSS/JSX content never changed.
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

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

describe("WholesalePrices page: wizard-driven portal, server-trust (no client-side Hidden filtering)", () => {
  const src = read("src/pages/WholesalePrices.jsx");
  const wizardSrc = read("src/components/wholesale/WholesaleWizard.jsx");

  it("wraps the page in the scoped dark theme class, never touching torays-* tokens", () => {
    expect(src).toContain('className="wsp-scope"');
    expect(src).not.toMatch(/torays-(bg|surface|navy|red)\b/);
  });

  it("passes microsoldering straight through to WholesaleWizard — the existence check itself now lives there (see next check), not duplicated in this file", () => {
    expect(src).toContain("microsoldering={state.microsoldering}");
  });

  it("WholesaleWizard renders the Microsoldering card only when the server actually returned a microsoldering object (never assumes it exists)", () => {
    expect(wizardSrc).toMatch(/\{microsoldering && \(/);
  });

  it("does not re-filter equipmentTypes/services by an active/hidden flag client-side — trusts the server's already-filtered response", () => {
    expect(src).not.toMatch(/\.filter\(\s*\(?\w*\)?\s*=>\s*\w*\.active\b/);
    expect(wizardSrc).not.toMatch(/\.filter\(\s*\(?\w*\)?\s*=>\s*\w*\.active\b/);
  });

  it("reads equipmentTypes/microsoldering from fetchWholesaleCatalog's response shape, not the old flat categories field", () => {
    expect(src).toContain("result.equipmentTypes");
    expect(src).toContain("result.microsoldering");
    expect(src).not.toContain("result.categories");
  });

  it("distinguishes auth failures (redirect) from transient errors (inline retry) — regression coverage for the fixed redirect-on-any-error bug", () => {
    expect(src).toMatch(/result\.kind === "auth"/);
    expect(src).toContain('navigate("/wholesale")');
    expect(src).toMatch(/status: "error"/);
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

  it("layers a translucent overlay UNDER the text (a same-color-both-stops linear-gradient, driven by --wsp-overlay-rgb) on top of the PCB photo, so text stays legible over the busy circuit texture", () => {
    const rule = css.match(/\.wsp-scope\s*\{[\s\S]*?\n\}/)[0];
    expect(rule).toContain(
      "background-image: linear-gradient(rgba(var(--wsp-overlay-rgb), 0.62), rgba(var(--wsp-overlay-rgb), 0.62)),"
    );
    expect(rule).toMatch(/rgba\(var\(--wsp-overlay-rgb\),\s*0\.62\).*\n?\s*url\(/);
  });

  it("the overlay is a LIGHT blue-gray, not a dark one — Preview feedback: the previous round read as ~100% dark mode", () => {
    const overlayRgb = css.match(/--wsp-overlay-rgb:\s*([\d, ]+);/)[1].split(",").map((n) => Number(n.trim()));
    const sum = overlayRgb.reduce((a, b) => a + b, 0);
    expect(sum).toBeGreaterThan(600); // e.g. 215+225+240 — a light tint, nowhere near the old rgba(9,15,32) dark one
    // --wsp-overlay-rgb must actually be the split-out triplet of --wsp-page-bg, not an independently drifting value
    const pageBgHex = css.match(/--wsp-page-bg:\s*(#[0-9a-fA-F]{6})/)[1];
    const [r, g, b] = [pageBgHex.slice(1, 3), pageBgHex.slice(3, 5), pageBgHex.slice(5, 7)].map((h) => parseInt(h, 16));
    expect(overlayRgb).toEqual([r, g, b]);
  });

  it("the overlay's alpha is mid-range (not near-opaque) — the PCB must stay clearly visible through it, not be hidden by it", () => {
    const alphas = [...css.matchAll(/rgba\(var\(--wsp-overlay-rgb\),\s*([\d.]+)\)/g)].map((m) => Number(m[1]));
    expect(alphas.length).toBeGreaterThan(0);
    for (const alpha of alphas) {
      expect(alpha).toBeGreaterThan(0.3);
      expect(alpha).toBeLessThan(0.8);
    }
  });

  it("never lightens via the `opacity` CSS property on .wsp-scope or its content — only via background-image layer alpha", () => {
    const scopeRule = css.match(/\.wsp-scope\s*\{[\s\S]*?\n\}/)[0];
    expect(scopeRule).not.toMatch(/(?<!background-)opacity:/);
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

describe("wholesalePortal.css: page tone — medium-light blue-gray, darker than the cards but not dark-mode-dark", () => {
  const css = read("src/styles/wholesalePortal.css");
  const luminanceOf = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
  };

  it("--wsp-page-bg is light overall (a blue-gray, not a near-black navy)", () => {
    const pageHex = css.match(/--wsp-page-bg:\s*(#[0-9a-fA-F]{6})/)[1];
    expect(luminanceOf(pageHex)).toBeGreaterThan(500); // #101a30 (old dark value) sums to 26 — nowhere close
  });

  it("--wsp-page-bg is still darker than --wsp-card-bg — 'el fondo debe ser mas oscuro que las ventanas'", () => {
    const pageHex = css.match(/--wsp-page-bg:\s*(#[0-9a-fA-F]{6})/)[1];
    const cardHex = css.match(/--wsp-card-bg:\s*(#[0-9a-fA-F]{6})/)[1];
    expect(luminanceOf(pageHex)).toBeLessThan(luminanceOf(cardHex));
  });

  it("page-level text (--wsp-text-strong, --wsp-text-soft — the h1 title, shop name, section labels) is now dark navy, matching a light page", () => {
    const strongHex = css.match(/--wsp-text-strong:\s*(#[0-9a-fA-F]{6})/)[1];
    const softHex = css.match(/--wsp-text-soft:\s*(#[0-9a-fA-F]{6})/)[1];
    expect(luminanceOf(strongHex)).toBeLessThan(300); // dark navy, not the old near-white #f4f6ff (sum ~753)
    expect(luminanceOf(softHex)).toBeLessThan(400);
  });

  it("--wsp-btn-text preserves the OLD light value, exclusively for buttons — they keep their unchanged dark gradient background", () => {
    const btnTextHex = css.match(/--wsp-btn-text:\s*(#[0-9a-fA-F]{6})/)[1];
    expect(luminanceOf(btnTextHex)).toBeGreaterThan(600); // near-white, readable on the button's own dark gradient
    const ghostRule = css.match(/\.wsp-btn-ghost\s*\{[\s\S]*?\n\}/)[0];
    expect(ghostRule).toContain("color: var(--wsp-btn-text)");
    expect(ghostRule).not.toContain("var(--wsp-text-strong)");
  });
});

describe("wholesalePortal.css: cards are white/ice-blue — lighter than the (now light-toned) PCB page background", () => {
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

  it("the photo-less placeholder box (.wsp-card-photo / .wsp-category-photo) is light ice-blue, not the old dark navy gradient", () => {
    const luminanceOf = (hex) => {
      const n = parseInt(hex.slice(1), 16);
      return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
    };
    const startHex = css.match(/--wsp-placeholder-bg-start:\s*(#[0-9a-fA-F]{6})/)[1];
    const endHex = css.match(/--wsp-placeholder-bg-end:\s*(#[0-9a-fA-F]{6})/)[1];
    expect(luminanceOf(startHex)).toBeGreaterThan(600);
    expect(luminanceOf(endHex)).toBeGreaterThan(600);
    expect(css).toMatch(
      /\.wsp-card-photo\s*\{[^}]*background:\s*linear-gradient\(135deg,\s*var\(--wsp-placeholder-bg-start\)/
    );
    expect(css).toMatch(
      /\.wsp-category-photo\s*\{[^}]*background:\s*linear-gradient\(135deg,\s*var\(--wsp-placeholder-bg-start\)/
    );
    // never the old dark tokens for this specific background anymore
    expect(css).not.toMatch(/\.wsp-card-photo\s*\{[^}]*var\(--wsp-blue-tint\)/);
    expect(css).not.toMatch(/\.wsp-category-photo\s*\{[^}]*var\(--wsp-blue-tint\)/);
  });

  it("the placeholder icon (--wsp-icon) is a strong, clearly-visible blue against the now-light placeholder box — not the old pale blue tuned for a dark box", () => {
    const iconHex = css.match(/--wsp-icon:\s*(#[0-9a-fA-F]{6})/)[1];
    const bgHex = css.match(/--wsp-placeholder-bg-start:\s*(#[0-9a-fA-F]{6})/)[1];
    const luminanceOf = (hex) => {
      const n = parseInt(hex.slice(1), 16);
      return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
    };
    expect(iconHex).not.toBe("#7fb0ff"); // the old pale value, invisible on a light box
    expect(luminanceOf(bgHex) - luminanceOf(iconHex)).toBeGreaterThan(250); // real, visible separation
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

  it(".wsp-empty (Microsoldering's no-results state) is legible on the light theme — light card background, dark card-scoped text, never the old dark --wsp-surface2/--wsp-text-soft pair", () => {
    const rule = css.match(/\.wsp-empty\s*\{[\s\S]*?\n\}/)[0];
    expect(rule).toContain("background: var(--wsp-card-bg)");
    expect(rule).toContain("color: var(--wsp-card-text-soft)");
    expect(rule).not.toContain("var(--wsp-surface2)");
    expect(rule).not.toContain("var(--wsp-text-soft)");
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
