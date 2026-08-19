import { useState } from "react";
import { RotateCcw, ShieldCheck, AlertTriangle, Tag, Star, TrendingUp, Check } from "lucide-react";
import { useWholesaleLocale } from "../../i18n/WholesaleLocaleContext.jsx";
import { computeFixedPricing, computeRangePricing, hasCompletePriceTiers, isHighProfitPrice } from "../../lib/wholesaleMargin.js";
import { translateCatalogLabel } from "../../lib/wholesaleCatalogI18n.js";
import { wholesaleHoverProps } from "../../lib/wholesaleSound.js";

/** Silver/Purple/Gold, in display order. Purely presentational metadata —
 *  the actual prices come from the service object, keyed the same way. */
const PRICE_TIERS = [
  { key: "competitive", priceField: "competitive_price", labelKey: "result.tierCompetitive", Icon: Tag },
  { key: "recommended", priceField: "recommended_price", labelKey: "result.tierRecommended", Icon: Star },
  { key: "highProfit", priceField: "high_profit_price", labelKey: "result.tierHighProfit", Icon: TrendingUp },
];

/** Which single number to show for "Tu precio Shop" — fixed/range/quote all
 *  need a different presentation, and `quote` genuinely has none yet. */
function wholesaleDisplayPrice(service, formatPrice) {
  if (service.pricing_type === "fixed") return formatPrice(service.fixed_price);
  if (service.pricing_type === "range") return `${formatPrice(service.price_min)} – ${formatPrice(service.price_max)}`;
  return null; // quote
}

/** Profit/margin for a single Silver/Purple/Gold price, reusing the exact
 *  same tested calc functions as the editable hero figure below — a range
 *  service measures the tier price against its own wholesale range (worst/
 *  best case, same convention as rangeResult), a fixed service against its
 *  single wholesale price. Never a raw subtraction here. */
function computeTierPricing(service, tierPrice) {
  if (service.pricing_type === "range") {
    return computeRangePricing({ wholesaleMin: service.price_min, wholesaleMax: service.price_max, customerPrice: tierPrice });
  }
  return computeFixedPricing({ wholesalePrice: service.fixed_price, customerPrice: tierPrice });
}

/** Same min–max-vs-single-figure branching as the existing profitDisplay/
 *  marginDisplay below, just scoped to one tier's own pricing result. */
function formatTierProfit(tierPricing, formatPrice) {
  if (!tierPricing) return "—";
  if ("potentialProfitMin" in tierPricing) {
    return `${formatPrice(tierPricing.potentialProfitMin)} – ${formatPrice(tierPricing.potentialProfitMax)}`;
  }
  return formatPrice(tierPricing.potentialProfit);
}

function formatTierMargin(tierPricing) {
  if (!tierPricing) return "—";
  if ("estimatedMarginPercentMin" in tierPricing) {
    return `${tierPricing.estimatedMarginPercentMin?.toFixed(0) ?? "—"}–${tierPricing.estimatedMarginPercentMax?.toFixed(0) ?? "—"}%`;
  }
  return tierPricing.estimatedMarginPercent != null ? `${tierPricing.estimatedMarginPercent.toFixed(0)}%` : "—";
}

/**
 * "Precio listo" — the reveal after WholesaleProgressPanel completes.
 * `service` is one wholesale_services row exactly as /api/wholesale-prices
 * returns it (recommended_price already server-resolved, see
 * api/_lib/wholesaleMargin.js). This component never fetches, never
 * recomputes a recommended price, and never shows Torays Boost's own
 * internal cost/margin — only the two shop-facing numbers (wholesale price,
 * customer price) and the arithmetic derived from them.
 */
