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
 * Approved design (corrected 2026-08-22 — the first pass shipped a
 * static sentence with only the highlighted phrase pulsing, which did
 * not match the approved spec): the ENTIRE sentence scrolls continuously,
 * right to left, ~25s per loop. Built with the standard CSS "double copy"
 * marquee technique — a `max-content`-width track holding the real
 * sentence followed by an exact, `aria-hidden="true"` copy of it,
 * translated by -50% (= exactly one copy's width, since both are
 * identical) over the animation so the loop is seamless with no visible
 * seam or jump. Screen readers only ever see the first, real copy.
 *
 * Text is split into 3 i18n keys (before/highlight/after) and composed as
 * plain React children — never dangerouslySetInnerHTML — so only "may
 * change"/"pueden cambiar" renders inside its own red <span>, same
 * discipline as the rest of this codebase. That span stays solid red
 * (font-weight only) with no animation of its own now — a second,
 * independent pulse would compete visually with the scroll.
 *
 * Keyboard-accessible on purpose (tabIndex=0): a shop using the keyboard
 * needs a way to stop the motion to read it, same WCAG 2.2.2 "Pause,
 * Stop, Hide" rationale as the mouse-hover pause. Focus shows a visible
 * outline (see .wsp-pricing-notice:focus-visible) and pauses the scroll
 * (see .wsp-pricing-notice:focus/:focus-within in wholesalePortal.css).
 * Under prefers-reduced-motion, the track collapses back to a single,
 * complete, static, wrapped sentence — no scrolling, no visible
 * duplicate (see that media block in wholesalePortal.css).
 */
export function WholesalePricingNotice() {
  const { t } = useWholesaleLocale();

  const sentence = t("pricingNotice.before");
  const highlight = t("pricingNotice.highlight");
  const after = t("pricingNotice.after");

  return (
    <div className="wsp-card wsp-pricing-notice" role="note" tabIndex="0">
      <AlertTriangle size={16} className="wsp-pricing-notice-icon" aria-hidden="true" />
      <div className="wsp-pricing-notice-viewport">
        <div className="wsp-pricing-notice-track">
          <p className="wsp-pricing-notice-text">
            {sentence}
            <span className="wsp-pricing-notice-highlight">{highlight}</span>
            {after}
          </p>
          {/* Exact duplicate, purely decorative — keeps the marquee loop
              seamless. Never announced/reachable by assistive tech or the
              keyboard; the real sentence above is the only one that is. */}
          <p className="wsp-pricing-notice-text" aria-hidden="true">
            {sentence}
            <span className="wsp-pricing-notice-highlight">{highlight}</span>
            {after}
          </p>
        </div>
      </div>
    </div>
  );
}
