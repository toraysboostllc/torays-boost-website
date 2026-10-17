// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App.jsx";
import { LanguageProvider } from "../src/i18n/LanguageContext.jsx";
import { translations } from "../src/i18n/translations.js";
import { buildInitialAnswers } from "../src/hooks/useRepairRequest.js";
import {
  GAMING_SERVICE_BLOCKS,
  QUOTE_SERVICE_PRESETS,
  getQuoteServicePreset,
  quotePathFor,
} from "../src/config/gamingServices.config.js";

/**
 * Home's "Consoles & Controllers" section: controller repair, console repair,
 * Deep Cleaning and mail-in. Guards the approved rules — no prices, both
 * languages complete, CTAs go to the existing /quote wizard with the service
 * preselected, and /quote without a service keeps working exactly as before.
 */

beforeAll(() => {
  globalThis.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
  window.matchMedia ??= () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  window.scrollTo ??= () => {};
});

afterEach(cleanup);

function renderAt(path) {
  window.localStorage.setItem("torays_lang", "en");
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </MemoryRouter>
  );
}

function keyShape(node) {
  if (typeof node !== "object" || node === null) return typeof node;
  return Object.fromEntries(Object.keys(node).sort().map((k) => [k, keyShape(node[k])]));
}

function allStrings(node) {
  if (typeof node === "string") return [node];
  return Object.values(node).flatMap(allStrings);
}

describe("gamingServices copy", () => {
  it("English and Spanish have exactly the same keys", () => {
    expect(keyShape(translations.es.gamingServices)).toEqual(keyShape(translations.en.gamingServices));
  });

  it("every block item has a title and description in both languages", () => {
    for (const lang of ["en", "es"]) {
      for (const block of GAMING_SERVICE_BLOCKS) {
        for (const item of block.items) {
          const entry = translations[lang].gamingServices[block.id].items[item];
          expect(entry?.title, `${lang}.${block.id}.${item}`).toBeTruthy();
          expect(entry?.description, `${lang}.${block.id}.${item}`).toBeTruthy();
        }
      }
    }
  });

  it("never shows a price", () => {
    for (const lang of ["en", "es"]) {
      allStrings(translations[lang].gamingServices).forEach((s) => {
        expect(s).not.toMatch(/\$\s?\d|\d\s?(USD|dólares|dollars)/i);
      });
    }
    expect(translations.en.gamingServices.estimateBadge).toBe("Estimate after diagnosis");
    expect(translations.es.gamingServices.estimateBadge).toBe("Presupuesto tras diagnóstico");
  });

  it("thermal paste and liquid metal are conditional, never presented as always required", () => {
    expect(translations.es.gamingServices.maintenance.items.thermalPaste.title).toMatch(/cuando corresponda/);
    expect(translations.es.gamingServices.maintenance.items.liquidMetal.description).toMatch(/según diagnóstico/);
    expect(translations.en.gamingServices.maintenance.items.thermalPaste.title).toMatch(/when needed/);
    expect(translations.en.gamingServices.maintenance.items.liquidMetal.description).toMatch(/based on diagnosis/);
  });

  it("mail-in copy publishes no postal address and promises no free shipping", () => {
    for (const lang of ["en", "es"]) {
      const text = allStrings(translations[lang].gamingServices.mailIn).join(" ");
      expect(text).not.toMatch(/\d{3,}\s+\w+\s+(Ave|St|Street|Blvd|Rd)/i);
      expect(text).not.toMatch(/free shipping|envío gratis|envío gratuito/i);
    }
  });
});