export function WholesaleResultPanel({ selection, service, onConsultAnother }) {
  const { t, formatPrice, language } = useWholesaleLocale();
  const isQuote = service.pricing_type === "quote";
  const isRange = service.pricing_type === "range";

  // Silver/Purple/Gold only ever apply to a service DESK has fully and
  // explicitly configured (never a formula, never a partial set — see
  // hasCompletePriceTiers) — every service without that stays on exactly
  // today's single-recommended-price experience, unchanged.
  const hasTiers = hasCompletePriceTiers(service);

  const [customerPriceInput, setCustomerPriceInput] = useState(
    service.recommended_price != null ? String(service.recommended_price) : ""
  );
  const customerPrice = customerPriceInput === "" ? null : Number(customerPriceInput);

  function selectTier(priceField) {
    setCustomerPriceInput(String(service[priceField]));
  }

  // "Igual o superior" al nivel Gold siempre clasifica como High Profit,
  // incluso si el monto no coincide con ningún nivel exacto (el shop
  // escribió más que Gold) — este chequeo va primero, antes de comparar
  // contra Silver/Purple, para que ese caso límite nunca se pierda.
  const activeTierKey = !hasTiers || customerPrice == null
    ? null
    : isHighProfitPrice(customerPrice, service.high_profit_price)
      ? "highProfit"
      : customerPrice === service.competitive_price
        ? "competitive"
        : customerPrice === service.recommended_price
          ? "recommended"
          : null;

  const heroLabel = hasTiers
    ? t(
        activeTierKey
          ? PRICE_TIERS.find((tier) => tier.key === activeTierKey).labelKey
          : "result.tierCustomLabel"
      )
    : t("result.recommendedPrice");

  const fixedResult =
    !isQuote && !isRange && customerPrice != null
      ? computeFixedPricing({ wholesalePrice: service.fixed_price, customerPrice })
      : null;
  const rangeResult =
    isRange && customerPrice != null
      ? computeRangePricing({ wholesaleMin: service.price_min, wholesaleMax: service.price_max, customerPrice })
      : null;

  const isLoss = fixedResult?.isLoss || rangeResult?.isLoss || false;

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

  const profitDisplay = rangeResult
    ? `${formatPrice(rangeResult.potentialProfitMin)} – ${formatPrice(rangeResult.potentialProfitMax)}`
    : fixedResult
      ? formatPrice(fixedResult.potentialProfit)
      : "—";

  const marginDisplay = rangeResult
    ? `${rangeResult.estimatedMarginPercentMin?.toFixed(0) ?? "—"}% – ${rangeResult.estimatedMarginPercentMax?.toFixed(0) ?? "—"}%`
    : fixedResult?.estimatedMarginPercent != null
      ? `${fixedResult.estimatedMarginPercent.toFixed(0)}%`
      : "—";

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
            {/* 1) "Your cost with Torays Boost" — read first, and the single
                biggest number on this panel (see .wsp-result-shopcost-value
                in wholesalePortal.css): this is what the shop actually pays
                Torays Boost, so it anchors every other figure below it. */}
            <div className="wsp-result-shopcost-hero">
              <span className="wsp-result-money-label">{t("result.shopPrice")}</span>
              <span className="wsp-result-shopcost-value">{wholesaleDisplayPrice(service, formatPrice)}</span>
            </div>

            {/* 2) Silver / Purple (Recommended, preselected once its price
                matches the initial editable value below) / Gold (High
                Profit) — real tactile buttons, shown only once DESK has
                configured all three (see hasTiers above); a service still
                on the single-price experience never shows a skeleton/
                partial tier row. Each card shows, in order: the estimated
                customer price, the shop's estimated profit at that price,
                and the margin as smaller secondary text — never color
                alone (icon + text label always accompany the price).
                Selecting one immediately updates the editable price below
                (and therefore the profit/margin summary further down) —
                the input stays the single source of truth for what the
                shop is charging, never a duplicate read-only figure. */}
            {hasTiers && (
              <div className="wsp-result-tier-group" role="radiogroup" aria-label={t("result.tierGroupLabel")}>
                {PRICE_TIERS.map((tier) => {
                  const tierPrice = service[tier.priceField];
                  const tierPricing = computeTierPricing(service, tierPrice);
                  const isActive = activeTierKey === tier.key;
                  return (
                    <button
                      key={tier.key}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      className={`wsp-result-tier-card wsp-result-tier-${tier.key}${isActive ? " wsp-result-tier-selected" : ""}`}
                      {...wholesaleHoverProps(() => selectTier(tier.priceField))}
                    >
                      <span className="wsp-result-tier-top">
                        <tier.Icon size={14} aria-hidden="true" className="wsp-result-tier-icon" />
                        {isActive && <Check size={14} aria-hidden="true" className="wsp-result-tier-check" />}
                      </span>
                      <span className="wsp-result-tier-label">{t(tier.labelKey)}</span>
                      <span className="wsp-result-tier-price">{formatPrice(tierPrice)}</span>
                      <span className="wsp-result-tier-profit">
                        {t("result.tierProfitLabel")} {formatTierProfit(tierPricing, formatPrice)}
                      </span>
                      <span className="wsp-result-tier-margin">
                        {formatTierMargin(tierPricing)} {t("result.tierMarginSuffix")}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* The editable customer price — the input itself IS this
                figure, never a duplicate read-only value elsewhere. Its
                label reflects whichever tier (if any) the current value
                matches, or a generic "custom price" label once the shop
                types something that matches none of the three. */}
            <div className="wsp-result-money-hero">
              <div className="wsp-result-money-hero-top">
                <span className="wsp-result-money-label">{heroLabel}</span>
                <span className="wsp-result-editable-badge">{t("result.editableLabel")}</span>
              </div>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={customerPriceInput}
                onChange={(e) => setCustomerPriceInput(e.target.value)}
                className="wsp-result-recommended-input"
                aria-label={heroLabel}
              />
            </div>

            <div className="wsp-result-money-row wsp-result-profit">
              <span className="wsp-result-money-label">{t("result.potentialProfit")}</span>
              <span className={`wsp-result-money-value${isLoss ? " wsp-result-figure-loss" : ""}`}>{profitDisplay}</span>
            </div>
            <p className="wsp-result-grow-margin">{t("result.growMargin")}</p>

            <div className="wsp-result-margin-row">
              <span className="wsp-result-money-label">{t("result.estimatedMargin")}</span>
              <span className="wsp-result-margin-badge">{marginDisplay}</span>
            </div>
          </div>

          {isRange && <p className="wsp-result-range-note">{t("result.rangeNote")}</p>}

          {isLoss && (
            <p className="wsp-result-loss-warning">
              <AlertTriangle size={15} aria-hidden="true" />
              {t("result.lossWarning")}
            </p>
          )}
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
