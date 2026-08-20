import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Coverage for the "photo covers the entire card edge-to-edge" treatment,
 * requested for exactly two wholesale portal cards: Microsoldering and
 * PlayStation 5 (the "ps5" promoted category — see
 * PROMOTED_CATEGORY_SLUGS in wholesaleWizardCatalog.js). Every other card
 * (iPhone, iPad, Laptops, Xbox Series X, Nintendo Switch/Switch OLED,
 * Controllers) must render through the exact same code path as before this
 * change. This project has no jsdom/DOM test environment (see every other
 * *.test.js file's own note) — these are source-scan assertions against the
 * component/stylesheet content, the same convention already used throughout
 * this suite.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const cardSrc = read("src/components/wholesale/EquipmentTypeCard.jsx");
const wizardSrc = read("src/components/wholesale/WholesaleWizard.jsx");
const catalogSrc = read("src/lib/wholesaleWizardCatalog.js");
const cssSrc = read("src/styles/wholesalePortal.css");

function extractSlugMap(src) {
  const match = src.match(/const WHOLESALE_FULL_BLEED_PHOTO_SLUGS = \{([\s\S]*?)\};/);
  expect(match, "WHOLESALE_FULL_BLEED_PHOTO_SLUGS map not found").toBeTruthy();
  const body = match[1];
  const entries = {};
  for (const m of body.matchAll(/(\w+):\s*"([^"]+)"/g)) entries[m[1]] = m[2];
  return entries;
}

describe("EquipmentTypeCard.jsx: WHOLESALE_FULL_BLEED_PHOTO_SLUGS contains exactly Microsoldering and PS5, nothing else", () => {
  it("has exactly 2 keys: microsoldering and ps5", () => {
    const map = extractSlugMap(cardSrc);
    expect(Object.keys(map).sort()).toEqual(["microsoldering", "ps5"]);
  });

  it("neither of the 6 untouched equipment-type slugs is present as a key", () => {
    const map = extractSlugMap(cardSrc);
    for (const untouchedSlug of ["iphone", "ipad", "laptop", "laptops", "xbox-series-x", "switch", "controllers"]) {
      expect(map[untouchedSlug], `${untouchedSlug} must not be in the full-bleed map`).toBeUndefined();
    }
  });

  it("each object-position value is a valid two-part CSS position (never empty, never a bare keyword that could distort intent)", () => {
    const map = extractSlugMap(cardSrc);
    for (const [slug, position] of Object.entries(map)) {
      expect(position, `${slug}'s object-position`).toMatch(/^\S+\s+\S+$/);
    }
  });
});

describe("EquipmentTypeCard.jsx: the full-bleed slug 'ps5' matches the real promoted-category slug used everywhere else", () => {
  it("PROMOTED_CATEGORY_SLUGS in wholesaleWizardCatalog.js includes 'ps5' — the two files' identifiers are not allowed to drift apart silently", () => {
    expect(catalogSrc).toMatch(/PROMOTED_CATEGORY_SLUGS = new Set\(\[[^\]]*"ps5"[^\]]*\]\)/);
  });

  it("wholesaleWizardCatalog.js's Equipo objects now carry a `slug` field (both the promoted-category branch and the pass-through equipment-type branch) — this is what makes entity.slug === 'ps5' possible at the card level", () => {
    expect(catalogSrc).toMatch(/id: category\.id,\s*\n\s*slug: category\.slug,/);
    expect(catalogSrc).toMatch(/id: equipmentType\.id,\s*\n\s*slug: equipmentType\.slug,/);
  });
});

