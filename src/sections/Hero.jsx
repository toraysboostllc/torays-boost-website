import { motion, useReducedMotion } from "framer-motion";
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
  // framer-motion animations run via JS, not CSS, so the global
  // prefers-reduced-motion CSS override (index.css) can't reach them —
  // this hook is the correct way to opt the infinite pulse out.
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative aspect-square w-full max-w-2xl">
      {/* Soft two-tone light glow behind the panel — the "lit lab" cue, brand colors only */}
      <div className="absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-torays-navy/[0.14] via-transparent via-40% to-torays-red/[0.08] blur-3xl" />

      <div className="absolute inset-0 rounded-[2rem] bg-torays-surface ring-1 ring-white/60 border border-torays-line shadow-[0_35px_90px_rgba(15,20,36,0.18)] overflow-hidden">
        {/* Faint blueprint grid — engineering/lab cue, well under the circuit pattern */}
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(32,38,111,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(32,38,111,0.5) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <CircuitBackground opacity={0.9} />

        {/* Corner brackets — precision-instrument framing, static, no motion */}
        {[
          "left-5 top-5 border-l border-t",
          "right-5 top-5 border-r border-t",
          "left-5 bottom-5 border-l border-b",
          "right-5 bottom-5 border-r border-b",
        ].map((pos) => (
          <div key={pos} className={`absolute h-7 w-7 border-torays-navy/25 ${pos}`} />
        ))}

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-56 w-56 rounded-full border border-dashed border-torays-navy/15" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-44 w-44 items-center justify-center rounded-full bg-torays-bg border border-torays-red/30 shadow-glow-red">
            <Microscope size={72} className="text-torays-red" />
          </div>
        </div>

        {/* Discrete light accents — very low opacity, gentle pulse (disabled via prefers-reduced-motion globally) */}
        {[
          { top: "22%", left: "18%", color: "bg-torays-navy", delay: 0 },
          { top: "70%", left: "82%", color: "bg-torays-red", delay: 0.8 },
          { top: "78%", left: "24%", color: "bg-torays-navy", delay: 1.6 },
        ].map((dot, i) => (
          <motion.span
            key={i}
            animate={reduceMotion ? { opacity: 0.45 } : { opacity: [0.25, 0.7, 0.25] }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 3, repeat: Infinity, delay: dot.delay, ease: "easeInOut" }
            }
            className={`absolute h-1.5 w-1.5 rounded-full ${dot.color} blur-[1px]`}
            style={{ top: dot.top, left: dot.left }}
          />
        ))}

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
      <CircuitBackground opacity={0.55} />

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
