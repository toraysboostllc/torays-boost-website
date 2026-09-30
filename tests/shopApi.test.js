import { describe, it, expect, beforeEach } from "vitest";
import { createDevShop, DEV_ADMIN } from "../scripts/dev/shopDev.js";

/** Minimal Vercel-style req/res around the REAL handler. */
function call(handler, op, { method, body, query = {}, cookie, admin } = {}) {
  return new Promise((resolve) => {
    const headers = {};
    const res = {
      headers,
      statusCode: 200,
      setHeader: (k, v) => (headers[k.toLowerCase()] = v),
      status(c) {
        this.statusCode = c;
        return this;
      },
      json(obj) {
        resolve({ status: this.statusCode, body: obj, headers });
      },
      send(text) {
        resolve({ status: this.statusCode, text, headers });
      },
    };
    const req = {
      method: method || (body ? "POST" : "GET"),
      query: { op, ...query },
      body: body || {},
      headers: { ...(cookie ? { cookie } : {}), ...(admin || body ? { "x-shop-client": "1" } : {}) },
    };
    handler(req, res);
  });
}

const CUSTOMER = { name: "Juan Pérez", email: "juan@example.com", phone: "(305) 555-0100" };
const ADDRESS = { line1: "1200 Brickell Ave", line2: "Apt 5", city: "Miami", state: "FL", zip: "33131" };

