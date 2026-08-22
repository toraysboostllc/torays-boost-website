import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const photoSrc = read("src/components/wholesale/ServicePhoto.jsx");
const wizardSrc = read("src/components/wholesale/WholesaleWizard.jsx");
const panelSrc = read("src/components/wholesale/WholesaleResultPanel.jsx");
const cssSrc = read("src/styles/wholesalePortal.css");

/**
 * Real bug report: a service's own photo (uploaded and correctly showing in
 * DESK) never reached the Website Falla list or the result/detail panel,
 * even though /api/wholesale-prices' toClientService() already attaches an
 * { url, alt_text } | null `image` per service (api/_lib/wholesaleDb.js) —
 * the API payload was fine, the client simply never rendered it. Same root
 * shape of bug for service.name_es/description_en/description_es: the DB
 * columns and API passthrough already existed, but the Falla list and
 * result breadcrumb called translateCatalogLabel(service.name, ...)
 * directly, never consulting service.name_es first (unlike
 * EquipmentTypeCard, which already had the correct 3-tier precedence for
 * equipment types), and no description was rendered anywhere at all.
 *
 * This project has no jsdom/@testing-library dependency (see
 * wholesalePortalUi.test.js's own header) — every test below is structural/
 * source-based, matching the rest of this suite.
 */

describe("ServicePhoto.jsx: renders nothing without a photo, never a reserved icon/box", () => {
  it("returns null when there is no image url or the one it has already failed", () => {
    expect(photoSrc).toContain("if (!url || url === failedUrl) return null;");
  });

  it("reads the url from image?.url — the exact { url, alt_text } | null shape toClientService returns, generic for ANY service", () => {
    expect(photoSrc).toContain("const url = image?.url || null;");
  });
});

describe("ServicePhoto.jsx: same broken-image-recovery pattern already established for EquipmentTypeCard", () => {
  it("tracks the failed URL by value, resets it when the url prop changes, and wires onError to record ITS OWN url as failed", () => {
    expect(photoSrc).toContain('import { useEffect, useState } from "react";');
    expect(photoSrc).toContain("const [failedUrl, setFailedUrl] = useState(null);");
    expect(photoSrc).toMatch(/useEffect\(\(\) => \{\s*setFailedUrl\(null\);\s*\}, \[url\]\);/);
    expect(photoSrc).toContain("onError={() => setFailedUrl(url)}");
  });

  it("never a raw DOM src reassignment or manual retry loop", () => {
    expect(photoSrc).not.toContain(".src =");
    expect(photoSrc).not.toContain("retryCount");
    expect(photoSrc).not.toContain("setTimeout");
  });
});

describe("ServicePhoto.jsx: accessibility and no-layout-shift basics", () => {
  it("accepts and forwards an explicit alt prop — never a hardcoded/empty alt on a meaningful photo", () => {
    expect(photoSrc).toContain("alt={alt}");
  });

  it('uses loading="lazy" always', () => {
    expect(photoSrc).toContain('loading="lazy"');
  });

  it("reserves explicit equal width/height (belt-and-suspenders against layout shift, same convention as EquipmentTypeCard/CategoryDrilldown) ONLY when a fixed `size` is given — the small square thumbnails (Falla list)", () => {
    expect(photoSrc).toContain("{...(size ? { width: size, height: size } : {})}");
  });

  it("omitting `size` (the large result-panel photo) renders with NO width/height attributes at all — never forced into a square, so the image keeps its real original aspect ratio and CSS (width:100%/height:auto) controls its scale instead", () => {
    expect(photoSrc).not.toMatch(/width=\{size\}/);
    expect(photoSrc).not.toMatch(/height=\{size\}/);
  });
});

