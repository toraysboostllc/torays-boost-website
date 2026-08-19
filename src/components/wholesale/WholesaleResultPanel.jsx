import { useState } from "react";
import { RotateCcw, ShieldCheck, AlertTriangle } from "lucide-react";
import { useWholesaleLocale } from "../../i18n/WholesaleLocaleContext.jsx";
import { computeFixedPricing, computeRangePricing } from "../../lib/wholesaleMargin.js";

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
  const { t, formatPrice } = useWholesaleLocale();
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
    selection.equipoName,
    selection.modelName && selection.modelName !== selection.equipoName ? selection.modelName : null,
    service.name,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="wsp-card wsp-result-panel">
      <div className="wsp-result-header">
        <ShieldCheck size={20} className="wsp-result-header-icon" aria-hidden="true" />
        <h2 className="wsp-result-title">{t("result.title")}</h2>
      </div>

      <p className="wsp-result-breadcrumb">{breadcrumb}</p>

      {isQuote ? (
        <p className="wsp-result-diagnostic-note">{t("result.requiresDiagnostic")}</p>
      ) : (
        <>
          <dl className="wsp-result-figures">
            <div className="wsp-result-figure-row">
              <dt>{t("result.shopPrice")}</dt>
              <dd>{wholesaleDisplayPrice(service, formatPrice)}</dd>
            </div>
            <div className="wsp-result-figure-row">
              <dt>{t("result.recommendedPrice")}</dt>
              <dd>{service.recommended_price != null ? formatPrice(service.recommended_price) : "—"}</dd>
            </div>
            <div className="wsp-result-figure-row wsp-result-figure-row-accent">
              <dt>{t("result.potentialProfit")}</dt>
              <dd className={isLoss ? "wsp-result-figure-loss" : ""}>
                {rangeResult
                  ? `${formatPrice(rangeResult.potentialProfitMin)} – ${formatPrice(rangeResult.potentialProfitMax)}`
                  : fixedResult
                    ? formatPrice(fixedResult.potentialProfit)
                    : "—"}
              </dd>
            </div>
            <div className="wsp-result-figure-row">
              <dt>{t("result.estimatedMargin")}</dt>
              <dd>
                {rangeResult
                  ? `${rangeResult.estimatedMarginPercentMin?.toFixed(0) ?? "—"}% – ${rangeResult.estimatedMarginPercentMax?.toFixed(0) ?? "—"}%`
                  : fixedResult?.estimatedMarginPercent != null
                    ? `${fixedResult.estimatedMarginPercent.toFixed(0)}%`
                    : "—"}
              </dd>
            </div>
          </dl>

          {isRange && <p className="wsp-result-range-note">{t("result.rangeNote")}</p>}

          {isLoss && (
            <p className="wsp-result-loss-warning">
              <AlertTriangle size={15} aria-hidden="true" />
              {t("result.lossWarning")}
            </p>
          )}

          <label className="wsp-result-customer-price-label">
            <span>{t("result.customerPriceLabel")}</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={customerPriceInput}
              onChange={(e) => setCustomerPriceInput(e.target.value)}
              className="wsp-result-customer-price-input"
            />
          </label>
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