describe("store API (real handler, PGlite + fake PayPal + test shipping)", () => {
  let shop;
  let h;
  let product;

  beforeEach(async () => {
    shop = await createDevShop();
    h = shop.handler;
    const { body } = await call(h, "products");
    product = body.products.find((p) => p.stock >= 2);
  });

  async function login() {
    const r = await call(h, "admin-login", { body: DEV_ADMIN, admin: true });
    expect(r.status).toBe(200);
    return r.headers["set-cookie"].split(";")[0];
  }

  async function checkout(qty = 1, optionIndex = 0) {
    const items = [{ productId: product.id, quantity: qty }];
    const { body: cfg } = await call(h, "config");
    const option = cfg.shippingOptions[optionIndex];
    const created = await call(h, "create-order", {
      body: { items, customer: CUSTOMER, address: ADDRESS, fulfillment: "shipping", shippingOptionId: option.id },
    });
    expect(created.status).toBe(200);
    return { option, created: created.body };
  }

  it("lists only published products, with public photo URLs and no package data", async () => {
    const { body } = await call(h, "products");
    expect(body.products.length).toBe(5);
    expect(body.products.some((p) => p.title.includes("draft"))).toBe(false);
    expect(body.products[0]).not.toHaveProperty("weight_oz");
    expect(body.products.find((p) => p.images.length).images[0]).toMatch(/^\/__shop_dev\/img\/uploads\//);
  });

  it("checkout offers only the owner's USPS / UPS options (cheapest first) — no FedEx, no live rates", async () => {
    const { body } = await call(h, "config");
    expect(body.shipping).toBe(true);
    expect(body.shippingOptions.map((o) => `${o.carrier} ${o.service} ${o.priceCents}`)).toEqual([
      "USPS Ground Advantage 650",
      "USPS Priority Mail 995",
      "UPS Ground 1150",
    ]);
    expect(body).not.toHaveProperty("shippingProvider");
  });

  it("rejects a bad address with the failing field", async () => {
    const { body: cfg } = await call(h, "config");
    const r = await call(h, "create-order", {
      body: { items: [{ productId: product.id, quantity: 1 }], customer: CUSTOMER, address: { ...ADDRESS, zip: "ABC" }, shippingOptionId: cfg.shippingOptions[0].id },
    });
    expect(r.status).toBe(400);
    expect(r.body.field).toBe("zip");
  });

  it("order total = DB price x qty + the owner's price for the chosen option; the choice is saved; tax stays 0", async () => {
    const { option, created } = await checkout(2, 2);
    expect(created.totalCents).toBe(product.priceCents * 2 + option.priceCents);
    const o = await shop.store.getOrderByNumber(created.orderNumber);
    expect(o).toMatchObject({ status: "pending_payment", tax_cents: 0, shipping_carrier: "UPS", shipping_service: "Ground", shipping_cents: 1150 });
  });

  it("refuses an unknown or switched-off shipping option — the browser can't set the price", async () => {
    const items = [{ productId: product.id, quantity: 1 }];
    const bad = await call(h, "create-order", { body: { items, customer: CUSTOMER, address: ADDRESS, shippingOptionId: "nope1234", shippingCents: 1 } });
    expect(bad.body.field).toBe("shippingOptionId");
    const cookie = await login();
    const { body: s } = await call(h, "admin-settings", { cookie });
    const off = s.settings.shippingOptions.map((o, i) => ({ ...o, enabled: i !== 0 }));
    await call(h, "admin-settings-save", { body: { shippingOptions: off }, cookie });
    const r = await call(h, "create-order", { body: { items, customer: CUSTOMER, address: ADDRESS, shippingOptionId: s.settings.shippingOptions[0].id } });
    expect(r.body.field).toBe("shippingOptionId");
  });

  it("is NOT paid until PayPal confirms the capture; then paid exactly once with PayPal's fee", async () => {
    const { created } = await checkout(1);
    expect((await shop.store.getOrderByNumber(created.orderNumber)).status).toBe("pending_payment");
    const cap = await call(h, "capture-order", { body: { paypalOrderId: created.paypalOrderId } });
    expect(cap.body.status).toBe("paid");
    const again = await call(h, "capture-order", { body: { paypalOrderId: created.paypalOrderId } });
    expect(again.body.status).toBe("paid");
    const o = await shop.store.getOrderByNumber(created.orderNumber);
    expect(o.paypal_fee_cents).toBe(Math.round(o.total_cents * 0.0349) + 49);
    expect(o.paypal_net_cents).toBe(o.total_cents - o.paypal_fee_cents);
    expect((await shop.store.getProduct(product.id)).stock).toBe(product.stock - 1);
  });

  it("a PENDING capture puts the order in review, never paid", async () => {
    const { created } = await checkout(1);
    shop.paypal.nextCaptureStatus = "PENDING";
    const cap = await call(h, "capture-order", { body: { paypalOrderId: created.paypalOrderId } });
    expect(cap.body.status).toBe("payment_review");
    expect((await shop.store.getProduct(product.id)).stock).toBe(product.stock);
  });

  it("the buyer's status page needs the private token", async () => {
    const { created } = await checkout(1);
    expect((await call(h, "order", { query: { number: created.orderNumber, token: "nope" } })).status).toBe(404);
    const ok = await call(h, "order", { query: { number: created.orderNumber, token: created.token } });
    expect(ok.body.order).toMatchObject({ orderNumber: created.orderNumber, status: "pending_payment" });
    expect(ok.body.order).not.toHaveProperty("customer");
  });

  it("webhook COMPLETED marks paid; a redelivered event is ignored", async () => {
    const { created } = await checkout(1);
    const o = await shop.store.getOrderByNumber(created.orderNumber);
    const ev = {
      id: "WH-1",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        id: "CAPWH", status: "COMPLETED", custom_id: o.id,
        amount: { currency_code: "USD", value: (o.total_cents / 100).toFixed(2) },
        seller_receivable_breakdown: {
          gross_amount: { currency_code: "USD", value: (o.total_cents / 100).toFixed(2) },
          paypal_fee: { currency_code: "USD", value: "1.00" },
          net_amount: { currency_code: "USD", value: ((o.total_cents - 100) / 100).toFixed(2) },
        },
      },
    };
    expect((await call(h, "paypal-webhook", { body: ev })).body).toEqual({ ok: true });
    expect((await call(h, "paypal-webhook", { body: ev })).body).toEqual({ ok: true, duplicate: true });
    const after = await shop.store.getOrder(o.id);
    expect(after).toMatchObject({ status: "paid", paypal_fee_cents: 100 });
  });

  it("a capture for a different amount than we priced is never marked paid", async () => {
    const { created } = await checkout(1);
    const o = await shop.store.getOrderByNumber(created.orderNumber);
    const ev = {
      id: "WH-2", event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: { id: "CAPX", status: "COMPLETED", custom_id: o.id, amount: { currency_code: "USD", value: "0.01" } },
    };
    await call(h, "paypal-webhook", { body: ev });
    expect((await shop.store.getOrder(o.id)).status).toBe("payment_review");
  });

  describe("guest pickup, emails and optional accounts", () => {
    async function pickupOrder() {
      const items = [{ productId: product.id, quantity: 1 }];
      const created = await call(h, "create-order", { body: { items, customer: CUSTOMER, fulfillment: "pickup", language: "es" } });
      expect(created.status).toBe(200);
      return created.body;
    }

    it("pickup needs only name, email and phone — no address, no shipping charge", async () => {
      const created = await pickupOrder();
      expect(created.totalCents).toBe(product.priceCents);
      const o = await shop.store.getOrderByNumber(created.orderNumber);
      expect(o).toMatchObject({ fulfillment: "pickup", ship_line1: null, shipping_cents: 0, language: "es" });
      const noPhone = await call(h, "create-order", {
        body: { items: [{ productId: product.id, quantity: 1 }], customer: { ...CUSTOMER, phone: "" }, fulfillment: "pickup" },
      });
      expect(noPhone.body.field).toBe("phone");
    });

    it("emails the confirmation (with the private order link) only after PayPal confirms, once", async () => {
      const created = await pickupOrder();
      expect(shop.mailer.sent.length).toBe(0);
      await call(h, "capture-order", { body: { paypalOrderId: created.paypalOrderId } });
      await call(h, "capture-order", { body: { paypalOrderId: created.paypalOrderId } });
      expect(shop.mailer.sent.length).toBe(1);
      const mail = shop.mailer.sent[0];
      expect(mail.to).toBe(CUSTOMER.email);
      expect(mail.subject).toContain(created.orderNumber);
      expect(mail.subject).toContain("Pedido"); // customer checked out in Spanish
      expect(mail.text).toContain(`/tienda/pedido/${created.orderNumber}?t=${created.token}`);
    });

    it("\"ready for pickup\" notifies the customer; then picked up", async () => {
      const cookie = await login();
      const created = await pickupOrder();
      await call(h, "capture-order", { body: { paypalOrderId: created.paypalOrderId } });
      const o = await shop.store.getOrderByNumber(created.orderNumber);
      const shipped = await call(h, "admin-order-update", { body: { id: o.id, markShipped: true }, cookie });
      expect(shipped.status).toBe(409); // pickup orders are never "shipped"
      const ready = await call(h, "admin-order-update", { body: { id: o.id, markReady: true }, cookie });
      expect(ready.body.order.status).toBe("ready_for_pickup");
      const last = shop.mailer.sent.at(-1);
      expect(last.subject).toMatch(/listo para recoger/i);
      // address + hours + order number, in the customer's language
      expect(last.text).toContain("123 Dev Test St");
      expect(last.text).toContain("Lunes: 10:00 – 18:00");
      expect(last.text).toContain("Sábado: 10:00 – 14:00");
      expect(last.text).toContain(`Número de pedido: ${created.orderNumber}`);
      // the earlier confirmation showed the hours but NOT the address
      const confirmation = shop.mailer.sent.find((m) => m.subject.includes("confirmado"));
      expect(confirmation.text).toContain("Lunes: 10:00 – 18:00");
      expect(confirmation.text).not.toContain("123 Dev Test St");
      const done = await call(h, "admin-order-update", { body: { id: o.id, markPickedUp: true }, cookie });
      expect(done.body.order.status).toBe("picked_up");
      expect(done.body.order.emails.map((e) => e.kind)).toEqual(["order_confirmation", "ready_for_pickup"]);
    });

    it("the order link shows only that order and no customer contact data", async () => {
      const created = await pickupOrder();
      const r = await call(h, "order", { query: { number: created.orderNumber, token: created.token } });
      const json = JSON.stringify(r.body);
      expect(json).not.toContain(CUSTOMER.email);
      expect(json).not.toContain("5550100");
    });

    it("passwordless account: one-time link, then order history for that email only", async () => {
      const created = await pickupOrder();
      await call(h, "capture-order", { body: { paypalOrderId: created.paypalOrderId } });
      const other = await call(h, "create-order", {
        body: { items: [{ productId: product.id, quantity: 1 }], customer: { ...CUSTOMER, email: "other@example.com" }, fulfillment: "pickup" },
      });
      expect(other.status).toBe(200);

      expect((await call(h, "account-me")).status).toBe(401);
      const req1 = await call(h, "account-request-link", { body: { email: CUSTOMER.email } });
      expect(req1.body).toEqual({ ok: true });
      const link = /link=([0-9a-f]{64})/.exec(shop.mailer.sent.at(-1).text)[1];

      const v = await call(h, "account-verify", { body: { link } });
      expect(v.status).toBe(200);
      expect((await call(h, "account-verify", { body: { link } })).status).toBe(400); // one use only
      const cookie = v.headers["set-cookie"].split(";")[0];
      const me = await call(h, "account-me", { cookie });
      expect(me.body.customer).toMatchObject({ email: CUSTOMER.email, name: CUSTOMER.name });
      expect(me.body.orders.map((o) => o.orderNumber)).toEqual([created.orderNumber]);

      const upd = await call(h, "account-update", { body: { name: "Juan P.", phone: "3055550199", address: ADDRESS }, cookie });
      expect(upd.body.customer.address.zip).toBe("33131");
      expect((await call(h, "account-forget", { body: {}, cookie })).body).toEqual({ ok: true });
      expect((await call(h, "account-me", { cookie })).status).toBe(401);
    });

    it("link requests are capped per email and never reveal whether the email has orders", async () => {
      for (let i = 0; i < 5; i++) {
        const r = await call(h, "account-request-link", { body: { email: "nobody@example.com" } });
        expect(r.body).toEqual({ ok: true });
      }
      expect(shop.mailer.sent.filter((m) => m.to === "nobody@example.com").length).toBe(3);
    });
  });

  describe("pickup settings (panel)", () => {
    it("the customer sees area + hours before paying, never the street address", async () => {
      const { body } = await call(h, "config");
      expect(body.pickup.area).toBe("Kendall, Miami");
      expect(body.pickup.hours[0]).toEqual({ day: 1, open: "10:00", close: "18:00" });
      expect(JSON.stringify(body)).not.toContain("Dev Test St");
    });

    it("saves days/hours from the panel and validates them", async () => {
      const cookie = await login();
      const bad = await call(h, "admin-settings-save", {
        body: { pickup: { pickupEnabled: true, pickupAddress: "1 A St", pickupHours: [{ day: 1, open: "18:00", close: "10:00" }] } },
        cookie,
      });
      expect(bad.body.field).toBe("pickupHours");
      const noAddress = await call(h, "admin-settings-save", {
        body: { pickup: { pickupEnabled: true, pickupAddress: "", pickupHours: [{ day: 1, open: "10:00", close: "18:00" }] } },
        cookie,
      });
      expect(noAddress.body.field).toBe("pickupAddress");
      const ok = await call(h, "admin-settings-save", {
        body: { pickup: { pickupEnabled: true, pickupArea: "Kendall", pickupAddress: "9 B Ave", pickupNotes: "Ring", pickupHours: [{ day: 6, open: "09:00", close: "12:00" }, { day: 2, open: "11:00", close: "17:30" }] } },
        cookie,
      });
      expect(ok.body.settings.pickupHours).toEqual([{ day: 2, open: "11:00", close: "17:30" }, { day: 6, open: "09:00", close: "12:00" }]);
      expect((await call(h, "config")).body.pickup).toMatchObject({ area: "Kendall", notes: "Ring" });
    });

    it("with pickup switched off, checkout can't create a pickup order", async () => {
      const cookie = await login();
      await call(h, "admin-settings-save", { body: { pickup: { pickupEnabled: false } }, cookie });
      expect((await call(h, "config")).body.pickup).toBeNull();
      const r = await call(h, "create-order", { body: { items: [{ productId: product.id, quantity: 1 }], customer: CUSTOMER, fulfillment: "pickup" } });
      expect(r.body.field).toBe("fulfillment");
    });

    it("\"ready\" is refused while the address/hours are missing, so the email is never incomplete", async () => {
      const cookie = await login();
      const created = await call(h, "create-order", { body: { items: [{ productId: product.id, quantity: 1 }], customer: CUSTOMER, fulfillment: "pickup" } });
      await call(h, "capture-order", { body: { paypalOrderId: created.body.paypalOrderId } });
      await shop.store.saveSettings({ pickup_enabled: false, pickup_address: "", pickup_hours: [] });
      const o = await shop.store.getOrderByNumber(created.body.orderNumber);
      const r = await call(h, "admin-order-update", { body: { id: o.id, markReady: true }, cookie });
      expect(r.status).toBe(409);
      expect(r.body.error).toBe("pickup_not_configured");
    });
  });

  describe("admin", () => {
    it("rejects anonymous calls, wrong passwords, and POSTs without the CSRF header", async () => {
      expect((await call(h, "admin-products")).status).toBe(401);
      expect((await call(h, "admin-login", { body: { ...DEV_ADMIN, password: "x" }, admin: true })).status).toBe(401);
      const cookie = await login();
      const noHeader = await new Promise((resolve) => {
        const res = { setHeader() {}, status(c) { this.c = c; return this; }, json() { resolve(this.c); } };
        h({ method: "POST", query: { op: "admin-product-delete" }, body: { id: product.id }, headers: { cookie } }, res);
      });
      expect(noHeader).toBe(403);
    });

    it("creates, edits (max 5 photos) and deletes a product", async () => {
      const cookie = await login();
      const base = { title: "Soporte de celular", description: "Ajustable", price: "7.99", condition: "new", stock: 25, status: "published", weightOz: 5, lengthIn: 6, widthIn: 4, heightIn: 2 };
      const up = await call(h, "admin-upload-url", { body: { contentType: "image/webp" }, cookie, admin: true });
      expect(up.body.path).toMatch(/^uploads\/\d{4}\/[0-9a-f]{32}\.webp$/);
      const created = await call(h, "admin-product-save", { body: { ...base, images: [up.body.path] }, cookie, admin: true });
      expect(created.body.product).toMatchObject({ priceCents: 799, stock: 25, imagePaths: [up.body.path] });
      const six = Array.from({ length: 6 }, (_, i) => `uploads/2026/${String(i).repeat(32)}.webp`);
      const tooMany = await call(h, "admin-product-save", { body: { ...base, id: created.body.product.id, images: six }, cookie, admin: true });
      expect(tooMany.status).toBe(400);
      const edited = await call(h, "admin-product-save", { body: { ...base, id: created.body.product.id, price: "8.49", images: [] }, cookie, admin: true });
      expect(edited.body.product.priceCents).toBe(849);
      const del = await call(h, "admin-product-delete", { body: { id: created.body.product.id }, cookie, admin: true });
      expect(del.body.ok).toBe(true);
    });

    it("full cycle: pay -> label -> ship -> partial refund -> ledger + CSV", async () => {
      const cookie = await login();
      const { created } = await checkout(2);
      await call(h, "capture-order", { body: { paypalOrderId: created.paypalOrderId } });
      const o = await shop.store.getOrderByNumber(created.orderNumber);

      // Pirate Ship export lists it (paid, not shipped yet)
      const ps = await call(h, "admin-pirateship-csv", { cookie });
      expect(ps.headers["content-type"]).toMatch(/text\/csv/);
      expect(ps.text).toContain(created.orderNumber);

      // shipping needs carrier + tracking; then the tracking email goes out
      const noTracking = await call(h, "admin-order-update", { body: { id: o.id, labelCarrier: "USPS", markShipped: true }, cookie });
      expect(noTracking.body.field).toBe("trackingNumber");
      const fedex = await call(h, "admin-order-update", { body: { id: o.id, labelCarrier: "FedEx" }, cookie });
      expect(fedex.body.field).toBe("labelCarrier");
      const shipped = await call(h, "admin-order-update", {
        body: { id: o.id, labelCarrier: "USPS", labelService: "Ground Advantage", trackingNumber: "9400100000000000000000", labelCost: "5.12", markShipped: true },
        cookie,
      });
      expect(shipped.body.order).toMatchObject({ status: "shipped", labelCarrier: "USPS", trackingNumber: "9400100000000000000000" });
      expect(shipped.body.order.trackingUrl).toBe("https://tools.usps.com/go/TrackConfirmAction?tLabels=9400100000000000000000");
      const mail = shop.mailer.sent.at(-1);
      expect(mail.subject).toMatch(/shipped/i);
      expect(mail.text).toContain("9400100000000000000000");
      expect(mail.html).toContain("tools.usps.com");
      expect((await call(h, "admin-pirateship-csv", { cookie })).text).not.toContain(created.orderNumber);

      const refund = await call(h, "admin-refund", { body: { id: o.id, amount: "10.00" }, cookie, admin: true });
      expect(refund.body.order.status).toBe("partially_refunded");
      const tooMuch = await call(h, "admin-refund", { body: { id: o.id, amount: (o.total_cents / 100).toFixed(2) }, cookie, admin: true });
      expect(tooMuch.status).toBe(400);

      const sales = await call(h, "admin-sales", { cookie });
      expect(sales.body.rows.length).toBe(1);
      const row = sales.body.rows[0];
      const fee = Math.round(o.total_cents * 0.0349) + 49;
      const refundFeeBack = Math.round(1000 * 0.0349);
      expect(row).toMatchObject({
        orderNumber: created.orderNumber,
        itemsCents: o.items_cents,
        shippingChargedCents: o.shipping_cents,
        taxCents: 0,
        paypalFeeCents: fee,
        refundCents: 1000,
        feeReturnedCents: refundFeeBack,
        netReceivedCents: o.total_cents - fee - (1000 - refundFeeBack),
        labelCostCents: 512,
        netAfterShippingCents: o.total_cents - fee - (1000 - refundFeeBack) - 512,
      });

      const csv = await call(h, "admin-sales-csv", { cookie });
      expect(csv.headers["content-type"]).toMatch(/text\/csv/);
      expect(csv.text.charCodeAt(0)).toBe(0xfeff);
      const lines = csv.text.trim().split("\r\n");
      expect(lines[0]).toContain("PayPal fee");
      expect(lines[0]).toContain("Shipping label cost");
      expect(lines[1]).toContain(created.orderNumber);
      expect(lines[1]).toContain("5.12");
      expect(lines[2].startsWith("﻿") ? lines[2].slice(1) : lines[2]).toMatch(/^TOTAL,1 orders/);
    });
  });
});
