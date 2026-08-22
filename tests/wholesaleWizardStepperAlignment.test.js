import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const wizardSrc = read("src/components/wholesale/WholesaleWizard.jsx");
const cssSrc = read("src/styles/wholesalePortal.css");

/**
 * Real bug report: the 3-step progress indicator (circles 1/2/3, the
 * connecting lines, and the Equipo/Modelo/Falla labels) visually didn't
 * line up. Root cause, confirmed by reading the old markup/CSS: each
 * circle shared a flex row with its OWN trailing "line" element
 * (`.wsp-wizard-step-row { display:flex }` holding both), so the line
 * (flex:1) pushed the circle to the row's LEFT edge — while the label
 * below used the column's own centering, so circle and label never shared
 * the same horizontal center. The last step (no line) was flush-left too
 * (no justify-content set), same misalignment.
 *
 * Fix: the line moved out of the JSX entirely — it's now drawn by CSS
 * (`.wsp-wizard-step-row::after`) spanning from THIS row's own horizontal
 * center to the identical center of the next equal-width column, while the
 * row itself uses justify-content:center to keep the circle centered
 * (matching the label, centered the same way one level up). This file
 * checks the actual markup/CSS structure directly — no jsdom render
 * needed to prove a flex/absolute-positioning layout is centered per
 * column, since the classes/rules themselves are what encode that.
 */

describe("WizardSteps markup: no separate flex-sibling line element anymore — one wrapper holding only the circle", () => {
  it("the JSX no longer renders a .wsp-wizard-step-line span (that per-step trailing element was the root cause of the circle-vs-label misalignment)", () => {
    expect(wizardSrc).not.toContain("wsp-wizard-step-line");
  });

  it("each step's row wraps ONLY the circle — no sibling element inside .wsp-wizard-step-row", () => {
    const rowIdx = wizardSrc.indexOf('<span className="wsp-wizard-step-row">');
    const rowEnd = wizardSrc.indexOf("</span>", wizardSrc.indexOf("</span>", rowIdx) + 1);
    const rowBlock = wizardSrc.slice(rowIdx, rowEnd);
    // Exactly one nested <span> (the circle) inside the row wrapper.
    expect((rowBlock.match(/<span/g) || []).length).toBe(2); // the row's own opening tag + the circle
  });

  it("CSS no longer defines a .wsp-wizard-step-line rule — the connector is drawn entirely by ::after now", () => {
    expect(cssSrc).not.toMatch(/\.wsp-wizard-step-line\s*\{/);
  });
});

describe("wholesalePortal.css: circle is centered in its column, the connecting line is a CSS ::after spanning column-center to column-center", () => {
  it(".wsp-wizard-step-row centers its content (the circle) instead of left-aligning it next to a line", () => {
    const idx = cssSrc.indexOf(".wsp-wizard-step-row {");
    const block = cssSrc.slice(idx, cssSrc.indexOf("}", idx));
    expect(block).toMatch(/justify-content:\s*center/);
    expect(block).toMatch(/position:\s*relative/);
  });

  it(".wsp-wizard-step-row::after draws the connector from this column's center (left:50%) spanning exactly one more equal-width column (width:100%) — reaching the next circle's own center, never falling short or overshooting", () => {
    const idx = cssSrc.indexOf(".wsp-wizard-step-row::after {");
    expect(idx).toBeGreaterThan(-1);
    const block = cssSrc.slice(idx, cssSrc.indexOf("}", idx));
    expect(block).toMatch(/left:\s*50%/);
    expect(block).toMatch(/width:\s*100%/);
    expect(block).toMatch(/position:\s*absolute/);
  });

  it("the connector is hidden after the LAST step — nothing trails off past Falla", () => {
    expect(cssSrc).toMatch(/\.wsp-wizard-step:last-child \.wsp-wizard-step-row::after\s*\{\s*display:\s*none;\s*\}/);
  });

  it("the circle sits at a higher stacking order than the connector line (z-index) with its own opaque fill, so the line visibly starts/ends AT the circle rather than crossing through it or stopping short of it", () => {
    const rowAfterIdx = cssSrc.indexOf(".wsp-wizard-step-row::after {");
    const rowAfterBlock = cssSrc.slice(rowAfterIdx, cssSrc.indexOf("}", rowAfterIdx));
    expect(rowAfterBlock).toMatch(/z-index:\s*0/);

    const circleIdx = cssSrc.indexOf(".wsp-wizard-step-circle {");
    const circleBlock = cssSrc.slice(circleIdx, cssSrc.indexOf("}", circleIdx));
    expect(circleBlock).toMatch(/z-index:\s*1/);
    expect(circleBlock).toMatch(/background:\s*var\(--wsp-card-bg\)/); // opaque fill, unchanged
  });

  it("the done-state connector recolors the same way the done-state circle does (both keyed off .wsp-wizard-step-done), so a completed segment reads as one continuous blue line, not a color mismatch between the fill and the connector", () => {
    expect(cssSrc).toMatch(/\.wsp-wizard-step-done \.wsp-wizard-step-row::after\s*\{\s*background:\s*var\(--wsp-blue\);\s*\}/);
  });

  it("three equal-width columns — .wsp-wizard-step is still flex:1, unchanged by this fix", () => {
    const idx = cssSrc.indexOf(".wsp-wizard-step {");
    const block = cssSrc.slice(idx, cssSrc.indexOf("}", idx));
    expect(block).toMatch(/flex:\s*1/);
  });
});

describe("WizardSteps: pending/active/done states unchanged in meaning, just correctly aligned now", () => {
  it("done gets the solid checkmark + wsp-wizard-step-done class; the first not-yet-done step gets wsp-wizard-step-active; anything after that is plain/pending with no extra class", () => {
    expect(wizardSrc).toMatch(/const activeIndex = steps\.findIndex\(\(step\) => !step\.done\);/);
    expect(wizardSrc).toMatch(
      /className=\{`wsp-wizard-step\$\{step\.done \? " wsp-wizard-step-done" : ""\}\$\{i === activeIndex \? " wsp-wizard-step-active" : ""\}`\}/
    );
    expect(wizardSrc).toMatch(/step\.done \? <Check size=\{14\} \/> : i \+ 1/);
  });
});
