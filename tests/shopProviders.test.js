import { describe, it, expect } from "vitest";
import { resolvePaypalEnv, buildOrderBody, captureInfo, refundInfo, createPaypalClient } from "../api/_lib/shop/paypal.js";
import { normalizeShippingOptions, publicShippingOptions, trackingUrl } from "../api/_lib/shop/shippingOptions.js";
import { pirateShipCsv } from "../api/_lib/shop/pirateShip.js";
import { toCents, centsToValue, normalizeCart, normalizeProductInput } from "../api/_lib/shop/validate.js";
import { buildLedger, ledgerCsv, localDate } from "../api/_lib/shop/ledger.js";
import { renderEmail } from "../api/_lib/shop/mailer.js";


function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, init = {}) => {
    let sent = null;
    try {
      sent = init.body ? JSON.parse(init.body) : null;
    } catch {
      sent = init.body; // form-encoded (PayPal token request)
    }
    calls.push({ url, init, body: sent });
    const hit = routes.find(([m]) => url.includes(m));
    if (!hit) throw new Error(`unexpected ${url}`);
    const [, status, reply] = hit;
    return { ok: status < 400, status, json: async () => reply, text: async () => JSON.stringify(reply) };
  };
  fn.calls = calls;
  return fn;
}

describe("money helpers", () => {
  it("parses prices as strings, never float math", () => {
    expect(toCents("22.99")).toBe(2299);
    expect(toCents("22.9")).toBe(2290);
    expect(toCents("$7")).toBe(700);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents("1.999")).toBeNull();
    expect(toCents("-5")).toBeNull();
    expect(centsToValue(2299)).toBe("22.99");
    expect(centsToValue(5)).toBe("0.05");
  });

  it("merges duplicate cart lines and caps quantity at 99", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(normalizeCart([{ productId: id, quantity: 2 }, { productId: id, quantity: 3 }])).toEqual([{ productId: id, quantity: 5 }]);
    expect(() => normalizeCart([{ productId: id, quantity: 60 }, { productId: id, quantity: 60 }])).toThrow();
  });

  it("product photos: at most 5, only server-issued upload paths", () => {
    const base = { title: "x", price: "1", condition: "new", stock: 1, weightOz: 1, lengthIn: 1, widthIn: 1, heightIn: 1 };
    expect(() => normalizeProductInput({ ...base, images: ["https://evil.example/x.png"] })).toThrow();
    expect(() => normalizeProductInput({ ...base, images: ["uploads/2026/../../x.webp"] })).toThrow();
    expect(normalizeProductInput({ ...base, images: [`uploads/2026/${"a".repeat(32)}.webp`] }).images.length).toBe(1);
  });
});

