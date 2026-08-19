import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const toggleSrc = read("src/components/wholesale/WholesaleSoundToggle.jsx");
const pricesSrc = read("src/pages/WholesalePrices.jsx");
const cardSrc = read("src/components/wholesale/EquipmentTypeCard.jsx");
const progressSrc = read("src/components/wholesale/WholesaleProgressPanel.jsx");

describe("WholesaleSoundToggle: accessible mute control", () => {
  it("uses a real <button> with aria-pressed reflecting the current enabled state", () => {
    expect(toggleSrc).toContain("<button");
    expect(toggleSrc).toContain("aria-pressed={enabled}");
  });

  it("has a speaker icon that swaps between Volume2 (on) and VolumeX (muted)", () => {
    expect(toggleSrc).toContain("import { Volume2, VolumeX } from \"lucide-react\"");
    expect(toggleSrc).toMatch(/enabled \? <Volume2[\s\S]{0,40}: <VolumeX/);
  });

  it("labels itself through t(), never a hardcoded 'Sound'/'Sonido' string", () => {
    expect(toggleSrc).toContain('t("audio.label")');
    expect(toggleSrc).toContain('t("audio.muteLabel")');
    expect(toggleSrc).toContain('t("audio.unmuteLabel")');
    expect(toggleSrc).not.toMatch(/>Sound<|>Sonido</);
  });

  it("reflects the shared sound-enabled store via useState + subscribeSoundEnabled, never its own disconnected state", () => {
    expect(toggleSrc).toContain("useState(isSoundEnabled)");
    expect(toggleSrc).toContain("subscribeSoundEnabled(setEnabled)");
  });

  it("clicking it calls setSoundEnabled and attempts to prime the AudioContext when turning sound ON", () => {
    expect(toggleSrc).toMatch(/setSoundEnabled\(next\)/);
    expect(toggleSrc).toMatch(/if \(next\) primeAudioContext\(\);/);
  });
});

describe("WholesalePrices.jsx: sound toggle is wired into the portal header, next to the locale selector", () => {
  it("imports and renders WholesaleSoundToggle", () => {
    expect(pricesSrc).toContain(
      'import { WholesaleSoundToggle } from "../components/wholesale/WholesaleSoundToggle.jsx";'
    );
    expect(pricesSrc).toContain("<WholesaleSoundToggle />");
  });

  it("sits alongside WholesaleLocaleSelector in the same header row", () => {
    const headerStart = pricesSrc.indexOf("<Logo ");
    const headerEnd = pricesSrc.indexOf("</div>", pricesSrc.indexOf("<WholesaleLocaleSelector />", headerStart));
    const headerBlock = pricesSrc.slice(headerStart, headerEnd);
    expect(headerBlock).toContain("<WholesaleSoundToggle />");
    expect(headerBlock).toContain("<WholesaleLocaleSelector />");
  });
});

describe("EquipmentTypeCard.jsx: hover/select tones, hover-capable devices only get the hover sound", () => {
  it("imports playHoverTone from the sound engine", () => {
    expect(cardSrc).toContain('import { playHoverTone } from "../../lib/wholesaleSound.js";');
  });

  it("plays on mouseEnter/focus only when the device is hover-capable — matches the CSS (hover: hover) and (pointer: fine) gate", () => {
    expect(cardSrc).toContain('window.matchMedia?.("(hover: hover) and (pointer: fine)").matches');
    expect(cardSrc).toContain("onMouseEnter={handleEnter}");
    expect(cardSrc).toContain("onFocus={handleEnter}");
  });

  it("touch/non-hover devices get the tone on click/select instead, never both on the same interaction", () => {
    expect(cardSrc).toContain("function handleClick() {");
    expect(cardSrc).toMatch(/if \(!isHoverCapable\(\)\) playHoverTone\(\);/);
  });
});

describe("WholesaleProgressPanel.jsx: soft completion chime", () => {
  it("imports playChime and calls it exactly once, right before onComplete fires", () => {
    expect(progressSrc).toContain('import { playChime } from "../../lib/wholesaleSound.js";');
    const elseBranch = progressSrc.slice(progressSrc.indexOf("} else {"), progressSrc.indexOf("}", progressSrc.indexOf("onCompleteRef.current()")) + 1);
    expect(elseBranch).toContain("playChime();");
    expect(elseBranch).toContain("onCompleteRef.current();");
    expect(elseBranch.indexOf("playChime();")).toBeLessThan(elseBranch.indexOf("onCompleteRef.current();"));
  });
});
