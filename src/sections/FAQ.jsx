import { SectionHeading } from "../components/ui/SectionHeading.jsx";
import { Accordion } from "../components/ui/Accordion.jsx";
import { faqs } from "../config/faq.config.js";

export function FAQ() {
  return (
    <section id="faq" className="py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <SectionHeading eyebrow="FAQ" title="Frequently Asked Questions" />
        <div className="mt-12">
          <Accordion
            items={faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer }))}
          />
        </div>
      </div>
    </section>
  );
}
