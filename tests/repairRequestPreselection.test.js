import { describe, it, expect } from "vitest";
import { LOCAL_SEO_PAGES } from "../src/config/localSeo.config.js";
import { buildInitialAnswers } from "../src/hooks/useRepairRequest.js";
import { getCategoryById, PROBLEMS_BY_GROUP } from "../src/config/repairRequest.config.js";
import { getDeviceTypeForCategory } from "../src/config/repairFlow.config.js";

/**
 * The check that did not exist before this round.
 *
 * The local SEO pages open the wizard with a device (and sometimes a problem)
 * already chosen. buildInitialAnswers() validates that selection against the
 * catalog and falls back to a blank start if an id has gone stale — correct in
 * production, but it means a broken preselection produces NO error, just a
 * wizard that quietly stops preselecting. This file is what turns that silent
 * degradation into a red test.
 */

const pages = Object.values(LOCAL_SEO_PAGES ?? {});

describe("Local SEO pages: every preselection still resolves", () => {
  it("there are pages configured to check", () => {
    expect(pages.length).toBeGreaterThanOrEqual(6);
  });

  it("every page that carries a wizardSelection resolves to a real category AND a real device type", () => {
    const withSelection = pages.filter((p) => p.wizardSelection);
    expect(withSelection.length).toBeGreaterThanOrEqual(6);

    withSelection.forEach((page) => {
      const { categoryId, problemId } = page.wizardSelection;
      const label = page.path || page.slug || categoryId;

      // the id the page ships must still exist in the catalog
      expect(getCategoryById(categoryId), `${label}: categoryId "${categoryId}" no longer exists`).toBeTruthy();

      const answers = buildInitialAnswers(page.wizardSelection);
      expect(answers.categoryId, `${label}: category was dropped`).toBe(categoryId);
      expect(answers.deviceTypeId, `${label}: device type did not resolve`).toBeTruthy();
      expect(answers.deviceTypeId).toBe(getDeviceTypeForCategory(categoryId).id);

      if (problemId) {
        expect(answers.problemId, `${label}: problem "${problemId}" was dropped`).toBe(problemId);
      }
    });
  });

  it("a preselected problem always belongs to its own category's group", () => {
    pages.filter((p) => p.wizardSelection?.problemId).forEach((page) => {
      const { categoryId, problemId } = page.wizardSelection;
      const group = getCategoryById(categoryId).group;
      const ids = (PROBLEMS_BY_GROUP[group] || []).map((p) => p.id);
      expect(ids, `${page.path}: ${problemId} is not a ${group} problem`).toContain(problemId);
    });
  });

  it("the wizard still opens on step 1 — a preselection shows the choice, it never skips ahead", () => {
    const answers = buildInitialAnswers({ categoryId: "ps5" });
    expect(answers.deviceTypeId).toBe("console");
    expect(answers.categoryId).toBe("ps5");
    // nothing beyond the device is filled in
    expect(answers.model).toBe("");
    expect(answers.name).toBe("");
    expect(answers.policyAccepted).toBe(false);
  });

  it("a stale or typo'd id still degrades safely instead of throwing", () => {
    expect(buildInitialAnswers({ categoryId: "not-a-real-id" }).categoryId).toBe("");
    expect(buildInitialAnswers({ categoryId: "not-a-real-id" }).deviceTypeId).toBe("");
    // a problem from the wrong group is dropped, the category survives
    const mismatched = buildInitialAnswers({ categoryId: "iphone", problemId: "stick-drift" });
    expect(mismatched.categoryId).toBe("iphone");
    expect(mismatched.problemId).toBe("");
    expect(buildInitialAnswers(null).categoryId).toBe("");
  });

  it("the six known pages resolve to the expected type", () => {
    const expected = {
      iphone: "phone",
      ipad: "tablet",
      ps5: "console",
      xbox: "console",
      controllers: "controller",
    };
    pages.filter((p) => p.wizardSelection).forEach((page) => {
      const { categoryId } = page.wizardSelection;
      if (expected[categoryId]) {
        expect(buildInitialAnswers(page.wizardSelection).deviceTypeId).toBe(expected[categoryId]);
      }
    });
  });
});
