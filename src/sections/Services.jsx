import { Link } from "react-router-dom";
import { SectionHeading } from "../components/ui/SectionHeading.jsx";
import { Card } from "../components/ui/Card.jsx";
import { services } from "../config/services.config.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import imgPs5 from "../assets/services/service-ps5.webp";
import imgHdmi from "../assets/services/ps5-hdmi-port-repair-miami.webp";
import imgMicrosoldering from "../assets/services/service-microsoldering.webp";
import imgIphone from "../assets/services/service-iphone.webp";
import imgIpad from "../assets/services/service-ipad.webp";
import imgMacbook from "../assets/services/service-macbook.webp";
import imgSamsung from "../assets/services/service-samsung.webp";
import imgXbox from "../assets/services/xbox-repair.webp";
import imgSwitch from "../assets/services/service-nintendo-switch.webp";
import imgDataRecovery from "../assets/services/service-data-recovery.webp";

// One real photo per service card, replacing the old lucide-react icons.
// Keyed by services.config.js's own id so a missing mapping fails loudly
// (undefined src) rather than silently falling back to nothing.
const SERVICE_IMAGES = {
  ps5: imgPs5,
  hdmi: imgHdmi,
  microsoldering: imgMicrosoldering,
  iphone: imgIphone,
  ipad: imgIpad,
  macbook: imgMacbook,
  samsung: imgSamsung,
  xbox: imgXbox,
  switch: imgSwitch,
  "data-recovery": imgDataRecovery,
};

export function Services() {
  const { t } = useLanguage();

  return (
    <section id="services" className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow={t("services.eyebrow")}
          title={t("services.title")}
          subtitle={t("services.subtitle")}
        />

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Card key={service.id} glow="red" noPadding className="group flex h-full flex-col">
              <div className="aspect-video w-full overflow-hidden">
                <img
                  src={SERVICE_IMAGES[service.id]}
                  alt={t(`services.items.${service.id}.imageAlt`)}
                  loading="lazy"
                  decoding="async"
                  width="1200"
                  height="675"
                  className="aspect-video w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
                  style={["hdmi", "xbox"].includes(service.id) ? { objectPosition: "center 50%" } : undefined}
                />
              </div>
              <div className="flex flex-1 flex-col p-6">
                {/* line-clamp-1 + a fixed min-height keep every title the
                    same box height whether the language's text is short
                    (English) or long (Spanish) — same technique already
                    used for the promo carousel's slide text, so toggling
                    language never resizes or reflows the grid. */}
                <h3 className="line-clamp-1 min-h-[1.75rem] font-heading text-lg font-semibold text-torays-text">
                  {t(`services.items.${service.id}.title`)}
                </h3>
                <p className="mt-2 line-clamp-4 min-h-[5rem] text-sm text-torays-text-secondary">
                  {t(`services.items.${service.id}.description`)}
                </p>
                {service.localPagePath && (
                  <Link
                    to={service.localPagePath}
                    className="group/link relative mt-3 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-torays-red before:absolute before:-inset-2 before:content-['']"
                  >
                    {t(`services.localLinkLabels.${service.id}`)}
                    <span aria-hidden="true" className="transition-transform group-hover/link:translate-x-0.5">
                      →
                    </span>
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