describe("PayPal", () => {
  it("is sandbox unless live is explicitly approved", () => {
    expect(resolvePaypalEnv({})).toBe("sandbox");
    expect(resolvePaypalEnv({ PAYPAL_ENV: "sandbox" })).toBe("sandbox");
    expect(() => resolvePaypalEnv({ PAYPAL_ENV: "live" })).toThrow("live_not_approved");
    expect(() => resolvePaypalEnv({ PAYPAL_ENV: "live", SHOP_LIVE_PAYMENTS_APPROVED: "true" })).toThrow("live_not_approved");
    expect(resolvePaypalEnv({ PAYPAL_ENV: "live", SHOP_LIVE_PAYMENTS_APPROVED: "yes" })).toBe("live");
  });

  const order = {
    id: "o1", order_number: "TB-2026-0001", total_cents: 2944, items_cents: 2299, shipping_cents: 645, tax_cents: 0,
    customer_name: "Juan", ship_line1: "1200 Brickell Ave", ship_line2: "", ship_city: "Miami", ship_state: "FL", ship_zip: "33131",
    fulfillment: "shipping",
  };
  const items = [{ title: "HDMI", quantity: 1, unit_price_cents: 2299 }];

  it("order body: amounts add up, address locked for shipping, none for pickup", () => {
    const b = buildOrderBody(order, items);
    const pu = b.purchase_units[0];
    expect(pu.amount).toMatchObject({ currency_code: "USD", value: "29.44" });
    expect(pu.amount.breakdown.item_total.value).toBe("22.99");
    expect(pu.amount.breakdown.shipping.value).toBe("6.45");
    expect(pu.custom_id).toBe("o1");
    expect(b.payment_source.paypal.experience_context.shipping_preference).toBe("SET_PROVIDED_ADDRESS");
    expect(pu.shipping.address.postal_code).toBe("33131");
    const pickup = buildOrderBody({ ...order, fulfillment: "pickup", shipping_cents: 0, total_cents: 2299 }, items);
    expect(pickup.purchase_units[0].shipping).toBeUndefined();
    expect(pickup.payment_source.paypal.experience_context.shipping_preference).toBe("NO_SHIPPING");
  });

  it("reads fee and net straight from PayPal's breakdown", () => {
    const cap = {
      id: "CAP", status: "COMPLETED", amount: { currency_code: "USD", value: "29.44" }, custom_id: "o1",
      seller_receivable_breakdown: {
        gross_amount: { currency_code: "USD", value: "29.44" },
        paypal_fee: { currency_code: "USD", value: "1.52" },
        net_amount: { currency_code: "USD", value: "27.92" },
      },
    };
    expect(captureInfo(cap)).toMatchObject({ amountCents: 2944, feeCents: 152, netCents: 2792, customId: "o1" });
    const ref = {
      id: "R1", status: "COMPLETED", amount: { currency_code: "USD", value: "10.00" },
      seller_payable_breakdown: { paypal_fee: { currency_code: "USD", value: "0.35" }, net_amount: { currency_code: "USD", value: "9.65" } },
      links: [{ rel: "up", href: "https://api-m.paypal.com/v2/payments/captures/CAP123" }],
    };
    expect(refundInfo(ref)).toMatchObject({ refundId: "R1", amountCents: 1000, feeReturnedCents: 35, netCents: 965, captureId: "CAP123" });
  });

  it("talks to the sandbox host with idempotency keys", async () => {
    const f = fakeFetch([
      ["/v1/oauth2/token", 200, { access_token: "T", expires_in: 3600 }],
      ["/v2/checkout/orders", 201, { id: "PP1" }],
    ]);
    const pp = createPaypalClient({ mode: "sandbox", clientId: "id", clientSecret: "s", fetchImpl: f });
    await pp.createOrder(order, items);
    expect(f.calls.every((c) => c.url.startsWith("https://api-m.sandbox.paypal.com"))).toBe(true);
    expect(f.calls[1].init.headers["PayPal-Request-Id"]).toBe("create-o1");
    expect(f.calls[1].body.purchase_units[0].invoice_id).toMatch(/^TB-2026-0001-[0-9a-f]{6}$/);
  });

  it("webhooks are never trusted without a configured webhook id", async () => {
    const pp = createPaypalClient({ mode: "sandbox", clientId: "id", clientSecret: "s", fetchImpl: fakeFetch([]) });
    expect(await pp.verifyWebhook({}, { id: "x" })).toBe(false);
  });
});