describe("EquipmentTypeCard.jsx: the full-bleed slug 'microsoldering' matches the synthetic entity WholesaleWizard gives its own tile", () => {
  it("WholesaleWizard.jsx's Microsoldering EquipmentTypeCard is given entity.slug === 'microsoldering'", () => {
    expect(wizardSrc).toMatch(/entity=\{\{\s*slug:\s*"microsoldering"/);
  });
});

describe("EquipmentTypeCard.jsx: fullbleed only activates with a real, currently-loaded photo — never for the icon fallback", () => {
  it("fullBleedPosition is derived from showImage, not from entity.slug alone", () => {
    expect(cardSrc).toContain("const fullBleedPosition = showImage ? WHOLESALE_FULL_BLEED_PHOTO_SLUGS[entity.slug] : undefined;");
    expect(cardSrc).toContain("const isFullBleed = Boolean(fullBleedPosition);");
  });

  it("the wsp-card-fullbleed class and the gradient overlay are both conditional on isFullBleed", () => {
    expect(cardSrc).toContain('${isFullBleed ? " wsp-card-fullbleed" : ""}');
    expect(cardSrc).toContain('{isFullBleed && <span className="wsp-card-fullbleed-gradient" aria-hidden="true" />}');
  });

  it("object-position is applied via inline style only when isFullBleed — every other card's <img> gets no style override", () => {
    expect(cardSrc).toContain("style={isFullBleed ? { objectPosition: fullBleedPosition } : undefined}");
  });
});

describe("EquipmentTypeCard.jsx: title and arrow are always rendered, regardless of fullbleed — 'mantén visibles el nombre y la flecha'", () => {
  it("wsp-card-title and wsp-card-arrow are unconditional JSX, not gated behind isFullBleed", () => {
    const bodyMatch = cardSrc.match(/<div className="wsp-card-body[\s\S]*?<\/div>\s*<\/button>/);
    expect(bodyMatch, "wsp-card-body block not found").toBeTruthy();
    const body = bodyMatch[0];
    expect(body).toContain('<span className="wsp-card-title">{displayName}</span>');
    expect(body).toContain('<ChevronRight size={18} className="wsp-card-arrow" aria-hidden="true" />');
    expect(body).not.toMatch(/isFullBleed\s*&&\s*<span className="wsp-card-title"/);
    expect(body).not.toMatch(/isFullBleed\s*&&\s*<ChevronRight/);
  });
});

describe("EquipmentTypeCard.jsx / WholesaleWizard.jsx: no broken static-asset references — these two cards' photos are dynamic (Supabase Storage signed URLs via entity.image.url, admin-managed through DESK), never a bundled local file", () => {
  it("neither file imports a static image (.png/.jpg/.webp/.jfif) for microsoldering or ps5 — there is no such file in this repo to import", () => {
    expect(cardSrc).not.toMatch(/import .*\.(png|jpe?g|webp|jfif)/i);
    expect(wizardSrc).not.toMatch(/import .*\.(png|jpe?g|webp|jfif)/i);
  });

  it("the only image source for these cards remains entity.image.url / imageUrl — no hardcoded src string was introduced", () => {
    expect(cardSrc).toContain("src={imageUrl}");
    expect(cardSrc).not.toMatch(/src="\/(assets|images)\//);
  });
});

describe("wholesalePortal.css: fullbleed cover treatment — edge-to-edge, no distortion, correct stacking", () => {
  it("object-fit: cover applies to fullbleed cards UNCONDITIONALLY (no media query) so the ≤480px compact thumbnail is never letterboxed either", () => {
    const rule = cssSrc.match(/\.wsp-card-fullbleed \.wsp-card-photo img \{\s*object-fit: cover;\s*\}/);
    expect(rule, "unconditional object-fit: cover rule not found outside any @media block").toBeTruthy();
  });

  it("never uses object-fit: fill anywhere in the fullbleed rules (fill would stretch/distort the photo)", () => {
    const fullBleedSection = cssSrc.slice(cssSrc.indexOf(".wsp-card-fullbleed"), cssSrc.indexOf(".wsp-card-fullbleed") + 4000);
    expect(fullBleedSection).not.toMatch(/object-fit:\s*fill/);
  });

  it("the edge-to-edge (position: absolute, inset: 0) treatment is scoped to >480px only — the ≤480px compact-row thumbnail keeps its normal fixed-size box", () => {
    const scoped = cssSrc.match(/@media \(min-width: 481px\) \{[\s\S]*?\n\}\n/);
    expect(scoped, "min-width: 481px block not found").toBeTruthy();
    expect(scoped[0]).toContain(".wsp-card-fullbleed .wsp-card-photo {");
    expect(scoped[0]).toContain("overflow: visible;");
    expect(scoped[0]).toMatch(/\.wsp-card-fullbleed \.wsp-card-photo img \{\s*position: absolute;\s*inset: 0;\s*width: 100%;\s*height: 100%;\s*\}/);
  });

  it("the gradient scrim is present, bottom-anchored, and never intercepts clicks on the card button", () => {
    expect(cssSrc).toContain(".wsp-card-fullbleed-gradient {");
    const gradientRule = cssSrc.match(/\.wsp-card-fullbleed-gradient \{([\s\S]*?)\}/)[1];
    expect(gradientRule).toContain("bottom: 0;");
    expect(gradientRule).toMatch(/background:\s*linear-gradient\(to bottom,/);
    expect(gradientRule).toContain("pointer-events: none;");
  });

  it("stacking order (z-index) puts the photo behind the gradient, the gradient behind the title/arrow, and the accent bar always on top", () => {
    const gradientZ = Number(cssSrc.match(/\.wsp-card-fullbleed-gradient \{[\s\S]*?z-index: (\d+);/)[1]);
    const bodyZ = Number(cssSrc.match(/\.wsp-card-fullbleed \.wsp-card-body \{[\s\S]*?z-index: (\d+);/)[1]);
    const accentZ = Number(cssSrc.match(/\.wsp-card-accent \{[\s\S]*?z-index: (\d+);/)[1]);
    expect(gradientZ).toBeLessThan(bodyZ);
    expect(bodyZ).toBeLessThan(accentZ);
  });

  it("title/arrow get light colors for legibility over the photo, scoped to .wsp-card-fullbleed only — the base .wsp-card-title/.wsp-card-arrow rules for every other card are untouched", () => {
    expect(cssSrc).toMatch(/\.wsp-card-fullbleed \.wsp-card-title \{\s*color: #ffffff;/);
    expect(cssSrc).toMatch(/\.wsp-card-fullbleed \.wsp-card-arrow \{\s*color: rgba\(255, 255, 255, 0\.88\);/);
    // Base rules (used by all 6 untouched cards) still define the original
    // dark-on-light tokens, unchanged by this feature.
    expect(cssSrc).toMatch(/\.wsp-card-title \{\s*font-weight: 700;\s*font-size: clamp\(12px, 3\.2vw, 14px\);\s*color: var\(--wsp-card-text\);\s*\}/);
  });

  it("does not override .wsp-card's own border-radius/overflow — fullbleed cards keep exactly the same rounded corners and outer clipping as every other card", () => {
    const fullBleedSection = cssSrc.slice(cssSrc.indexOf(".wsp-card-fullbleed"), cssSrc.indexOf("Buttons — XP-style"));
    expect(fullBleedSection).not.toMatch(/\.wsp-card(?!-)[^{]*\{[^}]*border-radius/);
    expect(cssSrc).toContain("border-radius: 16px;"); // still the single source of truth, on .wsp-card itself
  });

  it("preserves the same total card height across breakpoints: .wsp-card-photo and .wsp-card-body keep their normal-flow box model (no position/height override on the boxes themselves, only on the <img> inside)", () => {
    const scoped = cssSrc.match(/@media \(min-width: 481px\) \{[\s\S]*?\n\}\n/)[0];
    // .wsp-card-photo itself never gets position/height/aspect-ratio
    // touched — only `overflow: visible` — so it still contributes its
    // normal 16:9 height to the card exactly like a non-fullbleed card.
    const photoBoxRule = scoped.match(/\.wsp-card-fullbleed \.wsp-card-photo \{([\s\S]*?)\}/)[1];
    expect(photoBoxRule).not.toMatch(/position:/);
    expect(photoBoxRule).not.toMatch(/height:/);
    expect(photoBoxRule).not.toMatch(/aspect-ratio:/);
  });
});
