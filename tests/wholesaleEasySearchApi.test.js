import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeSupabase, mockReq, mockRes } from "./fakeSupabase.js";
import { sha256Hex } from "../api/_lib/wholesaleDb.js";
import handler from "../api/wholesale-easy-search.js";

/**
 * api/wholesale-easy-search.js — same HTTP-boundary-faked convention as
 * tests/wholesaleRememberDevice.test.js: only fetch is stubbed, the real
 * handler and the real resolveWholesaleSession()/searchWholesaleDeviceModels()
 * in api/_lib/wholesaleDb.js run unmodified.
 */

let fake;
const SESSION_TOKEN = "session-token-abc";

beforeEach(() => {
  process.env.SUPABASE_URL = "https://fake.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role-key";
  fake = createFakeSupabase();
  vi.stubGlobal("fetch", fake.fakeFetch);
});

function seedShop(overrides = {}) {
  const shop = { id: fake.nextId(), name: "Acme Repair", status: "active", ...overrides };
  fake.db.wholesale_shops.push(shop);
  return shop;
}
function seedDevice(shopId, overrides = {}) {
  const device = { id: fake.nextId(), shop_id: shopId, status: "approved", ...overrides };
  fake.db.wholesale_devices.push(device);
  return device;
}
function seedSession(shopId, deviceId, overrides = {}) {
  const session = {
    id: fake.nextId(),
    shop_id: shopId,
    device_id: deviceId,
    session_token_hash: sha256Hex(SESSION_TOKEN),
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    revoked_at: null,
    remembered: true,
    ...overrides,
  };
  fake.db.wholesale_sessions.push(session);
  return session;
}
function seedDeviceModel(overrides = {}) {
  const model = {
    id: fake.nextId(),
    brand: "Apple",
    commercial_name: "iPhone 11 Pro Max",
    device_category: "phone",
    year: 2019,
    screen: '6.5" Super Retina XDR OLED',
    processor: "Apple A13 Bionic",
    ram: "4 GB",
    storage: "64/256/512 GB",
    main_camera: "Triple 12+12+12 MP",
    battery: "3969 mAh",
    catalog_model_id: null,
    active: true,
    ...overrides,
  };
  fake.db.wholesale_device_models.push(model);
  return model;
}
function seedCode(deviceModelId, code, overrides = {}) {
  const row = {
    id: fake.nextId(),
    device_model_id: deviceModelId,
    code,
    normalized_code: code.toUpperCase().replace(/[^A-Z0-9]/g, ""),
    region: null,
    active: true,
    ...overrides,
  };
  fake.db.wholesale_device_model_codes.push(row);
  return row;
}

async function callHandler({ query = {}, cookie = `ws_session=${SESSION_TOKEN}` } = {}) {
  const req = mockReq({ method: "GET", query, headers: { cookie } });
  const res = mockRes();
  await handler(req, res);
  return res;
}

