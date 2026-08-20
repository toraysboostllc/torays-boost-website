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

/**
 * Adenda 8/9, Cambio 6 — broken-image fallback (Microsoldering/Controllers
 * showed the browser's native broken-image icon + raw alt text before this
 * fix, because the <img> had no onError handler at all — a missing image
 * fell back to the icon fine, but an image whose URL WAS present but failed
 * to actually load — e.g. a Supabase Storage signed URL past its 5-minute
 * TTL — did not. This project has no jsdom/DOM test environment (see every
 * other *.test.js file's own note), so an actual onError event can't be
 * dispatched in a unit test; these are the same source-scan assertions
 * already used throughout this suite for hard-to-render Web-API behavior —
 * they pin the exact code structure, not a simulated DOM event.
 */
describe("EquipmentTypeCard.jsx: broken-image fallback — a load failure degrades to the same icon a missing image already uses", () => {
  it("tracks the failed URL by VALUE (not a boolean flag) so a fresh catalog fetch with a new signed URL for the same entity gets a real retry", () => {
    expect(cardSrc).toContain('import { useEffect, useState } from "react";');
    expect(cardSrc).toContain("const [failedUrl, setFailedUrl] = useState(null);");
  });

  it("resets failedUrl whenever the image URL itself changes — a stale failure never sticks past a refetch", () => {
    expect(cardSrc).toMatch(/useEffect\(\(\) => \{\s*setFailedUrl\(null\);\s*\}, \[imageUrl\]\);/);
  });

  it("shows the image only when a URL exists AND it isn't the one that already failed", () => {
    expect(cardSrc).toContain("const showImage = imageUrl && imageUrl !== failedUrl;");
  });

  it("the <img> wires onError to record ITS OWN url as failed — never a bare boolean setter that could mask a later successful URL", () => {
    const returnIdx = cardSrc.indexOf("return (");
    const idx = cardSrc.indexOf("<img", returnIdx);
    const tag = cardSrc.slice(idx, cardSrc.indexOf("/>", idx));
    expect(tag).toContain("onError={() => setFailedUrl(imageUrl)}");
    expect(tag).toContain("src={imageUrl}");
  });

  it("cannot loop: img and the icon fallback are mutually exclusive branches of one ternary, so once showImage flips to false the failed <img> unmounts — there is no element left in the DOM to fire a second error event", () => {
    expect(cardSrc).toMatch(/\{showImage \? \(\s*<img/);
    expect(cardSrc).toContain("Icon size={44} className=\"wsp-card-photo-icon\" aria-hidden=\"true\" />");
    // Exactly one ACTUAL JSX <img> element (the header comment above it also
    // mentions "<img>" in prose, so this counts only tags shaped like real
    // JSX — a "<img" immediately followed by whitespace/a newline, not ">").
    const jsxImgTags = cardSrc.match(/<img[\s\n]/g) || [];
    expect(jsxImgTags.length).toBe(1);
    expect((cardSrc.match(/<Icon /g) || []).length).toBe(1);
  });

  it("the icon fallback is aria-hidden — the visible card title below it already provides the accessible name, so the icon never gets announced twice", () => {
    expect(cardSrc).toContain('aria-hidden="true"');
  });

  it("never a raw DOM src reassignment or manual retry loop — the only mechanism is React state driving which element renders", () => {
    expect(cardSrc).not.toContain(".src =");
    expect(cardSrc).not.toContain("retryCount");
    expect(cardSrc).not.toContain("setTimeout");
  });
});
