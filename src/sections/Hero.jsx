import { motion } from "framer-motion";
import { ArrowRight, MessageCircle, Microscope } from "lucide-react";
import * as Icons from "lucide-react";
import { Button } from "../components/ui/Button.jsx";
import { CircuitBackground } from "../components/ui/CircuitBackground.jsx";
import { buildContactLink } from "../lib/whatsapp.js";
import { whyChooseUs } from "../config/features.config.js";

const TRUST_BADGE_IDS = ["warranty", "turnaround", "pricing", "technicians"];
const trustBadges = TRUST_BADGE_IDS.map((id) => whyChooseUs.find((item) => item.id === id)).filter(Boolean);

/**
 * The Hero visual is the page's focal point — designed as a large "photo
 * frame" ready to hold a real photo/video of the lab, microscope, and
 * repairs in progress. Until that's supplied, it holds an original graphic
 * placeholder (circuit pattern + microscope badge). To swap in a real photo
 * later: replace the inner <CircuitBackground>/<div> placeholder content
 * with an <img className="h-full w-full object-cover" ... /> — the frame,
 * shadow, glow, and floating device badges around it stay as-is.
 */
function HeroVisual() {
  return (
    <div className="relative aspect-square w-full max-w-2xl">
      {/* Soft light glow behind the panel for depth */}
      <div className="absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-torays-navy/10 via-torays-red/5 to-transparent blur-3xl" />

      <div className="absolute inset-0 rounded-[2rem] bg-torays-surface ring-1 ring-white/60 border border-torays-line shadow-[0_35px_90px_rgba(15,20,36,0.18)] overflow-hidden">
        <CircuitBackground opacity={0.1} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-44 w-44 items-center justify-center rounded-full bg-torays-bg border border-torays-red/30 shadow-glow-red">
            <Microscope size={72} className="text-torays-red" />
          </div>
        </div>
        {/* Bottom vignette — doubles as a caption-ready gradient once a real photo is dropped in */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-torays-text/10 to-transparent" />
      </div>

      {["PS5", "iPhone", "MacBook"].map((label, i) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 + i * 0.15, duration: 0.5 }}
          className={`absolute rounded-full border border-torays-line bg-torays-surface/90 backdrop-blur px-4 py-2 text-xs font-medium text-torays-text shadow-lg ${
            i === 0 ? "-left-4 top-8" : i === 1 ? "-right-4 top-1/2" : "left-6 -bottom-4"
          }`}
        >
          {label}
        </motion.div>
      ))}
    </div>
  );
}

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

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
      <div className="absolute inset-0 bg-torays-gradient" />
      <CircuitBackground opacity={0.05} />

      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 px-5 sm:px-8 lg:grid-cols-2 lg:gap-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex flex-col items-start gap-8"
        >
          <span className="rounded-full border border-torays-red/30 bg-torays-red/10 px-4 py-1.5 text-xs font-heading font-semibold uppercase tracking-[0.2em] text-torays-red">
            Torays Boost LLC
          </span>

          <h1 className="max-w-2xl text-5xl font-heading font-bold leading-[1.08] text-torays-text sm:text-6xl lg:text-7xl">
            Professional Microsoldering &amp; Electronics Repair
          </h1>

          <p className="max-w-lg text-lg leading-relaxed text-torays-text-secondary sm:text-xl">
            Experts in PS5, Smartphones, Tablets, MacBooks and Board-Level Repair
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Button href="#quote-estimator" size="lg" icon={ArrowRight} iconPosition="right">
              Get Free Quote
            </Button>
            <Button
              href={buildContactLink()}
              target="_blank"
              rel="noreferrer"
              variant="outline"
              size="lg"
              icon={MessageCircle}
            >
              WhatsApp
            </Button>
          </div>

          <div className="mt-1 border-t border-torays-line pt-5">
            <TrustBadges />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
          className="flex justify-center lg:justify-end"
        >
          <HeroVisual />
        </motion.div>
      </div>
    </section>
  );
}
