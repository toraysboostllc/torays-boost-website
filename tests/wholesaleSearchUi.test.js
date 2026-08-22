import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const searchSrc = read("src/components/wholesale/WholesaleSearch.jsx");
const wizardSrc = read("src/components/wholesale/WholesaleWizard.jsx");
const cssSrc = read("src/styles/wholesalePortal.css");

/**
 * Live Search (Buscador Predictivo) UI — structural coverage for
 * WholesaleSearch.jsx and its wiring into WholesaleWizard.jsx. This
 * project has no jsdom/@testing-library dependency (see every other test
 * file's own note) — the matching/ranking/highlighting LOGIC itself is
 * fully unit-tested as pure functions in tests/wholesaleSearch.test.js
 * (including a real end-to-end round trip through
 * buildWholesaleWizardCatalog); this file confirms the component wires
 * that logic up correctly: ARIA combobox semantics, keyboard handling,
 * debounce, states, touch targets, and — critically — that it NEVER
 * fetches anything itself.
 */

describe("WholesaleSearch.jsx: zero network requests — 100% client-side over the already-fetched catalog", () => {
  it("never calls fetch — every result comes from data already in memory", () => {
    expect(searchSrc).not.toMatch(/fetch\(/);
  });

  it("builds its index from the `equipoList` prop via buildWholesaleSearchEntries — the exact same list WholesaleWizard.jsx already built from /api/wholesale-prices, never a separate/hardcoded list", () => {
    expect(searchSrc).toContain("buildWholesaleSearchEntries,");
    expect(searchSrc).toContain("searchWholesaleCatalog,");
    expect(searchSrc).toContain('} from "../../lib/wholesaleSearch.js";');
    expect(searchSrc).toContain("buildWholesaleSearchEntries(equipoList)");
  });
});

describe("WholesaleSearch.jsx: debounce (~200ms) and minimum 2-character query", () => {
  it("debounces via setTimeout using the shared SEARCH_DEBOUNCE_MS constant, not a hardcoded literal duplicated here", () => {
    expect(searchSrc).toMatch(/setTimeout\(\(\) => \{\s*\n\s*setDebouncedQuery\(query\);/);
    expect(searchSrc).toContain("}, SEARCH_DEBOUNCE_MS);");
  });

  it("clears the pending timeout on every re-run (real debounce, not a fire-every-keystroke timer pile-up)", () => {
    expect(searchSrc).toMatch(/return \(\) => clearTimeout\(timer\);/);
  });

  it("the dropdown only opens once the RAW query reaches SEARCH_MIN_QUERY_LENGTH — typing 1 character never opens it", () => {
    expect(searchSrc).toContain("const showDropdown = isOpen && query.trim().length >= SEARCH_MIN_QUERY_LENGTH;");
  });
});

describe("WholesaleSearch.jsx: WAI-ARIA combobox semantics", () => {
  it("the input is a real combobox: role, aria-expanded, aria-haspopup=listbox, aria-controls, aria-autocomplete, aria-activedescendant, and a real accessible label", () => {
    expect(searchSrc).toContain('role="combobox"');
    expect(searchSrc).toContain("aria-expanded={showDropdown}");
    expect(searchSrc).toContain('aria-haspopup="listbox"');
    expect(searchSrc).toContain('aria-controls="wsp-search-listbox"');
    expect(searchSrc).toContain('aria-autocomplete="list"');
    expect(searchSrc).toMatch(/aria-activedescendant=\{activeEntry \? optionDomId\(activeEntry\.id\) : undefined\}/);
    expect(searchSrc).toContain('aria-label={t("search.ariaLabel")}');
  });

  it("the dropdown is a real listbox with a matching id, and every result is a real option with aria-selected reflecting the active index", () => {
    expect(searchSrc).toContain('id="wsp-search-listbox"');
    expect(searchSrc).toContain('role="listbox"');
    expect(searchSrc).toContain('role="option"');
    expect(searchSrc).toContain("aria-selected={i === activeIndex}");
    expect(searchSrc).toContain("id={optionDomId(entry.id)}");
  });

  it("the clear button has its own accessible label — never an icon-only control with no name", () => {
    expect(searchSrc).toContain('aria-label={t("search.clearLabel")}');
  });
});

describe("WholesaleSearch.jsx: keyboard navigation — ArrowDown/ArrowUp/Enter/Escape/Tab/click-outside", () => {
  it("ArrowDown moves the active index forward (wrapping), opening the dropdown first if it was closed", () => {
    expect(searchSrc).toMatch(/if \(e\.key === "ArrowDown"\) \{/);
    expect(searchSrc).toMatch(/setActiveIndex\(\(i\) => \(i \+ 1\) % results\.length\)/);
  });

  it("ArrowUp moves the active index backward, wrapping to the last result", () => {
    expect(searchSrc).toMatch(/if \(e\.key === "ArrowUp"\) \{/);
    expect(searchSrc).toMatch(/setActiveIndex\(\(i\) => \(i <= 0 \? results\.length - 1 : i - 1\)\)/);
  });

  it("Enter selects the active result (or the first one if none is highlighted yet) and does nothing when the dropdown is closed/empty", () => {
    expect(searchSrc).toMatch(/if \(e\.key === "Enter"\) \{/);
    expect(searchSrc).toMatch(/if \(!showDropdown \|\| results\.length === 0\) return;/);
    expect(searchSrc).toMatch(/const entry = results\[activeIndex >= 0 \? activeIndex : 0\];/);
    expect(searchSrc).toContain("selectEntry(entry);");
  });

  it("Escape closes the dropdown and clears the active index, without clearing the typed query", () => {
    expect(searchSrc).toMatch(/if \(e\.key === "Escape"\) \{/);
    expect(searchSrc).toMatch(/setIsOpen\(false\);\s*\n\s*setActiveIndex\(-1\);/);
    expect(searchSrc).not.toMatch(/"Escape"[\s\S]{0,150}setQuery\(""\)/);
  });

  it("clicking outside the search container closes the dropdown — a real document-level listener scoped to a container ref, not a global always-on handler", () => {
    expect(searchSrc).toContain('document.addEventListener("mousedown", handlePointerDown);');
    expect(searchSrc).toMatch(/if \(containerRef\.current && !containerRef\.current\.contains\(e\.target\)\) \{/);
    expect(searchSrc).toMatch(/return \(\) => document\.removeEventListener\("mousedown", handlePointerDown\);/);
  });

  it("a result option is selected via onMouseDown with preventDefault (not onClick) — fires before blur/outside-click handling, so a pointer selection is never swallowed by the close-on-blur logic", () => {
    const idx = searchSrc.indexOf("onMouseDown={(e) => {");
    expect(idx).toBeGreaterThan(-1);
    const block = searchSrc.slice(idx, searchSrc.indexOf("}}", idx));
    expect(block).toContain("e.preventDefault();");
    expect(block).toContain("selectEntry(entry);");
    // The only onClick= in this whole file is the clear button's — never
    // the result option itself.
    expect((searchSrc.match(/onClick=\{/g) || []).length).toBe(1);
    expect(searchSrc).toContain("onClick={handleClear}");
  });

  it("no explicit Tab handler exists — native focus-out already moves focus away; the same outside/blur-driven close behavior applies", () => {
    expect(searchSrc).not.toMatch(/"Tab"/);
  });
});

describe("WholesaleSearch.jsx: clear button, loading (searching) and no-results states", () => {
  it("the clear button only renders once there's typed text, and resets query/debouncedQuery/open/active state and refocuses the input", () => {
    expect(searchSrc).toContain("{query.length > 0 && (");
    expect(searchSrc).toMatch(/function handleClear\(\) \{\s*\n\s*setQuery\(""\);\s*\n\s*setDebouncedQuery\(""\);\s*\n\s*setIsOpen\(false\);\s*\n\s*setActiveIndex\(-1\);\s*\n\s*inputRef\.current\?\.focus\(\);/);
  });

  it("shows a pending/searching indicator only while debouncing AND the dropdown would be open", () => {
    expect(searchSrc).toContain("{isPending && showDropdown && (");
  });

  it("shows a distinct 'no results' state only once the debounced query meets the minimum length, isn't still pending, and truly produced zero results", () => {
    expect(searchSrc).toContain(
      "const showNoResults = showDropdown && meetsMinLength && !isPending && results.length === 0;"
    );
    expect(searchSrc).toContain('{t("search.noResults")}');
    expect(searchSrc).toContain('role="status"');
  });
});

describe("WholesaleSearch.jsx: each result — dynamic photo, highlighted matched text, no hardcoded device/service names", () => {
  it("renders ServicePhoto with the REAL selected result's own image — never a hardcoded/equipo-level fallback", () => {
    expect(searchSrc).toContain('<ServicePhoto image={entry.service.image} alt="" size={36} className="wsp-search-option-photo" />');
  });

  it("the primary line is the service's own localized name (translateServiceName), the secondary line an Equipo/Modelo breadcrumb — both run through HighlightedText/highlightSegments against the debounced query", () => {
    expect(searchSrc).toContain("translateServiceName(entry.service, language)");
    expect(searchSrc).toMatch(/<HighlightedText text=\{serviceName\} query=\{debouncedQuery\} \/>/);
    expect(searchSrc).toMatch(/<HighlightedText text=\{breadcrumb\} query=\{debouncedQuery\} \/>/);
  });

  it("the model segment of the breadcrumb is omitted when it's the same as the equipo name (e.g. a direct_services card's single internal model) — same convention already used by WholesaleResultPanel's own breadcrumb", () => {
    expect(searchSrc).toContain("const showModel = modelName && modelName !== equipoName;");
  });

  it("no hardcoded device/service/slug literal in this file's actual CODE (comments are allowed to mention them in prose — e.g. explaining WHY the index is generic — only real code is checked)", () => {
    // Strip block (/** ... */) and line (// ...) comments before scanning,
    // the same "prose vs code" distinction already established for this
    // exact false-positive shape elsewhere in this suite (see
    // wholesaleServicePhoto.test.js).
    const codeOnly = searchSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const literal of ["microsoldering", "Microsoldering", "PS5", "iPad", "iPhone", "MacBook", "Xbox", "Switch", "HDMI"]) {
      expect(codeOnly).not.toContain(literal);
    }
  });
});

describe("wholesalePortal.css: touch targets, dropdown never clipped, mobile-safe input", () => {
  it("the search field and every result option meet the 44px minimum touch target", () => {
    const fieldIdx = cssSrc.indexOf(".wsp-search-field {");
    expect(cssSrc.slice(fieldIdx, cssSrc.indexOf("}", fieldIdx))).toMatch(/min-height:\s*44px/);
    const optionIdx = cssSrc.indexOf(".wsp-search-option {");
    expect(cssSrc.slice(optionIdx, cssSrc.indexOf("}", optionIdx))).toMatch(/min-height:\s*44px/);
  });

  it("the input uses a 16px floor font-size — below that, iOS Safari auto-zooms on focus and would break this whole panel's layout", () => {
    const idx = cssSrc.indexOf(".wsp-search-input {");
    expect(cssSrc.slice(idx, cssSrc.indexOf("}", idx))).toMatch(/font-size:\s*16px/);
  });

  it("the dropdown is position:absolute with a z-index well above every other value already used in this stylesheet, and lives outside .wsp-wizard's own overflow:hidden (see .wsp-wizard-outer) — never clipped, always rendered on top of the cards/list below it", () => {
    const idx = cssSrc.indexOf(".wsp-search-listbox {");
    const block = cssSrc.slice(idx, cssSrc.indexOf("}", idx));
    expect(block).toMatch(/position:\s*absolute/);
    expect(block).toMatch(/z-index:\s*40/);
    expect(block).toMatch(/left:\s*0/);
    expect(block).toMatch(/right:\s*0/);
  });

  it(".wsp-wizard-outer (not .wsp-wizard) is the search bar's actual parent — .wsp-wizard keeps its own unrelated overflow:hidden (needed to clip its glass background) completely untouched", () => {
    expect(wizardSrc).toContain('<div className="wsp-wizard-outer">');
    expect(wizardSrc).toContain("<WholesaleSearch equipoList={topEquipoList} onSelectResult={handleSelectSearchResult} />");
    const outerIdx = wizardSrc.indexOf('<div className="wsp-wizard-outer">');
    const searchIdx = wizardSrc.indexOf("<WholesaleSearch");
    const innerWizardIdx = wizardSrc.indexOf('<div className="wsp-wizard">');
    expect(outerIdx).toBeGreaterThan(-1);
    expect(searchIdx).toBeGreaterThan(outerIdx);
    expect(innerWizardIdx).toBeGreaterThan(searchIdx);
  });

  it("the highlight uses a soft blue tint matching this portal's own accent color, not the browser's default yellow <mark>", () => {
    const idx = cssSrc.indexOf(".wsp-search-highlight {");
    const block = cssSrc.slice(idx, cssSrc.indexOf("}", idx));
    expect(block).toContain("rgba(37, 99, 235,");
  });

  it("the pending spinner animation is disabled under prefers-reduced-motion: reduce, same pattern as every other one-shot/looping animation already in this file", () => {
    expect(cssSrc).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\n\s*\.wsp-search-spinner \{\s*\n\s*animation:\s*none;/);
  });
});

describe("WholesaleWizard.jsx: handleSelectSearchResult hydrates all 3 selections via the pure stackForSearchSelection helper — never a bespoke inline stack, never skipping straight to result", () => {
  it("imports stackForSearchSelection from the shared, independently-tested lib/wizardScreenStack.js", () => {
    expect(wizardSrc).toContain("stackForSearchSelection");
    expect(wizardSrc).toContain('from "../../lib/wizardScreenStack.js";');
  });

  it("sets selectedEquipo/selectedModel/selectedService from the search result, then rebuilds the screen stack via stackForSearchSelection(equipo) — landing on 'progress', the same reveal a manual click-through reaches, never a bypass straight to 'result'", () => {
    const fnStart = wizardSrc.indexOf("function handleSelectSearchResult({ equipo, model, service }) {");
    const fnEnd = wizardSrc.indexOf("\n  }", fnStart);
    expect(fnStart).toBeGreaterThan(-1);
    const fnText = wizardSrc.slice(fnStart, fnEnd);
    expect(fnText).toContain("setSelectedEquipo(equipo);");
    expect(fnText).toContain("setSelectedModel(model);");
    expect(fnText).toContain("setSelectedService(service);");
    expect(fnText).toContain("setScreenStack(stackForSearchSelection(equipo));");
  });
});
