import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { normalizeShopCode } from "../src/lib/wholesaleCode.js";

/**
 * Structural checks for WholesaleLogin.jsx — same text-based approach as
 * every other test file in this project (no React render harness
 * configured). The runtime behavior of normalizeShopCode() itself is
 * covered directly below; this file confirms the component actually wires
 * it in (live onChange + before submit) and carries the anti-autocorrect
 * attributes, rather than re-testing the transform's logic through a
 * component render.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const loginSrc = read("src/pages/WholesaleLogin.jsx");

describe("normalizeShopCode() (client mirror of the server's normalizeShopCode)", () => {
  it("uppercases and trims, matching the server exactly", () => {
    expect(normalizeShopCode("secret123")).toBe("SECRET123");
    expect(normalizeShopCode("  SECRET123  ")).toBe("SECRET123");
    expect(normalizeShopCode("SeCrEt123")).toBe("SECRET123");
  });

  it("never strips internal characters — only trims + uppercases, same contract as the server", () => {
    expect(normalizeShopCode("bad code!")).toBe("BAD CODE!");
  });

  it("returns an empty string for non-string input, never throws", () => {
    expect(normalizeShopCode(undefined)).toBe("");
    expect(normalizeShopCode(null)).toBe("");
    expect(normalizeShopCode(42)).toBe("");
  });
});

describe("WholesaleLogin.jsx: access code field normalizes live and again before submit", () => {
  it("imports normalizeShopCode from the shared client helper", () => {
    expect(loginSrc).toContain('import { normalizeShopCode } from "../lib/wholesaleCode.js";');
  });

  it("normalizes on every keystroke (onChange), not just on submit", () => {
    expect(loginSrc).toContain("onChange={(e) => setCode(normalizeShopCode(e.target.value))}");
  });

  it("normalizes again immediately before calling wholesaleLogin (defense in depth)", () => {
    expect(loginSrc).toContain("wholesaleLogin(shopName.trim(), normalizeShopCode(code))");
    expect(loginSrc).not.toContain("wholesaleLogin(shopName.trim(), code.trim())");
  });

  it("the code input carries autoCapitalize=characters, autoCorrect=off, and spellCheck={false}", () => {
    const inputStart = loginSrc.indexOf('type="password"');
    const inputEnd = loginSrc.indexOf("/>", inputStart);
    const inputText = loginSrc.slice(inputStart, inputEnd);
    expect(inputText).toContain('autoCapitalize="characters"');
    expect(inputText).toContain('autoCorrect="off"');
    expect(inputText).toContain("spellCheck={false}");
  });
});
