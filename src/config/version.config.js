/**
 * Site version tracking. Bumped only after a change has been verified and
 * approved for production — never mid-round. Keep in sync with the
 * "version" field in package.json.
 */
export const APP_VERSION = "1.1.1";

export const VERSION_HISTORY = [
  {
    version: "1.1.1",
    date: "2026-08-22",
    summary:
      "Wholesale Portal completion: dynamic equipment types and catalog architecture, predictive Live Search, global service warranty, microsoldering tag-based filtering, animated price reveal and the redesigned pricing wizard/result panel, a second lightweight Estimate Disclaimer legal document (accepted in parallel with the existing Master Agreement, never replacing it) with its own admin publishing flow, persistent trusted-device silent session refresh, a schema-qualification fix for the pgcrypto digest() publish error, a fix so the Estimate Disclaimer renders on /wholesale/legal even without a published Master Agreement bundle, corrected visibility/contrast/keyboard-accessibility states for both legal clickwrap Accept buttons, and a continuously scrolling pricing notice above the Torays Boost Sales card.",
  },
  {
    version: "1.1.0",
    date: "2026-08-20",
    summary:
      "Launched the Wholesale Pricing Portal: a bilingual (EN/ES) interactive wizard through equipment type, category, and service, with Silver/Gold price tiers and recommended-price display; shop-code login gated by per-device admin approval; and the full Torays Boost Pro legal bundle — six-document clickwrap acceptance, price-history disclosure, and a data-retention/anonymization procedure — backed by the new wholesale_legal_documents/acceptances schema and its own preflight/migration/verify/rollback SQL quartets, including a defense-in-depth hardening patch for the legal-document immutability guard.",
  },
  {
    version: "1.0.1",
    date: "2026-08-18",
    summary:
      "Replaced the Xbox Services card photo with an original Torays Boost graphic; removed the now-unused Wikimedia CC BY-SA attribution for the previous stock photo.",
  },
  {
    version: "1.0.0",
    date: "unrecorded — pre-dates version tracking",
    summary: "Baseline. Prior site work was not individually versioned before this file existed.",
  },
];
