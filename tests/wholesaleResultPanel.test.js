import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computeFixedPricing } from "../src/lib/wholesaleMargin.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const panelSrc = read("src/components/wholesale/WholesaleResultPanel.jsx");
const cssSrc = read("src/styles/wholesalePortal.css");

/**
 * Correction pass: the shop can no longer edit, select, or change any
 * price on this portal — DESK is the only authorized place to configure
 * Shop Cost / Silver / Purple / Gold. This whole file was rewritten to
 * match: every test that used to exercise the editable-input / tier-picker
 * behavior (customerPriceInput, selectTier, activeTierKey, role=radio,
 * the loss warning tied to a typed price) is gone, replaced by tests that
 * confirm the read-only behavior instead.
 */

describe("WholesaleResultPanel.jsx: wired to the tested pure calc functions, never reimplements the math", () => {
  it("imports computeFixedPricing/computeRangePricing from the tested lib, never a local reimplementation", () => {
    expect(panelSrc).toMatch(/import \{[^}]*computeFixedPricing[^}]*computeRangePricing[^}]*\} from "\.\.\/\.\.\/lib\/wholesaleMargin\.js";/);
    expect(panelSrc).not.toMatch(/function computeFixedPricing|function computeRangePricing/);
  });

  it("imports hasCompletePriceTiers from the same tested lib, never reimplemented locally — isHighProfitPrice is gone (no more active-tier classification, since nothing is selectable)", () => {
    expect(panelSrc).toMatch(/import \{[^}]*hasCompletePriceTiers[^}]*\} from "\.\.\/\.\.\/lib\/wholesaleMargin\.js";/);
    expect(panelSrc).not.toContain("isHighProfitPrice");
    expect(panelSrc).not.toMatch(/function hasCompletePriceTiers/);
  });

  it("never contains its own margin/profit arithmetic (no raw subtraction/division of price fields)", () => {
    expect(panelSrc).not.toMatch(/price\s*-\s*service\.(fixed_price|price_min|price_max)/);
    expect(panelSrc).not.toMatch(/\/\s*price\s*\*\s*100/);
  });
});

