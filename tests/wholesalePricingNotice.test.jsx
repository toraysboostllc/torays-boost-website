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
 * "may change"/"pueden cambiar" renders in Torays Boost red (no
 * animation of its own). No legal/session/catalog/price/warranty state
 * is touched by this component at all (it renders static, pre-supplied
 * i18n strings).
 *
 * Design corrected 2026-08-22: a real Preview test showed the FIRST
 * version (static sentence, only the highlighted phrase pulsing) did not
 * match the approved spec — the WHOLE sentence must scroll continuously,
 * right to left, ~25s per loop, built from a duplicated `aria-hidden`
 * copy on a `max-content` track for a seamless loop. This file replaces
 * the old pulse-specific assertions with coverage for that design:
 * exact-copy correctness (now across 2 identical copies, one real one
 * aria-hidden), the scroll keyframes/duration/timing, hover/focus/
 * focus-within pause, keyboard accessibility (tabIndex=0 + visible
 * focus), and the reduced-motion fallback to one static, complete,
 * non-duplicated sentence.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const cssPath = join(__dirname, "..", "src", "styles", "wholesalePortal.css");
const css = readFileSync(cssPath, "utf8");
const pagePath = join(__dirname, "..", "src", "pages", "WholesalePrices.jsx");
const pageSrc = readFileSync(pagePath, "utf8");
const componentPath = join(__dirname, "..", "src", "components", "wholesale", "WholesalePricingNotice.jsx");
const componentSrc = readFileSync(componentPath, "utf8");

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

const EN_SENTENCE = "Prices are based on market conditions and may change. Always verify the current price before quoting.";
const ES_SENTENCE = "Los precios se basan en las condiciones del mercado y pueden cambiar. Verifique siempre el precio actual antes de cotizar.";

describe("WholesalePricingNotice: exact EN/ES copy, present in exactly 2 identical copies (real + aria-hidden)", () => {
  it("renders the exact English sentence twice — once real, once aria-hidden — both byte-identical", () => {
    setEnglish();
    renderNotice();
    const paragraphs = document.querySelectorAll(".wsp-pricing-notice-text");
    expect(paragraphs.length).toBe(2);
    expect(paragraphs[0].textContent).toBe(EN_SENTENCE);
    expect(paragraphs[1].textContent).toBe(EN_SENTENCE);
  });

  it("renders the exact Spanish sentence twice, both byte-identical", () => {
    setSpanish();
    renderNotice();
    const paragraphs = document.querySelectorAll(".wsp-pricing-notice-text");
    expect(paragraphs.length).toBe(2);
    expect(paragraphs[0].textContent).toBe(ES_SENTENCE);
    expect(paragraphs[1].textContent).toBe(ES_SENTENCE);
  });

  it("ONLY the second (duplicate) copy carries aria-hidden=\"true\" — the real, first copy is never hidden from assistive tech", () => {
    setEnglish();
    renderNotice();
    const paragraphs = document.querySelectorAll(".wsp-pricing-notice-text");
    expect(paragraphs[0].getAttribute("aria-hidden")).toBeNull();
    expect(paragraphs[1].getAttribute("aria-hidden")).toBe("true");
  });

  it("both copies isolate 'may change' in its own red-highlight span, never mixed into the surrounding text nodes", () => {
    setEnglish();
    renderNotice();
    const highlights = screen.getAllByText("may change");
    expect(highlights.length).toBe(2);
    for (const h of highlights) {
      expect(h.tagName).toBe("SPAN");
      expect(h.className).toBe("wsp-pricing-notice-highlight");
    }
  });

  it("never uses dangerouslySetInnerHTML — plain text composition only, matching the rest of this codebase's discipline", () => {
    expect(stripJsComments(componentSrc)).not.toContain("dangerouslySetInnerHTML");
  });
});

describe("WholesalePricingNotice: keyboard accessibility", () => {
  it("has role=\"note\" and tabIndex=0 (deliberately focusable, so a keyboard user can pause the scroll to read it)", () => {
    setEnglish();
    renderNotice();
    const note = screen.getByRole("note");
    expect(note.getAttribute("tabindex")).toBe("0");
  });

  it("has no OTHER focusable/interactive element — the note itself is the only stop in tab order", () => {
    setEnglish();
    renderNotice();
    const note = screen.getByRole("note");
    expect(note.querySelector("button, a, input, select, textarea, [tabindex]")).toBeNull();
  });
});

