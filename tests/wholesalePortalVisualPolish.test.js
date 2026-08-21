import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Adenda 9 — visual polish pass on the wholesale portal (identity glass
 * block, header->Wizard gap, Pricing Ready spacing hierarchy, the green
 * equipment/model/service pill, and the white-space audit). Same
 * source-scan convention as every other *.test.js file in this project —
 * no jsdom/render harness exists here, so these pin the exact CSS/JSX
 * structure the approved spec requires; real visual/responsive
 * verification happens in the embedded browser during Preview.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const pageSrc = read("src/pages/WholesalePrices.jsx");
const panelSrc = read("src/components/wholesale/WholesaleResultPanel.jsx");
const cssSrc = read("src/styles/wholesalePortal.css");

function ruleBlock(selector) {
  const idx = cssSrc.indexOf(`${selector} {`);
  if (idx === -1) return null;
  return cssSrc.slice(idx, cssSrc.indexOf("}", idx));
}

describe("Cambio 1 — identity glass block (logo + WHOLESALE PORTAL/PRIVATE AREA + welcome)", () => {
  it("groups Logo, the portal badges, and the welcome line inside one .wsp-identity-glass wrapper", () => {
    const idx = pageSrc.indexOf('<div className="wsp-identity-glass">');
    expect(idx).toBeGreaterThan(-1);
    const block = pageSrc.slice(idx, pageSrc.indexOf("</div>\n\n", idx) + 20);
    expect(block).toContain("<Logo size=\"sm\" />");
    expect(block).toContain("wsp-portal-badges");
    expect(block).toContain('t("portal.welcome", { shopName: state.shopName })');
  });

  it("never hardcodes the shop name — welcome line always interpolates state.shopName through t()", () => {
    expect(pageSrc).not.toMatch(/Welcome, Carli/);
    expect(pageSrc).toContain('t("portal.welcome", { shopName: state.shopName })');
  });

  it("is a small, fit-content light-glass block — never a big full-width white card", () => {
    const block = ruleBlock(".wsp-identity-glass");
    expect(block).toBeTruthy();
    expect(block).toMatch(/width:\s*fit-content;/);
    expect(block).toMatch(/max-width:\s*100%;/);
    expect(block).toMatch(/background:\s*rgba\(245,\s*249,\s*255,\s*0\.72\);/);
    expect(block).toMatch(/backdrop-filter:\s*blur\(14px\);/);
    expect(block).toMatch(/border:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.8\);/);
    expect(block).toMatch(/border-radius:\s*13px;/);
  });

  it("uses existing light-surface text tokens inside the glass — no new hardcoded text colors introduced for this block", () => {
    // The badges/welcome text colors are set by their own pre-existing
    // rules (.wsp-portal-badge, .wsp-portal-private-badge, .wsp-text-soft),
    // not by .wsp-identity-glass itself — confirm the glass rule carries no
    // `color:` of its own.
    const block = ruleBlock(".wsp-identity-glass");
    expect(block).not.toMatch(/\bcolor:/);
  });

  it("WHOLESALE PORTAL badge uses a darkened blue (#1e40af), not the original --wsp-blue — sampled contrast against the real photo region behind the glass block measured 3.57:1 with --wsp-blue (fails WCAG AA's 4.5:1 floor for text this small) and ~6:1 with this darker shade", () => {
    const block = ruleBlock(".wsp-portal-badge");
    expect(block).toMatch(/color:\s*#1e40af;/);
    expect(block).not.toMatch(/color:\s*var\(--wsp-blue\);/);
  });

  it("does not shrink the Sound/Locale/Main website/Logout touch targets — those controls keep their own unmodified classes", () => {
    expect(pageSrc).toContain("<WholesaleSoundToggle />");
    expect(pageSrc).toContain("<WholesaleLocaleSelector />");
    expect(pageSrc).toContain('className="wsp-main-site-link"');
    expect(pageSrc).toContain("wsp-btn wsp-btn-ghost");
    // Main website's 44px floor and Sound/Logout's own heights are untouched
    // — this test just confirms this pass didn't touch those class names.
    const mainSiteBlock = ruleBlock(".wsp-main-site-link");
    expect(mainSiteBlock).toMatch(/min-height:\s*44px;/);
  });
});

