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

  it("uses buildWholesaleWizardCatalog for BOTH the top-level list and the Microsoldering-scoped list — one adapter, two calls, not two implementations", () => {
    expect(wizardSrc).toContain('import { buildWholesaleWizardCatalog } from "../../lib/wholesaleWizardCatalog.js"');
    expect((wizardSrc.match(/buildWholesaleWizardCatalog\(/g) || []).length).toBe(2);
  });

  it("reuses the existing EquipmentTypeCard component for every grid — equipo, microsoldering entry, and model — never a bespoke card per screen", () => {
    expect(wizardSrc).toContain('import { EquipmentTypeCard } from "./EquipmentTypeCard.jsx"');
    expect((wizardSrc.match(/<EquipmentTypeCard/g) || []).length).toBeGreaterThanOrEqual(3);
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
  it("goBack pops the last screen off screenStack rather than switching on the current screen name", () => {
    expect(wizardSrc).toMatch(/function goBack\(\) \{\s*\n\s*setScreenStack\(\(stack\) => \(stack\.length > 1 \? stack\.slice\(0, -1\) : stack\)\);/);
  });

  it("every non-top screen renders exactly one Back button wired to goBack", () => {
    expect((wizardSrc.match(/onClick=\{goBack\}/g) || []).length).toBe(3); // microsolderingGrid, model, fault
  });
});

describe("WholesaleWizard.jsx: Microsoldadura is a lens, not a fake equipment type", () => {
  it("clicking the Microsoldadura tile sets isMicrosoldering and navigates to its own equipo grid, never straight to a model/fault screen", () => {
    expect(wizardSrc).toMatch(/function handleSelectMicrosoldering\(\) \{\s*\n\s*setIsMicrosoldering\(true\);\s*\n\s*goTo\("microsolderingGrid"\);/);
  });

  it("the Microsoldadura tile uses microsoldering.image and the translated title/subtitle, never hardcoded English/Spanish text", () => {
    expect(wizardSrc).toContain('t("microsoldering.title")');
    expect(wizardSrc).toContain("microsoldering.image");
  });

  it("the Microsoldadura tile only renders when the server actually returned a microsoldering object — server-trust, same rule as every other equipment type", () => {
    expect(wizardSrc).toMatch(/\{microsoldering && \(/);
  });

  it("selecting an equipo from within the Microsoldering branch passes { microsoldering: true } through, distinguishing it from the normal branch", () => {
    expect(wizardSrc).toMatch(/handleSelectEquipo\(equipo, \{ microsoldering: true \}\)/);
  });

  it("an empty microsoldering equipo list (no tagged active services) shows an empty state, not a broken/blank grid", () => {
    expect(wizardSrc).toMatch(/microsolderingEquipoList\.length === 0 \? \(\s*\n\s*<div className="wsp-empty">/);
  });
});

describe("WholesaleWizard.jsx: result panel receives exactly the selection it needs, resets cleanly", () => {
  it("passes selection.microsoldering/equipoName/modelName and the raw service object to WholesaleResultPanel", () => {
    expect(wizardSrc).toMatch(/microsoldering: isMicrosoldering,/);
    expect(wizardSrc).toMatch(/equipoName: selectedEquipo\?\.name,/);
    expect(wizardSrc).toMatch(/modelName: selectedModel\?\.name,/);
    expect(wizardSrc).toContain("service={selectedService}");
  });

  it("onConsultAnother resets the full stack and every selection back to the top screen", () => {
    expect(wizardSrc).toMatch(/function resetToTop\(\) \{\s*\n\s*setScreenStack\(\["top"\]\);/);
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

  it("shows on every selection screen (top, microsolderingGrid, model, fault) and nowhere else — never on progress/result, which have their own state", () => {
    expect(wizardSrc).toMatch(
      /const showSteps = screen === "top" \|\| screen === "microsolderingGrid" \|\| screen === "model" \|\| screen === "fault";/
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
