import { motion } from "framer-motion";
import { ArrowRight, MessageCircle, Microscope } from "lucide-react";
import { Button } from "../components/ui/Button.jsx";
import { CircuitBackground } from "../components/ui/CircuitBackground.jsx";
import { buildContactLink } from "../lib/whatsapp.js";

/**
 * Hero visual is an original graphic composition (no stock photo available
 * yet). Swap the panel below for a real photo of a technician microsoldering
 * a PS5 board under a microscope once supplied — see plan open item #2.
 */
function HeroVisual() {
  return (
    <div className="relative aspect-square w-full max-w-xl">
      <div className="absolute inset-0 rounded-[2rem] bg-torays-surface border border-torays-line shadow-[0_20px_50px_rgba(15,20,36,0.10)] overflow-hidden">
        <CircuitBackground opacity={0.1} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-40 w-40 items-center justify-center rounded-full bg-torays-bg border border-torays-red/30 shadow-glow-red">
            <Microscope size={64} className="text-torays-red" />
          </div>
        </div>
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
          className="flex flex-col items-start gap-7"
        >
          <span className="rounded-full border border-torays-red/30 bg-torays-red/10 px-4 py-1.5 text-xs font-heading font-semibold uppercase tracking-[0.2em] text-torays-red">
            Torays Boost LLC
          </span>

          <h1 className="text-5xl font-heading font-bold leading-[1.05] text-torays-text sm:text-6xl lg:text-7xl">
            Professional Microsoldering &amp; Electronics Repair
          </h1>

          <p className="max-w-lg text-lg text-torays-text-secondary">
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
