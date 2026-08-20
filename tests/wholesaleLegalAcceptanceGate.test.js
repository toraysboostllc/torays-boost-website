import { describe, it, expect } from "vitest";
import { createFakeSupabase, mockReq, mockRes } from "./fakeSupabase.js";
import { sha256Hex } from "../api/_lib/wholesaleDb.js";
import pricesHandler from "../api/wholesale-prices.js";

/** Same real-handler-against-fake-network approach as
 *  wholesalePricesRecommended.test.js — exercises the actual
 *  wholesale-prices.js code path, not a re-implementation. */
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

function seedPublishedDoc(fake, overrides = {}) {
  const doc = {
    id: fake.nextId(),
    version: "1.0",
    status: "published",
    content_en: {},
    content_es: {},
    content_hash: "hash-1",
    published_at: new Date().toISOString(),
    ...overrides,
  };
  fake.db.wholesale_legal_documents.push(doc);
  return doc;
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

describe("GET /api/wholesale-prices: legal-acceptance gate", () => {
  it("no published legal document at all — the gate is inactive, catalog loads normally (200)", async () => {
    const fake = createFakeSupabase();
    seedApprovedShopAndDevice(fake);
    const res = await callPrices(fake);
    expect(res.statusCode).toBe(200);
  });

  it("a published document exists but the shop has never accepted it — 403 legal_acceptance_required, carrying legalDocumentId/version", async () => {
    const fake = createFakeSupabase();
    seedApprovedShopAndDevice(fake);
    const doc = seedPublishedDoc(fake);

    const res = await callPrices(fake);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe("legal_acceptance_required");
    expect(res.body.legalDocumentId).toBe(doc.id);
    expect(res.body.version).toBe(doc.version);
  });

  it("NEVER reuses the 'auth'/'unauthorized'/'access_revoked' error codes for this — the frontend must be able to tell the two apart", async () => {
    const fake = createFakeSupabase();
    seedApprovedShopAndDevice(fake);
    seedPublishedDoc(fake);

    const res = await callPrices(fake);
    expect(res.body.error).not.toBe("auth");
    expect(res.body.error).not.toBe("unauthorized");
    expect(res.body.error).not.toBe("access_revoked");
  });

  it("no catalog data of any kind leaks alongside the 403 — pricing stays fully gated until acceptance", async () => {
    const fake = createFakeSupabase();
    seedApprovedShopAndDevice(fake);
    seedPublishedDoc(fake);

    const res = await callPrices(fake);
    expect(res.body.equipmentTypes).toBeUndefined();
    expect(res.body.salesModule).toBeUndefined();
  });

  it("once the shop has accepted the currently published document, the catalog loads normally (200)", async () => {
    const fake = createFakeSupabase();
    const { shopId, deviceId } = seedApprovedShopAndDevice(fake);
    const doc = seedPublishedDoc(fake);
    fake.db.wholesale_legal_acceptances.push({
      id: fake.nextId(),
      shop_id: shopId,
      device_id: deviceId,
      legal_document_id: doc.id,
      representative_name: "Jane Doe",
      representative_title: "Owner",
      content_hash: doc.content_hash,
      locale: "en",
      accepted_at: new Date().toISOString(),
    });

    const res = await callPrices(fake);
    expect(res.statusCode).toBe(200);
  });

  it("an acceptance recorded against an OLDER, now-superseded version does not satisfy the gate for the new one", async () => {
    const fake = createFakeSupabase();
    const { shopId, deviceId } = seedApprovedShopAndDevice(fake);
    const oldDoc = seedPublishedDoc(fake, { id: "old-doc-id", version: "1.0", status: "superseded" });
    const newDoc = seedPublishedDoc(fake, { id: "new-doc-id", version: "2.0" });
    fake.db.wholesale_legal_acceptances.push({
      id: fake.nextId(),
      shop_id: shopId,
      device_id: deviceId,
      legal_document_id: oldDoc.id,
      representative_name: "Jane Doe",
      representative_title: "Owner",
      content_hash: oldDoc.content_hash,
      locale: "en",
      accepted_at: new Date().toISOString(),
    });

    const res = await callPrices(fake);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe("legal_acceptance_required");
    expect(res.body.legalDocumentId).toBe(newDoc.id);
  });

  it("re-checked on EVERY request, not cached after the first pass — two consecutive calls with no acceptance both 403", async () => {
    const fake = createFakeSupabase();
    seedApprovedShopAndDevice(fake);
    seedPublishedDoc(fake);

    const first = await callPrices(fake);
    const second = await callPrices(fake);
    expect(first.statusCode).toBe(403);
    expect(second.statusCode).toBe(403);
  });

  it("shop/device revocation is still checked BEFORE the legal gate — a blocked shop gets access_revoked, never legal_acceptance_required", async () => {
    const fake = createFakeSupabase();
    const { shopId } = seedApprovedShopAndDevice(fake);
    seedPublishedDoc(fake);
    fake.db.wholesale_shops.find((s) => s.id === shopId).status = "blocked";

    const res = await callPrices(fake);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe("access_revoked");
  });
});

describe("GET /api/wholesale-prices: price_updated_at passthrough (Task 4)", () => {
  it("passes through a real price_updated_at timestamp unchanged", async () => {
    const fake = createFakeSupabase();
    seedApprovedShopAndDevice(fake);
    const et = { id: fake.nextId(), slug: "ps5-console", name: "PS5", is_tag_lens: false, active: true, sort_order: 0 };
    fake.db.wholesale_equipment_types.push(et);
    const cat = { id: fake.nextId(), slug: "ps5", name: "PlayStation 5", equipment_type_id: et.id, active: true, sort_order: 0 };
    fake.db.wholesale_categories.push(cat);
    const stamp = "2026-03-01T00:00:00.000Z";
    fake.db.wholesale_services.push({
      id: fake.nextId(), slug: "hdmi", category_id: cat.id, name: "HDMI Port", pricing_type: "fixed",
      fixed_price: 80, currency: "USD", active: true, sort_order: 0, price_updated_at: stamp,
    });

    const res = await callPrices(fake);
    const service = res.body.equipmentTypes[0].categories[0].services[0];
    expect(service.price_updated_at).toBe(stamp);
  });

  it("a service with no price history yet reports price_updated_at: null — never an invented date", async () => {
    const fake = createFakeSupabase();
    seedApprovedShopAndDevice(fake);
    const et = { id: fake.nextId(), slug: "ps5-console", name: "PS5", is_tag_lens: false, active: true, sort_order: 0 };
    fake.db.wholesale_equipment_types.push(et);
    const cat = { id: fake.nextId(), slug: "ps5", name: "PlayStation 5", equipment_type_id: et.id, active: true, sort_order: 0 };
    fake.db.wholesale_categories.push(cat);
    fake.db.wholesale_services.push({
      id: fake.nextId(), slug: "hdmi", category_id: cat.id, name: "HDMI Port", pricing_type: "fixed",
      fixed_price: 80, currency: "USD", active: true, sort_order: 0, price_updated_at: null,
    });

    const res = await callPrices(fake);
    const service = res.body.equipmentTypes[0].categories[0].services[0];
    expect(service.price_updated_at).toBeNull();
  });
});
