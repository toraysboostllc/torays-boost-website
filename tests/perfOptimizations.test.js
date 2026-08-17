import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const heroSrc = read("src/sections/Hero.jsx");
const appSrc = read("src/App.jsx");

describe("Hero: critical content (H1/description/CTA/trust badges) renders with no entrance animation", () => {
  it("no longer imports framer-motion — nothing left in this file needs it", () => {
    expect(heroSrc).not.toMatch(/from ["']framer-motion["']/);
  });

  it("the content column is a plain div, not a motion.div — no opacity/transform/delay on mount", () => {
    expect(heroSrc).not.toMatch(/<motion\.\w+/);
    expect(heroSrc).not.toMatch(/initial=\{\{[^}]*opacity/);
    expect(heroSrc).not.toMatch(/animate=\{\{/);
    expect(heroSrc).not.toMatch(/transition=\{\{/);
  });

  it("the H1, description, and CTA button are still present with their exact text/classes unchanged", () => {
    expect(heroSrc).toContain('<h1 className="text-5xl font-heading font-semibold leading-[1.08] text-[#0B2F6B] sm:text-6xl">');
    expect(heroSrc).toContain('{t("hero.titlePrefix")}');
    expect(heroSrc).toContain('<p className="text-lg leading-relaxed text-[#3D4A66] sm:text-xl">{t("hero.description")}</p>');
    expect(heroSrc).toMatch(/<Button type="button" onClick=\{onOpenRepairRequest\} size="lg" icon=\{ArrowRight\}/);
  });

  it("trust badges (secondary content) still render inside the same static column", () => {
    expect(heroSrc).toContain("<TrustBadges />");
  });
});

describe("App.jsx: route-level code-splitting — Home stays eager, non-critical routes are lazy", () => {
  it("Home, Navbar-critical path, and NotFound are statically imported — never lazy", () => {
    expect(appSrc).toContain('import { Home } from "./pages/Home.jsx"');
    expect(appSrc).toContain('import { NotFound } from "./pages/NotFound.jsx"');
    expect(appSrc).not.toMatch(/lazy\(\(\) => import\(["']\.\/pages\/Home\.jsx["']/);
    expect(appSrc).not.toMatch(/lazy\(\(\) => import\(["']\.\/pages\/NotFound\.jsx["']/);
  });

  it("Privacy, Terms, ImageCredits, WholesaleLogin, and WholesalePrices are all lazy-loaded", () => {
    ["Privacy", "Terms", "ImageCredits", "WholesaleLogin", "WholesalePrices"].forEach((name) => {
      expect(appSrc).toMatch(new RegExp(`const ${name} = lazy\\(\\(\\) =>\\s*\\n?\\s*import\\("\\./pages/${name}\\.jsx"\\)`));
    });
  });

  it("the routes are wrapped in a single Suspense with a fallback", () => {
    expect(appSrc).toMatch(/<Suspense fallback=\{<RouteLoadingFallback \/>\}>[\s\S]*<Routes>/);
    expect(appSrc).toMatch(/<\/Routes>\s*<\/Suspense>/);
  });

  it("the loading fallback is a lightweight, accessible, non-CLS-causing placeholder — no spinner library, no fixed pixel height that could jump", () => {
    const fallbackFn = appSrc.match(/function RouteLoadingFallback\(\) \{[\s\S]*?\n\}/)[0];
    expect(fallbackFn).toContain("min-h-screen");
    expect(fallbackFn).toContain('role="status"');
    expect(fallbackFn).toContain('aria-live="polite"');
    expect(fallbackFn).toContain('t("common.loading")');
    expect(fallbackFn).not.toMatch(/spinner|Spinner|svg/i);
  });
});
