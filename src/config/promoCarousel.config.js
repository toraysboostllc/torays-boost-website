import promoPs5Cleaning from "../assets/promo-ps5-cleaning.webp";
import promoPs5Hdmi from "../assets/promo-ps5-hdmi.webp";
import promoScreenBattery from "../assets/promo-screen-battery.webp";
import promoControllerTmr from "../assets/promo-controller-tmr.webp";
import promoLaptopDataRecovery from "../assets/promo-laptop-data-recovery.webp";

/**
 * The 5 promotional slides shown in the Home Hero's PromoCarousel.
 * Deliberately has NO price field — the public site never quotes a number
 * automatically, same rule as repairRequest.config.js. English title/
 * description live here as the single source of truth; translations.js
 * derives the English side programmatically and hand-writes the Spanish
 * side, same pattern already used for services.config.js.
 */
export const PROMO_SLIDES = [
  {
    id: "ps5-cleaning",
    image: promoPs5Cleaning,
    title: "PS5 Deep Cleaning + Liquid Metal",
    description: "Professional thermal maintenance for better cooling and performance.",
  },
  {
    id: "ps5-hdmi",
    image: promoPs5Hdmi,
    title: "PS5 HDMI / No Image Repair",
    description: "Professional microsoldering for HDMI and no-image problems.",
  },
  {
    id: "screen-battery",
    image: promoScreenBattery,
    title: "Screen & Battery Repair",
    description: "Smartphone and tablet screen and battery replacement.",
  },
  {
    id: "controller-tmr",
    image: promoControllerTmr,
    title: "Controller Drift & TMR Upgrade",
    description: "Precision stick-drift repair and TMR joystick upgrades.",
  },
  {
    id: "laptop-data-recovery",
    image: promoLaptopDataRecovery,
    title: "Laptop Repair & Data Recovery",
    description: "Board-level laptop repair and professional data recovery options.",
  },
];
