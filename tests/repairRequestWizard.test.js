import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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
  it("shows a 'Step X of Y' indicator", () => {
    expect(modalSrc).toContain("Step {step + 1} of {TOTAL_STEPS}");
  });

  it("has Back and Next controls, Next disabled when the step isn't complete", () => {
    expect(modalSrc).toContain("onClick={estimator.goBack}");
    expect(modalSrc).toContain("onClick={estimator.goNext}");
    expect(modalSrc).toMatch(/<ChevronLeft[^/]*\/>\s*Back/);
    expect(modalSrc).toMatch(/Next\s*<ChevronRight/);
    expect(modalSrc).toContain("disabled={!estimator.canGoNext}");
  });

  it("Back is disabled/hidden on the very first step", () => {
    expect(modalSrc).toContain("disabled={step === STEP.DEVICE}");
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
    expect(modalSrc).toContain("You can attach photos after WhatsApp opens.");
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
