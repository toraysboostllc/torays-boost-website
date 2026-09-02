/**
 * Flow layer for the 4-step public quote wizard.
 *
 * This file exists so repairRequest.config.js — the approved catalog — never
 * has to change. Everything here is *derived from* or *keyed by* the ids that
 * already live there: no id is renamed, invented, or duplicated. If a category,
 * problem or question id ever stops existing, repairFlowMapping.test.js fails
 * loudly instead of the wizard silently rendering a broken step.
 *
 * Three things live here:
 *  1. DEVICE_TYPES — the six tiles of Step 1. They are the catalog's own
 *     `group` values, surfaced for the first time; the visitor picks a group,
 *     Step 2 resolves it back down to a real categoryId.
 *  2. MODEL_CHIPS — "popular model" shortcuts, taken from the shop's real
 *     repair history (see the header comment on MODEL_CHIPS). Free text
 *     everywhere the history didn't support a list.
 *  3. IMPLIED_ANSWERS — the 13 approved rules that let a chosen problem answer
 *     a diagnostic question so the visitor is never asked it twice.
 */
import {
  DEVICE_CATEGORIES,
  PROBLEMS_BY_GROUP,
  SMART_QUESTIONS_BY_GROUP,
  getCategoryById,
} from "./repairRequest.config.js";

/**
 * The six Step-1 tiles, in the order each group first appears in
 * DEVICE_CATEGORIES — which is already the approved order (Smartphone,
 * Tablet, Console, Controller, Laptop/MacBook, Data Recovery). Derived
 * rather than hand-listed so a catalog edit can never leave the two out
 * of sync.
 */
export const DEVICE_TYPES = DEVICE_CATEGORIES.reduce((types, category) => {
  const existing = types.find((t) => t.id === category.group);
  if (existing) existing.categoryIds.push(category.id);
  else types.push({ id: category.group, categoryIds: [category.id] });
  return types;
}, []);

export function getDeviceTypeById(typeId) {
  return DEVICE_TYPES.find((t) => t.id === typeId) || null;
}

/** The device type a categoryId belongs to — the bridge the SEO pages need. */
export function getDeviceTypeForCategory(categoryId) {
  const category = getCategoryById(categoryId);
  return category ? getDeviceTypeById(category.group) : null;
}

/**
 * The categories a device type offers in Step 2. A type with a single
 * category (Controller, Data Recovery) resolves straight through — the
 * wizard shows no choice row for it at all.
 */
export function getCategoryChoices(typeId) {
  const type = getDeviceTypeById(typeId);
  if (!type) return [];
  return type.categoryIds.map((id) => getCategoryById(id)).filter(Boolean);
}

/**
 * Popular-model shortcuts, ranked by the shop's own repair history
 * (191 repairs, 2026-07-16 → 2026-09-01, exported from TORAYS BOOST DESK).
 * Deliberately NOT a full model catalog: a category only gets chips where
 * the history actually supported the ranking, and every chip list is
 * followed in the UI by "Other model" and "Not sure".
 *
 *   iphone  8 chips — 84 repairs across 29 models; top 8 = 60.7%
 *   ps5     4 chips — 43 repairs; these four are the entire PS5 line-up
 *   ipad    4 chips — 26 repairs, but only these four had more than one
 *   xbox    3 chips — 6 repairs; these three are all that ever came in
 *
 * macbook, smartphones-other, tablets-other, laptops-other, controllers and
 * data-recovery are free text on purpose: the history was too thin to rank
 * models (MacBook: 8 repairs across 7 models) or a real list would need
 * brands the catalog does not define.
 */
export const MODEL_CHIPS = {
  iphone: [
    "iPhone 16 Pro Max",
    "iPhone 13 Pro Max",
    "iPhone 14 Pro Max",
    "iPhone 15 Plus",
    "iPhone 15 Pro Max",
    "iPhone 13",
    "iPhone 12 Pro Max",
    "iPhone 14 Pro",
  ],
  ipad: ["iPad (10th gen)", "iPad (9th gen)", "iPad Air (5th gen)", 'iPad Pro 11" (3rd gen)'],
  ps5: ["PS5", "PS5 Slim", "PS5 Pro", "PS5 Slim Digital"],
  xbox: ["Xbox Series X", "Xbox One", "Xbox Series S"],
};

export function getModelChips(categoryId) {
  return MODEL_CHIPS[categoryId] || null;
}

/**
 * The 13 approved rules. Shape: group -> problemId -> { questionId: answerId }.
 *
 * A rule only ever encodes what the chosen problem states *directly*: picking
 * "Broken Screen" is the visitor saying the screen is cracked. Second-degree
 * inference is deliberately excluded — an earlier draft also concluded "a
 * console that won't power on shows no image", which is true but is our
 * conclusion rather than the visitor's, and it was vetoed. Every rule below
 * fills exactly one answer, so no route ever drops below two visible
 * questions.
 *
 * `stick-drift` is deliberately absent: drift existing says nothing about
 * whether it is constant or intermittent, and that difference changes the
 * diagnosis.
 *
 * Implied answers are written into answers.smartAnswers like any other, so
 * the WhatsApp/email message still carries all three questions with all
 * three answers — the technician receives exactly what they receive today.
 */
export const IMPLIED_ANSWERS = {
  phone: {
    "broken-screen": { "front-screen-cracked": "yes" },
    "back-glass": { "back-glass-cracked": "yes" },
    "water-damage": { "liquid-damage": "yes" },
  },
  tablet: {
    "broken-screen": { "screen-cracked": "yes" },
    "water-damage": { "liquid-damage": "yes" },
  },
  console: {
    "hdmi-no-image": { "displays-image": "no" },
    "no-power": { "powers-on": "no" },
    "liquid-damage": { "liquid-or-physical-damage": "yes" },
  },
  controller: {
    "no-power": { "powers-on-and-connects": "no" },
    "physical-liquid-damage": { "dropped-or-liquid": "yes" },
  },
  laptop: {
    "no-power": { "powers-on": "no" },
    "broken-screen": { "screen-cracked": "yes" },
    "liquid-damage": { "liquid-damage": "yes" },
  },
};

/** What the chosen problem already answers. Empty object when it answers nothing. */
export function getImpliedAnswers(group, problemId) {
  if (!group || !problemId) return {};
  return IMPLIED_ANSWERS[group]?.[problemId] || {};
}

/**
 * The questions Step 3 still has to ask. Always
 * `visible.length + Object.keys(implied).length === 3`.
 */
export function getVisibleQuestions(group, problemId) {
  const questions = SMART_QUESTIONS_BY_GROUP[group] || [];
  if (!problemId) return [];
  const implied = getImpliedAnswers(group, problemId);
  return questions.filter((q) => !(q.id in implied));
}

/** Every (group, problemId) pair the catalog can produce — used by the tests. */
export function allProblemGroupPairs() {
  return Object.entries(PROBLEMS_BY_GROUP).flatMap(([group, problems]) =>
    problems.map((problem) => ({ group, problemId: problem.id })),
  );
}