describe("shipping options set by the owner (Pirate Ship labels)", () => {
  it("only USPS and UPS, with a price, sane days, stable ids", () => {
    const rows = normalizeShippingOptions([
      { carrier: "USPS", service: "Ground Advantage", price: "6.50", daysMin: "2", daysMax: "5" },
      { carrier: "UPS", service: "Ground", price: "11.5", daysMin: "", daysMax: "", enabled: false, id: "keepthisid1" },
    ]);
    expect(rows[0]).toMatchObject({ carrier: "USPS", price_cents: 650, days_min: 2, days_max: 5, enabled: true });
    expect(rows[1]).toMatchObject({ id: "keepthisid1", price_cents: 1150, days_min: null, enabled: false });
    for (const bad of [
      [{ carrier: "FedEx", service: "Ground", price: "9" }],
      [{ carrier: "USPS", service: "", price: "9" }],
      [{ carrier: "USPS", service: "Priority", price: "abc" }],
      [{ carrier: "USPS", service: "Priority", price: "9", daysMin: 5, daysMax: 2 }],
    ]) expect(() => normalizeShippingOptions(bad)).toThrow();
    expect(() => normalizeShippingOptions(Array.from({ length: 11 }, () => ({ carrier: "USPS", service: "X1", price: "1" })))).toThrow();
  });

  it("checkout sees enabled options only, cheapest first", () => {
    const pub = publicShippingOptions({
      shipping_options: [
        { id: "a", carrier: "UPS", service: "Ground", price_cents: 1150, enabled: true },
        { id: "b", carrier: "USPS", service: "Priority", price_cents: 995, enabled: false },
        { id: "c", carrier: "USPS", service: "GA", price_cents: 650, enabled: true },
      ],
    });
    expect(pub.map((o) => o.id)).toEqual(["c", "a"]);
  });

  it("official tracking pages", () => {
    expect(trackingUrl("UPS", "1Z999AA10123456784")).toBe("https://www.ups.com/track?tracknum=1Z999AA10123456784");
    expect(trackingUrl("USPS", "9400 1")).toBe("https://tools.usps.com/go/TrackConfirmAction?tLabels=9400%201");
    expect(trackingUrl("USPS", "")).toBeNull();
  });

  it("Pirate Ship CSV: header row, one column per address part, numeric weight/size only", () => {
    const products = new Map([
      ["p1", { weight_oz: 9, length_in: 8, width_in: 6, height_in: 5 }],
      ["p2", { weight_oz: 4, length_in: 3, width_in: 2, height_in: 1 }],
    ]);
    const order = {
      order_number: "TB-2026-0009", customer_name: "Juan \"JP\" Pérez", ship_line1: "1200 Brickell Ave", ship_line2: "Apt 5",
      ship_city: "Miami", ship_state: "FL", ship_zip: "33131", customer_email: "j@x.com", customer_phone: "3055550100",
      shipping_carrier: "USPS", shipping_service: "Ground Advantage", shipping_cents: 650,
      items: [{ product_id: "p1", title: "HDMI", quantity: 1 }, { product_id: "p2", title: "Cable", quantity: 2 }],
    };
    const lines = pirateShipCsv([order, { ...order, order_number: "TB-2026-0010", items: [{ product_id: null, title: "Gone", quantity: 1 }] }], products)
      .replace(/^\uFEFF/, "").trim().split("\r\n");
    expect(lines[0]).toBe("Order ID,Name,Company,Address Line 1,Address Line 2,City,State,Zip,Country,Email,Phone,Weight (oz),Length (in),Width (in),Height (in),Customer chose,Shipping charged,Items");
    expect(lines[1]).toBe('TB-2026-0009,"Juan ""JP"" Pérez",,1200 Brickell Ave,Apt 5,Miami,FL,33131,US,j@x.com,3055550100,17,8,6,7,USPS Ground Advantage,6.50,1 x HDMI; 2 x Cable');
    // deleted product -> weight/size blank so Pirate Ship uses its default package
    expect(lines[2]).toContain(",3055550100,,,,,USPS Ground Advantage,");
  });
});

