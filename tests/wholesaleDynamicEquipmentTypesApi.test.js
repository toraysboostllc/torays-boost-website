import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeSupabase, mockReq, mockRes } from "./fakeSupabase.js";
import { sha256Hex } from "../api/_lib/wholesaleDb.js";
import pricesHandler from "../api/wholesale-prices.js";

/**
 * End-to-end coverage (real api/wholesale-prices.js handler, fake Supabase)
 * for the 4 new wholesale_equipment_types columns
 * (name_es/full_bleed_photo/image_focus_x/image_focus_y) actually reaching
 * the client response — for both a normal equipment type and the
 * Microsoldering tag-lens row, which is now sourced from the same real row
 * instead of a hardcoded client-side object literal.
 */

let fake;

beforeEach(() => {
  process.env.SUPABASE_URL = "https://fake.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role-key";
  fake = createFakeSupabase();
  vi.stubGlobal("fetch", fake.fakeFetch);
});

function seedShopWithSession(token = "live-session-token") {
  const shop = { id: fake.nextId(), name: "Acme Repair", status: "active", failed_attempts: 0, locked_until: null, created_at: new Date().toISOString() };
  fake.db.wholesale_shops.push(shop);
  const device = { id: fake.nextId(), shop_id: shop.id, device_token_hash: sha256Hex("device-token"), status: "approved", first_seen_at: new Date().toISOString(), approved_at: new Date().toISOString() };
  fake.db.wholesale_devices.push(device);
  fake.db.wholesale_sessions.push({
    id: fake.nextId(),
    shop_id: shop.id,
    device_id: device.id,
    session_token_hash: sha256Hex(token),
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString(),
    revoked_at: null,
  });
  return { shop, device };
}

function seedEquipmentType(overrides = {}) {
  const et = { id: fake.nextId(), slug: "ps5", name: "PlayStation 5", is_tag_lens: false, active: true, sort_order: 0, ...overrides };
  fake.db.wholesale_equipment_types.push(et);
  return et;
}

function seedCategory(equipmentTypeId, overrides = {}) {
  const cat = { id: fake.nextId(), slug: "ps5-hdmi", name: "HDMI Repair", active: true, sort_order: 0, equipment_type_id: equipmentTypeId, ...overrides };
  fake.db.wholesale_categories.push(cat);
  return cat;
}

function seedService(categoryId, overrides = {}) {
  const sv = { id: fake.nextId(), category_id: categoryId, slug: "hdmi-repl", name: "HDMI Port Replacement", pricing_type: "fixed", fixed_price: 80, active: true, sort_order: 0, currency: "USD", ...overrides };
  fake.db.wholesale_services.push(sv);
  return sv;
}

async function callPrices(token = "live-session-token") {
  const req = mockReq({ headers: { cookie: `ws_session=${token}` } });
  const res = mockRes();
  await pricesHandler(req, res);
  return res;
}

describe("wholesale-prices: equipment type carries name_es/full_bleed_photo/image_focus_x/image_focus_y", () => {
  it("passes through a real name_es, full_bleed_photo=true, and custom focus X/Y exactly as stored", async () => {
    seedShopWithSession();
    const et = seedEquipmentType({ name_es: "PlayStation 5", full_bleed_photo: true, image_focus_x: 40, image_focus_y: 65 });
    const cat = seedCategory(et.id);
    seedService(cat.id);

    const res = await callPrices();

    const returned = res.body.equipmentTypes[0];
    expect(returned.name_es).toBe("PlayStation 5");
    expect(returned.full_bleed_photo).toBe(true);
    expect(returned.image_focus_x).toBe(40);
    expect(returned.image_focus_y).toBe(65);
  });

  it("defaults gracefully when name_es is null and full_bleed_photo/focus were never set — null name_es, false full_bleed_photo, centered 50/50 focus", async () => {
    seedShopWithSession();
    const et = seedEquipmentType({ name_es: null, full_bleed_photo: false, image_focus_x: 50, image_focus_y: 50 });
    const cat = seedCategory(et.id);
    seedService(cat.id);

    const res = await callPrices();

    const returned = res.body.equipmentTypes[0];
    expect(returned.name_es).toBeNull();
    expect(returned.full_bleed_photo).toBe(false);
    expect(returned.image_focus_x).toBe(50);
    expect(returned.image_focus_y).toBe(50);
  });

  it("a brand-new equipment type with no name_es entered yet still returns a complete, non-crashing response (graceful English-only degrade)", async () => {
    seedShopWithSession();
    const et = seedEquipmentType({ slug: "brand-new-card", name: "Brand New Card", name_es: null });
    const cat = seedCategory(et.id, { slug: "brand-new-category" });
    seedService(cat.id);

    const res = await callPrices();

    expect(res.statusCode).toBe(200);
    expect(res.body.equipmentTypes.find((e) => e.slug === "brand-new-card").name_es).toBeNull();
  });
});

describe("wholesale-prices: Microsoldering is sourced from its real row, not a hardcoded object", () => {
  it("microsoldering carries id/slug/name/name_es/full_bleed_photo/image_focus_x/image_focus_y from the real is_tag_lens row", async () => {
    seedShopWithSession();
    const microsolderingType = seedEquipmentType({
      slug: "microsoldering",
      name: "Microsoldering",
      name_es: "Microsoldadura",
      is_tag_lens: true,
      full_bleed_photo: true,
      image_focus_x: 50,
      image_focus_y: 35,
    });
    // a real equipment type + tagged service so the lens has something to show
    const et = seedEquipmentType({ id: fake.nextId(), slug: "iphone", name: "iPhone" });
    const cat = seedCategory(et.id, { slug: "iphone-board" });
    const sv = seedService(cat.id, { name: "Board Repair" });
    const tag = { id: fake.nextId(), slug: "microsoldering", name: "Microsoldering" };
    fake.db.wholesale_tags.push(tag);
    fake.db.wholesale_service_tags.push({ service_id: sv.id, tag_id: tag.id });

    const res = await callPrices();

    expect(res.body.microsoldering).toBeTruthy();
    expect(res.body.microsoldering.id).toBe(microsolderingType.id);
    expect(res.body.microsoldering.slug).toBe("microsoldering");
    expect(res.body.microsoldering.name).toBe("Microsoldering");
    expect(res.body.microsoldering.name_es).toBe("Microsoldadura");
    expect(res.body.microsoldering.full_bleed_photo).toBe(true);
    expect(res.body.microsoldering.image_focus_x).toBe(50);
    expect(res.body.microsoldering.image_focus_y).toBe(35);
  });
});
