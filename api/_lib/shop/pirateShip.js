/**
 * CSV for Pirate Ship's "Upload a spreadsheet" batch labels.
 *
 * Per Pirate Ship's own help center (checked 2026-09-30): any CSV works as
 * long as the first row holds column titles and each address part has its
 * own column — you map the columns once on the first upload. Weight
 * (pounds or ounces) and Length/Width/Height may be included as plain
 * numbers ("no lbs/oz/inches text") and are mapped as "Override"; a blank
 * cell falls back to the default package typed in Pirate Ship. Service
 * and package type can't vary per row, so the panel exports one CSV per
 * customer-chosen service.
 */
import { centsToValue, parcelFor } from "./validate.js";

const COLUMNS = [
  "Order ID", "Name", "Company", "Address Line 1", "Address Line 2", "City", "State", "Zip", "Country",
  "Email", "Phone", "Weight (oz)", "Length (in)", "Width (in)", "Height (in)",
  "Customer chose", "Shipping charged", "Items",
];

function cell(v) {
  const s = v == null ? "" : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Package for one order: weights add up, footprint of the largest item.
 *  Blank when a product was deleted (Pirate Ship then uses its default). */
export function orderPackage(order, productsById) {
  const lines = order.items.map((i) => ({ product: productsById.get(i.product_id), quantity: i.quantity }));
  if (!lines.length || lines.some((l) => !l.product)) return null;
  return parcelFor(lines);
}

export function pirateShipRow(order, productsById) {
  const pkg = orderPackage(order, productsById);
  return [
    order.order_number,
    order.customer_name,
    "",
    order.ship_line1,
    order.ship_line2 || "",
    order.ship_city,
    order.ship_state,
    order.ship_zip,
    "US",
    order.customer_email,
    order.customer_phone,
    pkg ? pkg.weightOz : "",
    pkg ? pkg.lengthIn : "",
    pkg ? pkg.widthIn : "",
    pkg ? pkg.heightIn : "",
    `${order.shipping_carrier} ${order.shipping_service}`,
    centsToValue(order.shipping_cents),
    order.items.map((i) => `${i.quantity} x ${i.title}`).join("; "),
  ];
}

export function pirateShipCsv(orders, productsById) {
  const lines = [COLUMNS.map(cell).join(",")];
  for (const o of orders) lines.push(pirateShipRow(o, productsById).map(cell).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}
