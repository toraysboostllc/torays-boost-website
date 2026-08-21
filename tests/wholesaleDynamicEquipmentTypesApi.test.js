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

describe("wholesale-prices: Microsoldering is a plain member of equipmentTypes[], sourced from its real row — no separate response key, no hardcoded object", () => {
  it("appears in equipmentTypes[] carrying id/slug/name/name_es/full_bleed_photo/image_focus_x/image_focus_y from the real is_tag_lens row, with is_tag_lens: true, and its categories pre-filtered to only the tagged services", async () => {
    seedShopWithSession();
    const microsolderingType = seedEquipmentType({
      slug: "microsoldering",
      name: "Microsoldering",
      name_es: "Microsoldadura",
      is_tag_lens: true,
      full_bleed_photo: true,
      image_focus_x: 50,
      image_focus_y: 35,
      sort_order: 1,
    });
    // a real equipment type + one tagged and one untagged service, so the
    // Microsoldering card's categories only carry the tagged one while the
    // real iPhone card still carries both.
    const et = seedEquipmentType({ id: fake.nextId(), slug: "iphone", name: "iPhone", sort_order: 2 });
    const cat = seedCategory(et.id, { slug: "iphone-board" });
    const taggedService = seedService(cat.id, { name: "Board Repair" });
    seedService(cat.id, { id: fake.nextId(), slug: "screen-repl", name: "Screen Replacement" });
    const tag = { id: fake.nextId(), slug: "microsoldering", name: "Microsoldering" };
    fake.db.wholesale_tags.push(tag);
    fake.db.wholesale_service_tags.push({ service_id: taggedService.id, tag_id: tag.id });

    const res = await callPrices();

    expect(res.body.microsoldering).toBeUndefined(); // no separate response key at all
    const microCard = res.body.equipmentTypes.find((e) => e.id === microsolderingType.id);
    expect(microCard).toBeTruthy();
    expect(microCard.slug).toBe("microsoldering");
    expect(microCard.name).toBe("Microsoldering");
    expect(microCard.name_es).toBe("Microsoldadura");
    expect(microCard.full_bleed_photo).toBe(true);
    expect(microCard.image_focus_x).toBe(50);
    expect(microCard.image_focus_y).toBe(35);
    expect(microCard.is_tag_lens).toBe(true);
    // Its one category is the real iphone-board row, but with ONLY the
    // tagged service — the untagged "Screen Replacement" never leaks in.
    expect(microCard.categories).toHaveLength(1);
    expect(microCard.categories[0].slug).toBe("iphone-board");
    expect(microCard.categories[0].services.map((s) => s.name)).toEqual(["Board Repair"]);

    // The real iPhone card, meanwhile, is untouched and unfiltered — both
    // services still there, is_tag_lens: false.
    const iphoneCard = res.body.equipmentTypes.find((e) => e.id === et.id);
    expect(iphoneCard.is_tag_lens).toBe(false);
    expect(iphoneCard.categories[0].services.map((s) => s.name).sort()).toEqual(["Board Repair", "Screen Replacement"]);

    // sort_order controls final position, Microsoldering included — it was
    // seeded at sort_order 1 (before iPhone's 2), and lands first here too.
    expect(res.body.equipmentTypes[0].id).toBe(microsolderingType.id);
  });

  it("produces no card at all when nothing is currently tagged — never an empty-but-present card, same 'hide if empty' rule every other equipment type gets", async () => {
    seedShopWithSession();
    const microsolderingType = seedEquipmentType({ slug: "microsoldering", name: "Microsoldering", is_tag_lens: true });
    const et = seedEquipmentType({ id: fake.nextId(), slug: "iphone", name: "iPhone" });
    const cat = seedCategory(et.id);
    seedService(cat.id); // no tag attached at all

    const res = await callPrices();

    expect(res.body.equipmentTypes.find((e) => e.id === microsolderingType.id)).toBeUndefined();
  });
});
