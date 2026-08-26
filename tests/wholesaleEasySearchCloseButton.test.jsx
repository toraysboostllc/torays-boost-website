// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/* The panel fetches on every debounced keystroke. Stubbed at the lib
   boundary — this file is about pointer behaviour and the close control,
   not the network, and the real wrapper is already covered by
   tests/wholesaleEasySearch.test.js. */
vi.mock("../src/lib/wholesaleEasySearch.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, fetchEasySearchResults: vi.fn(async () => ({ ok: true, results: [] })) };
});

const { EasySearchPanel } = await import("../src/components/wholesale/EasySearchPanel.jsx");
const { WholesaleLocaleProvider } = await import("../src/i18n/WholesaleLocaleContext.jsx");

const __dirname = dirname(fileURLToPath(import.meta.url));
const cssSrc = readFileSync(join(__dirname, "..", "src/styles/wholesalePortal.css"), "utf8").replace(/\r\n?/g, "\n");
const panelSrc = readFileSync(join(__dirname, "..", "src/components/wholesale/EasySearchPanel.jsx"), "utf8").replace(/\r\n?/g, "\n");

function setLanguage(language) {
  window.localStorage.setItem("torays_wholesale_locale", JSON.stringify({ language, country: "US", currency: "USD" }));
}

function renderPanel() {
  return render(
    <WholesaleLocaleProvider>
      <EasySearchPanel onSelectCatalogModel={() => {}} />
    </WholesaleLocaleProvider>
  );
}

function openPanel() {
  fireEvent.click(screen.getByRole("button", { name: /easy search/i }));
  return screen.getByRole("dialog");
}

beforeEach(() => {
  window.localStorage.clear();
  setLanguage("en");
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Easy Search modal: only the red X closes it", () => {
  it("opens from the trigger and renders a dialog", () => {
    renderPanel();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(openPanel()).toBeTruthy();
  });

  it("a click on the BACKDROP leaves the modal open", () => {
    renderPanel();
    const dialog = openPanel();
    const backdrop = dialog.parentElement;
    expect(backdrop.className).toContain("wsp-easy-search-backdrop");

    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);

    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("a click INSIDE the modal leaves it open", () => {
    renderPanel();
    const dialog = openPanel();

    fireEvent.mouseDown(dialog);
    fireEvent.click(dialog);
    fireEvent.click(screen.getByRole("combobox"));

    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("a click on the red X button closes it", () => {
    renderPanel();
    openPanel();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Easy Search modal: the close button's accessible name follows the language", () => {
  it("is 'Close' in English", () => {
    setLanguage("en");
    renderPanel();
    openPanel();
    const closeBtn = screen.getByRole("button", { name: "Close" });
    expect(closeBtn.getAttribute("aria-label")).toBe("Close");
    expect(closeBtn.className).toContain("wsp-easy-search-close");
  });

  it("is 'Cerrar' in Spanish", () => {
    setLanguage("es");
    renderPanel();
    openPanel();
    expect(screen.getByRole("button", { name: "Cerrar" }).getAttribute("aria-label")).toBe("Cerrar");
  });

  it("the icon itself is hidden from assistive tech, so the label is the only name", () => {
    renderPanel();
    openPanel();
    const svg = screen.getByRole("button", { name: "Close" }).querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("Easy Search modal: typed content survives everything except the X", () => {
  it("a backdrop press mid-scroll keeps both the modal AND the typed query", () => {
    renderPanel();
    const dialog = openPanel();
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "A3357" } });
    expect(input.value).toBe("A3357");

    const backdrop = dialog.parentElement;
    /* The exact sequence a thumb produces while scrolling a bottom sheet on
       a phone: touch lands on the backdrop, the browser synthesizes
       mousedown/mouseup/click from it. The old document-level "mousedown"
       listener closed on the FIRST of these and wiped the query. */
    fireEvent.touchStart(backdrop);
    fireEvent.mouseDown(backdrop);
    fireEvent.touchEnd(backdrop);
    fireEvent.mouseUp(backdrop);
    fireEvent.click(backdrop);

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("combobox").value).toBe("A3357");
  });

  it("closing with the X does clear the query, so a reopen starts fresh", () => {
    renderPanel();
    openPanel();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "A3357" } });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    openPanel();
    expect(screen.getByRole("combobox").value).toBe("");
  });
});

describe("Easy Search modal: no outside-click listener exists at all", () => {
  it("the component registers no document-level pointer listener", () => {
    /* Stronger than asserting behaviour alone: proves the listener was
       removed rather than merely neutralized, so it cannot be reintroduced
       silently. */
    expect(panelSrc).not.toContain('addEventListener("mousedown"');
    expect(panelSrc).not.toContain('addEventListener("pointerdown"');
    expect(panelSrc).not.toContain('addEventListener("click"');
    // The identifier survives only inside the explanatory comment above the
    // effect; what must be gone is every CODE use of it.
    expect(panelSrc).not.toContain("const panelRef");
    expect(panelSrc).not.toContain("ref={panelRef}");
    expect(panelSrc).not.toContain("panelRef.current");
  });

  it("Escape is deliberately kept — a keyboard affordance, not an accidental-dismissal risk", () => {
    renderPanel();
    openPanel();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Easy Search close button: the red square, from tokens only", () => {
  const rule = cssSrc.slice(cssSrc.indexOf(".wsp-easy-search-close {"), cssSrc.indexOf(".wsp-easy-search-field {"));

  it("is a 40x40 square tap target, not the old 32px circle", () => {
    expect(rule).toMatch(/width: 40px;/);
    expect(rule).toMatch(/height: 40px;/);
    expect(rule).toMatch(/border-radius: 8px;/);
    expect(rule).not.toMatch(/border-radius: 999px;/);
  });

  it("is filled with the existing --wsp-red token and a white glyph — no new hex values", () => {
    expect(rule).toContain("background: var(--wsp-red);");
    expect(rule).toContain("color: #ffffff;");
    expect(rule.match(/#(?!ffffff)[0-9a-fA-F]{6}/g)).toBeNull();
  });

  it("carries hover, pressed and focus-visible states", () => {
    expect(rule).toMatch(/\.wsp-easy-search-close:hover \{[^}]*filter: brightness/);
    expect(rule).toMatch(/\.wsp-easy-search-close:active \{[^}]*filter: brightness/);
    expect(rule).toMatch(/\.wsp-easy-search-close:active \{[^}]*transform: translateY/);
    expect(rule).toMatch(/\.wsp-easy-search-close:focus-visible \{[^}]*box-shadow: 0 0 0 2px var\(--wsp-card-bg\), 0 0 0 4px var\(--wsp-red\)/);
  });

  it("respects prefers-reduced-motion", () => {
    expect(rule).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("renders a thicker-than-default X so the glyph carries the 40px button", () => {
    expect(panelSrc).toContain('<X size={22} strokeWidth={3} aria-hidden="true" />');
  });
});
