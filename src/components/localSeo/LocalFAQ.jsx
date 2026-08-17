import { SectionHeading } from "../ui/SectionHeading.jsx";
import { Accordion } from "../ui/Accordion.jsx";

/**
 * Per-page FAQ, driven by that page's own faqIds — unlike Home's FAQ.jsx
 * (which always renders the same global faqOrder), each local SEO page
 * asks different real questions, so this reads `${tPrefix}.faq.<id>`
 * instead of the shared `faq.items.<id>` namespace.
 */
export function LocalFAQ({ eyebrow, title, faqIds, tPrefix, t }) {
  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <SectionHeading eyebrow={eyebrow} title={title} />
        <div className="mt-10">
          <Accordion
            items={faqIds.map((id) => ({
              id,
              question: t(`${tPrefix}.faq.${id}.question`),
              answer: t(`${tPrefix}.faq.${id}.answer`),
            }))}
          />
        </div>
      </div>
    </section>
  );
}