describe("wholesalePortal.css: the whole sentence scrolls right-to-left, ~25s, seamless loop", () => {
  it(".wsp-pricing-notice-track animates wsp-pricing-notice-scroll for exactly 25s, linear, infinite", () => {
    const body = ruleBody(".wsp-pricing-notice-track");
    expect(body, ".wsp-pricing-notice-track rule not found").toBeTruthy();
    expect(body).toMatch(/animation:\s*wsp-pricing-notice-scroll\s+25s\s+linear\s+infinite\s*;/);
    expect(body).toContain("width: max-content");
  });

  it("the scroll keyframes move via transform only (0 -> -50%), never opacity/color — a distinct animation from the old pulse, which no longer exists", () => {
    const m = css.match(/@keyframes wsp-pricing-notice-scroll\s*\{([\s\S]*?)\n\}/);
    expect(m, "wsp-pricing-notice-scroll keyframes not found").toBeTruthy();
    const body = m[1];
    expect(body).toMatch(/transform:\s*translateX\(0\)/);
    expect(body).toMatch(/transform:\s*translateX\(-50%\)/);
    expect(body).not.toMatch(/opacity:/);
    // The old pulse keyframes/animation must be fully gone, not just unused.
    expect(css).not.toContain("@keyframes wsp-pricing-notice-pulse");
    expect(css).not.toContain("wsp-pricing-notice-pulse");
  });

  it(".wsp-pricing-notice-highlight no longer carries its own animation — a second, independent motion would compete with the track's scroll", () => {
    const body = ruleBody(".wsp-pricing-notice-highlight");
    expect(body).not.toMatch(/animation:/);
    expect(body).toContain("color: var(--wsp-red)");
  });

  it("the viewport clips the oversized track (overflow: hidden on a min-width: 0 flex child) so the marquee can never cause page-level horizontal overflow", () => {
    const body = ruleBody(".wsp-pricing-notice-viewport");
    expect(body, ".wsp-pricing-notice-viewport rule not found").toBeTruthy();
    expect(body).toMatch(/overflow:\s*hidden\s*;/);
    expect(body).toMatch(/min-width:\s*0\s*;/);
  });

  it("pauses the scroll on hover, :focus, AND :focus-within of the whole notice (not just a descendant span)", () => {
    const idx = css.indexOf("animation-play-state: paused");
    expect(idx, "animation-play-state: paused rule not found").toBeGreaterThan(-1);
    const selectorStart = css.lastIndexOf(".wsp-pricing-notice:hover", idx);
    expect(selectorStart, "could not find the .wsp-pricing-notice:hover selector before the paused declaration").toBeGreaterThan(-1);
    const selectorBlock = css.slice(selectorStart, idx);
    expect(selectorBlock).toContain(".wsp-pricing-notice:hover .wsp-pricing-notice-track");
    expect(selectorBlock).toContain(".wsp-pricing-notice:focus .wsp-pricing-notice-track");
    expect(selectorBlock).toContain(".wsp-pricing-notice:focus-within .wsp-pricing-notice-track");
  });

  it("shows a visible focus-visible outline on the notice itself, using the existing --wsp-blue-light token (no new color)", () => {
    const body = ruleBody(".wsp-pricing-notice:focus-visible");
    expect(body, ".wsp-pricing-notice:focus-visible rule not found").toBeTruthy();
    expect(body).toMatch(/outline:\s*2px solid var\(--wsp-blue-light\)/);
  });

  it("under prefers-reduced-motion, the track stops scrolling, the viewport stops clipping, and the duplicate copy is hidden — leaving exactly one static, complete, wrapped sentence", () => {
    const idx = css.indexOf("@media (prefers-reduced-motion: reduce)", css.indexOf(".wsp-pricing-notice-track"));
    expect(idx, "no prefers-reduced-motion block found after the track rule").toBeGreaterThan(-1);
    const block = css.slice(idx, css.lastIndexOf("}") + 1);
    expect(block).toMatch(/\.wsp-pricing-notice-viewport\s*\{[^}]*overflow:\s*visible\s*;/);
    expect(block).toMatch(/\.wsp-pricing-notice-track\s*\{[^}]*animation:\s*none\s*;/);
    expect(block).toMatch(/\.wsp-pricing-notice-track\s*\{[^}]*width:\s*auto\s*;/);
    expect(block).toMatch(/\.wsp-pricing-notice-text\s*\{[^}]*white-space:\s*normal\s*;/);
    expect(block).toMatch(/\[aria-hidden="true"\]\s*\{[^}]*display:\s*none\s*;/);
  });

  it("the highlight color is still the existing --wsp-red token — no new color introduced", () => {
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
    expect(stripJsComments(componentSrc)).not.toMatch(/legalDocumentId|acceptWholesale|fetchWholesale|warranty|catalog|equipmentType/i);
  });
});
