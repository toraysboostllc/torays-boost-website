/**
 * Structure for the "Consoles & Controllers" section on Home: which blocks
 * exist, which service items each one lists, and what the quote wizard should
 * preselect when a block's CTA is clicked. All visible copy lives in
 * translations.js under `gamingServices.*` — nothing here is display text.
 *
 * Deliberately NO price anywhere: every block shows "Estimate after
 * diagnosis" and sends the visitor to the existing /quote wizard.
 */

/**
 * /quote?service=<id> presets. Each one is passed to the wizard as its
 * `initialSelection` (see buildInitialAnswers in useRepairRequest.js):
 *  - controllers → the single "controllers" category (type Controller)
 *  - consoles    → device type Console; the visitor still picks PS5 or Xbox
 *  - maintenance → device type Console, plus a prefilled "additional details"
 *                  line so the technician knows it's a Deep Cleaning request
 *                  (the approved problem catalog has no maintenance entry and
 *                  is intentionally left untouched).
 * An unknown id is simply ignored — /quote then behaves exactly as before.
 */
export const QUOTE_SERVICE_PRESETS = {
  controllers: { categoryId: "controllers" },
  consoles: { deviceTypeId: "console" },
  maintenance: { deviceTypeId: "console", detailsKey: "gamingServices.maintenance.quoteDetails" },
};

export function getQuoteServicePreset(serviceId) {
  return Object.prototype.hasOwnProperty.call(QUOTE_SERVICE_PRESETS, serviceId)
    ? QUOTE_SERVICE_PRESETS[serviceId]
    : null;
}

export function quotePathFor(serviceId) {
  return `/quote?service=${serviceId}`;
}

/**
 * The three service blocks, in display order. `items` are translation keys
 * under gamingServices.<block>.items.<item>. `ctaKey` picks "Request a repair
 * quote" vs "Request a maintenance quote".
 */
export const GAMING_SERVICE_BLOCKS = [
  {
    id: "controllers",
    quoteService: "controllers",
    ctaKey: "gamingServices.ctaRepair",
    items: ["battery", "drift", "joysticks", "buttons", "chargingPort"],
  },
  {
    id: "consoles",
    quoteService: "consoles",
    ctaKey: "gamingServices.ctaRepair",
    items: ["power", "hdmi", "charging", "performance"],
  },
  {
    id: "maintenance",
    quoteService: "maintenance",
    ctaKey: "gamingServices.ctaMaintenance",
    items: ["dust", "fans", "cooling", "thermalPaste", "liquidMetal"],
  },
];

/** Message prefilled in WhatsApp by the mail-in "coordinate shipping" button. */
export const MAIL_IN_WHATSAPP_MESSAGE_KEY = "gamingServices.mailIn.whatsappMessage";
