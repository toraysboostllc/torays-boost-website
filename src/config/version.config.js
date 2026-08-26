/**
 * Site version tracking. Bumped only after a change has been verified and
 * approved for production — never mid-round. Keep in sync with the
 * "version" field in package.json.
 */
export const APP_VERSION = "1.3.1";

export const VERSION_HISTORY = [
  {
    version: "1.3.1",
    date: "2026-08-25",
    summary:
      "Wholesale Portal usability fixes, no behaviour changes outside it. Easy Search now closes only through a deliberate control: the quiet ghost X became a 40x40 red square with a white X, and the document-level listener that closed the panel on any press outside it was removed — on a phone the backdrop is most of the screen, touch synthesizes a mousedown, and closing wipes the query, so a thumb brushing the backdrop while scrolling the sheet threw away whatever the shop had just typed. Escape still closes it, deliberately: that is a keyboard affordance, not an accidental-dismissal risk. The wizard's Back, the portal's Log out and the result panel's button now share one green through a single token family and one .wsp-btn-green class, instead of two ghost buttons plus a third green hardcoded in four places; their label and icons are the portal's existing navy ink rather than white, because white on this green measures 2.28:1 and fails WCAG AA — navy clears 4.5:1 in all three states, and a test recomputes those ratios from the tokens on every run. \"Back to Price Menu\" is now simply \"Back\" and steps back one screen keeping the shop's equipo and modelo, rather than resetting the wizard and discarding every selection. Finally, a bug found in preview review: that Back appeared to load and then returned the identical quote, because it landed on the internal progress screen, which advances by itself. Back now skips screens that ask nothing and forgets only the choice made on the screen it lands on, so the falla list comes back genuinely re-choosable.",
  },
  {
    version: "1.3.0",
    date: "2026-08-25",
    summary:
      "New feature: Easy Search, a closed-by-default entry point in the authenticated Wholesale portal. A shop types a printed model code (or a commercial name/brand) and gets back real-world device specs — never a price. When the device is linked to the existing pricing catalog, a \"View Services & Wholesale Prices\" button funnels into the unmodified Equipment → Model → Failure/Service → Price flow. Purple capsule trigger on desktop, purple floating button + bottom sheet on mobile. Backed by two new tables (wholesale_device_models, wholesale_device_model_codes, RLS enabled, zero policies — same posture as every other wholesale_* table), seeded with 55 verified Apple/Samsung devices and 126 model codes/aliases. The existing Live Search, login, \"Keep me signed in\", and every other Wholesale flow are unaffected. The public site never exposes this endpoint — it requires the same authenticated shop session as the price catalog.",
  },
  {
    version: "1.2.1",
    date: "2026-08-24",
    summary:
      "Redesigned the Wholesale Portal's price-result \"Check another price\" button so it reads immediately as a way back: renamed to \"Back to Price Menu\" / \"Volver al menú de precios\", the circular reset icon replaced with a plain ArrowLeft, and the button restyled as a solid green action (#16A34A, hover #15803D, active #166534, white text/icon, no gradient, 12px radius, its own green focus ring) instead of the shared blue gradient every other primary button uses. The button's action is completely unchanged — it still calls the exact same onConsultAnother/resetToTop handler that resets the wizard back to its top screen.",
  },
  {
    version: "1.2.0",
    date: "2026-08-24",
    summary:
      "New feature: \"Keep me signed in on this device\" on the Wholesale Shop Login screen. A shop can now check a box so their session survives a browser restart (the existing 30-day trusted-device session, reused as-is — no new mechanism); left unchecked, the session ends the moment the browser closes (a true session cookie, no Max-Age) and is never silently restored later. Returning to /wholesale with an already-valid session now skips the login form entirely and goes straight to the catalog. The Access Code itself is still never stored anywhere in the browser — only HttpOnly cookies holding opaque, unrelated session/device tokens. Device approval and every existing protection (logout, admin block/revoke, Access Code regeneration) are untouched and still immediately end a remembered session.",
  },
  {
    version: "1.1.3",
    date: "2026-08-24",
    summary:
      "Fixed a reported bug: Wholesale Portal card images loaded intermittently — on some visits every card showed its fallback icon until the shop pressed F5, caused by an unretried single Storage batch-signing call silently degrading every image to null on a transient hiccup (most likely a cold serverless instance right after login), with no client-side recovery. The server now retries that batch sign call once on failure, and the client now self-heals: a one-time settle refresh shortly after the catalog first loads, a periodic background refresh, and a silent refresh whenever the tab returns to focus (visibilitychange/pageshow) — covering both a signed URL expiring while the tab was backgrounded and the browser suspending the periodic timer. Never a full page reload, never resets the wizard's current screen, and an in-flight guard prevents overlapping/duplicate refreshes.",
  },
  {
    version: "1.1.2",
    date: "2026-08-24",
    summary:
      "Fixed a reported bug: a photo uploaded from TORAYS BOOST DESK at the Category or Equipment Type level (rather than per individual service) never appeared on the Wholesale Portal's \"Pricing Ready\" result screen, even though it correctly showed as that card's cover photo on the earlier selection screens — only Microsoldering (whose content is organized as services directly) reliably showed its photo there. The result screen now falls back from the selected service's own photo to its category's, then its equipment type's, cover photo — the same signed, access-gated data the server already resolved, no new fetch, no hardcoded device name.",
  },
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
