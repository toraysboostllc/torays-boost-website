// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { render, screen, cleanup } from "@testing-library/react";
import { WholesalePricingNotice } from "../src/components/wholesale/WholesalePricingNotice.jsx";
import { WholesaleLocaleProvider } from "../src/i18n/WholesaleLocaleContext.jsx";
import { WHOLESALE_LOCALE_STORAGE_KEY } from "../src/lib/wholesaleLocale.js";

/**
 * Short, permanent, animated pricing notice shown directly above the
 * "Torays Boost Sales" card (see WholesalePrices.jsx). Exact copy:
 *   EN: "Prices are based on market conditions and may change. Always
 *        verify the current price before quoting."
 *   ES: "Los precios se basan en las condiciones del mercado y pueden
 *        cambiar. Verifique siempre el precio actual antes de cotizar."
 * Only "may change"/"pueden cambiar" renders in Torays Boost red, and
 * only that phrase carries the slow, continuous pulse — never the whole
 * banner. No legal/session/catalog/price/warranty state is touched by
 * this component at all (it renders static, pre-supplied i18n strings).
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const cssPath = join(__dirname, "..", "src", "styles", "wholesalePortal.css");
const css = readFileSync(cssPath, "utf8");
const pagePath = join(__dirname, "..", "src", "pages", "WholesalePrices.jsx");
const pageSrc = readFileSync(pagePath, "utf8");

function ruleBody(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped.replace(/\\ /g, "\\s+") + "\\s*\\{([^}]*)\\}");
  const m = css.match(re);
  return m ? m[1] : null;
}

// Strips /* */ and // comments before scanning source for forbidden
// substrings — this component's own JSDoc legitimately DISCUSSES the
// "never dangerouslySetInnerHTML" rule and which state it doesn't touch
// (catalog/warranty/legal) in prose, which would otherwise false-positive
// against a raw substring/regex check of the whole file.
function stripJsComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function setEnglish() {
  window.localStorage.setItem(WHOLESALE_LOCALE_STORAGE_KEY, JSON.stringify({ language: "en", country: "US", currency: "USD" }));
}
function setSpanish() {
  window.localStorage.setItem(WHOLESALE_LOCALE_STORAGE_KEY, JSON.stringify({ language: "es", country: "US", currency: "USD" }));
}

function renderNotice() {
  return render(
    <WholesaleLocaleProvider>
      <WholesalePricingNotice />
    </WholesaleLocaleProvider>
  );
}

describe("WholesalePricingNotice: exact EN/ES copy, split so only the red phrase is isolated", () => {
  it("renders the exact English sentence, with 'may change' isolated in its own element", () => {
    setEnglish();
    renderNotice();
    const highlight = screen.getByText("may change");
    // The before/after parts are bare text nodes (not their own element),
    // so they can't be queried with getByText — the full-sentence check
    // below (comparing the <p>'s reconstructed textContent) is what
    // actually proves the 3 parts recombine into the exact approved copy.
    const container = highlight.closest("p");
    expect(container.textContent).toBe(
      "Prices are based on market conditions and may change. Always verify the current price before quoting."
    );
  });

  it("renders the exact Spanish sentence, with 'pueden cambiar' isolated in its own element", () => {
    setSpanish();
    renderNotice();
    const highlight = screen.getByText("pueden cambiar");
    const container = highlight.closest("p");
    expect(container.textContent).toBe(
      "Los precios se basan en las condiciones del mercado y pueden cambiar. Verifique siempre el precio actual antes de cotizar."
    );
  });

  it("the highlighted phrase carries its own dedicated class, never mixed into the surrounding text nodes", () => {
    setEnglish();
    renderNotice();
    const highlight = screen.getByText("may change");
    expect(highlight.tagName).toBe("SPAN");
    expect(highlight.className).toBe("wsp-pricing-notice-highlight");
  });

  it("never uses dangerouslySetInnerHTML — plain text composition only, matching the rest of this codebase's discipline", () => {
    const src = readFileSync(join(__dirname, "..", "src", "components", "wholesale", "WholesalePricingNotice.jsx"), "utf8");
    expect(stripJsComments(src)).not.toContain("dangerouslySetInnerHTML");
  });

  it("has role=\"note\" and no interactive/focusable element of its own", () => {
    setEnglish();
    renderNotice();
    const note = screen.getByRole("note");
    expect(note).toBeTruthy();
    expect(note.querySelector("button, a, input, [tabindex]")).toBeNull();
  });
});

