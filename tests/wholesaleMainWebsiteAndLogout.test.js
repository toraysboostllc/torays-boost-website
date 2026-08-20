import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { wholesaleTranslations } from "../src/i18n/wholesaleTranslations.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const pageSrc = read("src/pages/WholesalePrices.jsx");
const cssSrc = read("src/styles/wholesalePortal.css");

/**
 * WholesalePrices.jsx is a full React component with hooks — this project
 * has no jsdom/browser test environment (see every other *.test.js file's
 * own note on this), so it can't be mounted and clicked in a unit test.
 * These are the same source-scan assertions already used for
 * WholesaleSoundToggle.jsx and the rest of the wizard: they pin the exact
 * literal code that must exist, and its relative ORDER within the function
 * body, so a refactor that breaks the sequencing fails loudly here even
 * without a DOM to actually render into.
 */

describe("Adenda 8, Cambio 4 — 'Main website' link: exact URL, same-tab navigation", () => {
  it("defines the exact target URL as a single shared constant", () => {
    expect(pageSrc).toContain('const MAIN_WEBSITE_URL = "https://www.toraysboost.com/";');
  });

  it("handleMainWebsite navigates same-tab via window.location.href — never window.open (a new tab) and never react-router's navigate() (an external URL isn't an in-app route)", () => {
    const idx = pageSrc.indexOf("function handleMainWebsite()");
    expect(idx).toBeGreaterThan(-1);
    const body = pageSrc.slice(idx, pageSrc.indexOf("\n  }", idx));
    expect(body).toContain("window.location.href = MAIN_WEBSITE_URL;");
  });

  it("window.open is never used anywhere in this file — every navigation here is same-tab", () => {
    expect(pageSrc).not.toContain("window.open");
  });

  it("the button is wired to handleMainWebsite via the shared hover-sound helper, uses the Home icon, and reads its label from t() — never hardcoded text", () => {
    const idx = pageSrc.indexOf('className="wsp-main-site-link"');
    expect(idx).toBeGreaterThan(-1);
    const surrounding = pageSrc.slice(idx - 400, idx + 200);
    expect(surrounding).toContain("wholesaleHoverProps(handleMainWebsite)");
    expect(surrounding).toContain("<Home size={14} aria-hidden=\"true\" />");
    expect(surrounding).toContain('t("portal.mainWebsite")');
  });

  it("carries an aria-label so the icon+short-label button is announced correctly to assistive tech", () => {
    const idx = pageSrc.indexOf('className="wsp-main-site-link"');
    const tag = pageSrc.slice(idx, pageSrc.indexOf(">", idx));
    expect(tag).toContain('aria-label={t("portal.mainWebsite")}');
  });

  it("sits directly beside Logout (its own button group in the second header row), after the Sound/Locale row above — not squeezed into the already-cramped Sound/Locale row, which is what was pushing the whole header ~50px taller at 320px width", () => {
    const soundIdx = pageSrc.indexOf("<WholesaleSoundToggle");
    const localeIdx = pageSrc.indexOf("<WholesaleLocaleSelector");
    const mainSiteIdx = pageSrc.indexOf('className="wsp-main-site-link"');
    const logoutButtonIdx = pageSrc.indexOf("wholesaleHoverProps(handleLogout)");
    expect(soundIdx).toBeLessThan(localeIdx);
    expect(localeIdx).toBeLessThan(mainSiteIdx); // Main Website's whole row comes after the Sound/Locale row
    expect(mainSiteIdx).toBeLessThan(logoutButtonIdx); // and directly precedes Logout within that same row
  });

  it("uses a distinct CSS class from Logout's .wsp-btn-ghost — never the same visual treatment, so it can't compete with Logout", () => {
    const idx = pageSrc.indexOf('className="wsp-main-site-link"');
    const tag = pageSrc.slice(idx, pageSrc.indexOf(">", idx));
    expect(tag).not.toContain("wsp-btn-ghost");
    expect(tag).not.toContain("wsp-btn-primary");
  });

  it("CSS: minimum touch target of 44px", () => {
    const idx = cssSrc.indexOf(".wsp-main-site-link {");
    const block = cssSrc.slice(idx, cssSrc.indexOf("}", idx));
    expect(block).toMatch(/min-height:\s*44px/);
  });

  it("i18n: exact EN/ES label text", () => {
    expect(wholesaleTranslations.en.portal.mainWebsite).toBe("Main website");
    expect(wholesaleTranslations.es.portal.mainWebsite).toBe("Sitio principal");
  });
});

