/**
 * Shipping the owner configures in the panel (Settings → Shipping).
 *
 * There are NO live carrier rates: labels are bought by hand in Pirate
 * Ship (UPS / USPS), so what the customer pays is exactly the price the
 * owner set for the option they picked. FedEx is deliberately not offered.
 *
 *   { id, carrier: "USPS" | "UPS", service, price_cents, days_min, days_max, enabled }
 */
import crypto from "node:crypto";
import { ValidationError, toCents } from "./validate.js";

export const CARRIERS = ["USPS", "UPS"];
export const MAX_OPTIONS = 10;

/** Admin input ({ carrier, service, price: "6.50", daysMin, daysMax, enabled, id? }) -> stored rows. */
export function normalizeShippingOptions(list) {
  if (!Array.isArray(list) || list.length > MAX_OPTIONS) throw new ValidationError("shippingOptions", "invalid");
  const ids = new Set();
  return list.map((o, i) => {
    const field = `shippingOptions.${i}`;
    if (!CARRIERS.includes(o?.carrier)) throw new ValidationError(field, "carrier");
    const service = String(o.service ?? "").trim();
    if (service.length < 2 || service.length > 60) throw new ValidationError(field, "service");
    const price = toCents(o.price);
    if (price == null || price > 100000) throw new ValidationError(field, "price");
    const dMin = o.daysMin === "" || o.daysMin == null ? null : Number(o.daysMin);
    const dMax = o.daysMax === "" || o.daysMax == null ? null : Number(o.daysMax);
    for (const d of [dMin, dMax]) {
      if (d != null && (!Number.isInteger(d) || d < 1 || d > 30)) throw new ValidationError(field, "days");
    }
    if (dMin != null && dMax != null && dMin > dMax) throw new ValidationError(field, "days");
    let id = typeof o.id === "string" && /^[a-z0-9]{8,32}$/.test(o.id) ? o.id : crypto.randomBytes(6).toString("hex");
    if (ids.has(id)) id = crypto.randomBytes(6).toString("hex");
    ids.add(id);
    return { id, carrier: o.carrier, service, price_cents: price, days_min: dMin, days_max: dMax, enabled: o.enabled !== false };
  });
}

/** What checkout shows: enabled options only, cheapest first. */
export function publicShippingOptions(settings) {
  return (settings?.shipping_options || [])
    .filter((o) => o.enabled && CARRIERS.includes(o.carrier))
    .map((o) => ({ id: o.id, carrier: o.carrier, service: o.service, priceCents: o.price_cents, daysMin: o.days_min, daysMax: o.days_max }))
    .sort((a, b) => a.priceCents - b.priceCents);
}

export function adminShippingOptions(settings) {
  return (settings?.shipping_options || []).map((o) => ({
    id: o.id, carrier: o.carrier, service: o.service, price: (o.price_cents / 100).toFixed(2),
    daysMin: o.days_min ?? "", daysMax: o.days_max ?? "", enabled: !!o.enabled,
  }));
}

/** Official public tracking pages. */
export function trackingUrl(carrier, number) {
  if (!number) return null;
  const n = encodeURIComponent(number);
  if (carrier === "USPS") return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;
  if (carrier === "UPS") return `https://www.ups.com/track?tracknum=${n}`;
  return null;
}
