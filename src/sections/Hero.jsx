import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import * as Icons from "lucide-react";
import { Button } from "../components/ui/Button.jsx";
import { CircuitBackground } from "../components/ui/CircuitBackground.jsx";
import { whyChooseUs } from "../config/features.config.js";
import heroImage from "../assets/public-repair-hero.webp";

const TRUST_BADGE_IDS = ["warranty", "turnaround", "pricing", "technicians"];
const trustBadges = TRUST_BADGE_IDS.map((id) => whyChooseUs.find((item) => item.id === id)).filter(Boolean);

function TrustBadges() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 sm:gap-x-6">
      {trustBadges.map((badge) => {
        const Icon = Icons[badge.icon];
        return (
          <div key={badge.id} className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-torays-navy/10 text-torays-navy">
              {Icon && <Icon size={13} />}
            </span>
            <span className="text-xs font-medium text-torays-text-secondary">{badge.label}</span>
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
 */
export function Hero({ onOpenRepairRequest }) {
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex max-w-xl flex-col items-start gap-8 sm:py-20 lg:py-28"
        >
          <span className="rounded-full border border-torays-red/30 bg-torays-red/10 px-4 py-1.5 text-xs font-heading font-semibold uppercase tracking-[0.2em] text-torays-red">
            Torays Boost LLC
          </span>

          <h1 className="text-5xl font-heading font-bold leading-[1.08] text-torays-text sm:text-6xl">
            Expert Repair for Phones, Consoles &amp; Computers
          </h1>

          <p className="text-lg leading-relaxed text-torays-text-secondary sm:text-xl">
            Professional diagnostics and electronics repair for iPhone, iPad, smartphones, PS5, Xbox, MacBook,
            laptops and board-level problems.
          </p>

          <Button type="button" onClick={onOpenRepairRequest} size="lg" icon={ArrowRight} iconPosition="right">
            Start Your Repair Request
          </Button>

          <div className="mt-1 border-t border-torays-line pt-5">
            <TrustBadges />
          </div>
        </motion.div>
      </div>

      <img
        src={heroImage}
        alt="Torays Boost repair bench: PS5, Xbox, controllers, phones, a tablet, and a MacBook under microscope repair"
        className="mt-10 h-56 w-full object-cover sm:hidden"
      />
    </section>
  );
}
