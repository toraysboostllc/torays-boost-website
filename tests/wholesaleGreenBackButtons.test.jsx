// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { WholesaleWizard } from "../src/components/wholesale/WholesaleWizard.jsx";
import { WholesaleLocaleProvider } from "../src/i18n/WholesaleLocaleContext.jsx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(__dirname, "..", p), "utf8").replace(/\r\n?/g, "\n");
const cssSrc = read("src/styles/wholesalePortal.css");
const wizardSrc = read("src/components/wholesale/WholesaleWizard.jsx");
const panelSrc = read("src/components/wholesale/WholesaleResultPanel.jsx");
const pageSrc = read("src/pages/WholesalePrices.jsx");

/* Same shape /api/wholesale-prices really returns — mirrors the fixture in
   tests/wholesaleWizardCatalog.test.js. iPhone is used deliberately: its
   categories are NOT in PROMOTED_CATEGORY_SLUGS, so they stay as models
   under one equipo and selecting the equipo lands on a real model screen.
   (Video Consoles would not work here — ps5/xbox-series-x/switch are
   promoted to top-level equipo cards, each with a single model, which
   auto-advances straight past the screen this file needs to test.) */
function fixtureEquipmentTypes() {
  return [
    {
      id: "et-iphone",
      slug: "iphone",
      name: "iPhone",
      image: null,
      categories: [
        { id: "cat-a", slug: "iphone-7-11", name: "iPhone 7 to 11", notes: null, diagnostic_fee: null, diagnostic_description: null, image: null, services: [{ id: "svc-1", name: "No Power", pricing_type: "fixed", fixed_price: 80 }] },
        { id: "cat-b", slug: "iphone-12-14", name: "iPhone 12 to 14", notes: null, diagnostic_fee: null, diagnostic_description: null, image: null, services: [{ id: "svc-2", name: "Boot Loop", pricing_type: "fixed", fixed_price: 90 }] },
        { id: "cat-c", slug: "iphone-15-17", name: "iPhone 15 to 17", notes: null, diagnostic_fee: null, diagnostic_description: null, image: null, services: [{ id: "svc-3", name: "Screen", pricing_type: "fixed", fixed_price: 100 }] },
      ],
    },
  ];
}

function setLanguage(language) {
  window.localStorage.setItem("torays_wholesale_locale", JSON.stringify({ language, country: "US", currency: "USD" }));
}

function renderWizard() {
  return render(
    <WholesaleLocaleProvider>
      <WholesaleWizard equipmentTypes={fixtureEquipmentTypes()} warranty={null} />
    </WholesaleLocaleProvider>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  setLanguage("en");
});
afterEach(cleanup);

describe("Wizard Back: steps back exactly one screen and keeps every selection", () => {
  it("Equipo -> Modelo -> Falla, then Back lands on Modelo (one step), not on the main menu", () => {
    renderWizard();

    // Screen 1: the equipo grid.
    expect(screen.getByText("Select a Device to View Pricing")).toBeTruthy();

    fireEvent.click(screen.getByText("iPhone"));
    expect(screen.getByText("Choose your model")).toBeTruthy();

    fireEvent.click(screen.getByText("iPhone 7 to 11"));
    expect(screen.getByText("Choose the issue")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    // Exactly ONE step back: the model screen, NOT the equipo grid.
    expect(screen.getByText("Choose your model")).toBeTruthy();
    expect(screen.queryByText("Select a Device to View Pricing")).toBeNull();
  });

  it("the equipo selection survives Back — its own models are still the ones listed", () => {
    renderWizard();
    fireEvent.click(screen.getByText("iPhone"));
    fireEvent.click(screen.getByText("iPhone 7 to 11"));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    // Still the Video Consoles models, so selectedEquipo was never cleared.
    expect(screen.getByText("iPhone 7 to 11")).toBeTruthy();
    expect(screen.getByText("iPhone 12 to 14")).toBeTruthy();
    expect(screen.getByText("iPhone 15 to 17")).toBeTruthy();
  });

  it("a second Back reaches the main menu — one screen per press, never a jump", () => {
    renderWizard();
    fireEvent.click(screen.getByText("iPhone"));
    fireEvent.click(screen.getByText("iPhone 7 to 11"));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Select a Device to View Pricing")).toBeTruthy();
  });

  it("re-picking after Back still works — the flow is not left in a stale state", () => {
    renderWizard();
    fireEvent.click(screen.getByText("iPhone"));
    fireEvent.click(screen.getByText("iPhone 7 to 11"));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByText("iPhone 12 to 14"));
    expect(screen.getByText("Choose the issue")).toBeTruthy();
  });

  it("the label is 'Atrás' in Spanish", () => {
    setLanguage("es");
    renderWizard();
    fireEvent.click(screen.getByText("iPhone"));
    expect(screen.getByRole("button", { name: "Atrás" })).toBeTruthy();
  });

  it("navigation is React state only — no window.history involved anywhere in the wizard", () => {
    expect(wizardSrc).not.toContain("history.back");
    expect(wizardSrc).not.toContain("window.history");
    expect(wizardSrc).toContain("setScreenStack");
  });
});

