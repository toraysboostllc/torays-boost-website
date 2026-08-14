import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeSupabase } from "./fakeSupabase.js";
import { WHOLESALE_CATALOG_SEED } from "../scripts/wholesaleCatalogSeed.data.js";
import { seedWholesaleCatalog } from "../scripts/wholesaleCatalogSeed.js";
import { listActiveCatalog, getEnv } from "../api/_lib/wholesaleDb.js";

let fake;
const ENV = { supabaseUrl: "https://fake.supabase.co", serviceKey: "fake-service-role-key" };

beforeEach(() => {
  fake = createFakeSupabase();
});

function findService(slug) {
  for (const cat of WHOLESALE_CATALOG_SEED) {
    const s = cat.services.find((sv) => sv.slug === slug);
    if (s) return s;
  }
  return null;
}

describe("catalog data shape", () => {
  it("has exactly the 21 categories and 74 services described", () => {
    expect(WHOLESALE_CATALOG_SEED).toHaveLength(21);
    const totalServices = WHOLESALE_CATALOG_SEED.reduce((sum, c) => sum + c.services.length, 0);
    expect(totalServices).toBe(74);
  });

  it("includes the two diagnostic-only categories with zero services", () => {
    const normal = WHOLESALE_CATALOG_SEED.find((c) => c.slug === "laptops-normal");
    const gamer = WHOLESALE_CATALOG_SEED.find((c) => c.slug === "laptops-gamer");
    expect(normal.services).toHaveLength(0);
    expect(gamer.services).toHaveLength(0);
  });

  it("every slug (category and service) is unique", () => {
    const catSlugs = WHOLESALE_CATALOG_SEED.map((c) => c.slug);
    expect(new Set(catSlugs).size).toBe(catSlugs.length);

    const svcSlugs = WHOLESALE_CATALOG_SEED.flatMap((c) => c.services.map((s) => s.slug));
    expect(new Set(svcSlugs).size).toBe(svcSlugs.length);
  });
});

describe("specific fixed and range values", () => {
  it.each([
    ["iphone-7-11__no-power", "range", 70, 90],
    ["iphone-12-14__no-power", "range", 90, 120],
    ["iphone-15-17__save-data-recovery", "range", 200, 250],
    ["ipad-10__no-power", "range", 90, 120],
    ["macbook-air__board-repair", "range", 100, 120],
    ["macbook-pro__board-repair", "range", 120, 180],
    ["ps5__no-power-board", "range", 120, 150],
    ["switch__no-power-board", "range", 70, 90],
  ])("%s is a %s of $%s–$%s", (slug, type, min, max) => {
    const s = findService(slug);
    expect(s.pricingType).toBe("range");
    expect(s.priceMin).toBe(min);
    expect(s.priceMax).toBe(max);
  });

  it.each([
    ["iphone-7-11__no-wifi-bt-board", 80],
    ["iphone-15-17__no-power", 150],
    ["ipad-11__charging-ic-no-charge", 150],
    ["ipad-11__no-power", 90],
    ["ps5__hdmi-board-level", 80],
    ["ps5__hdmi-board-only", 45],
    ["xbox-series-x__hdmi-board-level", 90],
  ])("%s is a fixed $%s", (slug, amount) => {
    const s = findService(slug);
    expect(s.pricingType).toBe("fixed");
    expect(s.fixedPrice).toBe(amount);
  });

  it("iPad 11 No Power carries the Charging IC clarification note", () => {
    const s = findService("ipad-11__no-power");
    expect(s.notes).toMatch(/\$150/);
  });

  it("PS5 board-only HDMI carries the no-guarantee note", () => {
    const s = findService("ps5__hdmi-board-only");
    expect(s.notes).toMatch(/No guarantee/i);
  });
});

describe("category-level notes (ATA / Level 3 Repair)", () => {
  const iphone1517 = WHOLESALE_CATALOG_SEED.find((c) => c.slug === "iphone-15-17");

  it("lives once, on the category — not on any of its services", () => {
    expect(iphone1517.notes).toBe("ATA / Level 3 Repair");
  });

  it("is not duplicated onto the 5 services in that category", () => {
    expect(iphone1517.services).toHaveLength(5);
    for (const s of iphone1517.services) {
      expect(s.notes).toBeNull();
    }
  });

  it("other categories have no notes by default", () => {
    const ps5 = WHOLESALE_CATALOG_SEED.find((c) => c.slug === "ps5");
    expect(ps5.notes).toBeNull();
  });
});

describe("thumbstick cap add-on ($5) across all 4 controllers", () => {
  it.each(["ps5-dualsense", "ps5-dualsense-edge", "xbox-controller", "xbox-elite-2"])(
    "%s has a $5 fixed thumbstick-cap-addon service",
    (categorySlug) => {
      const cat = WHOLESALE_CATALOG_SEED.find((c) => c.slug === categorySlug);
      const addon = cat.services.find((s) => s.slug.endsWith("thumbstick-cap-addon"));
      expect(addon).toBeTruthy();
      expect(addon.pricingType).toBe("fixed");
      expect(addon.fixedPrice).toBe(5);
    }
  );
});

