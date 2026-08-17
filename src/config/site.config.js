/**
 * Single source of truth for all TORAYS BOOST business information.
 * Nothing in components/sections should hardcode any of this —
 * import from here so the whole site can be updated from one place.
 */
export const siteConfig = {
  businessName: "TORAYS BOOST LLC",
  shortName: "Torays Boost",
  domain: "toraysboost.com",
  url: "https://toraysboost.com",
  // Confirmed public contact — payments@toraysboost.com is billing-only,
  // never used as a public contact address.
  email: "toraysboostllc@gmail.com",

  // E.164 format without "+", per buildWhatsAppLink()'s wa.me URL format.
  whatsapp: {
    number: "17867937665",
    displayNumber: "+1 (786) 793-7665",
    defaultMessage: "Hi! I'd like a quote for a repair.",
  },

  // Deliberately a general service area, not a street address — Torays
  // Boost isn't publishing a precise physical location, so there's no
  // separate city/state/zip to concatenate and no map embed to show.
  address: {
    line1: "Kendall, Miami, FL 33196",
    mapEmbedUrl: "",
  },

  // TODO: confirm real business hours.
  hours: [
    { days: "Monday – Friday", time: "TBD" },
    { days: "Saturday", time: "TBD" },
    { days: "Sunday", time: "Closed" },
  ],

  social: {
    instagram: "",
    facebook: "",
    tiktok: "",
  },

  seo: {
    defaultTitle: "Torays Boost | Professional Microsoldering & Electronics Repair",
    defaultDescription:
      "Expert microsoldering and board-level repair for PS5, iPhone, iPad, MacBook, Xbox, Nintendo Switch and data recovery.",
  },
};