describe("WholesaleWizard.jsx: Falla list shows a per-service thumbnail + localized name, generic for any service — no hardcoded slug/name", () => {
  it("imports and renders ServicePhoto to the left of the service label inside each fault button", () => {
    expect(wizardSrc).toContain('import { ServicePhoto } from "./ServicePhoto.jsx";');
    const idx = wizardSrc.indexOf("wsp-wizard-fault-list");
    const block = wizardSrc.slice(idx, wizardSrc.indexOf("</ul>", idx));
    const photoIdx = block.indexOf("<ServicePhoto");
    const labelIdx = block.indexOf("wsp-wizard-fault-item-label");
    expect(photoIdx).toBeGreaterThan(-1);
    expect(labelIdx).toBeGreaterThan(-1);
    expect(photoIdx).toBeLessThan(labelIdx); // photo comes before (left of) the name
  });

  it("passes image={service.image} and a real alt fallback — never a literal/hardcoded alt string", () => {
    expect(wizardSrc).toContain("image={service.image}");
    expect(wizardSrc).toMatch(/alt=\{service\.image\?\.alt_text \|\| translateServiceName\(service, language\)\}/);
  });

  it("uses translateServiceName(service, language) for the visible label, not translateCatalogLabel(service.name, ...) directly", () => {
    expect(wizardSrc).toContain("{translateServiceName(service, language)}");
    expect(wizardSrc).not.toMatch(/translateCatalogLabel\(service\.name/);
  });

  it("no hardcoded device/service name or slug anywhere near the fault-list rendering — fully data-driven off the service object", () => {
    const idx = wizardSrc.indexOf("wsp-wizard-fault-list");
    const block = wizardSrc.slice(idx, wizardSrc.indexOf("</ul>", idx));
    for (const literal of ["microsoldering", "Microsoldering", "PS5", "iPad", "iPhone", "MacBook", "Xbox", "Switch", "HDMI"]) {
      expect(block).not.toContain(literal);
    }
  });
});

describe("WholesaleResultPanel.jsx: service description near the top, LARGE photo near the bottom — never both in the same spot, never duplicated", () => {
  it("imports ServicePhoto, resolveServiceDescription, and translateServiceName", () => {
    expect(panelSrc).toContain('import { ServicePhoto } from "./ServicePhoto.jsx";');
    expect(panelSrc).toContain(
      'import { translateCatalogLabel, translateServiceName, resolveServiceDescription } from "../../lib/wholesaleCatalogI18n.js";'
    );
  });

  it("the description paragraph sits right after the breadcrumb and before the price reveal, rendered only when resolveServiceDescription returns something — no image here at all anymore", () => {
    const breadcrumbIdx = panelSrc.indexOf('<p className="wsp-result-breadcrumb">');
    const descIdx = panelSrc.indexOf("wsp-result-service-description");
    const priceIdx = panelSrc.indexOf("isQuote ? (");
    expect(breadcrumbIdx).toBeGreaterThan(-1);
    expect(descIdx).toBeGreaterThan(breadcrumbIdx);
    expect(descIdx).toBeLessThan(priceIdx);
    expect(panelSrc).toContain("{resolveServiceDescription(service, language) && (");
    expect(panelSrc).toContain('<p className="wsp-result-service-description">{resolveServiceDescription(service, language)}</p>');
    // No <ServicePhoto> between the breadcrumb and the price reveal anymore
    // — exactly ONE render site for the photo now, near the bottom (see
    // below), never a small duplicate up here too.
    const topRegion = panelSrc.slice(breadcrumbIdx, priceIdx);
    expect(topRegion).not.toContain("<ServicePhoto");
  });

  // Anchored to the actual JSX opening tag (className="wsp-result-photo-
  // block") rather than the bare class name — this file's own explanatory
  // comments mention that class name in prose (see the header comment right
  // above the JSX), and a bare substring search would match that prose
  // first, well before the real markup.
  const photoBlockTagIdx = panelSrc.indexOf('<div className="wsp-result-photo-block">');

  it('the LARGE photo block sits AFTER the "Consult another price" button and before the component\'s closing </div> — below the full quote (cost, tiers, recommendation, the button), which is where WholesaleWizard.jsx/WholesalePrices.jsx render the sibling Torays Boost Sales module right after this card', () => {
    const buttonIdx = panelSrc.indexOf("wsp-result-consult-another");
    const closingDivIdx = panelSrc.lastIndexOf("</div>");
    expect(buttonIdx).toBeGreaterThan(-1);
    expect(photoBlockTagIdx).toBeGreaterThan(buttonIdx);
    expect(photoBlockTagIdx).toBeLessThan(closingDivIdx);
  });

  it("the large photo is gated on service.image alone — renders nothing at all (no empty box) when the selected service has no photo", () => {
    const gateIdx = panelSrc.lastIndexOf("{service.image && (", photoBlockTagIdx);
    expect(gateIdx).toBeGreaterThan(-1);
    // The gate immediately guards this exact block — only whitespace
    // between the opening `(` of the gate and the block's own tag.
    const between = panelSrc.slice(gateIdx + "{service.image && (".length, photoBlockTagIdx);
    expect(between.trim()).toBe("");
  });

  it("passes image={service.image} — never selectedEquipo/equipo/Microsoldering-level image — with a real alt fallback, and size is intentionally omitted so ServicePhoto renders it at its real aspect ratio, not forced into a square", () => {
    const block = panelSrc.slice(photoBlockTagIdx, panelSrc.indexOf("</div>", photoBlockTagIdx) + 6);
    expect(block).toContain("image={service.image}");
    expect(block).toMatch(/alt=\{service\.image\?\.alt_text \|\| translateServiceName\(service, language\)\}/);
    expect(block).not.toMatch(/size=\{/);
    expect(block).not.toContain("selectedEquipo");
    expect(block).not.toContain("equipo.image");
  });

  it("no hardcoded device/service name anywhere in the actual rendered description or large-photo JSX (comments explaining the design are allowed to mention them in prose — only real code is checked)", () => {
    const descTagIdx = panelSrc.indexOf('<p className="wsp-result-service-description">');
    const descLine = panelSrc.slice(descTagIdx, panelSrc.indexOf("\n", descTagIdx));
    const photoBlock = panelSrc.slice(photoBlockTagIdx, panelSrc.indexOf("</div>", photoBlockTagIdx) + 6);
    for (const literal of ["microsoldering", "Microsoldering", "PS5", "iPad", "iPhone", "MacBook", "Xbox", "Switch", "HDMI"]) {
      expect(descLine).not.toContain(literal);
      expect(photoBlock).not.toContain(literal);
    }
  });
});

describe("wholesalePortal.css: new photo/description classes carry no hidden/md:hidden responsive-visibility modifier — never stranded on mobile", () => {
  it(".wsp-wizard-fault-item-photo / -label, .wsp-result-service-description, and .wsp-result-photo-block / -large all exist and are unconditionally visible", () => {
    for (const cls of [
      ".wsp-wizard-fault-item-photo",
      ".wsp-wizard-fault-item-label",
      ".wsp-result-service-description",
      ".wsp-result-photo-block",
      ".wsp-result-photo-large",
    ]) {
      expect(cssSrc).toContain(`${cls} {`);
    }
    expect(cssSrc).not.toMatch(/\.wsp-wizard-fault-item-photo\s*\{[^}]*display:\s*none/);
    expect(cssSrc).not.toMatch(/\.wsp-result-photo-(block|large)\s*\{[^}]*display:\s*none/);
  });

  it("the fault-item thumbnail is a fixed square with object-fit so a tall/wide source image never distorts or breaks the row's height on any breakpoint", () => {
    const idx = cssSrc.indexOf(".wsp-wizard-fault-item-photo {");
    const block = cssSrc.slice(idx, cssSrc.indexOf("}", idx));
    expect(block).toMatch(/width:\s*40px/);
    expect(block).toMatch(/height:\s*40px/);
    expect(block).toMatch(/object-fit:\s*cover/);
  });

  it("the LARGE result photo is width:100% + a max-width cap + height:auto — never a fixed square, never a fixed aspect-ratio box: this is what preserves the source photo's real proportions on both desktop (wide but capped) and mobile (100%, no horizontal overflow) with the same rule", () => {
    const idx = cssSrc.indexOf(".wsp-result-photo-large {");
    const block = cssSrc.slice(idx, cssSrc.indexOf("}", idx));
    expect(block).toMatch(/width:\s*100%/);
    expect(block).toMatch(/max-width:\s*\d+px/);
    expect(block).toMatch(/height:\s*auto/);
    expect(block).not.toMatch(/aspect-ratio/);
    expect(block).not.toMatch(/object-fit:\s*cover/); // cover would crop — this photo must never be cropped
  });

  it("reuses existing design tokens for the description text color — no new hardcoded hex introduced by this change", () => {
    const descIdx = cssSrc.indexOf(".wsp-result-service-description {");
    const descBlock = cssSrc.slice(descIdx, cssSrc.indexOf("}", descIdx));
    expect(descBlock).toContain("var(--wsp-card-text-soft)");
  });
});
