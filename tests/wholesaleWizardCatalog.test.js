import { describe, it, expect } from "vitest";
import { buildWholesaleWizardCatalog, PROMOTED_CATEGORY_SLUGS } from "../src/lib/wholesaleWizardCatalog.js";

/** Mirrors the REAL shape /api/wholesale-prices returns (see
 *  api/_lib/wholesaleDb.js's buildWholesaleCatalog / toClientCategory) and
 *  the REAL slugs seeded in scripts/wholesaleCatalogSeed.data.js — "Video
 *  Consoles" containing ps5/xbox-series-x/switch as plain categories is the
 *  actual production shape this adapter has to project, not a hypothetical. */
function fixtureEquipmentTypes() {
  return [
    {
      id: "et-iphone",
      slug: "iphone",
      name: "iPhone",
      image: { url: "https://example.com/iphone.webp", alt_text: "iPhone" },
      categories: [
        { id: "cat-iphone-7-11", slug: "iphone-7-11", name: "iPhone 7 / 8 / X / XR / XS / XS Max / 11 / 11 Pro / 11 Pro Max", notes: null, diagnostic_fee: null, diagnostic_description: null, image: null, services: [{ id: "svc-1", name: "No Power" }] },
        { id: "cat-iphone-12-14", slug: "iphone-12-14", name: "iPhone 12 / 13 / 14", notes: null, diagnostic_fee: null, diagnostic_description: null, image: null, services: [{ id: "svc-2", name: "Boot Loop" }] },
        { id: "cat-iphone-15-17", slug: "iphone-15-17", name: "iPhone 15 / 16 / 17", notes: "ATA / Level 3 Repair", diagnostic_fee: null, diagnostic_description: null, image: null, services: [{ id: "svc-3", name: "No Power" }] },
      ],
    },
    {
      id: "et-video-consoles",
      slug: "video-consoles",
      name: "Video Consoles",
      image: { url: "https://example.com/consoles.webp", alt_text: "Video Consoles" },
      categories: [
        { id: "cat-ps5", slug: "ps5", name: "PlayStation 5", notes: null, diagnostic_fee: 10, diagnostic_description: "Diagnostic", image: { url: "https://example.com/ps5.webp", alt_text: "PS5" }, services: [{ id: "svc-hdmi", name: "HDMI Port Replacement", pricing_type: "fixed", fixed_price: 80 }] },
        { id: "cat-xbox", slug: "xbox-series-x", name: "Xbox Series X", notes: null, diagnostic_fee: null, diagnostic_description: null, image: null, services: [{ id: "svc-4", name: "No Power" }] },
        { id: "cat-switch", slug: "switch", name: "Nintendo Switch / Switch OLED", notes: null, diagnostic_fee: null, diagnostic_description: null, image: null, services: [{ id: "svc-5", name: "Joy-Con Drift" }] },
      ],
    },
    {
      id: "et-controllers",
      slug: "controllers",
      name: "Controllers",
      image: null,
      categories: [
        { id: "cat-dualsense", slug: "ps5-dualsense", name: "PlayStation 5 DualSense", notes: null, diagnostic_fee: null, diagnostic_description: null, image: null, services: [{ id: "svc-6", name: "Stick Drift" }] },
      ],
    },
  ];
}

describe("buildWholesaleWizardCatalog: promoted categories become top-level Equipo cards", () => {
  it("PS5, Xbox Series X, and Switch each become their own Equipo, ids/slugs preserved from the real category", () => {
    const wizard = buildWholesaleWizardCatalog(fixtureEquipmentTypes());
    const ps5 = wizard.find((e) => e.id === "cat-ps5");
    const xbox = wizard.find((e) => e.id === "cat-xbox");
    const switchEntry = wizard.find((e) => e.id === "cat-switch");

    expect(ps5).toBeTruthy();
    expect(ps5.name).toBe("PlayStation 5");
    expect(ps5.slug).toBe("ps5");
    expect(ps5.sourceEquipmentTypeId).toBe("et-video-consoles"); // real relation preserved
    expect(xbox).toBeTruthy();
    expect(xbox.slug).toBe("xbox-series-x");
    expect(switchEntry).toBeTruthy();
    expect(switchEntry.slug).toBe("switch");
  });

  it("a promoted Equipo has exactly 1 model (itself) — auto-advance case, no fake Modelo step", () => {
    const wizard = buildWholesaleWizardCatalog(fixtureEquipmentTypes());
    const ps5 = wizard.find((e) => e.id === "cat-ps5");
    expect(ps5.models).toHaveLength(1);
    expect(ps5.models[0].id).toBe("cat-ps5");
    expect(ps5.models[0].services).toEqual([{ id: "svc-hdmi", name: "HDMI Port Replacement", pricing_type: "fixed", fixed_price: 80 }]);
  });

  it("a promoted category's own photo wins; falls back to the parent equipment type's photo only if the category has none", () => {
    const wizard = buildWholesaleWizardCatalog(fixtureEquipmentTypes());
    const ps5 = wizard.find((e) => e.id === "cat-ps5");
    expect(ps5.image.url).toBe("https://example.com/ps5.webp"); // category's own photo
    const xbox = wizard.find((e) => e.id === "cat-xbox");
    expect(xbox.image.url).toBe("https://example.com/consoles.webp"); // xbox has no own photo -> parent's
  });

  it("Video Consoles itself never appears as an Equipo — every one of its categories was promoted away", () => {
    const wizard = buildWholesaleWizardCatalog(fixtureEquipmentTypes());
    expect(wizard.find((e) => e.id === "et-video-consoles")).toBeUndefined();
  });
});

