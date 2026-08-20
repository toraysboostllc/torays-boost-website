import { RotateCcw, ShieldCheck, Tag, Star, TrendingUp } from "lucide-react";
import { useWholesaleLocale } from "../../i18n/WholesaleLocaleContext.jsx";
import { computeFixedPricing, computeRangePricing, hasCompletePriceTiers } from "../../lib/wholesaleMargin.js";
import { translateCatalogLabel } from "../../lib/wholesaleCatalogI18n.js";
import { wholesaleHoverProps } from "../../lib/wholesaleSound.js";

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

/** Which single number to show for "Tu precio Shop" — fixed/range/quote all
 *  need a different presentation, and `quote` genuinely has none yet. */
function wholesaleDisplayPrice(service, formatPrice) {
  if (service.pricing_type === "fixed") return formatPrice(service.fixed_price);
  if (service.pricing_type === "range") return `${formatPrice(service.price_min)} – ${formatPrice(service.price_max)}`;
  return null; // quote
}

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
export function WholesaleResultPanel({ selection, service, onConsultAnother }) {
  const { t, formatPrice, language } = useWholesaleLocale();
  const isQuote = service.pricing_type === "quote";
  const isRange = service.pricing_type === "range";

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
    translateCatalogLabel(service.name, language),
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

      {isQuote ? (
        <p className="wsp-result-diagnostic-note">{t("result.requiresDiagnostic")}</p>
      ) : (
        <>
          <div className="wsp-result-money wsp-result-money-reveal">
            {/* "Your cost with Torays Boost" — read first, and the single
                biggest number on this panel: this is what the shop actually
                pays Torays Boost, so it anchors every other figure below. */}
            <div className="wsp-result-shopcost-hero">
              <span className="wsp-result-money-label">{t("result.shopPrice")}</span>
              <span className="wsp-result-shopcost-value">{wholesaleDisplayPrice(service, formatPrice)}</span>
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
                      <div className="wsp-result-tier-row">
                        <span className="wsp-result-tier-row-label">{t("result.tierCustomerEstimateLabel")}</span>
                        <span className="wsp-result-tier-row-value">{formatPrice(tierPrice)}</span>
                      </div>
                      <div className="wsp-result-tier-row">
                        <span className="wsp-result-tier-row-label">{t("result.tierEstimatedProfitLabel")}</span>
                        <span className="wsp-result-tier-row-value">{formatTierProfit(tierPricing, formatPrice)}</span>
                      </div>
                      <div className="wsp-result-tier-row">
                        <span className="wsp-result-tier-row-label">{t("result.tierMarginLabel")}</span>
                        <span className="wsp-result-tier-row-value">{formatTierMargin(tierPricing)}</span>
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

      <p className="wsp-result-keep-customer-note">{t("result.keepCustomerNote")}</p>
      {!isQuote && <p className="wsp-result-disclaimer">{t("result.disclaimer")}</p>}

      <button
        type="button"
        {...wholesaleHoverProps(onConsultAnother)}
        className="wsp-btn wsp-btn-primary wsp-result-consult-another"
      >
        <RotateCcw size={16} aria-hidden="true" />
        {t("result.consultAnother")}
      </button>
    </div>
  );
}
