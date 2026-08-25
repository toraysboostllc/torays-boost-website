/**
 * Pure screen-stack reducer for WholesaleWizard's Equipo -> Modelo -> Falla
 * navigation. Extracted out of the component so the Back-navigation
 * invariant ("never leaves the stepper in a broken state" — no matter how
 * many times Back is pressed, no matter how fast) has a real, executable
 * proof (see tests/wizardScreenStack.test.js) instead of only a text/regex
 * assertion over the component source. WholesaleWizard.jsx's goTo/goBack/
 * resetToTop are thin wrappers around these three functions — this file has
 * zero React/DOM dependency, so it needs no jsdom/@testing-library, matching
 * every other test file's existing constraint in this project.
 */

export const TOP_SCREEN = "top";

export function pushScreen(stack, next) {
  return [...stack, next];
}

// The floor: a stack of ["top"] never pops further, no matter how many
// times this is called (double-click, held Enter, fast repeat-tap) — never
// an empty stack, never a negative/undefined "current screen".
export function popScreen(stack) {
  return stack.length > 1 ? stack.slice(0, -1) : stack;
}

export function resetStack() {
  return [TOP_SCREEN];
}

export function currentScreen(stack) {
  return stack[stack.length - 1];
}

/** The screen stack Live Search hydration (WholesaleWizard.jsx's
 *  handleSelectSearchResult) rebuilds to, given the real Equipo a search
 *  result belongs to — matching exactly what a manual Equipo->Modelo->
 *  Falla click-through would have produced for that same Equipo (see
 *  handleSelectEquipo's own identical `models.length === 1` branch), never
 *  a shortcut straight into "progress"/"result" with no history. This is
 *  what makes Back still land somewhere sensible after a search selection,
 *  and what makes a direct_services card (always exactly 1 internal model
 *  — e.g. Microsoldering) naturally skip the "model" entry here too, with
 *  no special case beyond the same models.length check every other path
 *  already uses. */
export function stackForSearchSelection(equipo) {
  return equipo.models.length === 1 ? ["top", "fault", "progress"] : ["top", "model", "fault", "progress"];
}

/** Easy Search's hydration target — used by
 *  WholesaleWizard.jsx's handleSelectEasySearchResult. Unlike Live Search
 *  (stackForSearchSelection above), Easy Search only ever resolves an
 *  Equipo + Model (never a specific Failure/Service — see
 *  api/wholesale-easy-search.js's own header on why it never returns
 *  pricing), so it always lands on "fault" (the Model -> Failure/Service
 *  step) with the model screen skipped — exactly what handleSelectModel
 *  already produces once an Equipo is set, just reached directly instead
 *  of via a manual click. Never "progress"/"result": those require a
 *  selectedService, which Easy Search deliberately never sets. */
export function stackForEasySearchSelection() {
  return ["top", "fault"];
}
