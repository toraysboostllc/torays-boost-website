/**
 * Input validation + money helpers for the store. Pure functions only —
 * no network, no env — so they're shared by api/shop.js, the dev server
 * and the tests. Money is ALWAYS integer cents inside the app; strings like
 * "22.99" only exist at the edges (forms, PayPal JSON, carrier JSON).
 */

export const CONDITIONS = ["new", "open_box", "refurbished", "used_like_new", "used_good", "used_fair", "for_parts"];
export const PRODUCT_STATUSES = ["draft", "published"];
export const MAX_PHOTOS = 5;

const US_STATES = new Set(
  ("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR " +
    "PA RI SC SD TN TX UT VT VA WA WV WI WY").split(" ")
);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
export const IMAGE_PATH_RE = /^uploads\/\d{4}\/[0-9a-f]{32}\.(webp|jpg|png)$/;

export class ValidationError extends Error {
  constructor(field, message = "invalid") {
    super(`${field}: ${message}`);
    this.field = field;
  }
}

export function isUuid(v) {
  return typeof v === "string" && UUID_RE.test(v);
}

/** "22.99" / "22.9" / "22" / 22.99 -> 2299. Parsed as a string on purpose
 *  (never float math) so 0.1+0.2-style drift can't creep into a price. */
export function toCents(value) {
  const s = typeof value === "number" ? value.toFixed(2) : String(value ?? "").trim().replace(/^\$/, "");
  const m = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] || "0").padEnd(2, "0"));
}

/** 2299 -> "22.99" (the exact format PayPal requires for USD). */
export function centsToValue(cents) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(cents));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

function str(input, field, { min = 0, max, required = true } = {}) {
  const v = typeof input === "string" ? input.trim() : input == null ? "" : String(input).trim();
  if (required && v.length < Math.max(1, min)) throw new ValidationError(field, "required");
  if (v.length > max) throw new ValidationError(field, "too_long");
  return v;
}

function num(input, field, { min, max, integer = false }) {
  const n = typeof input === "number" ? input : Number(String(input ?? "").trim());
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
    throw new ValidationError(field, "out_of_range");
  }
  return n;
}

export function normalizeCustomer(input = {}) {
  const email = str(input.email, "email", { max: 254 }).toLowerCase();
  if (!EMAIL_RE.test(email)) throw new ValidationError("email", "invalid");
  const phoneDigits = String(input.phone ?? "").replace(/\D/g, "");
  if (phoneDigits.length < 10 || phoneDigits.length > 15) throw new ValidationError("phone", "invalid");
  return { name: str(input.name, "name", { min: 2, max: 80 }), email, phone: phoneDigits };
}

export function normalizeAddress(input = {}) {
  const state = str(input.state, "state", { max: 2 }).toUpperCase();
  if (!US_STATES.has(state)) throw new ValidationError("state", "invalid");
  const zip = str(input.zip, "zip", { max: 10 });
  if (!/^\d{5}(-\d{4})?$/.test(zip)) throw new ValidationError("zip", "invalid");
  return {
    line1: str(input.line1, "line1", { min: 3, max: 100 }),
    line2: str(input.line2, "line2", { max: 100, required: false }),
    city: str(input.city, "city", { min: 2, max: 60 }),
    state,
    zip,
    country: "US",
  };
}

/** Cart lines from the browser: only ids + quantities are trusted, and
 *  duplicate lines of one product are merged. */
export function normalizeCart(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 20) throw new ValidationError("items", "invalid");
  const merged = new Map();
  for (const it of items) {
    if (!isUuid(it?.productId)) throw new ValidationError("items", "invalid_product");
    const q = num(it.quantity, "quantity", { min: 1, max: 99, integer: true });
    merged.set(it.productId, (merged.get(it.productId) || 0) + q);
  }
  for (const q of merged.values()) if (q > 99) throw new ValidationError("quantity", "out_of_range");
  return [...merged].map(([productId, quantity]) => ({ productId, quantity }));
}