describe("sales log (accounting)", () => {
  const paid = (over) => ({
    status: "paid", order_number: "TB-1", paid_at: "2026-10-03T15:00:00Z", environment: "live", customer_name: "A", ship_state: "FL",
    items: [{ title: "HDMI", quantity: 2 }], items_cents: 4598, shipping_cents: 645, tax_cents: 0, total_cents: 5243,
    paypal_fee_cents: 232, paypal_net_cents: 5011, refunds: [], label_cost_cents: null, fulfillment: "shipping",
    shipping_carrier: "USPS", shipping_service: "Ground Advantage", ...over,
  });

  it("net = PayPal net − refunds actually debited; label cost optional", () => {
    const { rows, totals } = buildLedger([
      paid({ refunds: [{ status: "COMPLETED", amount_cents: 1000, fee_returned_cents: 35, net_cents: 965, created_at: "2026-10-05T12:00:00Z" }], label_cost_cents: 512 }),
      paid({ order_number: "TB-2", paid_at: "2026-10-04T15:00:00Z", status: "pending_payment" }), // unpaid: excluded
      paid({ order_number: "TB-3", paid_at: "2026-10-06T15:00:00Z", fulfillment: "pickup", shipping_cents: 0, total_cents: 4598, paypal_fee_cents: 209, paypal_net_cents: 4389 }),
    ]);
    expect(rows.map((r) => r.orderNumber)).toEqual(["TB-1", "TB-3"]);
    expect(rows[0]).toMatchObject({ netReceivedCents: 5011 - 965, labelCostCents: 512, netAfterShippingCents: 5011 - 965 - 512, refundDates: "2026-10-05" });
    expect(rows[1]).toMatchObject({ fulfillment: "Pickup", carrier: "", netAfterShippingCents: null });
    expect(totals).toMatchObject({ orders: 2, totalCents: 5243 + 4598, paypalFeeCents: 441, labelsMissing: 1 });
  });

  it("dates are Miami days (an 11 pm order stays on its day)", () => {
    expect(localDate("2026-12-31T04:30:00Z")).toBe("2026-12-30");
  });

  it("CSV neutralizes formula injection from customer text", () => {
    const csv = ledgerCsv(buildLedger([paid({ customer_name: "=HYPERLINK(\"http://x\")" })]));
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
  });
});

describe("emails", () => {
  const order = {
    order_number: "TB-2026-0007", public_token: "a".repeat(64), language: "es", fulfillment: "pickup",
    items: [{ title: "<b>HDMI</b>", quantity: 1, unit_price_cents: 2299 }], shipping_cents: 0, total_cents: 2299,
  };
  it("confirmation carries the private link and escapes product text", () => {
    const m = renderEmail("order_confirmation", { order, origin: "https://www.toraysboost.com" });
    expect(m.subject).toBe("Pedido TB-2026-0007 confirmado — Torays Boost");
    expect(m.html).toContain(`https://www.toraysboost.com/tienda/pedido/TB-2026-0007?t=${"a".repeat(64)}`);
    expect(m.html).toContain("&lt;b&gt;HDMI&lt;/b&gt;");
    expect(m.html).not.toContain("<b>HDMI</b>");
  });
  it("ready-for-pickup carries order number, exact address, hours and notes", () => {
    const pickup = {
      pickup_address: "9 B Ave, Miami, FL 33196",
      pickup_hours: [{ day: 6, open: "10:00", close: "14:00" }, { day: 1, open: "10:00", close: "18:00" }],
      pickup_notes: "Ring the bell",
    };
    const m = renderEmail("ready_for_pickup", { order: { ...order, language: "en" }, origin: "https://x", pickup });
    expect(m.subject).toMatch(/TB-2026-0007 is ready for pickup/i);
    expect(m.text).toContain("Order number: TB-2026-0007");
    expect(m.text).toContain("Pickup address: 9 B Ave, Miami, FL 33196");
    expect(m.text.indexOf("Monday: 10:00 – 18:00")).toBeLessThan(m.text.indexOf("Saturday: 10:00 – 14:00"));
    expect(m.html).toContain("Ring the bell");
  });
});

describe("store translations", () => {
  it("English and Spanish have exactly the same keys", async () => {
    const { shopTranslations: t } = await import("../src/i18n/shopTranslations.js");
    const keys = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
    expect(keys(t.es).sort()).toEqual(keys(t.en).sort());
  });
});
