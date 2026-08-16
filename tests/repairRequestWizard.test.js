import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { translations } from "../src/i18n/translations.js";

// Walks every string leaf of a translation subtree (categories/brands/
// problems/questions are nested objects, not flat string maps) and fails
// if any of them is literally "Next" — the one label this wizard must
// never show, in either language.
function assertNoLiteralNext(node) {
  if (typeof node === "string") {
    expect(node).not.toBe("Next");
    expect(node).not.toBe("Siguiente");
    return;
  }
  if (node && typeof node === "object") {
    Object.values(node).forEach(assertNoLiteralNext);
  }
}

/**
 * Structural checks on the wizard hook and modal — same text-based approach
 * as every other test file in this project (no React render harness
 * configured). The actual multi-step flow (device -> model -> problem ->
 * 3 smart questions -> contact -> review, including a branded category and
 * both send links) was exercised live in the embedded browser during
 * implementation; these tests guard the same properties so they can't
 * regress silently.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const hookSrc = read("src/hooks/useRepairRequest.js");
const modalSrc = read("src/components/repair/RepairRequestModal.jsx");
const translationsSrc = read("src/i18n/translations.js");

describe("useRepairRequest: step bounds, validation, state preservation", () => {
  it("has exactly 8 steps and clamps navigation within [0, 7]", () => {
    expect(hookSrc).toContain("export const TOTAL_STEPS = 8;");
    expect(hookSrc).toContain("Math.min(s + 1, TOTAL_STEPS - 1)");
    expect(hookSrc).toContain("Math.max(s - 1, 0)");
  });

  it("Next is gated per step — device, model, problem, each smart question, and contact all have a canGoNext rule", () => {
    expect(hookSrc).toContain("step === STEP.DEVICE) return Boolean(answers.categoryId)");
    expect(hookSrc).toContain("step === STEP.PROBLEM) return Boolean(answers.problemId)");
    expect(hookSrc).toMatch(/STEP\.CONTACT\)\s*return\s*Boolean\(answers\.name\.trim\(\)\)\s*&&\s*Boolean\(answers\.phone\.trim\(\)\)/);
  });

  it("model step accepts either a typed model or the 'Not sure' checkbox — never requires both", () => {
    expect(hookSrc).toMatch(/Boolean\(answers\.model\.trim\(\)\)\s*\|\|\s*answers\.modelNotSure/);
  });

  it("'Not sure' is a valid, complete answer for smart questions — not treated as unanswered", () => {
    expect(hookSrc).toContain("Boolean(answers.smartAnswers[question.id])");
  });

  it("changing category resets only device-specific fields, never the contact fields — state preserved on Back", () => {
    const resetBlock = hookSrc.match(/groupChanged\s*\?\s*\{([^}]*)\}/)[1];
    expect(resetBlock).toMatch(/brandId/);
    expect(resetBlock).toMatch(/problemId/);
    expect(resetBlock).toMatch(/smartAnswers/);
    expect(resetBlock).not.toMatch(/name|phone|email|details/);
  });

  it("selecting a brand, model, or problem never touches the name/phone/email/details fields", () => {
    expect(hookSrc).toContain('setAnswers((prev) => ({ ...prev, brandId }));');
    expect(hookSrc).toContain("setAnswers((prev) => ({ ...prev, problemId }));");
  });
});

describe("RepairRequestModal: navigation controls and progress", () => {
  it("shows a translated 'Step X of Y' indicator", () => {
    expect(modalSrc).toContain('t("wizard.stepOf", { current: step + 1, total: estimator.TOTAL_STEPS })');
    expect(translationsSrc).toContain('stepOf: "Step {current} of {total}"');
    expect(translationsSrc).toContain('stepOf: "Paso {current} de {total}"');
  });

  it("has a Back control wired to goBack — no button is ever wired directly to goNext", () => {
    expect(modalSrc).toContain("onClick={estimator.goBack}");
    expect(modalSrc).toContain('<ChevronLeft size={16} />');
    expect(modalSrc).toContain('{t("wizard.back")}');
    // goNext() is only ever called from inside the debounced advance()
    // wrapper (covered separately below) — no button's onClick calls it
    // directly, which is what would let a double-click skip the debounce.
    expect(modalSrc).not.toMatch(/\bonClick=\{estimator\.goNext\}/);
  });

  it("never shows a visible 'Next' control, in source or in either language's translations", () => {
    // strip doc comments — this file's own header explains "no visible Next
    // anywhere" in prose, which shouldn't trip the check on itself.
    const stripped = modalSrc.replace(/\/\*\*[\s\S]*?\*\//g, "");
    expect(stripped).not.toMatch(/\bNext\b/);
    expect(stripped).not.toMatch(/\bSiguiente\b/);
    assertNoLiteralNext(translations.en.wizard);
    assertNoLiteralNext(translations.es.wizard);
  });

  it("Back is entirely absent (not just disabled) on the very first step", () => {
    expect(modalSrc).toContain("{step > STEP.DEVICE && (");
    expect(modalSrc).not.toContain("disabled={step === STEP.DEVICE}");
  });

  it("review step offers an editable summary — each row can jump back to its own step", () => {
    expect(modalSrc).toContain("estimator.editStep(STEP.DEVICE)");
    expect(modalSrc).toContain("estimator.editStep(STEP.MODEL)");
    expect(modalSrc).toContain("estimator.editStep(STEP.PROBLEM)");
    expect(modalSrc).toContain("estimator.editStep(STEP.CONTACT)");
  });

  it("every big control meets the 44px minimum touch target", () => {
    expect(modalSrc).toMatch(/TileButton[\s\S]*?min-h-11/);
    expect(modalSrc).toContain("h-11 w-11"); // close button
    expect(modalSrc).toContain("min-h-11 min-w-11"); // edit buttons
  });
});

describe("RepairRequestModal: accessibility", () => {
  it("is a labeled dialog with aria-modal", () => {
    expect(modalSrc).toContain('role="dialog"');
    expect(modalSrc).toContain('aria-modal="true"');
    expect(modalSrc).toContain('aria-labelledby="repair-wizard-title"');
  });

  it("every interactive control carries the focus-visible ring", () => {
    expect(modalSrc).toContain("focus-visible:outline-none");
    expect(modalSrc).toContain("focus-visible:ring-2");
  });

  it("traps Tab within the dialog and closes on Escape", () => {
    expect(modalSrc).toContain('e.key === "Escape"');
    expect(modalSrc).toContain('e.key !== "Tab"');
  });

  it("restores focus to whatever was focused before the modal opened", () => {
    expect(modalSrc).toContain("const previouslyFocused = document.activeElement");
    expect(modalSrc).toContain("previouslyFocused?.focus?.()");
  });

  it("category, problem, and answer tiles expose aria-pressed for their selection state", () => {
    expect(modalSrc).toContain("aria-pressed={selected}");
  });
});

describe("RepairRequestModal: no photo upload, no Supabase, no Wholesale coupling", () => {
  it("shows the required photo note instead of any upload control", () => {
    expect(modalSrc).toContain('{t("wizard.photosNote")}');
    expect(translations.en.wizard.photosNote).toBe("You can attach photos after WhatsApp opens.");
    expect(translations.es.wizard.photosNote).toBe("Puedes adjuntar fotos después de abrir WhatsApp.");
    expect(modalSrc).not.toMatch(/type="file"|FormData|accept="image/i);
  });

  it("never imports or references Supabase, Storage, or any /api/ endpoint", () => {
    const combined = hookSrc + modalSrc;
    expect(combined).not.toMatch(/supabase/i);
    expect(combined).not.toMatch(/\/api\//);
    expect(combined).not.toMatch(/fetch\(/);
  });

  it("never imports any Wholesale module — public and private catalogs stay fully separate", () => {
    // strip doc comments — this file's own header explains "no Wholesale/
    // DESK involvement" in prose, which isn't an import and shouldn't trip
    // this check on itself.
    const stripComments = (src) => src.replace(/\/\*\*[\s\S]*?\*\//g, "");
    const combined = stripComments(hookSrc) + stripComments(modalSrc);
    expect(combined).not.toMatch(/wholesale/i);
  });

  it("never asks for IMEI, serial number, password, or PIN", () => {
    expect(modalSrc).not.toMatch(/imei|serial|password|\bpin\b/i);
  });

  it("adds no framer-motion animation — a plain instant step swap, no motion-accessibility risk", () => {
    expect(modalSrc).not.toMatch(/from ["']framer-motion["']/);
    expect(modalSrc).not.toMatch(/whileHover|whileInView|AnimatePresence/);
  });
});

describe("RepairRequestModal: never renders a price, a range, or an ETA", () => {
  it("has no price/estimate/ETA copy or logic anywhere in the modal or hook", () => {
    // strip /** */ and // comments first — this file's own doc comments
    // explain "No price, no ETA" in prose, which shouldn't trip the check
    // on itself.
    const stripComments = (src) => src.replace(/\/\*\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const combined = stripComments(hookSrc) + stripComments(modalSrc);
    expect(combined).not.toMatch(/\$\d/);
    expect(combined).not.toMatch(/starting at/i);
    expect(combined).not.toMatch(/your estimate/i);
    expect(combined).not.toMatch(/\betaDays?\b/i);
    expect(combined).not.toMatch(/\bprice\b/i);
  });
});

