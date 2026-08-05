import { motion } from "framer-motion";
import { SectionHeading } from "../components/ui/SectionHeading.jsx";
import { processSteps } from "../config/features.config.js";

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading eyebrow="Process" title="How It Works" />

        <div className="relative mt-14">
          <div className="absolute left-5 top-0 h-full w-px bg-torays-line sm:left-1/2 sm:top-5 sm:h-px sm:w-full" />

          <div className="relative grid grid-cols-1 gap-10 sm:grid-cols-5 sm:gap-6">
            {processSteps.map((step, i) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.08, ease: "easeOut" }}
                className="relative flex gap-4 pl-14 sm:flex-col sm:items-center sm:pl-0 sm:text-center"
              >
                <div className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full border border-torays-red bg-torays-bg font-heading text-sm font-semibold text-torays-red sm:static sm:mb-4">
                  {step.id}
                </div>
                <div>
                  <h3 className="font-heading text-base font-semibold text-torays-text">{step.title}</h3>
                  <p className="mt-1 text-sm text-torays-text-secondary">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
