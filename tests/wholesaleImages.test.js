import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeSupabase, mockReq, mockRes } from "./fakeSupabase.js";
import { sha256Hex } from "../api/_lib/wholesaleDb.js";
import pricesHandler from "../api/wholesale-prices.js";

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
  const et = { id: fake.nextId(), slug: "iphone", name: "iPhone", is_tag_lens: false, active: true, sort_order: 0, ...overrides };
  fake.db.wholesale_equipment_types.push(et);
  return et;
}

function seedCategory(equipmentTypeId, overrides = {}) {
  const cat = { id: fake.nextId(), slug: "iphone-screen", name: "iPhone Screens", active: true, sort_order: 0, equipment_type_id: equipmentTypeId, ...overrides };
  fake.db.wholesale_categories.push(cat);
  return cat;
}

function seedService(categoryId, overrides = {}) {
  const sv = { id: fake.nextId(), category_id: categoryId, slug: "screen-repl", name: "Screen Replacement", pricing_type: "fixed", fixed_price: 89, active: true, sort_order: 0, currency: "USD", ...overrides };
  fake.db.wholesale_services.push(sv);
  return sv;
}

function seedImage(owner, overrides = {}) {
  const img = { id: fake.nextId(), storage_path: `equipment-types/${fake.nextId()}.webp`, alt_text: "A cover photo", active: true, sort_order: 0, ...owner, ...overrides };
  fake.db.wholesale_images.push(img);
  return img;
}

async function callPrices(token = "live-session-token") {
  const req = mockReq({ headers: { cookie: `ws_session=${token}` } });
  const res = mockRes();
  await pricesHandler(req, res);
  return res;
}

describe("wholesale-prices images: active image + active owner", () => {
  it("returns a signed URL and alt_text for an Equipment Type's cover photo, never storage_path", async () => {
    seedShopWithSession();
    const et = seedEquipmentType();
    const cat = seedCategory(et.id);
    seedService(cat.id);
    const image = seedImage({ equipment_type_id: et.id });

    const res = await callPrices();

    expect(res.statusCode).toBe(200);
    const returned = res.body.equipmentTypes[0];
    expect(returned.image).not.toBeNull();
    expect(returned.image.url).toContain(image.storage_path);
    expect(returned.image.url).toContain("/storage/v1/object/sign/wholesale-images/");
    expect(returned.image.alt_text).toBe("A cover photo");
    expect(returned.image.storage_path).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("storage_path");
  });

  it("returns a signed URL for a category's own cover photo too, independent of its Equipment Type's photo", async () => {
    seedShopWithSession();
    const et = seedEquipmentType();
    const cat = seedCategory(et.id);
    seedService(cat.id);
    seedImage({ equipment_type_id: et.id });
    const catImage = seedImage({ category_id: cat.id }, { alt_text: "Category photo" });

    const res = await callPrices();

    const returnedCategory = res.body.equipmentTypes[0].categories[0];
    expect(returnedCategory.image.url).toContain(catImage.storage_path);
    expect(returnedCategory.image.alt_text).toBe("Category photo");
  });
});

describe("wholesale-prices images: hidden image + active owner", () => {
  it("an image row with active=false never appears — image is null, not the hidden photo", async () => {
    seedShopWithSession();
    const et = seedEquipmentType();
    const cat = seedCategory(et.id);
    seedService(cat.id);
    seedImage({ equipment_type_id: et.id }, { active: false });

    const res = await callPrices();

    expect(res.body.equipmentTypes[0].image).toBeNull();
  });
});

