/**
 * Sales log for year-end accounting. Pure: takes orders (with their items
 * and refunds, as stored) and returns one row per paid order plus totals,
 * and a CSV that opens directly in Excel.
 *
 * Every PayPal figure is PayPal's own number (captured gross, fee, net;
 * refund amount, fee returned, net debited) — nothing here estimates a fee.
 *
 *   net received      = PayPal capture net - sum(refund net debited)
 *   net after shipping = net received - label cost (when a label is recorded)
 */
import { centsToValue } from "./validate.js";

const PAID_STATUSES = new Set(["paid", "shipped", "ready_for_pickup", "picked_up", "partially_refunded", "refunded"]);
const TZ = "America/New_York";

export function localDate(iso) {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function ledgerRow(order) {
  const refunds = (order.refunds || []).filter((r) => r.status === "COMPLETED");
  const refundCents = refunds.reduce((s, r) => s + r.amount_cents, 0);
  const feeReturnedCents = refunds.reduce((s, r) => s + (r.fee_returned_cents || 0), 0);
  const refundNetCents = refunds.reduce((s, r) => s + r.net_cents, 0);
  const feeCents = order.paypal_fee_cents ?? null;
  const netCents = order.paypal_net_cents != null ? order.paypal_net_cents - refundNetCents : null;
  const labelCents = order.label_cost_cents ?? null;
  const items = order.items || [];
  return {
    date: localDate(order.paid_at),
    orderNumber: order.order_number,
    status: order.status,
    environment: order.environment,
    customer: order.customer_name,
    shipState: order.ship_state,
    products: items.map((i) => `${i.title} x${i.quantity}`).join("; "),
    units: items.reduce((s, i) => s + i.quantity, 0),
    itemsCents: order.items_cents,
    shippingChargedCents: order.shipping_cents,
    taxCents: order.tax_cents,
    totalCents: order.total_cents,
    paypalFeeCents: feeCents,
    refundCents,
    feeReturnedCents,
    netReceivedCents: netCents,
    labelCostCents: labelCents,
    netAfterShippingCents: netCents != null && labelCents != null ? netCents - labelCents : null,
    fulfillment: order.fulfillment === "pickup" ? "Pickup" : "Shipping",
    carrier: order.fulfillment === "pickup"
      ? ""
      : [order.label_carrier || order.shipping_carrier, order.label_service || order.shipping_service].filter(Boolean).join(" "),
    tracking: order.tracking_number || "",
    paypalCaptureId: order.paypal_capture_id || "",
    refundDates: refunds.map((r) => localDate(r.created_at)).join("; "),
  };
}

const SUM_KEYS = [
  "itemsCents", "shippingChargedCents", "taxCents", "totalCents", "paypalFeeCents",
  "refundCents", "feeReturnedCents", "netReceivedCents", "labelCostCents", "netAfterShippingCents",
];

export function buildLedger(orders) {
  const rows = orders
    .filter((o) => PAID_STATUSES.has(o.status) && o.paid_at)
    .sort((a, b) => String(a.paid_at).localeCompare(String(b.paid_at)))
    .map(ledgerRow);
  const totals = Object.fromEntries(SUM_KEYS.map((k) => [k, rows.reduce((s, r) => s + (r[k] ?? 0), 0)]));
  totals.orders = rows.length;
  totals.units = rows.reduce((s, r) => s + r.units, 0);
  totals.labelsMissing = rows.filter((r) => r.labelCostCents == null).length;
  return { rows, totals };
}

const COLUMNS = [
  ["Date (paid)", "date"],
  ["Order #", "orderNumber"],
  ["Status", "status"],
  ["Customer", "customer"],
  ["Ship-to state", "shipState"],
  ["Products", "products"],
  ["Units", "units"],
  ["Product sales", "itemsCents", true],
  ["Shipping charged", "shippingChargedCents", true],
  ["Sales tax", "taxCents", true],
  ["Total charged", "totalCents", true],
  ["PayPal fee", "paypalFeeCents", true],
  ["Refunds", "refundCents", true],
  ["PayPal fee returned", "feeReturnedCents", true],
  ["Net received", "netReceivedCents", true],
  ["Shipping label cost", "labelCostCents", true],
  ["Net after shipping", "netAfterShippingCents", true],
  ["Delivery", "fulfillment"],
  ["Carrier / service", "carrier"],
  ["Tracking", "tracking"],
  ["PayPal transaction ID", "paypalCaptureId"],
  ["Refund date(s)", "refundDates"],
  ["Environment", "environment"],
];

function csvCell(v) {
  const s = v == null ? "" : String(v);
  // Neutralize spreadsheet formula injection from customer-typed text.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** UTF-8 BOM + CRLF so Excel opens accents correctly with a double click.
 *  Money as plain decimals ("22.99"); a blank cell means "not recorded". */
export function ledgerCsv({ rows, totals }) {
  const lines = [COLUMNS.map(([h]) => csvCell(h)).join(",")];
  for (const r of rows) {
    lines.push(COLUMNS.map(([, k, money]) => csvCell(money ? (r[k] == null ? "" : centsToValue(r[k])) : r[k])).join(","));
  }
  lines.push(
    COLUMNS.map(([, k, money], i) => {
      if (i === 0) return "TOTAL";
      if (k === "orderNumber") return `${totals.orders} orders`;
      if (k === "units") return totals.units;
      // No label recorded anywhere: leave the label totals blank, not 0.00.
      if ((k === "labelCostCents" || k === "netAfterShippingCents") && totals.labelsMissing === totals.orders) return "";
      return money ? centsToValue(totals[k]) : "";
    }).map(csvCell).join(",")
  );
  return "﻿" + lines.join("\r\n") + "\r\n";
}