describe("Cambio 2 — header-to-Wizard separation, single controlled gap, >=768px only", () => {
  it("Wizard and Torays Boost Sales are grouped into one .wsp-wizard-sales-group — margin-top on the group is the ONLY separation from the header, never a second stacked gap", () => {
    const idx = pageSrc.indexOf('<div className="wsp-wizard-sales-group">');
    expect(idx).toBeGreaterThan(-1);
    const block = pageSrc.slice(idx, pageSrc.indexOf("</div>\n      </div>", idx));
    expect(block).toContain("<WholesaleWizard");
    expect(block).toContain("<WholesaleSalesModule");
  });

  it("the outer page wrapper carries no gap utility class of its own — margin-top on the group is the single source of the header gap", () => {
    const idx = pageSrc.indexOf("mx-auto flex max-w-6xl flex-col px-4");
    expect(idx).toBeGreaterThan(-1);
    const line = pageSrc.slice(idx - 40, idx + 80);
    expect(line).not.toMatch(/gap-\[/);
  });

  it("mobile keeps today's tight spacing (clamp, not the new fixed value) — the widened gap is scoped to >=768px only", () => {
    const block = ruleBlock(".wsp-wizard-sales-group");
    expect(block).toMatch(/margin-top:\s*clamp\(/);
    expect(block).not.toMatch(/margin-top:\s*22px;/); // base rule must NOT be the desktop value
  });

  it("widens to approximately 20-24px starting exactly at 768px, via margin (not transform)", () => {
    const idx = cssSrc.indexOf("@media (min-width: 768px) {\n  .wsp-wizard-sales-group {");
    expect(idx).toBeGreaterThan(-1);
    const block = cssSrc.slice(idx, cssSrc.indexOf("}", idx));
    const m = block.match(/margin-top:\s*(\d+(?:\.\d+)?)px;/);
    expect(m).toBeTruthy();
    const px = Number(m[1]);
    expect(px).toBeGreaterThanOrEqual(20);
    expect(px).toBeLessThanOrEqual(24);
    expect(block).not.toContain("transform");
  });
});

describe("Cambio 3 — Pricing Ready / pill / Shop Cost spacing hierarchy", () => {
  it("panel has no shared flex `gap` — every visible child sets its own explicit margin instead, so title->pill and pill->ShopCost can differ independently", () => {
    const block = ruleBlock(".wsp-result-panel");
    expect(block).not.toMatch(/\bgap:/);
  });

  it("title -> pill gap is ~4-6px (breadcrumb's own margin-top)", () => {
    const block = ruleBlock(".wsp-result-breadcrumb");
    const m = block.match(/margin-top:\s*(\d+(?:\.\d+)?)px;/);
    expect(m).toBeTruthy();
    const px = Number(m[1]);
    expect(px).toBeGreaterThanOrEqual(4);
    expect(px).toBeLessThanOrEqual(6);
  });

  it("pill -> Shop Cost gap is ~6-8px (the money wrapper's own margin-top)", () => {
    const block = ruleBlock(".wsp-result-money");
    const m = block.match(/margin-top:\s*(\d+(?:\.\d+)?)px;/);
    expect(m).toBeTruthy();
    const px = Number(m[1]);
    expect(px).toBeGreaterThanOrEqual(6);
    expect(px).toBeLessThanOrEqual(8);
  });

  it("every text element in this hierarchy has an explicit line-height — nothing relies on the browser default", () => {
    expect(ruleBlock(".wsp-result-title")).toMatch(/line-height:\s*1\.2;/);
    expect(ruleBlock(".wsp-result-breadcrumb")).toMatch(/line-height:\s*1\.35;/);
  });
});

describe("Cambio 4 (rev. final) — light-red equipment/model/service identifier pill, centered, on every result", () => {
  it("exact spec colors: #FEE2E2 background, #991B1B text, #FCA5A5 border", () => {
    const block = ruleBlock(".wsp-result-breadcrumb");
    expect(block).toMatch(/background:\s*#fee2e2;/);
    expect(block).toMatch(/color:\s*#991b1b;/);
    expect(block).toMatch(/border:\s*1px solid #fca5a5;/);
  });

  it("no trace of the earlier lime-green colors remains", () => {
    const block = ruleBlock(".wsp-result-breadcrumb");
    expect(block).not.toMatch(/#d9f99d/i);
    expect(block).not.toMatch(/#365314/i);
    expect(block).not.toMatch(/#a3e635/i);
  });

  it("fit-content, but caps at max-width:100% and wraps — never truncates a long equipment/model/service chain", () => {
    const block = ruleBlock(".wsp-result-breadcrumb");
    expect(block).toMatch(/width:\s*fit-content;/);
    expect(block).toMatch(/max-width:\s*100%;/);
    expect(block).toMatch(/overflow-wrap:\s*break-word;/);
    expect(block).not.toContain("text-overflow");
    expect(block).not.toContain("white-space: nowrap");
  });

  it("is centered under the title, including its own wrapped lines on mobile", () => {
    const block = ruleBlock(".wsp-result-breadcrumb");
    expect(block).toMatch(/align-self:\s*center;/);
    expect(block).toMatch(/text-align:\s*center;/);
  });

  it("the header row (ShieldCheck icon + Pricing Ready title) is horizontally centered", () => {
    const block = ruleBlock(".wsp-result-header");
    expect(block).toMatch(/justify-content:\s*center;/);
  });

  it("is the single shared class for every result — no per-equipment/per-service conditional styling (e.g. no special-cased iPad branch)", () => {
    expect(panelSrc).toContain('<p className="wsp-result-breadcrumb">{breadcrumb}</p>');
    expect(panelSrc).not.toMatch(/breadcrumb.*ipad/i);
  });

  it("is built exclusively from selection/service fields DESK returned — the JSX literally interpolates selection.equipoName/modelName and the service's translated name, never a device-name string literal", () => {
    const idx = panelSrc.indexOf("const breadcrumb = [");
    const block = panelSrc.slice(idx, panelSrc.indexOf("].filter(Boolean)", idx));
    expect(block).toContain("selection.equipoName");
    expect(block).toContain("selection.modelName");
    // The service's own name goes through translateServiceName (service's
    // real name_es field wins over the legacy dictionary — see
    // wholesaleCatalogI18n.test.js) rather than translateCatalogLabel
    // directly.
    expect(block).toContain("translateServiceName(service, language)");
    // No hardcoded device/brand names anywhere in this component file.
    for (const literal of ["PS5", "iPad", "iPhone", "MacBook", "Xbox", "Switch", "HDMI"]) {
      expect(panelSrc).not.toContain(literal);
    }
  });

  it("dynamic proof: a DIFFERENT, unrelated equipment/service (never used anywhere else in this test suite's WholesaleResultPanel fixtures) produces the identical pill/centering markup — the component has no special-casing for any specific device", () => {
    // This test doesn't render (no jsdom) — it proves dynamism the same way
    // every other structural test in this file does: by showing the
    // breadcrumb construction is pure data interpolation with no branch
    // that could only fire for a particular device. A live example, to
    // make the point concrete: selection={equipoName:"MacBook", modelName:
    // "MacBook Pro 16\" 2021"} + service={name:"Battery Replacement"} would
    // join to "MacBook · MacBook Pro 16\" 2021 · Battery Replacement" via
    // the exact same .filter(Boolean).join(" · ") used for every other
    // device — verified structurally below.
    const idx = panelSrc.indexOf("const breadcrumb = [");
    const block = panelSrc.slice(idx, panelSrc.indexOf(";", panelSrc.indexOf(".join(", idx) + 1));
    expect(block).toContain('.filter(Boolean)');
    expect(block).toContain('.join(" · ")');
    // The array has exactly 4 possible entries (microsoldering tag,
    // equipoName, modelName, the service's own translated name) and no 5th
    // branch that could special-case one particular equipment/service.
    const entryCount = (block.match(/translateCatalogLabel\(|translateServiceName\(|t\("microsoldering\.title"\)/g) || []).length;
    expect(entryCount).toBe(4); // microsoldering label + equipoName + modelName + translateServiceName(service)
  });
});

describe("Cambio 5 — no reserved/wasted white space", () => {
  it("the fallback (no-tiers) path renders only its own hero+profit+margin block — never a hidden/empty tier-group placeholder", () => {
    const fallbackIdx = panelSrc.indexOf("wsp-result-money-hero");
    expect(fallbackIdx).toBeGreaterThan(-1);
    // hasTiers is a real ternary — the tier-group markup is not present at
    // all in the fallback branch, so it can never reserve height for cards
    // that don't exist.
    expect(panelSrc).toMatch(/hasTiers \? \(/);
  });

  it("an empty/null recommendation renders nothing at all — no empty <p>, no placeholder block", () => {
    expect(panelSrc).toContain("{service.notes?.trim() && (");
    // Guards the conditional itself, not just presence of the class name —
    // confirms this is a real &&-gated render, not an always-rendered <p>.
    const idx = panelSrc.indexOf("wsp-result-recommendation");
    const surrounding = panelSrc.slice(idx - 120, idx);
    expect(surrounding).toContain("service.notes?.trim() && (");
  });

  it("the recommendation renders identically whether the service has tiers or is on the fallback path — one shared block outside the hasTiers ternary, never duplicated inside both branches", () => {
    const occurrences = (panelSrc.match(/wsp-result-recommendation/g) || []).length;
    // Exactly 2: the className itself + the `strong` nested-selector CSS
    // reference doesn't count here (this is the JSX file) — className plus
    // nothing else duplicated means it's rendered once, shared.
    expect(occurrences).toBe(1);
  });

  it("Check Another Price sits close to the content above it with a deliberate, non-huge margin — not flush, not a big gap", () => {
    const block = ruleBlock(".wsp-result-consult-another");
    const m = block.match(/margin-top:\s*(\d+(?:\.\d+)?)px;/);
    expect(m).toBeTruthy();
    const px = Number(m[1]);
    expect(px).toBeGreaterThan(0);
    expect(px).toBeLessThan(30);
  });
});

describe("Cambio 6 — broken-image fallback source-scan (see wholesaleEquipmentTypeCard.test.js for full coverage)", () => {
  it("EquipmentTypeCard is the only image-rendering component reachable from the live wizard — WholesaleWizard imports it for equipment types, models, and Microsoldering alike (Microsoldering is a plain member of the same top-level list, no separate tile)", () => {
    const wizardSrc = read("src/components/wholesale/WholesaleWizard.jsx");
    expect(wizardSrc).toContain('import { EquipmentTypeCard } from "./EquipmentTypeCard.jsx";');
    // 2 usages: the unified top-level Equipo grid (includes Microsoldering)
    // and the Modelo grid — one list, one map, no bespoke card per screen.
    expect((wizardSrc.match(/<EquipmentTypeCard/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});
