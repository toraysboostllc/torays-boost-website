import { describe, it, expect } from "vitest";
import { createFakeSupabase, mockReq, mockRes } from "./fakeSupabase.js";
import { sha256Hex } from "../api/_lib/wholesaleDb.js";
import pricesHandler from "../api/wholesale-prices.js";

/** Same real-handler-against-fake-network approach as wholesaleImages.test.js
 *  — exercises the actual wholesale-prices.js code path, not a re-implementation. */
function seedApprovedShopAndDevice(fake, { shopId = fake.nextId(), deviceTokenHash = "device-hash" } = {}) {
  fake.db.wholesale_shops.push({ id: shopId, name: "Test Shop", status: "active", code_hash: "x", failed_attempts: 0 });
  const deviceId = fake.nextId();
  fake.db.wholesale_devices.push({ id: deviceId, shop_id: shopId, device_token_hash: deviceTokenHash, status: "approved" });
  const sessionTokenHash = sha256Hex("live-session-token");
  fake.db.wholesale_sessions.push({
    id: fake.nextId(),
    shop_id: shopId,
    device_id: deviceId,
    session_token_hash: sessionTokenHash,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    revoked_at: null,
  });
  return { shopId, deviceId };
}

async function callPrices(fake, token = "live-session-token") {
  const req = mockReq({ method: "GET", headers: { cookie: `ws_session=${token}` } });
  const res = mockRes();
  const originalFetch = global.fetch;
  global.fetch = fake.fakeFetch;
  process.env.SUPABASE_URL = "https://fake.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "fake-key";
  try {
    await pricesHandler(req, res);
  } finally {
    global.fetch = originalFetch;
  }
  return res;
}

function seedEquipmentType(fake, overrides = {}) {
  const et = { id: fake.nextId(), slug: "ps5-console", name: "PS5", is_tag_lens: false, active: true, sort_order: 0, ...overrides };
  fake.db.wholesale_equipment_types.push(et);
  return et;
}
function seedCategory(fake, equipmentTypeId, overrides = {}) {
  const cat = { id: fake.nextId(), slug: "ps5", name: "PlayStation 5", equipment_type_id: equipmentTypeId, active: true, sort_order: 0, ...overrides };
  fake.db.wholesale_categories.push(cat);
  return cat;
}
function seedService(fake, categoryId, overrides = {}) {
  const svc = {
    id: fake.nextId(),
    slug: "hdmi",
    category_id: categoryId,
    name: "HDMI Port Replacement",
    pricing_type: "fixed",
    fixed_price: 80,
    price_min: null,
    price_max: null,
    currency: "USD",
    recommended_price: null,
    target_margin_percent: null,
    active: true,
    sort_order: 0,
    ...overrides,
  };
  fake.db.wholesale_services.push(svc);
  return svc;
}

describe("GET /api/wholesale-prices: recommended_price resolution end-to-end", () => {
  it("uses the manual recommended_price when set, ignoring target_margin_percent entirely", async () => {
    const fake = createFakeSupabase();
    seedApprovedShopAndDevice(fake);
    const et = seedEquipmentType(fake);
    const cat = seedCategory(fake, et.id);
    seedService(fake, cat.id, { fixed_price: 80, recommended_price: 199.5, target_margin_percent: 10 });

    const res = await callPrices(fake);
    expect(res.statusCode).toBe(200);
    const service = res.body.equipmentTypes[0].categories[0].services[0];
    expect(service.recommended_price).toBe(199.5);
  });

  it("falls back to the global default margin when no manual price or per-service margin exists", async () => {
    const fake = createFakeSupabase();
    fake.db.wholesale_portal_settings[0].default_target_margin_percent = 47;
    fake.db.wholesale_portal_settings[0].rounding_rule = "none";
    seedApprovedShopAndDevice(fake);
    const et = seedEquipmentType(fake);
    const cat = seedCategory(fake, et.id);
    seedService(fake, cat.id, { fixed_price: 80, recommended_price: null, target_margin_percent: null });

    const res = await callPrices(fake);
    const service = res.body.equipmentTypes[0].categories[0].services[0];
    expect(service.recommended_price).toBeCloseTo(150.94, 2);
  });

  it("a `quote` service always has recommended_price: null — never a fabricated number", async () => {
    const fake = createFakeSupabase();
    seedApprovedShopAndDevice(fake);
    const et = seedEquipmentType(fake);
    const cat = seedCategory(fake, et.id);
    seedService(fake, cat.id, {
      pricing_type: "quote",
      fixed_price: null,
      price_min: null,
      price_max: null,
      recommended_price: null,
      target_margin_percent: 50,
    });

    const res = await callPrices(fake);
    const service = res.body.equipmentTypes[0].categories[0].services[0];
    expect(service.recommended_price).toBeNull();
  });

  it("applies the configured rounding rule from wholesale_portal_settings", async () => {
    const fake = createFakeSupabase();
    fake.db.wholesale_portal_settings[0].default_target_margin_percent = 47;
    fake.db.wholesale_portal_settings[0].rounding_rule = "nearest_1";
    seedApprovedShopAndDevice(fake);
    const et = seedEquipmentType(fake);
    const cat = seedCategory(fake, et.id);
    seedService(fake, cat.id, { fixed_price: 80, recommended_price: null, target_margin_percent: null });

    const res = await callPrices(fake);
    const service = res.body.equipmentTypes[0].categories[0].services[0];
    expect(service.recommended_price).toBe(151);
  });

  it("range pricing_type resolves recommended_price off price_max (conservative)", async () => {
    const fake = createFakeSupabase();
    fake.db.wholesale_portal_settings[0].default_target_margin_percent = 40;
    fake.db.wholesale_portal_settings[0].rounding_rule = "none";
    seedApprovedShopAndDevice(fake);
    const et = seedEquipmentType(fake);
    const cat = seedCategory(fake, et.id);
    seedService(fake, cat.id, {
      pricing_type: "range",
      fixed_price: null,
      price_min: 70,
      price_max: 90,
      recommended_price: null,
      target_margin_percent: null,
    });

    const res = await callPrices(fake);
    const service = res.body.equipmentTypes[0].categories[0].services[0];
    // 90 / (1 - 0.4) = 150
    expect(service.recommended_price).toBeCloseTo(150, 2);
  });
});

