import { useLanguage } from "../../i18n/LanguageContext.jsx";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-torays-red/60 focus-visible:ring-offset-2 focus-visible:ring-offset-torays-bg";

/**
 * Visible "English | Español" switcher — same two-option control on
 * desktop and mobile, just sized differently. Switching language never
 * unmounts anything (LanguageProvider lives above the router in main.jsx),
 * so it never loses wizard step/answers or page scroll position.
 */
export function LanguageSwitcher({ variant = "header", className = "" }) {
  const { lang, setLang, t } = useLanguage();
  const isMobile = variant === "mobile";
  const textSize = isMobile ? "text-base" : "text-xs";

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${isMobile ? "min-h-11" : ""} ${className}`}
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => setLang("en")}
        aria-pressed={lang === "en"}
        className={`min-h-11 rounded-full px-2 font-heading font-medium ${textSize} ${FOCUS_RING} ${
          lang === "en" ? "text-torays-navy font-semibold" : "text-torays-text-muted hover:text-torays-text"
        }`}
      >
        {t("common.langEn")}
      </button>
      <span className="text-torays-text-muted" aria-hidden="true">
        |
      </span>
      <button
        type="button"
        onClick={() => setLang("es")}
        aria-pressed={lang === "es"}
        className={`min-h-11 rounded-full px-2 font-heading font-medium ${textSize} ${FOCUS_RING} ${
          lang === "es" ? "text-torays-navy font-semibold" : "text-torays-text-muted hover:text-torays-text"
        }`}
      >
        {t("common.langEs")}
      </button>
    </div>
  );
}
