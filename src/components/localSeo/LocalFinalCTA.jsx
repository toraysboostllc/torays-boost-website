import { ArrowRight } from "lucide-react";
import { Button } from "../ui/Button.jsx";

export function LocalFinalCTA({ title, body, ctaLabel, onOpenRepairRequest }) {
  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-5 sm:px-8 text-center">
        <h2 className="text-3xl font-heading font-semibold text-torays-text sm:text-4xl">{title}</h2>
        <p className="mt-4 text-base leading-relaxed text-torays-text-secondary sm:text-lg">{body}</p>
        <div className="mt-8 flex justify-center">
          <Button type="button" onClick={onOpenRepairRequest} size="lg" icon={ArrowRight} iconPosition="right">
            {ctaLabel}
          </Button>
        </div>
      </div>
    </section>
  );
}