describe("wholesale-prices images: active image + hidden owner", () => {
  it("a Hidden Equipment Type disappears from the response entirely — its photo is never signed", async () => {
    seedShopWithSession();
    const et = seedEquipmentType({ active: false });
    const cat = seedCategory(et.id);
    seedService(cat.id);
    seedImage({ equipment_type_id: et.id }); // active image, but the owner is hidden

    const res = await callPrices();

    expect(res.body.equipmentTypes).toHaveLength(0);
  });

  it("a Hidden category disappears from its Equipment Type's list entirely — its photo is never signed", async () => {
    seedShopWithSession();
    const et = seedEquipmentType();
    const visibleCat = seedCategory(et.id, { slug: "visible" });
    seedService(visibleCat.id);
    const hiddenCat = seedCategory(et.id, { slug: "hidden", active: false });
    seedService(hiddenCat.id);
    seedImage({ category_id: hiddenCat.id });

    const res = await callPrices();

    const categorySlugs = res.body.equipmentTypes[0].categories.map((c) => c.slug);
    expect(categorySlugs).toEqual(["visible"]);
  });

  it("proves the hidden owner's photo was never even fetched — no batch-sign call happens for a catalog that ends up with zero active images", async () => {
    seedShopWithSession();
    const et = seedEquipmentType({ active: false });
    const cat = seedCategory(et.id);
    seedService(cat.id);
    seedImage({ equipment_type_id: et.id });

    let signCalled = false;
    const originalFetch = fake.fakeFetch;
    vi.stubGlobal("fetch", async (url, options) => {
      if (String(url).includes("/storage/v1/object/sign/")) signCalled = true;
      return originalFetch(url, options);
    });

    await callPrices();

    expect(signCalled).toBe(false);
  });
});

describe("wholesale-prices images: no image row for an owner", () => {
  it("an Equipment Type with zero wholesale_images rows returns image: null (fallback state, distinct from hidden)", async () => {
    seedShopWithSession();
    const et = seedEquipmentType();
    const cat = seedCategory(et.id);
    seedService(cat.id);

    const res = await callPrices();

    expect(res.body.equipmentTypes[0].image).toBeNull();
    expect(res.body.equipmentTypes[0].categories[0].image).toBeNull();
  });
});

describe("wholesale-prices images: signing failures degrade gracefully", () => {
  it("a single image that fails to sign becomes image: null without breaking the rest of the catalog", async () => {
    seedShopWithSession();
    const et = seedEquipmentType();
    const cat = seedCategory(et.id);
    seedService(cat.id);
    const image = seedImage({ equipment_type_id: et.id });
    fake.storagePathsThatFailToSign.add(image.storage_path);

    const res = await callPrices();

    expect(res.statusCode).toBe(200);
    expect(res.body.equipmentTypes[0].image).toBeNull();
    expect(res.body.equipmentTypes[0].categories[0].services[0].name).toBe("Screen Replacement");
  });

  it("the whole batch-sign call failing degrades every image to null but still returns 200 with full pricing data", async () => {
    seedShopWithSession();
    const et = seedEquipmentType();
    const cat = seedCategory(et.id);
    seedService(cat.id);
    seedImage({ equipment_type_id: et.id });
    fake.failStorageSignCompletely();

    const res = await callPrices();

    expect(res.statusCode).toBe(200);
    expect(res.body.equipmentTypes[0].image).toBeNull();
    expect(res.body.equipmentTypes[0].categories[0].services).toHaveLength(1);
  });
});

describe("wholesale-prices images: zero paths skips Storage entirely", () => {
  it("never calls the Storage sign endpoint when the catalog has no active images at all", async () => {
    seedShopWithSession();
    const et = seedEquipmentType();
    const cat = seedCategory(et.id);
    seedService(cat.id);
    // no wholesale_images rows seeded at all

    let signCalled = false;
    const originalFetch = fake.fakeFetch;
    vi.stubGlobal("fetch", async (url, options) => {
      if (String(url).includes("/storage/v1/object/sign/")) signCalled = true;
      return originalFetch(url, options);
    });

    const res = await callPrices();

    expect(res.statusCode).toBe(200);
    expect(signCalled).toBe(false);
  });
});

