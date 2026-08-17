import { motion } from "framer-motion";
import { SectionHeading } from "../components/ui/SectionHeading.jsx";
import { whyChooseUs } from "../config/features.config.js";
import { ICONS } from "../lib/iconRegistry.js";

export function WhyChooseUs() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Why Torays Boost"
          title="Why Choose Torays Boost"
          subtitle="Precision repair backed by real diagnostic equipment and honest communication."
        />

        <div className="mt-12 grid grid-cols-2 gap-5 sm:grid-cols-4">
          {whyChooseUs.map((item, i) => {
            const Icon = ICONS[item.icon];
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.05, ease: "easeOut" }}
                className="flex flex-col items-center gap-3 rounded-2xl border border-torays-line bg-torays-surface p-5 text-center"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-torays-navy/20 text-torays-navy-light">
                  {Icon && <Icon size={20} />}
                </div>
                <p className="text-sm font-medium text-torays-text">{item.label}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