describe("wholesalePortal.css: the pulse is scoped to the highlight only, pauses on hover/focus, and respects prefers-reduced-motion", () => {
  it("only .wsp-pricing-notice-highlight animates — the icon/text/card itself never does", () => {
    const highlightBody = ruleBody(".wsp-pricing-notice-highlight");
    expect(highlightBody, ".wsp-pricing-notice-highlight rule not found").toBeTruthy();
    expect(highlightBody).toMatch(/animation:\s*wsp-pricing-notice-pulse\s+2\.6s\s+ease-in-out\s+infinite\s*;/);
    expect(ruleBody(".wsp-pricing-notice")).not.toMatch(/animation:/);
    expect(ruleBody(".wsp-pricing-notice-icon")).not.toMatch(/animation:/);
    expect(ruleBody(".wsp-pricing-notice-text")).not.toMatch(/animation:/);
  });

  it("the pulse keyframes only change opacity — no layout-shifting transform/position", () => {
    const m = css.match(/@keyframes wsp-pricing-notice-pulse\s*\{([\s\S]*?)\n\}/);
    expect(m, "wsp-pricing-notice-pulse keyframes not found").toBeTruthy();
    const body = m[1];
    expect(body).toMatch(/opacity:/);
    expect(body).not.toMatch(/transform:|top:|left:|width:|height:/);
  });

  it("pauses the animation on hover AND focus-within of the whole notice, not just the highlighted span", () => {
    const idx = css.indexOf("animation-play-state: paused");
    expect(idx, "animation-play-state: paused rule not found").toBeGreaterThan(-1);
    const selectorStart = css.lastIndexOf(".wsp-pricing-notice:hover", idx);
    expect(selectorStart, "could not find the .wsp-pricing-notice:hover selector before the paused declaration").toBeGreaterThan(-1);
    const selectorBlock = css.slice(selectorStart, idx);
    expect(selectorBlock).toContain(".wsp-pricing-notice:hover .wsp-pricing-notice-highlight");
    expect(selectorBlock).toContain(".wsp-pricing-notice:focus-within .wsp-pricing-notice-highlight");
  });

  it("disables the animation entirely under prefers-reduced-motion, falling back to fully opaque (never stuck mid-pulse at 0.72)", () => {
    const idx = css.indexOf("@media (prefers-reduced-motion: reduce)", css.indexOf(".wsp-pricing-notice-highlight"));
    expect(idx, "no prefers-reduced-motion block found after the highlight rule").toBeGreaterThan(-1);
    const block = css.slice(idx, css.indexOf("}", css.indexOf("}", idx) + 1) + 1);
    expect(block).toContain(".wsp-pricing-notice-highlight");
    expect(block).toMatch(/animation:\s*none\s*;/);
    expect(block).toMatch(/opacity:\s*1\s*;/);
  });

  it("the highlight color is the existing --wsp-red token — no new color introduced", () => {
    expect(ruleBody(".wsp-pricing-notice-highlight")).toContain("color: var(--wsp-red)");
    expect(ruleBody(".wsp-pricing-notice-icon")).toContain("color: var(--wsp-red)");
  });
});

describe("WholesalePrices.jsx: mounted directly above the Sales card, gated by the same visibility flag", () => {
  it("imports and renders WholesalePricingNotice immediately before <WholesaleSalesModule, gated on state.salesModule?.visible", () => {
    expect(pageSrc).toContain('import { WholesalePricingNotice } from "../components/wholesale/WholesalePricingNotice.jsx";');
    const noticeIdx = pageSrc.indexOf("state.salesModule?.visible && <WholesalePricingNotice />");
    const moduleIdx = pageSrc.indexOf("<WholesaleSalesModule");
    expect(noticeIdx, "notice render call not found").toBeGreaterThan(-1);
    expect(moduleIdx).toBeGreaterThan(noticeIdx);
  });

  it("never touches legal, session, catalog, price, or warranty state — the only prop threaded through is the pre-existing salesModule visibility flag", () => {
    const src = readFileSync(join(__dirname, "..", "src", "components", "wholesale", "WholesalePricingNotice.jsx"), "utf8");
    expect(stripJsComments(src)).not.toMatch(/legalDocumentId|acceptWholesale|fetchWholesale|warranty|catalog|equipmentType/i);
  });
});