describe("buildWholesaleWizardCatalog: unpromoted equipment types pass through unmodified", () => {
  it("iPhone keeps all 3 of its categories as models under one Equipo, real equipment_type_id preserved", () => {
    const wizard = buildWholesaleWizardCatalog(fixtureEquipmentTypes());
    const iphone = wizard.find((e) => e.id === "et-iphone");
    expect(iphone).toBeTruthy();
    expect(iphone.slug).toBe("iphone");
    expect(iphone.sourceEquipmentTypeId).toBe("et-iphone");
    expect(iphone.models.map((m) => m.id)).toEqual(["cat-iphone-7-11", "cat-iphone-12-14", "cat-iphone-15-17"]);
  });

  it("iPhone's multi-model shape means the wizard WILL show a Modelo step (models.length > 1)", () => {
    const wizard = buildWholesaleWizardCatalog(fixtureEquipmentTypes());
    const iphone = wizard.find((e) => e.id === "et-iphone");
    expect(iphone.models.length).toBeGreaterThan(1);
  });

  it("Controllers (not in the promoted set, not in the visible-initial list) still passes through generically — no hidden allowlist", () => {
    const wizard = buildWholesaleWizardCatalog(fixtureEquipmentTypes());
    const controllers = wizard.find((e) => e.id === "et-controllers");
    expect(controllers).toBeTruthy();
    expect(controllers.models).toHaveLength(1);
    expect(controllers.models[0].id).toBe("cat-dualsense");
  });

  it("category-level notes/diagnostic fee survive the projection into a wizard model", () => {
    const wizard = buildWholesaleWizardCatalog(fixtureEquipmentTypes());
    const iphone = wizard.find((e) => e.id === "et-iphone");
    const model1517 = iphone.models.find((m) => m.id === "cat-iphone-15-17");
    expect(model1517.notes).toBe("ATA / Level 3 Repair");
    const ps5 = wizard.find((e) => e.id === "cat-ps5");
    expect(ps5.models[0].diagnostic_fee).toBe(10);
  });
});

describe("buildWholesaleWizardCatalog: pure, defensive, data-driven", () => {
  it("never mutates the input array/objects", () => {
    const input = fixtureEquipmentTypes();
    const snapshot = JSON.parse(JSON.stringify(input));
    buildWholesaleWizardCatalog(input);
    expect(input).toEqual(snapshot);
  });

  it("returns [] for non-array input instead of throwing", () => {
    expect(buildWholesaleWizardCatalog(null)).toEqual([]);
    expect(buildWholesaleWizardCatalog(undefined)).toEqual([]);
    expect(buildWholesaleWizardCatalog("not an array")).toEqual([]);
  });

  it("returns [] for an empty equipment types array", () => {
    expect(buildWholesaleWizardCatalog([])).toEqual([]);
  });

  it("an equipment type with zero categories is dropped, not shown empty", () => {
    const wizard = buildWholesaleWizardCatalog([{ id: "et-empty", slug: "empty", name: "Nothing Here", image: null, categories: [] }]);
    expect(wizard).toEqual([]);
  });

  it("the promoted-slug set is genuinely data-driven — overriding it changes behavior with zero code changes elsewhere", () => {
    const wizard = buildWholesaleWizardCatalog(fixtureEquipmentTypes(), new Set(["ps5-dualsense"]));
    // With a different promoted set, PS5/Xbox/Switch stay nested under Video Consoles...
    expect(wizard.find((e) => e.id === "cat-ps5")).toBeUndefined();
    expect(wizard.find((e) => e.id === "et-video-consoles")).toBeTruthy();
    // ...and Controllers' only category gets promoted instead, so Controllers itself disappears.
    expect(wizard.find((e) => e.id === "cat-dualsense")).toBeTruthy();
    expect(wizard.find((e) => e.id === "et-controllers")).toBeUndefined();
  });

  it("the default export set contains exactly the 3 approved slugs, nothing more", () => {
    expect(PROMOTED_CATEGORY_SLUGS).toEqual(new Set(["ps5", "xbox-series-x", "switch"]));
  });
});
