import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PROMO_SLIDES } from "../src/config/promoCarousel.config.js";
import { translations } from "../src/i18n/translations.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const carouselSrc = read("src/components/promo/PromoCarousel.jsx");
const heroSrc = read("src/sections/Hero.jsx");
const homeSrc = read("src/pages/Home.jsx");
const configSrc = read("src/config/promoCarousel.config.js");

const EXPECTED_IDS = ["ps5-cleaning", "ps5-hdmi", "screen-battery", "controller-tmr", "laptop-data-recovery"];

describe("promoCarousel.config.js: 5 slides, no price, correct images", () => {
  it("has exactly the 5 expected slides in order", () => {
    expect(PROMO_SLIDES.map((s) => s.id)).toEqual(EXPECTED_IDS);
  });

  it("every slide has an id, an imported image, a title, and a description — nothing else", () => {
    PROMO_SLIDES.forEach((slide) => {
      expect(Object.keys(slide).sort()).toEqual(["description", "id", "image", "title"]);
      expect(typeof slide.image).toBe("string"); // Vite-imported asset URL
    });
  });

  it("imports the 5 verified local WebP files by their exact converted names", () => {
    expect(configSrc).toContain('from "../assets/promo-ps5-cleaning.webp"');
    expect(configSrc).toContain('from "../assets/promo-ps5-hdmi.webp"');
    expect(configSrc).toContain('from "../assets/promo-screen-battery.webp"');
    expect(configSrc).toContain('from "../assets/promo-controller-tmr.webp"');
    expect(configSrc).toContain('from "../assets/promo-laptop-data-recovery.webp"');
  });

  it("never contains a price, a dollar amount, or an ETA field", () => {
    // strip the /** */ doc comment — it explains "no price field" in
    // prose, which shouldn't trip the check on itself.
    const stripped = configSrc.replace(/\/\*\*[\s\S]*?\*\//g, "");
    expect(stripped).not.toMatch(/\$\d/);
    expect(stripped).not.toMatch(/\bprice\b/i);
    expect(stripped).not.toMatch(/\betaDays?\b/i);
  });
});

describe("i18n: promoCarousel translations match the exact approved EN/ES copy", () => {
  it("EN copy matches exactly what was approved", () => {
    const en = translations.en.promoCarousel;
    expect(en.cta).toBe("Request an Estimate");
    expect(en.common).toBe("Professional service. Affordable repair options.");
    expect(en.slides["ps5-cleaning"]).toEqual({
      title: "PS5 Deep Cleaning + Liquid Metal",
      description: "Professional thermal maintenance for better cooling and performance.",
    });
    expect(en.slides["ps5-hdmi"]).toEqual({
      title: "PS5 HDMI / No Image Repair",
      description: "Professional microsoldering for HDMI and no-image problems.",
    });
    expect(en.slides["screen-battery"]).toEqual({
      title: "Screen & Battery Repair",
      description: "Smartphone and tablet screen and battery replacement.",
    });
    expect(en.slides["controller-tmr"]).toEqual({
      title: "Controller Drift & TMR Upgrade",
      description: "Precision stick-drift repair and TMR joystick upgrades.",
    });
    expect(en.slides["laptop-data-recovery"]).toEqual({
      title: "Laptop Repair & Data Recovery",
      description: "Board-level laptop repair and professional data recovery options.",
    });
  });

  it("ES copy matches exactly what was approved", () => {
    const es = translations.es.promoCarousel;
    expect(es.cta).toBe("Solicitar estimado");
    expect(es.common).toBe("Servicio profesional. Opciones de reparación a su alcance.");
    expect(es.slides["ps5-cleaning"].description).toBe(
      "Mantenimiento térmico profesional para mejorar la refrigeración y el rendimiento."
    );
    expect(es.slides["ps5-hdmi"].description).toBe(
      "Microsoldadura profesional para problemas de HDMI y falta de imagen."
    );
    expect(es.slides["screen-battery"].description).toBe(
      "Reemplazo de pantallas y baterías para teléfonos y tablets."
    );
    expect(es.slides["controller-tmr"].description).toBe(
      "Reparación precisa de drift y actualización de joysticks TMR."
    );
    expect(es.slides["laptop-data-recovery"].description).toBe(
      "Reparación de placas y opciones profesionales de recuperación de datos."
    );
  });

  it("EN and ES have identical key shapes (every slide id present in both, same fields)", () => {
    function keyShape(node) {
      if (node === null || typeof node !== "object") return null;
      return Object.fromEntries(
        Object.entries(node)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, keyShape(v)])
      );
    }
    expect(keyShape(translations.es.promoCarousel)).toEqual(keyShape(translations.en.promoCarousel));
  });

  it("never contains a price in either language", () => {
    const dump = JSON.stringify(translations.en.promoCarousel) + JSON.stringify(translations.es.promoCarousel);
    expect(dump).not.toMatch(/\$\d/);
  });
});