describe("RepairRequestModal: auto-advance mechanism", () => {
  it("every selection tile advances through a single locked/advance() debounce — never a raw goNext() call", () => {
    expect(modalSrc).toContain("function advance(recordAnswer)");
    expect(modalSrc).toContain("if (locked) return;");
    expect(modalSrc).toContain("setLocked(true);");
    expect(modalSrc).toContain("estimator.goNext();");
    expect(modalSrc).toMatch(/setTimeout\(\(\) => setLocked\(false\), \d+\)/);
    // DeviceStep/ProblemStep/SmartQuestionStep tiles and the branded
    // ModelStep brand tiles all route through onAdvance, never call
    // goNext directly themselves.
    expect(modalSrc).not.toMatch(/\bonClick=\{estimator\.goNext\}/);
  });

  it("moves focus to the new step's title on every step change, via its own effect keyed on [step]", () => {
    expect(modalSrc).toContain("titleRef.current?.focus();");
    expect(modalSrc).toContain("}, [step]);");
  });

  it("the model and contact steps keep an explicit Continue/Review button instead of auto-advancing on keystroke", () => {
    expect(modalSrc).toContain('label={t("wizard.continueLabel")}');
    expect(modalSrc).toContain('label={t("wizard.reviewRequest")}');
  });
});

