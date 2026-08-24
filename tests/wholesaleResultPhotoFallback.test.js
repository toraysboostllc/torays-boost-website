import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeSupabase, mockReq, mockRes } from "./fakeSupabase.js";
import { sha256Hex } from "../api/_lib/wholesaleDb.js";
import pricesHandler from "../api/wholesale-prices.js";
import { buildWholesaleWizardCatalog } from "../src/lib/wholesaleWizardCatalog.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Reported bug: a photo uploaded from TORAYS BOOST DESK ("Upload Photo")
 * appeared as uploaded in DESK and even showed as that card's cover photo
 * on the Wholesale Portal's selection screens, but never appeared on the
 * "Pricing Ready" result screen (below "Check another price") unless it had
 * specifically been uploaded at the SERVICE level. Microsoldering always
 * worked because its content is organized AS services directly
 * (catalog_mode='direct_services'), so its photo naturally landed at the
 * service level. PlayStation 5 (and any other equipment type where DESK
 * naturally uploads one representative photo at the Category or Equipment
 * Type level, e.g. "a photo of the PS5 console itself", rather than one
 * photo per individual repair line like "HDMI Port Replacement") never
 * showed its photo in the result panel at all.
 *
 * Root cause: WholesaleResultPanel.jsx read ONLY service.image, with no
 * fallback to the category's or equipment type's own cover photo — both of
 * which the server already resolves and signs (buildWholesaleCatalog in
 * api/_lib/wholesaleDb.js), and both of which were already flowing all the
 * way into WholesaleWizard.jsx's selectedModel/selectedEquipo state (used
 * elsewhere for the card grids) but were never threaded into the result
 * panel's `selection` prop.
 *
 * Fix: WholesaleWizard.jsx now also passes selection.modelImage/equipoImage
 * (selectedModel.image/selectedEquipo.image — already-resolved data, no new
 * fetch), and WholesaleResultPanel.jsx computes
 * `photo = service.image || selection.modelImage || selection.equipoImage`.
 * No hardcoded owner/slug, no new Storage/DB call, no security change — a
 * pure display-priority fallback over data the server already signs and
 * gates the exact same way (Hidden equipment type/category/image never
 * reaches this response to begin with — see buildWholesaleCatalog's own
 * header).
 *
 * Part A: real end-to-end tests through the ACTUAL server handler
 * (api/wholesale-prices.js -> buildWholesaleCatalog) and the ACTUAL client
 * adapter (buildWholesaleWizardCatalog) -- only the PostgREST/Storage HTTP
 * boundary is faked (see tests/fakeSupabase.js). Mirrors the fixture style
 * of tests/wholesaleEndToEndCardOrder.test.js.
 * Part B: structural coverage of the actual wiring in both files, since a
 * real @testing-library render of the full wizard-to-result click-through
 * would require a much larger harness than this bug fix needs.
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
    id: fake.nextId(), shop_id: shop.id, device_id: device.id, session_token_hash: sha256Hex(token),
    created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString(), revoked_at: null,
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
/** ownerKey: "equipment_type_id" | "category_id" | "service_id". */
function seedImage(ownerKey, ownerId, overrides = {}) {
  const img = {
    id: fake.nextId(), equipment_type_id: null, category_id: null, service_id: null,
    [ownerKey]: ownerId, storage_path: `owner/${ownerId}.webp`, alt_text: null, active: true, ...overrides,
  };
  fake.db.wholesale_images.push(img);
  return img;
}
async function callPrices(token = "live-session-token") {
  const req = mockReq({ headers: { cookie: `ws_session=${token}` } });
  const res = mockRes();
  await pricesHandler(req, res);
  return res;
}
/** Runs the exact same 2-step pipeline the real portal does: server
 *  response -> client adapter -- returns the wizard's flat Equipo list. */
async function buildCards() {
  const res = await callPrices();
  expect(res.statusCode).toBe(200);
  return buildWholesaleWizardCatalog(res.body.equipmentTypes, undefined, res.body.microsolderingEquipmentType);
}

