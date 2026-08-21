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

describe("wholesale-prices: Microsoldering (catalog_mode='direct_services') is a plain equipmentTypes[] member with its own directly-owned services, plus a TEMPORARY legacy compatibility key", () => {
  it("appears in equipmentTypes[] carrying id/slug/name/name_es/full_bleed_photo/image_focus_x/image_focus_y/catalog_mode/sort_order from the real row, its category holding only its own real services — no tag involved anywhere", async () => {
    seedShopWithSession();
    const microsolderingType = seedEquipmentType({
      slug: "microsoldering",
      name: "Microsoldering",
      name_es: "Microsoldadura",
      catalog_mode: "direct_services",
      full_bleed_photo: true,
      image_focus_x: 50,
      image_focus_y: 35,
      sort_order: 1,
    });
    const microCat = seedCategory(microsolderingType.id, { slug: "microsoldering-direct" });
    seedService(microCat.id, { name: "Board Repair" });
    // A real, unrelated equipment type alongside it — never touched or
    // filtered by Microsoldering's presence.
    const et = seedEquipmentType({ id: fake.nextId(), slug: "iphone", name: "iPhone", sort_order: 2 });
    const cat = seedCategory(et.id, { slug: "iphone-board" });
    seedService(cat.id, { name: "Screen Replacement" });

    const res = await callPrices();

    // Deliberately NOT in equipmentTypes[] — see the wire-split comment in
    // api/_lib/wholesaleDb.js for the real, reproduced old-client-tab
    // reason. microsolderingEquipmentType is the PRIMARY channel instead.
    expect(res.body.equipmentTypes.map((e) => e.slug)).not.toContain("microsoldering");
    const microCard = res.body.microsolderingEquipmentType;
    expect(microCard).toBeTruthy();
    expect(microCard.id).toBe(microsolderingType.id);
    expect(microCard.name).toBe("Microsoldering");
    expect(microCard.name_es).toBe("Microsoldadura");
    expect(microCard.full_bleed_photo).toBe(true);
    expect(microCard.image_focus_x).toBe(50);
    expect(microCard.image_focus_y).toBe(35);
    expect(microCard.catalog_mode).toBe("direct_services");
    expect(microCard.sort_order).toBe(1);
    expect(microCard.categories).toHaveLength(1);
    expect(microCard.categories[0].slug).toBe("microsoldering-direct");
    expect(microCard.categories[0].services.map((s) => s.name)).toEqual(["Board Repair"]);

    // The real iPhone card, meanwhile, is untouched — catalog_mode='grouped'
    // (the default), own sort_order carried too, unaffected by Microsoldering.
    const iphoneCard = res.body.equipmentTypes.find((e) => e.id === et.id);
    expect(iphoneCard.catalog_mode).toBe("grouped");
    expect(iphoneCard.sort_order).toBe(2);
    expect(iphoneCard.categories[0].services.map((s) => s.name)).toEqual(["Screen Replacement"]);
  });

  it("ALSO returns the TEMPORARY legacy `microsoldering` compatibility key, nested as ONE synthetic equipmentType wrapping Microsoldering's own real category/services — for a stale pre-deploy client tab only; the current client never reads it", async () => {
    seedShopWithSession();
    const microsolderingType = seedEquipmentType({
      slug: "microsoldering", name: "Microsoldering", catalog_mode: "direct_services", sort_order: 1,
    });
    const microCat = seedCategory(microsolderingType.id, { slug: "microsoldering-direct" });
    seedService(microCat.id, { name: "Board Repair" });

    const res = await callPrices();

    expect(res.body.microsoldering).toBeTruthy();
    expect(res.body.microsoldering.id).toBe(microsolderingType.id);
    expect(res.body.microsoldering.equipmentTypes).toHaveLength(1);
    expect(res.body.microsoldering.equipmentTypes[0].id).toBe(microsolderingType.id);
    expect(res.body.microsoldering.equipmentTypes[0].name).toBe("Microsoldering");
    expect(res.body.microsoldering.equipmentTypes[0].categories[0].slug).toBe("microsoldering-direct");
    expect(res.body.microsoldering.equipmentTypes[0].categories[0].services.map((s) => s.name)).toEqual(["Board Repair"]);
  });

  it("legacy key is null when the row is active but has zero services yet (nothing added from DESK) — matches the unified card's own 'hide if empty' rule, no graceful-empty-state object needed since there's no separate channel to keep in sync", async () => {
    seedShopWithSession();
    seedEquipmentType({ slug: "microsoldering", name: "Microsoldering", catalog_mode: "direct_services" });

    const res = await callPrices();

    expect(res.body.microsoldering).toBeNull();
    expect(res.body.equipmentTypes.map((e) => e.slug)).not.toContain("microsoldering");
  });

  it("legacy key is null when no Microsoldering row exists at all or it's hidden — never a crash", async () => {
    seedShopWithSession();
    const et = seedEquipmentType({ id: fake.nextId(), slug: "iphone", name: "iPhone" });
    const cat = seedCategory(et.id);
    seedService(cat.id);

    const res = await callPrices();

    expect(res.statusCode).toBe(200);
    expect(res.body.microsoldering).toBeNull();
  });

  it("produces no card at all when Microsoldering's category has zero active services — never an empty-but-present card, same 'hide if empty' rule every other equipment type gets", async () => {
    seedShopWithSession();
    const microsolderingType = seedEquipmentType({ slug: "microsoldering", name: "Microsoldering", catalog_mode: "direct_services" });
    const microCat = seedCategory(microsolderingType.id);
    seedService(microCat.id, { active: false });

    const res = await callPrices();

    expect(res.body.equipmentTypes.find((e) => e.id === microsolderingType.id)).toBeUndefined();
  });
});
