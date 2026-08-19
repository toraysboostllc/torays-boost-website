import { useState } from "react";
import { RotateCcw, ShieldCheck, AlertTriangle } from "lucide-react";
import { useWholesaleLocale } from "../../i18n/WholesaleLocaleContext.jsx";
import { computeFixedPricing, computeRangePricing } from "../../lib/wholesaleMargin.js";
import { translateCatalogLabel } from "../../lib/wholesaleCatalogI18n.js";

/** Which single number to show for "Tu precio Shop" — fixed/range/quote all
 *  need a different presentation, and `quote` genuinely has none yet. */
function wholesaleDisplayPrice(service, formatPrice) {
  if (service.pricing_type === "fixed") return formatPrice(service.fixed_price);
  if (service.pricing_type === "range") return `${formatPrice(service.price_min)} – ${formatPrice(service.price_max)}`;
  return null; // quote
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

  const [customerPriceInput, setCustomerPriceInput] = useState(
    service.recommended_price != null ? String(service.recommended_price) : ""
  );
  const customerPrice = customerPriceInput === "" ? null : Number(customerPriceInput);

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
            <div className="wsp-result-money-row wsp-result-shopcost">
              <span className="wsp-result-money-label">{t("result.shopPrice")}</span>
              <span className="wsp-result-money-value">{wholesaleDisplayPrice(service, formatPrice)}</span>
            </div>

            {/* The editable "recommended customer price" — the input itself
                IS this figure, never a duplicate read-only value elsewhere. */}
            <div className="wsp-result-money-hero">
              <div className="wsp-result-money-hero-top">
                <span className="wsp-result-money-label">{t("result.recommendedPrice")}</span>
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
                aria-label={t("result.recommendedPrice")}
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

      <button type="button" onClick={onConsultAnother} className="wsp-btn wsp-btn-primary wsp-result-consult-another">
        <RotateCcw size={16} aria-hidden="true" />
        {t("result.consultAnother")}
      </button>
    </div>
  );
}