describe("Functional case (matches Microsoldering today): a service-level photo resolves through the real pipeline", () => {
  it("Microsoldering's own service photo comes through as service.image, unaffected by this fix", async () => {
    seedShopWithSession();
    const microsoldering = seedEquipmentType({ slug: "microsoldering", name: "Microsoldering", catalog_mode: "direct_services", sort_order: 1 });
    const microCat = seedCategory(microsoldering.id, { slug: "microsoldering-direct", name: "Microsoldering" });
    const microService = seedService(microCat.id, { slug: "microsoldering-charging-port", name: "Charging Port Soldering" });
    seedImage("service_id", microService.id, { alt_text: "Microsoldering bench photo" });

    const cards = await buildCards();
    const service = cards.find((c) => c.name === "Microsoldering").models[0].services[0];
    expect(service.image).toEqual({ url: expect.stringContaining("owner/"), alt_text: "Microsoldering bench photo" });
  });
});

describe("Previously failing case: PS5 with ONLY a Category-level photo (no service-level photo)", () => {
  it("the service itself has image: null, but the category (and therefore the fallback chain) carries the real photo", async () => {
    seedShopWithSession();
    const ps5 = seedEquipmentType({ slug: "ps5", name: "PlayStation 5", sort_order: 6 });
    const ps5Cat = seedCategory(ps5.id, { slug: "ps5", name: "PlayStation 5" });
    seedImage("category_id", ps5Cat.id, { alt_text: "PlayStation 5 console" });
    const ps5Service = seedService(ps5Cat.id, { slug: "ps5-hdmi", name: "HDMI Port Replacement" });
    // Deliberately NO seedImage for the service itself — this is the exact
    // reported scenario: DESK uploaded one photo at the Category level.

    const cards = await buildCards();
    const model = cards.find((c) => c.name === "PlayStation 5").models[0];
    const service = model.services[0];

    expect(service.image).toBeNull(); // confirmed: the service itself really has none
    expect(model.image).toEqual({ url: expect.stringContaining("owner/"), alt_text: "PlayStation 5 console" }); // the fallback source
  });
});

describe("Previously failing case, one level further: PS5 with ONLY an Equipment-Type-level photo (no category, no service photo)", () => {
  it("neither the service nor its category has a photo, but the equipment type does", async () => {
    seedShopWithSession();
    const ps5 = seedEquipmentType({ slug: "ps5", name: "PlayStation 5", sort_order: 6 });
    seedImage("equipment_type_id", ps5.id, { alt_text: "PlayStation 5 hero shot" });
    const ps5Cat = seedCategory(ps5.id, { slug: "ps5", name: "PlayStation 5" });
    seedService(ps5Cat.id, { slug: "ps5-hdmi", name: "HDMI Port Replacement" });

    const cards = await buildCards();
    const card = cards.find((c) => c.name === "PlayStation 5");
    const model = card.models[0];
    const service = model.services[0];

    expect(service.image).toBeNull();
    expect(model.image).toBeNull();
    expect(card.image).toEqual({ url: expect.stringContaining("owner/"), alt_text: "PlayStation 5 hero shot" });
  });
});

describe("No photo at any of the 3 levels: stays null all the way through, matching ServicePhoto's own render-nothing contract", () => {
  it("service.image, model.image, and the card's own image are all null", async () => {
    seedShopWithSession();
    const xbox = seedEquipmentType({ slug: "xbox-series-x", name: "Xbox Series X", sort_order: 7 });
    const xboxCat = seedCategory(xbox.id, { slug: "xbox-series-x", name: "Xbox Series X" });
    seedService(xboxCat.id, { slug: "xbox-hdmi", name: "HDMI Port Replacement" });

    const cards = await buildCards();
    const card = cards.find((c) => c.name === "Xbox Series X");
    expect(card.image).toBeNull();
    expect(card.models[0].image).toBeNull();
    expect(card.models[0].services[0].image).toBeNull();
  });
});

