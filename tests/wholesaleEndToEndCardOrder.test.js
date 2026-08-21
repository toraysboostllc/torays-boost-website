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
 * The fixture below represents the catalog AFTER
 * wholesale-catalog-architecture-fix-migration.sql has run on top of the
 * (already-executed, now-corrected) dynamic-equipment-types migration: 9
 * exterior cards — MacBook restored as its own independent card (never
 * merged into Laptops), Laptops keeps Standard + Gaming as its own two
 * models, and Microsoldering is catalog_mode='direct_services' with its
 * own directly-owned services (never an aggregation of iPhone/iPad/PS5/
 * Xbox/Switch/Controllers content via a tag).
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
  const et = { id: fake.nextId(), catalog_mode: "grouped", active: true, sort_order: 0, ...overrides };
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

/** Seeds the exact post-catalog-architecture-fix catalog: 9 approved cards
 *  + hidden historical rows. Returns the ids the caller needs for the
 *  10th-card tests. */
function seedFixedCatalog() {
  seedShopWithSession();

  // 1. Microsoldering — catalog_mode='direct_services', its own single
  //    (DESK-managed) category holding directly-owned services. NEVER a
  //    tag, NEVER a service borrowed from another equipment type.
  const microsoldering = seedEquipmentType({
    slug: "microsoldering", name: "Microsoldering", catalog_mode: "direct_services", sort_order: 1,
  });
  const microCat = seedCategory(microsoldering.id, { slug: "microsoldering-direct", name: "Microsoldering" });
  seedService(microCat.id, { slug: "microsoldering-charging-port", name: "Charging Port Soldering" });

  // 2. iPhone
  const iphone = seedEquipmentType({ slug: "iphone", name: "iPhone", sort_order: 2 });
  const iphoneCat = seedCategory(iphone.id, { slug: "iphone-15-17", name: "iPhone 15/16/17" });
  seedService(iphoneCat.id, { slug: "iphone-board-repair", name: "Board Repair" });

  // 3. iPad
  const ipad = seedEquipmentType({ slug: "ipad", name: "iPad", sort_order: 3 });
  const ipadCat = seedCategory(ipad.id, { slug: "ipad-pro", name: "iPad Pro" });
  seedService(ipadCat.id, { slug: "ipad-screen-repl", name: "Screen Replacement" });

  // 4. MacBook — restored as its OWN independent card (never merged into
  //    Laptops), carrying macbook-air/macbook-pro as its two models.
  const macbook = seedEquipmentType({ slug: "macbook", name: "MacBook", name_es: "MacBook", sort_order: 4 });
  const macbookAir = seedCategory(macbook.id, { slug: "macbook-air", name: "MacBook Air" });
  seedService(macbookAir.id, { slug: "macbook-air-battery", name: "Battery Replacement" });
  const macbookPro = seedCategory(macbook.id, { slug: "macbook-pro", name: "MacBook Pro" });
  seedService(macbookPro.id, { slug: "macbook-pro-logic-board", name: "Logic Board Repair" });

  // 5. Laptops — its OWN independent card, separate from MacBook, carrying
  //    Standard + Gaming as its two models.
  const laptops = seedEquipmentType({ slug: "laptops", name: "Laptops", name_es: "Laptops", sort_order: 5 });
  const laptopsStandard = seedCategory(laptops.id, { slug: "laptops-normal", name: "Laptops (Standard)" });
  seedService(laptopsStandard.id, { slug: "laptops-standard-no-power", name: "No Power" });
  const laptopsGaming = seedCategory(laptops.id, { slug: "laptops-gamer", name: "Gaming Laptops" });
  seedService(laptopsGaming.id, { slug: "laptops-gaming-fan-repl", name: "Fan Replacement" });

  // 6-8. PS5 / Xbox Series X / Switch — real top-level equipment types,
  //    each with their own same-slug category.
  const ps5 = seedEquipmentType({ slug: "ps5", name: "PlayStation 5", sort_order: 6 });
  const ps5Cat = seedCategory(ps5.id, { slug: "ps5", name: "PlayStation 5" });
  seedService(ps5Cat.id, { slug: "ps5-hdmi", name: "HDMI Port Replacement" });

  const xbox = seedEquipmentType({ slug: "xbox-series-x", name: "Xbox Series X", sort_order: 7 });
  const xboxCat = seedCategory(xbox.id, { slug: "xbox-series-x", name: "Xbox Series X" });
  seedService(xboxCat.id, { slug: "xbox-hdmi", name: "HDMI Port Replacement" });

  const switchEt = seedEquipmentType({ slug: "switch", name: "Nintendo Switch / Switch OLED", sort_order: 8 });
  const switchCat = seedCategory(switchEt.id, { slug: "switch", name: "Nintendo Switch / Switch OLED" });
  seedService(switchCat.id, { slug: "switch-joycon", name: "Joy-Con Drift Repair" });

  // 9. Controllers
  const controllers = seedEquipmentType({ slug: "controllers", name: "Controllers", sort_order: 9 });
  const controllersCat = seedCategory(controllers.id, { slug: "ps5-dualsense", name: "DualSense" });
  seedService(controllersCat.id, { slug: "dualsense-stick-drift", name: "Stick Drift Repair" });

  // Hidden, historical, never-deleted rows — must produce ZERO cards and
  // ZERO interference. gaming-laptops is now genuinely empty (laptops-gamer
  // moved to 'laptops' above — see wholesale-catalog-architecture-fix-
  // migration.sql's own header for why that re-point was needed).
  seedEquipmentType({ slug: "gaming-laptops", name: "Gaming Laptops", active: false, sort_order: 102 });
  seedEquipmentType({ slug: "video-consoles", name: "Video Consoles", active: false, sort_order: 103 });

  return { microsoldering, iphone, ipad, macbook, laptops, ps5, xbox, switchEt, controllers };
}

