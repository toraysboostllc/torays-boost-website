import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { formatTranslation } from "../src/i18n/translations.js";
import { wholesaleTranslations } from "../src/i18n/wholesaleTranslations.js";

/**
 * Correction round: the business photo (wholesale-wizard-background.webp)
 * used to live ONLY inside .wsp-wizard's own panel, with a second, distinct
 * PCB photo covering the rest of .wsp-scope around it. A real Preview
 * screenshot showed this literally — the photo appeared boxed inside the
 * wizard panel, never behind the header/greeting/locale-sound row or the
 * Sales module. This file verifies the corrected single-global-background
 * design: one photo, on .wsp-scope only, PCB removed entirely, .wsp-wizard
 * reduced to an image-less translucent glass panel over it.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const cssSrc = read("src/styles/wholesalePortal.css");

function ruleBlock(css, selector) {
  const idx = css.indexOf(`${selector} {`);
  if (idx === -1) return null;
  return css.slice(idx, css.indexOf("\n}", idx) + 2);
}

describe("wholesalePortal.css: the business photo is the SINGLE global background on .wsp-scope", () => {
  const scopeBlock = ruleBlock(cssSrc, ".wsp-scope");

  it(".wsp-scope's background-image references wholesale-wizard-background.webp", () => {
    expect(scopeBlock).toContain('url("../assets/wholesale-wizard-background.webp")');
  });

  it("the photo is used in exactly ONE url(...) reference — never shown twice — even though the correction-pass comment above also names the file in prose", () => {
    const matches = cssSrc.match(/url\("\.\.\/assets\/wholesale-wizard-background\.webp"\)/g) || [];
    expect(matches).toHaveLength(1);
  });

  it("uses background-size: cover (no tiling/repetition possible) and background-repeat: no-repeat explicitly — a single layer now, no comma-separated second value", () => {
    expect(scopeBlock).toMatch(/background-size:\s*cover;/);
    expect(scopeBlock).toMatch(/background-repeat:\s*no-repeat;/);
    expect(scopeBlock).not.toMatch(/background-size:\s*cover,/);
    expect(scopeBlock).not.toMatch(/background-repeat:\s*no-repeat,/);
  });

  it("never uses background-attachment: fixed on mobile — scroll is the base declaration, fixed only applies inside a min-width:768px query", () => {
    expect(scopeBlock).toMatch(/background-attachment:\s*scroll;/);
    const fixedIdx = cssSrc.indexOf("background-attachment: fixed;");
    expect(fixedIdx).toBeGreaterThan(-1);
    const precedingMediaIdx = cssSrc.lastIndexOf("@media", fixedIdx);
    const mediaLine = cssSrc.slice(precedingMediaIdx, cssSrc.indexOf("{", precedingMediaIdx));
    expect(mediaLine).toContain("min-width: 768px");
  });

  it("has a narrow-width override biasing the position toward the business/negotiation side (78% center), same crop bias already approved for this photo", () => {
    const narrowIdx = cssSrc.indexOf("@media (max-width: 767px)");
    const narrowBlock = cssSrc.slice(narrowIdx, cssSrc.indexOf("}\n}", narrowIdx) + 3);
    expect(narrowBlock).toContain(".wsp-scope");
    expect(narrowBlock).toMatch(/background-position:\s*78% center;/);
  });

  it("the default (wide-viewport) position is centered, showing both the electronics (left) and negotiation/shop (right) sides", () => {
    expect(scopeBlock).toMatch(/background-position:\s*center;/);
  });

  it("no gradient, opacity, filter, or blend-mode alters the photo's own colors — the photo must render exactly as exported", () => {
    expect(scopeBlock).not.toContain("linear-gradient(");
    expect(scopeBlock).not.toContain("radial-gradient(");
    expect(scopeBlock).not.toContain("filter:");
    expect(scopeBlock).not.toMatch(/(?<!background-)opacity:/);
    expect(cssSrc).not.toContain("background-blend-mode");
  });
});

describe("wholesalePortal.css: the PCB background is completely removed, never referenced anywhere", () => {
  it("no rule anywhere references wholesale-pcb-background.webp", () => {
    expect(cssSrc).not.toContain("wholesale-pcb-background.webp");
  });
});

describe("wholesalePortal.css: .wsp-wizard is an image-less translucent glass panel, never a second photo", () => {
  const wizardBlock = ruleBlock(cssSrc, ".wsp-wizard");

  it("has no background-image / url(...) of its own at all", () => {
    expect(wizardBlock).not.toContain("background-image");
    expect(wizardBlock).not.toContain("url(");
    expect(wizardBlock).not.toContain(".webp");
  });

  it("uses a translucent LIGHT ice-blue background-color (--wsp-wizard-glass-rgb) — the dark navy glass from the first correction pass was rejected as an unapproved dark rectangle", () => {
    expect(wizardBlock).toMatch(/background-color:\s*rgba\(var\(--wsp-wizard-glass-rgb\),\s*0\.\d+\)/);
    expect(wizardBlock).not.toContain("--wsp-navy-rgb");
  });

  it("applies a backdrop-filter blur — the 'glass' treatment that lets the global photo show through, softened, from underneath", () => {
    expect(wizardBlock).toMatch(/backdrop-filter:\s*blur\(/);
    expect(wizardBlock).toMatch(/-webkit-backdrop-filter:\s*blur\(/);
  });

  it("no longer has its own narrow-width background-position override — that concern moved to .wsp-scope, the panel has no image to position", () => {
    // The 78%-center override block immediately following .wsp-wizard in the
    // old design targeted `.wsp-wizard` specifically; confirm that specific
    // pairing is gone (the SAME 78%/center values now target .wsp-scope,
    // asserted in the describe block above).
    const wizardMediaMatch = cssSrc.match(/@media \(max-width: 767px\) \{\s*\.wsp-wizard \{/);
    expect(wizardMediaMatch).toBeNull();
  });
});

describe("wholesalePortal.css: money-bearing panels and equipment cards keep their own opaque/high-contrast backgrounds, untouched by this round", () => {
  it(".wsp-card (plain, non-clickable — used by WholesaleResultPanel/WholesaleSalesModule) still uses the opaque card background token", () => {
    const cardBlock = ruleBlock(cssSrc, ".wsp-card");
    expect(cardBlock).toContain("background: var(--wsp-card-bg)");
  });

  it(".wsp-card-clickable (equipment/model photo cards) keeps its own light, high-legibility translucent background", () => {
    const clickableBlock = ruleBlock(cssSrc, ".wsp-card-clickable");
    expect(clickableBlock).toMatch(/background:\s*rgba\(238, 243, 252,/);
  });
});

describe("i18n: the shop-name interpolation path never truncates a trailing character — 'Carlis' stays 'Carlis'", () => {
  // Traced end to end (Supabase read -> API response -> React state ->
  // t("portal.welcome", { shopName }) -> formatTranslation): every hop is a
  // verbatim passthrough, and formatTranslation() is the one piece of that
  // chain this repo actually owns and can test directly. This proves the
  // interpolation mechanism itself cannot be the source of a dropped
  // trailing "s" — if the portal ever shows "Carli" instead of "Carlis",
  // the stored value in Supabase's wholesale_shops.name column is the
  // place to look, not this code.
  it("formatTranslation('Welcome, {shopName}', { shopName: 'Carlis' }) returns the shop name completely intact", () => {
    const result = formatTranslation("Welcome, {shopName}", { shopName: "Carlis" });
    expect(result).toBe("Welcome, Carlis");
    expect(result).not.toBe("Welcome, Carli");
  });

  it("the real installed en/es portal.welcome templates, run through formatTranslation with a real shop name, never drop a trailing character", () => {
    const enTemplate = wholesaleTranslations.en.portal.welcome;
    const esTemplate = wholesaleTranslations.es.portal.welcome;
    expect(formatTranslation(enTemplate, { shopName: "Carlis" })).toBe("Welcome, Carlis");
    expect(formatTranslation(esTemplate, { shopName: "Carlis" })).toBe("Bienvenido, Carlis");
  });

  it("survives multiple different trailing letters (not just 's') — confirms this isn't a coincidental pass for one specific string", () => {
    for (const name of ["Carlis", "Torays", "ACME Repairs", "Best Buy Shop", "X"]) {
      expect(formatTranslation("Welcome, {shopName}", { shopName: name })).toBe(`Welcome, ${name}`);
    }
  });

  it("formatTranslation itself contains no .slice()/.substring()/.substr() or trailing-character stripping of any kind", () => {
    const translationsSrc = read("src/i18n/translations.js");
    const fnIdx = translationsSrc.indexOf("export function formatTranslation");
    const fnEnd = translationsSrc.indexOf("\n}", fnIdx);
    const fnBody = translationsSrc.slice(fnIdx, fnEnd);
    expect(fnBody).not.toMatch(/\.slice\(/);
    expect(fnBody).not.toMatch(/\.substring\(/);
    expect(fnBody).not.toMatch(/\.substr\(/);
    expect(fnBody).toContain("replaceAll");
  });

  it("WholesalePrices.jsx passes state.shopName straight through to t(), no intermediate transform on the value", () => {
    const pageSrc = read("src/pages/WholesalePrices.jsx");
    expect(pageSrc).toContain('t("portal.welcome", { shopName: state.shopName })');
  });
});
