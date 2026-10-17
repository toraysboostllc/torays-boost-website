import { Link } from "react-router-dom";
import {
  Battery,
  Cable,
  ClipboardCheck,
  Crosshair,
  MapPin,
  Truck,
  Fan,
  Gamepad2,
  Gauge,
  Joystick,
  MessageCircle,
  MonitorPlay,
  Package,
  Power,
  Sparkles,
  Thermometer,
  Usb,
  Wind,
  Droplets,
  Wrench,
} from "lucide-react";
import { SectionHeading } from "../components/ui/SectionHeading.jsx";
import { Card } from "../components/ui/Card.jsx";
import { LoopVideo } from "../components/ui/LoopVideo.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { GAMING_SERVICE_BLOCKS, MAIL_IN_WHATSAPP_MESSAGE_KEY, quotePathFor } from "../config/gamingServices.config.js";
import { buildWhatsAppLink } from "../lib/whatsapp.js";
import controllersLoop from "../assets/gaming/controllers-loop.mp4";
import controllersPoster from "../assets/gaming/controllers-poster.webp";
import consolesLoop from "../assets/gaming/consoles-loop.mp4";
import consolesPoster from "../assets/gaming/consoles-poster.webp";
// TEMPORARY: existing site illustration, until the dedicated Deep Cleaning
// image/clip is delivered.
import maintenanceImage from "../assets/promo-ps5-cleaning.webp";

/** Media per block. Every clip/image here is an illustration, never a photo
 *  of a real shop job — the "Illustrative image" caption always renders. */
const BLOCK_MEDIA = {
  controllers: { video: controllersLoop, poster: controllersPoster },
  consoles: { video: consolesLoop, poster: consolesPoster },
  maintenance: { image: maintenanceImage, objectPosition: "right center" },
};

const ITEM_ICONS = {
  controllers: { battery: Battery, drift: Crosshair, joysticks: Joystick, buttons: Gamepad2, chargingPort: Usb },
  consoles: { power: Power, hdmi: MonitorPlay, charging: Cable, performance: Gauge },
  maintenance: { dust: Sparkles, fans: Fan, cooling: Wind, thermalPaste: Thermometer, liquidMetal: Droplets },
};

const MEDIA_CLASS = "h-full w-full object-cover";

const CTA_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-torays-red px-6 py-3 font-heading text-sm font-medium text-white shadow-glow-red transition-colors duration-200 hover:bg-torays-red-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-torays-red focus-visible:ring-offset-2";

function BlockMedia({ blockId, alt, caption }) {
  const media = BLOCK_MEDIA[blockId];
  return (
    <figure className="relative aspect-video overflow-hidden bg-torays-surface-alt lg:aspect-[21/9]">
      {media.video ? (
        <LoopVideo src={media.video} poster={media.poster} alt={alt} className={MEDIA_CLASS} />
      ) : (
        <img
          src={media.image}
          alt={alt}
          loading="lazy"
          decoding="async"
          width="1600"
          height="900"
          className={MEDIA_CLASS}
          style={media.objectPosition ? { objectPosition: media.objectPosition } : undefined}
        />
      )}
      <figcaption className="absolute bottom-2 right-2 rounded-full bg-white/80 px-2.5 py-0.5 text-[11px] font-medium text-torays-text-secondary backdrop-blur-sm">
        {caption}
      </figcaption>
    </figure>
  );
}

function ServiceBlock({ block }) {
  const { t } = useLanguage();
  const base = `gamingServices.${block.id}`;
  const icons = ITEM_ICONS[block.id];

  return (
    <Card noPadding className="flex flex-col">
      <div>
        <BlockMedia blockId={block.id} alt={t(`${base}.mediaAlt`)} caption={t("gamingServices.illustrative")} />
      </div>

      <div className="flex flex-col p-6 sm:p-8">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-torays-line bg-torays-bg px-3 py-1 text-xs font-medium text-torays-text-secondary">
          <Wrench size={13} aria-hidden="true" />
          {t("gamingServices.estimateBadge")}
        </span>
        <h3 className="mt-4 font-heading text-2xl font-semibold text-torays-text">{t(`${base}.title`)}</h3>
        <p className="mt-2 text-sm text-torays-text-secondary sm:text-base">{t(`${base}.intro`)}</p>

        <ul className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
          {block.items.map((item) => {
            const Icon = icons[item];
            return (
              <li key={item} className="flex gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-torays-bg text-torays-red">
                  <Icon size={17} aria-hidden="true" />
                </span>
                <div>
                  <h4 className="font-heading text-sm font-semibold text-torays-text sm:text-base">
                    {t(`${base}.items.${item}.title`)}
                  </h4>
                  <p className="mt-0.5 text-sm text-torays-text-secondary">{t(`${base}.items.${item}.description`)}</p>
                </div>
              </li>
            );
          })}
        </ul>

        {block.id === "maintenance" && (
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-torays-line bg-torays-bg p-4">
              <h4 className="font-heading text-sm font-semibold text-torays-text">{t(`${base}.whyTitle`)}</h4>
              <p className="mt-1.5 text-sm text-torays-text-secondary">{t(`${base}.why`)}</p>
            </div>
            <div className="rounded-xl border border-torays-navy/20 bg-torays-navy/5 p-4">
              <h4 className="flex items-center gap-2 font-heading text-sm font-semibold text-torays-text">
                <Droplets size={16} className="text-torays-navy" aria-hidden="true" />
                {t(`${base}.liquidMetal.title`)}
              </h4>
              <p className="mt-1.5 text-sm text-torays-text-secondary">{t(`${base}.liquidMetal.body`)}</p>
              <p className="mt-2 text-xs text-torays-text-secondary">{t(`${base}.liquidMetal.footnote`)}</p>
            </div>
          </div>
        )}

        <p className="mt-5 text-xs text-torays-text-secondary">{t(`${base}.note`)}</p>

        <div className="mt-6">
          <Link to={quotePathFor(block.quoteService)} className={`${CTA_CLASS} w-full sm:w-auto`}>
            {t(block.ctaKey)}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </Card>
  );
}

