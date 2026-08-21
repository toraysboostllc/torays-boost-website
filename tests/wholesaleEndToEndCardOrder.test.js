import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeSupabase, mockReq, mockRes } from "./fakeSupabase.js";
import { sha256Hex } from "../api/_lib/wholesaleDb.js";
import pricesHandler from "../api/wholesale-prices.js";
import { buildWholesaleWizardCatalog } from "../src/lib/wholesaleWizardCatalog.js";

/**
 * Real end-to-end coverage of the FULL card pipeline the owner explicitly
 * demanded proof of: the REAL server handler (api/wholesale-prices.js ->
 * api/_lib/wholesaleDb.js's buildWholesaleCatalog) feeding its REAL response
 * straight into the REAL client adapter
 * (src/lib/wholesaleWizardCatalog.js's buildWholesaleWizardCatalog) — no
 * reimplementation, no text-pattern scan, no mock of either function.
 * fakeSupabase.js simulates the PostgREST HTTP layer only; every line of
 * business logic under test is the actual shipped code.
 *
 * The fixture below represents the catalog AFTER the dynamic-equipment-
 * types migration has run: PS5/Xbox/Switch are real top-level equipment
 * types, MacBook's categories live under 'laptops' (renamed "Laptops"),
 * and 'macbook'/'gaming-laptops'/'video-consoles' are hidden, historical,
 * never-deleted rows — proving they produce zero cards and zero
 * interference, not just that the 8 real cards exist.
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
}

function seedEquipmentType(overrides = {}) {
  const et = { id: fake.nextId(), is_tag_lens: false, active: true, sort_order: 0, ...overrides };
  fake.db.wholesale_equipment_types.push(et);
  return et;
}

function seedCategory(equipmentTypeId, overrides = {}) {
  const cat = { id: fake.nextId(), active: true, sort_order: 0, equipment_type_id: equipmentTypeId, ...overrides };
  fake.db.wholesale_categories.push(cat);
  return cat;
}

function seedService(categoryId, overrides = {}) {
  const sv = { id: fake.nextId(), category_id: categoryId, pricing_type: "fixed", fixed_price: 80, active: true, sort_order: 0, currency: "USD", ...overrides };
  fake.db.wholesale_services.push(sv);
  return sv;
}

async function callPrices(token = "live-session-token") {
  const req = mockReq({ headers: { cookie: `ws_session=${token}` } });
  const res = mockRes();
  await pricesHandler(req, res);
  return res;
}

/** Seeds the exact post-migration catalog: 8 approved cards + 3 hidden
 *  historical rows. Returns the ids the caller needs for the 9th-card test. */
function seedPostMigrationCatalog() {
  seedShopWithSession();

  // 1. Microsoldering — is_tag_lens, no categories of its own. Gets its
  //    content by tagging a real service on a real equipment type below.
  //    source_mode/source_tag_id (not is_tag_lens) is what the server's
  //    card-building logic actually reads — see api/_lib/wholesaleDb.js.
  const tag = { id: fake.nextId(), slug: "microsoldering", name: "Microsoldering" };
  fake.db.wholesale_tags.push(tag);
  const microsoldering = seedEquipmentType({
    slug: "microsoldering", name: "Microsoldering", is_tag_lens: true,
    source_mode: "tag_lens", source_tag_id: tag.id, sort_order: 1,
  });

  // 2. iPhone
  const iphone = seedEquipmentType({ slug: "iphone", name: "iPhone", sort_order: 2 });
  const iphoneCat = seedCategory(iphone.id, { slug: "iphone-15-17", name: "iPhone 15/16/17" });
  const iphoneService = seedService(iphoneCat.id, { slug: "iphone-board-repair", name: "Board Repair" });
  fake.db.wholesale_service_tags.push({ service_id: iphoneService.id, tag_id: tag.id }); // tagged -> feeds Microsoldering too

  // 3. iPad
  const ipad = seedEquipmentType({ slug: "ipad", name: "iPad", sort_order: 3 });
  const ipadCat = seedCategory(ipad.id, { slug: "ipad-pro", name: "iPad Pro" });
  seedService(ipadCat.id, { slug: "ipad-screen-repl", name: "Screen Replacement" });

  // 4. Laptops — the owner-approved merge target. Carries MacBook's real
  //    categories (macbook-air/macbook-pro), renamed from 'macbook'.
  const laptops = seedEquipmentType({ slug: "laptops", name: "Laptops", name_es: "Laptops", sort_order: 4 });
  const macbookAir = seedCategory(laptops.id, { slug: "macbook-air", name: "MacBook Air" });
  seedService(macbookAir.id, { slug: "macbook-air-battery", name: "Battery Replacement" });
  const macbookPro = seedCategory(laptops.id, { slug: "macbook-pro", name: "MacBook Pro" });
  seedService(macbookPro.id, { slug: "macbook-pro-logic-board", name: "Logic Board Repair" });

  // 5-7. PS5 / Xbox Series X / Switch — real top-level equipment types
  //    post-migration, each with their own same-slug category.
  const ps5 = seedEquipmentType({ slug: "ps5", name: "PlayStation 5", sort_order: 5 });
  const ps5Cat = seedCategory(ps5.id, { slug: "ps5", name: "PlayStation 5" });
  seedService(ps5Cat.id, { slug: "ps5-hdmi", name: "HDMI Port Replacement" });

  const xbox = seedEquipmentType({ slug: "xbox-series-x", name: "Xbox Series X", sort_order: 6 });
  const xboxCat = seedCategory(xbox.id, { slug: "xbox-series-x", name: "Xbox Series X" });
  seedService(xboxCat.id, { slug: "xbox-hdmi", name: "HDMI Port Replacement" });

  const switchEt = seedEquipmentType({ slug: "switch", name: "Nintendo Switch / Switch OLED", sort_order: 7 });
  const switchCat = seedCategory(switchEt.id, { slug: "switch", name: "Nintendo Switch / Switch OLED" });
  seedService(switchCat.id, { slug: "switch-joycon", name: "Joy-Con Drift Repair" });

  // 8. Controllers
  const controllers = seedEquipmentType({ slug: "controllers", name: "Controllers", sort_order: 8 });
  const controllersCat = seedCategory(controllers.id, { slug: "ps5-dualsense", name: "DualSense" });
  seedService(controllersCat.id, { slug: "dualsense-stick-drift", name: "Stick Drift Repair" });

  // Hidden, historical, never-deleted rows — must produce ZERO cards and
  // ZERO interference, pushed out of the 1-8 sort_order range exactly like
  // the real migration does (101/102/103).
  seedEquipmentType({ slug: "macbook", name: "MacBook", active: false, sort_order: 101 });
  seedEquipmentType({ slug: "gaming-laptops", name: "Gaming Laptops", active: false, sort_order: 102 });
  seedEquipmentType({ slug: "video-consoles", name: "Video Consoles", active: false, sort_order: 103 });

  return { microsoldering, iphone, ipad, laptops, ps5, xbox, switchEt, controllers };
}

