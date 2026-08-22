/**
 * Global service warranty (Wholesale Shops -> Catalog -> Pricing & Sales
 * Settings in DESK) — ONE setting for the whole portal, applied to every
 * quote alike. Pure, presentation-agnostic helpers only; the actual
 * `warranty` object ({ enabled, durationDays, termsEn, termsEs }) always
 * comes straight from the authenticated /api/wholesale-prices payload (see
 * api/_lib/wholesaleDb.js) — nothing here ever reads a service, equipment
 * type, or model, and nothing here is reachable from Live Search. There is
 * no per-service warranty concept anywhere in this codebase.
 */

/** True only when the box should render at all: enabled AND a real,
 *  positive duration is present. A malformed/incomplete warranty object
 *  (enabled=true but durationDays missing — should never happen given the
 *  schema-level CHECK constraint, but this is the client, trust nothing)
 *  degrades to "don't show it" rather than rendering a broken "undefined-
 *  Day Service Warranty" box. */
export function isWarrantyActive(warranty) {
  return Boolean(warranty?.enabled) && Number.isFinite(warranty?.durationDays) && warranty.durationDays > 0;
}

/** Cross-language fallback, same pattern already established for service
 *  descriptions (see resolveServiceDescription in wholesaleCatalogI18n.js):
 *  prefer the language-matched terms, fall back to whichever language IS
 *  set, `null` (never an empty string) when neither is. */
export function resolveWarrantyTerms(warranty, language) {
  const en = typeof warranty?.termsEn === "string" ? warranty.termsEn.trim() : "";
  const es = typeof warranty?.termsEs === "string" ? warranty.termsEs.trim() : "";
  if (language === "es" && es) return es;
  if (en) return en;
  if (es) return es;
  return null;
}