const APPROVED_ORDER = [
  "Microsoldering",
  "iPhone",
  "iPad",
  "MacBook",
  "Laptops",
  "PlayStation 5",
  "Xbox Series X",
  "Nintendo Switch / Switch OLED",
  "Controllers",
];

describe("End-to-end: real server (buildWholesaleCatalog) -> real client (buildWholesaleWizardCatalog), corrected 9-card catalog", () => {
  it("produces exactly the 9 approved cards, in exactly the approved order, matching the owner's exact array — Microsoldering included as a normal card, not a special case", async () => {
    seedFixedCatalog();

    const res = await callPrices();
    expect(res.statusCode).toBe(200);

    const cards = buildWholesaleWizardCatalog(res.body.equipmentTypes, undefined, res.body.microsolderingEquipmentType);

    expect(cards.map((c) => c.name)).toEqual(APPROVED_ORDER);
  });

  it("no duplicate ids or slugs anywhere in the final card list", async () => {
    seedFixedCatalog();

    const res = await callPrices();
    const cards = buildWholesaleWizardCatalog(res.body.equipmentTypes, undefined, res.body.microsolderingEquipmentType);

    const ids = cards.map((c) => c.id);
    const slugs = cards.map((c) => c.slug);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("MacBook's models are exactly MacBook Air and MacBook Pro — never mixed with Laptops", async () => {
    seedFixedCatalog();

    const res = await callPrices();
    const cards = buildWholesaleWizardCatalog(res.body.equipmentTypes, undefined, res.body.microsolderingEquipmentType);

    const macbookCard = cards.find((c) => c.name === "MacBook");
    expect(macbookCard.models.map((m) => m.name).sort()).toEqual(["MacBook Air", "MacBook Pro"]);
  });

  it("Laptops' models are exactly Laptops (Standard) and Gaming Laptops — never mixed with MacBook", async () => {
    seedFixedCatalog();

    const res = await callPrices();
    const cards = buildWholesaleWizardCatalog(res.body.equipmentTypes, undefined, res.body.microsolderingEquipmentType);

    const laptopsCard = cards.find((c) => c.name === "Laptops");
    expect(laptopsCard.models.map((m) => m.name).sort()).toEqual(["Gaming Laptops", "Laptops (Standard)"]);
  });

  it("Microsoldering's own model is its own directly-owned service — never iPhone, iPad, PS5, Xbox, Switch, or Controllers content", async () => {
    seedFixedCatalog();

    const res = await callPrices();
    const cards = buildWholesaleWizardCatalog(res.body.equipmentTypes, undefined, res.body.microsolderingEquipmentType);

    const microCard = cards.find((c) => c.name === "Microsoldering");
    expect(microCard.isDirectServices).toBe(true);
    expect(microCard.models).toHaveLength(1);
    expect(microCard.models[0].name).toBe("Microsoldering");
    expect(microCard.models[0].services.map((s) => s.name)).toEqual(["Charging Port Soldering"]);
  });

  it("no iPhone/iPad/MacBook/Laptops/PS5/Xbox/Switch/Controllers device or service name ever appears anywhere inside the Microsoldering card", async () => {
    seedFixedCatalog();

    const res = await callPrices();
    const cards = buildWholesaleWizardCatalog(res.body.equipmentTypes, undefined, res.body.microsolderingEquipmentType);

    const microCard = cards.find((c) => c.name === "Microsoldering");
    const allText = JSON.stringify(microCard);
    for (const forbidden of ["iPhone", "iPad", "MacBook", "Laptops", "PlayStation", "Xbox", "Switch", "DualSense", "Controllers"]) {
      expect(allText).not.toContain(forbidden);
    }
  });

  it("gaming-laptops/video-consoles produce zero cards — hidden historical rows, not silently resurrected", async () => {
    seedFixedCatalog();

    const res = await callPrices();
    const cards = buildWholesaleWizardCatalog(res.body.equipmentTypes, undefined, res.body.microsolderingEquipmentType);

    expect(cards.map((c) => c.name)).not.toContain("Gaming Laptops");
    expect(cards.map((c) => c.name)).not.toContain("Video Consoles");
  });
});

describe("End-to-end: a brand-new DESK-created GROUPED equipment type appears as a 10th card with ZERO code changes", () => {
  it("inserting one new wholesale_equipment_types (catalog_mode='grouped') + category + service row via fixture (simulating a real DESK 'create' action) makes it appear as element 10, with the original 9 unchanged — no list in wholesaleWizardCatalog.js, WholesaleWizard.jsx, or this test file needed editing to make this pass", async () => {
    seedFixedCatalog();

    // Simulates a shop owner creating a brand-new GROUPED card from DESK —
    // a slug that appears NOWHERE else in this file, in
    // wholesaleWizardCatalog.js, or in WholesaleWizard.jsx. If any of those
    // files hardcoded a fixed list of known cards, this would silently
    // fail to appear.
    const droneRepair = seedEquipmentType({ slug: "drone-repair", name: "Drone Repair", sort_order: 10 });
    const droneCat = seedCategory(droneRepair.id, { slug: "drone-gimbal", name: "Gimbal Repair" });
    seedService(droneCat.id, { slug: "drone-gimbal-calibration", name: "Gimbal Calibration" });

    const res = await callPrices();
    const cards = buildWholesaleWizardCatalog(res.body.equipmentTypes, undefined, res.body.microsolderingEquipmentType);

    expect(cards).toHaveLength(10);
    expect(cards.map((c) => c.name)).toEqual([...APPROVED_ORDER, "Drone Repair"]);
    expect(cards[9].models.map((m) => m.name)).toEqual(["Gimbal Repair"]);
  });
});

describe("End-to-end: a brand-new DESK-created DIRECT_SERVICES equipment type appears with ZERO code changes", () => {
  it("inserting one new wholesale_equipment_types (catalog_mode='direct_services') + its own internal category + service row makes it appear as a normal card with a flat, single-model service list — same pipeline as Microsoldering, zero special-cased code", async () => {
    seedFixedCatalog();

    const dataRecovery = seedEquipmentType({ slug: "data-recovery-direct", name: "Data Recovery", catalog_mode: "direct_services", sort_order: 11 });
    const drCat = seedCategory(dataRecovery.id, { slug: "data-recovery-direct-internal", name: "Data Recovery" });
    seedService(drCat.id, { slug: "data-recovery-hdd-recovery", name: "HDD Recovery" });

    const res = await callPrices();
    const cards = buildWholesaleWizardCatalog(res.body.equipmentTypes, undefined, res.body.microsolderingEquipmentType);

    expect(cards).toHaveLength(10);
    const drCard = cards.find((c) => c.slug === "data-recovery-direct");
    expect(drCard).toBeTruthy();
    expect(drCard.isDirectServices).toBe(true);
    expect(drCard.models).toHaveLength(1);
    expect(drCard.models[0].services.map((s) => s.name)).toEqual(["HDD Recovery"]);
  });
});
