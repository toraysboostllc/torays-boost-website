import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/Button.jsx";
import { PROMO_SLIDES } from "../../config/promoCarousel.config.js";
import { useLanguage } from "../../i18n/LanguageContext.jsx";

const AUTO_ADVANCE_MS = 6000;
const SWIPE_THRESHOLD_PX = 40;

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-torays-red/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

/**
 * The 5-slide promo carousel shown inside the Home Hero, above the
 * headline — occupies the space that previously sat empty between the
 * fixed navbar and the "TORAYS BOOST LLC" eyebrow. Deliberately fixed
 * height per breakpoint (h-40/48/56, never content-driven) so it can
 * never introduce the same English/Spanish framing drift the Hero's own
 * text column already had fixed for it — see Hero.jsx's own doc comment.
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
    // fresh 6s window after any navigation, per spec.
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
      className="mb-8 max-w-xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={onKeyDown}
    >
      <div className="relative h-40 overflow-hidden rounded-2xl shadow-[0_1px_2px_rgba(15,20,36,0.04),0_8px_24px_rgba(15,20,36,0.08)] sm:h-48 lg:h-56">
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
              <div className="relative flex h-full max-w-[62%] flex-col justify-center gap-1 px-4 sm:max-w-[55%] sm:px-6">
                <h3 className="line-clamp-2 font-heading text-sm font-semibold text-torays-navy sm:text-base">
                  {t(`promoCarousel.slides.${slide.id}.title`)}
                </h3>
                <p className="line-clamp-2 text-xs text-torays-text-secondary sm:text-sm">
                  {t(`promoCarousel.slides.${slide.id}.description`)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={goPrev}
          aria-label={t("promoCarousel.prevLabel")}
          className={`absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-torays-navy shadow-[0_1px_2px_rgba(15,20,36,0.15)] backdrop-blur hover:bg-white ${FOCUS_RING}`}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={goNext}
          aria-label={t("promoCarousel.nextLabel")}
          className={`absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-torays-navy shadow-[0_1px_2px_rgba(15,20,36,0.15)] backdrop-blur hover:bg-white ${FOCUS_RING}`}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2" aria-hidden="false">
        {PROMO_SLIDES.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => goTo(i)}
            aria-label={t("promoCarousel.goToLabel", { number: i + 1 })}
            aria-current={i === index}
            className={`flex h-11 w-11 items-center justify-center ${FOCUS_RING}`}
          >
            <span
              className={`h-2 w-2 rounded-full transition-colors ${
                i === index ? "bg-torays-red" : "bg-torays-line"
              }`}
            />
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
        {/* line-clamp-2 caps it, min-h reserves the same 2-line box
            regardless of which language actually needs 1 line or 2 — same
            discipline as Hero.jsx's own language-stability fix, just
            applied to this shorter strip of text instead of the headline. */}
        <p className="line-clamp-2 min-h-8 text-xs text-torays-text-secondary sm:min-h-10 sm:text-sm">
          {t("promoCarousel.common")}
        </p>
        <Button type="button" onClick={onOpenRepairRequest} className="min-h-11 min-w-11 shrink-0 self-center sm:self-auto">
          {t("promoCarousel.cta")}
        </Button>
      </div>
    </div>
  );
}
