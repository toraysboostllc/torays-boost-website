import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const moduleSrc = read("src/components/wholesale/WholesaleSalesModule.jsx");
const cssSrc = read("src/styles/wholesalePortal.css");

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
