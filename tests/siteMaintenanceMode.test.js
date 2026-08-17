import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildContactLink, hasWhatsApp } from "../src/lib/whatsapp.js";
import { siteConfig } from "../src/config/site.config.js";

/**
 * Structural checks for the temporary full-site maintenance lock — same
 * text-based approach as every other test file in this project (no React
 * render harness configured). Since App.jsx's maintenance branch is a hard
 * early `return` before <Routes> is ever reached, "the early return exists
 * textually before <Routes>" IS the proof that Home/WholesaleLogin/
 * WholesalePrices never mount while the flag is on — React never invokes a
 * component function that isn't rendered in the tree.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const appSrc = read("src/App.jsx");
const maintenanceConfigSrc = read("src/config/maintenance.config.js");
const maintenancePageSrc = read("src/pages/MaintenancePage.jsx");

describe("App.jsx: global maintenance gate", () => {
  it("imports a single, clearly-named SITE_MAINTENANCE_MODE flag from a dedicated config file", () => {
    expect(appSrc).toContain('import { SITE_MAINTENANCE_MODE } from "./config/maintenance.config.js"');
    // asserts the flag exists as a plain boolean export, not a specific
    // value — feature-preview branches legitimately flip this to `false`
    // temporarily (see the file's own comments) without that being a
    // regression of the mechanism itself.
    expect(maintenanceConfigSrc).toMatch(/export const SITE_MAINTENANCE_MODE = (true|false);/);
  });

  it("checks the flag and returns MaintenancePage BEFORE <Routes> is reached — for every path, not just known ones", () => {
    // strip // line comments first — App.jsx's own comment explains the
    // gate in prose (mentioning the literal text "<Routes>" as what comes
    // after), which isn't actual JSX and shouldn't trip this check on itself.
    const codeOnly = appSrc.replace(/^\s*\/\/.*$/gm, "");
    const gateIdx = codeOnly.indexOf("if (SITE_MAINTENANCE_MODE)");
    const returnIdx = codeOnly.indexOf("return <MaintenancePage />");
    const routesIdx = codeOnly.indexOf("<Routes>");
    expect(gateIdx).toBeGreaterThan(-1);
    expect(returnIdx).toBeGreaterThan(gateIdx);
    expect(routesIdx).toBeGreaterThan(returnIdx); // the gate's return happens textually before <Routes>
  });

  it("documents the exact single change needed to relaunch the site", () => {
    expect(maintenanceConfigSrc).toMatch(/TO RELAUNCH THE SITE/);
    expect(appSrc).toMatch(/TO RELAUNCH/);
  });

  it("does not delete or rewrite any existing route — Home, Privacy, Terms, WholesaleLogin, WholesalePrices, and the catch-all all remain defined, just unreachable while the flag is on", () => {
    expect(appSrc).toContain('<Route path="/" element={<Home />} />');
    expect(appSrc).toContain('<Route path="/privacy" element={<Privacy />} />');
    expect(appSrc).toContain('<Route path="/terms" element={<Terms />} />');
    expect(appSrc).toContain('<Route path="/wholesale" element={<WholesaleLogin />} />');
    expect(appSrc).toContain('<Route path="/wholesale/prices" element={<WholesalePrices />} />');
    expect(appSrc).toContain('<Route path="*" element={<NotFound />} />');
  });
});

describe("MaintenancePage: copy, WhatsApp CTA, and identity", () => {
  it("renders the exact required headline, subtext, and button copy", () => {
    expect(maintenancePageSrc).toContain("We’re improving Torays Boost");
    expect(maintenancePageSrc).toContain(
      "Our website is currently under maintenance. We’ll be back soon with a better experience."
    );
    expect(maintenancePageSrc).toContain("Contact Us on WhatsApp");
  });

  it("uses the site's current WhatsApp link builder — same destination as the rest of the site, opened in a new tab", () => {
    expect(maintenancePageSrc).toContain('import { buildContactLink } from "../lib/whatsapp.js"');
    expect(maintenancePageSrc).toContain("href={buildContactLink()}");
    expect(maintenancePageSrc).toContain('target="_blank"');
    expect(maintenancePageSrc).toContain('rel="noreferrer"');
  });

  it("uses the original, unmodified Logo component — no redraw, no recolor", () => {
    expect(maintenancePageSrc).toContain('import { Logo } from "../components/ui/Logo.jsx"');
    expect(maintenancePageSrc).toContain('<Logo size="lg"');
    const logoComponentSrc = read("src/components/ui/Logo.jsx");
    expect(logoComponentSrc).toContain('import logoSrc from "../../assets/torays-boost-logo.png"');
    expect(logoComponentSrc).toContain("do not redraw or recolor");
  });

  it("uses the light PCB-trace CircuitBackground — never the private Wholesale login collage", () => {
    expect(maintenancePageSrc).toContain('import { CircuitBackground } from "../components/ui/CircuitBackground.jsx"');
    expect(maintenancePageSrc).not.toMatch(/wholesale-login-collage/);
    expect(maintenancePageSrc).not.toMatch(/wsp-scope|wholesalePortal\.css/);
  });

  it("never imports the Wholesale API/auth module — no request can fire from this page", () => {
    expect(maintenancePageSrc).not.toMatch(/wholesaleAuth|fetchWholesaleCatalog|wholesaleLogin|api\/wholesale/);
  });

  it("sets noindex, nofollow via the site's existing SEO hook", () => {
    expect(maintenancePageSrc).toContain('import { useSEO } from "../lib/seo.js"');
    expect(maintenancePageSrc).toMatch(/useSEO\(\{[^}]*noindex:\s*true/);
  });

  it("guarantees a minimum 44px touch target and a visible :focus-visible ring on the WhatsApp button", () => {
    expect(maintenancePageSrc).toMatch(/className="[^"]*\bmin-h-11\b[^"]*"/);
    expect(maintenancePageSrc).toContain("focus-visible:outline-none");
    expect(maintenancePageSrc).toContain("focus-visible:ring-2");
  });

  it("uses Torays blue/white/red only — no colors outside the existing theme tokens", () => {
    expect(maintenancePageSrc).toMatch(/bg-torays-bg|bg-torays-gradient|bg-torays-surface/);
    expect(maintenancePageSrc).toMatch(/text-torays-text/);
    expect(maintenancePageSrc).not.toMatch(/#[0-9a-fA-F]{3,8}/); // no ad-hoc hex colors
  });

  it("adds no new animation — a plain static card, no framer-motion usage introduced on this page", () => {
    expect(maintenancePageSrc).not.toMatch(/from ["']framer-motion["']/);
    expect(maintenancePageSrc).not.toMatch(/motion\.|whileInView|whileHover|animate=/);
  });

  it("does not use any router hooks — this page must render correctly for every path with no route context assumed", () => {
    expect(maintenancePageSrc).not.toMatch(/useNavigate|useParams|useLocation|react-router-dom/);
  });

  it("has no date or countdown of any kind", () => {
    expect(maintenancePageSrc).not.toMatch(/countdown|Date\.now|new Date|setInterval|setTimeout/);
  });

  it("the 'Contact Us on WhatsApp' button resolves to a real wa.me/17867937665 link on this branch, never a mailto fallback — confirms the mailto/WhatsApp mismatch seen on current production (main still has an empty whatsapp.number) is already fixed here, so relaunching from this branch's config will not repeat it", () => {
    expect(siteConfig.whatsapp.number).toBe("17867937665");
    expect(hasWhatsApp).toBe(true);
    expect(buildContactLink()).toMatch(/^https:\/\/wa\.me\/17867937665\?text=/);
    expect(buildContactLink()).not.toMatch(/^mailto:/);
  });
});
