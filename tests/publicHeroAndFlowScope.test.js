import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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

  it("has the approved headline, description, and CTA copy", () => {
    expect(heroSrc).toContain("Expert Repair for Phones, Consoles &amp; Computers");
    expect(heroSrc).toContain(
      "Professional diagnostics and electronics repair for iPhone, iPad, smartphones, PS5, Xbox, MacBook,"
    );
    expect(heroSrc).toContain("Start Your Repair Request");
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