// How mail-in works. Step 2 is deliberately "we send you the address": the
// shop's postal address is never published on the site, only shared on
// WhatsApp once the device and the fault are known.
const MAIL_IN_STEPS = [
  { id: "contact", icon: MessageCircle },
  { id: "address", icon: MapPin },
  { id: "ship", icon: Truck },
  { id: "repair", icon: ClipboardCheck },
];

function MailInBlock() {
  const { t } = useLanguage();
  return (
    <Card id="gaming-mail-in" className="scroll-mt-28 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-torays-bg text-torays-navy">
        <Package size={28} aria-hidden="true" />
      </span>
      <div className="flex-1">
        <span className="text-xs font-heading font-semibold uppercase tracking-[0.2em] text-torays-red">
          {t("gamingServices.mailIn.eyebrow")}
        </span>
        <h3 className="mt-1 font-heading text-xl font-semibold text-torays-text sm:text-2xl">
          {t("gamingServices.mailIn.title")}
        </h3>
        <p className="mt-2 text-sm text-torays-text-secondary sm:text-base">{t("gamingServices.mailIn.body")}</p>
      </div>
      <a
        href={buildWhatsAppLink(t(MAIL_IN_WHATSAPP_MESSAGE_KEY))}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-torays-navy-light/50 px-6 py-3 font-heading text-sm font-medium text-torays-text transition-colors duration-200 hover:border-torays-navy-light hover:bg-torays-navy/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-torays-navy focus-visible:ring-offset-2"
      >
        <MessageCircle size={18} aria-hidden="true" />
        {t("gamingServices.mailIn.cta")}
      </a>
      </div>

      <h4 className="mt-7 font-heading text-sm font-semibold uppercase tracking-wide text-torays-text-secondary">
        {t("gamingServices.mailIn.stepsTitle")}
      </h4>
      <ol className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MAIL_IN_STEPS.map(({ id, icon: Icon }, i) => (
          <li key={id} className="flex gap-3 rounded-xl border border-torays-line bg-torays-bg p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-torays-red bg-white font-heading text-sm font-semibold text-torays-red">
              {i + 1}
            </span>
            <div>
              <p className="flex items-center gap-1.5 font-heading text-sm font-semibold text-torays-text">
                <Icon size={15} className="text-torays-navy" aria-hidden="true" />
                {t(`gamingServices.mailIn.steps.${id}.title`)}
              </p>
              <p className="mt-1 text-sm text-torays-text-secondary">{t(`gamingServices.mailIn.steps.${id}.description`)}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/**
 * Home section for PlayStation/Xbox consoles and controllers: controller
 * repair, console repair and preventive maintenance (Deep Cleaning), plus the
 * mail-in notice. No prices — every block says "Estimate after diagnosis" and
 * its CTA opens the existing /quote wizard with that service preselected
 * (see gamingServices.config.js). WhatsApp is only the mail-in coordination
 * channel here.
 */
export function GamingServices() {
  const { t } = useLanguage();
  return (
    <section id="gaming" className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading
          eyebrow={t("gamingServices.eyebrow")}
          title={t("gamingServices.title")}
          subtitle={t("gamingServices.subtitle")}
        />
        <div className="mt-12 space-y-8">
          {GAMING_SERVICE_BLOCKS.map((block) => (
            <ServiceBlock key={block.id} block={block} />
          ))}
          <MailInBlock />
        </div>
      </div>
    </section>
  );
}
