/**
 * Placeholder pricing/turnaround data for the Quote Estimator.
 * Structure: deviceType -> brand -> model -> issue -> { price, etaDays }.
 * These numbers are PLACEHOLDERS — swap them for real shop pricing
 * whenever ready, the estimator UI reads this file as-is.
 */
function issue(id, label, priceMin, priceMax, etaMin, etaMax) {
  return {
    id,
    label,
    price: { min: priceMin, max: priceMax },
    etaDays: { min: etaMin, max: etaMax },
  };
}

const consoleIssues = [
  issue("hdmi-port", "HDMI Port Repair", 120, 180, 2, 4),
  issue("no-power", "No Power / Won't Turn On", 90, 220, 2, 5),
  issue("overheating", "Overheating / Shuts Down", 70, 150, 1, 3),
  issue("board-level", "Board-Level / Liquid Damage Repair", 130, 280, 3, 7),
];

const phoneTabletIssues = [
  issue("screen", "Screen Replacement", 89, 179, 1, 2),
  issue("battery", "Battery Replacement", 49, 89, 1, 1),
  issue("charging-port", "Charging Port Repair", 59, 99, 1, 2),
  issue("no-power", "No Power / Won't Turn On", 79, 199, 2, 5),
  issue("board-level", "Board-Level / Liquid Damage Repair", 99, 249, 3, 7),
  issue("data-recovery", "Data Recovery", 99, 299, 2, 7),
];

const laptopIssues = [
  issue("screen", "Screen Replacement", 129, 259, 1, 3),
  issue("battery", "Battery Replacement", 89, 159, 1, 2),
  issue("keyboard", "Keyboard Replacement", 99, 189, 1, 3),
  issue("liquid-damage", "Liquid Damage / Board-Level Repair", 149, 349, 3, 8),
  issue("no-power", "No Power / Won't Turn On", 99, 229, 2, 5),
  issue("data-recovery", "Data Recovery", 99, 299, 2, 7),
];

export const pricingData = [
  {
    id: "ps5",
    label: "PS5 / PlayStation",
    brands: [
      {
        id: "sony",
        label: "Sony",
        models: [
          { id: "ps5-standard", label: "PS5 Standard", issues: consoleIssues },
          { id: "ps5-slim", label: "PS5 Slim / Digital", issues: consoleIssues },
        ],
      },
    ],
  },
  {
    id: "xbox",
    label: "Xbox",
    brands: [
      {
        id: "microsoft",
        label: "Microsoft",
        models: [
          { id: "xbox-series-x", label: "Xbox Series X", issues: consoleIssues },
          { id: "xbox-series-s", label: "Xbox Series S", issues: consoleIssues },
        ],
      },
    ],
  },
  {
    id: "switch",
    label: "Nintendo Switch",
    brands: [
      {
        id: "nintendo",
        label: "Nintendo",
        models: [
          {
            id: "switch-oled",
            label: "Switch OLED",
            issues: [
              issue("joycon-drift", "Joy-Con Drift Repair", 29, 59, 1, 2),
              issue("charging-port", "Charging Port Repair", 59, 99, 1, 2),
              issue("screen", "Screen Replacement", 89, 149, 1, 2),
              issue("board-level", "Board-Level Repair", 99, 229, 3, 7),
            ],
          },
          {
            id: "switch-standard",
            label: "Switch Standard / Lite",
            issues: [
              issue("joycon-drift", "Joy-Con Drift Repair", 29, 59, 1, 2),
              issue("charging-port", "Charging Port Repair", 59, 99, 1, 2),
              issue("screen", "Screen Replacement", 79, 139, 1, 2),
              issue("board-level", "Board-Level Repair", 99, 229, 3, 7),
            ],
          },
        ],
      },
    ],
  },
  {
    id: "iphone",
    label: "iPhone",
    brands: [
      {
        id: "apple",
        label: "Apple",
        models: [
          { id: "iphone-15", label: "iPhone 15 Series", issues: phoneTabletIssues },
          { id: "iphone-14", label: "iPhone 14 Series", issues: phoneTabletIssues },
          { id: "iphone-13", label: "iPhone 13 Series", issues: phoneTabletIssues },
          { id: "iphone-other", label: "Other / Older Model", issues: phoneTabletIssues },
        ],
      },
    ],
  },
  {
    id: "ipad",
    label: "iPad",
    brands: [
      {
        id: "apple",
        label: "Apple",
        models: [
          { id: "ipad-pro", label: "iPad Pro", issues: phoneTabletIssues },
          { id: "ipad-air", label: "iPad Air", issues: phoneTabletIssues },
          { id: "ipad-standard", label: "iPad / iPad Mini", issues: phoneTabletIssues },
        ],
      },
    ],
  },
  {
    id: "macbook",
    label: "MacBook",
    brands: [
      {
        id: "apple",
        label: "Apple",
        models: [
          { id: "macbook-pro", label: "MacBook Pro", issues: laptopIssues },
          { id: "macbook-air", label: "MacBook Air", issues: laptopIssues },
        ],
      },
    ],
  },
  {
    id: "samsung",
    label: "Samsung",
    brands: [
      {
        id: "samsung",
        label: "Samsung",
        models: [
          { id: "galaxy-s-series", label: "Galaxy S Series", issues: phoneTabletIssues },
          { id: "galaxy-tab", label: "Galaxy Tab", issues: phoneTabletIssues },
        ],
      },
    ],
  },
  {
    id: "other",
    label: "Other Device / Data Recovery",
    brands: [
      {
        id: "any",
        label: "Any Brand",
        models: [
          {
            id: "any-model",
            label: "Any Model",
            issues: [
              issue("data-recovery", "Data Recovery", 99, 299, 2, 7),
              issue("board-level", "Board-Level / Microsoldering Repair", 99, 299, 3, 7),
              issue("diagnostic", "Diagnostic Only", 25, 45, 1, 1),
            ],
          },
        ],
      },
    ],
  },
];

/**
 * Single accessor the estimator UI reads through. Swap the implementation
 * later (e.g. fetch from Supabase) without touching useQuoteEstimator.js.
 */
export function getPricingData() {
  return pricingData;
}