describe("seeding against the database", () => {
  it("creates every row inactive", async () => {
    await seedWholesaleCatalog({ ...ENV, fetchImpl: fake.fakeFetch });
    expect(fake.db.wholesale_categories.length).toBeGreaterThan(0);
    expect(fake.db.wholesale_categories.every((c) => c.active === false)).toBe(true);
    expect(fake.db.wholesale_services.length).toBeGreaterThan(0);
    expect(fake.db.wholesale_services.every((s) => s.active === false)).toBe(true);
  });

  it("persists the category-level ATA note into the database row", async () => {
    await seedWholesaleCatalog({ ...ENV, fetchImpl: fake.fakeFetch });
    const cat = fake.db.wholesale_categories.find((c) => c.slug === "iphone-15-17");
    expect(cat.notes).toBe("ATA / Level 3 Repair");
    const services = fake.db.wholesale_services.filter((s) => s.slug.startsWith("iphone-15-17__"));
    expect(services.every((s) => s.notes === null)).toBe(true);
  });

  it("creates exactly 21 categories and 74 services on a fresh database", async () => {
    const summary = await seedWholesaleCatalog({ ...ENV, fetchImpl: fake.fakeFetch });
    expect(summary.categoriesCreated).toBe(21);
    expect(summary.servicesCreated).toBe(74);
    expect(fake.db.wholesale_categories).toHaveLength(21);
    expect(fake.db.wholesale_services).toHaveLength(74);
  });

  it("is idempotent — running twice creates nothing new the second time", async () => {
    await seedWholesaleCatalog({ ...ENV, fetchImpl: fake.fakeFetch });
    const countCategoriesAfterFirst = fake.db.wholesale_categories.length;
    const countServicesAfterFirst = fake.db.wholesale_services.length;

    const secondRun = await seedWholesaleCatalog({ ...ENV, fetchImpl: fake.fakeFetch });

    expect(secondRun.categoriesCreated).toBe(0);
    expect(secondRun.servicesCreated).toBe(0);
    expect(secondRun.categoriesSkipped).toBe(21);
    expect(secondRun.servicesSkipped).toBe(74);
    expect(fake.db.wholesale_categories.length).toBe(countCategoriesAfterFirst);
    expect(fake.db.wholesale_services.length).toBe(countServicesAfterFirst);
  });

  it("never overwrites a change made from DESK on a later run", async () => {
    await seedWholesaleCatalog({ ...ENV, fetchImpl: fake.fakeFetch });

    // Simulate the owner activating one service and changing its price
    // from TORAYS BOOST DESK, exactly like wholesale-admin-services.js would.
    const service = fake.db.wholesale_services.find((s) => s.slug === "ps5__hdmi-board-level");
    service.active = true;
    service.fixed_price = 95; // owner decided to raise it

    const category = fake.db.wholesale_categories.find((c) => c.slug === "ps5");
    category.active = true;
    category.diagnostic_fee = 25; // owner finally set a real diagnostic fee

    await seedWholesaleCatalog({ ...ENV, fetchImpl: fake.fakeFetch });

    const serviceAfter = fake.db.wholesale_services.find((s) => s.slug === "ps5__hdmi-board-level");
    expect(serviceAfter.active).toBe(true);
    expect(serviceAfter.fixed_price).toBe(95);

    const categoryAfter = fake.db.wholesale_categories.find((c) => c.slug === "ps5");
    expect(categoryAfter.active).toBe(true);
    expect(categoryAfter.diagnostic_fee).toBe(25);
  });

  it("gives a shop nothing until the owner activates something", async () => {
    process.env.SUPABASE_URL = ENV.supabaseUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = ENV.serviceKey;
    vi.stubGlobal("fetch", fake.fakeFetch);

    await seedWholesaleCatalog({ ...ENV, fetchImpl: fake.fakeFetch });

    const env = getEnv();
    const catalog = await listActiveCatalog(env);
    expect(catalog).toEqual([]);

    // Activate exactly one category + one of its services — now (and only
    // now) should that one thing show up for a logged-in shop.
    const category = fake.db.wholesale_categories.find((c) => c.slug === "ps5");
    category.active = true;
    const service = fake.db.wholesale_services.find((s) => s.slug === "ps5__hdmi-board-level");
    service.active = true;

    const catalogAfterActivation = await listActiveCatalog(env);
    expect(catalogAfterActivation).toHaveLength(1);
    expect(catalogAfterActivation[0].services).toHaveLength(1);
    expect(catalogAfterActivation[0].services[0].slug).toBe("ps5__hdmi-board-level");
  });

  it("only shows the category note to a shop once that category (and a service in it) is active", async () => {
    process.env.SUPABASE_URL = ENV.supabaseUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = ENV.serviceKey;
    vi.stubGlobal("fetch", fake.fakeFetch);
    await seedWholesaleCatalog({ ...ENV, fetchImpl: fake.fakeFetch });
    const env = getEnv();

    // Still inactive — the ATA note must not be reachable by a shop yet.
    expect(await listActiveCatalog(env)).toEqual([]);

    const category = fake.db.wholesale_categories.find((c) => c.slug === "iphone-15-17");
    category.active = true;
    const service = fake.db.wholesale_services.find((s) => s.slug === "iphone-15-17__no-power");
    service.active = true;

    const catalog = await listActiveCatalog(env);
    expect(catalog).toHaveLength(1);
    expect(catalog[0].notes).toBe("ATA / Level 3 Repair");
  });
});
