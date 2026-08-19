import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const panelSrc = read("src/components/wholesale/WholesaleResultPanel.jsx");

describe("WholesaleResultPanel.jsx: wired to the tested pure calc functions, never reimplements the math", () => {
  it("imports computeFixedPricing/computeRangePricing from the tested lib, never a local reimplementation", () => {
    expect(panelSrc).toContain(
      'import { computeFixedPricing, computeRangePricing } from "../../lib/wholesaleMargin.js"'
    );
    expect(panelSrc).not.toMatch(/function computeFixedPricing|function computeRangePricing/);
  });

  it("never contains its own margin/profit arithmetic (no raw subtraction/division of price fields)", () => {
    expect(panelSrc).not.toMatch(/customerPrice\s*-\s*service\.(fixed_price|price_min|price_max)/);
    expect(panelSrc).not.toMatch(/\/\s*customerPrice\s*\*\s*100/);
  });

  it("initializes the editable customer price field from service.recommended_price, never a hardcoded default", () => {
    expect(panelSrc).toMatch(/service\.recommended_price != null \? String\(service\.recommended_price\) : ""/);
  });
});

describe("WholesaleResultPanel.jsx: pricing_type branching — fixed / range / quote", () => {
  it("quote services show the diagnostic-required message and skip the figures/input entirely", () => {
    expect(panelSrc).toContain('t("result.requiresDiagnostic")');
    expect(panelSrc).toMatch(/isQuote \? \(/);
  });

  it("quote services never render the customer-price input or the disclaimer", () => {
    // Both are inside the !isQuote branch / gated by !isQuote — confirm the
    // gating exists rather than assuming from position alone.
    expect(panelSrc).toMatch(/\{!isQuote && <p className="wsp-result-disclaimer">/);
  });

  it("range services show profit/margin as a MIN–MAX pair, never a single false-precision number", () => {
    expect(panelSrc).toMatch(/rangeResult[\s\S]{0,40}potentialProfitMin[\s\S]{0,40}potentialProfitMax/);
    expect(panelSrc).toMatch(/rangeResult[\s\S]{0,60}estimatedMarginPercentMin[\s\S]{0,60}estimatedMarginPercentMax/);
  });

  it("range services show the rangeNote disclaimer", () => {
    expect(panelSrc).toMatch(/\{isRange && <p className="wsp-result-range-note">\{t\("result\.rangeNote"\)\}<\/p>\}/);
  });

  it("fixed services use computeFixedPricing, never computeRangePricing", () => {
    expect(panelSrc).toMatch(/!isQuote && !isRange && customerPrice != null\s*\n\s*\? computeFixedPricing/);
  });
});

describe("WholesaleResultPanel.jsx: loss is shown, never hidden or zeroed", () => {
  it("derives isLoss from the real calc result (fixedResult.isLoss / rangeResult.isLoss), never a hardcoded false", () => {
    expect(panelSrc).toMatch(/const isLoss = fixedResult\?\.isLoss \|\| rangeResult\?\.isLoss \|\| false;/);
  });

  it("renders a visible loss warning when isLoss is true, using the exact translation key", () => {
    expect(panelSrc).toMatch(/\{isLoss && \(/);
    expect(panelSrc).toContain('t("result.lossWarning")');
  });

  it("the potential-profit figure itself gets a distinct loss style class, the number is never suppressed", () => {
    expect(panelSrc).toMatch(/className=\{`wsp-result-money-value\$\{isLoss \? " wsp-result-figure-loss" : ""\}`\}/);
  });
});

describe("WholesaleResultPanel.jsx: never surfaces Torays Boost's own internal cost/margin", () => {
  it("only ever displays wholesalePrice (Tu precio Shop) and recommended/customer prices — no 'internal', 'cost basis', or 'torays margin' field", () => {
    expect(panelSrc.toLowerCase()).not.toMatch(/internal.?margin|torays.?margin|cost.?basis|our.?margin/);
  });

  it("shows exactly the required 4 result labels: shopPrice, recommendedPrice, potentialProfit, estimatedMargin", () => {
    expect(panelSrc).toContain('t("result.shopPrice")');
    expect(panelSrc).toContain('t("result.recommendedPrice")');
    expect(panelSrc).toContain('t("result.potentialProfit")');
    expect(panelSrc).toContain('t("result.estimatedMargin")');
  });
});

describe("WholesaleResultPanel.jsx: breadcrumb summary and required disclaimers", () => {
  it("builds the breadcrumb from microsoldering/equipoName/modelName/service.name, filtering out redundant/empty parts", () => {
    expect(panelSrc).toMatch(/selection\.microsoldering \? t\("microsoldering\.title"\) : null/);
    expect(panelSrc).toContain("selection.equipoName");
    expect(panelSrc).toMatch(/selection\.modelName && selection\.modelName !== selection\.equipoName/);
    expect(panelSrc).toContain("service.name");
    expect(panelSrc).toContain('.join(" · ")');
  });

  it("always shows the keep-your-customer note and, outside quote, the before-other-expenses disclaimer", () => {
    expect(panelSrc).toContain('t("result.keepCustomerNote")');
    expect(panelSrc).toContain('t("result.disclaimer")');
  });

  it("the Consultar otro precio button calls onConsultAnother — no inline navigation/reset logic duplicated here", () => {
    expect(panelSrc).toMatch(/onClick=\{onConsultAnother\}/);
    expect(panelSrc).toContain('t("result.consultAnother")');
  });
});

describe("WholesaleResultPanel.jsx: mobile-friendly numeric input", () => {
  it("customer price input uses inputMode=decimal and type=number for a numeric mobile keyboard", () => {
    expect(panelSrc).toMatch(/type="number"[\s\S]{0,40}inputMode="decimal"/);
  });

  it("rejects negative input at the HTML level too (min=0), belt-and-suspenders with the JS-level validation in wholesaleMargin.js", () => {
    expect(panelSrc).toContain('min="0"');
  });
});

describe("WholesaleResultPanel.jsx: Recommended Customer Price is the single editable hero figure, never duplicated", () => {
  it("the editable input IS the recommendedPrice figure — same wsp-result-money-hero block carries both the label and the input", () => {
    const heroStart = panelSrc.indexOf("wsp-result-money-hero");
    const heroEnd = panelSrc.indexOf("</div>", panelSrc.indexOf("wsp-result-recommended-input"));
    const heroBlock = panelSrc.slice(heroStart, heroEnd);
    expect(heroBlock).toContain('t("result.recommendedPrice")');
    expect(heroBlock).toContain("wsp-result-recommended-input");
    expect(heroBlock).toContain("customerPriceInput");
  });

  it("shows a small 'Editable' badge next to the recommended price label", () => {
    expect(panelSrc).toContain("wsp-result-editable-badge");
    expect(panelSrc).toContain('t("result.editableLabel")');
  });

  it("recommended_price is never rendered a second time as a separate read-only value — every reference to it lives inside the useState initializer line, none elsewhere in the render output", () => {
    const initializerLine = 'service.recommended_price != null ? String(service.recommended_price) : ""';
    expect(panelSrc).toContain(initializerLine);
    const withoutInitializer = panelSrc.replace(initializerLine, "");
    expect(withoutInitializer).not.toContain("service.recommended_price");
  });

  it("editing the input recalculates profit/margin immediately — profitDisplay/marginDisplay are derived from customerPrice on every render, no separate 'apply' step", () => {
    expect(panelSrc).toMatch(/const customerPrice = customerPriceInput === "" \? null : Number\(customerPriceInput\);/);
    expect(panelSrc).toContain("const profitDisplay = rangeResult");
    expect(panelSrc).toContain("const marginDisplay = rangeResult");
    // both are computed from fixedResult/rangeResult, which themselves depend on customerPrice — no onClick/onBlur gate before recompute
    expect(panelSrc).not.toMatch(/onBlur=\{.*setCustomerPrice/);
    expect(panelSrc).not.toContain("applyCustomerPrice");
  });
});

describe("WholesaleResultPanel.jsx: money hierarchy — distinct size/color per figure, never a uniform table", () => {
  it("uses dedicated row classes for shop cost, the recommended-price hero, profit, and the margin badge — never the old uniform wsp-result-figure-row", () => {
    expect(panelSrc).toContain("wsp-result-shopcost");
    expect(panelSrc).toContain("wsp-result-money-hero");
    expect(panelSrc).toContain("wsp-result-profit");
    expect(panelSrc).toContain("wsp-result-margin-badge");
    expect(panelSrc).not.toContain("wsp-result-figure-row");
    expect(panelSrc).not.toContain("wsp-result-figures");
  });

  it("shows the 'grow your margin' motivational line near the profit figure", () => {
    expect(panelSrc).toContain("wsp-result-grow-margin");
    expect(panelSrc).toContain('t("result.growMargin")');
  });

  it("wraps the money block in a one-shot reveal animation class", () => {
    expect(panelSrc).toContain("wsp-result-money-reveal");
  });
});

describe("WholesaleResultPanel.jsx: catalog names (equipo/model/service) are localized for display only, never mutated", () => {
  it("imports translateCatalogLabel and applies it to every catalog-sourced name in the breadcrumb", () => {
    expect(panelSrc).toContain(
      'import { translateCatalogLabel } from "../../lib/wholesaleCatalogI18n.js";'
    );
    expect(panelSrc).toContain("translateCatalogLabel(selection.equipoName, language)");
    expect(panelSrc).toContain("translateCatalogLabel(selection.modelName, language)");
    expect(panelSrc).toContain("translateCatalogLabel(service.name, language)");
  });
});
