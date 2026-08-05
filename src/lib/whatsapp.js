import { siteConfig } from "../config/site.config.js";

/** True once a real WhatsApp number has been set in site.config.js. */
export const hasWhatsApp = Boolean(siteConfig.whatsapp.number);

/** Builds a wa.me deep link with an optional prefilled message. */
export function buildWhatsAppLink(message) {
  const text = encodeURIComponent(message || siteConfig.whatsapp.defaultMessage);
  return `https://wa.me/${siteConfig.whatsapp.number}?text=${text}`;
}

export function buildMailtoLink({ subject, body }) {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  return `mailto:${siteConfig.email}?${params.toString()}`;
}

/** WhatsApp link when a number is configured, otherwise a mailto fallback. */
export function buildContactLink(message) {
  if (hasWhatsApp) return buildWhatsAppLink(message);
  return buildMailtoLink({ subject: "Repair quote request", body: message });
}
