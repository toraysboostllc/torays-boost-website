import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { translations } from "../src/i18n/translations.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const heroSrc = read("src/sections/Hero.jsx");
const homeSrc = read("src/pages/Home.jsx");
const howItWorksSrc = read("src/sections/HowItWorks.jsx");
const featuresConfigSrc = read("src/config/features.config.js");

describe("Hero: real asset, public-only, no price, no old placeholder", () => {
  it("ships the collage as a local WebP asset, and the source PNG never enters the repo", () => {
    expect(existsSync(join(root, "src/assets/public-repair-hero.webp"))).toBe(true);
    expect(existsSync(join(root, "src/assets/public-repair-hero-source.png"))).toBe(false);
  });

  it("Hero.jsx is the only file that imports the public repair hero asset", () => {
    expect(heroSrc).toMatch(/import heroImage from ["']\.\.\/assets\/public-repair-hero\.webp["']/);
    const otherSrcFiles = ["src/pages/WholesaleLogin.jsx", "src/pages/WholesalePrices.jsx", "src/styles/wholesalePortal.css"].map(read);
    otherSrcFiles.forEach((src) => expect(src).not.toMatch(/public-repair-hero/));
  });

  it("never uses the private Wholesale login collage or PCB background", () => {
    expect(heroSrc).not.toMatch(/wholesale-login-collage|wholesale-pcb-background|wsp-scope/);
  });

  it("no longer renders the old microscope/badge placeholder", () => {
    expect(heroSrc).not.toContain("HeroVisual");
    expect(heroSrc).not.toContain("Microscope");
    expect(heroSrc).not.toMatch(/"PS5", "iPhone", "MacBook"/);
  });

  it("renders the headline/description/CTA through translations, and the EN copy is the approved copy", () => {
    expect(heroSrc).toContain('t("hero.titlePrefix")');
    expect(heroSrc).toContain('t("hero.titleHighlight")');
    expect(heroSrc).toContain('t("hero.description")');
    expect(heroSrc).toContain('t("hero.cta")');
    expect(translations.en.hero.titlePrefix).toBe("Expert Repair for");
    expect(translations.en.hero.titleHighlight).toBe("Phones, Consoles & Computers");
    expect(translations.en.hero.description).toContain(
      "Professional diagnostics and electronics repair for iPhone, iPad, smartphones, PS5, Xbox, MacBook,"
    );
    expect(translations.en.hero.cta).toBe("Start Your Repair Request");
  });

  it("the CTA opens the wizard directly — no price, no anchor to a removed section", () => {
    expect(heroSrc).toContain("onClick={onOpenRepairRequest}");
    expect(heroSrc).not.toMatch(/href="#quote-estimator"/);
  });

  it("covers the Hero without repeating or deforming — background-size cover, no-repeat, non-stretched mobile image", () => {
    expect(heroSrc).toMatch(/bg-cover/);
    expect(heroSrc).toMatch(/bg-no-repeat/);
    expect(heroSrc).toContain("object-cover"); // mobile <img> block, never stretched
  });

  it("has a distinct mobile vs desktop/tablet treatment (no full-bleed crop fight at narrow widths)", () => {
    expect(heroSrc).toMatch(/hidden[^"]*sm:block/);
    expect(heroSrc).toMatch(/sm:hidden/);
  });

  it("never shows a price anywhere in the Hero", () => {
    expect(heroSrc).not.toMatch(/\$\d/);
    expect(heroSrc).not.toMatch(/starting at/i);
  });
});

describe("Hero typography: navy + vivid-blue headline, discrete red accent, never solid black/bold-only text", () => {
  function srgbToLinear(c) {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }
  function relativeLuminance(hex) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
  }
  function contrastRatio(hexA, hexB) {
    const lA = relativeLuminance(hexA);
    const lB = relativeLuminance(hexB);
    const [lighter, darker] = lA > lB ? [lA, lB] : [lB, lA];
    return (lighter + 0.05) / (darker + 0.05);
  }

  it("headline is Torays navy, product-line half is a vivid blue — never a fully red headline", () => {
    expect(heroSrc).toContain("text-[#0B2F6B]");
    expect(heroSrc).toContain("text-[#1464D2]");
    // The <h1> itself carries no red text class — red is limited to the
    // small accent bar and the (unrelated) eyebrow pill above it.
    const h1Block = heroSrc.match(/<h1[\s\S]*?<\/h1>/)[0];
    expect(h1Block).not.toMatch(/text-torays-red|text-red|#[Ee]3[12][0-9A-Fa-f]{4}/);
  });

  it("both headline colors pass WCAG AA (>=4.5:1) against a white page background", () => {
    expect(contrastRatio("0B2F6B", "FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("1464D2", "FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });

  it("headline weight is semibold, not bold — a lighter touch than the old treatment", () => {
    expect(heroSrc).toContain("font-semibold");
    const h1Block = heroSrc.match(/<h1[\s\S]*?<\/h1>/)[0];
    expect(h1Block).not.toMatch(/font-bold|font-extrabold|font-black/);
  });

  it("carries a short red accent bar next to the headline, not a red headline", () => {
    expect(heroSrc).toMatch(/h-1 w-12 rounded-full bg-torays-red/);
  });

  it("the paragraph is a dark blue-gray, never black or near-black", () => {
    expect(heroSrc).toContain("text-[#3D4A66]");
    expect(heroSrc).not.toMatch(/text-black\b/);
    expect(heroSrc).not.toMatch(/#000000|#000\b/i);
  });

  it("keeps the red 'Start Your Repair Request' button untouched by the typography change", () => {
    expect(heroSrc).toContain("onClick={onOpenRepairRequest}");
    expect(heroSrc).toContain('t("hero.cta")');
  });
});

describe("Hero framing: stable across languages (no re-crop/zoom on the collage when toggling)", () => {
  it("MIN_H_CLASSES is a plain module-level string constant — declared before useLanguage() even runs, so it structurally cannot depend on `t` or `lang`", () => {
    const constMatch = heroSrc.match(/const MIN_H_CLASSES = "([^"]+)";/);
    expect(constMatch).toBeTruthy();
    const declarationIndex = heroSrc.indexOf("const MIN_H_CLASSES");
    const useLanguageIndex = heroSrc.indexOf("useLanguage()");
    expect(declarationIndex).toBeGreaterThan(-1);
    expect(useLanguageIndex).toBeGreaterThan(-1);
    expect(declarationIndex).toBeLessThan(useLanguageIndex);
    // The constant string itself is static — no template interpolation,
    // no reference to t(...) or lang.
    expect(constMatch[1]).not.toMatch(/\$\{|t\(|lang/);
  });

  it("locks in the exact measured min-height per tier (base/390/sm), each equal to Spanish's own natural height at that width — sm and lg were later found identical (content height stops changing past sm) and collapsed into one tier", () => {
    expect(heroSrc).toContain("min-h-[720px]");
    expect(heroSrc).toContain("min-[390px]:min-h-[686px]");
    expect(heroSrc).toContain("sm:min-h-[633px]");
    expect(heroSrc).not.toMatch(/lg:min-h-\[\d+px\]/);
  });

  it("the content column is top-aligned, so a shorter language's leftover slack lands below the trust badges instead of reopening a gap above the eyebrow", () => {
    expect(heroSrc).toContain("justify-start");
    expect(heroSrc).not.toMatch(/justify-center gap-8 \$\{MIN_H_CLASSES\}/);
  });

  it("the old py-20/py-28 vertical-padding mechanism is gone — height now comes from MIN_H_CLASSES, not content-driven padding", () => {
    expect(heroSrc).not.toMatch(/sm:py-20|lg:py-28/);
  });

  it("the Hero content column applies MIN_H_CLASSES directly, not conditionally by language", () => {
    const classNameMatch = heroSrc.match(/className=\{`([^`]*)\$\{MIN_H_CLASSES\}`\}/);
    expect(classNameMatch).toBeTruthy();
    expect(classNameMatch[1]).not.toMatch(/\$\{t\(|\$\{lang/);
  });

  it("neither the bg-cover image layer nor the mobile <img> is keyed by language — same element, same src, never remounted on toggle", () => {
    expect(heroSrc).not.toMatch(/key=\{lang\}/);
    expect(heroSrc).not.toMatch(/key=\{t\(/);
    // Only `alt` (translated copy) may vary by language on the <img>; src
    // itself is the static imported asset.
    const imgBlock = heroSrc.match(/<img[\s\S]*?\/>/)[0];
    expect(imgBlock).toContain("src={heroImage}");
    expect(imgBlock).not.toMatch(/src=\{.*t\(/);
  });

  it("the bg-cover size/position/no-repeat classes are unconditional — never swapped per language", () => {
    const bgLayerMatch = heroSrc.match(/<div\s+className="([^"]*bg-cover[^"]*)"/);
    expect(bgLayerMatch).toBeTruthy();
    expect(bgLayerMatch[1]).toContain("bg-cover");
    expect(bgLayerMatch[1]).toContain("bg-right");
    expect(bgLayerMatch[1]).toContain("bg-no-repeat");
    expect(bgLayerMatch[1]).not.toMatch(/\$\{|t\(/);
  });

  it("public-repair-hero.webp itself is never touched by this fix (only layout classes changed)", () => {
    expect(heroSrc).toContain('import heroImage from "../assets/public-repair-hero.webp"');
  });
});

describe("Home.jsx: mounts the wizard modal only while open, old QuoteEstimator gone", () => {
  it("no longer imports or renders QuoteEstimator", () => {
    expect(homeSrc).not.toMatch(/QuoteEstimator/);
  });

  it("mounts RepairRequestModal conditionally on open state, wired to Hero's CTA", () => {
    expect(homeSrc).toContain('import { RepairRequestModal } from "../components/repair/RepairRequestModal.jsx"');
    expect(homeSrc).toContain("{repairRequestOpen && <RepairRequestModal onClose={() => setRepairRequestOpen(false)} />}");
    expect(homeSrc).toContain("onOpenRepairRequest={() => setRepairRequestOpen(true)}");
  });
});

describe("Old price-based estimator: fully removed, zero remaining consumers", () => {
  it("pricing.config.js, useQuoteEstimator.js, and QuoteEstimator.jsx no longer exist", () => {
    expect(existsSync(join(root, "src/config/pricing.config.js"))).toBe(false);
    expect(existsSync(join(root, "src/hooks/useQuoteEstimator.js"))).toBe(false);
    expect(existsSync(join(root, "src/sections/QuoteEstimator.jsx"))).toBe(false);
  });
});

describe("How It Works: updated to the 3-step no-price flow, overflow bug fixed", () => {
  it("processSteps has exactly the 3 approved steps", () => {
    expect(featuresConfigSrc).toMatch(/title: "Select Your Device"/);
    expect(featuresConfigSrc).toMatch(/title: "Answer Three Quick Questions"/);
    expect(featuresConfigSrc).toMatch(/title: "Send Your Request"/);
    const stepMatches = featuresConfigSrc.match(/\{ id: \d+, title:/g);
    expect(stepMatches.length).toBe(3);
  });

  it("no longer promises an automatic price/estimate in the process copy", () => {
    expect(featuresConfigSrc).not.toMatch(/instant price|receive an estimate/i);
  });

  it("grid matches the 3-step layout, not the old 5-step grid", () => {
    expect(howItWorksSrc).toContain("sm:grid-cols-3");
    expect(howItWorksSrc).not.toContain("sm:grid-cols-5");
  });

  it("fixes the preexisting overflow bug — connector line no longer combines left-1/2 with w-full", () => {
    expect(howItWorksSrc).not.toMatch(/sm:left-1\/2[\s\S]{0,40}sm:w-full/);
    expect(howItWorksSrc).toContain("sm:inset-x-0");
  });
});

describe("Confirmed public contacts wired through site.config.js only", () => {
  it("Contact.jsx displays the approved formatted WhatsApp number, not the raw digits", () => {
    const contactSrc = read("src/sections/Contact.jsx");
    expect(contactSrc).toContain("siteConfig.whatsapp.displayNumber");
  });

  it("no component hardcodes the WhatsApp number or email outside site.config.js", () => {
    const filesToCheck = [
      "src/sections/Hero.jsx",
      "src/components/repair/RepairRequestModal.jsx",
      "src/hooks/useRepairRequest.js",
      "src/lib/repairRequestMessage.js",
    ];
    filesToCheck.forEach((relPath) => {
      const src = read(relPath);
      expect(src).not.toMatch(/13053011152/);
      expect(src).not.toMatch(/toraysboost@gmail\.com/);
    });
  });
});

describe("Wholesale stays completely untouched by this feature", () => {
  it("no repair-request file imports any Wholesale module or asset", () => {
    // strip doc comments first — Hero.jsx's own header explains "never the
    // private Wholesale login collage" in prose, which isn't an import and
    // shouldn't trip this check on itself.
    const stripComments = (src) => src.replace(/\/\*\*[\s\S]*?\*\//g, "");
    const filesToCheck = [
      "src/sections/Hero.jsx",
      "src/pages/Home.jsx",
      "src/hooks/useRepairRequest.js",
      "src/components/repair/RepairRequestModal.jsx",
      "src/lib/repairRequestMessage.js",
      "src/config/repairRequest.config.js",
    ];
    filesToCheck.forEach((relPath) => {
      const src = stripComments(read(relPath));
      expect(src, relPath).not.toMatch(/wholesale/i);
    });
  });

  it("Wholesale's own catalog UI never imports the new repair-request config or components", () => {
    const wholesaleFiles = ["src/pages/WholesaleLogin.jsx", "src/pages/WholesalePrices.jsx"];
    wholesaleFiles.forEach((relPath) => {
      const src = read(relPath);
      expect(src).not.toMatch(/repairRequest|RepairRequestModal|useRepairRequest/);
    });
  });
});
