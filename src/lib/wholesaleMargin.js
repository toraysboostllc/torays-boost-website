/**
 * Client-side profit/margin recompute for the wholesale pricing wizard.
 *
 * This file NEVER computes a recommended price — that formula
 * (wholesalePrice / (1 - targetMarginPercent / 100), then rounding) lives
 * exclusively server-side in api/_lib/wholesaleMargin.js, resolved once per
 * service when the catalog is built, so it can never be hardcoded or
 * reverse-engineered from the client bundle. What lives here only ever
 * recomputes profit/margin from two numbers the browser already has: the
 * real wholesale price (fetched from Supabase via /api/wholesale-prices) and
 * whatever the shop is currently typing into "¿Cuánto cobrarás a tu
 * cliente?" — pure arithmetic over already-real data, nothing invented.
 *
 * Terminology (do not mix these up — see the "markup vs margin" note the
 * project's plan called out explicitly):
 *   - "margin" (estimatedMarginPercent) = profit as a % of the SALE price
 *     (customerPrice). This is what the portal shows the shop.
 *   - "markup" (markupPercent) = profit as a % of the COST (wholesalePrice).
 *     A different, larger number for the same sale — computed here for
 *     completeness/tests but never surfaced in the UI as "margin".
 */

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/** A selling price a shop could reasonably type — finite and >= 0. Rejects
 *  negative numbers on purpose: a negative "price to charge the customer"
 *  is never a real input, so every function below treats it as invalid
 *  (returns null) rather than computing a misleading result from it. */
function isValidCustomerPrice(value) {
  return isFiniteNumber(value) && value >= 0;
}

/** A wholesale cost as returned by the server — finite and >= 0. */
function isValidWholesalePrice(value) {
  return isFiniteNumber(value) && value >= 0;
}

/** potentialProfit = customerPrice - wholesalePrice. Can be negative (a
 *  real loss) — never clamped to zero, per the explicit requirement that a
 *  loss must be shown, not hidden. Returns null only on genuinely invalid
 *  input (NaN, non-number, negative customer price). */
export function computePotentialProfit(customerPrice, wholesalePrice) {
  if (!isValidCustomerPrice(customerPrice) || !isValidWholesalePrice(wholesalePrice)) return null;
  return customerPrice - wholesalePrice;
}

/** estimatedMarginPercent = potentialProfit / customerPrice × 100 — profit
 *  as a percentage of the SALE price. Returns null when customerPrice is 0
 *  (division by zero has no meaningful percentage) or on invalid input. */
export function computeEstimatedMarginPercent(customerPrice, wholesalePrice) {
  if (!isValidCustomerPrice(customerPrice) || !isValidWholesalePrice(wholesalePrice)) return null;
  if (customerPrice === 0) return null;
  return ((customerPrice - wholesalePrice) / customerPrice) * 100;
}

/** markupPercent = potentialProfit / wholesalePrice × 100 — profit as a
 *  percentage of COST. Distinct from margin on purpose (see file header).
 *  Returns null when wholesalePrice is 0 or on invalid input. */
export function computeMarkupPercent(customerPrice, wholesalePrice) {
  if (!isValidCustomerPrice(customerPrice) || !isValidWholesalePrice(wholesalePrice)) return null;
  if (wholesalePrice === 0) return null;
  return ((customerPrice - wholesalePrice) / wholesalePrice) * 100;
}

/** Full bundle for a `fixed`-pricing_type service: one wholesale price, one
 *  customer price, one real profit/margin — no range involved. `isLoss` is
 *  true only when potentialProfit resolved to a real negative number (never
 *  true when the calc itself failed/returned null — an unknown result is
 *  not the same claim as a confirmed loss). */
export function computeFixedPricing({ wholesalePrice, customerPrice }) {
  const potentialProfit = computePotentialProfit(customerPrice, wholesalePrice);
  const estimatedMarginPercent = computeEstimatedMarginPercent(customerPrice, wholesalePrice);
  const markupPercent = computeMarkupPercent(customerPrice, wholesalePrice);
  return {
    potentialProfit,
    estimatedMarginPercent,
    markupPercent,
    isLoss: potentialProfit !== null && potentialProfit < 0,
  };
}

/** A service has a complete Silver/Purple/Gold tier configuration only when
 *  all three prices are real numbers — competitive_price and
 *  high_profit_price are never set independently of one another or of
 *  recommended_price (the DB constraint enforces this), but this stays a
 *  defensive three-way check rather than trusting any two-of-three shape.
 *  Never invents a value: a service with any of the three missing is
 *  treated as "legacy" (single recommended-price experience), exactly the
 *  behavior that existed before tiers, never a partially-filled tier UI. */
export function hasCompletePriceTiers(service) {
  return (
    service != null &&
    isFiniteNumber(service.competitive_price) &&
    isFiniteNumber(service.recommended_price) &&
    isFiniteNumber(service.high_profit_price)
  );
}

/** True once the shop's customer price reaches the Gold/High Profit level —
 *  "igual o superior" per spec, so an exact match on the Gold price and
 *  anything the shop types above it both classify as High Profit. Only
 *  meaningful when the service actually has a high_profit_price; returns
 *  false (never a guess) when either input is missing. */
export function isHighProfitPrice(customerPrice, highProfitPrice) {
  if (!isFiniteNumber(customerPrice) || !isFiniteNumber(highProfitPrice)) return false;
  return customerPrice >= highProfitPrice;
}

/** Full bundle for a `range`-pricing_type service. Never a single number
 *  claiming false precision — profit and margin are both shown as ranges:
 *    ganancia mínima = customerPrice - wholesaleMax  (worst case for the shop)
 *    ganancia máxima = customerPrice - wholesaleMin  (best case for the shop)
 *  `isLoss` is driven by the WORST case (profitMin < 0) — a range where the
 *  cheapest possible wholesale outcome still turns a profit but the most
 *  expensive one would not is exactly the case this field exists to warn
 *  about; `isGuaranteedLoss` is true only when even the best case
 *  (profitMax) is negative. */
export function computeRangePricing({ wholesaleMin, wholesaleMax, customerPrice }) {
  if (
    !isValidWholesalePrice(wholesaleMin) ||
    !isValidWholesalePrice(wholesaleMax) ||
    wholesaleMin > wholesaleMax ||
    !isValidCustomerPrice(customerPrice)
  ) {
    return null;
  }

  const potentialProfitMin = computePotentialProfit(customerPrice, wholesaleMax);
  const potentialProfitMax = computePotentialProfit(customerPrice, wholesaleMin);
  const estimatedMarginPercentMin = computeEstimatedMarginPercent(customerPrice, wholesaleMax);
  const estimatedMarginPercentMax = computeEstimatedMarginPercent(customerPrice, wholesaleMin);

  return {
    potentialProfitMin,
    potentialProfitMax,
    estimatedMarginPercentMin,
    estimatedMarginPercentMax,
    isLoss: potentialProfitMin !== null && potentialProfitMin < 0,
    isGuaranteedLoss: potentialProfitMax !== null && potentialProfitMax < 0,
  };
}
