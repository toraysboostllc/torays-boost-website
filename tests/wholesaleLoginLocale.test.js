import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const loginSrc = read("src/pages/WholesaleLogin.jsx");

describe("WholesaleLogin.jsx: locale selector added, auth logic untouched", () => {
  it("wraps its content in WholesaleLocaleProvider, imported from the Wholesale-scoped context", () => {
    expect(loginSrc).toContain('import { WholesaleLocaleProvider, useWholesaleLocale } from "../i18n/WholesaleLocaleContext.jsx"');
    expect(loginSrc).toMatch(/<WholesaleLocaleProvider>\s*<WholesaleLoginContent \/>\s*<\/WholesaleLocaleProvider>/);
  });

  it("renders WholesaleLocaleSelector once", () => {
    expect((loginSrc.match(/<WholesaleLocaleSelector/g) || []).length).toBe(1);
  });

  it("every visible label now reads through t(), no hardcoded English copy left in the form", () => {
    expect(loginSrc).not.toContain(">Shop Login<");
    expect(loginSrc).not.toContain(">Shop Name<");
    expect(loginSrc).not.toContain(">Access Code<");
    expect(loginSrc).toContain('t("login.title")');
    expect(loginSrc).toContain('t("login.shopName")');
    expect(loginSrc).toContain('t("login.accessCode")');
    expect(loginSrc).toContain('t("login.submit")');
    expect(loginSrc).toContain('t("login.submitting")');
    expect(loginSrc).toContain('t("login.pendingDefault")');
  });

  it("handleSubmit still calls wholesaleLogin(shopName, code, rememberDevice) — code normalized, not just trimmed, plus the 'Keep me signed in' choice", () => {
    expect(loginSrc).toContain("const result = await wholesaleLogin(shopName.trim(), normalizeShopCode(code), rememberDevice);");
  });

  it("navigation on success is unchanged: still navigate('/wholesale/prices')", () => {
    expect(loginSrc).toContain('navigate("/wholesale/prices")');
  });

  it("the pending-device message still prefers the server's own message over the translated default", () => {
    expect(loginSrc).toMatch(/\{message \|\| t\("login\.pendingDefault"\)\}/);
  });

  it("no raw fetch(), cookie, or storage access was added directly to this file — every real network call stays wrapped in wholesaleAuth.js's own functions", () => {
    expect(loginSrc).not.toMatch(/localStorage\.setItem|localStorage\.getItem/);
    expect(loginSrc).not.toMatch(/document\.cookie/);
    const fetchCalls = (loginSrc.match(/fetch\(/g) || []).length;
    // wholesaleLogin() and the silent-session-check's fetchWholesaleCatalog()
    // both live in wholesaleAuth.js, not here — this file only ever calls
    // those wrapped functions, never fetch() directly.
    expect(fetchCalls).toBe(0);
  });
});