describe("wholesale-prices images: session gating short-circuits before any Storage/image work", () => {
  it("no session cookie: 401, and the Storage sign endpoint is never invoked", async () => {
    let signCalled = false;
    const originalFetch = fake.fakeFetch;
    vi.stubGlobal("fetch", async (url, options) => {
      if (String(url).includes("/storage/v1/object/sign/")) signCalled = true;
      return originalFetch(url, options);
    });

    const res = mockRes();
    await pricesHandler(mockReq({ headers: {} }), res);

    expect(res.statusCode).toBe(401);
    expect(signCalled).toBe(false);
  });

  it("expired session: 401, and no image data is computed", async () => {
    const shop = { id: fake.nextId(), name: "Acme Repair", status: "active", failed_attempts: 0, locked_until: null, created_at: new Date().toISOString() };
    fake.db.wholesale_shops.push(shop);
    const device = { id: fake.nextId(), shop_id: shop.id, device_token_hash: sha256Hex("device-token"), status: "approved" };
    fake.db.wholesale_devices.push(device);
    fake.db.wholesale_sessions.push({
      id: fake.nextId(),
      shop_id: shop.id,
      device_id: device.id,
      session_token_hash: sha256Hex("expired-token"),
      created_at: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      revoked_at: null,
    });

    const res = await callPrices("expired-token");
    expect(res.statusCode).toBe(401);
    expect(res.body.equipmentTypes).toBeUndefined();
  });

  it("device revoked mid-session: 403, no image work performed", async () => {
    const { device } = seedShopWithSession();
    device.status = "revoked";

    let signCalled = false;
    const originalFetch = fake.fakeFetch;
    vi.stubGlobal("fetch", async (url, options) => {
      if (String(url).includes("/storage/v1/object/sign/")) signCalled = true;
      return originalFetch(url, options);
    });

    const res = await callPrices();
    expect(res.statusCode).toBe(403);
    expect(signCalled).toBe(false);
  });
});

describe("wholesale-prices images: signed URL TTL", () => {
  it("requests exactly a 300-second (5 minute) expiry from Storage's batch-sign endpoint", async () => {
    seedShopWithSession();
    const et = seedEquipmentType();
    const cat = seedCategory(et.id);
    seedService(cat.id);
    seedImage({ equipment_type_id: et.id });

    let capturedExpiresIn = null;
    const originalFetch = fake.fakeFetch;
    vi.stubGlobal("fetch", async (url, options) => {
      if (String(url).includes("/storage/v1/object/sign/")) {
        capturedExpiresIn = JSON.parse(options.body).expiresIn;
      }
      return originalFetch(url, options);
    });

    await callPrices();

    expect(capturedExpiresIn).toBe(300);
  });

  it("signs every active image path in exactly ONE batch call, never one request per image", async () => {
    seedShopWithSession();
    const et = seedEquipmentType();
    const cat1 = seedCategory(et.id, { slug: "cat-1" });
    seedService(cat1.id);
    const cat2 = seedCategory(et.id, { slug: "cat-2" });
    seedService(cat2.id);
    seedImage({ equipment_type_id: et.id });
    seedImage({ category_id: cat1.id });
    seedImage({ category_id: cat2.id });

    let signCallCount = 0;
    let lastPathsLength = 0;
    const originalFetch = fake.fakeFetch;
    vi.stubGlobal("fetch", async (url, options) => {
      if (String(url).includes("/storage/v1/object/sign/")) {
        signCallCount++;
        lastPathsLength = JSON.parse(options.body).paths.length;
      }
      return originalFetch(url, options);
    });

    const res = await callPrices();

    expect(res.statusCode).toBe(200);
    expect(signCallCount).toBe(1);
    expect(lastPathsLength).toBe(3);
  });
});

describe("wholesale-prices images: no hardcoded/public URLs", () => {
  it("every image url in the response points at the signed-object endpoint, never a public/plain object URL", async () => {
    seedShopWithSession();
    const et = seedEquipmentType();
    const cat = seedCategory(et.id);
    seedService(cat.id);
    seedImage({ equipment_type_id: et.id });
    seedImage({ category_id: cat.id });

    const res = await callPrices();

    const urls = [res.body.equipmentTypes[0].image?.url, res.body.equipmentTypes[0].categories[0].image?.url].filter(Boolean);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url).toMatch(/^https:\/\/fake\.supabase\.co\/storage\/v1\/object\/sign\/wholesale-images\//);
      expect(url).not.toMatch(/\/object\/public\//);
    }
  });
});

