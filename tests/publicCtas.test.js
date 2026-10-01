import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Structural/text-based checks on the public CTAs — WhatsApp and the Shop
 * button (the Torays Boost Pro entry was retired on 2026-10-01) — same approach as every other
 * test file in this project (no React render harness configured), reading
 * the actual component source as text and asserting the specific
 * properties this feature requires.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const whatsappSrc = read("src/components/layout/WhatsAppCta.jsx");
const navbarSrc = read("src/components/layout/Navbar.jsx");
const heroSrc = read("src/sections/Hero.jsx");

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

describe("WhatsAppCta: gated behind the friendly WhatsApp prompt, never a direct wa.me link", () => {
  it("never builds or opens a wa.me link itself — it's a plain button that calls the onClick it's given", () => {
    // Strip the /** */ doc comment first — it explains in prose why this
    // component no longer touches wa.me, which shouldn't trip the check
    // that's verifying exactly that.
    const stripped = whatsappSrc.replace(/\/\*\*[\s\S]*?\*\//g, "");
    expect(stripped).not.toMatch(/buildContactLink|buildWhatsAppLink|wa\.me/);
    expect(stripped).not.toMatch(/target="_blank"|rel="noreferrer"/);
    expect(stripped).toMatch(/<button\s/);
    expect(stripped).toContain('onClick={onClick}');
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

describe("Accessibility: WCAG AA contrast (>=4.5:1) for the WhatsApp CTA", () => {
  it("WhatsAppCta text passes 4.5:1 against every gradient stop, base and hover", () => {
    const text = extractTextColor(whatsappSrc, "GREEN_XP_LIGHT");
    const [base, hover] = extractGradientStops(whatsappSrc, "GREEN_XP_LIGHT");
    expect(base.length).toBe(3);
    expect(hover.length).toBe(3);
    [...base, ...hover].forEach((stop) => {
      expect(contrastRatio(text, stop)).toBeGreaterThanOrEqual(4.5);
    });
  });
});

describe("Navbar: exactly one WhatsApp CTA and one Shop CTA per context (Torays Boost Pro chip retired)", () => {
  it("desktop header group renders exactly one ShopLink and one WhatsAppCta, both variant=\"header\"", () => {
    expect(navbarSrc).toContain('import { ShopLink } from "./ShopLink.jsx"');
    expect(navbarSrc).not.toContain("WholesalePortalLink");
    expect(navbarSrc).toContain('import { WhatsAppCta } from "./WhatsAppCta.jsx"');
    const desktopGroup = navbarSrc.match(/<div className="hidden xl:flex items-center gap-3">[\s\S]*?<\/div>/)[0];
    expect((desktopGroup.match(/<ShopLink/g) || []).length).toBe(1);
    expect((desktopGroup.match(/<WhatsAppCta/g) || []).length).toBe(1);
    expect(desktopGroup).toContain('<ShopLink variant="header" />');
    expect(desktopGroup).toContain('<WhatsAppCta variant="header" onClick={onWhatsAppClick} />');
  });

  it("mobile drawer renders exactly one ShopLink and one WhatsAppCta, both variant=\"mobile\", each closing the drawer on click", () => {
    const drawer = navbarSrc.match(/<div className="flex flex-col gap-6 px-8 py-10">[\s\S]*?<\/div>\s*<\/motion\.div>/)[0];
    expect((drawer.match(/<ShopLink/g) || []).length).toBe(1);
    expect((drawer.match(/<WhatsAppCta/g) || []).length).toBe(1);
    expect(drawer).toMatch(/<ShopLink variant="mobile"[^>]*onClick=\{\(\) => setOpen\(false\)\}/);
    const mobileWhatsAppBlock = drawer.match(/<WhatsAppCta\s+variant="mobile"[\s\S]*?\/>/)[0];
    expect(mobileWhatsAppBlock).toContain("setOpen(false)");
    expect(mobileWhatsAppBlock).toContain("onWhatsAppClick()");
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
