/**
 * PayPal REST (Orders v2 + Payments v2 + webhook verification).
 *
 * SANDBOX BY DEFAULT. "live" is refused unless SHOP_LIVE_PAYMENTS_APPROVED
 * is exactly "yes" — the owner flips that himself in Vercel after
 * reviewing the store (see resolvePaypalEnv).
 *
 * The browser never tells us an amount: createOrder() is always built from
 * the order row the database priced, and an order is only "paid" when a
 * capture comes back COMPLETED for exactly that amount in USD.
 */
import crypto from "node:crypto";
import { centsToValue, toCents } from "./validate.js";

const BASE = {
  sandbox: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com",
};

export class PaypalError extends Error {
  constructor(status, body) {
    super(`paypal_${status}`);
    this.status = status;
    this.body = body;
    this.issue = body?.details?.[0]?.issue || body?.name || null;
  }
}

/** -> "sandbox" | "live", or throws "live_not_approved". */
export function resolvePaypalEnv(env = process.env) {
  const wanted = (env.PAYPAL_ENV || "sandbox").trim().toLowerCase();
  if (wanted !== "live") return "sandbox";
  if (env.SHOP_LIVE_PAYMENTS_APPROVED !== "yes") throw new Error("live_not_approved");
  return "live";
}

export function moneyToCents(m) {
  if (!m || m.currency_code !== "USD") return null;
  return toCents(m.value);
}

/** Pulls what we store out of a capture object (from a capture response
 *  or a PAYMENT.CAPTURE.* webhook resource). */
export function captureInfo(capture) {
  const b = capture?.seller_receivable_breakdown || {};
  return {
    captureId: capture?.id || null,
    status: capture?.status || null,
    amountCents: moneyToCents(capture?.amount),
    currency: capture?.amount?.currency_code || null,
    grossCents: moneyToCents(b.gross_amount) ?? moneyToCents(capture?.amount),
    feeCents: moneyToCents(b.paypal_fee),
    netCents: moneyToCents(b.net_amount),
    customId: capture?.custom_id || null,
    createTime: capture?.create_time || null,
  };
}

export function refundInfo(refund) {
  const b = refund?.seller_payable_breakdown || {};
  const amount = moneyToCents(refund?.amount) ?? moneyToCents(b.gross_amount);
  const feeReturned = moneyToCents(b.paypal_fee) ?? 0;
  const up = (refund?.links || []).find((l) => l.rel === "up")?.href || "";
  return {
    refundId: refund?.id || null,
    status: refund?.status || null,
    amountCents: amount,
    feeReturnedCents: feeReturned,
    netCents: moneyToCents(b.net_amount) ?? (amount != null ? amount - feeReturned : null),
    captureId: /\/captures\/([^/?]+)/.exec(up)?.[1] || null,
  };
}

export function buildOrderBody(order, items, { brandName = "Torays Boost", sandboxSuffix = "" } = {}) {
  return {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: order.id,
        custom_id: order.id,
        // invoice_id must be unique per PayPal account forever; a sandbox
        // test database can restart its numbering, so it gets a suffix.
        invoice_id: order.order_number + sandboxSuffix,
        description: `Torays Boost order ${order.order_number}`.slice(0, 127),
        amount: {
          currency_code: "USD",
          value: centsToValue(order.total_cents),
          breakdown: {
            item_total: { currency_code: "USD", value: centsToValue(order.items_cents) },
            shipping: { currency_code: "USD", value: centsToValue(order.shipping_cents) },
            tax_total: { currency_code: "USD", value: centsToValue(order.tax_cents) },
          },
        },
        items: items.map((i) => ({
          name: i.title.slice(0, 127),
          quantity: String(i.quantity),
          unit_amount: { currency_code: "USD", value: centsToValue(i.unit_price_cents) },
          category: "PHYSICAL_GOODS",
        })),
        ...(order.fulfillment === "pickup" ? {} : { shipping: {
          type: "SHIPPING",
          name: { full_name: order.customer_name.slice(0, 300) },
          address: {
            address_line_1: order.ship_line1,
            ...(order.ship_line2 ? { address_line_2: order.ship_line2 } : {}),
            admin_area_2: order.ship_city,
            admin_area_1: order.ship_state,
            postal_code: order.ship_zip,
            country_code: "US",
          },
        } }),
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: brandName,
          // The buyer can't change the address inside PayPal: the shipping
          // price was quoted for THIS address. Pickup orders have none.
          shipping_preference: order.fulfillment === "pickup" ? "NO_SHIPPING" : "SET_PROVIDED_ADDRESS",
          user_action: "PAY_NOW",
        },
      },
    },
  };
}

export function createPaypalClient({ mode, clientId, clientSecret, webhookId, fetchImpl = fetch }) {
  const base = BASE[mode];
  let cached = null;

  async function token() {
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value;
    const res = await fetchImpl(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new PaypalError(res.status, body);
    cached = { value: body.access_token, expiresAt: Date.now() + (body.expires_in || 300) * 1000 };
    return cached.value;
  }

  async function call(method, path, { body, requestId } = {}) {
    const res = await fetchImpl(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${await token()}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new PaypalError(res.status, json);
    return json;
  }

  return {
    mode,
    clientId,
    createOrder(order, items) {
      const suffix = mode === "sandbox" ? `-${crypto.randomBytes(3).toString("hex")}` : "";
      return call("POST", "/v2/checkout/orders", {
        body: buildOrderBody(order, items, { sandboxSuffix: suffix }),
        requestId: `create-${order.id}`,
      });
    },
    getOrder: (id) => call("GET", `/v2/checkout/orders/${encodeURIComponent(id)}`),
    captureOrder: (id) =>
      call("POST", `/v2/checkout/orders/${encodeURIComponent(id)}/capture`, { requestId: `capture-${id}` }),
    async refundCapture(captureId, amountCents, requestId) {
      const created = await call("POST", `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, {
        body: { amount: { currency_code: "USD", value: centsToValue(amountCents) } },
        requestId,
      });
      // The create response doesn't always carry seller_payable_breakdown;
      // the refund resource itself does.
      return created.seller_payable_breakdown ? created : call("GET", `/v2/payments/refunds/${encodeURIComponent(created.id)}`);
    },
    async verifyWebhook(headers, event) {
      if (!webhookId) return false;
      const h = (k) => headers[k] || headers[k.toLowerCase()];
      const result = await call("POST", "/v1/notifications/verify-webhook-signature", {
        body: {
          auth_algo: h("paypal-auth-algo"),
          cert_url: h("paypal-cert-url"),
          transmission_id: h("paypal-transmission-id"),
          transmission_sig: h("paypal-transmission-sig"),
          transmission_time: h("paypal-transmission-time"),
          webhook_id: webhookId,
          webhook_event: event,
        },
      });
      return result.verification_status === "SUCCESS";
    },
  };
}

/** First capture of the first purchase unit of an Orders v2 response. */
export function firstCapture(orderJson) {
  return orderJson?.purchase_units?.[0]?.payments?.captures?.[0] || null;
}