describe("PromoCarousel.jsx: auto-advance, pause, reduced motion, keyboard, swipe", () => {
  it("auto-advances every 6000ms via a timer that depends on [index, paused, prefersReducedMotion]", () => {
    expect(carouselSrc).toContain("const AUTO_ADVANCE_MS = 6000;");
    expect(carouselSrc).toMatch(/setTimeout\(\(\) => \{\s*setIndex/);
    expect(carouselSrc).toMatch(/\}, \[index, paused, prefersReducedMotion, total\]\);/);
  });

  it("re-running the effect on every index change is what resets the timer after manual navigation — no separate reset logic needed", () => {
    // goTo/goPrev/goNext only ever call setIndex, which re-triggers the
    // effect above (documented in the component's own comment).
    expect(carouselSrc).toContain("function goTo(next) {");
    expect(carouselSrc).toContain("setIndex(((next % total) + total) % total);");
  });

  it("pauses on hover, focus, or leaving reduced-motion enabled — never auto-advances in either case", () => {
    expect(carouselSrc).toContain("onMouseEnter={() => setPaused(true)}");
    expect(carouselSrc).toContain("onMouseLeave={() => setPaused(false)}");
    expect(carouselSrc).toContain("onFocus={() => setPaused(true)}");
    expect(carouselSrc).toContain("onBlur={() => setPaused(false)}");
    expect(carouselSrc).toContain("if (paused || prefersReducedMotion) return undefined;");
  });

  it("respects prefers-reduced-motion for both autoplay and the slide transition", () => {
    expect(carouselSrc).toContain('import { useReducedMotion } from "framer-motion"');
    expect(carouselSrc).toContain("const prefersReducedMotion = useReducedMotion();");
    expect(carouselSrc).toContain(
      'const trackTransitionClass = prefersReducedMotion ? "" : "transition-transform duration-500 ease-out";'
    );
  });

  it("keyboard: ArrowLeft/ArrowRight navigate, both call preventDefault so the page doesn't scroll", () => {
    expect(carouselSrc).toContain('if (e.key === "ArrowLeft") {');
    expect(carouselSrc).toContain('} else if (e.key === "ArrowRight") {');
    expect(carouselSrc).toMatch(/ArrowLeft[\s\S]{0,40}e\.preventDefault\(\)[\s\S]{0,20}goPrev\(\)/);
  });

  it("touch swipe: threshold-gated, using touchstart/touchend deltaX", () => {
    expect(carouselSrc).toContain("const SWIPE_THRESHOLD_PX = 40;");
    expect(carouselSrc).toContain("function onTouchStart(e) {");
    expect(carouselSrc).toContain("function onTouchEnd(e) {");
    expect(carouselSrc).toContain("if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;");
  });

  it("has Previous/Next arrow buttons and one dot per slide, all real <button> elements with aria-labels", () => {
    expect(carouselSrc).toContain('aria-label={t("promoCarousel.prevLabel")}');
    expect(carouselSrc).toContain('aria-label={t("promoCarousel.nextLabel")}');
    expect(carouselSrc).toContain('aria-label={t("promoCarousel.goToLabel", { number: i + 1 })}');
    expect(carouselSrc).toContain("aria-current={i === index}");
  });

  it("is a labeled carousel region for assistive tech", () => {
    expect(carouselSrc).toContain('role="region"');
    expect(carouselSrc).toContain('aria-roledescription="carousel"');
    expect(carouselSrc).toContain('aria-label={t("promoCarousel.regionLabel")}');
  });
});

