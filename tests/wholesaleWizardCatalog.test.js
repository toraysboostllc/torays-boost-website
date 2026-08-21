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
    expect(ps5.sourceEquipmentTypeId).toBe("et-video-consoles"); // real relation preserved
    expect(xbox).toBeTruthy();
    expect(switchEntry).toBeTruthy();
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

describe("buildWholesaleWizardCatalog: backward-compatible dedup bridge — zero duplicate/missing cards across either deployment order", () => {
  /** Mirrors the shape the API returns AFTER the dynamic-equipment-types
   *  migration has run: ps5/xbox-series-x/switch are now their own
   *  top-level equipment types (each with one category that happens to
   *  share its slug — exactly how the migration re-points the existing
   *  category, see wholesale-dynamic-equipment-types-migration.sql). */
  function fixturePostMigration() {
    return [
      {
        id: "et-iphone", slug: "iphone", name: "iPhone", image: null,
        categories: [{ id: "cat-iphone-7-11", slug: "iphone-7-11", name: "iPhone 7-11", notes: null, diagnostic_fee: null, diagnostic_description: null, image: null, services: [{ id: "svc-1", name: "No Power" }] }],
      },
      {
        id: "et-ps5", slug: "ps5", name: "PlayStation 5", name_es: "PlayStation 5", full_bleed_photo: true, image_focus_x: 40, image_focus_y: 60,
        image: { url: "https://example.com/ps5-card.webp", alt_text: "PS5" },
        categories: [{ id: "cat-ps5", slug: "ps5", name: "PlayStation 5", notes: null, diagnostic_fee: 10, diagnostic_description: null, image: null, services: [{ id: "svc-hdmi", name: "HDMI Port Replacement" }] }],
      },
      {
        id: "et-video-consoles", slug: "video-consoles", name: "Video Consoles", image: null,
        categories: [], // emptied by the migration, hidden server-side in reality, but modeled here as present-with-zero-categories defensively
      },
    ];
  }

  it("post-migration: PS5 appears EXACTLY ONCE, sourced from the real equipment type (not the nested category), carrying its own name_es/full_bleed_photo/image_focus", () => {
    const wizard = buildWholesaleWizardCatalog(fixturePostMigration());
    const ps5Cards = wizard.filter((e) => e.slug === "ps5");
    expect(ps5Cards).toHaveLength(1);
    expect(ps5Cards[0].id).toBe("et-ps5"); // the EQUIPMENT TYPE id, not the category id — proves it came from the real-row branch
    expect(ps5Cards[0].nameEs).toBe("PlayStation 5");
    expect(ps5Cards[0].fullBleedPhoto).toBe(true);
    expect(ps5Cards[0].imageFocusX).toBe(40);
    expect(ps5Cards[0].imageFocusY).toBe(60);
    expect(ps5Cards[0].image.url).toBe("https://example.com/ps5-card.webp");
  });

  it("post-migration: Video Consoles (now empty) produces no card at all", () => {
    const wizard = buildWholesaleWizardCatalog(fixturePostMigration());
    expect(wizard.find((e) => e.slug === "video-consoles")).toBeUndefined();
  });

  it("pre-migration fixture: PS5 still gets defaulted presentation fields (bridge cards never carry DB-driven fullbleed/position/nameEs, since categories don't have them)", () => {
    const wizard = buildWholesaleWizardCatalog(fixtureEquipmentTypes());
    const ps5 = wizard.find((e) => e.id === "cat-ps5");
    expect(ps5.nameEs).toBeNull();
    expect(ps5.fullBleedPhoto).toBe(false);
    expect(ps5.imageFocusX).toBe(50);
    expect(ps5.imageFocusY).toBe(50);
  });

  it("a mixed/transitional response (one promoted category's equipment type migrated, another not yet) never double-counts the migrated one and still promotes the un-migrated one normally", () => {
    const mixed = [
      // ps5 already migrated to its own real equipment type...
      { id: "et-ps5", slug: "ps5", name: "PlayStation 5", image: null, categories: [{ id: "cat-ps5", slug: "ps5", name: "PlayStation 5", notes: null, diagnostic_fee: null, diagnostic_description: null, image: null, services: [{ id: "svc-a", name: "X" }] }] },
      // ...but xbox-series-x/switch have NOT been migrated yet — still nested under Video Consoles.
      { id: "et-video-consoles", slug: "video-consoles", name: "Video Consoles", image: null, categories: [
        { id: "cat-xbox", slug: "xbox-series-x", name: "Xbox Series X", notes: null, diagnostic_fee: null, diagnostic_description: null, image: null, services: [{ id: "svc-b", name: "Y" }] },
        { id: "cat-switch", slug: "switch", name: "Switch", notes: null, diagnostic_fee: null, diagnostic_description: null, image: null, services: [{ id: "svc-c", name: "Z" }] },
      ] },
    ];
    const wizard = buildWholesaleWizardCatalog(mixed);
    expect(wizard.filter((e) => e.slug === "ps5")).toHaveLength(1);
    expect(wizard.find((e) => e.slug === "ps5").id).toBe("et-ps5"); // from the real row, not re-promoted from a phantom nested category
    expect(wizard.filter((e) => e.slug === "xbox-series-x")).toHaveLength(1);
    expect(wizard.find((e) => e.slug === "xbox-series-x").id).toBe("cat-xbox"); // still via the legacy bridge
    expect(wizard.filter((e) => e.slug === "switch")).toHaveLength(1);
    // Video Consoles itself still doesn't appear, since both its remaining categories were promoted away.
    expect(wizard.find((e) => e.slug === "video-consoles")).toBeUndefined();
  });
});

