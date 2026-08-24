import { RotateCcw, ShieldCheck, Tag, Star, TrendingUp } from "lucide-react";
import { useWholesaleLocale } from "../../i18n/WholesaleLocaleContext.jsx";
import { computeFixedPricing, computeRangePricing, hasCompletePriceTiers } from "../../lib/wholesaleMargin.js";
import { translateCatalogLabel, translateServiceName, resolveServiceDescription } from "../../lib/wholesaleCatalogI18n.js";
import { wholesaleHoverProps } from "../../lib/wholesaleSound.js";
import { computeAnimatedDisplayPrice, useCountUpProgress } from "../../lib/wholesalePriceAnimation.js";
import { isWarrantyActive, resolveWarrantyTerms } from "../../lib/wholesaleWarranty.js";
import { ServicePhoto } from "./ServicePhoto.jsx";

/** Silver/Purple/Gold, in display order. Purely presentational metadata —
 *  the actual prices come from the service object, keyed the same way.
 *  `badgeKey` is null for Silver (no badge at all, per spec) and a real
 *  translation key for Purple/Gold — the badge marks Purple as the
 *  DESK-configured recommendation, never a "you selected this" state,
 *  since nothing on this panel is selectable anymore. */
const PRICE_TIERS = [
  { key: "competitive", priceField: "competitive_price", nameKey: "result.tierNameCompetitive", badgeKey: null, Icon: Tag },
  {
    key: "recommended",
    priceField: "recommended_price",
    nameKey: "result.tierNameRecommended",
    badgeKey: "result.tierBadgeRecommended",
    Icon: Star,
  },
  {
    key: "highProfit",
    priceField: "high_profit_price",
    nameKey: "result.tierNameHighProfit",
    badgeKey: "result.tierBadgeHighProfit",
    Icon: TrendingUp,
  },
];

/** Profit/margin for a single DESK-configured price (a Silver/Purple/Gold
 *  tier, or the plain recommended price on a service without tiers),
 *  reusing the exact same tested calc functions throughout — a range
 *  service measures the price against its own wholesale range (worst/best
 *  case), a fixed service against its single wholesale price. Never a raw
 *  subtraction here, and never anything the shop typed — every price this
 *  function ever receives comes straight from the service object DESK
 *  configured, read-only. */
function computeTierPricing(service, price) {
  if (service.pricing_type === "range") {
    return computeRangePricing({ wholesaleMin: service.price_min, wholesaleMax: service.price_max, customerPrice: price });
  }
  return computeFixedPricing({ wholesalePrice: service.fixed_price, customerPrice: price });
}

/** Min–max-vs-single-figure branching, shared by every profit figure on
 *  this panel (each tier card, and the no-tiers fallback). */
function formatTierProfit(pricing, formatPrice) {
  if (!pricing) return "—";
  if ("potentialProfitMin" in pricing) {
    return `${formatPrice(pricing.potentialProfitMin)} – ${formatPrice(pricing.potentialProfitMax)}`;
  }
  return formatPrice(pricing.potentialProfit);
}

function formatTierMargin(pricing) {
  if (!pricing) return "—";
  if ("estimatedMarginPercentMin" in pricing) {
    return `${pricing.estimatedMarginPercentMin?.toFixed(0) ?? "—"}–${pricing.estimatedMarginPercentMax?.toFixed(0) ?? "—"}%`;
  }
  return pricing.estimatedMarginPercent != null ? `${pricing.estimatedMarginPercent.toFixed(0)}%` : "—";
}

/**
 * "Precio listo" — the reveal after WholesaleProgressPanel completes.
 * `service` is one wholesale_services row exactly as /api/wholesale-prices
 * returns it (every price — fixed_price, competitive_price,
 * recommended_price, high_profit_price — already server-resolved and
 * DESK-configured, see api/_lib/wholesaleMargin.js). This component is
 * read-only from top to bottom: it never fetches, never writes, never lets
 * the shop type or select a price, and never calls any update endpoint.
 * Every profit/margin figure shown is computed client-side from numbers
 * DESK already set — arithmetic display, not data entry. Torays Boost's
 * own internal cost/margin is never shown, only the two shop-facing
 * numbers (wholesale price, customer estimate) and the arithmetic derived
 * from them.
 */
