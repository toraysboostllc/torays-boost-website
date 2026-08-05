import * as Icons from "lucide-react";
import { motion } from "framer-motion";
import { SectionHeading } from "../components/ui/SectionHeading.jsx";
import { Card } from "../components/ui/Card.jsx";
import { aboutConfig } from "../config/about.config.js";

export function AboutUs() {
  return (
    <section id="about" className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          align="left"
          eyebrow={aboutConfig.eyebrow}
          title={aboutConfig.title}
        />

        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex flex-col gap-4"
          >
            {aboutConfig.paragraphs.map((paragraph, i) => (
              <p key={i} className="text-base leading-relaxed text-torays-text-secondary">
                {paragraph}
              </p>
            ))}
          </motion.div>

          <div className="flex flex-col gap-4">
            {aboutConfig.values.map((value) => {
              const Icon = Icons[value.icon];
              return (
                <Card key={value.id} className="flex flex-row items-start gap-4 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-torays-red/10 text-torays-red">
                    {Icon && <Icon size={18} />}
                  </div>
                  <div>
                    <h3 className="font-heading text-sm font-semibold text-torays-text">{value.title}</h3>
                    <p className="mt-1 text-sm text-torays-text-secondary">{value.description}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