describe("wholesale-prices images: mobile payload stays minimal", () => {
  it("an image never carries anything beyond { url, alt_text } — no mime_type, size_bytes, uploaded_by, id, sort_order", async () => {
    seedShopWithSession();
    const et = seedEquipmentType();
    const cat = seedCategory(et.id);
    seedService(cat.id);
    seedImage({ equipment_type_id: et.id }, { mime_type: "image/webp", size_bytes: 12345, uploaded_by: "some-admin-id" });

    const res = await callPrices();

    const image = res.body.equipmentTypes[0].image;
    expect(Object.keys(image).sort()).toEqual(["alt_text", "url"]);
  });
});

describe("wholesale-prices images: Equipment Type / category with no active services is excluded", () => {
  it("an Equipment Type whose only category has zero active services never appears, even with a cover photo", async () => {
    seedShopWithSession();
    const et = seedEquipmentType();
    const cat = seedCategory(et.id);
    seedService(cat.id, { active: false }); // the only service is inactive
    seedImage({ equipment_type_id: et.id });

    const res = await callPrices();

    expect(res.body.equipmentTypes).toHaveLength(0);
  });

  it("a category with equipment_type_id = null (defensive edge case) is excluded rather than crashing", async () => {
    seedShopWithSession();
    const et = seedEquipmentType();
    const orphanCat = seedCategory(null, { slug: "orphan" });
    seedService(orphanCat.id);

    const res = await callPrices();

    expect(res.statusCode).toBe(200);
    expect(res.body.equipmentTypes).toHaveLength(0);
  });
});