describe("buildWholesaleWizardCatalog: Microsoldering arrives via microsolderingEquipmentType (3rd param) — a WIRE-LEVEL split, never a member of equipmentTypes[] itself — plus a TEMPORARY legacy-server fallback (4th param) for a stale pre-deploy client tab", () => {
  function fixtureGroupedEquipmentTypes() {
    return [
      {
        id: "et-iphone", slug: "iphone", name: "iPhone", image: null, sort_order: 2,
        categories: [{ id: "cat-iphone", slug: "iphone-15-17", name: "iPhone 15/16/17", notes: null, diagnostic_fee: null, diagnostic_description: null, image: null, services: [{ id: "svc-screen", name: "Screen Replacement" }] }],
      },
    ];
  }
  /** Microsoldering the NEW way: catalog_mode='direct_services', its own
   *  single (DESK-managed, internal) category holding directly-owned
   *  services — never a tag-based aggregation of some OTHER equipment
   *  type's category. Arrives as its OWN object (never pre-merged into the
   *  equipmentTypes array) — see api/_lib/wholesaleDb.js's wire-split
   *  comment for the real, reproduced old-client-tab reason: git main's
   *  WholesaleWizard.jsx renders an unconditional manual tile from a
   *  separate legacy key, so a Microsoldering entry left inside
   *  equipmentTypes[] would double-render for an already-open old tab. */
  function fixtureMicrosolderingDirect() {
    return {
      id: "et-microsoldering", slug: "microsoldering", name: "Microsoldering", name_es: "Microsoldadura",
      catalog_mode: "direct_services",
      full_bleed_photo: false, image_focus_x: 50, image_focus_y: 50, image: null, sort_order: 1,
      categories: [{ id: "cat-microsoldering-direct", slug: "microsoldering-direct", name: "Microsoldering", notes: null, diagnostic_fee: null, diagnostic_description: null, image: null, services: [{ id: "svc-board", name: "Board Repair" }] }],
    };
  }
  /** OLD (pre-unification) server's separate `microsoldering` response key
   *  shape: { id, slug, name, ..., equipmentTypes: [{ id, name, categories:
   *  [{ id, slug, name, services }] }] } — nested, NOT flat. */
  function fixtureLegacyMicrosoldering(overrides = {}) {
    return {
      id: "et-microsoldering", slug: "microsoldering", name: "Microsoldering", name_es: "Microsoldadura",
      full_bleed_photo: false, image_focus_x: 50, image_focus_y: 50, image: null,
      equipmentTypes: [
        { id: "et-microsoldering", name: "Microsoldering", categories: [{ id: "cat-microsoldering-direct", slug: "microsoldering-direct", name: "Microsoldering", services: [{ id: "svc-board", name: "Board Repair" }] }] },
      ],
      ...overrides,
    };
  }

  it("microsolderingEquipmentType merges into the SAME list as grouped types, sorted by sort_order — sort_order 1 lands before iPhone's sort_order 2", () => {
    const wizard = buildWholesaleWizardCatalog(fixtureGroupedEquipmentTypes(), undefined, fixtureMicrosolderingDirect());
    expect(wizard).toHaveLength(2);
    expect(wizard[0].slug).toBe("microsoldering");
    expect(wizard[0].isDirectServices).toBe(true);
    expect(wizard[0].models.map((m) => m.name)).toEqual(["Microsoldering"]);
    expect(wizard[0].models[0].services).toEqual([{ id: "svc-board", name: "Board Repair" }]);
    expect(wizard[1].slug).toBe("iphone");
    expect(wizard[1].isDirectServices).toBe(false);
  });

  it("microsolderingEquipmentType present: legacyMicrosoldering (4th param) is ignored entirely — no duplicate card even if both are supplied", () => {
    const wizard = buildWholesaleWizardCatalog(fixtureGroupedEquipmentTypes(), undefined, fixtureMicrosolderingDirect(), fixtureLegacyMicrosoldering());
    const microCards = wizard.filter((e) => e.slug === "microsoldering");
    expect(microCards).toHaveLength(1); // not 2 — the legacy fallback never fired
    expect(microCards[0].id).toBe("et-microsoldering");
  });

  it("microsolderingEquipmentType absent, no legacyMicrosoldering either (current-shape client talking to a server that never sends either): no Microsoldering card, no crash", () => {
    const wizard = buildWholesaleWizardCatalog(fixtureGroupedEquipmentTypes());
    expect(wizard.map((e) => e.slug)).toEqual(["iphone"]);
  });

  it("microsolderingEquipmentType absent (old server, pre wholesale-catalog-architecture-fix), legacyMicrosoldering present: falls back to it, producing exactly one Microsoldering card, inserted first", () => {
    const wizard = buildWholesaleWizardCatalog(fixtureGroupedEquipmentTypes(), undefined, null, fixtureLegacyMicrosoldering());
    expect(wizard).toHaveLength(2);
    expect(wizard[0].slug).toBe("microsoldering");
    expect(wizard[0].isDirectServices).toBe(true);
    expect(wizard[1].slug).toBe("iphone");
  });

  it("legacyMicrosoldering present but with an empty equipmentTypes[] (nothing added yet from DESK): produces no fallback card, matching the 'hide if empty' rule every other card gets", () => {
    const wizard = buildWholesaleWizardCatalog(fixtureGroupedEquipmentTypes(), undefined, null, fixtureLegacyMicrosoldering({ equipmentTypes: [] }));
    expect(wizard.map((e) => e.slug)).toEqual(["iphone"]);
  });

  it("legacyMicrosoldering is null: identical to not passing it at all", () => {
    const wizard = buildWholesaleWizardCatalog(fixtureGroupedEquipmentTypes(), undefined, null, null);
    expect(wizard.map((e) => e.slug)).toEqual(["iphone"]);
  });
});
