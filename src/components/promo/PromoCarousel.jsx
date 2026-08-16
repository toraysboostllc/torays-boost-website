import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PROMO_SLIDES } from "../../config/promoCarousel.config.js";
import { useLanguage } from "../../i18n/LanguageContext.jsx";

const AUTO_ADVANCE_MS = 3000;
const SWIPE_THRESHOLD_PX = 40;

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-torays-red/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

/**
 * The 5-slide promo carousel shown inside the Home Hero, above the
 * headline. Deliberately compact (single consolidated card, ~150-170px
 * total) so it adds only a small, fixed, language-independent amount of
 * height to the Hero — everything else (eyebrow, headline, description,
 * CTA, trust badges) keeps the exact box it had before this component
 * existed (Hero.jsx's own MIN_H_CLASSES is untouched by this file).
 * No price anywhere. CTA reuses the existing onOpenRepairRequest handler
 * passed down from Home.jsx — no separate modal/state.
 */
export function PromoCarousel({ onOpenRepairRequest }) {
  const { t } = useLanguage();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const touchStartX = useRef(null);
  const total = PROMO_SLIDES.length;

  useEffect(() => {
    if (paused || prefersReducedMotion) return undefined;
    const timer = setTimeout(() => {
      setIndex((i) => (i + 1) % total);
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
    // Re-running on every `index` change (auto OR manual) is what gives a
    // fresh 3s window after any navigation, per spec.
  }, [index, paused, prefersReducedMotion, total]);

  function goTo(next) {
    setIndex(((next % total) + total) % total);
  }
  function goPrev() {
    goTo(index - 1);
  }
  function goNext() {
    goTo(index + 1);
  }

  function onTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e) {
    if (touchStartX.current == null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    if (delta < 0) goNext();
    else goPrev();
  }

  function onKeyDown(e) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goPrev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goNext();
    }
  }

  const trackTransitionClass = prefersReducedMotion ? "" : "transition-transform duration-500 ease-out";

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={t("promoCarousel.regionLabel")}
      className="relative mb-3 h-[150px] max-w-xl overflow-hidden rounded-2xl shadow-[0_1px_2px_rgba(15,20,36,0.04),0_8px_24px_rgba(15,20,36,0.08)] sm:h-[160px] lg:h-[170px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={onKeyDown}
    >
      <div
        className={`flex h-full ${trackTransitionClass}`}
        style={{ transform: `translateX(-${index * 100}%)` }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {PROMO_SLIDES.map((slide, i) => (
          <div key={slide.id} className="relative h-full w-full shrink-0">
            <img
              src={slide.image}
              alt={t(`promoCarousel.slides.${slide.id}.title`)}
              loading={i === 0 ? "eager" : "lazy"}
              className="absolute inset-0 h-full w-full object-cover object-right"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/85 to-transparent" />
            {/* Title/description/CTA live INSIDE the card, in the light
                left zone only — never over the photo's right side, and
                never baked into the image itself (real HTML text). */}
            <div className="relative flex h-full max-w-[58%] flex-col justify-center gap-1 py-3 pl-4 pr-2 sm:max-w-[55%] sm:pl-5">
              <h3 className="line-clamp-1 font-heading text-xs font-semibold text-torays-navy sm:text-sm">
                {t(`promoCarousel.slides.${slide.id}.title`)}
              </h3>
              <p className="line-clamp-2 text-[11px] leading-snug text-torays-text-secondary sm:text-xs">
                {t(`promoCarousel.slides.${slide.id}.description`)}
              </p>
              <button
                type="button"
                onClick={onOpenRepairRequest}
                className={`mt-1 inline-flex w-fit items-center rounded-full bg-torays-red px-3 py-1.5 text-[11px] font-heading font-medium text-white transition-colors hover:bg-torays-red-light sm:text-xs ${FOCUS_RING}`}
              >
                {t("promoCarousel.cta")}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Both arrows grouped together over the photo's (right) side only —
          never above the text zone on the left. */}
      <div className="absolute right-1.5 top-1.5 flex gap-1">
        <button
          type="button"
          onClick={goPrev}
          aria-label={t("promoCarousel.prevLabel")}
          className={`flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-torays-navy shadow-[0_1px_2px_rgba(15,20,36,0.15)] backdrop-blur hover:bg-white ${FOCUS_RING}`}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          onClick={goNext}
          aria-label={t("promoCarousel.nextLabel")}
          className={`flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-torays-navy shadow-[0_1px_2px_rgba(15,20,36,0.15)] backdrop-blur hover:bg-white ${FOCUS_RING}`}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Dot indicators sit inside the card's own bottom edge — no
          separate row, no extra height added. */}
      <div className="absolute inset-x-0 bottom-1 flex items-center justify-center gap-1">
        {PROMO_SLIDES.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => goTo(i)}
            aria-label={t("promoCarousel.goToLabel", { number: i + 1 })}
            aria-current={i === index}
            className={`flex h-6 w-6 items-center justify-center ${FOCUS_RING}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                i === index ? "bg-torays-red" : "bg-white/70"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
