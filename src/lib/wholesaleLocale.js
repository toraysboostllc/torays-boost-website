/**
 * Pure logic for the wholesale portal's country/language/currency state —
 * split out from the React context (src/i18n/WholesaleLocaleContext.jsx) so
 * it can be imported and tested directly, no JSX/render harness needed,
 * matching this repo's existing convention of real ESM-imported tests for
 * plain logic modules (see e.g. src/hooks/useRepairRequest.js's
 * buildInitialAnswers).
 */

// Only one supported value each today, per the approved spec ("Estados
// Unidos será inicialmente el único país soportado", "USD será la única
// moneda soportada", "No mostrar países o monedas que todavía no
// funcionen"). Kept as an exported array/const — not a hardcoded literal
// inline in the selector component — so adding a second supported language,
// country, or currency later is a one-line change here, never a rewrite of
// the selector or this module.
export const SUPPORTED_LANGUAGES = ["en", "es"];
export const SUPPORTED_COUNTRIES = ["US"];
export const SUPPORTED_CURRENCIES = ["USD"];

export const WHOLESALE_LOCALE_STORAGE_KEY = "torays_wholesale_locale";

/**
 * Resolves the initial language: a previously saved preference always wins;
 * the browser's own language is used ONLY as a fallback when nothing was
 * saved yet — exactly the priority the spec requires ("Usar el idioma del
 * navegador solamente como valor inicial cuando no exista una preferencia
 * guardada"). `getStoredValue`/`getBrowserLanguage` are injected functions
 * (not read from `window` directly) so this is testable without a DOM/jsdom
 * environment and safe to call during SSR/build (both return null/undefined
 * gracefully instead of throwing).
 */
export function detectInitialWholesaleLanguage(getStoredValue, getBrowserLanguage) {
  const stored = typeof getStoredValue === "function" ? getStoredValue() : null;
  if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored;

  const browserLang = (typeof getBrowserLanguage === "function" ? getBrowserLanguage() : null) || "en";
  return String(browserLang).toLowerCase().startsWith("es") ? "es" : "en";
}

/** Parses the single localStorage JSON blob this module persists
 *  ({language, country, currency}). Returns null on missing/corrupted data
 *  instead of throwing — a broken or blocked localStorage must never break
 *  the portal, just fall back to defaults. */
export function parseStoredWholesaleLocale(rawValue) {
  if (!rawValue) return null;
  try {
    const parsed = JSON.parse(rawValue);
    if (parsed && typeof parsed === "object") return parsed;
    return null;
  } catch {
    return null;
  }
}

/** Formats a USD amount for display via Intl.NumberFormat — never manual
 *  string concatenation, never a currency conversion (there is only ever
 *  one currency today; this only controls locale-appropriate
 *  grouping/decimal formatting). Returns an em dash placeholder for
 *  non-finite input rather than rendering "NaN" or "$undefined". */
export function formatWholesalePrice(amount, { language = "en", currency = "USD" } = {}) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "—";
  const locale = language === "es" ? "es-US" : "en-US";
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
}

/** Formats an ISO timestamp (e.g. wholesale_services.price_updated_at) for
 *  display — via Intl.DateTimeFormat, never manual string building. Returns
 *  `null` for anything that is not a genuinely parseable date: a missing/
 *  null value (a service with no recorded price history yet — see Document
 *  3, Section 5: "Torays Boost will not display an invented or estimated
 *  date"), or a malformed string that would otherwise produce
 *  Invalid Date/NaN. Callers must render `null` as their own explicit
 *  "no date" state (e.g. result.priceUpdatedNone, "—") — this function
 *  itself never fabricates a placeholder date string, only a real one or
 *  nothing at all. */
export function formatWholesaleDate(isoString, { language = "en" } = {}) {
  if (typeof isoString !== "string" || !isoString) return null;
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return null;
  const locale = language === "es" ? "es-US" : "en-US";
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(date);
}
