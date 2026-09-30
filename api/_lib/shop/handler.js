/**
 * The whole store API as ONE Vercel Function (api/shop.js), routed by
 * `?op=` — one function instead of ~20 keeps the project well under the
 * plan's function count, and the shared deps (store, PayPal, shipping)
 * are built once per cold start.
 *
 * Dependencies are injected (createShopHandler(deps)) so the exact same
 * code runs in production (Supabase + PayPal + Shippo/EasyPost), in the
 * local dev server (PGlite + fakes) and in the tests.
 *
 * Public ops:  config, products, product, create-order, capture-order,
 *              order, paypal-webhook
 * Customer ops (guest checkout needs none of these — an account is an
 * optional, passwordless extra; HttpOnly cookie session):
 *              account-request-link, account-verify, account-me,
 *              account-update, account-logout, account-forget
 * Admin ops (HttpOnly cookie session):
 *              admin-login, admin-logout, admin-me, admin-products,
 *              admin-product-save, admin-product-delete, admin-upload-url,
 *              admin-orders, admin-order, admin-order-update,
 *              admin-pirateship-csv, admin-refund, admin-sales,
 *              admin-sales-csv, admin-settings, admin-settings-save
 *
 * Shipping has no live carrier rates: the customer pays the price the
 * owner configured for the UPS/USPS option they chose, and the owner buys
 * the label in Pirate Ship (CSV export) and records it back here.
 *
 * Every POST except the PayPal webhook must carry `x-shop-client: 1`
 * (CSRF guard: a cross-site page can't add it without a CORS preflight,
 * which this API never approves).
 */
import crypto from "node:crypto";
import { parse as parseCookie, serialize as serializeCookie } from "cookie";
import {
  ValidationError, isUuid, normalizeAddress, normalizeCart, normalizeCustomer,
  normalizeProductInput, normalizePickupSettings, IMAGE_PATH_RE, toCents,
} from "./validate.js";
import { PaypalError, captureInfo, firstCapture, refundInfo } from "./paypal.js";
import { buildLedger, ledgerCsv, localDate } from "./ledger.js";
import { CARRIERS, normalizeShippingOptions, publicShippingOptions, adminShippingOptions, trackingUrl } from "./shippingOptions.js";
import { pirateShipCsv } from "./pirateShip.js";
import { renderEmail, renderAccountLink, orderLink } from "./mailer.js";

const SESSION_COOKIE = "shop_admin";
const CUSTOMER_COOKIE = "shop_customer";
const SESSION_HOURS = 12;
const CUSTOMER_SESSION_DAYS = 30;
const LINK_MINUTES = 30;
const LINKS_PER_HOUR = 3;
const RESERVATION_MINUTES = 20;
/** Statuses where PayPal has confirmed the money. */
export const PAID_STATUSES = ["paid", "shipped", "ready_for_pickup", "picked_up", "partially_refunded", "refunded"];

const sha256 = (v) => crypto.createHash("sha256").update(v).digest("hex");
const token = () => crypto.randomBytes(32).toString("hex");

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function queryOf(req) {
  if (req.query && typeof req.query === "object") return req.query;
  return Object.fromEntries(new URL(req.url, "http://x").searchParams);
}

function bodyOf(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body || "{}");
  } catch {
    return {};
  }
}