export function normalizeProductInput(input = {}) {
  const priceCents = toCents(input.price);
  if (priceCents == null || priceCents < 1) throw new ValidationError("price", "invalid");
  const condition = String(input.condition || "");
  if (!CONDITIONS.includes(condition)) throw new ValidationError("condition", "invalid");
  const status = String(input.status || "draft");
  if (!PRODUCT_STATUSES.includes(status)) throw new ValidationError("status", "invalid");
  const images = Array.isArray(input.images) ? input.images : [];
  if (images.length > MAX_PHOTOS) throw new ValidationError("images", "max_5");
  if (new Set(images).size !== images.length || !images.every((p) => typeof p === "string" && IMAGE_PATH_RE.test(p))) {
    throw new ValidationError("images", "invalid");
  }
  return {
    title: str(input.title, "title", { max: 140 }),
    description: str(input.description, "description", { max: 5000, required: false }),
    price_cents: priceCents,
    condition,
    category: str(input.category, "category", { max: 40, required: false }),
    stock: num(input.stock, "stock", { min: 0, max: 100000, integer: true }),
    status,
    images,
    weight_oz: num(input.weightOz, "weightOz", { min: 0.1, max: 2400 }),
    length_in: num(input.lengthIn, "lengthIn", { min: 0.1, max: 108 }),
    width_in: num(input.widthIn, "widthIn", { min: 0.1, max: 108 }),
    height_in: num(input.heightIn, "heightIn", { min: 0.1, max: 108 }),
  };
}

/** One box for the whole cart: weights add up, the footprint is the
 *  largest item's, heights stack. A deliberate approximation for rating —
 *  the admin can correct the real box when buying the label. */
export function parcelFor(lines) {
  let weight = 0;
  let length = 0;
  let width = 0;
  let height = 0;
  for (const { product, quantity } of lines) {
    const dims = [Number(product.length_in), Number(product.width_in), Number(product.height_in)].sort((a, b) => b - a);
    weight += Number(product.weight_oz) * quantity;
    length = Math.max(length, dims[0]);
    width = Math.max(width, dims[1]);
    height += dims[2] * quantity;
  }
  const r = (n) => Math.round(n * 100) / 100;
  return { weightOz: r(weight), lengthIn: r(length), widthIn: r(width), heightIn: r(Math.min(height, 108)) };
}

export function normalizeParcel(input = {}) {
  return {
    weightOz: num(input.weightOz, "weightOz", { min: 0.1, max: 2400 }),
    lengthIn: num(input.lengthIn, "lengthIn", { min: 0.1, max: 108 }),
    widthIn: num(input.widthIn, "widthIn", { min: 0.1, max: 108 }),
    heightIn: num(input.heightIn, "heightIn", { min: 0.1, max: 108 }),
  };
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Pickup settings from the panel. Hours: one open–close range per day
 *  (0 = Sunday … 6 = Saturday), Miami local time. Enabling pickup
 *  requires an address and at least one day — the "ready" email always
 *  has to carry both. */
export function normalizePickupSettings(input = {}) {
  const hours = Array.isArray(input.pickupHours) ? input.pickupHours : [];
  if (hours.length > 7) throw new ValidationError("pickupHours", "invalid");
  const seen = new Set();
  const clean = hours
    .map((h) => {
      const day = Number(h?.day);
      if (!Number.isInteger(day) || day < 0 || day > 6 || seen.has(day)) throw new ValidationError("pickupHours", "invalid_day");
      seen.add(day);
      if (!HHMM.test(h.open || "") || !HHMM.test(h.close || "") || h.open >= h.close) throw new ValidationError("pickupHours", "invalid_time");
      return { day, open: h.open, close: h.close };
    })
    .sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7)); // Monday first
  const enabled = !!input.pickupEnabled;
  const address = str(input.pickupAddress, "pickupAddress", { max: 300, required: false });
  if (enabled && !address) throw new ValidationError("pickupAddress", "required");
  if (enabled && clean.length === 0) throw new ValidationError("pickupHours", "required");
  return {
    pickup_enabled: enabled,
    pickup_area: str(input.pickupArea, "pickupArea", { max: 80, required: false }),
    pickup_address: address,
    pickup_hours: clean,
    pickup_notes: str(input.pickupNotes, "pickupNotes", { max: 600, required: false }),
  };
}
