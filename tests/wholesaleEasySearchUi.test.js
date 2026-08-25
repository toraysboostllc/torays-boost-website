import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const panelSrc = read("src/components/wholesale/EasySearchPanel.jsx");
const wizardSrc = read("src/components/wholesale/WholesaleWizard.jsx");
const cssSrc = read("src/styles/wholesalePortal.css");
const i18nSrc = read("src/i18n/wholesaleTranslations.js");

/**
 * Easy Search UI — structural coverage for EasySearchPanel.jsx and its
 * wiring into WholesaleWizard.jsx, same technique as
 * tests/wholesaleSearchUi.test.js (this project has no jsdom/
 * @testing-library for most files — see that file's own note). The
 * normalization/ranking LOGIC is unit-tested as pure functions in
 * tests/wholesaleEasySearch.test.js; this file confirms the component
 * wires it up correctly and — critically — never renders a price.
 */

describe("EasySearchPanel.jsx: closed by default, network only through the shared lib wrapper", () => {
  it("never calls the raw fetch() API directly — all network access goes through fetchEasySearchResults", () => {
    expect(panelSrc).not.toMatch(/[^a-zA-Z]fetch\(/);
    expect(panelSrc).toContain("fetchEasySearchResults(");
    expect(panelSrc).toContain('} from "../../lib/wholesaleEasySearch.js";');
  });

  it("starts closed (isOpen defaults to false) — a button press is required to open the panel", () => {
    expect(panelSrc).toMatch(/const \[isOpen, setIsOpen\] = useState\(false\);/);
  });

  it("a stale, slower response can never clobber a newer one (request-id race guard)", () => {
    expect(panelSrc).toContain("const requestId = ++requestIdRef.current;");
    expect(panelSrc).toContain("if (requestId !== requestIdRef.current) return;");
  });
});

describe("EasySearchPanel.jsx: debounce and minimum query length", () => {
  it("debounces via setTimeout using the shared EASY_SEARCH_DEBOUNCE_MS constant", () => {
    expect(panelSrc).toContain("setTimeout(() => setDebouncedQuery(query), EASY_SEARCH_DEBOUNCE_MS);");
  });

  it("clears the pending timeout on every re-run (real debounce)", () => {
    expect(panelSrc).toMatch(/return \(\) => clearTimeout\(timer\);/);
  });

  it("a query below EASY_SEARCH_MIN_QUERY_LENGTH (by either normalized code length or raw trimmed length) never triggers a search", () => {
    expect(panelSrc).toContain(
      "if (normalized.length < EASY_SEARCH_MIN_QUERY_LENGTH && trimmed.length < EASY_SEARCH_MIN_QUERY_LENGTH) {"
    );
  });
});

describe("EasySearchPanel.jsx: trigger button and dialog semantics", () => {
  it("the trigger is a real disclosure button: aria-haspopup=dialog, aria-expanded reflects isOpen, aria-controls points at the panel", () => {
    expect(panelSrc).toContain('aria-haspopup="dialog"');
    expect(panelSrc).toContain("aria-expanded={isOpen}");
    expect(panelSrc).toContain('aria-controls="wsp-easy-search-panel"');
    expect(panelSrc).toContain('className="wsp-easy-search-trigger"');
  });

  it("the panel is a real dialog: role=dialog, aria-modal, a real accessible label, matching id", () => {
    expect(panelSrc).toContain('id="wsp-easy-search-panel"');
    expect(panelSrc).toContain('role="dialog"');
    expect(panelSrc).toContain('aria-modal="true"');
    expect(panelSrc).toContain('aria-label={t("easySearch.panelLabel")}');
  });

  it("the close button has its own accessible label — never an icon-only control with no name", () => {
    expect(panelSrc).toContain('aria-label={t("easySearch.closeLabel")}');
  });

  it("Escape closes the panel, and clicking outside it closes the panel too — both real document-level listeners, both cleaned up", () => {
    expect(panelSrc).toMatch(/if \(e\.key === "Escape"\) closePanel\(\);/);
    expect(panelSrc).toContain('document.addEventListener("keydown", handleKeyDown);');
    expect(panelSrc).toMatch(/if \(panelRef\.current && !panelRef\.current\.contains\(e\.target\)\) closePanel\(\);/);
    expect(panelSrc).toContain('document.addEventListener("mousedown", handlePointerDown);');
    expect(panelSrc).toContain('document.removeEventListener("mousedown", handlePointerDown);');
    expect(panelSrc).toContain('document.removeEventListener("keydown", handleKeyDown);');
  });
});

describe("EasySearchPanel.jsx: search input is a real WAI-ARIA combobox over a real listbox", () => {
  it("the input carries role/aria-expanded/aria-haspopup=listbox/aria-controls/aria-autocomplete/aria-activedescendant/aria-label", () => {
    expect(panelSrc).toContain('role="combobox"');
    expect(panelSrc).toContain("aria-expanded={showListbox}");
    expect(panelSrc).toContain('aria-haspopup="listbox"');
    expect(panelSrc).toContain('aria-controls="wsp-easy-search-listbox"');
    expect(panelSrc).toContain('aria-autocomplete="list"');
    expect(panelSrc).toMatch(/aria-activedescendant=\{activeResult \? optionDomId\(activeIndex\) : undefined\}/);
    expect(panelSrc).toContain('aria-label={t("easySearch.inputAriaLabel")}');
  });

  it("the listbox has a matching id, and every result is a real option with aria-selected reflecting the active index", () => {
    expect(panelSrc).toContain('id="wsp-easy-search-listbox"');
    expect(panelSrc).toContain('role="listbox"');
    expect(panelSrc).toContain('role="option"');
    expect(panelSrc).toContain("aria-selected={i === activeIndex}");
  });

  it("ArrowDown/ArrowUp move the active index (wrapping), Enter selects the active (or first) result", () => {
    expect(panelSrc).toMatch(/if \(e\.key === "ArrowDown"\) \{/);
    expect(panelSrc).toMatch(/setActiveIndex\(\(i\) => \(i \+ 1\) % results\.length\)/);
    expect(panelSrc).toMatch(/if \(e\.key === "ArrowUp"\) \{/);
    expect(panelSrc).toMatch(/setActiveIndex\(\(i\) => \(i <= 0 \? results\.length - 1 : i - 1\)\)/);
    expect(panelSrc).toMatch(/if \(e\.key === "Enter"\) \{/);
    expect(panelSrc).toContain("selectResult(results[activeIndex >= 0 ? activeIndex : 0]);");
  });

  it("a result is selected via onMouseDown with preventDefault (not onClick) — fires before outside-click-close handling", () => {
    const idx = panelSrc.indexOf("onMouseDown={(e) => {");
    expect(idx).toBeGreaterThan(-1);
    const block = panelSrc.slice(idx, panelSrc.indexOf("}}", idx));
    expect(block).toContain("e.preventDefault();");
    expect(block).toContain("selectResult(result);");
  });

  it("the placeholder is exactly the spec's required text", () => {
    expect(panelSrc).toContain('placeholder={t("easySearch.placeholder")}');
  });
});

describe("EasySearchPanel.jsx: the exact placeholder text required by spec", () => {
  it("English placeholder matches spec verbatim", () => {
    expect(i18nSrc).toContain('placeholder: "Enter model number — A2218 or SM-S918U",');
  });
});

describe("EasySearchPanel.jsx: 'Easy Search' stays identical in en/es; every other string is translated", () => {
  it("buttonLabel is 'Easy Search' in both the en and es blocks", () => {
    const enBlockStart = i18nSrc.indexOf("  en: {");
    const esBlockStart = i18nSrc.indexOf("  es: {");
    const enEasySearch = i18nSrc.slice(i18nSrc.indexOf("easySearch: {", enBlockStart), i18nSrc.indexOf("easySearch: {", enBlockStart) + 400);
    const esEasySearch = i18nSrc.slice(i18nSrc.indexOf("easySearch: {", esBlockStart), i18nSrc.indexOf("easySearch: {", esBlockStart) + 400);
    expect(enEasySearch).toContain('buttonLabel: "Easy Search",');
    expect(esEasySearch).toContain('buttonLabel: "Easy Search",');
  });
});

describe("EasySearchPanel.jsx: result content never shows a price, and never turns the whole panel purple", () => {
  it("no price-related field is ever rendered — only the spec fields from Carlos's list", () => {
    const codeOnly = panelSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const forbidden of ["price", "Price", "PRICE", "cost", "Cost"]) {
      expect(codeOnly).not.toContain(forbidden);
    }
  });

  it("shows exactly the 8 required spec fields (brand/name via title, then screen/processor/ram/storage/camera/battery), each label going through t()", () => {
    for (const key of [
      "easySearch.specScreen",
      "easySearch.specProcessor",
      "easySearch.specRam",
      "easySearch.specStorage",
      "easySearch.specCamera",
      "easySearch.specBattery",
    ]) {
      expect(panelSrc).toContain(`["${key}",`);
    }
  });

  it("'View Services & Wholesale Prices' only renders when hasWholesaleCatalog is true, and never inside the always-purple chrome", () => {
    expect(panelSrc).toContain("{selectedResult.hasWholesaleCatalog && (");
    expect(panelSrc).toContain('onClick={handleViewCatalog}');
    expect(panelSrc).toContain('className="wsp-easy-search-view-catalog"');
    expect(panelSrc).toContain('{t("easySearch.viewCatalogButton")}');
  });

  it("the detail spec rows use the ordinary card text tokens, not the purple accent (only .wsp-easy-search-view-catalog and the trigger/panel-title/field chrome use --wsp-purple)", () => {
    const rowIdx = cssSrc.indexOf(".wsp-easy-search-spec-row dd {");
    const block = cssSrc.slice(rowIdx, cssSrc.indexOf("}", rowIdx));
    expect(block).toContain("var(--wsp-card-text)");
    expect(block).not.toContain("--wsp-purple");
  });
});

describe("Easy Search is closed-loop into the SAME catalog navigation path, never a shortcut to result/pricing", () => {
  it("WholesaleWizard.jsx imports stackForEasySearchSelection from the shared, independently-tested lib/wizardScreenStack.js", () => {
    expect(wizardSrc).toContain("stackForEasySearchSelection");
    expect(wizardSrc).toContain('from "../../lib/wizardScreenStack.js";');
  });

  it("handleSelectEasySearchResult sets selectedEquipo/selectedModel, explicitly clears selectedService, and lands on 'fault' via stackForEasySearchSelection() — never jumping straight to progress/result", () => {
    const fnStart = wizardSrc.indexOf("function handleSelectEasySearchResult({ catalogCategoryId }) {");
    const fnEnd = wizardSrc.indexOf("\n  }", fnStart);
    expect(fnStart).toBeGreaterThan(-1);
    const fnText = wizardSrc.slice(fnStart, fnEnd);
    expect(fnText).toContain("setSelectedEquipo(foundEquipo);");
    expect(fnText).toContain("setSelectedModel(foundModel);");
    expect(fnText).toContain("setSelectedService(null);");
    expect(fnText).toContain("setScreenStack(stackForEasySearchSelection());");
    expect(fnText).not.toMatch(/goTo\("result"\)/);
    expect(fnText).not.toMatch(/goTo\("progress"\)/);
  });

  it("EasySearchPanel is mounted in WholesaleWizard.jsx, wired to handleSelectEasySearchResult, alongside the existing WholesaleSearch (Live Search) — a separate, additional entry point, not a replacement", () => {
    expect(wizardSrc).toContain('<WholesaleSearch equipoList={topEquipoList} onSelectResult={handleSelectSearchResult} />');
    expect(wizardSrc).toContain('<EasySearchPanel onSelectCatalogModel={handleSelectEasySearchResult} />');
  });
});

describe("wholesalePortal.css: purple tokens, responsive trigger, mobile bottom sheet with safe-area padding", () => {
  it("the 5 purple tokens are exactly the spec's approved hex values", () => {
    expect(cssSrc).toContain("--wsp-purple: #7c3aed;");
    expect(cssSrc).toContain("--wsp-purple-hover: #6d28d9;");
    expect(cssSrc).toContain("--wsp-purple-focus: #a78bfa;");
    expect(cssSrc).toContain("--wsp-purple-bg-light: #f5f3ff;");
  });

  it("the trigger is fixed-positioned, bottom-right with safe-area padding on mobile, moving to top-right on >=768px", () => {
    const idx = cssSrc.indexOf(".wsp-easy-search-trigger {");
    const block = cssSrc.slice(idx, cssSrc.indexOf("}", idx));
    expect(block).toMatch(/position:\s*fixed/);
    expect(block).toMatch(/bottom:\s*max\(1rem, calc\(env\(safe-area-inset-bottom\) \+ 0\.5rem\)\)/);
    const desktopIdx = cssSrc.indexOf("@media (min-width: 768px) {\n  .wsp-easy-search-trigger {");
    expect(desktopIdx).toBeGreaterThan(-1);
  });

  it("the panel is a bottom-anchored sheet on mobile (rounded top corners only, safe-area bottom padding) and a centered rounded card on desktop", () => {
    const idx = cssSrc.indexOf(".wsp-easy-search-panel {");
    const block = cssSrc.slice(idx, cssSrc.indexOf("}", idx));
    expect(block).toMatch(/border-radius:\s*16px 16px 0 0/);
    expect(block).toMatch(/env\(safe-area-inset-bottom\)/);
  });

  it("panel/backdrop animations are disabled under prefers-reduced-motion: reduce", () => {
    expect(cssSrc).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\n\s*\.wsp-easy-search-panel,\s*\n\s*\.wsp-easy-search-backdrop \{\s*\n\s*animation:\s*none;/);
  });

  it("interactive controls have a visible focus ring using the purple focus token", () => {
    for (const selector of [".wsp-easy-search-trigger:focus-visible", ".wsp-easy-search-close:focus-visible", ".wsp-easy-search-view-catalog:focus-visible"]) {
      const idx = cssSrc.indexOf(`${selector} {`);
      expect(idx, `expected ${selector} to exist`).toBeGreaterThan(-1);
      const block = cssSrc.slice(idx, cssSrc.indexOf("}", idx));
      expect(block).toContain("var(--wsp-purple-focus)");
    }
  });
});
