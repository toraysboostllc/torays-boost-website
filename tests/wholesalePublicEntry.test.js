import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Structural/text-based checks on the public "Torays Boost Pro" entry point
 * into the private wholesale portal — same approach as every other test file
 * in this project (no React render harness configured), reading the actual
 * component source as text and asserting the specific properties this
 * feature requires. Real visual/responsive verification (no overflow, focus
 * ring rendering, click navigation) was already done in the embedded
 * browser during implementation; these tests guard the same properties so
 * they can't regress silently.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const linkSrc = read("src/components/layout/WholesalePortalLink.jsx");
const navbarSrc = read("src/components/layout/Navbar.jsx");
const heroSrc = read("src/sections/Hero.jsx");
const wholesaleLoginSrc = read("src/pages/WholesaleLogin.jsx");
const wholesalePricesSrc = read("src/pages/WholesalePrices.jsx");

describe("WholesalePortalLink: destination, copy, and navigation mechanics", () => {
  it("uses exactly /wholesale as the destination — no absolute URL, no Preview/production domain", () => {
    expect(linkSrc).toContain('to="/wholesale"');
    expect(linkSrc).not.toMatch(/https?:\/\//);
    expect(linkSrc).not.toMatch(/toraysboost\.com/i);
    expect(linkSrc).not.toMatch(/vercel\.app/i);
  });

  it("uses react-router-dom's <Link> for same-tab SPA navigation — never target=\"_blank\" or a plain <a href>", () => {
    expect(linkSrc).toContain('import { Link } from "react-router-dom"');
    // strip the file's own doc-comment block first — it explains the
    // requirement in prose (mentioning the literal string target="_blank"
    // as what NOT to do), which isn't actual JSX and shouldn't trip this
    // check on itself.
    const codeOnly = linkSrc.replace(/\/\*\*[\s\S]*?\*\//, "");
    expect(codeOnly).not.toContain("target=");
    expect(codeOnly).not.toContain('rel="noreferrer"');
    expect(codeOnly).not.toMatch(/<a\s/);
  });

  it("renders the exact primary text \"Torays Boost Pro\" and secondary text \"For Repair Shops\"", () => {
    expect(linkSrc).toContain("Torays Boost Pro");
    expect(linkSrc).toContain("For Repair Shops");
  });

  it("carries a clear, descriptive aria-label on every variant", () => {
    expect(linkSrc).toContain('const ARIA_LABEL = "Torays Boost Pro — For Repair Shops"');
    // every variant's returned element must actually apply it
    const ariaUsages = (linkSrc.match(/aria-label=\{ARIA_LABEL\}/g) || []).length;
    expect(ariaUsages).toBeGreaterThanOrEqual(2); // hero branch + shared header/mobile branch
  });

  it("never imports or calls any wholesale API/auth module — a plain navigation link only, nothing loads before a click", () => {
    expect(linkSrc).not.toMatch(/wholesaleAuth|fetchWholesaleCatalog|wholesaleLogin|api\/wholesale/);
  });

  it("guarantees a minimum 44px touch target on every variant (min-h-11 = 44px in this Tailwind config)", () => {
    expect(linkSrc).toMatch(/VARIANT_CLASSES = \{[\s\S]*?header:[\s\S]*?min-h-11/);
    expect(linkSrc).toMatch(/VARIANT_CLASSES = \{[\s\S]*?mobile:[\s\S]*?min-h-11/);
    expect(linkSrc).toMatch(/hero:[\s\S]*?min-h-11/);
  });

  it("has a visible :focus-visible ring on every variant — keyboard accessible, not just mouse-hoverable", () => {
    expect(linkSrc).toContain("focus-visible:outline-none");
    expect(linkSrc).toContain("focus-visible:ring-2");
  });

  it("uses a professional green XP-style gradient with white text and a small red Torays accent dot — visually distinct from the solid-red WhatsApp button", () => {
    expect(linkSrc).toMatch(/bg-\[linear-gradient\(180deg,#[0-9a-f]+_0%,#[0-9a-f]+_48%,#[0-9a-f]+_100%\)\]/);
    expect(linkSrc).toContain("text-white");
    expect(linkSrc).toContain("bg-torays-red"); // the small Torays accent dot, kept
    expect(linkSrc).not.toMatch(/bg-torays-red\/\d+.*text-white|VARIANTS\.primary/); // never mimics the primary WhatsApp button styling
  });

  it("brightens on hover and gives tactile feedback on press — the XP relief idiom, not a color swap", () => {
    expect(linkSrc).toContain("hover:brightness-110");
    expect(linkSrc).toContain("active:translate-y-px");
  });

  it("uses the Store icon from the existing lucide-react icon system — no new icon library, no custom SVG", () => {
    expect(linkSrc).toContain('import { Store } from "lucide-react"');
  });
});

describe("Navbar: desktop header entry point", () => {
  it("imports and renders WholesalePortalLink before the WhatsApp button, inside the desktop-only header group", () => {
    expect(navbarSrc).toContain('import { WholesalePortalLink } from "./WholesalePortalLink.jsx"');
    const desktopGroup = navbarSrc.match(/<div className="hidden md:flex items-center gap-3">[\s\S]*?<\/div>/)[0];
    expect(desktopGroup).toContain('<WholesalePortalLink variant="header" />');
    const wholesaleIdx = desktopGroup.indexOf("WholesalePortalLink");
    const whatsappIdx = desktopGroup.indexOf("WhatsApp");
    expect(wholesaleIdx).toBeGreaterThan(-1);
    expect(whatsappIdx).toBeGreaterThan(wholesaleIdx); // WhatsApp comes after, per spec
  });

  it("renders WholesalePortalLink as a full tappable row inside the mobile drawer, distinct from the regular anchor links", () => {
    const drawer = navbarSrc.match(/<div className="flex flex-col gap-6 px-8 py-10">[\s\S]*?<\/div>\s*<\/motion\.div>/)[0];
    expect(drawer).toContain('<WholesalePortalLink variant="mobile"');
    expect(drawer).toContain("onClick={() => setOpen(false)}"); // closes the drawer on navigation, same as the other links
  });

  it("does not change the existing #anchor nav links or the WhatsApp button's own destination/behavior", () => {
    expect(navbarSrc).toContain('{ href: "#services", label: "Services" }');
    expect(navbarSrc).toContain("buildContactLink()");
    expect(navbarSrc).toContain('target="_blank"'); // still present — only on the WhatsApp button, untouched
  });
});

describe("Hero: discreet secondary access point", () => {
  it("imports and renders WholesalePortalLink with variant=\"hero\", after the two main CTA buttons", () => {
    expect(heroSrc).toContain('import { WholesalePortalLink } from "../components/layout/WholesalePortalLink.jsx"');
    expect(heroSrc).toContain('<WholesalePortalLink variant="hero" />');
    const ctaIdx = heroSrc.indexOf("Get Free Quote");
    const wholesaleIdx = heroSrc.indexOf('<WholesalePortalLink variant="hero" />');
    expect(wholesaleIdx).toBeGreaterThan(ctaIdx);
  });

  it("does not touch the primary 'Get Free Quote' or WhatsApp CTA buttons themselves", () => {
    expect(heroSrc).toContain('href="#quote-estimator"');
    expect(heroSrc).toContain("Get Free Quote");
    expect(heroSrc).toContain("WhatsApp");
  });
});

describe("Scope: the public entry point never renders inside the wholesale portal itself", () => {
  // Matches only real import statements / JSX usage — not prose. (E.g.
  // WholesaleLogin.jsx's own doc-comment explains "Not linked from the
  // public Navbar/Footer on purpose", which mentions the word "Navbar" in
  // plain English and must NOT trip this check.)
  const rendersPublicChrome = (src) =>
    /from\s+["'][^"']*\/(Navbar|Hero|WholesalePortalLink)\.jsx["']/.test(src) ||
    /<(Navbar|Hero|WholesalePortalLink)[\s/>]/.test(src);

  it("WholesaleLogin.jsx never imports or renders Navbar, Hero, or WholesalePortalLink", () => {
    expect(rendersPublicChrome(wholesaleLoginSrc)).toBe(false);
  });

  it("WholesalePrices.jsx never imports or renders Navbar, Hero, or WholesalePortalLink", () => {
    expect(rendersPublicChrome(wholesalePricesSrc)).toBe(false);
  });
});

describe("Scope: no pricing, shop names, or private data anywhere near the public entry point", () => {
  it("WholesalePortalLink never references prices, shop data, or catalog content — it is a pure navigation link", () => {
    expect(linkSrc).not.toMatch(/price|shopName|catalog|equipmentType|category|service/i);
  });
});
