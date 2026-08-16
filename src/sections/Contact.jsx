import { useState } from "react";
import { Mail, MapPin, Clock, MessageCircle, Send } from "lucide-react";
import { SectionHeading } from "../components/ui/SectionHeading.jsx";
import { Card } from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";
import { siteConfig } from "../config/site.config.js";
import { hasWhatsApp, buildWhatsAppLink, buildMailtoLink } from "../lib/whatsapp.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";

// site.config.js's hours entries are stored in English (days/time) since
// that file is the single business-data source, not display copy — this
// maps each known value to its translation key so Contact can show them in
// the selected language without restructuring site.config.js.
const HOURS_DAY_KEYS = { "Monday – Friday": "contact.hoursMonFri", Saturday: "contact.hoursSat", Sunday: "contact.hoursSun" };
const HOURS_TIME_KEYS = { TBD: "contact.hoursTbd", Closed: "contact.hoursClosed" };

function ContactForm() {
  const { t } = useLanguage();
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  function handleSubmit(e) {
    e.preventDefault();
    const body = `Name: ${form.name}\nEmail: ${form.email}\n\n${form.message}`;
    window.location.href = buildMailtoLink({ subject: "Website contact form", body });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input
        required
        type="text"
        placeholder={t("contact.namePlaceholder")}
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        className="rounded-xl border border-torays-line bg-torays-surface-alt px-4 py-3 text-torays-text placeholder:text-torays-text-muted focus:outline-none focus:ring-2 focus:ring-torays-red/50"
      />
      <input
        required
        type="email"
        placeholder={t("contact.emailPlaceholder")}
        value={form.email}
        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        className="rounded-xl border border-torays-line bg-torays-surface-alt px-4 py-3 text-torays-text placeholder:text-torays-text-muted focus:outline-none focus:ring-2 focus:ring-torays-red/50"
      />
      <textarea
        required
        rows={4}
        placeholder={t("contact.messagePlaceholder")}
        value={form.message}
        onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
        className="resize-none rounded-xl border border-torays-line bg-torays-surface-alt px-4 py-3 text-torays-text placeholder:text-torays-text-muted focus:outline-none focus:ring-2 focus:ring-torays-red/50"
      />
      <Button type="submit" icon={Send} className="self-start">
        {t("contact.sendMessage")}
      </Button>
    </form>
  );
}

export function Contact() {
  const { t } = useLanguage();
  const { address, hours, email } = siteConfig;
  const hasAddress = Boolean(address.line1);

  return (
    <section id="contact" className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading eyebrow={t("contact.eyebrow")} title={t("contact.title")} />

        <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <Card className="flex items-start gap-4">
              <Mail size={20} className="mt-0.5 shrink-0 text-torays-red" />
              <div>
                <p className="text-sm font-medium text-torays-text">{t("contact.email")}</p>
                <a href={`mailto:${email}`} className="text-sm text-torays-text-secondary hover:text-torays-text">
                  {email}
                </a>
              </div>
            </Card>

            {hasWhatsApp && (
              <Card className="flex items-start gap-4">
                <MessageCircle size={20} className="mt-0.5 shrink-0 text-torays-red" />
                <div>
                  <p className="text-sm font-medium text-torays-text">{t("contact.whatsapp")}</p>
                  <a
                    href={buildWhatsAppLink(t("common.whatsappDefaultMessage"))}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-torays-text-secondary hover:text-torays-text"
                  >
                    {siteConfig.whatsapp.displayNumber || "Chat with us"}
                  </a>
                </div>
              </Card>
            )}

            <Card className="flex items-start gap-4">
              <MapPin size={20} className="mt-0.5 shrink-0 text-torays-red" />
              <div>
                <p className="text-sm font-medium text-torays-text">{t("contact.address")}</p>
                <p className="text-sm text-torays-text-secondary">
                  {hasAddress ? `${address.line1}, ${address.city}, ${address.state} ${address.zip}` : t("contact.addressPlaceholder")}
                </p>
              </div>
            </Card>

            <Card className="flex items-start gap-4">
              <Clock size={20} className="mt-0.5 shrink-0 text-torays-red" />
              <div>
                <p className="text-sm font-medium text-torays-text">{t("contact.hours")}</p>
                <ul className="mt-1 space-y-0.5 text-sm text-torays-text-secondary">
                  {hours.map((h) => (
                    <li key={h.days}>
                      {HOURS_DAY_KEYS[h.days] ? t(HOURS_DAY_KEYS[h.days]) : h.days}:{" "}
                      {HOURS_TIME_KEYS[h.time] ? t(HOURS_TIME_KEYS[h.time]) : h.time}
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-5">
            <Card>
              <h3 className="mb-4 font-heading text-lg font-semibold text-torays-text">{t("contact.formTitle")}</h3>
              <ContactForm />
            </Card>

            {address.mapEmbedUrl ? (
              <div className="overflow-hidden rounded-2xl border border-torays-line">
                <iframe
                  title="Torays Boost location"
                  src={address.mapEmbedUrl}
                  className="h-64 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-torays-line text-sm text-torays-text-muted">
                {t("contact.mapPlaceholder")}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
