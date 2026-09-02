import { useMemo, useState } from "react";
import { PROBLEMS_BY_GROUP, SMART_QUESTIONS_BY_GROUP, getCategoryById } from "../config/repairRequest.config.js";
import {
  DEVICE_TYPES,
  getCategoryChoices,
  getDeviceTypeForCategory,
  getImpliedAnswers,
  getModelChips,
  getVisibleQuestions,
} from "../config/repairFlow.config.js";
import { isValidUsPhone } from "../lib/phone.js";

export const TOTAL_STEPS = 4;
const STEP = {
  DEVICE: 0,
  MODEL: 1,
  ISSUE: 2,
  CONTACT: 3,
};

const initialAnswers = {
  // Step 1 picks a device *type* (the catalog's own `group`); Step 2 resolves
  // it back down to a real categoryId. Both are kept: the type drives what
  // Step 2 offers, the category is what everything downstream already expects.
  deviceTypeId: "",
  categoryId: "",
  brandId: "",
  customBrandName: "",
  model: "",
  modelNotSure: false,
  problemId: "",
  // Manual answers ONLY. What a chosen problem answers for the visitor lives
  // in the catalog's IMPLIED_ANSWERS and is merged on read (see
  // resolvedSmartAnswers below), never written into state — so changing the
  // problem can never leave a stale inferred answer behind, and a manual
  // answer survives a detour through a problem that would have implied it.
  smartAnswers: {},
  name: "",
  phone: "",
  email: "",
  details: "",
  // Policy-consent checkbox, now on the final step. Always starts unchecked
  // and resets to false whenever the wizard is reopened fresh.
  policyAccepted: false,
};

/**
 * Validates an optional `{ categoryId, problemId }` preselection (used by the
 * local SEO landing pages) against the real catalog, and additionally resolves
 * the device type the category belongs to, so the 4-step wizard opens with
 * Step 1 already showing the right tile. A stale/typo'd id still falls back to
 * a blank start rather than rendering a broken step — but
 * repairRequestPreselection.test.js now fails loudly if any of the six real
 * pages ever stops resolving, which is the check that did not exist before.
 */
export function buildInitialAnswers(initialSelection) {
  if (!initialSelection) return initialAnswers;
  const category = initialSelection.categoryId ? getCategoryById(initialSelection.categoryId) : null;
  const categoryId = category ? category.id : "";
  const deviceType = categoryId ? getDeviceTypeForCategory(categoryId) : null;
  const groupProblems = category ? PROBLEMS_BY_GROUP[category.group] || [] : [];
  const problemId =
    categoryId && initialSelection.problemId && groupProblems.some((p) => p.id === initialSelection.problemId)
      ? initialSelection.problemId
      : "";
  return { ...initialAnswers, deviceTypeId: deviceType ? deviceType.id : "", categoryId, problemId };
}

/**
 * Drives the 4-step public quote wizard: device type, brand+model,
 * issue+diagnostic questions, contact details. No price and no ETA anywhere
 * in this state or its derived data — see repairRequest.config.js.
 *
 * Step index and answers are two separate pieces of state on purpose:
 * navigating Back/Next never clears anything the visitor already typed.
 */
