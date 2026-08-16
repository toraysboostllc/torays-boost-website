import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Structural/text-based checks on the two public CTAs — WhatsApp and the
 * "Torays Boost Pro" wholesale entry point — same approach as every other
 * test file in this project (no React render harness configured), reading
 * the actual component source as text and asserting the specific
 * properties this feature requires.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const linkSrc = read("src/components/layout/WholesalePortalLink.jsx");
const whatsappSrc = read("src/components/layout/WhatsAppCta.jsx");
const navbarSrc = read("src/components/layout/Navbar.jsx");
const heroSrc = read("src/sections/Hero.jsx");
const wholesaleLoginSrc = read("src/pages/WholesaleLogin.jsx");
const wholesalePricesSrc = read("src/pages/WholesalePrices.jsx");

// WCAG relative-luminance / contrast-ratio math (same formula as the WCAG
// 2.x spec) — used below to assert, not just eyeball, that the button text
// colors meet AA (>=4.5:1) against every gradient stop actually shipped in
// source, in both the base and hover backgrounds.
function relativeLuminance(hex) {
  const clean = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16) / 255);
  const channel = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function contrastRatio(hexA, hexB) {
  const [l1, l2] = [relativeLuminance(hexA), relativeLuminance(hexB)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}
function extractGradientStops(src, varName) {
  const decl = src.match(new RegExp(`const ${varName} =[\\s\\S]*?;`))[0];
  const gradients = decl.match(/linear-gradient\([^)]+\)/g) || [];
  return gradients.map((g) => [...g.matchAll(/#([0-9a-f]{6})/gi)].map((m) => `#${m[1]}`));
}
function extractTextColor(src, varName) {
  const decl = src.match(new RegExp(`const ${varName} =[\\s\\S]*?;`))[0];
  return decl.match(/text-\[(#[0-9a-f]{6})\]/i)[1];
}

describe("WhatsAppCta: destination, mechanics, and green XP style", () => {
  it("keeps the existing wa.me destination — built from buildContactLink(), same as before this restyle", () => {
    expect(whatsappSrc).toContain('import { buildContactLink } from "../../lib/whatsapp.js"');
    expect(whatsappSrc).toContain("href={buildContactLink(t(\"common.whatsappDefaultMessage\"))}");
  });

  it("opens in a new tab via a plain <a> — correct for an external link, unlike the internal /wholesale Link", () => {
    expect(whatsappSrc).toContain('target="_blank"');
    expect(whatsappSrc).toContain('rel="noreferrer"');
    expect(whatsappSrc).toMatch(/<a\s/);
  });

  it("guarantees a minimum 44px touch target on both variants", () => {
    expect(whatsappSrc).toMatch(/VARIANT_CLASSES = \{[\s\S]*?header:[\s\S]*?min-h-11/);
    expect(whatsappSrc).toMatch(/VARIANT_CLASSES = \{[\s\S]*?mobile:[\s\S]*?min-h-11/);
  });

  it("has a visible :focus-visible ring — keyboard accessible, not just mouse-hoverable", () => {
    expect(whatsappSrc).toContain("focus-visible:outline-none");
    expect(whatsappSrc).toContain("focus-visible:ring-2");
  });

  it("uses a light green XP-style gradient with dark WCAG-compliant text, not white", () => {
    expect(whatsappSrc).toMatch(/bg-\[linear-gradient\(180deg,#[0-9a-f]+_0%,#[0-9a-f]+_48%,#[0-9a-f]+_100%\)\]/);
    expect(whatsappSrc).not.toContain("text-white");
    expect(whatsappSrc).toMatch(/text-\[#[0-9a-f]{6}\]/i);
  });

  it("brightens/shifts on hover and gives tactile feedback on press", () => {
    expect(whatsappSrc).toMatch(/hover:bg-\[linear-gradient/);
    expect(whatsappSrc).toContain("active:translate-y-px");
  });

  it("uses the MessageCircle icon from the existing lucide-react icon system", () => {
    expect(whatsappSrc).toContain('import { MessageCircle } from "lucide-react"');
  });

  it("never references prices, shop data, or catalog content", () => {
    expect(whatsappSrc).not.toMatch(/price|shopName|catalog|equipmentType|category/i);
  });
});

describe("WholesalePortalLink: destination, copy, and navigation mechanics", () => {
  it("uses exactly /wholesale as the destination — no absolute URL, no Preview/production domain", () => {
    expect(linkSrc).toContain('to="/wholesale"');
    expect(linkSrc).not.toMatch(/https?:\/\//);
    expect(linkSrc).not.toMatch(/toraysboost\.com/i);
    expect(linkSrc).not.toMatch(/vercel\.app/i);
  });

  it("uses react-router-dom's <Link> for same-tab SPA navigation — never target=\"_blank\" or a plain <a href>", () => {
    expect(linkSrc).toContain('import { Link } from "react-router-dom"');
    const codeOnly = linkSrc.replace(/\/\*\*[\s\S]*?\*\//, "");
    expect(codeOnly).not.toContain("target=");
    expect(codeOnly).not.toContain('rel="noreferrer"');
    expect(codeOnly).not.toMatch(/<a\s/);
  });

  it("renders the exact primary text \"Torays Boost Pro\" and secondary text \"For Repair Shops\"", () => {
    expect(linkSrc).toContain("Torays Boost Pro");
    expect(linkSrc).toContain("For Repair Shops");
  });

  it("carries a clear, descriptive aria-label", () => {
    expect(linkSrc).toContain('const ARIA_LABEL = "Torays Boost Pro — For Repair Shops"');
    expect(linkSrc).toContain("aria-label={ARIA_LABEL}");
  });

  it("never imports or calls any wholesale API/auth module — a plain navigation link only, nothing loads before a click", () => {
    expect(linkSrc).not.toMatch(/wholesaleAuth|fetchWholesaleCatalog|wholesaleLogin|api\/wholesale/);
  });

  it("guarantees a minimum 44px touch target on both variants (min-h-11 = 44px in this Tailwind config)", () => {
    expect(linkSrc).toMatch(/VARIANT_CLASSES = \{[\s\S]*?header:[\s\S]*?min-h-11/);
    expect(linkSrc).toMatch(/VARIANT_CLASSES = \{[\s\S]*?mobile:[\s\S]*?min-h-11/);
  });

  it("no longer defines an unused 'hero' variant — removed along with the Hero placement", () => {
    expect(linkSrc).not.toMatch(/variant === "hero"/);
    expect(linkSrc).not.toMatch(/hero:\s*"/);
  });

  it("has a visible :focus-visible ring — keyboard accessible, not just mouse-hoverable", () => {
    expect(linkSrc).toContain("focus-visible:outline-none");
    expect(linkSrc).toContain("focus-visible:ring-2");
  });

  it("uses a light purple XP-style gradient with dark WCAG-compliant text, not white, plus the small red Torays accent dot", () => {
    expect(linkSrc).toMatch(/bg-\[linear-gradient\(180deg,#[0-9a-f]+_0%,#[0-9a-f]+_48%,#[0-9a-f]+_100%\)\]/);
    expect(linkSrc).not.toContain("text-white");
    expect(linkSrc).toMatch(/text-\[#[0-9a-f]{6}\]/i);
    expect(linkSrc).toContain("bg-torays-red"); // the small Torays accent dot, kept
    expect(linkSrc).not.toMatch(/bg-torays-red\/\d+.*text-white|VARIANTS\.primary/); // never mimics the primary WhatsApp button styling
  });

  it("brightens/shifts on hover and gives tactile feedback on press", () => {
    expect(linkSrc).toMatch(/hover:bg-\[linear-gradient/);
    expect(linkSrc).toContain("active:translate-y-px");
  });

  it("uses the Store icon from the existing lucide-react icon system — no new icon library, no custom SVG", () => {
    expect(linkSrc).toContain('import { Store } from "lucide-react"');
  });
});

describe("Accessibility: WCAG AA contrast (>=4.5:1) for both public CTA buttons", () => {
  it("WhatsAppCta text passes 4.5:1 against every gradient stop, base and hover", () => {
    const text = extractTextColor(whatsappSrc, "GREEN_XP_LIGHT");
    const [base, hover] = extractGradientStops(whatsappSrc, "GREEN_XP_LIGHT");
    expect(base.length).toBe(3);
    expect(hover.length).toBe(3);
    [...base, ...hover].forEach((stop) => {
      expect(contrastRatio(text, stop)).toBeGreaterThanOrEqual(4.5);
    });
  });

  it("WholesalePortalLink text passes 4.5:1 against every gradient stop, base and hover", () => {
    const text = extractTextColor(linkSrc, "PURPLE_XP_LIGHT");
    const [base, hover] = extractGradientStops(linkSrc, "PURPLE_XP_LIGHT");
    expect(base.length).toBe(3);
    expect(hover.length).toBe(3);
    [...base, ...hover].forEach((stop) => {
      expect(contrastRatio(text, stop)).toBeGreaterThanOrEqual(4.5);
    });
  });
});

describe("Navbar: exactly one WhatsApp CTA and one Torays Boost Pro CTA per context", () => {
  it("desktop header group renders exactly one WholesalePortalLink and one WhatsAppCta, both variant=\"header\"", () => {
    expect(navbarSrc).toContain('import { WholesalePortalLink } from "./WholesalePortalLink.jsx"');
    expect(navbarSrc).toContain('import { WhatsAppCta } from "./WhatsAppCta.jsx"');
    const desktopGroup = navbarSrc.match(/<div className="hidden md:flex items-center gap-3">[\s\S]*?<\/div>/)[0];
    expect((desktopGroup.match(/<WholesalePortalLink/g) || []).length).toBe(1);
    expect((desktopGroup.match(/<WhatsAppCta/g) || []).length).toBe(1);
    expect(desktopGroup).toContain('<WholesalePortalLink variant="header" />');
    expect(desktopGroup).toContain('<WhatsAppCta variant="header" />');
  });

  it("mobile drawer renders exactly one WholesalePortalLink and one WhatsAppCta, both variant=\"mobile\", each closing the drawer on click", () => {
    const drawer = navbarSrc.match(/<div className="flex flex-col gap-6 px-8 py-10">[\s\S]*?<\/div>\s*<\/motion\.div>/)[0];
    expect((drawer.match(/<WholesalePortalLink/g) || []).length).toBe(1);
    expect((drawer.match(/<WhatsAppCta/g) || []).length).toBe(1);
    expect(drawer).toMatch(/<WholesalePortalLink variant="mobile"[^>]*onClick=\{\(\) => setOpen\(false\)\}/);
    expect(drawer).toMatch(/<WhatsAppCta variant="mobile"[^>]*onClick=\{\(\) => setOpen\(false\)\}/);
  });

  it("no longer imports the shared Button component or buildContactLink directly — WhatsAppCta owns its own destination now", () => {
    expect(navbarSrc).not.toMatch(/from ["'].*\/Button\.jsx["']/);
    expect(navbarSrc).not.toContain("buildContactLink");
  });

  it("does not change the existing #anchor nav links", () => {
    expect(navbarSrc).toContain('"#services"');
  });
});

describe("Hero: only the primary repair-request CTA remains", () => {
  it("keeps the repair-request CTA as the sole button in the Hero", () => {
    expect(heroSrc).toContain("onClick={onOpenRepairRequest}");
    expect(heroSrc).toContain('t("hero.cta")');
    expect((heroSrc.match(/<Button/g) || []).length).toBe(1);
  });

  it("no longer renders a WhatsApp CTA or imports MessageCircle/buildContactLink", () => {
    expect(heroSrc).not.toContain("WhatsApp");
    expect(heroSrc).not.toContain("MessageCircle");
    expect(heroSrc).not.toContain("buildContactLink");
  });

  it("no longer renders or imports WholesalePortalLink", () => {
    expect(heroSrc).not.toContain("WholesalePortalLink");
  });
});

describe("Scope: the public CTAs never render inside the wholesale portal itself", () => {
  // Matches only real import statements / JSX usage — not prose. (E.g.
  // WholesaleLogin.jsx's own doc-comment explains "Not linked from the
  // public Navbar/Footer on purpose", which mentions the word "Navbar" in
  // plain English and must NOT trip this check.)
  const rendersPublicChrome = (src) =>
    /from\s+["'][^"']*\/(Navbar|Hero|WholesalePortalLink|WhatsAppCta)\.jsx["']/.test(src) ||
    /<(Navbar|Hero|WholesalePortalLink|WhatsAppCta)[\s/>]/.test(src);

  it("WholesaleLogin.jsx never imports or renders Navbar, Hero, WholesalePortalLink, or WhatsAppCta", () => {
    expect(rendersPublicChrome(wholesaleLoginSrc)).toBe(false);
  });

  it("WholesalePrices.jsx never imports or renders Navbar, Hero, WholesalePortalLink, or WhatsAppCta", () => {
    expect(rendersPublicChrome(wholesalePricesSrc)).toBe(false);
  });
});

describe("Scope: no pricing, shop names, or private data anywhere near the public entry points", () => {
  it("WholesalePortalLink never references prices, shop data, or catalog content — it is a pure navigation link", () => {
    expect(linkSrc).not.toMatch(/price|shopName|catalog|equipmentType|category|service/i);
  });
});