describe("Adenda 8, Cambio 4 — Logout: real logout flow first, then cleanup, then redirect — never a second auth implementation", () => {
  function logoutBody() {
    const idx = pageSrc.indexOf("async function handleLogout()");
    expect(idx).toBeGreaterThan(-1);
    return pageSrc.slice(idx, pageSrc.indexOf("\n  }", idx));
  }

  it("calls the existing wholesaleLogout() — the real session-revoking flow — never a hand-rolled replacement", () => {
    expect(pageSrc).toContain('import { fetchWholesaleCatalog, wholesaleLogout } from "../lib/wholesaleAuth.js";');
    expect(logoutBody()).toContain("await wholesaleLogout();");
  });

  it("does not import from any alternative session/auth module path — the only import whose source path names auth/session is wholesaleAuth.js", () => {
    const importLines = pageSrc.split("\n").filter((l) => l.trim().startsWith("import"));
    const authPathImports = importLines.filter((l) => /from\s+["'][^"']*(auth|session)[^"']*["']/i.test(l));
    expect(authPathImports).toEqual(['import { fetchWholesaleCatalog, wholesaleLogout } from "../lib/wholesaleAuth.js";']);
  });

  it("ordering: await wholesaleLogout() runs BEFORE the private-state cleanup, which runs BEFORE the redirect — never redirects first", () => {
    const body = logoutBody();
    const logoutCallIdx = body.indexOf("await wholesaleLogout();");
    const cleanupIdx = body.indexOf("setState({");
    const redirectIdx = body.indexOf("window.location.href = MAIN_WEBSITE_URL;");
    expect(logoutCallIdx).toBeGreaterThan(-1);
    expect(cleanupIdx).toBeGreaterThan(-1);
    expect(redirectIdx).toBeGreaterThan(-1);
    expect(logoutCallIdx).toBeLessThan(cleanupIdx);
    expect(cleanupIdx).toBeLessThan(redirectIdx);
  });

  it("cleanup resets every private field back to its empty/loading shape — nothing from the loaded catalog survives in state past logout", () => {
    const body = logoutBody();
    const cleanupBlock = body.slice(body.indexOf("setState({"), body.indexOf("});", body.indexOf("setState({")));
    expect(cleanupBlock).toContain('status: "loading"');
    expect(cleanupBlock).toContain('shopName: ""');
    expect(cleanupBlock).toContain("equipmentTypes: []");
    expect(cleanupBlock).toContain("microsoldering: null");
    expect(cleanupBlock).toContain("salesModule: null");
  });

  it("redirects to the exact same MAIN_WEBSITE_URL constant the 'Main website' button uses — one source of truth for the destination", () => {
    expect(logoutBody()).toContain("window.location.href = MAIN_WEBSITE_URL;");
  });

  it("the redirect is unconditional — not gated behind an if/success check on the logout call — so a network error during logout still leaves the shop, never stuck on a private screen", () => {
    const body = logoutBody();
    // No conditional branching between the logout call and the redirect —
    // confirms the redirect isn't wrapped in an "if it worked" guard.
    const between = body.slice(body.indexOf("await wholesaleLogout();"), body.indexOf("window.location.href = MAIN_WEBSITE_URL;"));
    expect(between).not.toMatch(/\bif\s*\(/);
  });

  it("wholesaleLogout() itself never throws/rejects — network failures are swallowed at the source, which is what makes the unconditional redirect above safe", () => {
    const authSrc = read("src/lib/wholesaleAuth.js");
    const idx = authSrc.indexOf("export async function wholesaleLogout()");
    const body = authSrc.slice(idx, authSrc.indexOf("\n}", idx));
    expect(body).toContain(".catch(() => {})");
  });

  it("Logout button is still wired to handleLogout, unchanged", () => {
    expect(pageSrc).toContain("wholesaleHoverProps(handleLogout)");
  });
});