export function WholesaleResultPanel({ selection, service, warranty, onConsultAnother }) {
  const { t, formatPrice, formatDate, language } = useWholesaleLocale();
  const isQuote = service.pricing_type === "quote";
  const isRange = service.pricing_type === "range";

  // The real, reported bug this fixes: this panel used to read ONLY
  // service.image, so a photo DESK uploaded at the Category or Equipment
  // Type level (a very natural place to put "a photo of the device itself",
  // as opposed to a photo per individual repair line item) never appeared
  // here at all -- it only ever showed as that card's cover photo on the
  // earlier selection screens. Microsoldering
  // "just worked" because its content is organized AS services directly
  // (catalog_mode='direct_services'), so a photo uploaded for it naturally
  // landed at the service level already. Priority, most to least specific:
  // the SELECTED SERVICE's own photo first (still wins whenever it exists,
  // zero change to today's working behavior), then its category's cover
  // photo, then its equipment type's cover photo. Every one of the three is
  // already the exact same { url, alt_text } | null shape the server signs
  // (see api/_lib/wholesaleDb.js) -- this is a display-priority choice, not
  // new data, no new fetch, no hardcoded owner/slug.
  const photo = service.image || selection.modelImage || selection.equipoImage || null;

  // 0 -> 1 exactly once per mount (this component remounts fresh for every
  // new result — see WholesaleWizard.jsx's screen==="result" branch — so a
  // plain mount-effect is already "once per result", no extra guard
  // needed). Immediately 1 (no animation at all) under prefers-reduced-
  // motion: reduce. Purely visual — see computeAnimatedDisplayPrice's own
  // header for why this can never change the actual displayed price.
  const shopCostProgress = useCountUpProgress(undefined, !isQuote);

  // Silver/Purple/Gold only ever apply to a service DESK has fully and
  // explicitly configured (never a formula, never a partial set — see
  // hasCompletePriceTiers) — every service without that stays on the
  // single-recommended-price read-only fallback below.
  const hasTiers = hasCompletePriceTiers(service);

  // The no-tiers fallback: DESK's own recommended_price, shown as plain
  // read-only text — never an input, never something the shop can change.
  const fallbackPricing =
    !isQuote && service.recommended_price != null ? computeTierPricing(service, service.recommended_price) : null;

  const breadcrumb = [
    selection.microsoldering ? t("microsoldering.title") : null,
    translateCatalogLabel(selection.equipoName, language),
    selection.modelName && selection.modelName !== selection.equipoName
      ? translateCatalogLabel(selection.modelName, language)
      : null,
    translateServiceName(service, language),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="wsp-card wsp-result-panel">
      <div className="wsp-result-header">
        <ShieldCheck size={20} className="wsp-result-header-icon" aria-hidden="true" />
        <h1 className="wsp-result-title">{t("result.title")}</h1>
      </div>

      <p className="wsp-result-breadcrumb">{breadcrumb}</p>

      {/* Service description — DESK-editable description_en/description_es
          (see api/_lib/wholesaleDb.js's toClientService), never conditional
          on which service/equipo this is. Renders nothing at all when the
          service has none. The photo itself renders separately, LARGE, at
          the bottom of this card (see wsp-result-photo-block below) — never
          duplicated up here as a small thumbnail. */}
      {resolveServiceDescription(service, language) && (
        <p className="wsp-result-service-description">{resolveServiceDescription(service, language)}</p>
      )}

      {isQuote ? (
        <p className="wsp-result-diagnostic-note">{t("result.requiresDiagnostic")}</p>
      ) : (
        <>
          <div className="wsp-result-money wsp-result-money-reveal">
            {/* "Your cost with Torays Boost" — read first, and the single
                biggest number on this panel: this is what the shop actually
                pays Torays Boost, so it anchors every other figure below.
                Centered (wsp-result-shopcost-hero); counts up from $0.00 to
                the real value once (shopCostProgress), then a single
                fade/scale settle (wsp-result-shopcost-settle) and a
                discreet blue glow sweep (the hero's own ::after, see
                wholesalePortal.css) play once — never a loop, never a
                flicker, and fully skipped under prefers-reduced-motion
                (both the CSS animations AND the JS count-up itself). The
                FINAL rendered text is always exactly
                computeAnimatedDisplayPrice(service, formatPrice, 1) — byte-
                identical to the non-animated price the pricing engine
                returned; see that function's own header for the exact
                guarantee. */}
            <div className="wsp-result-shopcost-hero wsp-result-shopcost-settle">
              <span className="wsp-result-money-label">{t("result.shopPrice")}</span>
              <span className="wsp-result-shopcost-value">
                {computeAnimatedDisplayPrice(service, formatPrice, shopCostProgress)}
              </span>
            </div>

            {hasTiers ? (
              /* Silver / Purple (Recommended badge) / Gold (High Profit
                 badge) — three read-only informational panels, ALWAYS
                 shown together, never a picker. No selectable-option ARIA
                 role, no checked-state attribute, no click handler, no
                 selected state — the shop cannot change anything here,
                 only read it. A soft
                 hover elevation + hover tone are still allowed (see
                 wholesaleHoverProps below), but the element is a plain
                 <div>, never a <button>, and never announces itself as
                 one. */
              <div className="wsp-result-tier-group" role="group" aria-label={t("result.tierGroupLabel")}>
                {PRICE_TIERS.map((tier) => {
                  const tierPrice = service[tier.priceField];
                  const tierPricing = computeTierPricing(service, tierPrice);
                  return (
                    <div
                      key={tier.key}
                      className={`wsp-result-tier-card wsp-result-tier-${tier.key}`}
                      {...wholesaleHoverProps()}
                    >
                      <div className="wsp-result-tier-head">
                        <tier.Icon size={16} aria-hidden="true" className="wsp-result-tier-icon" />
                        <span className="wsp-result-tier-name">{t(tier.nameKey)}</span>
                        {tier.badgeKey && <span className="wsp-result-tier-badge">{t(tier.badgeKey)}</span>}
                      </div>
                      {/* The price the SHOP charges ITS customer — the number
                          a shop owner needs to recognize instantly with a
                          customer standing in front of them, so it gets its
                          own dominant treatment (wsp-result-tier-price-value),
                          much larger than profit/margin below. */}
                      <div className="wsp-result-tier-price">
                        <span className="wsp-result-tier-row-label">{t("result.tierCustomerEstimateLabel")}</span>
                        <span className="wsp-result-tier-price-value">{formatPrice(tierPrice)}</span>
                      </div>
                      {/* Profit/margin — secondary information, deliberately
                          smaller than the price above so they never compete
                          with it visually. */}
                      <div className="wsp-result-tier-secondary">
                        <div className="wsp-result-tier-secondary-item">
                          <span className="wsp-result-tier-row-label">{t("result.tierEstimatedProfitLabel")}</span>
                          <span className="wsp-result-tier-profit-value">{formatTierProfit(tierPricing, formatPrice)}</span>
                        </div>
                        <div className="wsp-result-tier-secondary-item">
                          <span className="wsp-result-tier-row-label">{t("result.tierMarginLabel")}</span>
                          <span className="wsp-result-tier-margin-value">{formatTierMargin(tierPricing)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* No tiers configured — the single DESK-set recommended
                 price, read-only text (never an input). */
              <>
                <div className="wsp-result-money-hero">
                  <span className="wsp-result-money-label">{t("result.recommendedPrice")}</span>
                  <span className="wsp-result-recommended-value">{formatPrice(service.recommended_price)}</span>
                </div>

                <div className="wsp-result-money-row wsp-result-profit">
                  <span className="wsp-result-money-label">{t("result.potentialProfit")}</span>
                  <span className="wsp-result-money-value">{formatTierProfit(fallbackPricing, formatPrice)}</span>
                </div>
                <p className="wsp-result-grow-margin">{t("result.growMargin")}</p>

                <div className="wsp-result-margin-row">
                  <span className="wsp-result-money-label">{t("result.estimatedMargin")}</span>
                  <span className="wsp-result-margin-badge">{formatTierMargin(fallbackPricing)}</span>
                </div>
              </>
            )}
          </div>

          {isRange && <p className="wsp-result-range-note">{t("result.rangeNote")}</p>}
        </>
      )}

      {/* DESK-authored guidance for this specific service (reuses the
          existing wholesale_services.notes column — see Adenda 8 diagnosis:
          already customer-facing at the API layer, no schema change). Plain
          text interpolation only (React auto-escapes) — never
          dangerouslySetInnerHTML. Only the heading is translated; the
          content is shown exactly as DESK saved it, in whichever language
          the admin wrote it. Renders nothing at all (no empty block) when
          there's no recommendation set. */}
      {service.notes?.trim() && (
        <p className="wsp-result-recommendation">
          <strong>{t("result.recommendationHeading")}</strong> {service.notes}
        </p>
      )}

      {/* Global service warranty (Wholesale Shops -> Catalog -> Pricing &
          Sales Settings in DESK, ONE setting for the whole portal) — comes
          exclusively from the `warranty` prop, which is exactly
          /api/wholesale-prices' top-level `warranty` field, threaded
          through WholesalePrices.jsx -> WholesaleWizard.jsx unchanged.
          Never reads service/selection/equipmentType — the exact same box
          renders for every service, grouped or direct_services alike, with
          no per-service/per-equipo override anywhere in this codebase.
          Renders nothing at all (no empty box, no empty space) unless
          isWarrantyActive(warranty) is true — off, or a malformed/
          incomplete object (should never happen given the schema-level
          CHECK constraint, but the client trusts nothing), both degrade to
          "don't render". Terms follow resolveWarrantyTerms' EN/ES
          fallback: the language-matched text first, then whichever
          language IS set, matching resolveServiceDescription's own
          established pattern. */}
      {isWarrantyActive(warranty) && (
        <div className="wsp-result-warranty">
          <p className="wsp-result-warranty-title">{t("warranty.title", { days: warranty.durationDays })}</p>
          {resolveWarrantyTerms(warranty, language) && (
            <p className="wsp-result-warranty-terms">{resolveWarrantyTerms(warranty, language)}</p>
          )}
        </div>
      )}

      <p className="wsp-result-keep-customer-note">{t("result.keepCustomerNote")}</p>
      {!isQuote && <p className="wsp-result-disclaimer">{t("result.disclaimer")}</p>}
      {/* Document 3 (Pricing Estimates & Independent Retail Pricing
          Disclaimer), Section 5: informational only, never a reserved
          price. service.price_updated_at is `null` for a service with no
          recorded price_history yet — formatDate() returns `null` for that
          too, so this always renders the plain "—" placeholder
          (result.priceUpdatedNone) rather than any invented/estimated
          date. Reuses the existing wsp-result-disclaimer class — small,
          muted, matches the existing disclaimer line right above it —
          rather than introducing new styling for this addition. */}
      <p className="wsp-result-disclaimer">
        {t("result.priceUpdatedLabel")}: {formatDate(service.price_updated_at) || t("result.priceUpdatedNone")}
      </p>

      <button
        type="button"
        {...wholesaleHoverProps(onConsultAnother)}
        className="wsp-btn wsp-btn-primary wsp-result-consult-another"
      >
        <RotateCcw size={16} aria-hidden="true" />
        {t("result.consultAnother")}
      </button>

      {/* Large photo — the SELECTED service's own photo first, falling back
          to its category's then its equipment type's cover photo (see
          `photo` above for the full "why" — this is the real fix for a
          reported bug: a photo uploaded at the Category/Equipment Type
          level used to never appear here at all). Placed after the full
          quote (cost, tiers, recommendation, this button) and before the
          sibling Torays Boost Sales module that WholesaleWizard.jsx renders
          right after this card. Renders nothing at all when none of the
          three levels has a photo — no empty box, no empty frame.
          wsp-result-photo-block reserves >=24px of space AFTER the frame,
          before this panel ends — the frame no longer sits flush against
          the card's own bottom edge or (by extension) the Torays Boost
          Sales module right below it. wsp-result-photo-frame is the
          professional soft-background/thin-border/rounded/subtle-shadow
          container (see wholesalePortal.css); it — not the <img> itself —
          owns the width:100%/max-width:540px/padding, so the padding
          visually surrounds the photo rather than the photo touching the
          frame's edges. size is intentionally omitted on ServicePhoto (see
          its own header) so the image keeps its real, original aspect
          ratio — height:auto, never object-fit:cover — filling the
          frame's own padding box at 100% width, edge-to-edge with zero
          horizontal overflow on mobile the same way the frame itself
          already is. */}
      {photo && (
        <div className="wsp-result-photo-block">
          <div className="wsp-result-photo-frame">
            <ServicePhoto
              image={photo}
              alt={photo?.alt_text || translateServiceName(service, language)}
              className="wsp-result-photo-large"
            />
          </div>
        </div>
      )}
    </div>
  );
}
