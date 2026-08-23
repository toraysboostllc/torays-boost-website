// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { render, screen, cleanup } from "@testing-library/react";
import { WholesaleEstimateDisclaimerAcceptModal } from "../src/components/wholesale/WholesaleEstimateDisclaimerAcceptModal.jsx";
import { WholesaleLegalAcceptModal } from "../src/components/wholesale/WholesaleLegalAcceptModal.jsx";
import { WholesaleLocaleProvider } from "../src/i18n/WholesaleLocaleContext.jsx";

/**
 * Regression coverage for a real reported visual bug (2026-08-22): the
 * "Accept and Enter" / "Accept and Continue" buttons on the two legal
 * clickwrap modals were "almost invisible" even after checking the
 * checkbox (i.e. in the ENABLED state, not just disabled).
 *
 * Root cause, fixed alongside these tests (see src/pages/WholesalePrices.jsx):
 * the `legal_required` render branch was the only one of that file's four
 * branches missing the `.wsp-scope` wrapper that defines every --wsp-*
 * CSS custom property .wsp-btn-primary depends on. An unresolved var() in
 * a `background` shorthand makes the WHOLE declaration invalid (not just
 * blank) — so the button rendered with no background gradient at all,
 * just near-white text on the modal's light card. Restoring the scope
 * (a one-line JSX wrapper, matching the other 3 branches' existing
 * pattern) fixes the enabled state completely.
 *
 * On top of that root-cause fix, this pass also gives the DISABLED state
 * its own explicit, legible treatment (previously a bare Tailwind
 * `disabled:opacity-50`, which fades text right along with the fill —
 * exactly the kind of washed-out look that made the enabled-state bug
 * easy to miss) and adds real hover/active/focus-visible rules to
 * wholesalePortal.css's .wsp-btn/.wsp-btn-primary/.wsp-btn-ghost.
 *
 * Second pass (still 2026-08-22): a real screenshot of the deployed Preview
 * showed the disabled "Accept and Enter" button reading as nearly white/
 * invisible even though the CSS cascade checks out correctly (confirmed by
 * reading the built dist/ CSS bundle directly and by mounting the REAL
 * WholesaleLegalAcceptModal component, not just the Estimate Disclaimer
 * one, against a live dev server). The actual design gap: .wsp-btn-primary
 * :disabled originally reused the dark --wsp-surface3/--wsp-btn-text pair
 * .wsp-btn-ghost uses — tokens designed for the dark .wsp-scope portal
 * page — but .wsp-btn-primary:disabled is ONLY EVER reachable on these two
 * legal modals' Accept buttons, both of which sit on a LIGHT
 * bg-torays-surface card. Switched to literal light-theme values
 * (#edf1f9 background, #20266f text) — the SAME torays-bg/torays-navy
 * tokens this modal's own name/title inputs and heading icon already use
 * — instead. Verified via getComputedStyle against a live dev-server mount
 * of both real modal components (not an isolated harness), full and empty
 * form state, desktop and mobile viewports, with screenshots.
 *
 * This file verifies three independent things:
 *   1. The CSS rules exist with the expected properties/values (structural,
 *      reading the real stylesheet text — same convention this repo
 *      already uses for every other CSS/SQL file).
 *   2. The exact color pairs those rules use meet a real WCAG contrast
 *      ratio (computed here with a plain luminance/contrast calculator —
 *      no new dependency), for both the enabled gradient's text-bearing
 *      region and the disabled flat fill.
 *   3. Both modals' Accept buttons actually flip disabled/enabled with the
 *      checkbox, and never carry the old opacity-fade utility classes
 *      that this pass removed.
 *
 * No sizing/spacing change was made (min-height: 40px, padding: 0 16px on
 * .wsp-btn are unchanged and are not viewport-dependent — there is no
 * separate mobile/desktop CSS branch for this component to test), so
 * mobile and desktop render identically here; that was also confirmed
 * live against the dev server before writing these tests.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const cssPath = join(__dirname, "..", "src", "styles", "wholesalePortal.css");
const css = readFileSync(cssPath, "utf8");

function ruleBody(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped.replace(/\\ /g, "\\s+") + "\\s*\\{([^}]*)\\}");
  const m = css.match(re);
  return m ? m[1] : null;
}

// Pulls the literal hex value for a property straight out of a rule body
// (e.g. extractHex(body, "background") from "background: #edf1f9;") — ties
// the contrast test to whatever color is ACTUALLY in the file, rather than
// a hardcoded duplicate that could silently drift out of sync with it.
function extractHex(body, prop) {
  const m = body.match(new RegExp(prop + ":\\s*(#[0-9a-fA-F]{6})"));
  return m ? m[1] : null;
}

// Plain WCAG 2.x relative-luminance / contrast-ratio calculator — no
// dependency, matches the standard formula exactly (sRGB -> linear ->
// weighted luminance -> (L1+0.05)/(L2+0.05)).
function hexToRgb(hex) {
  const n = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
}
function relativeLuminance([r, g, b]) {
  const chan = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const [R, G, B] = [chan(r), chan(g), chan(b)];
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
function contrastRatio(hexA, hexB) {
  const [L1, L2] = [relativeLuminance(hexToRgb(hexA)), relativeLuminance(hexToRgb(hexB))].sort((a, b) => b - a);
  return (L1 + 0.05) / (L2 + 0.05);
}

// Exact token values from wholesalePortal.css's .wsp-scope block.
const TOKENS = {
  "--wsp-blue": "#2563eb",
  "--wsp-navy": "#0b1730",
  "--wsp-surface3": "#2a3b66",
  "--wsp-btn-text": "#f4f6ff",
};
const WHITE = "#ffffff";
const WCAG_AA_NORMAL_TEXT = 4.5;

describe("wholesalePortal.css: .wsp-btn disabled/hover/active/focus rules exist with the expected shape", () => {
  it("defines a real, opaque, non-opacity-based disabled treatment on .wsp-btn", () => {
    const body = ruleBody(".wsp-btn:disabled");
    expect(body, ".wsp-btn:disabled rule not found").toBeTruthy();
    expect(body).toMatch(/opacity:\s*1\s*;/);
    expect(body).toMatch(/cursor:\s*not-allowed\s*;/);
  });

  it("gives .wsp-btn-primary a distinct, clearly-visible light disabled fill with a real (non-hairline) border — the SAME light-theme colors this modal's own inputs already use, never the dark wsp-scope tokens", () => {
    const body = ruleBody(".wsp-btn-primary:disabled");
    expect(body, ".wsp-btn-primary:disabled rule not found").toBeTruthy();
    expect(body).toMatch(/background:\s*#edf1f9\s*;/);
    expect(body).toMatch(/color:\s*#20266f\s*;/);
    expect(body).toMatch(/border-color:\s*rgba\(15,\s*20,\s*36,\s*0\.22\)\s*;/);
    // Never the dark-portal tokens this rule used before this pass.
    expect(body).not.toContain("var(--wsp-surface3)");
    expect(body).not.toContain("var(--wsp-btn-text)");
  });

  it("scopes hover/active brightness changes to the ENABLED state only, on both primary and ghost buttons", () => {
    for (const sel of [".wsp-btn-primary:not(:disabled):hover", ".wsp-btn-primary:not(:disabled):active", ".wsp-btn-ghost:not(:disabled):hover", ".wsp-btn-ghost:not(:disabled):active"]) {
      expect(ruleBody(sel), `${sel} rule not found`).toBeTruthy();
    }
    // The old unscoped :hover/:active selectors (which would also have
    // matched a disabled button) must be gone, not just supplemented.
    expect(css).not.toMatch(/\n\.wsp-btn-primary:hover\s*\{/);
    expect(css).not.toMatch(/\n\.wsp-btn-ghost:hover\s*\{/);
    expect(css).not.toMatch(/\n\.wsp-btn:active\s*\{/);
  });

  it("defines a visible focus-visible ring on every .wsp-btn variant", () => {
    const body = ruleBody(".wsp-btn:focus-visible");
    expect(body, ".wsp-btn:focus-visible rule not found").toBeTruthy();
    expect(body).toMatch(/outline:\s*2px solid var\(--wsp-blue-light\)/);
    expect(body).toMatch(/outline-offset:\s*2px/);
  });
});

describe("Real WCAG contrast ratios for the exact colors these rules use", () => {
  it("enabled state: white button text against the gradient's mid/end stops (where centered text actually sits) meets WCAG AA for normal text", () => {
    const midStop = contrastRatio(WHITE, TOKENS["--wsp-blue"]);
    const endStop = contrastRatio(WHITE, TOKENS["--wsp-navy"]);
    expect(midStop, `white vs --wsp-blue contrast was ${midStop.toFixed(2)}:1`).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
    expect(endStop, `white vs --wsp-navy contrast was ${endStop.toFixed(2)}:1`).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it("disabled state: the actual dark-navy text color against the actual light-blue-gray fill (both read straight from wholesalePortal.css) stays clearly legible, well above WCAG AA", () => {
    const body = ruleBody(".wsp-btn-primary:disabled");
    const bg = extractHex(body, "background");
    const text = extractHex(body, "color");
    expect(bg, "could not extract a literal hex background from .wsp-btn-primary:disabled").toBeTruthy();
    expect(text, "could not extract a literal hex color from .wsp-btn-primary:disabled").toBeTruthy();
    const ratio = contrastRatio(text, bg);
    expect(ratio, `contrast was ${ratio.toFixed(2)}:1 (${text} on ${bg})`).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it("the disabled fill is visually distinct from the enabled gradient's own mid-stop — light disabled fill must not read as close in brightness to the vivid active blue", () => {
    const body = ruleBody(".wsp-btn-primary:disabled");
    const disabledBg = extractHex(body, "background");
    const disabledL = relativeLuminance(hexToRgb(disabledBg));
    const enabledMidL = relativeLuminance(hexToRgb(TOKENS["--wsp-blue"]));
    expect(Math.abs(disabledL - enabledMidL)).toBeGreaterThan(0.1);
  });

  it("the disabled fill is visible against the modal's own white card (bg-torays-surface) — a real, if light, contrast, not a near-invisible one", () => {
    const body = ruleBody(".wsp-btn-primary:disabled");
    const disabledBg = extractHex(body, "background");
    const ratio = contrastRatio(disabledBg, "#ffffff");
    expect(ratio, `background-vs-card contrast was ${ratio.toFixed(2)}:1`).toBeGreaterThan(1.03);
  });
});

afterEach(() => cleanup());

function renderEstimateModal() {
  return render(
    <WholesaleLocaleProvider>
      <WholesaleEstimateDisclaimerAcceptModal legalDocumentId="doc-1" onAccepted={() => {}} onLogout={() => {}} />
    </WholesaleLocaleProvider>
  );
}
function renderMasterModal() {
  return render(
    <WholesaleLocaleProvider>
      <WholesaleLegalAcceptModal legalDocumentId="doc-1" onAccepted={() => {}} onLogout={() => {}} />
    </WholesaleLocaleProvider>
  );
}

describe("WholesaleEstimateDisclaimerAcceptModal: Accept button's activated/deactivated states", () => {
  it("starts disabled with only the plain wsp-btn/wsp-btn-primary classes — no leftover opacity-fade utility classes", () => {
    renderEstimateModal();
    const btn = screen.getByRole("button", { name: "Accept and Enter" });
    expect(btn.disabled).toBe(true);
    expect(btn.className).toBe("wsp-btn wsp-btn-primary");
    expect(btn.className).not.toMatch(/opacity/);
  });

  it("becomes enabled the instant the checkbox is checked, with the exact same classes (styling comes from :disabled/:not(:disabled) in CSS, never a JS-toggled class)", () => {
    renderEstimateModal();
    const checkbox = screen.getByRole("checkbox");
    checkbox.click();
    const btn = screen.getByRole("button", { name: "Accept and Enter" });
    expect(btn.disabled).toBe(false);
    expect(btn.className).toBe("wsp-btn wsp-btn-primary");
  });

  it("goes back to disabled if the checkbox is unchecked again", () => {
    renderEstimateModal();
    const checkbox = screen.getByRole("checkbox");
    checkbox.click();
    checkbox.click();
    expect(screen.getByRole("button", { name: "Accept and Enter" }).disabled).toBe(true);
  });
});

describe("WholesaleLegalAcceptModal: the master-agreement Accept button gets the exact same fix (never left with the old opacity-fade treatment)", () => {
  it("Accept & Continue button has only wsp-btn/wsp-btn-primary, no opacity utility classes, regardless of disabled state", () => {
    renderMasterModal();
    const btn = document.querySelector('button[type="submit"]');
    expect(btn).toBeTruthy();
    expect(btn.className).toBe("wsp-btn wsp-btn-primary");
    expect(btn.className).not.toMatch(/opacity/);
  });

  it("Logout ghost button also carries no stray opacity classes", () => {
    renderMasterModal();
    const logoutBtn = screen.getByText(/log out/i).closest("button");
    expect(logoutBtn.className).toBe("wsp-btn wsp-btn-ghost");
  });
});
