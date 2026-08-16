import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import * as Icons from "lucide-react";
import { Button } from "../components/ui/Button.jsx";
import { CircuitBackground } from "../components/ui/CircuitBackground.jsx";
import { PromoCarousel } from "../components/promo/PromoCarousel.jsx";
import { whyChooseUs } from "../config/features.config.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import heroImage from "../assets/public-repair-hero.webp";

// Content-column min-height per breakpoint tier, measured directly from
// Spanish's own rendered height (the longer/tallest copy) at this
// project's official responsive test widths — see the doc comment above
// Hero() for why this keeps the bg-cover collage from re-cropping when
// the language toggles. The sm/lg tiers were re-measured for this round:
// they used to carry the old tablet/desktop vertical-padding utilities'
// breathing room baked in as permanent slack (leftover from before the
// min-height mechanism existed) — with the promo carousel now sitting
// above this column too, that legacy padding read as a big empty gap, so
// it's been measured back down to the column's true zero-slack content
// height. Mobile's tiers already had no such legacy padding, so they're
// unchanged. Content height stops changing entirely past the sm
// breakpoint (max-w-xl caps the column at 576px and text-6xl doesn't grow
// again at lg), so sm: and lg: now share one value.
const MIN_H_CLASSES = "min-h-[720px] min-[390px]:min-h-[686px] sm:min-h-[633px]";

const TRUST_BADGE_IDS = ["warranty", "turnaround", "pricing", "technicians"];
const TRUST_LABEL_KEYS = {
  warranty: "hero.trustWarranty",
  turnaround: "hero.trustTurnaround",
  pricing: "hero.trustPricing",
  technicians: "hero.trustTechnicians",
};

function TrustBadges() {
  const { t } = useLanguage();
  const trustBadges = TRUST_BADGE_IDS.map((id) => whyChooseUs.find((item) => item.id === id)).filter(Boolean);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 sm:gap-x-6">
      {trustBadges.map((badge) => {
        const Icon = Icons[badge.icon];
        return (
          <div key={badge.id} className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-torays-navy/10 text-torays-navy">
              {Icon && <Icon size={13} />}
            </span>
            <span className="text-xs font-medium text-torays-text-secondary">{t(TRUST_LABEL_KEYS[badge.id])}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The real Torays Boost repair photo (see repairRequest.config.js's
 * sibling asset, public-repair-hero.webp — public-site-only, never the
 * private Wholesale login collage). Two treatments, no cropping/distortion
 * in either:
 *  - sm: and up (tablet/desktop): full-bleed background behind the whole
 *    section, with a light-to-transparent scrim so the copy on the left —
 *    which is also where the photo itself is naturally clean/light — stays
 *    legible regardless of what's happening on the photo's busier right
 *    side.
 *  - below sm: (360-430px phones): the photo doesn't work well as a
 *    cropped background behind stacked text at that width, so it renders
 *    as its own contained, non-deformed image block under the copy
 *    instead — same "hidden sm:.../ sm:hidden" split already established
 *    elsewhere in this codebase for desktop-vs-mobile visual treatments.
 *
 * Typography: navy (#0B2F6B) body of the headline, a vivid blue
 * (#1464D2) highlight on the product-line half, and a short red accent
 * bar — never a fully red headline. Both blues verified >=4.5:1 (WCAG AA)
 * against the page/scrim background (11.36:1 and 4.90:1 respectively).
 *
 * Framing is language-independent by construction, not by accident: the
 * content column below carries a min-height per breakpoint tier (base,
 * 390px, sm) measured directly from Spanish's own rendered height —
 * Spanish's copy is longer/wraps more, so it already IS the tallest
 * variant at every tier. Because the min-height equals Spanish's natural
 * height, it's a no-op for Spanish (nothing to stretch); English, being
 * shorter, gets stretched up to the same box. The column is top-aligned
 * (justify-start, not justify-center) so that slack — English's only —
 * lands below the trust badges, never between the carousel and the
 * eyebrow: the visible gap right under the carousel stays a fixed ~12px
 * (the carousel's own mb-3) for both languages. Since the sm:-tier image
 * is a bg-cover layer sized to this same section, an identical box height
 * between languages is what keeps its crop/zoom from shifting when the
 * language toggles — see MIN_H_CLASSES below for the exact measured pixel
 * values.
 *
 * PromoCarousel sits above the text column, filling what used to be
 * blank space between the fixed navbar and the eyebrow. It has its own
 * fixed height per breakpoint (never content-driven), so composing it
 * above the already-stable text column keeps the whole Hero's height
 * language-independent by construction — no change to MIN_H_CLASSES
 * itself was needed, only new content added on top of it. This does grow
 * the Hero's total height versus before (real content needs real room),
 * but by the same fixed amount for both languages.
 */
export function Hero({ onOpenRepairRequest }) {
  const { t } = useLanguage();

  return (
    <section id="top" className="relative overflow-hidden pt-32 pb-16 sm:pb-0">
      <div
        className="absolute inset-0 hidden bg-cover bg-right bg-no-repeat sm:block"
        style={{ backgroundImage: `url(${heroImage})` }}
      />
      <div className="absolute inset-0 hidden bg-gradient-to-r from-torays-bg via-torays-bg/85 sm:block" />
      <div className="absolute inset-0 bg-torays-gradient sm:hidden" />
      <CircuitBackground opacity={0.55} className="sm:hidden" />

      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <PromoCarousel onOpenRepairRequest={onOpenRepairRequest} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={`flex max-w-xl flex-col items-start justify-start gap-8 ${MIN_H_CLASSES}`}
        >
          <span className="rounded-full border border-torays-red/30 bg-torays-red/10 px-4 py-1.5 text-xs font-heading font-semibold uppercase tracking-[0.2em] text-torays-red">
            {t("hero.eyebrow")}
          </span>

          <div className="flex flex-col gap-3">
            <div className="h-1 w-12 rounded-full bg-torays-red" aria-hidden="true" />
            <h1 className="text-5xl font-heading font-semibold leading-[1.08] text-[#0B2F6B] sm:text-6xl">
              {t("hero.titlePrefix")} <span className="text-[#1464D2]">{t("hero.titleHighlight")}</span>
            </h1>
          </div>

          <p className="text-lg leading-relaxed text-[#3D4A66] sm:text-xl">{t("hero.description")}</p>

          <Button type="button" onClick={onOpenRepairRequest} size="lg" icon={ArrowRight} iconPosition="right">
            {t("hero.cta")}
          </Button>

          <div className="mt-1 border-t border-torays-line pt-5">
            <TrustBadges />
          </div>
        </motion.div>
      </div>

      <img
        src={heroImage}
        alt={t("hero.imageAlt")}
        className="mt-10 h-56 w-full object-cover sm:hidden"
      />
    </section>
  );
}