describe("One green: the three buttons share a single token/class, never three greens", () => {
  it("all three call sites carry .wsp-btn-green — wizard Back, portal Log out, result Back", () => {
    expect(wizardSrc.match(/wsp-btn wsp-btn-green wsp-wizard-back/g)).toHaveLength(2); // model + fault screens
    expect(pageSrc).toContain('className="wsp-btn wsp-btn-green"');
    expect(panelSrc).toContain('className="wsp-btn wsp-btn-green wsp-result-consult-another"');
  });

  it("none of the three still carries the old ghost variant", () => {
    expect(wizardSrc).not.toContain("wsp-btn-ghost");
    expect(panelSrc).not.toContain("wsp-btn-ghost");
    // The page still has other ghost buttons; what matters is that the
    // Log out one specifically moved.
    expect(pageSrc).not.toMatch(/wholesaleHoverProps\(handleLogout\)\} className="wsp-btn wsp-btn-ghost"/);
  });

  it("the green is defined ONCE, as tokens, and the class is declared once", () => {
    expect(cssSrc.match(/--wsp-green:/g)).toHaveLength(1);
    expect(cssSrc.match(/--wsp-green-hover:/g)).toHaveLength(1);
    expect(cssSrc.match(/--wsp-green-active:/g)).toHaveLength(1);
    expect(cssSrc.match(/--wsp-green-focus:/g)).toHaveLength(1);
    expect(cssSrc.match(/^\.wsp-btn-green \{/gm)).toHaveLength(1);
  });

  it("every green state reads from a token — no green hex survives outside the token declarations", () => {
    const idx = cssSrc.indexOf(".wsp-btn-green {");
    const classBlock = cssSrc.slice(idx, cssSrc.indexOf(".wsp-btn-green:focus-visible {") + 200);
    expect(classBlock).toContain("background: var(--wsp-green)");
    expect(classBlock).toContain("var(--wsp-green-hover)");
    expect(classBlock).toContain("var(--wsp-green-active)");
    expect(classBlock).toContain("var(--wsp-green-focus)");
    expect(classBlock).not.toMatch(/#(?!ffffff)[0-9a-fA-F]{6}/);
  });

  it("every green hex appears exactly once, and only as a token declaration", () => {
    /* This is the real guarantee behind "one shared token". If any of these
       ever appears twice, a second green has been hardcoded somewhere and
       the three buttons can drift apart again. */
    for (const [hex, token] of [["#22c55e", "--wsp-green"], ["#4ade80", "--wsp-green-hover"], ["#16a34a", "--wsp-green-active"], ["#86efac", "--wsp-green-focus"]]) {
      expect(cssSrc.split(hex).length - 1, `${hex} must appear exactly once`).toBe(1);
      expect(cssSrc).toContain(`${token}: ${hex};`);
    }
    // Retired greens from the earlier white-text ramp.
    expect(cssSrc).not.toContain("#166534");
    expect(cssSrc).not.toContain("#15803d");
  });

  it("the ink is the portal's existing navy token — never white, never a new near-black hex", () => {
    const idx = cssSrc.indexOf(".wsp-btn-green {");
    const block = cssSrc.slice(idx, cssSrc.indexOf("}", idx));
    expect(block).toContain("color: var(--wsp-navy);");
    expect(block).not.toContain("color: #ffffff");
    expect(block).not.toMatch(/color:\s*#/);
    // The token itself must already exist, declared once, not introduced here.
    expect(cssSrc.match(/--wsp-navy:/g)).toHaveLength(1);
  });

  it("icons inherit the label colour instead of declaring their own", () => {
    // lucide-react strokes with currentColor; nothing in these three call
    // sites overrides an icon colour, so label and icon are the same navy
    // by construction.
    expect(wizardSrc).not.toMatch(/<ArrowLeft[^>]*color=/);
    expect(pageSrc).not.toMatch(/<LogOut[^>]*color=/);
    expect(panelSrc).not.toMatch(/<ArrowLeft[^>]*color=/);
  });

  it("WCAG AA: navy on the green passes 4.5:1 in normal, hover AND pressed — recomputed from the tokens themselves", () => {
    /* Computed, not asserted as a remembered number: read the four token
       values straight out of the stylesheet and run the real WCAG 2.1
       relative-luminance formula. Change a token to something that fails and
       this test fails, which is the whole point — the earlier white-on-green
       ramp shipped at 2.28:1 precisely because nothing checked. */
    const token = (name) => cssSrc.slice(cssSrc.indexOf(name + ":")).match(/#[0-9a-fA-F]{6}/)[0];
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const lum = (hex) => 0.2126 * lin(parseInt(hex.slice(1, 3), 16)) + 0.7152 * lin(parseInt(hex.slice(3, 5), 16)) + 0.0722 * lin(parseInt(hex.slice(5, 7), 16));
    const ratio = (a, b) => { const l1 = Math.max(lum(a), lum(b)); const l2 = Math.min(lum(a), lum(b)); return (l1 + 0.05) / (l2 + 0.05); };

    const ink = token("--wsp-navy");
    for (const state of ["--wsp-green", "--wsp-green-hover", "--wsp-green-active"]) {
      const r = ratio(ink, token(state));
      expect(r, `${state} vs --wsp-navy is ${r.toFixed(2)}:1, below the 4.5:1 AA floor`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("white on this green would NOT pass — documenting why the ink had to change", () => {
    const token = (name) => cssSrc.slice(cssSrc.indexOf(name + ":")).match(/#[0-9a-fA-F]{6}/)[0];
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const lum = (hex) => 0.2126 * lin(parseInt(hex.slice(1, 3), 16)) + 0.7152 * lin(parseInt(hex.slice(3, 5), 16)) + 0.0722 * lin(parseInt(hex.slice(5, 7), 16));
    const white = (1 + 0.05) / (lum(token("--wsp-green")) + 0.05);
    expect(white).toBeLessThan(4.5);
  });

  it("carries all four states: normal, hover, pressed and focus-visible", () => {
    expect(cssSrc).toMatch(/^\.wsp-btn-green \{/m);
    expect(cssSrc).toContain(".wsp-btn-green:not(:disabled):hover {");
    expect(cssSrc).toContain(".wsp-btn-green:not(:disabled):active {");
    expect(cssSrc).toContain(".wsp-btn-green:focus-visible {");
  });
});

describe("Mobile and desktop are untouched: the shared class is colour-only", () => {
  it(".wsp-btn-green declares no dimension whatsoever, so no button can change size", () => {
    const idx = cssSrc.indexOf(".wsp-btn-green {");
    const block = cssSrc.slice(idx, cssSrc.indexOf("}", idx));
    for (const prop of ["width", "height", "min-height", "min-width", "padding", "margin", "display", "font-size", "align-self"]) {
      expect(block, `.wsp-btn-green must not declare ${prop}`).not.toMatch(new RegExp(`(^|[;\s])${prop}:`));
    }
  });

  it("the border stays 1px like .wsp-btn's, only transparent — identical box model to the ghost variant it replaced", () => {
    const idx = cssSrc.indexOf(".wsp-btn-green {");
    const block = cssSrc.slice(idx, cssSrc.indexOf("}", idx));
    expect(block).toContain("border-color: transparent;");
    expect(block).not.toMatch(/border:\s*none/);
    expect(block).not.toMatch(/border-width:/);
  });

  it("each button keeps its own dimensions: the result button's 56px/300px cap and its 359px phone rule all survive", () => {
    const idx = cssSrc.indexOf(".wsp-result-consult-another {");
    const block = cssSrc.slice(idx, cssSrc.indexOf("}", idx));
    expect(block).toContain("min-height: 56px");
    expect(block).toMatch(/width:\s*min\(300px,\s*100%\)/);
    expect(cssSrc).toMatch(/@media \(max-width: 359px\) \{\s*\n\s*\.wsp-result-consult-another \{\s*\n\s*min-height: 48px;/);
  });

  it("the wizard Back keeps its own alignment class and no responsive-visibility modifier", () => {
    expect(cssSrc).toMatch(/\.wsp-wizard-back \{\s*\n\s*align-self: flex-start;/);
    expect(wizardSrc).not.toMatch(/wsp-wizard-back[^"]*\bhidden\b/);
  });
});
