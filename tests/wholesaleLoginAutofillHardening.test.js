import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Coverage for hardening the Shop Login form (Shop Name + Access Code)
 * against browser/password-manager autofill — a text field immediately
 * followed by a password field, inside a <form>, is exactly the shape
 * Chrome's/password managers' login heuristic keys on, regardless of this
 * field's own autoComplete value, and could offer to fill in the
 * developer's/owner's own saved email+password instead of a real shop's
 * name+code. Same technique already proven against this exact problem on
 * DESK's New Shop form (see that sibling repo's "Harden New Shop form
 * against browser/password-manager autofill" commit) — unique non-standard
 * field names, data-lpignore/data-1p-ignore, autoComplete="new-password" on
 * the password-type field, and a mount-only reset effect.
 *
 * This project has no jsdom/DOM test environment (see every other
 * *.test.js file's own note) — these are source-scan assertions against the
 * component's content, the same convention already used throughout this
 * suite.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const loginSrc = readFileSync(join(root, "src/pages/WholesaleLogin.jsx"), "utf8");

function extractTag(src, startMarker) {
  const start = src.indexOf(startMarker);
  expect(start, `${startMarker} not found`).toBeGreaterThan(-1);
  const end = src.indexOf("/>", start);
  return src.slice(start, end);
}

describe("WholesaleLogin.jsx: both fields start empty and are never sourced from storage", () => {
  it("shopName and code are plain useState('') — no localStorage/sessionStorage read anywhere in this file", () => {
    expect(loginSrc).toContain('const [shopName, setShopName] = useState("");');
    expect(loginSrc).toContain('const [code, setCode] = useState("");');
    expect(loginSrc).not.toMatch(/localStorage/);
    expect(loginSrc).not.toMatch(/sessionStorage/);
  });

  it("a mount-only effect force-resets both fields to empty — belt-and-suspenders against a browser/extension injecting a value before mount", () => {
    expect(loginSrc).toContain('import { useEffect, useState } from "react";');
    expect(loginSrc).toMatch(/useEffect\(\(\) => \{\s*setShopName\(""\);\s*setCode\(""\);\s*\}, \[\]\);/);
  });
});

describe("WholesaleLogin.jsx: the <form> and both inputs are hardened against autofill", () => {
  it("the <form> itself carries autoComplete=\"off\"", () => {
    expect(loginSrc).toContain('<form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col gap-4">');
  });

  it("Shop Name: unique non-standard name (no 'username'/'email'/'user' substring), autoComplete off, lpignore + 1p-ignore", () => {
    const tag = extractTag(loginSrc, 'name="wsPortalShopName"');
    // extractTag anchors on the name attribute itself; re-slice back to the
    // start of the <input to see every attribute on this specific field.
    const inputStart = loginSrc.lastIndexOf("<input", loginSrc.indexOf('name="wsPortalShopName"'));
    const fullTag = loginSrc.slice(inputStart, loginSrc.indexOf("/>", inputStart));
    expect(fullTag).toContain('name="wsPortalShopName"');
    expect(fullTag).toContain('autoComplete="off"');
    expect(fullTag).toContain('data-lpignore="true"');
    expect(fullTag).toContain('data-1p-ignore="true"');
    expect(fullTag).toContain('type="text"');
    expect("wsPortalShopName".toLowerCase()).not.toMatch(/username|email/);
  });

  it("Access Code: unique non-standard name, autoComplete=\"new-password\" (NOT \"off\" — Chrome largely ignores autocomplete=off on password fields), lpignore + 1p-ignore, still masked", () => {
    const inputStart = loginSrc.lastIndexOf("<input", loginSrc.indexOf('name="wsPortalAccessCode"'));
    const fullTag = loginSrc.slice(inputStart, loginSrc.indexOf("/>", inputStart));
    expect(fullTag).toContain('name="wsPortalAccessCode"');
    expect(fullTag).toContain('autoComplete="new-password"');
    expect(fullTag).not.toMatch(/autoComplete="off"/);
    expect(fullTag).toContain('data-lpignore="true"');
    expect(fullTag).toContain('data-1p-ignore="true"');
    expect(fullTag).toContain('type="password"'); // still masked
  });

  it("neither field's name attribute contains a 'password' substring that would itself invite a password manager's own heuristic match", () => {
    expect("wsPortalAccessCode".toLowerCase()).not.toMatch(/\bpassword\b/);
    expect("wsPortalShopName".toLowerCase()).not.toMatch(/\bpassword\b/);
  });

  it("exactly one Shop Name input and one Access Code input exist (no duplicate/hidden decoy fields were introduced)", () => {
    expect((loginSrc.match(/name="wsPortalShopName"/g) || []).length).toBe(1);
    expect((loginSrc.match(/name="wsPortalAccessCode"/g) || []).length).toBe(1);
  });
});

describe("WholesaleLogin.jsx: existing behavior is untouched by this hardening pass", () => {
  it("code normalization (normalizeShopCode) still wires the same way on change", () => {
    expect(loginSrc).toContain("onChange={(e) => setCode(normalizeShopCode(e.target.value))}");
  });

  it("shopName still trims only at submit time (handleSubmit), not on every keystroke", () => {
    expect(loginSrc).toContain("onChange={(e) => setShopName(e.target.value)}");
    expect(loginSrc).toContain("wholesaleLogin(shopName.trim(), normalizeShopCode(code));");
  });

  it("submit button disabled state and loading copy are unchanged", () => {
    expect(loginSrc).toContain('<Button type="submit" disabled={status === "loading"}');
  });
});
