import { Star } from "lucide-react";
import { SectionHeading } from "../components/ui/SectionHeading.jsx";
import { Card } from "../components/ui/Card.jsx";
import { testimonials } from "../config/testimonials.config.js";

export function Testimonials() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading eyebrow="Testimonials" title="What Customers Say" />

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => (
            <Card key={t.id}>
              <div className="flex gap-1 text-torays-red">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} size={16} fill="currentColor" strokeWidth={0} />
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-torays-text-secondary">“{t.quote}”</p>
              <div className="mt-5 border-t border-torays-line pt-4">
                <p className="text-sm font-medium text-torays-text">{t.name}</p>
                <p className="text-xs text-torays-text-muted">{t.device}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
