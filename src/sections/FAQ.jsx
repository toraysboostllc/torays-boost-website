import { SectionHeading } from "../components/ui/SectionHeading.jsx";
import { Accordion } from "../components/ui/Accordion.jsx";
import { faqOrder } from "../config/faq.config.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";

export function FAQ() {
  const { t } = useLanguage();

  return (
    <section id="faq" className="py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <SectionHeading eyebrow={t("faq.eyebrow")} title={t("faq.title")} />
        <div className="mt-12">
          <Accordion
            items={faqOrder.map((id) => ({
              id,
              question: t(`faq.items.${id}.question`),
              answer: t(`faq.items.${id}.answer`),
            }))}
          />
        </div>
      </div>
    </section>
  );
}
