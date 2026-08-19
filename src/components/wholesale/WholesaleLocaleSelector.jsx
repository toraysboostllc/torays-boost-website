import { useWholesaleLocale } from "../../i18n/WholesaleLocaleContext.jsx";

/**
 * Compact country/language/currency selector — reused on both
 * WholesaleLogin.jsx (public-site light theme, photo backdrop) and the
 * private portal (`.wsp-scope`, its own blue-gray theme). Paints its own
 * light pill background (see .wsp-locale-selector in
 * src/styles/wholesalePortal.css) rather than inheriting from either
 * surrounding theme, so it reads clearly on both without a dark/light
 * variant of its own.
 *
 * Country and currency are informational only today — United States/USD
 * are the only supported values (src/lib/wholesaleLocale.js), so they
 * render as plain chips, never a dropdown offering options that don't
 * actually work yet. Only language is a real, immediate toggle.
 */
export function WholesaleLocaleSelector({ className = "" }) {
  const { language, setLanguage, t } = useWholesaleLocale();

  return (
    <div className={`wsp-locale-selector ${className}`} role="group" aria-label={t("localeSelector.languageLabel")}>
      <span className="wsp-locale-chip" title={t("localeSelector.countryLabel")}>
        <span aria-hidden="true">🇺🇸</span> {t("localeSelector.countryValue")}
      </span>
      <span className="wsp-locale-divider" aria-hidden="true" />
      <div className="wsp-locale-lang-toggle">
        <button
          type="button"
          className={`wsp-locale-lang-btn${language === "en" ? " wsp-locale-lang-btn-active" : ""}`}
          aria-pressed={language === "en"}
          onClick={() => setLanguage("en")}
        >
          English
        </button>
        <button
          type="button"
          className={`wsp-locale-lang-btn${language === "es" ? " wsp-locale-lang-btn-active" : ""}`}
          aria-pressed={language === "es"}
          onClick={() => setLanguage("es")}
        >
          Español
        </button>
      </div>
      <span className="wsp-locale-divider" aria-hidden="true" />
      <span className="wsp-locale-chip" title={t("localeSelector.currencyLabel")}>
        {t("localeSelector.currencyValue")}
      </span>
    </div>
  );
}