describe("Correction pass: zero editing capability anywhere in this component", () => {
  it("never imports or calls React's useState — there is no local state left, every figure is derived straight from props", () => {
    expect(panelSrc).not.toContain("useState");
  });

  it("never renders an <input> of any kind", () => {
    expect(panelSrc).not.toMatch(/<input/);
  });

  it("never renders the old 'Editable' badge or references an editable label", () => {
    expect(panelSrc).not.toContain("editableLabel");
    expect(panelSrc).not.toContain("wsp-result-editable-badge");
  });

  it("has no onChange handler and no customerPriceInput/selectTier/activeTierKey concept left", () => {
    expect(panelSrc).not.toContain("onChange");
    expect(panelSrc).not.toContain("customerPriceInput");
    expect(panelSrc).not.toContain("selectTier");
    expect(panelSrc).not.toContain("activeTierKey");
    expect(panelSrc).not.toContain("setCustomerPriceInput");
  });

  it("no role=radio, role=radiogroup, or aria-checked appear anywhere — nothing on this panel is a selectable option", () => {
    expect(panelSrc).not.toContain("role=\"radio\"");
    expect(panelSrc).not.toContain("role=\"radiogroup\"");
    expect(panelSrc).not.toContain("aria-checked");
  });

  it("the tier cards are plain <div>s, never <button>s, and have no onClick of any kind", () => {
    const groupStart = panelSrc.indexOf("wsp-result-tier-group");
    const groupBlock = panelSrc.slice(groupStart, panelSrc.indexOf("PRICE_TIERS.map") + 2000);
    expect(groupBlock).not.toMatch(/<button[\s\S]*?wsp-result-tier-card/);
    expect(groupBlock).not.toContain("onClick");
  });

  it("the old loss-warning tied to a typed price is fully removed — no isLoss, no AlertTriangle import, no lossWarning translation key usage", () => {
    expect(panelSrc).not.toContain("isLoss");
    expect(panelSrc).not.toContain("AlertTriangle");
    expect(panelSrc).not.toContain("lossWarning");
    expect(panelSrc).not.toContain("wsp-result-loss-warning");
  });

  it("website source contains no PATCH/PUT/POST fetch call and no reference to any wholesale update/admin endpoint — this component (and this file) never writes data", () => {
    expect(panelSrc).not.toMatch(/fetch\(/);
    expect(panelSrc).not.toMatch(/method:\s*["'](PATCH|PUT|POST)["']/);
    expect(panelSrc).not.toMatch(/wholesale-admin|update-service|updateFull/i);
  });
});

describe("WholesaleResultPanel.jsx: pricing_type branching — fixed / range / quote", () => {
  it("quote services show the diagnostic-required message and skip the figures entirely", () => {
    expect(panelSrc).toContain('t("result.requiresDiagnostic")');
    expect(panelSrc).toMatch(/isQuote \? \(/);
  });

  it("quote services never render the disclaimer", () => {
    expect(panelSrc).toMatch(/\{!isQuote && <p className="wsp-result-disclaimer">/);
  });

  it("range services' profit/margin (in a tier card or the no-tiers fallback) show a MIN–MAX pair via computeTierPricing → computeRangePricing, never a single false-precision number", () => {
    expect(panelSrc).toContain("computeRangePricing({ wholesaleMin: service.price_min, wholesaleMax: service.price_max, customerPrice: price })");
    expect(panelSrc).toMatch(/potentialProfitMin/);
    expect(panelSrc).toMatch(/estimatedMarginPercentMin/);
  });

  it("range services show the rangeNote disclaimer", () => {
    expect(panelSrc).toMatch(/\{isRange && <p className="wsp-result-range-note">\{t\("result\.rangeNote"\)\}<\/p>\}/);
  });

  it("fixed (and default) services use computeFixedPricing via computeTierPricing", () => {
    expect(panelSrc).toContain("return computeFixedPricing({ wholesalePrice: service.fixed_price, customerPrice: price });");
  });
});

describe("WholesaleResultPanel.jsx: never surfaces Torays Boost's own internal cost/margin", () => {
  it("only ever displays wholesalePrice (Shop Cost) and the DESK-configured customer prices — no 'internal', 'cost basis', or 'torays margin' field", () => {
    expect(panelSrc.toLowerCase()).not.toMatch(/internal.?margin|torays.?margin|cost.?basis|our.?margin/);
  });

  it("shows the required result labels: shopPrice, recommendedPrice (fallback), potentialProfit, estimatedMargin (fallback)", () => {
    expect(panelSrc).toContain('t("result.shopPrice")');
    expect(panelSrc).toContain('t("result.recommendedPrice")');
    expect(panelSrc).toContain('t("result.potentialProfit")');
    expect(panelSrc).toContain('t("result.estimatedMargin")');
  });
});

describe("WholesaleResultPanel.jsx: breadcrumb summary and required disclaimers", () => {
  it("builds the breadcrumb from microsoldering/equipoName/modelName/translateServiceName(service), filtering out redundant/empty parts", () => {
    expect(panelSrc).toMatch(/selection\.microsoldering \? t\("microsoldering\.title"\) : null/);
    expect(panelSrc).toContain("selection.equipoName");
    expect(panelSrc).toMatch(/selection\.modelName && selection\.modelName !== selection\.equipoName/);
    expect(panelSrc).toContain("translateServiceName(service, language)");
    expect(panelSrc).toContain('.join(" · ")');
  });

  it("always shows the keep-your-customer note and, outside quote, the before-other-expenses disclaimer", () => {
    expect(panelSrc).toContain('t("result.keepCustomerNote")');
    expect(panelSrc).toContain('t("result.disclaimer")');
  });

  it("the Check another price button calls onConsultAnother (wrapped for the hover/tap sound) — no inline navigation/reset logic duplicated here", () => {
    expect(panelSrc).toMatch(/wholesaleHoverProps\(onConsultAnother\)/);
    expect(panelSrc).toContain('t("result.consultAnother")');
  });
});

describe("WholesaleResultPanel.jsx: money hierarchy — Shop Cost is the dominant hero figure, read first", () => {
  it("t(\"result.shopPrice\") and the price value are the very first thing rendered inside the money block — before the tier group and the no-tiers fallback", () => {
    const moneyBlockStart = panelSrc.indexOf('className="wsp-result-money wsp-result-money-reveal"');
    const shopPriceIdx = panelSrc.indexOf('t("result.shopPrice")');
    const tierGroupIdx = panelSrc.indexOf("wsp-result-tier-group");
    const fallbackHeroIdx = panelSrc.indexOf("wsp-result-recommended-value");
    expect(moneyBlockStart).toBeGreaterThan(-1);
    expect(shopPriceIdx).toBeGreaterThan(moneyBlockStart);
    expect(shopPriceIdx).toBeLessThan(tierGroupIdx);
    expect(shopPriceIdx).toBeLessThan(fallbackHeroIdx);
  });

  it("renders the shop-cost figure in its own dedicated hero block", () => {
    expect(panelSrc).toContain('<div className="wsp-result-shopcost-hero">');
    expect(panelSrc).toContain('<span className="wsp-result-shopcost-value">');
  });

  it("the shop-cost value's own font-size is strictly larger than every other money figure on the panel (the fallback recommended value, the fallback profit row, the margin badge, and a tier's own row value)", () => {
    function firstFontSize(selector) {
      // Handles both a plain `font-size: 36px` declaration and a
      // `font-size: clamp(18px, 4vh, 36px)` one (the shop-cost hero uses
      // clamp() for the no-scroll responsive pass) — takes the largest px
      // figure in the declaration, i.e. the size this figure actually
      // renders at once the viewport is tall enough to hit the clamp max,
      // which is the comparison this "dominant hero figure" test cares about.
      const idx = cssSrc.indexOf(`${selector} {`);
      const block = cssSrc.slice(idx, cssSrc.indexOf("}", idx));
      const decl = block.match(/font-size:\s*([^;]+);/)[1];
      const sizes = [...decl.matchAll(/(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
      return Math.max(...sizes);
    }
    const shopCostSize = firstFontSize(".wsp-result-shopcost-value");
    expect(shopCostSize).toBeGreaterThan(firstFontSize(".wsp-result-recommended-value"));
    expect(shopCostSize).toBeGreaterThan(firstFontSize(".wsp-result-profit .wsp-result-money-value"));
    expect(shopCostSize).toBeGreaterThan(firstFontSize(".wsp-result-margin-badge"));
    expect(shopCostSize).toBeGreaterThan(firstFontSize(".wsp-result-tier-price-value"));
    expect(shopCostSize).toBeGreaterThan(firstFontSize(".wsp-result-tier-profit-value"));
    expect(shopCostSize).toBeGreaterThan(firstFontSize(".wsp-result-tier-margin-value"));
  });

  it("within a tier card, the customer-estimate price is the dominant figure — strictly larger than that same card's own profit and margin figures", () => {
    function firstFontSize(selector) {
      const idx = cssSrc.indexOf(`${selector} {`);
      const block = cssSrc.slice(idx, cssSrc.indexOf("}", idx));
      const decl = block.match(/font-size:\s*([^;]+);/)[1];
      const sizes = [...decl.matchAll(/(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
      return Math.max(...sizes);
    }
    const priceSize = firstFontSize(".wsp-result-tier-price-value");
    expect(priceSize).toBeGreaterThan(firstFontSize(".wsp-result-tier-profit-value"));
    expect(priceSize).toBeGreaterThan(firstFontSize(".wsp-result-tier-margin-value"));
    expect(priceSize).toBeGreaterThan(firstFontSize(".wsp-result-tier-row-label"));
  });

  /**
   * Adenda 8, Part A, item 2 — exact hard minimums the user specified,
   * verified against real getComputedStyle() values in-browser at all 6
   * breakpoints (320x568, 375x667, 390x844, 768x1024, 1024x768, 1440x900):
   * Shop Cost 36px mobile / 42px desktop (flat, never vh-scaled down);
   * Customer Estimate 24px <375px, 26px 375-639px, 33px >=640px (flat,
   * width-tiered, never vh-scaled down); Profit >=13px and Margin >=13px
   * at every width (flat 15px/14px, unconditional — no mobile-only shrink
   * exists anymore). These are the SAME literal declarations the browser
   * used to produce the verified table, not independent duplicated values.
   */
  it("Shop Cost is a flat 36px on mobile / 42px on desktop — never vh-scaled below 36", () => {
    const idx = cssSrc.indexOf(".wsp-result-shopcost-value {");
    const block = cssSrc.slice(idx, cssSrc.indexOf("}", idx));
    expect(block).toMatch(/font-size:\s*36px;/);
    expect(block).not.toContain("clamp(");
    const desktopIdx = cssSrc.indexOf("@media (min-width: 640px) {\n  .wsp-result-shopcost-value {");
    const desktopBlock = cssSrc.slice(desktopIdx, cssSrc.indexOf("}", desktopIdx));
    expect(desktopBlock).toMatch(/font-size:\s*42px;/);
  });

  it("Customer Estimate price is flat and width-tiered: 24px base (<375px), 26px from 375px, 33px from 640px — never a vh clamp that could shrink it on a short viewport", () => {
    const baseIdx = cssSrc.indexOf(".wsp-result-tier-price-value {");
    const baseBlock = cssSrc.slice(baseIdx, cssSrc.indexOf("}", baseIdx));
    expect(baseBlock).toMatch(/font-size:\s*24px;/);
    expect(baseBlock).not.toContain("clamp(");
    const mid = cssSrc.indexOf("@media (min-width: 375px) {\n  .wsp-result-tier-price-value {");
    expect(cssSrc.slice(mid, cssSrc.indexOf("}", mid))).toMatch(/font-size:\s*26px;/);
    const desktop = cssSrc.indexOf("@media (min-width: 640px) {\n  .wsp-result-tier-price-value {");
    expect(cssSrc.slice(desktop, cssSrc.indexOf("}", desktop))).toMatch(/font-size:\s*33px;/);
  });

  it("Profit and Margin values are a flat >=13px at EVERY width — no media-query override anywhere shrinks them below the floor", () => {
    function allDeclaredSizes(selector) {
      const sizes = [];
      let idx = cssSrc.indexOf(`${selector} {`);
      while (idx !== -1) {
        const block = cssSrc.slice(idx, cssSrc.indexOf("}", idx));
        const m = block.match(/font-size:\s*(\d+(?:\.\d+)?)px;/);
        if (m) sizes.push(Number(m[1]));
        idx = cssSrc.indexOf(`${selector} {`, idx + 1);
      }
      return sizes;
    }
    const profitSizes = allDeclaredSizes(".wsp-result-tier-profit-value");
    const marginSizes = allDeclaredSizes(".wsp-result-tier-margin-value");
    expect(profitSizes.length).toBeGreaterThan(0);
    expect(marginSizes.length).toBeGreaterThan(0);
    for (const v of profitSizes) expect(v).toBeGreaterThanOrEqual(13);
    for (const v of marginSizes) expect(v).toBeGreaterThanOrEqual(13);
    // and no clamp() anywhere for these two selectors (a clamp could hide a
    // sub-13px floor at some untested viewport height)
    expect(cssSrc).not.toMatch(/\.wsp-result-tier-profit-value\s*\{[^}]*clamp\(/);
    expect(cssSrc).not.toMatch(/\.wsp-result-tier-margin-value\s*\{[^}]*clamp\(/);
  });

  it("the recommendation is a flat, non-clamped 14px with a fixed line-height — never reduced by a vh clamp", () => {
    const idx = cssSrc.indexOf(".wsp-result-recommendation {");
    const block = cssSrc.slice(idx, cssSrc.indexOf("}", idx));
    expect(block).toMatch(/font-size:\s*14px;/);
    expect(block).toMatch(/line-height:\s*1\.4;/);
    expect(block).not.toContain("clamp(");
  });

  it("the Check Another Price button never drops below the 44px minimum touch target at any width", () => {
    const baseIdx = cssSrc.indexOf(".wsp-result-consult-another {");
    const baseBlock = cssSrc.slice(baseIdx, cssSrc.indexOf("}", baseIdx));
    expect(baseBlock).toMatch(/min-height:\s*56px;/);
    const narrowIdx = cssSrc.indexOf("@media (max-width: 359px) {\n  .wsp-result-consult-another {");
    const narrowBlock = cssSrc.slice(narrowIdx, cssSrc.indexOf("}", narrowIdx));
    expect(narrowBlock).toMatch(/min-height:\s*44px;/);
  });

  it("desktop (>=640px) tier price value is exactly within the 30-34px spec range — the mobile floor above never applies past that breakpoint", () => {
    const idx = cssSrc.indexOf("@media (min-width: 640px) {\n  .wsp-result-tier-price-value {");
    expect(idx).toBeGreaterThan(-1);
    const block = cssSrc.slice(idx, cssSrc.indexOf("}", idx));
    const value = Number(block.match(/font-size:\s*(\d+(?:\.\d+)?)px/)[1]);
    expect(value).toBeGreaterThanOrEqual(30);
    expect(value).toBeLessThanOrEqual(34);
  });

  it("wraps the money block in a one-shot reveal animation class", () => {
    expect(panelSrc).toContain("wsp-result-money-reveal");
  });

  it("the no-tiers fallback still shows the 'grow your margin' motivational line near its profit figure", () => {
    expect(panelSrc).toContain("wsp-result-grow-margin");
    expect(panelSrc).toContain('t("result.growMargin")');
  });
});

describe("WholesaleResultPanel.jsx: accessibility — the tier group is a labeled, non-interactive region, not a form control", () => {
  it("the tier group container has role=\"group\" (an informational grouping, never role=radiogroup) and an aria-label naming it", () => {
    const groupIdx = panelSrc.indexOf('className="wsp-result-tier-group"');
    const groupTag = panelSrc.slice(panelSrc.lastIndexOf("<div", groupIdx), panelSrc.indexOf(">", groupIdx) + 1);
    expect(groupTag).toContain('role="group"');
    expect(groupTag).toContain('aria-label={t("result.tierGroupLabel")}');
  });

  it("result.tierGroupLabel no longer implies a choice has to be made — 'Suggested' language, not 'Choose'", () => {
    const enSrc = read("src/i18n/wholesaleTranslations.js");
    expect(enSrc).toMatch(/tierGroupLabel:\s*"Suggested pricing levels"/);
    expect(enSrc).not.toMatch(/tierGroupLabel:\s*"Choose/);
  });
});

describe("WholesaleResultPanel.jsx: catalog names (equipo/model/service) are localized for display only, never mutated", () => {
  it("imports translateCatalogLabel/translateServiceName/resolveServiceDescription and applies the right one to each catalog-sourced name in the breadcrumb", () => {
    expect(panelSrc).toContain(
      'import { translateCatalogLabel, translateServiceName, resolveServiceDescription } from "../../lib/wholesaleCatalogI18n.js";'
    );
    expect(panelSrc).toContain("translateCatalogLabel(selection.equipoName, language)");
    expect(panelSrc).toContain("translateCatalogLabel(selection.modelName, language)");
    // The service's own name goes through translateServiceName, NOT
    // translateCatalogLabel directly — service.name_es (a real,
    // DESK-editable DB field) must win over the legacy hardcoded dictionary
    // translateCatalogLabel alone would silently fall back to. See
    // wholesaleCatalogI18n.js's own header for the 3-tier precedence.
    expect(panelSrc).toContain("translateServiceName(service, language)");
    expect(panelSrc).not.toMatch(/translateCatalogLabel\(service\.name/);
  });
});

describe("WholesaleResultPanel.jsx: Silver/Purple/Gold — three read-only panels, always shown together, never a picker", () => {
  it("hasTiers is derived from hasCompletePriceTiers(service), never a hand-rolled null-check", () => {
    expect(panelSrc).toContain("const hasTiers = hasCompletePriceTiers(service);");
  });

  it("the tier card group renders only when hasTiers is true, and ALL THREE cards render unconditionally together inside it — no per-card gating, no partial state", () => {
    expect(panelSrc).toMatch(/hasTiers \? \(/);
    expect(panelSrc).toContain('className="wsp-result-tier-group"');
    expect(panelSrc).toContain("PRICE_TIERS.map((tier) => {");
  });

  it("PRICE_TIERS defines exactly the three approved levels, in Silver/Purple/Gold order, each reading its own field off the service object", () => {
    const tiersBlock = panelSrc.slice(panelSrc.indexOf("const PRICE_TIERS"), panelSrc.indexOf("];") + 2);
    expect(tiersBlock).toMatch(/key:\s*"competitive"[\s\S]*priceField:\s*"competitive_price"/);
    expect(tiersBlock).toMatch(/key:\s*"recommended"[\s\S]*priceField:\s*"recommended_price"/);
    expect(tiersBlock).toMatch(/key:\s*"highProfit"[\s\S]*priceField:\s*"high_profit_price"/);
    expect(tiersBlock.indexOf('key: "competitive"')).toBeLessThan(tiersBlock.indexOf('key: "recommended"'));
    expect(tiersBlock.indexOf('key: "recommended"')).toBeLessThan(tiersBlock.indexOf('key: "highProfit"'));
  });

  it("Silver has no badge at all (badgeKey: null) — only Purple and Gold carry one", () => {
    const tiersBlock = panelSrc.slice(panelSrc.indexOf("const PRICE_TIERS"), panelSrc.indexOf("];") + 2);
    expect(tiersBlock).toMatch(/key:\s*"competitive"[\s\S]*?badgeKey:\s*null/);
    expect(tiersBlock).toMatch(/key:\s*"recommended"[\s\S]*?badgeKey:\s*"result\.tierBadgeRecommended"/);
    expect(tiersBlock).toMatch(/key:\s*"highProfit"[\s\S]*?badgeKey:\s*"result\.tierBadgeHighProfit"/);
  });

  it("Purple's badge reads 'Recommended', never 'Selected' or any selection-implying word", () => {
    expect(panelSrc).toContain("result.tierBadgeRecommended");
    expect(panelSrc).not.toMatch(/badge.{0,40}[Ss]elected/);
  });

  it("every tier card renders an icon AND a name AND (for Purple/Gold) a badge — color is never the only signal, and nothing marks a card as 'active' or 'selected'", () => {
    const cardBlock = panelSrc.slice(panelSrc.indexOf("PRICE_TIERS.map"), panelSrc.indexOf("</div>\n              )}"));
    expect(cardBlock).toContain("<tier.Icon");
    expect(cardBlock).toContain("{t(tier.nameKey)}");
    expect(cardBlock).toContain("tier.badgeKey && ");
    expect(cardBlock).not.toContain("wsp-result-tier-selected");
    expect(cardBlock).not.toMatch(/isActive/);
  });

  it("each card shows customer estimate, then estimated profit, then margin — in that exact order, each with its own translated label", () => {
    const cardBlock = panelSrc.slice(panelSrc.indexOf("PRICE_TIERS.map"), panelSrc.indexOf("wsp-result-money-hero"));
    const estimateIdx = cardBlock.indexOf("result.tierCustomerEstimateLabel");
    const profitIdx = cardBlock.indexOf("result.tierEstimatedProfitLabel");
    const marginIdx = cardBlock.indexOf("result.tierMarginLabel");
    expect(estimateIdx).toBeGreaterThan(-1);
    expect(profitIdx).toBeGreaterThan(estimateIdx);
    expect(marginIdx).toBeGreaterThan(profitIdx);
  });

  it("every tier's price/profit/margin come from formatPrice/formatTierProfit/formatTierMargin — never a raw number interpolated without currency/percent formatting", () => {
    expect(panelSrc).toContain("{formatPrice(tierPrice)}");
    expect(panelSrc).toContain("{formatTierProfit(tierPricing, formatPrice)}");
    expect(panelSrc).toContain("{formatTierMargin(tierPricing)}");
    expect(panelSrc).not.toContain("{tierPrice}");
  });

  it("computeTierPricing is used for every tier card's profit/margin, never a raw subtraction of the tier's own field", () => {
    expect(panelSrc).toContain("const tierPricing = computeTierPricing(service, tierPrice);");
    expect(panelSrc).not.toMatch(/tierPrice\s*-\s*service\.(fixed_price|price_min|price_max)/);
  });

  it("tier cards are wired through wholesaleHoverProps() with no activate argument — the hover/tap tone still fires, but there is no click handler that could change a value", () => {
    expect(panelSrc).toContain("{...wholesaleHoverProps()}");
  });
});

describe("WholesaleResultPanel.jsx: fallback — a service without complete tiers shows DESK's recommended price as read-only text, never an input", () => {
  it("the fallback branch renders wsp-result-recommended-value (a <span>), never wsp-result-recommended-input", () => {
    expect(panelSrc).toContain("wsp-result-recommended-value");
    expect(panelSrc).not.toContain("wsp-result-recommended-input");
  });

  it("the fallback value is formatPrice(service.recommended_price) directly — read straight from the DESK-configured field, never a local editable copy", () => {
    expect(panelSrc).toContain("{formatPrice(service.recommended_price)}");
  });

  it("the fallback still shows the potential-profit/margin summary, computed via computeTierPricing from the same read-only recommended_price — the experience isn't blank", () => {
    expect(panelSrc).toContain("const fallbackPricing =");
    expect(panelSrc).toContain("computeTierPricing(service, service.recommended_price)");
    expect(panelSrc).toContain("formatTierProfit(fallbackPricing, formatPrice)");
    expect(panelSrc).toContain("formatTierMargin(fallbackPricing)");
  });
});

describe("Tactile-redesign fixture, verified through the real pure-calc function: Shop Cost $75, Silver $120/$45/38%, Purple $159/$84/53% (recommended), Gold $190/$115/61%", () => {
  it("matches the exact numbers from the approved mock", () => {
    const silver = computeFixedPricing({ wholesalePrice: 75, customerPrice: 120 });
    expect(silver.potentialProfit).toBe(45);
    expect(Math.round(silver.estimatedMarginPercent)).toBe(38);

    const purple = computeFixedPricing({ wholesalePrice: 75, customerPrice: 159 });
    expect(purple.potentialProfit).toBe(84);
    expect(Math.round(purple.estimatedMarginPercent)).toBe(53);

    const gold = computeFixedPricing({ wholesalePrice: 75, customerPrice: 190 });
    expect(gold.potentialProfit).toBe(115);
    expect(Math.round(gold.estimatedMarginPercent)).toBe(61);
  });
});

describe("wholesalePortal.css: read-only tier panels — soft hover only, no button affordances, professional palette", () => {
  it("Silver is a light metallic gray gradient, never a colored/neon fill", () => {
    const block = cssSrc.slice(cssSrc.indexOf(".wsp-result-tier-competitive {"), cssSrc.indexOf("}", cssSrc.indexOf(".wsp-result-tier-competitive {")));
    expect(block).toMatch(/#f4f7fb|#aeb8c6/i);
  });

  it("Purple is a light professional violet, never a saturated/neon purple", () => {
    const block = cssSrc.slice(cssSrc.indexOf(".wsp-result-tier-recommended {"), cssSrc.indexOf("}", cssSrc.indexOf(".wsp-result-tier-recommended {")));
    expect(block).toMatch(/#f1eaff|#b99cff/i);
  });

  it("Gold is an elegant champagne gold, never a bright/pure yellow", () => {
    const block = cssSrc.slice(cssSrc.indexOf(".wsp-result-tier-highProfit {"), cssSrc.indexOf("}", cssSrc.indexOf(".wsp-result-tier-highProfit {")));
    expect(block).toMatch(/#fff4bf|#d4af37/i);
    expect(block).not.toMatch(/#ffff00|#ffeb00|#fde100/i);
  });

  it("every tier card keeps the same dark-navy card text color regardless of which gradient it sits on", () => {
    const cardBlock = cssSrc.slice(cssSrc.indexOf(".wsp-result-tier-card {"), cssSrc.indexOf("}", cssSrc.indexOf(".wsp-result-tier-card {")));
    expect(cardBlock).toContain("color: var(--wsp-card-text);");
  });

  it("border-radius stays a real rounded-panel radius (>=10px, never a sharp rectangle)", () => {
    const cardBlock = cssSrc.slice(cssSrc.indexOf(".wsp-result-tier-card {"), cssSrc.indexOf("}", cssSrc.indexOf(".wsp-result-tier-card {")));
    const radius = Number(cardBlock.match(/border-radius:\s*(\d+)px/)[1]);
    expect(radius).toBeGreaterThanOrEqual(10);
  });
});

describe("wholesalePortal.css: 'Check another price' is a fixed-width rectangular button, never a full-width bar", () => {
  const block = cssSrc.slice(cssSrc.indexOf(".wsp-result-consult-another {"), cssSrc.indexOf("}", cssSrc.indexOf(".wsp-result-consult-another {")));

  it("is centered (align-self: center), never stretched to the panel's full width", () => {
    expect(block).toContain("align-self: center;");
    expect(block).not.toContain("align-self: stretch;");
  });

  it("caps its width at 300px (within the approved 280-320px range) while still shrinking on the narrowest phones instead of overflowing", () => {
    const widthMatch = block.match(/width:\s*min\((\d+)px,\s*100%\)/);
    expect(widthMatch).not.toBeNull();
    const capPx = Number(widthMatch[1]);
    expect(capPx).toBeGreaterThanOrEqual(280);
    expect(capPx).toBeLessThanOrEqual(320);
  });

  it("height is within the approved 54-58px range", () => {
    const minHeight = Number(block.match(/min-height:\s*(\d+)px/)[1]);
    expect(minHeight).toBeGreaterThanOrEqual(54);
    expect(minHeight).toBeLessThanOrEqual(58);
  });

  it("border-radius is close to the approved ~12px", () => {
    const radius = Number(block.match(/border-radius:\s*(\d+)px/)[1]);
    expect(radius).toBeGreaterThanOrEqual(10);
    expect(radius).toBeLessThanOrEqual(14);
  });

  it("the reset icon (RotateCcw) is still the first child, before the label text — icon-left, matching the approved spec", () => {
    const btnIdx = panelSrc.indexOf('className="wsp-btn wsp-btn-primary wsp-result-consult-another"');
    const iconIdx = panelSrc.indexOf("<RotateCcw", btnIdx);
    const labelIdx = panelSrc.indexOf('t("result.consultAnother")', btnIdx);
    expect(iconIdx).toBeGreaterThan(btnIdx);
    expect(iconIdx).toBeLessThan(labelIdx);
  });
});