class HttpError extends Error {
  constructor(status, code, extra = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

/** Maps a raised SQL exception like "insufficient_stock:<uuid>". */
function sqlError(err) {
  const msg = err?.pg?.message || err?.message || "";
  const m = /(insufficient_stock|product_unavailable|invalid_quantity):([0-9a-f-]{36})/.exec(msg);
  return m ? new HttpError(409, m[1], { productId: m[2] }) : null;
}

export function publicProduct(p, store) {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    priceCents: p.price_cents,
    condition: p.condition,
    category: p.category,
    stock: p.stock,
    images: (p.images || []).map((path) => store.publicImageUrl(path)),
  };
}

function adminProduct(p, store) {
  return {
    ...publicProduct(p, store),
    status: p.status,
    imagePaths: p.images || [],
    weightOz: Number(p.weight_oz),
    lengthIn: Number(p.length_in),
    widthIn: Number(p.width_in),
    heightIn: Number(p.height_in),
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

/** What the buyer may see about their own order (status page). */
function publicOrder(o) {
  return {
    orderNumber: o.order_number,
    status: o.status,
    fulfillment: o.fulfillment,
    environment: o.environment,
    itemsCents: o.items_cents,
    shippingCents: o.shipping_cents,
    taxCents: o.tax_cents,
    totalCents: o.total_cents,
    carrier: o.shipping_carrier,
    service: o.shipping_service,
    trackingNumber: o.tracking_number || null,
    // Only once shipped: the label actually bought may differ from the choice.
    trackingUrl: o.shipped_at ? trackingUrl(o.label_carrier || o.shipping_carrier, o.tracking_number) : null,
    labelCarrier: o.label_carrier || null,
    labelService: o.label_service || null,
    shippedAt: o.shipped_at || null,
    readyAt: o.ready_at || null,
    pickedUpAt: o.picked_up_at || null,
    paidAt: o.paid_at || null,
    items: (o.items || []).map((i) => ({ title: i.title, quantity: i.quantity, unitPriceCents: i.unit_price_cents })),
  };
}

function adminOrder(o) {
  const refunds = (o.refunds || []).map((r) => ({
    id: r.paypal_refund_id, kind: r.kind, status: r.status, amountCents: r.amount_cents,
    feeReturnedCents: r.fee_returned_cents, netCents: r.net_cents, restocked: r.restocked, createdAt: r.created_at,
  }));
  const reservationExpired = o.status === "pending_payment" && new Date(o.reserved_until) < new Date();
  return {
    ...publicOrder(o),
    id: o.id,
    displayStatus: reservationExpired ? "abandoned" : o.fulfillment === "pickup" && o.status === "paid" ? "paid_pickup" : o.status,
    customer: { name: o.customer_name, email: o.customer_email, phone: o.customer_phone },
    address: { line1: o.ship_line1, line2: o.ship_line2, city: o.ship_city, state: o.ship_state, zip: o.ship_zip },
    shippingProvider: o.shipping_provider,
    shippingDays: o.shipping_days,
    paypalOrderId: o.paypal_order_id,
    paypalCaptureId: o.paypal_capture_id,
    paypalFeeCents: o.paypal_fee_cents,
    paypalNetCents: o.paypal_net_cents,
    oversold: o.oversold,
    label: {
      provider: o.label_provider, costCents: o.label_cost_cents, carrier: o.label_carrier,
      service: o.label_service, url: o.label_url,
    },
    adminNotes: o.admin_notes,
    language: o.language,
    emails: (o.emails || []).map((e) => ({ kind: e.kind, status: e.status, error: e.error, createdAt: e.created_at })),
    refunds,
    refundedCents: refunds.filter((r) => r.status === "COMPLETED").reduce((s, r) => s + r.amountCents, 0),
    createdAt: o.created_at,
  };
}

/** What the customer sees before paying: area + hours, never the street. */
function pickupPublic(s) {
  if (!s?.pickup_enabled) return null;
  return { area: s.pickup_area, hours: s.pickup_hours || [], notes: s.pickup_notes };
}

function adminSettings(s) {
  return {
    pickupEnabled: !!s?.pickup_enabled,
    pickupArea: s?.pickup_area || "",
    pickupAddress: s?.pickup_address || "",
    pickupHours: s?.pickup_hours || [],
    pickupNotes: s?.pickup_notes || "",
    shippingOptions: adminShippingOptions(s),
    updatedAt: s?.updated_at || null,
  };
}

export function createShopHandler(deps) {
  const { store, config } = deps;
  const env = config.environment; // "dev" | "sandbox" | "live"

  function requirePaypal() {
    if (!config.paypal) throw new HttpError(503, "payments_not_configured");
    return config.paypal;
  }

  async function cartLines(items) {
    const cart = normalizeCart(items);
    const products = await store.productsByIds(cart.map((c) => c.productId));
    const byId = new Map(products.map((p) => [p.id, p]));
    return cart.map(({ productId, quantity }) => {
      const product = byId.get(productId);
      if (!product || product.status !== "published") throw new HttpError(409, "product_unavailable", { productId });
      if (product.stock < quantity) throw new HttpError(409, "insufficient_stock", { productId, available: product.stock });
      return { product, quantity };
    });
  }

  /** Sends one store email and records the outcome. `force` re-sends a
   *  kind already sent (admin "resend" button); otherwise each kind goes
   *  out at most once per order. Never throws — email must not break a
   *  payment or an admin action. */
  async function sendOrderEmail(orderId, kind, { force = false } = {}) {
    try {
      const order = await store.getOrder(orderId);
      if (!order) return null;
      if (!force && (order.emails || []).some((e) => e.kind === kind && e.status === "sent")) return "skipped";
      const msg = renderEmail(kind, { order, origin: config.origin, pickup: await store.getSettings() });
      try {
        const r = await config.mailer.send({ to: order.customer_email, ...msg });
        await store.logEmail({ order_id: order.id, kind, recipient: order.customer_email, status: config.mailer.name === "outbox" ? "outbox" : "sent", provider_id: r.id });
        return "sent";
      } catch (err) {
        await store.logEmail({ order_id: order.id, kind, recipient: order.customer_email, status: "failed", error: String(err.message).slice(0, 300) });
        return "failed";
      }
    } catch (err) {
      console.error("[shop] email failed:", err?.message || err);
      return "failed";
    }
  }

  /** Applies a PayPal capture to our order — the ONLY path to "paid". */
  async function applyCapture(order, capture) {
    const info = captureInfo(capture);
    if (info.status === "COMPLETED") {
      if (info.currency !== "USD" || info.amountCents !== order.total_cents) {
        // Money arrived but not the amount we priced: never call that paid.
        await store.updateOrder(order.id, { status: "payment_review", paypal_capture_id: info.captureId, admin_notes: `${order.admin_notes || ""}\n[auto] Captured amount ${info.amountCents} ${info.currency} != order total ${order.total_cents} USD.`.trim() });
        return "payment_review";
      }
      const r = await store.markOrderPaid(order.id, {
        capture_id: info.captureId,
        gross_cents: info.grossCents,
        fee_cents: info.feeCents,
        net_cents: info.netCents,
        paid_at: info.createTime,
      });
      if (!r.already) await sendOrderEmail(order.id, "order_confirmation");
      return r.status;
    }
    if (info.status === "PENDING") {
      await store.updateOrder(order.id, { status: "payment_review", paypal_capture_id: info.captureId }, { onlyIfStatus: ["pending_payment", "payment_review"] });
      return "payment_review";
    }
    if (info.status === "DECLINED" || info.status === "FAILED") {
      await store.updateOrder(order.id, { status: "payment_failed" }, { onlyIfStatus: ["pending_payment", "payment_review"] });
      return "payment_failed";
    }
    return order.status;
  }

  // ---------------------------------------------------------------- public
  const publicOps = {
    async config() {
      return {
        environment: env,
        currency: "USD",
        paypalClientId: config.paypal?.clientId || null,
        paypalMode: config.paypal?.mode || null,
        payments: !!config.paypal,
        ...(await (async () => {
          const settings = await store.getSettings();
          const shippingOptions = publicShippingOptions(settings);
          return { shipping: shippingOptions.length > 0, shippingOptions, pickup: pickupPublic(settings) };
        })()),
        taxesEnabled: false,
      };
    },

    async products() {
      const rows = await store.listPublishedProducts();
      return { products: rows.map((p) => publicProduct(p, store)) };
    },

    async product({ query }) {
      if (!isUuid(query.id)) throw new HttpError(404, "not_found");
      const p = await store.getProduct(query.id);
      if (!p || p.status !== "published") throw new HttpError(404, "not_found");
      return { product: publicProduct(p, store) };
    },

    /** Guest checkout: name, email and phone always; the address only for
     *  "shipping" (a pickup order has no address and $0 shipping). */
    async "create-order"({ body }) {
      const paypal = requirePaypal();
      const pickup = body.fulfillment === "pickup";
      const settings = await store.getSettings();
      if (pickup && !settings?.pickup_enabled) throw new HttpError(400, "invalid", { field: "fulfillment" });
      const lines = await cartLines(body.items);
      const customer = normalizeCustomer(body.customer);
      let delivery = {
        fulfillment: "pickup", shipping_cents: 0,
        ship_line1: "", ship_line2: "", ship_city: "", ship_state: "", ship_zip: "",
        shipping_provider: "", shipping_carrier: "", shipping_service: "", shipping_days: "",
      };
      if (!pickup) {
        const address = normalizeAddress(body.address);
        // Price comes from the owner's settings, never from the browser.
        const option = publicShippingOptions(settings).find((o) => o.id === body.shippingOptionId);
        if (!option) throw new HttpError(400, "invalid", { field: "shippingOptionId" });
        delivery = {
          fulfillment: "shipping",
          shipping_cents: option.priceCents,
          ship_line1: address.line1,
          ship_line2: address.line2,
          ship_city: address.city,
          ship_state: address.state,
          ship_zip: address.zip,
          shipping_provider: "manual",
          shipping_carrier: option.carrier,
          shipping_service: option.service,
          shipping_days: option.daysMax ?? "",
        };
      }

      let created;
      try {
        created = await store.createOrder({
          items: lines.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
          public_token: token(),
          environment: env,
          language: body.language === "es" ? "es" : "en",
          customer_name: customer.name,
          customer_email: customer.email,
          customer_phone: customer.phone,
          ...delivery,
        });
      } catch (err) {
        throw sqlError(err) || err;
      }
      const order = await store.getOrder(created.id);
      try {
        const pp = await paypal.createOrder(order, order.items);
        await store.updateOrder(order.id, {
          paypal_order_id: pp.id,
          reserved_until: new Date(Date.now() + RESERVATION_MINUTES * 60_000).toISOString(),
        });
        return { paypalOrderId: pp.id, orderNumber: order.order_number, token: order.public_token, totalCents: order.total_cents };
      } catch (err) {
        await store.updateOrder(order.id, { status: "cancelled" }, { onlyIfStatus: ["pending_payment"] });
        throw err instanceof PaypalError ? new HttpError(502, "paypal_unavailable") : err;
      }
    },

    async "capture-order"({ body }) {
      const paypal = requirePaypal();
      const pid = String(body.paypalOrderId || "");
      if (!/^[A-Z0-9-]{5,64}$/i.test(pid)) throw new HttpError(400, "invalid", { field: "paypalOrderId" });
      const order = await store.getOrderByPaypalId(pid);
      if (!order) throw new HttpError(404, "not_found");
      if (PAID_STATUSES.includes(order.status)) return { status: order.status, orderNumber: order.order_number, token: order.public_token };

      let ppOrder;
      try {
        ppOrder = await paypal.captureOrder(pid);
      } catch (err) {
        if (err instanceof PaypalError && err.issue === "INSTRUMENT_DECLINED") throw new HttpError(402, "instrument_declined");
        if (err instanceof PaypalError && err.issue === "ORDER_ALREADY_CAPTURED") ppOrder = await paypal.getOrder(pid);
        else throw err instanceof PaypalError ? new HttpError(502, "paypal_unavailable") : err;
      }
      const capture = firstCapture(ppOrder);
      if (!capture) throw new HttpError(502, "paypal_no_capture");
      const status = await applyCapture(order, capture);
      return { status, orderNumber: order.order_number, token: order.public_token };
    },

    async order({ query }) {
      const o = await store.getOrderByNumber(String(query.number || ""));
      if (!o || !query.token || !safeEqual(o.public_token, query.token)) throw new HttpError(404, "not_found");
      return { order: publicOrder(o) };
    },

    async "paypal-webhook"({ req, body }) {
      const paypal = requirePaypal();
      if (!body?.id || !body?.event_type) throw new HttpError(400, "invalid");
      const verified = await paypal.verifyWebhook(req.headers || {}, body);
      if (!verified) throw new HttpError(400, "signature_invalid");
      const isNew = await store.insertEvent({ id: body.id, event_type: body.event_type, resource_id: body.resource?.id || null, payload: body });
      if (!isNew) return { ok: true, duplicate: true };
      try {
        await handleWebhookEvent(body);
        await store.finishEvent(body.id);
      } catch (err) {
        await store.finishEvent(body.id, String(err.message || err).slice(0, 500));
        throw err;
      }
      return { ok: true };
    },
  };

  async function orderForCapture(capture) {
    const info = captureInfo(capture);
    if (isUuid(info.customId)) {
      const o = await store.getOrder(info.customId);
      if (o) return o;
    }
    const related = capture?.supplementary_data?.related_ids?.order_id;
    if (related) return store.getOrderByPaypalId(related);
    return info.captureId ? store.getOrderByCaptureId(info.captureId) : null;
  }

  async function handleWebhookEvent(ev) {
    const type = ev.event_type;
    if (type.startsWith("PAYMENT.CAPTURE.") && !["PAYMENT.CAPTURE.REFUNDED", "PAYMENT.CAPTURE.REVERSED"].includes(type)) {
      const order = await orderForCapture(ev.resource);
      if (order) await applyCapture(order, ev.resource);
      return;
    }
    if (type === "PAYMENT.CAPTURE.REFUNDED" || type === "PAYMENT.CAPTURE.REVERSED") {
      const info = refundInfo(ev.resource);
      const order = info.captureId ? await store.getOrderByCaptureId(info.captureId) : null;
      if (!order || !info.refundId || info.amountCents == null) return;
      await store.recordRefund(order.id, {
        paypal_refund_id: info.refundId,
        kind: type.endsWith("REVERSED") ? "reversal" : "refund",
        status: info.status || "COMPLETED",
        amount_cents: info.amountCents,
        fee_returned_cents: info.feeReturnedCents,
        net_cents: info.netCents,
        source: "webhook",
      });
    }
  }

  function cookie(name, value, maxAge) {
    return serializeCookie(name, value, {
      httpOnly: true,
      secure: config.secureCookies !== false,
      sameSite: "strict",
      path: "/api/shop",
      maxAge,
    });
  }
  const sessionCookie = (value, maxAge) => cookie(SESSION_COOKIE, value, maxAge);

  // -------------------------------------------------------------- customer
  // Optional, passwordless accounts. Ownership of an email is proven by a
  // one-time link sent to it; the account holds saved checkout details and
  // lists that email's orders. Guests never need any of this.

  async function customerSession(req) {
    const raw = parseCookie(req.headers?.cookie || "")[CUSTOMER_COOKIE];
    if (!raw) throw new HttpError(401, "unauthorized");
    const s = await store.getCustomerSession(sha256(raw));
    if (!s) throw new HttpError(401, "unauthorized");
    return s;
  }

  const customerView = (c) => ({
    email: c.email,
    name: c.name,
    phone: c.phone,
    address: { line1: c.line1, line2: c.line2, city: c.city, state: c.state, zip: c.zip },
  });

  const customerOps = {
    /** Always answers { ok: true } — never reveals whether an email has
     *  orders. At most LINKS_PER_HOUR links per email per hour (so the form
     *  can't be used to flood someone's inbox). */
    async "account-request-link"({ body }) {
      const email = String(body.email || "").trim().toLowerCase();
      if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(email)) throw new ValidationError("email", "invalid");
      const recent = await store.countCustomerLinksSince(email, new Date(Date.now() - 3600_000).toISOString());
      if (recent < LINKS_PER_HOUR) {
        const raw = token();
        await store.insertCustomerLink({
          token_hash: sha256(raw),
          email,
          expires_at: new Date(Date.now() + LINK_MINUTES * 60_000).toISOString(),
        });
        const msg = renderAccountLink(body.language, `${config.origin}/tienda/cuenta?link=${raw}`);
        try {
          await config.mailer.send({ to: email, ...msg });
        } catch (err) {
          console.error("[shop] account link email failed:", err?.message || err);
        }
      }
      return { ok: true };
    },

    async "account-verify"({ body, res }) {
      const raw = String(body.link || "");
      if (!/^[0-9a-f]{64}$/.test(raw)) throw new HttpError(400, "link_invalid");
      const link = await store.consumeCustomerLink(sha256(raw));
      if (!link) throw new HttpError(400, "link_invalid");
      // First sign-in creates the account from the latest order's details.
      if (!(await store.getCustomer(link.email))) {
        const last = (await store.ordersByEmail(link.email, env))[0];
        await store.upsertCustomer({
          email: link.email,
          name: last?.customer_name || "",
          phone: last?.customer_phone || "",
          line1: last?.ship_line1 || "",
          line2: last?.ship_line2 || "",
          city: last?.ship_city || "",
          state: last?.ship_state || "",
          zip: last?.ship_zip || "",
        });
      }
      const s = token();
      await store.insertCustomerSession({
        token_hash: sha256(s),
        email: link.email,
        expires_at: new Date(Date.now() + CUSTOMER_SESSION_DAYS * 86400_000).toISOString(),
      });
      res.setHeader("Set-Cookie", cookie(CUSTOMER_COOKIE, s, CUSTOMER_SESSION_DAYS * 86400));
      return { email: link.email };
    },

    async "account-me"({ req }) {
      const s = await customerSession(req);
      const c = (await store.getCustomer(s.email)) || { email: s.email, name: "", phone: "", line1: "", line2: "", city: "", state: "", zip: "" };
      const orders = await store.ordersByEmail(s.email, env);
      return {
        customer: customerView(c),
        orders: orders
          .filter((o) => o.status !== "cancelled")
          .map((o) => ({ ...publicOrder(o), link: orderLink("", o) })),
      };
    },

    async "account-update"({ req, body }) {
      const s = await customerSession(req);
      const phoneDigits = String(body.phone ?? "").replace(/\D/g, "");
      const row = {
        email: s.email,
        name: String(body.name ?? "").trim().slice(0, 80),
        phone: phoneDigits.slice(0, 15),
        line1: "", line2: "", city: "", state: "", zip: "",
      };
      const a = body.address || {};
      if (a.line1 || a.city || a.zip) Object.assign(row, normalizeAddress(a));
      delete row.country;
      return { customer: customerView(await store.upsertCustomer(row)) };
    },

    async "account-logout"({ req, res }) {
      const raw = parseCookie(req.headers?.cookie || "")[CUSTOMER_COOKIE];
      if (raw) await store.deleteCustomerSession(sha256(raw));
      res.setHeader("Set-Cookie", cookie(CUSTOMER_COOKIE, "", 0));
      return { ok: true };
    },

    /** Deletes the saved details and signs out everywhere. Orders stay:
     *  they're sales records the business must keep for its accounting. */
    async "account-forget"({ req, res }) {
      const s = await customerSession(req);
      await store.deleteCustomer(s.email);
      res.setHeader("Set-Cookie", cookie(CUSTOMER_COOKIE, "", 0));
      return { ok: true };
    },
  };

  // ----------------------------------------------------------------- admin

  async function requireAdmin(req) {
    const raw = parseCookie(req.headers?.cookie || "")[SESSION_COOKIE];
    if (!raw) throw new HttpError(401, "unauthorized");
    const session = await store.getSession(sha256(raw));
    if (!session || !config.adminEmails.includes(session.email)) throw new HttpError(401, "unauthorized");
    return session;
  }

  async function orderOr404(id) {
    if (!isUuid(id)) throw new HttpError(404, "not_found");
    const o = await store.getOrder(id);
    if (!o) throw new HttpError(404, "not_found");
    return o;
  }

  const adminOps = {
    async "admin-login"({ body, res }) {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      // Same answer for "not the owner" and "wrong password".
      const verified = config.adminEmails.includes(email) && password ? await config.authenticate(email, password) : null;
      if (!verified || verified !== email) throw new HttpError(401, "invalid_credentials");
      const raw = token();
      await store.insertSession({
        token_hash: sha256(raw),
        email,
        expires_at: new Date(Date.now() + SESSION_HOURS * 3600_000).toISOString(),
      });
      res.setHeader("Set-Cookie", sessionCookie(raw, SESSION_HOURS * 3600));
      return { email };
    },
    async "admin-logout"({ req, res }) {
      const raw = parseCookie(req.headers?.cookie || "")[SESSION_COOKIE];
      if (raw) await store.deleteSession(sha256(raw));
      res.setHeader("Set-Cookie", sessionCookie("", 0));
      return { ok: true };
    },
    async "admin-me"({ session }) {
      return {
        email: session.email,
        environment: env,
        paypalMode: config.paypal?.mode || null,
        paymentsConfigured: !!config.paypal,
        paymentsError: config.paypalError || null,
        shippingOptions: publicShippingOptions(await store.getSettings()).length,
        webhookConfigured: !!config.webhookConfigured,
        mailer: config.mailer?.name || null,
        pickupEnabled: !!(await store.getSettings())?.pickup_enabled,
        taxesEnabled: false,
      };
    },

    async "admin-products"() {
      return { products: (await store.listAllProducts()).map((p) => adminProduct(p, store)) };
    },
    async "admin-product-save"({ body }) {
      const fields = normalizeProductInput(body);
      if (body.id) {
        if (!isUuid(body.id)) throw new HttpError(404, "not_found");
        const before = await store.getProduct(body.id);
        if (!before) throw new HttpError(404, "not_found");
        const saved = await store.updateProduct(body.id, fields);
        const dropped = (before.images || []).filter((p) => !fields.images.includes(p));
        await store.removeImages(dropped);
        return { product: adminProduct(saved, store) };
      }
      return { product: adminProduct(await store.insertProduct(fields), store) };
    },
    async "admin-product-delete"({ body }) {
      if (!isUuid(body.id)) throw new HttpError(404, "not_found");
      const p = await store.getProduct(body.id);
      if (!p) throw new HttpError(404, "not_found");
      // Order lines keep their own title/price snapshot (FK is ON DELETE SET NULL).
      await store.deleteProduct(body.id);
      await store.removeImages(p.images || []);
      return { ok: true };
    },
    async "admin-upload-url"({ body }) {
      const ext = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" }[body.contentType];
      if (!ext) throw new HttpError(400, "invalid", { field: "contentType" });
      const path = `uploads/${new Date().getUTCFullYear()}/${crypto.randomBytes(16).toString("hex")}.${ext}`;
      if (!IMAGE_PATH_RE.test(path)) throw new Error("bad_path");
      return { path, uploadUrl: await store.createSignedUpload(path), publicUrl: store.publicImageUrl(path) };
    },

    async "admin-orders"({ query }) {
      const map = {
        open: ["paid", "payment_review", "ready_for_pickup"],
        shipped: ["shipped", "picked_up"],
        refunds: ["partially_refunded", "refunded"],
        unpaid: ["pending_payment", "payment_failed", "cancelled"],
      };
      const rows = await store.listOrders({ statuses: map[query.filter] || null });
      return { orders: rows.map(adminOrder) };
    },
    async "admin-order"({ query }) {
      return { order: adminOrder(await orderOr404(query.id)) };
    },
    async "admin-order-update"({ body }) {
      const o = await orderOr404(body.id);
      const patch = {};
      if (body.adminNotes !== undefined) patch.admin_notes = String(body.adminNotes).slice(0, 2000);
      if (body.trackingNumber !== undefined) patch.tracking_number = String(body.trackingNumber).trim().slice(0, 60) || null;
      if (body.labelCarrier !== undefined) {
        if (body.labelCarrier && !CARRIERS.includes(body.labelCarrier)) throw new HttpError(400, "invalid", { field: "labelCarrier" });
        patch.label_carrier = body.labelCarrier || null;
      }
      if (body.labelService !== undefined) patch.label_service = String(body.labelService).trim().slice(0, 60) || null;
      if (body.labelCost !== undefined) {
        if (body.labelCost === "" || body.labelCost === null) patch.label_cost_cents = null;
        else {
          const c = toCents(body.labelCost);
          if (c == null) throw new HttpError(400, "invalid", { field: "labelCost" });
          patch.label_cost_cents = c;
          patch.label_provider = "pirateship";
        }
      }
      let email = null;
      if (body.markShipped) {
        if (o.fulfillment !== "shipping" || !["paid", "partially_refunded"].includes(o.status)) throw new HttpError(409, "not_shippable");
        // The tracking email needs both — refuse rather than send a blank one.
        const carrier = patch.label_carrier !== undefined ? patch.label_carrier : o.label_carrier;
        const tracking = patch.tracking_number !== undefined ? patch.tracking_number : o.tracking_number;
        if (!carrier || !tracking) throw new HttpError(400, "invalid", { field: !carrier ? "labelCarrier" : "trackingNumber" });
        if (o.status === "paid") patch.status = "shipped";
        patch.shipped_at = new Date().toISOString();
        email = "shipped";
      }
      // Pickup: "Ready for pickup" emails the customer; "Picked up" closes it.
      if (body.markReady) {
        if (o.fulfillment !== "pickup" || !["paid", "partially_refunded"].includes(o.status)) throw new HttpError(409, "not_pickup_ready");
        // The email must carry the address and hours: refuse without them.
        const s = await store.getSettings();
        if (!s?.pickup_address || !(s.pickup_hours || []).length) throw new HttpError(409, "pickup_not_configured");
        if (o.status === "paid") patch.status = "ready_for_pickup";
        patch.ready_at = new Date().toISOString();
        email = "ready_for_pickup";
      }
      if (body.markPickedUp) {
        if (o.fulfillment !== "pickup" || !["ready_for_pickup", "partially_refunded"].includes(o.status)) throw new HttpError(409, "not_picked_up");
        if (o.status === "ready_for_pickup") patch.status = "picked_up";
        patch.picked_up_at = new Date().toISOString();
      }
      if (body.cancel) {
        if (!["pending_payment", "payment_failed"].includes(o.status)) throw new HttpError(409, "not_cancellable");
        patch.status = "cancelled";
      }
      const updated = Object.keys(patch).length ? await store.updateOrder(o.id, patch) : o;
      if (email) await sendOrderEmail(o.id, email);
      const resendable = { order_confirmation: PAID_STATUSES, ready_for_pickup: ["ready_for_pickup"], shipped: ["shipped"] };
      if (body.resendEmail && resendable[body.resendEmail]?.includes(o.status)) {
        await sendOrderEmail(o.id, body.resendEmail, { force: true });
      }
      return { order: adminOrder(await store.getOrder(updated.id)) };
    },
    /** Orders waiting for a label, as a CSV Pirate Ship imports ("Upload a
     *  spreadsheet"). Optional ?carrier=&service= narrows it to one service,
     *  because Pirate Ship applies one package type/service per upload. */
    async "admin-pirateship-csv"({ query, res }) {
      const rows = (await store.listOrders({ statuses: ["paid", "partially_refunded"] })).filter(
        (o) =>
          o.fulfillment === "shipping" &&
          !o.shipped_at &&
          (!query.carrier || o.shipping_carrier === query.carrier) &&
          (!query.service || o.shipping_service === query.service)
      );
      const ids = [...new Set(rows.flatMap((o) => o.items.map((i) => i.product_id).filter(Boolean)))];
      const products = new Map((await store.productsByIds(ids)).map((p) => [p.id, p]));
      const tag = [query.carrier, query.service].filter(Boolean).join("-").replace(/[^\w-]+/g, "_") || "todos";
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="pirate-ship-${tag}-${localDate(new Date().toISOString())}.csv"`);
      return { __raw: pirateShipCsv(rows, products) };
    },

    async "admin-refund"({ body }) {
      const paypal = requirePaypal();
      const o = await orderOr404(body.id);
      if (!o.paypal_capture_id || !PAID_STATUSES.filter((x) => x !== "refunded").includes(o.status)) throw new HttpError(409, "not_refundable");
      const already = (o.refunds || []).filter((r) => r.status === "COMPLETED").reduce((s, r) => s + r.amount_cents, 0);
      const amount = toCents(body.amount);
      if (amount == null || amount < 1 || amount > o.total_cents - already) throw new HttpError(400, "invalid", { field: "amount" });
      let refund;
      try {
        refund = await paypal.refundCapture(o.paypal_capture_id, amount, `refund-${o.id}-${already}-${amount}`);
      } catch (err) {
        throw err instanceof PaypalError ? new HttpError(502, "paypal_refund_failed", { issue: err.issue }) : err;
      }
      const info = refundInfo(refund);
      await store.recordRefund(o.id, {
        paypal_refund_id: info.refundId,
        kind: "refund",
        status: info.status,
        amount_cents: info.amountCents ?? amount,
        fee_returned_cents: info.feeReturnedCents,
        net_cents: info.netCents ?? amount,
        restock: !!body.restock && amount + already >= o.total_cents,
        source: "admin",
      });
      return { order: adminOrder(await store.getOrder(o.id)) };
    },

    async "admin-settings"() {
      return { settings: adminSettings(await store.getSettings()) };
    },
    /** Partial save: { pickup: {...} } and/or { shippingOptions: [...] }. */
    async "admin-settings-save"({ body }) {
      const patch = {};
      if (body.pickup) Object.assign(patch, normalizePickupSettings(body.pickup));
      if (body.shippingOptions) patch.shipping_options = normalizeShippingOptions(body.shippingOptions);
      if (!Object.keys(patch).length) throw new HttpError(400, "invalid", { field: "settings" });
      return { settings: adminSettings(await store.saveSettings(patch)) };
    },

    async "admin-sales"({ query }) {
      const { rows, totals } = await ledgerFor(query);
      return { rows, totals, environment: query.environment || env };
    },
    async "admin-sales-csv"({ query, res }) {
      const ledger = await ledgerFor(query);
      const name = `torays-boost-ventas-${query.from || "inicio"}_${query.to || "hoy"}.csv`.replace(/[^\w.-]/g, "_");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
      return { __raw: ledgerCsv(ledger) };
    },
  };

  async function ledgerFor(query) {
    const day = /^\d{4}-\d{2}-\d{2}$/;
    const year = new Date().getFullYear();
    const from = day.test(query.from || "") ? query.from : `${year}-01-01`;
    const to = day.test(query.to || "") ? query.to : `${year}-12-31`;
    // Dates are Miami local days; widen by a day on each side, then trim
    // on the local date so nothing near midnight UTC is lost.
    const fromIso = new Date(Date.parse(`${from}T00:00:00Z`) - 86400_000).toISOString();
    const toIso = new Date(Date.parse(`${to}T00:00:00Z`) + 2 * 86400_000).toISOString();
    const environment = ["dev", "sandbox", "live"].includes(query.environment) ? query.environment : env;
    const orders = await store.ordersPaidBetween(fromIso, toIso, environment);
    return buildLedger(orders.filter((o) => {
      const d = localDate(o.paid_at);
      return d >= from && d <= to;
    }));
  }

  const GET_OPS = new Set(["config", "products", "product", "order", "account-me", "admin-me", "admin-settings", "admin-products", "admin-orders", "admin-order", "admin-sales", "admin-sales-csv", "admin-pirateship-csv"]);

  return async function handler(req, res) {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Robots-Tag", "noindex");
    const query = queryOf(req);
    const op = String(query.op || "");
    const isAdmin = op.startsWith("admin-");
    const fn = isAdmin ? adminOps[op] : op.startsWith("account-") ? customerOps[op] : publicOps[op];
    try {
      if (!fn) throw new HttpError(404, "unknown_op");
      const method = GET_OPS.has(op) ? "GET" : "POST";
      if (req.method !== method) throw new HttpError(405, "method_not_allowed");
      let session = null;
      if (isAdmin && op !== "admin-login") {
        session = await requireAdmin(req);
      }
      // CSRF: a cross-site page can't add a custom header without a CORS
      // preflight (which this API never approves); SameSite=Strict on the
      // cookies is the second layer. PayPal's webhook is verified by
      // signature instead.
      if (method === "POST" && op !== "paypal-webhook" && req.headers?.["x-shop-client"] !== "1") throw new HttpError(403, "csrf");
      const out = await fn({ req, res, query, body: method === "POST" ? bodyOf(req) : {}, session });
      if (out && typeof out.__raw === "string") {
        res.status(200).send(out.__raw);
        return;
      }
      res.status(200).json(out);
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).json({ error: "invalid", field: err.field, reason: err.message });
        return;
      }
      if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.code, ...err.extra });
        return;
      }
      console.error(`[shop] ${op} failed:`, err?.message || err, err?.body || err?.pg || "");
      res.status(500).json({ error: "server_error" });
    }
  };
}
