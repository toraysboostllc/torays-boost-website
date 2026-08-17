import { describe, it, expect } from "vitest";
import { buildInitialAnswers } from "../src/hooks/useRepairRequest.js";
import { LOCAL_SEO_PAGES } from "../src/config/localSeo.config.js";

describe("buildInitialAnswers: validates wizard preselection against the real catalog", () => {
  it("no selection passed — behaves exactly like the normal blank start (Home's own call site)", () => {
    const answers = buildInitialAnswers(undefined);
    expect(answers.categoryId).toBe("");
    expect(answers.problemId).toBe("");
    expect(answers.name).toBe("");
    expect(answers.policyAccepted).toBe(false);
  });

  it("valid categoryId only (Phone Repair page) — sets categoryId, leaves problemId blank", () => {
    const answers = buildInitialAnswers({ categoryId: "iphone" });
    expect(answers.categoryId).toBe("iphone");
    expect(answers.problemId).toBe("");
  });

  it("valid categoryId (PS5 Repair page)", () => {
    const answers = buildInitialAnswers({ categoryId: "ps5" });
    expect(answers.categoryId).toBe("ps5");
    expect(answers.problemId).toBe("");
  });

  it("valid categoryId + valid problemId for that group (PS5 Controller page: controllers + stick-drift)", () => {
    const answers = buildInitialAnswers({ categoryId: "controllers", problemId: "stick-drift" });
    expect(answers.categoryId).toBe("controllers");
    expect(answers.problemId).toBe("stick-drift");
  });

  it("unknown/typo'd categoryId falls back to blank instead of rendering a broken step", () => {
    const answers = buildInitialAnswers({ categoryId: "not-a-real-category" });
    expect(answers.categoryId).toBe("");
    expect(answers.problemId).toBe("");
  });

  it("problemId that doesn't belong to the resolved category's group is dropped, category is kept", () => {
    // "stick-drift" is a controller problem — passing it with a phone
    // category must not leak into the phone wizard's problem step.
    const answers = buildInitialAnswers({ categoryId: "iphone", problemId: "stick-drift" });
    expect(answers.categoryId).toBe("iphone");
    expect(answers.problemId).toBe("");
  });

  it("problemId without a categoryId is never applied on its own", () => {
    const answers = buildInitialAnswers({ problemId: "stick-drift" });
    expect(answers.categoryId).toBe("");
    expect(answers.problemId).toBe("");
  });

  it("contact fields and consent are never pre-filled by a selection — only device/problem", () => {
    const answers = buildInitialAnswers({ categoryId: "ps5" });
    expect(answers.name).toBe("");
    expect(answers.phone).toBe("");
    expect(answers.email).toBe("");
    expect(answers.policyAccepted).toBe(false);
    expect(answers.smartAnswers).toEqual({});
  });
});

describe("localSeo.config.js: every page's wizardSelection is real and already validated", () => {
  Object.entries(LOCAL_SEO_PAGES).forEach(([pageKey, page]) => {
    it(`${pageKey}'s wizardSelection round-trips unchanged through buildInitialAnswers (proves the ids are real)`, () => {
      const answers = buildInitialAnswers(page.wizardSelection);
      expect(answers.categoryId).toBe(page.wizardSelection.categoryId);
      expect(answers.problemId).toBe(page.wizardSelection.problemId || "");
    });
  });
});
