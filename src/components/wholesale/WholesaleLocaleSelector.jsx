import { useWholesaleLocale } from "../../i18n/WholesaleLocaleContext.jsx";
import { wholesaleHoverProps } from "../../lib/wholesaleSound.js";

/**
 * Hand-authored, simplified US flag — Windows renders the 🇺🇸 regional-
 * indicator emoji as the literal fallback text "US" (no flag glyph
 * support), which read as the nonsensical "US USA" next to the "USA"
 * label below. An inline SVG has no font-fallback failure mode: it always
 * renders as a flag, on every OS. 13 stripes + a simplified star field
 * (a grid of dots, not 50 individually-placed stars) reads clearly as
 * "the US flag" at the small chip size this renders at — no icon library
 * in this project (lucide-react) ships country flags, so this is drawn
 * directly rather than adding a new dependency for one icon. Purely
 * decorative (aria-hidden) — the adjacent "USA" text plus the chip's own
 * aria-label below are what a screen reader actually announces.
 */
function UsFlagIcon() {
  const stripeHeight = 20 / 13;
  const cantonHeight = stripeHeight * 7;
  const redStripes = Array.from({ length: 13 }, (_, i) => i).filter((i) => i % 2 === 0);
  const starRows = Array.from({ length: 4 }, (_, i) => i);
  const starCols = Array.from({ length: 5 }, (_, i) => i);
  return (
    <svg viewBox="0 0 30 20" width="18" height="12" aria-hidden="true" focusable="false">
      <rect width="30" height="20" fill="#FFFFFF" />
      {redStripes.map((i) => (
        <rect key={i} x="0" y={i * stripeHeight} width="30" height={stripeHeight} fill="#B22234" />
      ))}
      <rect x="0" y="0" width="12" height={cantonHeight} fill="#3C3B6E" />
      {starRows.flatMap((row) =>
        starCols.map((col) => (
          <circle key={`${row}-${col}`} cx={1.6 + col * 2.2} cy={1.6 + row * 2.2} r="0.55" fill="#FFFFFF" />
        ))
      )}
    </svg>
  );
}

/**
 * Compact country/language/currency selector — reused on both
 * WholesaleLogin.jsx (public-site light theme, photo backdrop) and the
 * private portal (`.wsp-scope`, its own blue-gray theme). Paints its own
 * light pill background (see .wsp-locale-selector in
 * src/styles/wholesalePortal.css) rather than inheriting from either
 * surrounding theme, so it reads clearly on both without a dark/light
 * variant of its own.
 *
 * Country is informational only — USA is the only supported value
 * (src/lib/wholesaleLocale.js), so it renders as a plain chip (flag +
 * "USA"), never a dropdown offering options that don't actually work yet.
 * Currency stays USD internally and prices keep formatting with a "$"
 * prefix everywhere else in the portal — it's just not surfaced as its
 * own chip here anymore. Only language is a real, immediate toggle.
 */
export function WholesaleLocaleSelector({ className = "" }) {
  const { language, setLanguage, t } = useWholesaleLocale();
  const countryAccessibleLabel = `${t("localeSelector.countryLabel")}: ${t("localeSelector.countryValue")}`;

  return (
    <div className={`wsp-locale-selector ${className}`} role="group" aria-label={t("localeSelector.languageLabel")}>
      <span className="wsp-locale-chip" title={countryAccessibleLabel} aria-label={countryAccessibleLabel}>
        <UsFlagIcon /> {t("localeSelector.countryValue")}
      </span>
      <span className="wsp-locale-divider" aria-hidden="true" />
      <div className="wsp-locale-lang-toggle">
        <button
          type="button"
          className={`wsp-locale-lang-btn${language === "en" ? " wsp-locale-lang-btn-active" : ""}`}
          aria-pressed={language === "en"}
          {...wholesaleHoverProps(() => setLanguage("en"))}
        >
          English
        </button>
        <button
          type="button"
          className={`wsp-locale-lang-btn${language === "es" ? " wsp-locale-lang-btn-active" : ""}`}
          aria-pressed={language === "es"}
          {...wholesaleHoverProps(() => setLanguage("es"))}
        >
          Español
        </button>
      </div>
    </div>
  );
}
