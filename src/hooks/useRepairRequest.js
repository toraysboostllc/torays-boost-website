import { useMemo, useState } from "react";
import { DEVICE_CATEGORIES, PROBLEMS_BY_GROUP, SMART_QUESTIONS_BY_GROUP, getCategoryById } from "../config/repairRequest.config.js";

export const TOTAL_STEPS = 8;
const STEP = {
  DEVICE: 0,
  MODEL: 1,
  PROBLEM: 2,
  SMART_1: 3,
  SMART_2: 4,
  SMART_3: 5,
  CONTACT: 6,
  REVIEW: 7,
};

const initialAnswers = {
  categoryId: "",
  brandId: "",
  customBrandName: "",
  model: "",
  modelNotSure: false,
  problemId: "",
  smartAnswers: {},
  name: "",
  phone: "",
  email: "",
  details: "",
  // Policy-consent checkbox on the Review step — always starts unchecked,
  // persists across Back/Next like every other answer, and resets to
  // false whenever the wizard is reopened fresh (see `reset` below).
  policyAccepted: false,
};

/**
 * Validates an optional `{ categoryId, problemId }` preselection (used by
 * the local SEO landing pages to open the wizard with a device already
 * picked) against the real catalog, so a stale/typo'd id can never render
 * a broken step instead of silently falling back to the normal blank
 * start. `problemId` only survives if it belongs to the resolved
 * category's own device group — e.g. passing a controller problem with a
 * phone category id drops the problem, not the category.
 */
export function buildInitialAnswers(initialSelection) {
  if (!initialSelection) return initialAnswers;
  const category = initialSelection.categoryId ? getCategoryById(initialSelection.categoryId) : null;
  const categoryId = category ? category.id : "";
  const groupProblems = category ? PROBLEMS_BY_GROUP[category.group] || [] : [];
  const problemId =
    categoryId && initialSelection.problemId && groupProblems.some((p) => p.id === initialSelection.problemId)
      ? initialSelection.problemId
      : "";
  return { ...initialAnswers, categoryId, problemId };
}

/**
 * Drives the 8-step public Smart Repair Request wizard. No price, no ETA
 * anywhere in this state or its derived data — see repairRequest.config.js.
 * Step index and answers are two separate pieces of state on purpose:
 * navigating Back/Next never clears anything the visitor already typed
 * ("estado preservado al regresar").
 *
 * `initialSelection` (optional) pre-fills the device/problem answers — the
 * wizard still opens on Step 1 (Device) so the visitor sees what's already
 * selected and can change it normally, rather than jumping ahead. Since
 * RepairRequestModal only ever mounts while open (see Home.jsx and the
 * local SEO pages), this `useState` initializer runs fresh on every open —
 * no selection from a previous request can ever leak into the next one.
 */
export function useRepairRequest(initialSelection) {
  const [step, setStep] = useState(STEP.DEVICE);
  const [answers, setAnswers] = useState(() => buildInitialAnswers(initialSelection));

  const category = useMemo(() => getCategoryById(answers.categoryId), [answers.categoryId]);
  const group = category?.group || null;
  const brands = category?.brands || null;
  const brand = brands?.find((b) => b.id === answers.brandId) || null;
  const problems = useMemo(() => PROBLEMS_BY_GROUP[group] || [], [group]);
  const problem = problems.find((p) => p.id === answers.problemId) || null;
  const smartQuestions = useMemo(() => SMART_QUESTIONS_BY_GROUP[group] || [], [group]);

  function selectCategory(categoryId) {
    setAnswers((prev) => {
      const nextCategory = getCategoryById(categoryId);
      const groupChanged = nextCategory?.group !== getCategoryById(prev.categoryId)?.group;
      return {
        ...prev,
        categoryId,
        // A different device group invalidates brand/model/problem/smart
        // answers tied to the old group's option lists — reset only those,
        // never the contact fields (name/phone/email/details persist).
        ...(groupChanged
          ? { brandId: "", customBrandName: "", model: "", modelNotSure: false, problemId: "", smartAnswers: {} }
          : {}),
      };
    });
  }

  function selectBrand(brandId) {
    setAnswers((prev) => ({
      ...prev,
      brandId,
      // Only "Other" needs a custom brand name — switching away from it
      // clears that field since it's no longer shown; the typed exact
      // model is kept (the visitor may just be correcting a mis-click,
      // not starting the model over).
      ...(prev.brandId === "other" && brandId !== "other" ? { customBrandName: "" } : {}),
    }));
  }

  function setCustomBrandName(customBrandName) {
    setAnswers((prev) => ({ ...prev, customBrandName }));
  }

  function setModel(model) {
    setAnswers((prev) => ({ ...prev, model, modelNotSure: false }));
  }

  function setModelNotSure(modelNotSure) {
    setAnswers((prev) => ({ ...prev, modelNotSure, model: modelNotSure ? "" : prev.model }));
  }

  function selectProblem(problemId) {
    setAnswers((prev) => ({ ...prev, problemId }));
  }

  function answerSmartQuestion(questionId, value) {
    setAnswers((prev) => ({ ...prev, smartAnswers: { ...prev.smartAnswers, [questionId]: value } }));
  }

  function setField(field, value) {
    setAnswers((prev) => ({ ...prev, [field]: value }));
  }

  function editStep(targetStep) {
    setStep(targetStep);
  }

  function goNext() {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function reset() {
    setStep(STEP.DEVICE);
    setAnswers(initialAnswers);
  }

  const smartQuestionForStep = (s) => smartQuestions[s - STEP.SMART_1] || null;

  const canGoNext = (() => {
    if (step === STEP.DEVICE) return Boolean(answers.categoryId);
    if (step === STEP.MODEL) {
      if (brands) {
        if (!answers.brandId) return false;
        if (answers.brandId === "other") {
          return Boolean(answers.customBrandName.trim()) && Boolean(answers.model.trim());
        }
        return Boolean(answers.model.trim());
      }
      return Boolean(answers.model.trim()) || answers.modelNotSure;
    }
    if (step === STEP.PROBLEM) return Boolean(answers.problemId);
    if (step === STEP.SMART_1 || step === STEP.SMART_2 || step === STEP.SMART_3) {
      const question = smartQuestionForStep(step);
      return question ? Boolean(answers.smartAnswers[question.id]) : true;
    }
    if (step === STEP.CONTACT) return Boolean(answers.name.trim()) && Boolean(answers.phone.trim());
    return true;
  })();

  return {
    STEP,
    TOTAL_STEPS,
    step,
    answers,
    category,
    group,
    brands,
    brand,
    problems,
    problem,
    smartQuestions,
    smartQuestionForStep,
    canGoNext,
    selectCategory,
    selectBrand,
    setCustomBrandName,
    setModel,
    setModelNotSure,
    selectProblem,
    answerSmartQuestion,
    setField,
    editStep,
    goNext,
    goBack,
    reset,
    devices: DEVICE_CATEGORIES,
  };
}
