import { ArrowRight } from "lucide-react";
import { Button } from "../ui/Button.jsx";
import { CircuitBackground } from "../ui/CircuitBackground.jsx";
import { Breadcrumbs } from "./Breadcrumbs.jsx";

/**
 * Lightweight hero for the local SEO landing pages — no big cover photo
 * (only icons/existing graphics until real photos exist, per spec), so it's
 * lighter and faster than Home's Hero by design, not as a corner cut.
 *
 * The critical column (H1 + summary + CTA) is a plain, static div — same
 * rule as Home's Hero: no opacity:0/transform/delay on the elements that
 * make up the LCP candidate. CircuitBackground is already a static SVG
 * (no motion), so nothing here needs a prefers-reduced-motion guard.
 */
export function LocalHero({ eyebrow, h1, summary, ctaLabel, note, onOpenRepairRequest, breadcrumbs }) {
  return (
    <section className="relative overflow-hidden pt-32 pb-16 sm:pb-20">
      <div className="absolute inset-0 bg-torays-gradient" aria-hidden="true" />
      <CircuitBackground opacity={0.45} />

      <div className="relative mx-auto max-w-4xl px-5 sm:px-8">
        <div className="mb-6">
          <Breadcrumbs items={breadcrumbs} />
        </div>

        <div className="flex max-w-2xl flex-col items-start gap-6">
          <span className="rounded-full border border-torays-red/30 bg-torays-red/10 px-4 py-1.5 text-xs font-heading font-semibold uppercase tracking-[0.2em] text-torays-red">
            {eyebrow}
          </span>

          <h1 className="text-4xl font-heading font-semibold leading-[1.1] text-[#0B2F6B] sm:text-5xl">{h1}</h1>

          <p className="text-lg leading-relaxed text-[#3D4A66]">{summary}</p>

          <Button type="button" onClick={onOpenRepairRequest} size="lg" icon={ArrowRight} iconPosition="right">
            {ctaLabel}
          </Button>

          <p className="text-sm text-torays-text-secondary">{note}</p>
        </div>
      </div>
    </section>
  );
}
