import { siteConfig } from "../config/site.config.js";
import { SEO_ORIGIN } from "./seo.js";

/**
 * Torays Boost is a service-area business, not a walk-in storefront — the
 * address deliberately omits `streetAddress` (locality/region/postal only,
 * per the confirmed 33196 service area). `openingHoursSpecification` and
 * `sameAs` are omitted entirely rather than guessed: real hours aren't
 * confirmed yet (see site.config.js's hours TODO) and no official social
 * profile URL exists yet either — both get added here the moment they're
 * confirmed, never invented in the meantime. No `aggregateRating` for the
 * same reason: no real, verifiable reviews exist to cite.
 */
export function buildLocalBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: siteConfig.businessName,
    url: SEO_ORIGIN,
    email: siteConfig.email,
    telephone: siteConfig.whatsapp.displayNumber,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Miami",
      addressRegion: "FL",
      postalCode: "33196",
      addressCountry: "US",
    },
    areaServed: [
      { "@type": "City", name: "Miami, FL" },
      { "@type": "Place", name: "Kendall, Miami, FL" },
    ],
  };
}

/** `items` is an ordered list of `{ name, path }`, Home first. */
export function buildBreadcrumbJsonLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SEO_ORIGIN}${item.path}`,
    })),
  };
}
