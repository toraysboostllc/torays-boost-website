import { SectionHeading } from "../ui/SectionHeading.jsx";
import { useLocalSeoText } from "../../i18n/useLocalSeoText.js";

/** Identical on all 3 local SEO pages — one shared copy of the same policy. */
export function EstimateExplainer() {
  const { t } = useLocalSeoText();
  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <SectionHeading eyebrow={t("localSeo.estimateExplainer.eyebrow")} title={t("localSeo.estimateExplainer.title")} />
        <p className="mt-6 text-base leading-relaxed text-torays-text-secondary sm:text-lg">
          {t("localSeo.estimateExplainer.body")}
        </p>
      </div>
    </section>
  );
}