describe("/quote?service presets", () => {
  it("every block's CTA points to a real preset on the existing /quote path", () => {
    GAMING_SERVICE_BLOCKS.forEach((block) => {
      expect(getQuoteServicePreset(block.quoteService)).toBeTruthy();
      expect(quotePathFor(block.quoteService)).toBe(`/quote?service=${block.quoteService}`);
    });
  });

  it("controllers preselects the Controller type and its single category", () => {
    const answers = buildInitialAnswers(QUOTE_SERVICE_PRESETS.controllers);
    expect(answers.deviceTypeId).toBe("controller");
    expect(answers.categoryId).toBe("controllers");
    expect(answers.problemId).toBe("");
  });

  it("consoles preselects only the Console type — the visitor still picks PS5 or Xbox", () => {
    const answers = buildInitialAnswers(QUOTE_SERVICE_PRESETS.consoles);
    expect(answers.deviceTypeId).toBe("console");
    expect(answers.categoryId).toBe("");
  });

  it("maintenance preselects Console and carries the Deep Cleaning details line", () => {
    const { detailsKey, ...selection } = QUOTE_SERVICE_PRESETS.maintenance;
    expect(detailsKey).toBe("gamingServices.maintenance.quoteDetails");
    const answers = buildInitialAnswers({ ...selection, details: "Preventive maintenance / Deep Cleaning" });
    expect(answers.deviceTypeId).toBe("console");
    expect(answers.details).toBe("Preventive maintenance / Deep Cleaning");
  });

  it("an unknown service id is ignored", () => {
    expect(getQuoteServicePreset("bogus")).toBeNull();
    expect(getQuoteServicePreset("toString")).toBeNull();
    expect(buildInitialAnswers({ deviceTypeId: "not-a-type" }).deviceTypeId).toBe("");
  });

  function pressedTiles() {
    return screen.getAllByRole("dialog").flatMap((d) => [...d.querySelectorAll('[aria-pressed="true"]')]);
  }

  it("/quote?service=controllers opens the wizard with the Controller tile already selected", () => {
    renderAt("/quote?service=controllers");
    expect(screen.getAllByRole("dialog").length).toBeGreaterThan(0);
    const pressed = pressedTiles();
    expect(pressed).toHaveLength(1);
    expect(pressed[0].textContent).toMatch(/controller/i);
  });

  it("/quote?service=maintenance opens the wizard with the Console tile selected", () => {
    renderAt("/quote?service=maintenance");
    const pressed = pressedTiles();
    expect(pressed).toHaveLength(1);
    expect(pressed[0].textContent).toMatch(/console/i);
  });

  it("plain /quote and an unknown service open the normal wizard with nothing preselected", () => {
    renderAt("/quote");
    expect(pressedTiles()).toHaveLength(0);
    cleanup();
    renderAt("/quote?service=bogus");
    expect(screen.getAllByRole("dialog").length).toBeGreaterThan(0);
    expect(pressedTiles()).toHaveLength(0);
  });
});

describe("Home renders the section", () => {
  it("shows the three blocks with their quote CTAs and the mail-in WhatsApp button", () => {
    renderAt("/");
    const section = document.getElementById("gaming");
    expect(section).not.toBeNull();
    const scope = within(section);
    const quoteLinks = scope.getAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/quote"));
    expect(quoteLinks.map((a) => a.getAttribute("href"))).toEqual([
      "/quote?service=controllers",
      "/quote?service=consoles",
      "/quote?service=maintenance",
    ]);
    expect(scope.getAllByText("Request a repair quote")).toHaveLength(2);
    expect(scope.getAllByText("Request a maintenance quote")).toHaveLength(1);
    const mailIn = scope.getByText("Coordinate shipping on WhatsApp").closest("a");
    expect(mailIn.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/17867937665\?text=/);
    expect(scope.getAllByText("Illustrative image")).toHaveLength(3);
  });
});

describe("Hero quick links to the Consoles & Controllers services", () => {
  it("shows the four shortcuts right under the main CTA, in both languages", () => {
    renderAt("/");
    const nav = screen.getByRole("navigation", { name: "Console and controller services" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/quote?service=controllers",
      "/quote?service=consoles",
      "/quote?service=maintenance",
      "#gaming-mail-in",
    ]);
    expect(links.map((a) => a.textContent)).toEqual(["Controllers", "Consoles", "Deep Cleaning", "Mail-in service"]);
    expect(document.getElementById("gaming-mail-in")).not.toBeNull();
    expect(keyShape(translations.es.hero.quickLinks)).toEqual(keyShape(translations.en.hero.quickLinks));
  });
});
