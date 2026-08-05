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
    <div className="relative aspect-square w-full max-w-md">
      <div className="absolute inset-0 rounded-[2rem] bg-torays-surface border border-torays-line overflow-hidden">
        <CircuitBackground opacity={0.2} />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ boxShadow: ["0 0 30px rgba(218,31,38,0.25)", "0 0 60px rgba(218,31,38,0.5)", "0 0 30px rgba(218,31,38,0.25)"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="flex h-32 w-32 items-center justify-center rounded-full bg-torays-bg border border-torays-red/40"
          >
            <Microscope size={56} className="text-torays-red" />
          </motion.div>
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
      <CircuitBackground opacity={0.08} />

      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-5 sm:px-8 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex flex-col items-start gap-6"
        >
          <span className="rounded-full border border-torays-red/30 bg-torays-red/10 px-4 py-1.5 text-xs font-heading font-semibold uppercase tracking-[0.2em] text-torays-red">
            Torays Boost LLC
          </span>

          <h1 className="text-4xl font-heading font-bold leading-tight text-torays-text sm:text-5xl lg:text-6xl">
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