describe("PromoCarousel.jsx: CTA reuses the existing wizard, no duplicated modal/state", () => {
  it("the CTA button's onClick is exactly the onOpenRepairRequest prop — no local modal state", () => {
    expect(carouselSrc).toContain("onClick={onOpenRepairRequest}");
    expect(carouselSrc).not.toMatch(/RepairRequestModal|repairRequestOpen|useState\(false\).*[Mm]odal/);
  });

  it("never imports RepairRequestModal, Supabase, Storage, or any /api/ endpoint", () => {
    expect(carouselSrc).not.toMatch(/RepairRequestModal/);
    expect(carouselSrc).not.toMatch(/supabase/i);
    expect(carouselSrc).not.toMatch(/\/api\//);
  });

  it("Hero.jsx passes the same onOpenRepairRequest prop straight through, unchanged from its own prop", () => {
    expect(heroSrc).toContain("<PromoCarousel onOpenRepairRequest={onOpenRepairRequest} />");
  });

  it("Home.jsx still owns the single repairRequestOpen state and the single RepairRequestModal mount — untouched by this feature", () => {
    expect(homeSrc).toContain("const [repairRequestOpen, setRepairRequestOpen] = useState(false);");
    // 3 occurrences: the import specifier, the import path, and the one
    // conditional JSX mount — i.e. still exactly one <RepairRequestModal>.
    expect((homeSrc.match(/RepairRequestModal/g) || []).length).toBe(3);
    expect((homeSrc.match(/<RepairRequestModal/g) || []).length).toBe(1);
    expect(homeSrc).not.toMatch(/PromoCarousel/); // composed inside Hero, not a Home.jsx sibling section
  });
});

describe("PromoCarousel.jsx: no price, first image eager / rest lazy, no remount on language change", () => {
  it("never renders a price, a range, or an ETA", () => {
    const stripComments = (src) => src.replace(/\/\*\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const stripped = stripComments(carouselSrc);
    expect(stripped).not.toMatch(/\$\d/);
    expect(stripped).not.toMatch(/\bprice\b/i);
    expect(stripped).not.toMatch(/\betaDays?\b/i);
  });

  it("only the first slide is eager-loaded; the rest are lazy", () => {
    expect(carouselSrc).toContain('loading={i === 0 ? "eager" : "lazy"}');
  });

  it("slides are keyed by the stable slide.id, never by language or translated text — so toggling language never remounts an <img>", () => {
    expect(carouselSrc).toContain("key={slide.id}");
    expect(carouselSrc).not.toMatch(/key=\{t\(/);
    expect(carouselSrc).not.toMatch(/key=\{lang\}/);
  });

  it("the active-slide index is plain component state, never derived from or reset by `lang`", () => {
    expect(carouselSrc).toContain("const [index, setIndex] = useState(0);");
    expect(carouselSrc).not.toMatch(/useEffect\([^)]*\{\s*setIndex\(0\)/);
  });

  it("track height is a fixed, language-independent class (h-40/48/56) — never derived from translated text length", () => {
    expect(carouselSrc).toContain("h-40 overflow-hidden rounded-2xl");
    expect(carouselSrc).toContain("sm:h-48 lg:h-56");
  });

  it("uses line-clamp on both title and description so slide-to-slide text length differences never change the fixed-height box", () => {
    expect(carouselSrc).toContain("line-clamp-2");
  });

  it("the shared tagline below the track reserves a fixed 2-line box (line-clamp-2 + min-h) — otherwise ES's longer wording wraps to 2 lines while EN's stays on 1, growing the carousel only in Spanish", () => {
    expect(carouselSrc).toContain('className="line-clamp-2 min-h-8 text-xs text-torays-text-secondary sm:min-h-10 sm:text-sm"');
  });
});

describe("PromoCarousel.jsx: accessibility and touch targets", () => {
  it("every interactive control carries the shared focus-visible ring", () => {
    expect(carouselSrc).toContain("focus-visible:outline-none");
    expect(carouselSrc).toContain("focus-visible:ring-2");
  });

  it("arrow buttons and dot buttons meet the 44px minimum touch target", () => {
    expect(carouselSrc).toMatch(/flex h-11 w-11 -translate-y-1\/2/); // arrows
    expect(carouselSrc).toContain("flex h-11 w-11 items-center justify-center"); // dots
  });

  it("the CTA button explicitly enforces the 44px minimum on top of the shared Button component", () => {
    expect(carouselSrc).toContain('className="min-h-11 min-w-11 shrink-0 self-center sm:self-auto"');
  });
});

describe("Scope: only the public Home, never Wholesale or Torays Boost Pro", () => {
  it("PromoCarousel never mentions wholesale in any form", () => {
    expect(carouselSrc).not.toMatch(/wholesale/i);
  });

  it("promoCarousel.config.js never mentions wholesale in any form", () => {
    expect(configSrc).not.toMatch(/wholesale/i);
  });

  it("Hero.jsx's own Wholesale-exclusion guarantees are untouched (still no wholesale references)", () => {
    expect(heroSrc).not.toMatch(/wholesale-login-collage|wholesale-pcb-background|wsp-scope/i);
  });
});
