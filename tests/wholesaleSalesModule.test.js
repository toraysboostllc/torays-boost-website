import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const moduleSrc = read("src/components/wholesale/WholesaleSalesModule.jsx");
const cssSrc = read("src/styles/wholesalePortal.css");
const pageSrc = read("src/pages/WholesalePrices.jsx");
const wizardSrc = read("src/components/wholesale/WholesaleWizard.jsx");

describe("Adenda 8 — Sales module hidden ONLY on the narrowest phones while the price result screen is showing, never on any other screen or wider breakpoint", () => {
  it("WholesaleWizard reports its current screen via an onScreenChange callback, called from a useEffect keyed on the screen value", () => {
    expect(wizardSrc).toContain("onScreenChange }");
    const idx = wizardSrc.indexOf("useEffect(() => {\n    onScreenChange?.(screen);");
    expect(idx).toBeGreaterThan(-1);
    const block = wizardSrc.slice(idx, wizardSrc.indexOf("}, [", idx) + 40);
    expect(block).toContain("[screen, onScreenChange]");
  });

  it("WholesalePrices.jsx tracks the wizard's screen and passes onScreenChange down", () => {
    expect(pageSrc).toContain('const [wizardScreen, setWizardScreen] = useState("top");');
    expect(pageSrc).toContain("onScreenChange={setWizardScreen}");
  });

  it("the Sales module is wrapped in a conditional class applied ONLY when wizardScreen === 'result' — every other screen renders it with no wrapper class at all", () => {
    const idx = pageSrc.indexOf("<WholesaleSalesModule");
    const surrounding = pageSrc.slice(idx - 200, idx);
    expect(surrounding).toContain('wizardScreen === "result" ? "wsp-sales-hide-on-narrow-result" : undefined');
  });

  it("the CSS hide rule is scoped to <=379px (covers 320x568 and 375x667; 390x844 and up are untouched) and targets ONLY the conditional wrapper class, never .wsp-sales-module directly (which would hide it on every screen, not just the result screen)", () => {
    const idx = cssSrc.indexOf(".wsp-sales-hide-on-narrow-result");
    expect(idx).toBeGreaterThan(-1);
    const mediaStart = cssSrc.lastIndexOf("@media (max-width:", idx);
    expect(cssSrc.slice(mediaStart, mediaStart + 40)).toContain("@media (max-width: 379px)");
    const rule = cssSrc.slice(idx, cssSrc.indexOf("}", idx) + 1);
    expect(rule).toContain("display: none;");
    // Never a bare rule on .wsp-sales-module itself outside this scoped wrapper class.
    expect(cssSrc).not.toMatch(/@media \(max-width: 379px\)\s*\{\s*\.wsp-sales-module\s*\{/);
  });
});

describe("WholesaleSalesModule.jsx: visible but not functional, entirely DESK-driven", () => {
  it("renders nothing at all when salesModule.visible is false", () => {
    expect(moduleSrc).toMatch(/if \(!salesModule\?\.visible\) return null;/);
  });

  it("never performs real navigation — no <a href, no navigate(), no window.location assignment", () => {
    expect(moduleSrc).not.toMatch(/<a\s+href/);
    expect(moduleSrc).not.toMatch(/navigate\(/);
    expect(moduleSrc).not.toMatch(/window\.location/);
  });

  it("clicking only ever toggles a local inline message — never a fetch/POST (no purchase flow exists yet)", () => {
    expect(moduleSrc).not.toMatch(/fetch\(/);
    expect(moduleSrc).toMatch(/setShowMessage\(\(prev\) => !prev\)/);
  });

  it("the status badge text is driven by salesModule.status, not hardcoded to one value", () => {
    expect(moduleSrc).toMatch(/salesModule\.status === "active" \? t\("sales\.statusActive"\) : t\("sales\.statusBadge"\)/);
  });

  it("shows the exact required maintenance message text via t(), never inlined", () => {
    expect(moduleSrc).toContain('t("sales.maintenanceMessage")');
  });

  it("shows title and subtitle through t(), no hardcoded 'TORAYS BOOST SALES' string in the component", () => {
    expect(moduleSrc).not.toContain("TORAYS BOOST SALES");
    expect(moduleSrc).toContain('t("sales.title")');
    expect(moduleSrc).toContain('t("sales.subtitle")');
  });

  it("uses aria-expanded on the trigger so the toggle state is announced to assistive tech", () => {
    expect(moduleSrc).toContain("aria-expanded={showMessage}");
  });
});

describe("WholesaleSalesModule CSS: the status badge wraps to its own line at narrow widths, never squeezing the title/subtitle", () => {
  // Regression for a real bug caught in 320px verification: the badge
  // (flex-shrink:0, un-nowrapped) was eating most of the trigger row's
  // width at 320px, leaving only ~47px for the title/subtitle column and
  // forcing it into an unreadable near-vertical wrap. Fixed by giving the
  // trigger flex-wrap, the text column a 140px floor, and the badge
  // white-space:nowrap + margin-left:auto so it drops to its own row
  // instead of shrinking its siblings to nothing.
  function block(selector) {
    const start = cssSrc.indexOf(`${selector} {`);
    const end = cssSrc.indexOf("}", start);
    if (start === -1) throw new Error(`Could not find CSS block for ${selector}`);
    return cssSrc.slice(start, end);
  }

  it(".wsp-sales-module-trigger allows wrapping", () => {
    expect(block(".wsp-sales-module-trigger")).toMatch(/flex-wrap:\s*wrap;/);
  });

  it(".wsp-sales-module-text has a real minimum width, not 0 — the floor that forces the badge to wrap instead of the text collapsing", () => {
    const textBlock = block(".wsp-sales-module-text");
    expect(textBlock).toMatch(/min-width:\s*140px;/);
    expect(textBlock).not.toMatch(/min-width:\s*0px?;/);
  });

  it(".wsp-sales-module-badge never wraps its own text and pushes to the row's end", () => {
    const badgeBlock = block(".wsp-sales-module-badge");
    expect(badgeBlock).toMatch(/white-space:\s*nowrap;/);
    expect(badgeBlock).toMatch(/margin-left:\s*auto;/);
    expect(badgeBlock).toMatch(/flex-shrink:\s*0;/);
  });
});

describe("wholesaleTranslations.js: the module name is exactly 'Torays Boost Sales' in both languages — never a typo like 'Toraus'", () => {
  const dictSrc = read("src/i18n/wholesaleTranslations.js");

  it("never contains the misspelling 'Toraus' anywhere in the dictionary", () => {
    expect(dictSrc).not.toContain("Toraus");
  });

  it("sales.title is the exact string 'Torays Boost Sales' in both en and es", () => {
    const matches = dictSrc.match(/title:\s*"Torays Boost Sales"/g) || [];
    expect(matches.length).toBe(2);
  });

  it("the maintenance message also spells it correctly in both languages", () => {
    expect(dictSrc).toMatch(/"Torays Boost Sales is under maintenance/);
    expect(dictSrc).toMatch(/"Torays Boost Sales está en mantenimiento/);
  });
});