describe("api/wholesale-easy-search.js: auth enforcement", () => {
  it("401s with no session cookie at all", async () => {
    const res = await callHandler({ cookie: "" });
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe("unauthorized");
  });

  it("401s with a session token that matches nothing", async () => {
    const res = await callHandler({ cookie: "ws_session=not-a-real-token" });
    expect(res.statusCode).toBe(401);
  });

  it("403s when the shop is blocked", async () => {
    const shop = seedShop({ status: "blocked" });
    const device = seedDevice(shop.id);
    seedSession(shop.id, device.id);
    const res = await callHandler({ query: { q: "A2218" } });
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe("access_revoked");
  });

  it("403s when the device is revoked", async () => {
    const shop = seedShop();
    const device = seedDevice(shop.id, { status: "revoked" });
    seedSession(shop.id, device.id);
    const res = await callHandler({ query: { q: "A2218" } });
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe("access_revoked");
  });

  it("401s when the session was explicitly revoked", async () => {
    const shop = seedShop();
    const device = seedDevice(shop.id);
    seedSession(shop.id, device.id, { revoked_at: new Date().toISOString() });
    const res = await callHandler({ query: { q: "A2218" } });
    expect(res.statusCode).toBe(401);
  });

  it("only GET is allowed", async () => {
    const shop = seedShop();
    const device = seedDevice(shop.id);
    seedSession(shop.id, device.id);
    const req = mockReq({ method: "POST", headers: { cookie: `ws_session=${SESSION_TOKEN}` } });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});

describe("api/wholesale-easy-search.js: search results and visibility", () => {
  it("finds a device by exact code and never includes a price field", async () => {
    const shop = seedShop();
    const device = seedDevice(shop.id);
    seedSession(shop.id, device.id);
    const model = seedDeviceModel();
    seedCode(model.id, "A2218");

    const res = await callHandler({ query: { q: "A2218" } });
    expect(res.statusCode).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].commercialName).toBe("iPhone 11 Pro Max");
    expect(res.body.results[0]).not.toHaveProperty("price");
    expect(res.body.results[0]).not.toHaveProperty("fixedPrice");
    expect(res.body.results[0]).not.toHaveProperty("recommendedPrice");
  });

  it("matches regardless of case, spaces, or hyphens in the query", async () => {
    const shop = seedShop();
    const device = seedDevice(shop.id);
    seedSession(shop.id, device.id);
    const model = seedDeviceModel();
    seedCode(model.id, "A2218");

    for (const q of ["a2218", "A-2218", "A 2218"]) {
      const res = await callHandler({ query: { q } });
      expect(res.body.results, `query "${q}"`).toHaveLength(1);
    }
  });

  it("a hidden (inactive) model is never returned even if its code matches exactly", async () => {
    const shop = seedShop();
    const device = seedDevice(shop.id);
    seedSession(shop.id, device.id);
    const model = seedDeviceModel({ active: false });
    seedCode(model.id, "A2218");

    const res = await callHandler({ query: { q: "A2218" } });
    expect(res.body.results).toHaveLength(0);
  });

  it("a deactivated code is never returned even if the model is active", async () => {
    const shop = seedShop();
    const device = seedDevice(shop.id);
    seedSession(shop.id, device.id);
    const model = seedDeviceModel();
    seedCode(model.id, "A2218", { active: false });

    const res = await callHandler({ query: { q: "A2218" } });
    expect(res.body.results).toHaveLength(0);
  });

  it("hasWholesaleCatalog is false with no catalog_model_id link", async () => {
    const shop = seedShop();
    const device = seedDevice(shop.id);
    seedSession(shop.id, device.id);
    const model = seedDeviceModel({ catalog_model_id: null });
    seedCode(model.id, "A2218");

    const res = await callHandler({ query: { q: "A2218" } });
    expect(res.body.results[0].hasWholesaleCatalog).toBe(false);
    expect(res.body.results[0].catalogCategoryId).toBeNull();
  });

  it("hasWholesaleCatalog is true and carries navigation ids when linked to an active category", async () => {
    const shop = seedShop();
    const device = seedDevice(shop.id);
    seedSession(shop.id, device.id);
    const equipmentTypeId = fake.nextId();
    const category = { id: fake.nextId(), slug: "iphone-11-pro-max", equipment_type_id: equipmentTypeId, active: true };
    fake.db.wholesale_categories.push(category);
    const model = seedDeviceModel({ catalog_model_id: category.id });
    seedCode(model.id, "A2218");

    const res = await callHandler({ query: { q: "A2218" } });
    expect(res.body.results[0].hasWholesaleCatalog).toBe(true);
    expect(res.body.results[0].catalogCategoryId).toBe(category.id);
    expect(res.body.results[0].catalogEquipmentTypeId).toBe(equipmentTypeId);
  });

  it("hasWholesaleCatalog is false when the linked category itself is inactive (a dead link is never offered)", async () => {
    const shop = seedShop();
    const device = seedDevice(shop.id);
    seedSession(shop.id, device.id);
    const category = { id: fake.nextId(), slug: "hidden-model", equipment_type_id: fake.nextId(), active: false };
    fake.db.wholesale_categories.push(category);
    const model = seedDeviceModel({ catalog_model_id: category.id });
    seedCode(model.id, "A2218");

    const res = await callHandler({ query: { q: "A2218" } });
    expect(res.body.results[0].hasWholesaleCatalog).toBe(false);
  });

  it("finds a device by commercial name even without a code match", async () => {
    const shop = seedShop();
    const device = seedDevice(shop.id);
    seedSession(shop.id, device.id);
    seedDeviceModel({ commercial_name: "Galaxy S23 Ultra", brand: "Samsung" });

    const res = await callHandler({ query: { q: "Galaxy S23" } });
    expect(res.body.results.some((r) => r.commercialName === "Galaxy S23 Ultra")).toBe(true);
  });

  it("ranks an exact code match above a prefix match", async () => {
    const shop = seedShop();
    const device = seedDevice(shop.id);
    seedSession(shop.id, device.id);
    const exact = seedDeviceModel({ commercial_name: "Exact Match Device" });
    seedCode(exact.id, "A2218");
    const prefixOnly = seedDeviceModel({ commercial_name: "Prefix Match Device" });
    seedCode(prefixOnly.id, "A22180");

    const res = await callHandler({ query: { q: "A2218" } });
    expect(res.body.results[0].commercialName).toBe("Exact Match Device");
  });

  it("a query shorter than the minimum returns an empty result set, not an error", async () => {
    const shop = seedShop();
    const device = seedDevice(shop.id);
    seedSession(shop.id, device.id);
    const res = await callHandler({ query: { q: "A" } });
    expect(res.statusCode).toBe(200);
    expect(res.body.results).toEqual([]);
  });
});