describe("XP blue/green gradients: WCAG AA contrast, computed (not eyeballed)", () => {
  // Same relative-luminance / contrast-ratio formulas used throughout this
  // project's prior contrast-verification rounds.
  function srgbToLinear(c) {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }
  function relativeLuminance(hex) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
  }
  function contrastRatio(hexA, hexB) {
    const lA = relativeLuminance(hexA);
    const lB = relativeLuminance(hexB);
    const [lighter, darker] = lA > lB ? [lA, lB] : [lB, lA];
    return (lighter + 0.05) / (darker + 0.05);
  }

  function extractHexStops(gradientClass) {
    return [...gradientClass.matchAll(/#([0-9A-Fa-f]{6})/g)].map((m) => m[1]);
  }

  it("every stop of BLUE_XP and GREEN_XP (base and hover) passes >=4.5:1 against white text", () => {
    const blueMatch = modalSrc.match(/const BLUE_XP =\s*\n?\s*"([^"]+)"/);
    const greenMatch = modalSrc.match(/const GREEN_XP =\s*\n?\s*"([^"]+)"/);
    expect(blueMatch).toBeTruthy();
    expect(greenMatch).toBeTruthy();

    const blueStops = extractHexStops(blueMatch[1]);
    const greenStops = extractHexStops(greenMatch[1]);
    expect(blueStops.length).toBeGreaterThanOrEqual(3);
    expect(greenStops.length).toBeGreaterThanOrEqual(3);

    [...blueStops, ...greenStops].forEach((hex) => {
      expect(contrastRatio(hex, "FFFFFF")).toBeGreaterThanOrEqual(4.5);
    });
  });
});

describe("i18n completeness: en and es wizard trees have identical key shapes", () => {
  function keyShape(node) {
    if (node === null || typeof node !== "object") return null;
    return Object.fromEntries(
      Object.entries(node)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, keyShape(v)])
    );
  }

  it("wizard.categories/brands/problems/questions/answers/titles/fields/summary match key-for-key between en and es", () => {
    expect(keyShape(translations.es.wizard)).toEqual(keyShape(translations.en.wizard));
  });

  it("nav/hero/services/howItWorks/contact/faq/footer match key-for-key between en and es", () => {
    ["nav", "hero", "services", "howItWorks", "contact", "faq", "footer"].forEach((section) => {
      expect(keyShape(translations.es[section])).toEqual(keyShape(translations.en[section]));
    });
  });
});
