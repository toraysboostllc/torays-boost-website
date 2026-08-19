import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const selectorSrc = read("src/components/wholesale/WholesaleLocaleSelector.jsx");
const cssSrc = read("src/styles/wholesalePortal.css");

const enDict = read("src/i18n/wholesaleTranslations.js");

describe("WholesaleLocaleSelector.jsx: country is informational (flag + USA, no currency chip), only language is a real toggle", () => {
  it("renders exactly 2 language buttons (English/Español), no dropdown", () => {
    expect((selectorSrc.match(/<button/g) || []).length).toBe(2);
    expect(selectorSrc).toMatch(/>\s*English\s*</);
    expect(selectorSrc).toMatch(/>\s*Español\s*</);
  });

  it("never renders a <select> — country is a plain chip, not a picker offering non-working options", () => {
    expect(selectorSrc).not.toMatch(/<select/);
  });

  it("both language buttons use aria-pressed for their selected state", () => {
    expect((selectorSrc.match(/aria-pressed=\{/g) || []).length).toBe(2);
  });

  it("calls setLanguage('en')/setLanguage('es') directly, never a raw index or boolean", () => {
    expect(selectorSrc).toContain('setLanguage("en")');
    expect(selectorSrc).toContain('setLanguage("es")');
  });

  it("reads the country label through t(), never a hardcoded string", () => {
    expect(selectorSrc).toContain('t("localeSelector.countryValue")');
  });

  it("renders the US flag emoji next to the country chip", () => {
    expect(selectorSrc).toContain("🇺🇸");
  });

  it("no longer renders a currency chip or its translation key — USD stays internal only", () => {
    expect(selectorSrc).not.toContain("currencyValue");
    expect(selectorSrc).not.toContain("currencyLabel");
  });

  it("renders exactly one divider now that the currency chip/separator is gone", () => {
    expect((selectorSrc.match(/wsp-locale-divider/g) || []).length).toBe(1);
  });

  it("imports useWholesaleLocale from the Wholesale-scoped context, never the public useLanguage()", () => {
    expect(selectorSrc).toContain('from "../../i18n/WholesaleLocaleContext.jsx"');
    expect(selectorSrc).not.toMatch(/useLanguage/);
  });
});

describe("wholesaleTranslations.js: locale selector dictionary shows USA/English/Español, never United States/USD", () => {
  it("countryValue is the short, fixed 'USA' label in both languages — not the long country name", () => {
    expect(enDict).toMatch(/countryValue:\s*"USA"/);
    const esBlock = enDict.slice(enDict.indexOf("es: {"));
    expect(esBlock).toMatch(/countryValue:\s*"USA"/);
  });

  it("never contains the long-form 'United States' or 'Estados Unidos' as a display value anymore", () => {
    expect(enDict).not.toMatch(/countryValue:\s*"United States"/);
    expect(enDict).not.toMatch(/countryValue:\s*"Estados Unidos"/);
  });

  it("no longer defines currencyValue/currencyLabel keys — USD is not surfaced as its own chip", () => {
    expect(enDict).not.toContain("currencyValue");
    expect(enDict).not.toContain("currencyLabel");
  });
});

describe("wholesalePortal.css: locale selector is self-contained, works outside .wsp-scope", () => {
  it("defines its own tokens (--wls-*), never referencing --wsp-* custom properties", () => {
    const block = cssSrc.match(/\.wsp-locale-selector \{[\s\S]*?\n\}/)[0];
    expect(block).toContain("--wls-bg");
    expect(block).not.toMatch(/var\(--wsp-/);
  });

  it("paints an explicit opaque background, never transparent/inherit", () => {
    const block = cssSrc.match(/\.wsp-locale-selector \{[\s\S]*?\n\}/)[0];
    expect(block).toMatch(/background: var\(--wls-bg\)/);
  });

  it("the active language button has a visible focus state", () => {
    expect(cssSrc).toMatch(/\.wsp-locale-lang-btn:focus-visible \{[\s\S]*?outline:/);
  });

  it("respects prefers-reduced-motion for the toggle transition", () => {
    expect(cssSrc).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.wsp-locale-lang-btn \{\s*transition: none;/);
  });
});
