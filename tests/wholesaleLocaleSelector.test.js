import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const selectorSrc = read("src/components/wholesale/WholesaleLocaleSelector.jsx");
const cssSrc = read("src/styles/wholesalePortal.css");

describe("WholesaleLocaleSelector.jsx: country/currency are informational, only language is a real toggle", () => {
  it("renders exactly 2 language buttons (English/Español), no dropdown", () => {
    expect((selectorSrc.match(/<button/g) || []).length).toBe(2);
    expect(selectorSrc).toMatch(/>\s*English\s*</);
    expect(selectorSrc).toMatch(/>\s*Español\s*</);
  });

  it("never renders a <select> — country/currency are plain chips, not a picker offering non-working options", () => {
    expect(selectorSrc).not.toMatch(/<select/);
  });

  it("both language buttons use aria-pressed for their selected state", () => {
    expect((selectorSrc.match(/aria-pressed=\{/g) || []).length).toBe(2);
  });

  it("calls setLanguage('en')/setLanguage('es') directly, never a raw index or boolean", () => {
    expect(selectorSrc).toContain('setLanguage("en")');
    expect(selectorSrc).toContain('setLanguage("es")');
  });

  it("reads every label through t(), never a hardcoded English/Spanish string for country/currency", () => {
    expect(selectorSrc).toContain('t("localeSelector.countryValue")');
    expect(selectorSrc).toContain('t("localeSelector.currencyValue")');
  });

  it("imports useWholesaleLocale from the Wholesale-scoped context, never the public useLanguage()", () => {
    expect(selectorSrc).toContain('from "../../i18n/WholesaleLocaleContext.jsx"');
    expect(selectorSrc).not.toMatch(/useLanguage/);
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
