import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Structural checks for the Torays Boost repair collage used as the
 * Wholesale Shop Login background — same text-based approach as every
 * other test file in this project (no React render harness configured).
 * Real visual/responsive verification (legibility, no overflow, natural
 * mobile crop) was done in the embedded browser during implementation.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const loginSrc = read("src/pages/WholesaleLogin.jsx");
const pricesSrc = read("src/pages/WholesalePrices.jsx");
const wsPortalCss = read("src/styles/wholesalePortal.css");

describe("WholesaleLogin: repair collage background", () => {
  it("ships the collage as a local WebP asset in the project's existing assets structure", () => {
    expect(existsSync(join(root, "src/assets/wholesale-login-collage.webp"))).toBe(true);
    expect(existsSync(join(root, "src/assets/wholesale-login-collage-source.png"))).toBe(false);
  });

  it("imports the asset as a real module import, not Base64 and not an external URL", () => {
    expect(loginSrc).toMatch(/import loginCollageBg from ["']\.\.\/assets\/wholesale-login-collage\.webp["']/);
    expect(loginSrc).not.toMatch(/data:image\//);
    expect(loginSrc).not.toMatch(/https?:\/\//);
  });

  it("applies the collage as a full-bleed, non-repeating, centered background on the login screen's root element", () => {
    expect(loginSrc).toContain("backgroundImage: `url(${loginCollageBg})`");
    expect(loginSrc).toMatch(/className="[^"]*\bbg-cover\b[^"]*\bbg-center\b[^"]*\bbg-no-repeat\b[^"]*"/);
  });

  it("keeps a solid fallback color behind the image so there's no flash before it loads", () => {
    expect(loginSrc).toMatch(/className="[^"]*\bbg-torays-navy\b[^"]*"/);
  });

  it("does not use .wsp-scope or the catalog page's PCB background — this is a separate, dedicated treatment for the login screen only", () => {
    expect(loginSrc).not.toContain("wsp-scope");
    expect(loginSrc).not.toContain("wholesalePortal.css");
  });

  it("does not touch WholesalePrices.jsx or wholesalePortal.css (the catalog's own styling) at all", () => {
    expect(pricesSrc).not.toMatch(/wholesale-login-collage/);
    expect(wsPortalCss).not.toMatch(/wholesale-login-collage/);
  });

  it("adds no new animation or motion — no new framer-motion usage introduced around the background", () => {
    const beforeCard = loginSrc.slice(0, loginSrc.indexOf("<Card"));
    expect(beforeCard).not.toMatch(/motion\.|animate=|whileHover|whileInView/);
  });

  it("does not alter the form, auth call, or portal behavior — same fields, same wholesaleLogin() call, same navigation on success", () => {
    expect(loginSrc).toContain('import { wholesaleLogin, fetchWholesaleCatalog } from "../lib/wholesaleAuth.js"');
    expect(loginSrc).toContain("await wholesaleLogin(shopName.trim(), normalizeShopCode(code), rememberDevice)");
    expect(loginSrc).toContain('navigate("/wholesale/prices")');
    expect(loginSrc).toContain('type="password"');
    expect(loginSrc).toContain('type="text"');
  });

  it("keeps the login card and its contents on the Card component — solid opaque background, unaffected by whatever sits behind it", () => {
    expect(loginSrc).toContain('<Card className="w-full max-w-sm">');
  });
});

describe("WholesaleLogin: logo contrast plate", () => {
  it("wraps the unmodified Logo in a compact white/translucent glass plate, not the Logo component itself", () => {
    expect(loginSrc).toContain('<Logo size="lg" />');
    const plateMatch = loginSrc.match(/<div className="([^"]*)">\s*<Logo size="lg" \/>\s*<\/div>/);
    expect(plateMatch).not.toBeNull();
    const plateClasses = plateMatch[1];
    expect(plateClasses).toMatch(/\bbg-white\/\d+\b/); // white/translucent, not a solid brand color
    expect(plateClasses).toMatch(/\brounded-(xl|2xl|3xl|full)\b/); // rounded corners
    expect(plateClasses).toMatch(/\bshadow-\[/); // soft custom shadow, not a heavy default
    expect(plateClasses).toMatch(/\bp-([1-4])\b/); // small padding only (not p-5+, keeps the plate tight to the logo)
  });

  it("does not resize the plate to a large fixed box — no explicit width/height forcing it beyond the logo's own size", () => {
    const plateMatch = loginSrc.match(/<div className="([^"]*)">\s*<Logo size="lg" \/>\s*<\/div>/);
    const plateClasses = plateMatch[1];
    expect(plateClasses).not.toMatch(/\bw-(\d+|full|screen)\b/);
    expect(plateClasses).not.toMatch(/\bh-(\d+|full|screen)\b/);
  });

  it("does not modify Logo.jsx or the logo asset — same official file, same colors", () => {
    const logoComponentSrc = read("src/components/ui/Logo.jsx");
    expect(logoComponentSrc).toContain('import logoSrc from "../../assets/torays-boost-logo.png"');
    expect(logoComponentSrc).toContain("do not redraw or recolor");
  });

  it("does not change the flex gap or overall centering of the page — the plate is just a new wrapper, not a layout rework", () => {
    expect(loginSrc).toMatch(/className="flex min-h-screen flex-col items-center justify-center gap-8 bg-torays-navy bg-cover bg-center bg-no-repeat px-5 py-16"/);
  });
});
