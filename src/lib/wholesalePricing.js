/** Shared by CategoryDrilldown and MicrosolderingLensView — one formatting
 *  rule for all three pricing_type values a wholesale_services row can have
 *  (fixed, range, quote — 'quote' was added by wholesale-navigation-migration
 *  and has no price fields set at all, so it needs its own branch rather
 *  than falling through to the fixed-price formatter and rendering "NaN"). */
export function formatWholesalePrice(service) {
  if (service.pricing_type === "quote") return "Contact for quote";
  if (service.pricing_type === "range") {
    const min = Number(service.price_min);
    const max = Number(service.price_max);
    return min === max ? `$${min.toFixed(2)}` : `$${min.toFixed(2)} – $${max.toFixed(2)}`;
  }
  return `$${Number(service.fixed_price).toFixed(2)}`;
}