describe("Precedence: service-level photo always wins over category/equipment-type photos when more than one exists", () => {
  it("all three levels have a photo -- the service's own is the one that must be used", async () => {
    seedShopWithSession();
    const ps5 = seedEquipmentType({ slug: "ps5", name: "PlayStation 5", sort_order: 6 });
    seedImage("equipment_type_id", ps5.id, { alt_text: "Equipment type photo" });
    const ps5Cat = seedCategory(ps5.id, { slug: "ps5", name: "PlayStation 5" });
    seedImage("category_id", ps5Cat.id, { alt_text: "Category photo" });
    const ps5Service = seedService(ps5Cat.id, { slug: "ps5-hdmi", name: "HDMI Port Replacement" });
    seedImage("service_id", ps5Service.id, { alt_text: "Service photo" });

    const cards = await buildCards();
    const service = cards.find((c) => c.name === "PlayStation 5").models[0].services[0];
    expect(service.image.alt_text).toBe("Service photo");
  });

  it("category photo wins over equipment-type photo when the service itself has none", async () => {
    seedShopWithSession();
    const ps5 = seedEquipmentType({ slug: "ps5", name: "PlayStation 5", sort_order: 6 });
    seedImage("equipment_type_id", ps5.id, { alt_text: "Equipment type photo" });
    const ps5Cat = seedCategory(ps5.id, { slug: "ps5", name: "PlayStation 5" });
    seedImage("category_id", ps5Cat.id, { alt_text: "Category photo" });
    seedService(ps5Cat.id, { slug: "ps5-hdmi", name: "HDMI Port Replacement" });

    const cards = await buildCards();
    const model = cards.find((c) => c.name === "PlayStation 5").models[0];
    expect(model.image.alt_text).toBe("Category photo");
  });
});

describe("A Hidden (inactive) photo at any level is never used as a fallback, exactly like today's service-level gating", () => {
  it("an inactive category photo never appears, even with no service photo present", async () => {
    seedShopWithSession();
    const ps5 = seedEquipmentType({ slug: "ps5", name: "PlayStation 5", sort_order: 6 });
    const ps5Cat = seedCategory(ps5.id, { slug: "ps5", name: "PlayStation 5" });
    seedImage("category_id", ps5Cat.id, { alt_text: "Hidden photo", active: false });
    seedService(ps5Cat.id, { slug: "ps5-hdmi", name: "HDMI Port Replacement" });

    const cards = await buildCards();
    const model = cards.find((c) => c.name === "PlayStation 5").models[0];
    expect(model.image).toBeNull();
  });
});

// -------------------------------------------------------------------------
// Part B: structural coverage of the actual wiring, same approach as the
// rest of this suite (no JSX render harness needed for this fix).
// -------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const wizardSrc = readFileSync(join(__dirname, "..", "src", "components", "wholesale", "WholesaleWizard.jsx"), "utf8");
const panelSrc = readFileSync(join(__dirname, "..", "src", "components", "wholesale", "WholesaleResultPanel.jsx"), "utf8");

describe("Structural: WholesaleWizard.jsx threads selectedModel/selectedEquipo images into selection, never a new fetch", () => {
  it("passes modelImage from selectedModel.image and equipoImage from selectedEquipo.image", () => {
    expect(wizardSrc).toContain("modelImage: selectedModel?.image ?? null,");
    expect(wizardSrc).toContain("equipoImage: selectedEquipo?.image ?? null,");
  });
});

describe("Structural: WholesaleResultPanel.jsx computes the 3-level fallback and renders it instead of a bare service.image check", () => {
  it("computes photo = service.image || selection.modelImage || selection.equipoImage", () => {
    expect(panelSrc).toContain("const photo = service.image || selection.modelImage || selection.equipoImage || null;");
  });

  it("the render guard and the ServicePhoto call both use `photo`, not the old bare `service.image`", () => {
    expect(panelSrc).toContain("{photo && (");
    expect(panelSrc).toContain("image={photo}");
    expect(panelSrc).toContain("alt={photo?.alt_text || translateServiceName(service, language)}");
  });
});
