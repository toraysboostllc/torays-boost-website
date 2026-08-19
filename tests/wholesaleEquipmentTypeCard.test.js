import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const cardSrc = read("src/components/wholesale/EquipmentTypeCard.jsx");

describe("EquipmentTypeCard.jsx: hover/tap sound — shared by every Equipo and Modelo tile", () => {
  it("imports the shared wholesaleHoverProps helper, never a local isHoverCapable/handleEnter reimplementation", () => {
    expect(cardSrc).toContain('import { wholesaleHoverProps } from "../../lib/wholesaleSound.js";');
    expect(cardSrc).not.toContain("function isHoverCapable");
    expect(cardSrc).not.toContain("function handleEnter");
    expect(cardSrc).not.toContain("function handleClick");
  });

  it("spreads wholesaleHoverProps(onClick) onto the button — one wiring covers pointerenter, focus, and tap/select", () => {
    expect(cardSrc).toContain("const hoverProps = wholesaleHoverProps(onClick);");
    expect(cardSrc).toContain("{...hoverProps}");
  });

  it("never attaches a raw onMouseEnter/onFocus/onClick trio by hand anymore — the spread is the single source", () => {
    expect(cardSrc).not.toMatch(/onMouseEnter=\{/);
    expect(cardSrc).not.toMatch(/onClick=\{handleClick\}/);
  });
});
