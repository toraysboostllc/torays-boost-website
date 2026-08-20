import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { wholesaleTranslations } from "../src/i18n/wholesaleTranslations.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const modalSrc = readFileSync(join(root, "src/components/wholesale/WholesaleLegalAcceptModal.jsx"), "utf8");
const pricesSrc = readFileSync(join(root, "src/pages/WholesalePrices.jsx"), "utf8");
// This file's own JSDoc header legitimately explains, in prose, several of
// the exact things the assertions below check are ABSENT from the real
// code ("no skip/continue-without-accepting control", "never a collapsed
// accordion", etc.) — every negative-match assertion in this file runs
// against the comment-stripped source so the explanatory prose can never
// cause its own false failure.
const modalCodeOnly = modalSrc.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Structural guard: the clickwrap modal must offer NO way out other than
 * Logout — no backdrop click-to-dismiss, no Escape-key handler, no visible
 * X/close button, and no "skip"/"continue without accepting" control of any
 * kind. A Shop that does not want to accept can only ever leave via Logout.
 */
describe("WholesaleLegalAcceptModal: no dismiss path other than Logout", () => {
  it("the overlay <div> has no onClick handler (no backdrop-click-to-close)", () => {
    const overlayMatch = modalSrc.match(/<div className="fixed inset-0[\s\S]*?>/)[0];
    expect(overlayMatch).not.toMatch(/onClick/);
  });

  it("no keydown/Escape handler anywhere in the component (no Escape-to-dismiss)", () => {
    expect(modalCodeOnly).not.toMatch(/onKeyDown|keydown|Escape|onKeyUp/i);
  });

  it("no close/X icon or dismiss button of any kind", () => {
    expect(modalCodeOnly).not.toMatch(/<X[\s/]|aria-label="[Cc]lose"|onClose|\bclose\(/);
  });

  it("no skip/continue-without-accepting control", () => {
    expect(modalCodeOnly).not.toMatch(/skip|continue without|later|remind me|dismiss/i);
  });

  it("exactly one <button type=\"submit\"> (Accept) and one plain action button (Logout) — no third control", () => {
    const buttonCount = (modalSrc.match(/<button\b/g) || []).length;
    expect(buttonCount).toBe(2);
  });

  it("the Accept button is disabled until canSubmit, the Logout button is never disabled", () => {
    const acceptButtonBlock = modalSrc.match(/<button type="submit"[\s\S]*?<\/button>/)[0];
    expect(acceptButtonBlock).toContain("disabled={!canSubmit}");

    const logoutButtonBlock = modalSrc.match(/<button\s+type="button"[\s\S]*?onLogout[\s\S]*?<\/button>/)[0];
    expect(logoutButtonBlock).not.toMatch(/disabled/);
  });

  it("onLogout is called directly on click, with no confirmation gate blocking it", () => {
    expect(modalSrc).toContain("{...wholesaleHoverProps(onLogout)}");
  });

  it("canSubmit requires all 5 checkboxes AND both non-empty text fields", () => {
    const canSubmitLine = modalSrc.match(/const canSubmit = [^\n]+/)[0];
    expect(canSubmitLine).toContain("allChecked");
    expect(canSubmitLine).toContain("representativeName.trim().length > 0");
    expect(canSubmitLine).toContain("representativeTitle.trim().length > 0");
  });

  it("all 5 checkboxes start unchecked (INITIAL_CHECKBOXES is all false) — no pre-selection", () => {
    const initialBlock = modalSrc.match(/const INITIAL_CHECKBOXES = \{[\s\S]*?\};/)[0];
    expect(initialBlock.match(/: false/g)?.length).toBe(5);
    expect(initialBlock).not.toMatch(/: true/);
  });

  it("renders exactly 5 checkbox entries, matching the 5 keys the API validates", () => {
    const listBlock = modalSrc.match(/const CHECKBOXES = \[[\s\S]*?\];/)[0];
    for (const key of [
      "confirmsAuthority",
      "acceptsTermsPrivacy",
      "understandsTiersOptional",
      "understandsIndependentPricing",
      "acceptsConfidentiality",
    ]) {
      expect(listBlock).toContain(key);
    }
  });

  it("every document is listed with a plain, always-visible 'Read' link — never inside a collapsed <details>/accordion", () => {
    expect(modalCodeOnly).not.toMatch(/<details|accordion|collapsed|expandedKey/i);
    expect(modalSrc).toContain("legalAccept.readLink");
  });

  it("every 'Read' link opens in a new tab (never navigates away from the in-progress form)", () => {
    const linkBlock = modalSrc.match(/<a\s+href=\{`\/wholesale\/legal#\$\{key\}`\}[\s\S]*?<\/a>/)[0];
    expect(linkBlock).toContain('target="_blank"');
    expect(linkBlock).toContain('rel="noopener noreferrer"');
  });
});

describe("WholesalePrices.jsx: legal_required renders ONLY the modal, passing the real onLogout handler through", () => {
  it("mounts WholesaleLegalAcceptModal with onLogout={handleLogout} — the SAME logout used elsewhere on this page, not a re-implementation", () => {
    const block = pricesSrc.match(/if \(state\.status === "legal_required"\) \{[\s\S]*?\n  \}/)[0];
    expect(block).toContain("<WholesaleLegalAcceptModal");
    expect(block).toContain("onLogout={handleLogout}");
    expect(block).toContain("onAccepted={loadCatalog}");
  });
});

describe("Bilingual checkbox copy: present in both languages, non-empty", () => {
  it("all 5 checkbox translation keys exist and are non-empty in EN and ES", () => {
    const keys = [
      "checkboxAuthority",
      "checkboxTermsPrivacy",
      "checkboxTiersOptional",
      "checkboxIndependentPricing",
      "checkboxConfidentiality",
    ];
    for (const key of keys) {
      expect(typeof wholesaleTranslations.en.legalAccept[key]).toBe("string");
      expect(wholesaleTranslations.en.legalAccept[key].length).toBeGreaterThan(10);
      expect(typeof wholesaleTranslations.es.legalAccept[key]).toBe("string");
      expect(wholesaleTranslations.es.legalAccept[key].length).toBeGreaterThan(10);
    }
  });
});
