import * as Icons from "lucide-react";
import { SectionHeading } from "../components/ui/SectionHeading.jsx";
import { Card } from "../components/ui/Card.jsx";
import { services } from "../config/services.config.js";

export function Services() {
  return (
    <section id="services" className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Services"
          title="What We Repair"
          subtitle="Board-level and component-level repair across the devices you rely on most."
        />

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => {
            const Icon = Icons[service.icon];
            return (
              <Card key={service.id} glow="red" className="group">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-torays-red/10 text-torays-red transition-colors duration-300 group-hover:bg-torays-red group-hover:text-white">
                  {Icon && <Icon size={22} />}
                </div>
                <h3 className="font-heading text-lg font-semibold text-torays-text">{service.title}</h3>
                <p className="mt-2 text-sm text-torays-text-secondary">{service.description}</p>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
