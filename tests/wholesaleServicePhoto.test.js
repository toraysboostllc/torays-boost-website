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

  it("uses loading=\"lazy\" and explicit width/height (derived from the size prop, never a CSS-only box) — belt-and-suspenders against layout shift, same convention as EquipmentTypeCard/CategoryDrilldown", () => {
    expect(photoSrc).toContain('loading="lazy"');
    expect(photoSrc).toContain("width={size}");
    expect(photoSrc).toContain("height={size}");
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

describe("WholesaleResultPanel.jsx: service photo + description shown in the result/detail panel, generic for any service", () => {
  it("imports ServicePhoto, resolveServiceDescription, and translateServiceName", () => {
    expect(panelSrc).toContain('import { ServicePhoto } from "./ServicePhoto.jsx";');
    expect(panelSrc).toContain(
      'import { translateCatalogLabel, translateServiceName, resolveServiceDescription } from "../../lib/wholesaleCatalogI18n.js";'
    );
  });

  it("renders the service-meta block right after the breadcrumb and before the price reveal, gated on having EITHER a photo or a description — never an empty block", () => {
    const breadcrumbIdx = panelSrc.indexOf('<p className="wsp-result-breadcrumb">');
    const metaIdx = panelSrc.indexOf("wsp-result-service-meta");
    const priceIdx = panelSrc.indexOf("isQuote ? (");
    expect(breadcrumbIdx).toBeGreaterThan(-1);
    expect(metaIdx).toBeGreaterThan(breadcrumbIdx);
    expect(metaIdx).toBeLessThan(priceIdx);
    expect(panelSrc).toContain("{(service.image || resolveServiceDescription(service, language)) && (");
  });

  it("passes image={service.image} with a real alt fallback, and only renders the description paragraph when resolveServiceDescription returns something", () => {
    expect(panelSrc).toContain("image={service.image}");
    expect(panelSrc).toMatch(/alt=\{service\.image\?\.alt_text \|\| translateServiceName\(service, language\)\}/);
    expect(panelSrc).toContain("{resolveServiceDescription(service, language) && (");
    expect(panelSrc).toContain('<p className="wsp-result-service-description">{resolveServiceDescription(service, language)}</p>');
  });

  it("no hardcoded device/service name anywhere near the service-meta block — fully data-driven off the service object", () => {
    const idx = panelSrc.indexOf("wsp-result-service-meta");
    const block = panelSrc.slice(idx, panelSrc.indexOf("isQuote ? (", idx));
    for (const literal of ["microsoldering", "Microsoldering", "PS5", "iPad", "iPhone", "MacBook", "Xbox", "Switch", "HDMI"]) {
      expect(block).not.toContain(literal);
    }
  });
});

describe("wholesalePortal.css: new photo/description classes carry no hidden/md:hidden responsive-visibility modifier — never stranded on mobile", () => {
  it(".wsp-wizard-fault-item-photo / -label and .wsp-result-service-meta / -photo / -description all exist and are unconditionally visible", () => {
    for (const cls of [
      ".wsp-wizard-fault-item-photo",
      ".wsp-wizard-fault-item-label",
      ".wsp-result-service-meta",
      ".wsp-result-service-photo",
      ".wsp-result-service-description",
    ]) {
      expect(cssSrc).toContain(`${cls} {`);
    }
    expect(cssSrc).not.toMatch(/\.wsp-wizard-fault-item-photo\s*\{[^}]*display:\s*none/);
    expect(cssSrc).not.toMatch(/\.wsp-result-service-meta\s*\{[^}]*display:\s*none/);
  });

  it("the fault-item photo is a fixed square with object-fit so a tall/wide source image never distorts or breaks the row's height on any breakpoint", () => {
    const idx = cssSrc.indexOf(".wsp-wizard-fault-item-photo {");
    const block = cssSrc.slice(idx, cssSrc.indexOf("}", idx));
    expect(block).toMatch(/width:\s*40px/);
    expect(block).toMatch(/height:\s*40px/);
    expect(block).toMatch(/object-fit:\s*cover/);
  });

  it("reuses existing design tokens for the new placeholder/text colors — no new hardcoded hex introduced by this change", () => {
    const photoIdx = cssSrc.indexOf(".wsp-wizard-fault-item-photo {");
    const photoBlock = cssSrc.slice(photoIdx, cssSrc.indexOf("}", photoIdx));
    expect(photoBlock).toContain("var(--wsp-placeholder-bg-start)");
    const descIdx = cssSrc.indexOf(".wsp-result-service-description {");
    const descBlock = cssSrc.slice(descIdx, cssSrc.indexOf("}", descIdx));
    expect(descBlock).toContain("var(--wsp-card-text-soft)");
  });
});