describe("GET /api/wholesale-prices: salesModule reflects wholesale_portal_settings, read-only", () => {
  it("returns the configured sales module state", async () => {
    const fake = createFakeSupabase();
    fake.db.wholesale_portal_settings[0].sales_visible = true;
    fake.db.wholesale_portal_settings[0].sales_status = "maintenance";
    fake.db.wholesale_portal_settings[0].sales_entry_blocked = true;
    seedApprovedShopAndDevice(fake);

    const res = await callPrices(fake);
    expect(res.body.salesModule).toEqual({ visible: true, status: "maintenance", entryBlocked: true });
  });

  it("reflects an admin-activated Sales module (visible + active + unblocked)", async () => {
    const fake = createFakeSupabase();
    fake.db.wholesale_portal_settings[0].sales_status = "active";
    fake.db.wholesale_portal_settings[0].sales_entry_blocked = false;
    seedApprovedShopAndDevice(fake);

    const res = await callPrices(fake);
    expect(res.body.salesModule.status).toBe("active");
    expect(res.body.salesModule.entryBlocked).toBe(false);
  });

  it("falls back to safe conservative defaults (maintenance, blocked) if the settings row is missing", async () => {
    const fake = createFakeSupabase();
    fake.db.wholesale_portal_settings = []; // simulate a fresh/incomplete environment
    seedApprovedShopAndDevice(fake);

    const res = await callPrices(fake);
    expect(res.statusCode).toBe(200); // catalog still loads — a missing settings row must not break the whole response
    expect(res.body.salesModule).toEqual({ visible: true, status: "maintenance", entryBlocked: true });
  });
});

describe("GET /api/wholesale-prices: unauthorized/revoked access is unaffected by the pricing-intelligence extension", () => {
  it("still 401s with no session cookie", async () => {
    const fake = createFakeSupabase();
    const req = mockReq({ method: "GET", headers: {} });
    const res = mockRes();
    const originalFetch = global.fetch;
    global.fetch = fake.fakeFetch;
    process.env.SUPABASE_URL = "https://fake.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "fake-key";
    try {
      await pricesHandler(req, res);
    } finally {
      global.fetch = originalFetch;
    }
    expect(res.statusCode).toBe(401);
  });

  it("still 403s when the shop is blocked, regardless of portal settings", async () => {
    const fake = createFakeSupabase();
    const { shopId } = seedApprovedShopAndDevice(fake);
    fake.db.wholesale_shops.find((s) => s.id === shopId).status = "blocked";

    const res = await callPrices(fake);
    expect(res.statusCode).toBe(403);
    expect(res.body.salesModule).toBeUndefined(); // no catalog data of any kind leaks on a revoked/blocked response
  });
});

describe("GET /api/wholesale-prices: Silver/Purple/Gold price tiers pass through raw, no formula, no fallback", () => {
  it("a legacy service (competitive_price/high_profit_price both null in the DB) reports both as null — the client, not this endpoint, decides to fall back to the single-price experience", async () => {
    const fake = createFakeSupabase();
    seedApprovedShopAndDevice(fake);
    const et = seedEquipmentType(fake);
    const cat = seedCategory(fake, et.id);
    seedService(fake, cat.id, { fixed_price: 25, recommended_price: 45 });

    const res = await callPrices(fake);
    const service = res.body.equipmentTypes[0].categories[0].services[0];
    expect(service.competitive_price).toBeNull();
    expect(service.high_profit_price).toBeNull();
    expect(service.recommended_price).toBe(45);
  });

  it("a fully-configured service (the DualSense example from the spec) reports all three tiers exactly as stored, with no rounding/derivation of any kind", async () => {
    const fake = createFakeSupabase();
    seedApprovedShopAndDevice(fake);
    const et = seedEquipmentType(fake);
    const cat = seedCategory(fake, et.id);
    seedService(fake, cat.id, {
      fixed_price: 25,
      recommended_price: 45,
      competitive_price: 40,
      high_profit_price: 55,
    });

    const res = await callPrices(fake);
    const service = res.body.equipmentTypes[0].categories[0].services[0];
    expect(service.fixed_price).toBe(25);
    expect(service.competitive_price).toBe(40);
    expect(service.recommended_price).toBe(45);
    expect(service.high_profit_price).toBe(55);
  });

  it("the board-level-repair example from the spec passes through exactly as stored too", async () => {
    const fake = createFakeSupabase();
    seedApprovedShopAndDevice(fake);
    const et = seedEquipmentType(fake);
    const cat = seedCategory(fake, et.id);
    seedService(fake, cat.id, {
      name: "Board-Level Repair",
      fixed_price: 50,
      recommended_price: 120,
      competitive_price: 90,
      high_profit_price: 140,
    });

    const res = await callPrices(fake);
    const service = res.body.equipmentTypes[0].categories[0].services[0];
    expect(service.fixed_price).toBe(50);
    expect(service.competitive_price).toBe(90);
    expect(service.recommended_price).toBe(120);
    expect(service.high_profit_price).toBe(140);
  });
});
