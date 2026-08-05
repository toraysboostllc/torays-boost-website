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
  email: "toraysboostllc@gmail.com",

  // TODO: fill in the real WhatsApp number in E.164 format without "+"
  // (e.g. "18095551234"). Leave empty to hide WhatsApp CTAs from render.
  whatsapp: {
    number: "",
    defaultMessage: "Hi! I'd like a quote for a repair.",
  },

  // TODO: fill in real address + regenerate mapEmbedUrl from Google Maps
  // ("Share" > "Embed a map") once the shop address is confirmed.
  address: {
    line1: "",
    city: "",
    state: "",
    zip: "",
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
