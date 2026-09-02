import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { translations } from "../src/i18n/translations.js";
import { PROBLEMS_BY_GROUP, SMART_QUESTIONS_BY_GROUP, ANSWER_OPTIONS } from "../src/config/repairRequest.config.js";
import {
  IMPLIED_ANSWERS,
  getImpliedAnswers,
  getVisibleQuestions,
  allProblemGroupPairs,
} from "../src/config/repairFlow.config.js";
import { isValidUsPhone, formatPhone } from "../src/lib/phone.js";

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
const confirmSrc = read("src/components/repair/QuoteReadyModal.jsx");
const flowSrc = read("src/config/repairFlow.config.js");
const tailwindSrc = read("tailwind.config.js");
const translationsSrc = read("src/i18n/translations.js");

describe("useRepairRequest: step bounds, validation, state preservation", () => {
  it("has exactly 4 steps and clamps navigation within [0, 3]", () => {
    expect(hookSrc).toContain("export const TOTAL_STEPS = 4;");
    expect(hookSrc).toContain("Math.min(s + 1, TOTAL_STEPS - 1)");
    expect(hookSrc).toContain("Math.max(s - 1, 0)");
    // The confirmation screen is deliberately NOT a step — a fifth STEP would
    // make the header read "Step 5 of 4".
    expect(hookSrc).not.toMatch(/STEP\s*=\s*\{[^}]*REVIEW/);
    expect(modalSrc).toContain("const [quoteReadyOpen, setQuoteReadyOpen] = useState(false);");
  });

  it("the four steps are device type, brand+model, issue, contact — in that order", () => {
    expect(hookSrc).toMatch(/DEVICE:\s*0/);
    expect(hookSrc).toMatch(/MODEL:\s*1/);
    expect(hookSrc).toMatch(/ISSUE:\s*2/);
    expect(hookSrc).toMatch(/CONTACT:\s*3/);
  });

  it("Next is gated per step — device type, model, issue (with its visible questions), and contact", () => {
    expect(hookSrc).toContain("step === STEP.DEVICE) return Boolean(answers.deviceTypeId)");
    expect(hookSrc).toContain("if (!answers.problemId) return false;");
    expect(hookSrc).toMatch(/canSubmit\s*=\s*Boolean\(answers\.name\.trim\(\)\)\s*&&\s*isValidUsPhone\(answers\.phone\)/);
  });

  it("model step accepts either a typed model or the 'Not sure' choice — never requires both", () => {
    expect(hookSrc).toMatch(/Boolean\(answers\.model\.trim\(\)\)\s*\|\|\s*answers\.modelNotSure/);
  });

  it("'Not sure' is a valid, complete answer for the questions that are still visible", () => {
    expect(hookSrc).toContain("visibleQuestions.every((q) => Boolean(answers.smartAnswers[q.id]))");
  });

  it("changing device type resets only device-specific fields, never the contact fields", () => {
    const body = hookSrc.match(/function selectDeviceType\(deviceTypeId\) \{([\s\S]*?)\n  \}/)[1];
    expect(body).toMatch(/brandId/);
    expect(body).toMatch(/problemId/);
    expect(body).toMatch(/smartAnswers/);
    expect(body.replace(/^\s*\/\/.*$/gm, "")).not.toMatch(/\bname\b|\bphone\b|\bemail\b|\bdetails\b/);
  });

  it("selecting a brand or a problem never touches the name/phone/email/details fields", () => {
    // strip // comments first — these functions' own doc comments mention
    // "contact fields" in prose, which shouldn't trip the check on itself.
    const strip = (s) => s.replace(/^\s*\/\/.*$/gm, "");
    const selectBrandBody = strip(hookSrc.match(/function selectBrand\(brandId\) \{([\s\S]*?)\n  \}/)[1]);
    expect(selectBrandBody).not.toMatch(/\bname\b|\bphone\b|\bemail\b|\bdetails\b/);
    const selectProblemBody = strip(hookSrc.match(/function selectProblem\(problemId\) \{([\s\S]*?)\n  \}/)[1]);
    expect(selectProblemBody).not.toMatch(/\bname\b|\bphone\b|\bemail\b|\bdetails\b/);
  });

  it("STEP.MODEL for a branded category requires a brand, a custom brand name for 'Other', and a model", () => {
    expect(hookSrc).toContain("if (!answers.brandId) return false;");
    expect(hookSrc).toContain('if (answers.brandId === "other" && !answers.customBrandName.trim()) return false;');
    expect(hookSrc).toContain("return modelAnswered;");
  });

  it("an implied answer is never written into state — it is merged on read, so it can never go stale", () => {
    // selectProblem only stores the problemId; the inferred answers come from
    // the config every render, so switching problems can't strand an old one.
    const body = hookSrc.match(/function selectProblem\(problemId\) \{([\s\S]*?)\n  \}/)[1];
    expect(body).not.toMatch(/smartAnswers/);
    expect(hookSrc).toContain("({ ...answers.smartAnswers, ...impliedAnswers })");
  });

  it("switching away from the 'Other' brand clears the custom brand name but keeps the typed model", () => {
    const selectBrandBody = hookSrc.match(/function selectBrand\(brandId\) \{([\s\S]*?)\n  \}/)[1];
    expect(selectBrandBody).toContain('prev.brandId === "other" && brandId !== "other"');
    expect(selectBrandBody).toContain("customBrandName: \"\"");
    expect(selectBrandBody).not.toMatch(/model:\s*""|model:\s*prev\.model\s*===/); // model is never cleared here
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
    expect(modalSrc).toContain("{step > STEP.DEVICE ? (");
    expect(modalSrc).not.toContain("disabled={step === STEP.DEVICE}");
  });

  it("the confirmation modal still shows the recap the old review step used to", () => {
    // Folding the review step away must not cost the visitor their last look
    // at what they are about to send.
    expect(modalSrc).toContain("function buildSummaryRows()");
    expect(modalSrc).toContain('t("wizard.summary.device")');
    expect(modalSrc).toContain('t("wizard.summary.model")');
    expect(modalSrc).toContain('t("wizard.summary.problem")');
    expect(modalSrc).toContain('t("wizard.summary.name")');
    expect(modalSrc).toContain('t("wizard.summary.phone")');
    // and the diagnostic answers
    expect(modalSrc).toContain("estimator.smartQuestions.forEach((q) => {");
    expect(confirmSrc).toContain("summaryRows.map((row)");
  });

  it("every big control meets the 44px minimum touch target", () => {
    expect(modalSrc).toMatch(/function Tile\(\{[\s\S]*?min-h-12/);
    expect(modalSrc).toMatch(/function Chip\(\{[\s\S]*?min-h-11/);
    expect(modalSrc).toContain("h-11 w-11"); // close button
    expect(modalSrc).toContain("min-h-12"); // inputs and primary buttons
    expect(confirmSrc).toContain("h-11 w-11");
    expect(confirmSrc).toContain("min-h-12");
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
    // DeviceStep/ProblemStep/SmartQuestionStep tiles all route through
    // onAdvance, never call goNext directly themselves. The branded
    // ModelStep's brand tiles are the deliberate exception — see the
    // "Other Brands" describe block below.
    expect(modalSrc).not.toMatch(/\bonClick=\{estimator\.goNext\}/);
  });

  it("moves focus to the new step's title on every step change, via its own effect keyed on [step]", () => {
    expect(modalSrc).toContain("titleRef.current?.focus();");
    expect(modalSrc).toContain("}, [step]);");
  });

  it("only step 1 auto-advances — steps 2 and 3 continue below the selection, so they keep an explicit Continue", () => {
    expect(modalSrc).toContain('label={t("wizard.continueLabel")}');
    // The device tiles are the only ones wired to onAdvance.
    expect(modalSrc).toContain("onClick={() => onAdvance(() => estimator.selectDeviceType(type.id))}");
    // Picking a problem must NOT jump away — the questions appear underneath it.
    expect(modalSrc).toContain("onClick={() => estimator.selectProblem(p.id)}");
    const issueStep = modalSrc.slice(modalSrc.indexOf("function IssueStep"), modalSrc.indexOf("function ContactStep"));
    expect(issueStep).not.toContain("onAdvance");
  });
});

describe("Other Brands (Smartphones/Laptops): collects both brand AND exact model, deliberate auto-advance exception", () => {
  it("brand tiles select only — they do NOT auto-advance", () => {
    const modelStepBody = modalSrc.slice(modalSrc.indexOf("function ModelStep"), modalSrc.indexOf("function IssueStep"));
    expect(modelStepBody).toContain("onClick={() => estimator.selectBrand(b.id)}");
    expect(modelStepBody).not.toContain("onAdvance");
  });

  it("reveals the model field only after the category (and brand, where there is one) is picked", () => {
    expect(modalSrc).toContain("{answers.categoryId && (!brands || answers.brandId) && (");
  });

  it("selecting 'Other' reveals a second field for the custom brand name", () => {
    expect(modalSrc).toContain('{answers.categoryId && brands && answers.brandId === "other" && (');
    expect(modalSrc).toContain('{t("wizard.fields.customBrand")}');
    expect(modalSrc).toContain("value={answers.customBrandName}");
    expect(modalSrc).toContain("onChange={(e) => estimator.setCustomBrandName(e.target.value)}");
  });

  it("keeps the approved brand/model copy in both languages", () => {
    expect(translations.en.wizard.fields.enterExactModel).toBe("Enter the exact model");
    expect(translations.es.wizard.fields.enterExactModel).toBe("Escribe el modelo exacto");
    expect(translations.en.wizard.fields.customBrand).toBe("Brand name");
    expect(translations.es.wizard.fields.customBrand).toBe("Nombre de la marca");
  });

  it("every model field offers an explicit way out — Other model and Not sure, in both languages", () => {
    expect(translations.en.wizard.fields.otherModel).toBe("Other model");
    expect(translations.es.wizard.fields.otherModel).toBe("Otro modelo");
    expect(translations.en.wizard.fields.notSureModel).toBe("Not sure");
    expect(translations.es.wizard.fields.notSureModel).toBe("No estoy seguro");
    expect(modalSrc).toContain('{t("wizard.fields.otherModel")}');
    expect(modalSrc).toContain('{t("wizard.fields.notSureModel")}');
    // categories without chips keep the free-text field plus the checkbox
    expect(modalSrc).toContain('{t("wizard.notSureOther")}');
  });

  it("uses the placeholder that matches the device group", () => {
    expect(translations.en.wizard.fields.modelPlaceholderPhone).toBe("e.g. Galaxy S24 Ultra");
    expect(translations.en.wizard.fields.modelPlaceholderLaptop).toBe("e.g. Inspiron 15 3520");
    expect(modalSrc).toContain('t("wizard.fields.modelPlaceholderLaptop")');
    expect(modalSrc).toContain('t("wizard.fields.modelPlaceholderPhone")');
  });

  it("Continue only appears/enables once brand + model (+ custom brand name for Other) are filled — gated on estimator.canGoNext", () => {
    expect(modalSrc).toContain('disabled={!estimator.canGoNext} onClick={onContinue} label={t("wizard.continueLabel")}');
  });

  it("Enter key in either text field triggers Continue once the step is valid, without a <form> wrapper", () => {
    expect(modalSrc).toContain("function onFieldKeyDown(e) {");
    expect(modalSrc).toContain('if (e.key === "Enter" && estimator.canGoNext) {');
    expect(modalSrc).toContain("onKeyDown={onFieldKeyDown}");
  });

  it("fields are label-associated — a wrapping <label>, or an explicit aria-label where the legend carries the name", () => {
    const modelStepSrc = modalSrc.slice(modalSrc.indexOf("function ModelStep"), modalSrc.indexOf("function IssueStep"));
    const labelled = (modelStepSrc.match(/<label className="flex flex-col gap-2">/g) || []).length;
    const ariaLabelled = (modelStepSrc.match(/aria-label=\{t\(/g) || []).length;
    expect(labelled + ariaLabelled).toBeGreaterThanOrEqual(2);
    // Grouped controls are real fieldsets with a legend, not bare divs.
    expect(modelStepSrc).toContain("<legend className={LABEL_CLASS}>");
  });

  it("inputs keep the shared 48px-tall, focus-visible INPUT_CLASS — no bespoke unstyled inputs", () => {
    const modelStepBody = modalSrc.slice(modalSrc.indexOf("function ModelStep"), modalSrc.indexOf("function IssueStep"));
    expect((modelStepBody.match(/INPUT_CLASS/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(modalSrc).toMatch(/const INPUT_CLASS =\s*\n?\s*"min-h-12/);
  });

  it("the confirmation summary shows the typed custom brand name instead of the generic 'Other' label", () => {
    expect(modalSrc).toContain('estimator.brand.id === "other" && a.customBrandName.trim()');
  });
});

describe("The 13 implied-answer rules", () => {
  it("has exactly 13 rules across the five groups that have any", () => {
    const ruleCount = Object.values(IMPLIED_ANSWERS).reduce((n, group) => n + Object.keys(group).length, 0);
    expect(ruleCount).toBe(13);
  });

  it("every rule fills exactly one answer — no second-degree inference", () => {
    Object.entries(IMPLIED_ANSWERS).forEach(([group, byProblem]) => {
      Object.entries(byProblem).forEach(([problemId, filled]) => {
        expect(Object.keys(filled), `${group}/${problemId} should imply exactly one answer`).toHaveLength(1);
      });
    });
  });

  it("console 'no-power' implies only 'powers-on: no' — the vetoed 'displays-image' inference is gone", () => {
    expect(IMPLIED_ANSWERS.console["no-power"]).toEqual({ "powers-on": "no" });
    expect(IMPLIED_ANSWERS.console["no-power"]).not.toHaveProperty("displays-image");
  });

  it("'stick-drift' stays un-inferred — drift existing says nothing about whether it is constant", () => {
    expect(IMPLIED_ANSWERS.controller).not.toHaveProperty("stick-drift");
  });

  it("every rule points at a problem id and a question id that really exist in the catalog", () => {
    Object.entries(IMPLIED_ANSWERS).forEach(([group, byProblem]) => {
      const problemIds = (PROBLEMS_BY_GROUP[group] || []).map((p) => p.id);
      const questionIds = (SMART_QUESTIONS_BY_GROUP[group] || []).map((q) => q.id);
      const answerIds = ANSWER_OPTIONS.map((a) => a.id);
      Object.entries(byProblem).forEach(([problemId, filled]) => {
        expect(problemIds, `${group}/${problemId}`).toContain(problemId);
        Object.entries(filled).forEach(([questionId, answerId]) => {
          expect(questionIds, `${group}/${problemId}/${questionId}`).toContain(questionId);
          expect(answerIds).toContain(answerId);
        });
      });
    });
  });

  it("visible + implied always equals 3, for every problem of every group — no route drops below 2 visible", () => {
    allProblemGroupPairs().forEach(({ group, problemId }) => {
      const visible = getVisibleQuestions(group, problemId);
      const implied = getImpliedAnswers(group, problemId);
      const total = (SMART_QUESTIONS_BY_GROUP[group] || []).length;
      expect(total).toBe(3);
      expect(visible.length + Object.keys(implied).length, `${group}/${problemId}`).toBe(3);
      expect(visible.length, `${group}/${problemId} must keep at least 2 visible`).toBeGreaterThanOrEqual(2);
    });
  });

  it("no question is both implied and still shown", () => {
    allProblemGroupPairs().forEach(({ group, problemId }) => {
      const implied = Object.keys(getImpliedAnswers(group, problemId));
      const visibleIds = getVisibleQuestions(group, problemId).map((q) => q.id);
      implied.forEach((id) => expect(visibleIds).not.toContain(id));
    });
  });
});

describe("Quote palette: WCAG AA contrast, computed (not eyeballed)", () => {
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

  function token(name) {
    const m = tailwindSrc.match(new RegExp(`"${name}":\\s*"#([0-9A-Fa-f]{6})"`));
    expect(m, `tailwind.config.js should define ${name}`).toBeTruthy();
    return m[1];
  }

  it("every colour that carries white text passes >=4.5:1 — recomputed on every run", () => {
    ["quote-accent", "quote-accent-hover", "quote-wa", "quote-wa-hover"].forEach((name) => {
      const ratio = contrastRatio(token(name), "FFFFFF");
      expect(ratio, `${name} vs white text`).toBeGreaterThanOrEqual(4.5);
    });
  });

  it("the bright teal is never used as a fill behind white text — it only passes the 3:1 non-text bar", () => {
    const soft = token("quote-accent-soft");
    expect(contrastRatio(soft, "FFFFFF")).toBeLessThan(4.5); // this is WHY it is not a button
    expect(contrastRatio(soft, "FFFFFF")).toBeGreaterThanOrEqual(3); // still fine for borders/icons
    // ...and it must not appear as a background with white text anywhere.
    expect(modalSrc).not.toMatch(/bg-quote-accent-soft[^"]*text-white/);
    expect(confirmSrc).not.toMatch(/bg-quote-accent-soft[^"]*text-white/);
  });

  it("dark text on the pale wash clears AAA", () => {
    expect(contrastRatio(token("quote-ink"), token("quote-wash"))).toBeGreaterThanOrEqual(7);
  });

  it("the WhatsApp brand green is deliberately not used raw — it cannot carry white text", () => {
    expect(contrastRatio("25D366", "FFFFFF")).toBeLessThan(4.5);
    expect(modalSrc).not.toContain("#25D366");
    expect(confirmSrc).not.toContain("#25D366");
  });
});

describe("Phone validation", () => {
  it("rejects the placeholders people actually type", () => {
    ["0000000000", "1111111111", "1234567890", "123", ""].forEach((v) => {
      expect(isValidUsPhone(v), v).toBe(false);
    });
  });

  it("accepts real US numbers, with or without the country code and punctuation", () => {
    ["7867937665", "(786) 793-7665", "786-793-7665", "+1 786 793 7665", "17867937665"].forEach((v) => {
      expect(isValidUsPhone(v), v).toBe(true);
    });
  });

  it("formats progressively as the visitor types, without ever fighting the caret", () => {
    expect(formatPhone("7")).toBe("(7");
    expect(formatPhone("786")).toBe("(786");
    expect(formatPhone("78679")).toBe("(786) 79");
    expect(formatPhone("7867937665")).toBe("(786) 793-7665");
    expect(formatPhone("")).toBe("");
  });

  it("the error is held back until the field is left, never shown mid-typing", () => {
    expect(modalSrc).toContain("const phoneInvalid = phoneTouched &&");
    expect(modalSrc).toContain("onBlur={onPhoneBlur}");
  });
});

describe("The confirmation screen never claims the request was sent", () => {
  const forbidden = [
    /request sent/i, /\bsent!/i, /solicitud enviada/i, /\benviada\b/i, /message sent/i, /mensaje enviado/i,
  ];

  it("says 'ready', not 'sent', in both languages", () => {
    expect(translations.en.wizard.confirm.title).toMatch(/ready/i);
    expect(translations.es.wizard.confirm.title).toMatch(/lista/i);
    [translations.en.wizard.confirm, translations.es.wizard.confirm].forEach((tree) => {
      Object.values(tree).forEach((value) => {
        forbidden.forEach((pattern) => expect(value, value).not.toMatch(pattern));
      });
    });
  });

  it("both languages state explicitly that it has NOT been sent yet", () => {
    expect(translations.en.wizard.confirm.body).toMatch(/not been sent/i);
    expect(translations.es.wizard.confirm.body).toMatch(/todav[ií]a no se ha enviado/i);
  });

  it("uses a real <a href> for WhatsApp, never window.open — a link is never popup-blocked", () => {
    expect(confirmSrc).toContain("href={whatsappHref}");
    expect(confirmSrc).toContain('target="_blank"');
    expect(confirmSrc).toContain('rel="noopener noreferrer"');
    // strip doc comments — both files explain in prose *why* they avoid
    // window.open(), which shouldn't trip the check on itself.
    const stripComments = (s) => s.replace(/\/\*\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(stripComments(confirmSrc)).not.toContain("window.open");
    expect(stripComments(modalSrc)).not.toContain("window.open");
  });

  it("consent still gates the CTA, and the error explains what is missing", () => {
    expect(modalSrc).toContain("if (!estimator.answers.policyAccepted) {");
    expect(modalSrc).toContain("setShowPolicyError(true);");
    expect(modalSrc).toContain("policyRef.current?.focus();");
    expect(modalSrc).toContain('t("wizard.policyConsent.error")');
    // Terms and Privacy are still both linked.
    expect(modalSrc).toContain('href="/terms"');
    expect(modalSrc).toContain('href="/privacy"');
  });

  it("email is demoted to a secondary link inside the modal — never a competing CTA on the step", () => {
    expect(modalSrc).not.toContain('t("wizard.sendEmail")');
    expect(confirmSrc).toContain('t("wizard.confirm.emailInstead")');
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