export function useRepairRequest(initialSelection) {
  const [step, setStep] = useState(STEP.DEVICE);
  const [answers, setAnswers] = useState(() => buildInitialAnswers(initialSelection));

  const category = useMemo(() => getCategoryById(answers.categoryId), [answers.categoryId]);
  const group = category?.group || null;
  const categoryChoices = useMemo(() => getCategoryChoices(answers.deviceTypeId), [answers.deviceTypeId]);
  // A type with a single category (Controller, Data Recovery) has nothing to
  // choose — Step 2 goes straight to the model field.
  const needsCategoryChoice = categoryChoices.length > 1;
  const brands = category?.brands || null;
  const brand = brands?.find((b) => b.id === answers.brandId) || null;
  const modelChips = useMemo(() => getModelChips(answers.categoryId), [answers.categoryId]);
  const problems = useMemo(() => PROBLEMS_BY_GROUP[group] || [], [group]);
  const problem = problems.find((p) => p.id === answers.problemId) || null;
  const smartQuestions = useMemo(() => SMART_QUESTIONS_BY_GROUP[group] || [], [group]);

  const impliedAnswers = useMemo(
    () => getImpliedAnswers(group, answers.problemId),
    [group, answers.problemId],
  );
  const visibleQuestions = useMemo(
    () => getVisibleQuestions(group, answers.problemId),
    [group, answers.problemId],
  );
  /** What the message and the summary read: manual answers plus whatever the
   *  chosen problem already answered. Implied always wins. */
  const resolvedSmartAnswers = useMemo(
    () => ({ ...answers.smartAnswers, ...impliedAnswers }),
    [answers.smartAnswers, impliedAnswers],
  );
  /** The exact shape repairRequestMessage.js expects — unchanged on purpose. */
  const answersForMessage = useMemo(
    () => ({ ...answers, smartAnswers: resolvedSmartAnswers }),
    [answers, resolvedSmartAnswers],
  );

  function selectDeviceType(deviceTypeId) {
    setAnswers((prev) => {
      if (prev.deviceTypeId === deviceTypeId) return prev;
      const choices = getCategoryChoices(deviceTypeId);
      return {
        ...prev,
        deviceTypeId,
        // A single-category type resolves immediately; anything else waits for
        // Step 2. Everything tied to the old type's option lists is cleared —
        // never the contact fields.
        categoryId: choices.length === 1 ? choices[0].id : "",
        brandId: "",
        customBrandName: "",
        model: "",
        modelNotSure: false,
        problemId: "",
        smartAnswers: {},
      };
    });
  }

  function selectCategory(categoryId) {
    setAnswers((prev) => {
      if (prev.categoryId === categoryId) return prev;
      return {
        ...prev,
        categoryId,
        // Sibling categories inside one type can have different brand lists and
        // model chips, so those reset; the problem list is shared by the group,
        // so the problem and its answers survive.
        brandId: "",
        customBrandName: "",
        model: "",
        modelNotSure: false,
      };
    });
  }

  function selectBrand(brandId) {
    setAnswers((prev) => ({
      ...prev,
      brandId,
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
    setAnswers((prev) => (prev.problemId === problemId ? prev : { ...prev, problemId }));
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

  const modelAnswered = Boolean(answers.model.trim()) || answers.modelNotSure;

  /** The final CTA's own gate. The consent checkbox is checked separately on
   *  click so the visitor gets an explanation instead of a dead button. */
  const canSubmit = Boolean(answers.name.trim()) && isValidUsPhone(answers.phone);

  const canGoNext = (() => {
    if (step === STEP.DEVICE) return Boolean(answers.deviceTypeId);
    if (step === STEP.MODEL) {
      if (!answers.categoryId) return false;
      if (brands) {
        if (!answers.brandId) return false;
        if (answers.brandId === "other" && !answers.customBrandName.trim()) return false;
      }
      return modelAnswered;
    }
    if (step === STEP.ISSUE) {
      if (!answers.problemId) return false;
      return visibleQuestions.every((q) => Boolean(answers.smartAnswers[q.id]));
    }
    return canSubmit;
  })();

  return {
    STEP,
    TOTAL_STEPS,
    step,
    answers,
    answersForMessage,
    category,
    categoryChoices,
    needsCategoryChoice,
    group,
    brands,
    brand,
    modelChips,
    problems,
    problem,
    smartQuestions,
    visibleQuestions,
    impliedAnswers,
    resolvedSmartAnswers,
    canGoNext,
    canSubmit,
    selectDeviceType,
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
    deviceTypes: DEVICE_TYPES,
  };
}
