/**
 * Server-only resolution of a service's "recommended customer price" — the
 * ONLY place in either repo that computes this number. Never imported from
 * src/ (see src/lib/wholesaleMargin.js's header for why the client-side
 * file deliberately has no recommended-price formula at all — the browser
 * only ever displays what this file already resolved). This keeps the
 * requirement "no hardcodear precios en el frontend" true by construction:
 * there is no code path in the client bundle that could reconstruct this
 * number from scratch even if someone tried.
 *
 * Priority (exact order specified, never reordered):
 *   1. wholesale_services.recommended_price (manual, set from DESK) — used
 *      as-is, no rounding applied (an admin who typed an exact number meant
 *      exactly that number).
 *   2. wholesale_services.target_margin_percent (per-service override).
 *   3. wholesale_portal_settings.default_target_margin_percent (global
 *      fallback — this row always exists, seeded by the migration).
 *   4. Whichever margin percent won above is run through the formula below,
 *      then the configured rounding rule.
 *
 * The formula is MARGIN (profit as a % of the sale price), not MARKUP
 * (profit as a % of cost) — these are different numbers for the same input,
 * and using the wrong one silently under-recommends every price:
 *   recommendedPrice = wholesalePrice / (1 - targetMarginPercent / 100)
 * Example: wholesalePrice=80, targetMarginPercent=47 -> 80 / 0.53 = 150.94.
 */

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/** Rounds an already-computed recommended price per the configured rule.
 *  Never mutates a manual recommended_price (that path returns before this
 *  is ever called) — only applies to margin-formula results. `charm_99`
 *  rounds UP to the next whole dollar minus one cent (e.g. 150.94 -> 150.99,
 *  91 -> 91.99) — never down, so the target margin is never undershot by
 *  the rounding step itself. */
export function applyRoundingRule(value, roundingRule) {
  if (!isFiniteNumber(value)) return null;
  switch (roundingRule) {
    case "nearest_1":
      return Math.round(value);
    case "nearest_5":
      return Math.round(value / 5) * 5;
    case "charm_99":
      return Math.max(0, Math.ceil(value) - 0.01);
    case "none":
    default:
      // Still normalized to cents — "none" means "no rule-based rounding",
      // not "keep floating-point noise like 150.94339999999998".
      return Math.round(value * 100) / 100;
  }
}

/** The margin formula itself, isolated so it — and only it — can be unit
 *  tested against the exact worked example from the approved spec
 *  (80 / 47% -> 150.94) independent of rounding or the priority chain.
 *  Returns null on any invalid input: negative/NaN wholesalePrice, or a
 *  targetMarginPercent outside [0, 100) (100 or more makes the denominator
 *  zero or negative, which is not a valid margin — enforced here even
 *  though the DB CHECK constraint already guarantees it for stored values,
 *  because this function must also be safe to call with a value that
 *  hasn't been validated yet). */
export function computeRecommendedPriceFromMargin(wholesalePrice, targetMarginPercent) {
  if (!isFiniteNumber(wholesalePrice) || wholesalePrice < 0) return null;
  if (!isFiniteNumber(targetMarginPercent) || targetMarginPercent < 0 || targetMarginPercent >= 100) return null;
  const raw = wholesalePrice / (1 - targetMarginPercent / 100);
  return isFiniteNumber(raw) ? raw : null;
}

/** The wholesale cost basis to recommend against. `fixed` uses fixed_price
 *  directly. `range` conservatively uses price_max — the more expensive end
 *  of the wholesale range — so the recommended price still clears the
 *  target margin even in the worst-case (most complex) repair within that
 *  range, rather than under-recommending based on the cheapest outcome.
 *  `quote` has no wholesale basis at all (price is unknown until a real
 *  diagnostic happens) — returns null, and resolveRecommendedPrice() below
 *  short-circuits before ever reaching the margin formula for this type. */
function wholesaleBasis(service) {
  if (service.pricing_type === "fixed") return service.fixed_price ?? null;
  if (service.pricing_type === "range") return service.price_max ?? null;
  return null;
}

/**
 * Resolves the single recommended price shown to the shop for one service,
 * following the exact 4-step priority above. `service` is a raw
 * wholesale_services row (snake_case, as read from Postgres);
 * `portalSettings` is the wholesale_portal_settings singleton row. Returns
 * null for a `quote` service (no price exists yet to recommend against) —
 * callers must never fabricate a number for that case.
 */
export function resolveRecommendedPrice(service, portalSettings) {
  if (service.pricing_type === "quote") return null;

  if (service.recommended_price !== null && service.recommended_price !== undefined) {
    const manual = Number(service.recommended_price);
    return isFiniteNumber(manual) && manual >= 0 ? manual : null;
  }

  const basis = wholesaleBasis(service);
  if (basis === null) return null;

  // Number(null) is 0, not NaN — so a missing fallback must be checked for
  // null/undefined explicitly here too, the same way service.target_margin_percent
  // already is just above. Without this, a genuinely absent/broken settings
  // row would silently resolve to "0% margin" (recommended price = wholesale
  // price) instead of failing safely to null.
  const fallbackMargin = portalSettings?.default_target_margin_percent;
  const marginPercent =
    service.target_margin_percent !== null && service.target_margin_percent !== undefined
      ? Number(service.target_margin_percent)
      : fallbackMargin !== null && fallbackMargin !== undefined
        ? Number(fallbackMargin)
        : NaN;

  const raw = computeRecommendedPriceFromMargin(basis, marginPercent);
  if (raw === null) return null;

  return applyRoundingRule(raw, portalSettings?.rounding_rule);
}
