import { describe, it, expect } from "vitest";
import {
  pushScreen,
  popScreen,
  resetStack,
  currentScreen,
  stackForSearchSelection,
  TOP_SCREEN,
} from "../src/lib/wizardScreenStack.js";

/**
 * Real, executable proof for the wizard's Back-navigation invariant ("never
 * leaves the stepper in a broken state", however Back is triggered — mouse
 * click, tap, or a keyboard Enter/Space on the focused native <button> — see
 * wholesaleWizard.test.js for confirmation every wizard control is a real
 * <button>, which is what makes keyboard activation free/native here with
 * nothing custom to break). This project has no jsdom/@testing-library
 * dependency (see wholesalePortalUi.test.js's header), so these pure
 * functions — the same ones WholesaleWizard.jsx's goTo/goBack/resetToTop
 * delegate to — are exercised directly instead of through a rendered DOM.
 */

describe("wizardScreenStack: resetStack/currentScreen", () => {
  it("resetStack always starts at exactly [TOP_SCREEN]", () => {
    expect(resetStack()).toEqual([TOP_SCREEN]);
  });

  it("currentScreen reads the top of the stack, not the bottom", () => {
    expect(currentScreen(["top", "model", "fault"])).toBe("fault");
    expect(currentScreen(["top"])).toBe("top");
  });
});

describe("wizardScreenStack: popScreen never underflows, no matter how it's driven", () => {
  it("pops one screen off a multi-entry stack", () => {
    expect(popScreen(["top", "model"])).toEqual(["top"]);
    expect(popScreen(["top", "model", "fault"])).toEqual(["top", "model"]);
  });

  it("a single-entry stack is a floor — popping it is a no-op, never an empty array", () => {
    expect(popScreen(["top"])).toEqual(["top"]);
  });

  it("repeated/rapid Back presses (double-click, held Enter, fast repeat-tap) settle at the floor and stay there — never negative, never undefined", () => {
    let stack = ["top", "model", "fault"];
    for (let i = 0; i < 10; i++) {
      stack = popScreen(stack);
    }
    expect(stack).toEqual(["top"]);
    expect(currentScreen(stack)).toBe("top");
  });

  it("pop is a pure function — the input array is never mutated in place", () => {
    const original = ["top", "model", "fault"];
    const originalCopy = [...original];
    popScreen(original);
    expect(original).toEqual(originalCopy);
  });
});

describe("wizardScreenStack: pushScreen/popScreen round-trip preserves order and history", () => {
  it("push then pop returns to the exact prior stack, at every depth", () => {
    let stack = resetStack();
    stack = pushScreen(stack, "model");
    stack = pushScreen(stack, "fault");
    stack = pushScreen(stack, "progress");
    stack = pushScreen(stack, "result");
    expect(stack).toEqual(["top", "model", "fault", "progress", "result"]);

    stack = popScreen(stack);
    expect(currentScreen(stack)).toBe("progress");
    stack = popScreen(stack);
    expect(currentScreen(stack)).toBe("fault");
    stack = popScreen(stack);
    expect(currentScreen(stack)).toBe("model");
    stack = popScreen(stack);
    expect(currentScreen(stack)).toBe("top");
    // one more pop at the floor — still top, not an error
    stack = popScreen(stack);
    expect(stack).toEqual(["top"]);
  });

  it("the 1-model auto-skip path (Equipo -> straight to Falla) pushes exactly one entry, so a single Back from Falla returns to Equipo, never to a phantom Modelo screen", () => {
    let stack = resetStack();
    stack = pushScreen(stack, "fault"); // handleSelectEquipo's equipo.models.length === 1 branch
    expect(stack).toEqual(["top", "fault"]);
    stack = popScreen(stack);
    expect(currentScreen(stack)).toBe("top");
  });

  it("push never mutates the array it was given (React state updater safety)", () => {
    const original = ["top"];
    const originalCopy = [...original];
    pushScreen(original, "model");
    expect(original).toEqual(originalCopy);
  });
});

describe("stackForSearchSelection: Live Search hydration rebuilds real history, never a bare jump to progress/result", () => {
  it("a multi-model Equipo gets the full 4-entry history (top -> model -> fault -> progress), same as a manual click-through would have produced", () => {
    const equipo = { models: [{ id: "m1" }, { id: "m2" }] };
    expect(stackForSearchSelection(equipo)).toEqual(["top", "model", "fault", "progress"]);
  });

  it("a 1-model Equipo (including a direct_services card like Microsoldering, which always has exactly 1 internal model) skips straight to fault, same as handleSelectEquipo's own auto-skip branch", () => {
    const equipo = { models: [{ id: "only" }] };
    expect(stackForSearchSelection(equipo)).toEqual(["top", "fault", "progress"]);
  });

  it("Back from the resulting stack always lands somewhere real — popping once from either shape never produces an empty/invalid screen", () => {
    const multiModel = stackForSearchSelection({ models: [{ id: "m1" }, { id: "m2" }] });
    expect(currentScreen(popScreen(multiModel))).toBe("fault");
    const singleModel = stackForSearchSelection({ models: [{ id: "only" }] });
    expect(currentScreen(popScreen(singleModel))).toBe("fault");
  });
});
