import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const panelSrc = read("src/components/wholesale/WholesaleProgressPanel.jsx");
const cssSrc = read("src/styles/wholesalePortal.css");

describe("WholesaleProgressPanel.jsx: never blocks the page, never fetches, never fabricates", () => {
  it("is not a fixed/full-page overlay — no position: fixed anywhere in the component or its CSS block", () => {
    expect(panelSrc).not.toMatch(/position:\s*["']?fixed/);
    const cssBlock = cssSrc.match(/\.wsp-progress-panel \{[\s\S]*?\n\}/)[0];
    expect(cssBlock).not.toMatch(/position:\s*fixed/);
  });

  it("contains no fetch/XHR call of its own — it only paces a reveal over data it's handed", () => {
    expect(panelSrc).not.toMatch(/fetch\(/);
  });

  it("uses the shared CircuitBackground component instead of inventing new SVG art", () => {
    expect(panelSrc).toContain('import { CircuitBackground } from "../ui/CircuitBackground.jsx"');
    expect(panelSrc).toMatch(/<CircuitBackground[^>]*opacity=\{0\.15\}/);
  });

  it("reads every visible string through t(), the Wholesale-scoped translator", () => {
    expect(panelSrc).toContain('t("progress.headline")');
    expect(panelSrc).toContain('t("progress.barLabel")');
    expect(panelSrc).toContain("t(`progress.${step.key}`)");
  });

  it("calls onComplete exactly once, driven by requestAnimationFrame, not a fixed setTimeout guess", () => {
    expect(panelSrc).toContain("requestAnimationFrame(tick)");
    expect(panelSrc).toContain("onCompleteRef.current()");
    expect(panelSrc).not.toMatch(/setTimeout\(\s*onComplete/);
  });

  it("cleans up its animation frame on unmount (no leaked rAF loop)", () => {
    expect(panelSrc).toContain("cancelAnimationFrame(frameId)");
  });

  it("checks prefers-reduced-motion and uses a much shorter duration when it's set", () => {
    expect(panelSrc).toContain("prefers-reduced-motion: reduce");
    expect(panelSrc).toMatch(/REDUCED_MOTION_DURATION_MS\s*=\s*500/);
    expect(panelSrc).toMatch(/FULL_DURATION_MS\s*=\s*3000/);
  });

  it("role=status + aria-live=polite so screen readers announce progress without focus stealing", () => {
    expect(panelSrc).toContain('role="status"');
    expect(panelSrc).toContain('aria-live="polite"');
  });

  it("the bar's own visual fill is aria-hidden (the text label carries the meaning for AT)", () => {
    expect(panelSrc).toMatch(/wsp-progress-bar-track"\s+aria-hidden="true"/);
  });
});

describe("wholesalePortal.css: progress panel styling — subtle, respects reduced motion", () => {
  it("the scan animation is a background-position sweep, not a jarring transform/scale", () => {
    const fillBlock = cssSrc.match(/\.wsp-progress-bar-fill \{[\s\S]*?\n\}/)[0];
    expect(fillBlock).toContain("animation: wsp-progress-scan");
    expect(fillBlock).not.toMatch(/scale\(/);
  });

  it("prefers-reduced-motion removes the scan animation and width transition entirely", () => {
    expect(cssSrc).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.wsp-progress-bar-fill \{\s*animation: none;\s*transition: none;/
    );
  });

  it("reuses --wsp-blue/--wsp-blue-light tokens, no new hardcoded hex colors for the bar", () => {
    const fillBlock = cssSrc.match(/\.wsp-progress-bar-fill \{[\s\S]*?\n\}/)[0];
    expect(fillBlock).toContain("var(--wsp-blue)");
    expect(fillBlock).toContain("var(--wsp-blue-light)");
    expect(fillBlock).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});