const APPROVED_ORDER = [
  "Microsoldering",
  "iPhone",
  "iPad",
  "Laptops",
  "PlayStation 5",
  "Xbox Series X",
  "Nintendo Switch / Switch OLED",
  "Controllers",
];

describe("End-to-end: real server (buildWholesaleCatalog) -> real client (buildWholesaleWizardCatalog), post-migration catalog", () => {
  it("produces exactly the 8 approved cards, in exactly the approved order, matching the owner's exact array — Microsoldering included as a normal card, not a special case", async () => {
    seedPostMigrationCatalog();

    const res = await callPrices();
    expect(res.statusCode).toBe(200);

    const cards = buildWholesaleWizardCatalog(res.body.equipmentTypes, undefined, res.body.tagLensEquipmentTypes);

    expect(cards.map((c) => c.name)).toEqual(APPROVED_ORDER);
  });

  it("no duplicate ids or slugs anywhere in the final card list", async () => {
    seedPostMigrationCatalog();

    const res = await callPrices();
    const cards = buildWholesaleWizardCatalog(res.body.equipmentTypes, undefined, res.body.tagLensEquipmentTypes);

    const ids = cards.map((c) => c.id);
    const slugs = cards.map((c) => c.slug);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("Laptops' models include both MacBook Air and MacBook Pro — the real merged content, not a placeholder", async () => {
    seedPostMigrationCatalog();

    const res = await callPrices();
    const cards = buildWholesaleWizardCatalog(res.body.equipmentTypes, undefined, res.body.tagLensEquipmentTypes);

    const laptopsCard = cards.find((c) => c.name === "Laptops");
    expect(laptopsCard.models.map((m) => m.name).sort()).toEqual(["MacBook Air", "MacBook Pro"]);
  });

  it("Microsoldering's own model list is the real iPhone category, filtered to only the tagged service — flattened directly into its card, not a separate lens object", async () => {
    seedPostMigrationCatalog();

    const res = await callPrices();
    const cards = buildWholesaleWizardCatalog(res.body.equipmentTypes, undefined, res.body.tagLensEquipmentTypes);

    const microCard = cards.find((c) => c.name === "Microsoldering");
    expect(microCard.isTagLens).toBe(true);
    expect(microCard.models).toHaveLength(1);
    expect(microCard.models[0].name).toBe("iPhone 15/16/17");
    expect(microCard.models[0].services.map((s) => s.name)).toEqual(["Board Repair"]);
  });

  it("macbook/gaming-laptops/video-consoles produce zero cards — hidden historical rows, not silently resurrected", async () => {
    seedPostMigrationCatalog();

    const res = await callPrices();
    const cards = buildWholesaleWizardCatalog(res.body.equipmentTypes, undefined, res.body.tagLensEquipmentTypes);

    expect(cards.map((c) => c.name)).not.toContain("MacBook");
    expect(cards.map((c) => c.name)).not.toContain("Gaming Laptops");
    expect(cards.map((c) => c.name)).not.toContain("Video Consoles");
  });
});

describe("End-to-end: a brand-new DESK-created equipment type appears as a 9th card with ZERO code changes", () => {
  it("inserting one new wholesale_equipment_types + category + service row via fixture (simulating a real DESK 'create' action) makes it appear as element 9, with the original 8 unchanged — no list in wholesaleWizardCatalog.js, WholesaleWizard.jsx, or this test file needed editing to make this pass", async () => {
    seedPostMigrationCatalog();

    // Simulates a shop owner creating a brand-new card from DESK — a slug
    // that appears NOWHERE else in this file, in wholesaleWizardCatalog.js,
    // or in WholesaleWizard.jsx. If any of those files hardcoded a fixed
    // list of known cards, this would silently fail to appear.
    const droneRepair = seedEquipmentType({ slug: "drone-repair", name: "Drone Repair", sort_order: 9 });
    const droneCat = seedCategory(droneRepair.id, { slug: "drone-gimbal", name: "Gimbal Repair" });
    seedService(droneCat.id, { slug: "drone-gimbal-calibration", name: "Gimbal Calibration" });

    const res = await callPrices();
    const cards = buildWholesaleWizardCatalog(res.body.equipmentTypes, undefined, res.body.tagLensEquipmentTypes);

    expect(cards).toHaveLength(9);
    expect(cards.map((c) => c.name)).toEqual([...APPROVED_ORDER, "Drone Repair"]);
    expect(cards[8].models.map((m) => m.name)).toEqual(["Gimbal Repair"]);
  });
});
