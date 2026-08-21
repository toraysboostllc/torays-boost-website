import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Coverage for the DB-driven "photo covers the entire card edge-to-edge"
 * treatment. Unlike the prototype version (a hardcoded
 * WHOLESALE_FULL_BLEED_PHOTO_SLUGS = { microsoldering: ..., ps5: ... } map,
 * built on the chore/update-wholesale-menu-images branch and explicitly NOT
 * merged), this version is entirely data-driven: any card whose OWN
 * wholesale_equipment_types row has full_bleed_photo=true gets the
 * treatment, with image_focus_x/image_focus_y (normalized 0-100 numerics,
 * never a CSS string) controlling the crop. This project has no jsdom/DOM
 * test environment — these are source-scan assertions against the
 * component/stylesheet content, the same convention used throughout this
 * suite.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const cardSrc = read("src/components/wholesale/EquipmentTypeCard.jsx");
const cssSrc = read("src/styles/wholesalePortal.css");

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}

describe("EquipmentTypeCard.jsx: full-bleed is 100% data-driven — no hardcoded slug map of any kind", () => {
  it("never re-introduces WHOLESALE_FULL_BLEED_PHOTO_SLUGS or any other slug-keyed presentation map", () => {
    expect(cardSrc).not.toMatch(/WHOLESALE_FULL_BLEED_PHOTO_SLUGS/);
    expect(cardSrc).not.toMatch(/_SLUGS\s*=\s*\{/);
  });

  it("isFullBleed reads entity.fullBleedPhoto directly, gated on showImage — never a photo-less or failed-image card", () => {
    expect(cardSrc).toContain("const isFullBleed = Boolean(entity.fullBleedPhoto) && showImage;");
  });

  it("image_focus_x/image_focus_y are consumed as numeric X/Y, composed into object-position at render time — never a raw CSS string read from data", () => {
    expect(cardSrc).toContain("const focusX = Number.isFinite(entity.imageFocusX) ? entity.imageFocusX : 50;");
    expect(cardSrc).toContain("const focusY = Number.isFinite(entity.imageFocusY) ? entity.imageFocusY : 50;");
    expect(cardSrc).toContain("style={isFullBleed ? { objectPosition: `${focusX}% ${focusY}%` } : undefined}");
  });

  it("the wsp-card-fullbleed class and the gradient overlay are both conditional on isFullBleed", () => {
    expect(cardSrc).toContain('${isFullBleed ? " wsp-card-fullbleed" : ""}');
    expect(cardSrc).toContain('{isFullBleed && <span className="wsp-card-fullbleed-gradient" aria-hidden="true" />}');
  });
});

describe("EquipmentTypeCard.jsx: display name — three-tier fallback (DB name_es -> legacy hardcoded dictionary -> raw English)", () => {
  it("prefers entity.nameEs when in Spanish and it's present/non-blank, before ever consulting the hardcoded dictionary", () => {
    expect(cardSrc).toMatch(/language === "es" && entity\.nameEs && entity\.nameEs\.trim\(\)\s*\n\s*\? entity\.nameEs\.trim\(\)\s*\n\s*: translateCatalogLabel\(entity\.name, language\)/);
  });

  it("still imports and falls back to the existing translateCatalogLabel dictionary — not a cutover, a three-tier degrade", () => {
    expect(cardSrc).toContain('import { translateCatalogLabel } from "../../lib/wholesaleCatalogI18n.js";');
  });

  it("entity.name itself is never mutated — alt text and the click handler still see the raw stored value", () => {
    expect(cardSrc).toContain("alt={entity.image.alt_text || displayName}");
    expect(cardSrc).not.toMatch(/entity\.name\s*=/); // no assignment to entity.name anywhere
  });
});

describe("wholesalePortal.css: fullbleed cover treatment — edge-to-edge, no distortion, correct stacking (same mechanics as before, now serving DB-driven cards)", () => {
  it("object-fit: cover applies to fullbleed cards UNCONDITIONALLY (no media query) so the ≤480px compact thumbnail is never letterboxed either", () => {
    const rule = cssSrc.match(/\.wsp-card-fullbleed \.wsp-card-photo img \{\s*object-fit: cover;\s*\}/);
    expect(rule, "unconditional object-fit: cover rule not found outside any @media block").toBeTruthy();
  });

  it("never uses object-fit: fill anywhere in the fullbleed rules (fill would stretch/distort the photo)", () => {
    const fullBleedSection = cssSrc.slice(cssSrc.indexOf(".wsp-card-fullbleed"), cssSrc.indexOf(".wsp-card-fullbleed") + 4000);
    expect(fullBleedSection).not.toMatch(/object-fit:\s*fill/);
  });

  it("the edge-to-edge (position: absolute, inset: 0) treatment is scoped to >480px only", () => {
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

  it("does not override .wsp-card's own border-radius/overflow — fullbleed cards keep exactly the same rounded corners as every other card", () => {
    const fullBleedSection = cssSrc.slice(cssSrc.indexOf(".wsp-card-fullbleed"), cssSrc.indexOf("Buttons — XP-style"));
    expect(fullBleedSection).not.toMatch(/\.wsp-card(?!-)[^{]*\{[^}]*border-radius/);
    expect(cssSrc).toContain("border-radius: 16px;");
  });

  it("preserves the same total card height across breakpoints: .wsp-card-photo/.wsp-card-body keep normal-flow box model, only the <img> is pulled out", () => {
    const scoped = cssSrc.match(/@media \(min-width: 481px\) \{[\s\S]*?\n\}\n/)[0];
    const photoBoxRule = scoped.match(/\.wsp-card-fullbleed \.wsp-card-photo \{([\s\S]*?)\}/)[1];
    expect(photoBoxRule).not.toMatch(/position:/);
    expect(photoBoxRule).not.toMatch(/height:/);
    expect(photoBoxRule).not.toMatch(/aspect-ratio:/);
  });
});
