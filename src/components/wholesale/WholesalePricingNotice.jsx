import { AlertTriangle } from "lucide-react";
import { useWholesaleLocale } from "../../i18n/WholesaleLocaleContext.jsx";

/**
 * Short, permanent notice shown directly above the "Torays Boost Sales"
 * card — prices are estimates, not a guaranteed final quote, and can
 * change with market conditions. Purely informational: no dismiss
 * control, no navigation, no data of its own (never touches catalog/
 * price/warranty/legal state) — mirrors the "Internal draft notice"
 * banner's own non-dismissible convention on /wholesale/legal.
 *
 * Text is split into 3 i18n keys (before/highlight/after) and composed as
 * plain React children so only "may change"/"pueden cambiar" renders
 * inside the red <span> — same "never dangerouslySetInnerHTML" discipline
 * as the rest of this codebase.
 *
 * The highlighted phrase gets a slow, continuous, subtle color pulse
 * (2.6s ease-in-out loop) — never the whole banner — to draw a little
 * extra attention to "may change" without being distracting. Pauses on
 * :hover/:focus-within (a shop reading the text shouldn't have color
 * shifting under their eyes) and is fully disabled under
 * prefers-reduced-motion (falls back to the same solid red, no pulse).
 * Nothing in this component is interactive/focusable itself, so keyboard
 * navigation simply passes over it without any change in tab order.
 */
export function WholesalePricingNotice() {
  const { t } = useWholesaleLocale();

  return (
    <div className="wsp-card wsp-pricing-notice" role="note">
      <AlertTriangle size={16} className="wsp-pricing-notice-icon" aria-hidden="true" />
      <p className="wsp-pricing-notice-text">
        {t("pricingNotice.before")}
        <span className="wsp-pricing-notice-highlight">{t("pricingNotice.highlight")}</span>
        {t("pricingNotice.after")}
      </p>
    </div>
  );
}
