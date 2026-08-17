import { MapPin } from "lucide-react";
import { SectionHeading } from "../ui/SectionHeading.jsx";
import { useLocalSeoText } from "../../i18n/useLocalSeoText.js";

/** Identical on all 3 local SEO pages — the confirmed service area only. */
export function ServiceArea() {
  const { t } = useLocalSeoText();
  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-5 sm:px-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-torays-red/10 text-torays-red">
          <MapPin size={22} />
        </div>
        <SectionHeading title={t("localSeo.serviceArea.title")} />
        <p className="mt-4 text-base leading-relaxed text-torays-text-secondary sm:text-lg">
          {t("localSeo.serviceArea.body")}
        </p>
      </div>
    </section>
  );
}