describe("Microsoldering: catalog_mode='direct_services', a plain member of equipmentTypes[] with its own directly-owned services — never a tag-based aggregation of some OTHER equipment type's category", () => {
  function seedMicrosolderingType(overrides = {}) {
    return seedEquipmentType({
      slug: "microsoldering", name: "Microsoldering", catalog_mode: "direct_services",
      sort_order: 1, ...overrides,
    });
  }
  function microCard(res) {
    return res.body.equipmentTypes.find((e) => e.slug === "microsoldering");
  }

  it("appears in equipmentTypes[] once its own (DESK-managed, internal) category has at least one active service — a plain member, own catalog_mode, no separate response channel", async () => {
    seedShopWithSession();
    const microType = seedMicrosolderingType();
    const cat = seedCategory(microType.id, { slug: "microsoldering-direct", name: "Microsoldering" });
    seedService(cat.id, { name: "Board Repair" });

    const res = await callPrices();

    expect(res.body.equipmentTypes.map((e) => e.slug)).toContain("microsoldering");
    expect(microCard(res).catalog_mode).toBe("direct_services");
    // The TEMPORARY legacy compatibility key is still present alongside the
    // unified card (see tests/wholesaleDynamicEquipmentTypesApi.test.js for
    // dedicated coverage of that key).
    expect(res.body.microsoldering).toBeTruthy();
  });

  it("a grouped equipment type (e.g. iPhone) reports catalog_mode='grouped' — the default, unaffected by Microsoldering existing alongside it", async () => {
    seedShopWithSession();
    const et = seedEquipmentType({ slug: "iphone", name: "iPhone" });
    const cat = seedCategory(et.id);
    seedService(cat.id);

    const res = await callPrices();

    expect(res.body.equipmentTypes.find((e) => e.slug === "iphone").catalog_mode).toBe("grouped");
  });

  it("an active service appears under Microsoldering's own real category id/slug/name — the same real category row, never recreated, never nested under any other equipment type", async () => {
    seedShopWithSession();
    const microType = seedMicrosolderingType();
    const cat = seedCategory(microType.id, { slug: "microsoldering-direct", name: "Microsoldering" });
    seedService(cat.id, { name: "Board-level micro-soldering repair" });

    const res = await callPrices();

    const card = microCard(res);
    expect(card.categories).toHaveLength(1);
    expect(card.categories[0].id).toBe(cat.id);
    expect(card.categories[0].slug).toBe("microsoldering-direct");
    expect(card.categories[0].services[0].name).toBe("Board-level micro-soldering repair");
  });

  it("an inactive service never appears — and with nothing else active, Microsoldering produces no card at all (same 'hide if empty' rule as any other equipment type)", async () => {
    seedShopWithSession();
    const microType = seedMicrosolderingType();
    const cat = seedCategory(microType.id);
    seedService(cat.id, { active: false });

    const res = await callPrices();

    expect(microCard(res)).toBeUndefined();
  });

  it("a service under a Hidden category never appears — Microsoldering produces no card when that was its only category", async () => {
    seedShopWithSession();
    const microType = seedMicrosolderingType();
    const cat = seedCategory(microType.id, { active: false });
    seedService(cat.id);

    const res = await callPrices();

    expect(microCard(res)).toBeUndefined();
  });

  it("no category added yet from DESK (fresh, nothing added): Microsoldering produces no card — never an empty-but-present one", async () => {
    seedShopWithSession();
    seedMicrosolderingType();

    const res = await callPrices();

    expect(microCard(res)).toBeUndefined();
  });

  it("Microsoldering equipment type itself hidden: absent from equipmentTypes[] — no card renders at all, exactly like any other hidden equipment type", async () => {
    seedShopWithSession();
    const microType = seedMicrosolderingType({ active: false });
    const cat = seedCategory(microType.id);
    seedService(cat.id);

    const res = await callPrices();

    expect(microCard(res)).toBeUndefined();
  });

  it("no Microsoldering equipment type row exists at all (fresh/incomplete environment): absent, no crash", async () => {
    seedShopWithSession();
    const et = seedEquipmentType({ slug: "iphone" });
    const cat = seedCategory(et.id);
    seedService(cat.id);

    const res = await callPrices();

    expect(res.statusCode).toBe(200);
    expect(microCard(res)).toBeUndefined();
  });

  it("Microsoldering's own cover photo is signed and gated exactly like any other Equipment Type's photo", async () => {
    seedShopWithSession();
    const microType = seedMicrosolderingType();
    const image = seedImage({ equipment_type_id: microType.id });
    const cat = seedCategory(microType.id);
    seedService(cat.id);

    const res = await callPrices();

    const card = microCard(res);
    expect(card.image).not.toBeNull();
    expect(card.image.url).toContain(image.storage_path);
  });

  it("a Microsoldering SERVICE's own per-service photo is signed and returned on the service object itself — new capability, same signing/gating as equipment-type and category photos", async () => {
    seedShopWithSession();
    const microType = seedMicrosolderingType();
    const cat = seedCategory(microType.id);
    const service = seedService(cat.id, { name: "Charging Port Soldering" });
    const image = seedImage({ service_id: service.id });

    const res = await callPrices();

    const returnedService = microCard(res).categories[0].services[0];
    expect(returnedService.image).not.toBeNull();
    expect(returnedService.image.url).toContain(image.storage_path);
  });

  it("a Microsoldering service with no photo of its own returns image: null, never a broken/undefined value", async () => {
    seedShopWithSession();
    const microType = seedMicrosolderingType();
    const cat = seedCategory(microType.id);
    seedService(cat.id);

    const res = await callPrices();

    expect(microCard(res).categories[0].services[0].image).toBeNull();
  });
});

describe("regression: existing flat-catalog auth/session behavior is untouched", () => {
  it("wholesale_shops/devices/sessions gating logic is unaffected by the equipment-type/image response reshape", async () => {
    const { shop } = seedShopWithSession();
    shop.status = "blocked";

    const res = await callPrices();
    expect(res.statusCode).toBe(403);
  });
});
