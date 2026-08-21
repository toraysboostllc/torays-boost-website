import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { wholesaleTranslations } from "../src/i18n/wholesaleTranslations.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const wizardSrc = read("src/components/wholesale/WholesaleWizard.jsx");

describe("WholesaleWizard.jsx: single data-driven wizard, never fetches, never a per-device block", () => {
  it("never calls fetch — every piece of data it renders was already passed in as props", () => {
    expect(wizardSrc).not.toMatch(/fetch\(/);
  });

  it("uses buildWholesaleWizardCatalog exactly once, on the single equipmentTypes prop — Microsoldering is a plain member of that same array (see api/_lib/wholesaleDb.js), not a second adapter call over a separate list", () => {
    expect(wizardSrc).toContain('import { buildWholesaleWizardCatalog } from "../../lib/wholesaleWizardCatalog.js"');
    expect((wizardSrc.match(/buildWholesaleWizardCatalog\(/g) || []).length).toBe(1);
  });

  it("reuses the existing EquipmentTypeCard component for every grid — equipo (Microsoldering included) and model — never a bespoke card per screen", () => {
    expect(wizardSrc).toContain('import { EquipmentTypeCard } from "./EquipmentTypeCard.jsx"');
    expect((wizardSrc.match(/<EquipmentTypeCard/g) || []).length).toBe(2);
  });

  it("no hardcoded per-device component or branch — no 'PS5' / 'Xbox' / 'Switch' literal string anywhere in this file", () => {
    expect(wizardSrc).not.toMatch(/["'`]PS5["'`]|["'`]Xbox["'`]|["'`]Switch["'`]/);
  });
});

describe("WholesaleWizard.jsx: Modelo step is skipped only when an Equipo has exactly 1 model", () => {
  it("checks models.length === 1 to decide whether to auto-advance", () => {
    expect(wizardSrc).toMatch(/if \(equipo\.models\.length === 1\) \{/);
  });

  it("auto-selected single model still sets selectedModel before jumping to the fault screen — Falla always has a model to read services from", () => {
    expect(wizardSrc).toMatch(/setSelectedModel\(equipo\.models\[0\]\);\s*\n\s*goTo\("fault"\);/);
  });

  it("a multi-model equipo goes to the model screen instead", () => {
    expect(wizardSrc).toMatch(/\} else \{\s*\n\s*goTo\("model"\);/);
  });
});

describe("WholesaleWizard.jsx: back navigation is a real stack, not a hardcoded per-screen target", () => {
  it("goBack delegates to the pure popScreen reducer rather than switching on the current screen name — see wizardScreenStack.test.js for the underflow-proof behind it", () => {
    expect(wizardSrc).toContain('import { pushScreen, popScreen, resetStack, currentScreen, TOP_SCREEN } from "../../lib/wizardScreenStack.js";');
    expect(wizardSrc).toMatch(/function goBack\(\) \{\s*\n\s*setScreenStack\(\(stack\) => popScreen\(stack\)\);/);
  });

  it("every non-top screen renders exactly one Back button wired to goBack (wrapped for the hover/tap sound)", () => {
    expect((wizardSrc.match(/wholesaleHoverProps\(goBack\)/g) || []).length).toBe(2); // model, fault — no separate microsolderingGrid screen anymore
  });
});

describe("WholesaleWizard.jsx: Microsoldering is a plain Equipo, not a fake/separate screen", () => {
  it("there is no separate microsolderingGrid screen, no separate microsoldering-scoped equipo list, and no hardcoded slug/id gate deciding whether the card appears", () => {
    expect(wizardSrc).not.toContain("microsolderingGrid");
    expect(wizardSrc).not.toContain("microsolderingEquipoList");
    expect(wizardSrc).not.toContain("handleSelectMicrosoldering");
    expect(wizardSrc).not.toMatch(/\{microsoldering && \(/);
    expect(wizardSrc).not.toMatch(/slug\s*===\s*["']microsoldering["']/);
  });

  it("clicking ANY equipo (Microsoldering included) goes through the one generic handleSelectEquipo — model screen if it has >1 model, straight to fault if it has exactly 1", () => {
    expect(wizardSrc).toMatch(/function handleSelectEquipo\(equipo\) \{/);
    expect(wizardSrc).not.toMatch(/handleSelectEquipo\(equipo, \{/); // no second-argument options object anymore
  });

  it("the optional informational banner on the Modelo/Falla screens is gated by the real row's catalog_mode-derived isDirectServices flag, never a hardcoded slug — and never decides whether the card exists", () => {
    expect(wizardSrc).toMatch(/selectedEquipo\.isDirectServices && \(/);
    expect(wizardSrc).toMatch(/selectedEquipo\?\.isDirectServices && \(/);
    expect(wizardSrc).toContain('t("microsoldering.title")');
    expect(wizardSrc).toContain('t("microsoldering.subtitle")');
  });

  it("an equipo with zero models can't happen for Microsoldering specifically — the server already excludes it from equipmentTypes[] whenever nothing is currently tagged (see api/_lib/wholesaleDb.js and wholesaleImages.test.js's 'hide if empty' coverage) — this file has no client-side empty-lens special case to test", () => {
    expect(wizardSrc).not.toContain("microsolderingEquipoList.length === 0");
  });
});

describe("WholesaleWizard.jsx: result panel receives exactly the selection it needs, resets cleanly", () => {
  it("passes selection.microsoldering/equipoName/modelName and the raw service object to WholesaleResultPanel — microsoldering is derived from the selected equipo's real isDirectServices flag, never a separately-tracked hardcoded-slug state", () => {
    expect(wizardSrc).toMatch(/microsoldering: Boolean\(selectedEquipo\?\.isDirectServices\),/);
    expect(wizardSrc).toMatch(/equipoName: selectedEquipo\?\.name,/);
    expect(wizardSrc).toMatch(/modelName: selectedModel\?\.name,/);
    expect(wizardSrc).toContain("service={selectedService}");
  });

  it("onConsultAnother resets the full stack (via the pure resetStack reducer) and every selection back to the top screen", () => {
    expect(wizardSrc).toMatch(/function resetToTop\(\) \{\s*\n\s*setScreenStack\(resetStack\(\)\);/);
    expect(wizardSrc).toContain("onConsultAnother={resetToTop}");
  });
});

describe("WholesaleWizard.jsx: mobile-first grid — 2 columns from the smallest breakpoint", () => {
  it("uses the wsp-grid-compact variant, never the shared wsp-grid alone (which is 1-col until 640px)", () => {
    expect(wizardSrc).toMatch(/className="wsp-grid wsp-grid-compact"/);
  });
});

describe("WholesaleWizard.jsx: WizardSteps — Equipo/Modelo/Falla progress indicator", () => {
  it("renders 3 steps using the dedicated short i18n labels, never the longer chooseX headings", () => {
    expect(wizardSrc).toContain('t("wizard.stepEquipment")');
    expect(wizardSrc).toContain('t("wizard.stepModel")');
    expect(wizardSrc).toContain('t("wizard.stepIssue")');
  });

  it("each step's done state is a REAL selection check, never a hardcoded true — equipo/modelo/falla independently reflect selectedEquipo/selectedModel/selectedService", () => {
    expect(wizardSrc).toMatch(/equipoDone=\{Boolean\(selectedEquipo\)\}/);
    expect(wizardSrc).toMatch(/modeloDone=\{Boolean\(selectedModel\)\}/);
    expect(wizardSrc).toMatch(/fallaDone=\{Boolean\(selectedService\)\}/);
  });

  it("shows on every selection screen (top, model, fault) and nowhere else — never on progress/result, which have their own state; no separate microsolderingGrid screen exists to list here", () => {
    expect(wizardSrc).toMatch(
      /const showSteps = screen === TOP_SCREEN \|\| screen === "model" \|\| screen === "fault";/
    );
    expect(wizardSrc).not.toMatch(/showSteps[\s\S]{0,20}"progress"/);
    expect(wizardSrc).not.toMatch(/showSteps[\s\S]{0,20}"result"/);
  });

  it("a done step shows a checkmark instead of its number — never both at once", () => {
    expect(wizardSrc).toMatch(/step\.done \? <Check size=\{14\} \/> : i \+ 1/);
  });

  it("exact required copy — es matches the approved reference (Equipo/Modelo/Falla), en is the equivalent short label", () => {
    expect(wholesaleTranslations.es.wizard.stepEquipment).toBe("Equipo");
    expect(wholesaleTranslations.es.wizard.stepModel).toBe("Modelo");
    expect(wholesaleTranslations.es.wizard.stepIssue).toBe("Falla");
    expect(wholesaleTranslations.en.wizard.stepEquipment).toBe("Device");
    expect(wholesaleTranslations.en.wizard.stepModel).toBe("Model");
    expect(wholesaleTranslations.en.wizard.stepIssue).toBe("Issue");
  });
});

describe("WholesaleWizard.jsx: interactive hover/tap sound — Back buttons and the fault list", () => {
  it("imports wholesaleHoverProps from the shared sound engine, never a hand-rolled hover/click handler", () => {
    expect(wizardSrc).toContain('import { wholesaleHoverProps } from "../../lib/wholesaleSound.js";');
  });

  it("the fault list's own button is wired through wholesaleHoverProps, not a bare onClick — one tone on real entry/tap, never per mouse movement", () => {
    expect(wizardSrc).toContain("wholesaleHoverProps(() => handleSelectFault(service))");
    expect(wizardSrc).not.toMatch(/onClick=\{\(\) => handleSelectFault\(service\)\}/);
  });

  it("equipo/model grids reuse EquipmentTypeCard (which itself wires wholesaleHoverProps — see EquipmentTypeCard's own tests), never a second hover implementation duplicated in this file", () => {
    expect(wizardSrc).not.toContain("playHoverTone");
  });
});

describe("WholesaleWizard.jsx: keyboard accessibility — every selectable control is a real <button>", () => {
  it("the Back button is a real <button type=\"button\">, not a clickable <div>/<span> — free native Tab/Enter/Space support, nothing custom to break", () => {
    expect((wizardSrc.match(/<button type="button" \{\.\.\.wholesaleHoverProps\(goBack\)\}/g) || []).length).toBe(2);
  });

  it("every fault-list item is a real <button type=\"button\"> inside a <li>, not a div-with-onClick", () => {
    expect(wizardSrc).toMatch(/<li key=\{service\.id\}>\s*\n\s*<button\s*\n\s*type="button"/);
  });

  it("no non-semantic clickable element (div/span carrying onClick) exists anywhere in this file — every interactive surface here is EquipmentTypeCard (see its own test file for its own <button>) or a native <button>", () => {
    expect(wizardSrc).not.toMatch(/<div[^>]*onClick=/);
    expect(wizardSrc).not.toMatch(/<span[^>]*onClick=/);
  });
});

describe("WholesaleWizard.jsx: mobile — Back button and step indicator are never hidden at any breakpoint", () => {
  it("the Back button's own class carries no hidden/md:hidden responsive-visibility modifier", () => {
    expect(wizardSrc).toMatch(/className="wsp-btn wsp-btn-ghost wsp-wizard-back"/);
    expect(wizardSrc).not.toMatch(/wsp-wizard-back[^"]*\bhidden\b/);
  });

  it("WizardSteps renders unconditionally on every selection screen — its own <ol> carries no responsive-visibility modifier that could strand a mobile shop mid-flow", () => {
    expect(wizardSrc).toContain('className="wsp-wizard-steps"');
    expect(wizardSrc).not.toMatch(/wsp-wizard-steps[^"]*\bhidden\b/);
  });

  it("the compact 2-column grid (wsp-grid-compact) applies from the smallest breakpoint, confirmed separately in the mobile-first grid describe block above — mobile never falls back to a 1-col-until-640px layout for equipo/model selection", () => {
    expect((wizardSrc.match(/className="wsp-grid wsp-grid-compact"/g) || []).length).toBe(2); // top equipo grid + model grid
  });
});
