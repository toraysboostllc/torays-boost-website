import { describe, it, expect } from "vitest";
import {
  normalizeSearchText,
  buildWholesaleSearchEntries,
  searchWholesaleCatalog,
  highlightSegments,
  SEARCH_MIN_QUERY_LENGTH,
  SEARCH_MAX_RESULTS,
  SEARCH_DEBOUNCE_MS,
} from "../src/lib/wholesaleSearch.js";
import { buildWholesaleWizardCatalog } from "../src/lib/wholesaleWizardCatalog.js";
import { stackForSearchSelection, currentScreen } from "../src/lib/wizardScreenStack.js";

/**
 * Live Search (Buscador Predictivo) — this file covers the pure logic in
 * wholesaleSearch.js directly (no jsdom/@testing-library in this project,
 * matching every other test file's own note); tests/wholesaleSearchUi.test.js
 * covers the WholesaleSearch.jsx component and its wiring into
 * WholesaleWizard.jsx structurally, the same source-based approach the
 * rest of this suite uses.
 *
 * Every fixture below is shaped exactly like buildWholesaleWizardCatalog's
 * own INPUT (equipmentTypes[] as /api/wholesale-prices actually returns
 * it) — several tests run the REAL buildWholesaleWizardCatalog first, then
 * feed its real output into buildWholesaleSearchEntries, proving the whole
 * pipeline end-to-end with zero mocking of the core logic (see the "full
 * round-trip" describe block).
 */

function makeService(overrides = {}) {
  return {
    id: overrides.id || "sv-1",
    slug: overrides.slug || "svc",
    name: "Screen Replacement",
    name_es: null,
    pricing_type: "fixed",
    fixed_price: 89,
    price_min: null,
    price_max: null,
    notes: null,
    currency: "USD",
    recommended_price: 120,
    competitive_price: null,
    high_profit_price: null,
    price_updated_at: null,
    image: null,
    ...overrides,
  };
}

function makeCategory(overrides = {}) {
  return {
    id: overrides.id || "cat-1",
    slug: overrides.slug || "cat",
    name: "iPhone 12 / 13 / 14",
    notes: null,
    diagnostic_fee: null,
    diagnostic_description: null,
    image: null,
    services: [],
    ...overrides,
  };
}

function makeEquipmentType(overrides = {}) {
  return {
    id: overrides.id || "et-1",
    slug: overrides.slug || "iphone",
    name: "iPhone",
    name_es: null,
    catalog_mode: "grouped",
    full_bleed_photo: false,
    image_focus_x: 50,
    image_focus_y: 50,
    image: null,
    sort_order: 1,
    categories: [],
    ...overrides,
  };
}

describe("normalizeSearchText: case, accents, repeated whitespace", () => {
  it("lowercases", () => {
    expect(normalizeSearchText("iPhone Screen")).toBe("iphone screen");
  });

  it("strips accents/diacritics (Spanish alphabet)", () => {
    expect(normalizeSearchText("Reparación de Pantalla")).toBe("reparacion de pantalla");
    expect(normalizeSearchText("Micrósoldadura Ñandú")).toBe("microsoldadura nandu");
  });

  it("collapses repeated whitespace to a single space and trims", () => {
    expect(normalizeSearchText("  iPhone    12   ")).toBe("iphone 12");
  });

  it("never throws on non-string input", () => {
    expect(normalizeSearchText(null)).toBe("");
    expect(normalizeSearchText(undefined)).toBe("");
    expect(normalizeSearchText(42)).toBe("");
  });
});

describe("buildWholesaleSearchEntries: one entry per Equipo->Modelo->Falla leaf, both languages indexed", () => {
  it("indexes English AND Spanish for equipo/model/service into one searchable blob", () => {
    const equipo = {
      id: "et-1",
      name: "iPhone",
      nameEs: null,
      models: [
        {
          id: "m-1",
          name: "iPhone 12 / 13 / 14",
          services: [makeService({ id: "sv-1", name: "Screen Replacement", name_es: "Reemplazo de Pantalla" })],
        },
      ],
    };
    const entries = buildWholesaleSearchEntries([equipo]);
    expect(entries).toHaveLength(1);
    expect(entries[0].searchText).toContain("iphone");
    expect(entries[0].searchText).toContain("screen replacement");
    expect(entries[0].searchText).toContain("reemplazo de pantalla");
  });

  it("falls back to the legacy CATALOG_NAME_ES dictionary for equipo/model when no real nameEs is set — never blank", () => {
    const equipo = {
      id: "et-1",
      name: "Controllers",
      nameEs: null,
      models: [{ id: "m-1", name: "Xbox Series X/S Controller", services: [makeService()] }],
    };
    const entries = buildWholesaleSearchEntries([equipo]);
    expect(entries[0].searchText).toContain("controles"); // CATALOG_NAME_ES["Controllers"]
    expect(entries[0].searchText).toContain("control xbox series x/s");
  });

  it("carries the REAL equipo/model/service objects, not copies — selecting a result can hydrate the wizard with the exact same references/IDs the catalog already has", () => {
    const service = makeService({ id: "sv-42" });
    const model = { id: "m-42", name: "Model", services: [service] };
    const equipo = { id: "et-42", name: "Equipo", nameEs: null, models: [model] };
    const entries = buildWholesaleSearchEntries([equipo]);
    expect(entries[0].equipo).toBe(equipo);
    expect(entries[0].model).toBe(model);
    expect(entries[0].service).toBe(service);
  });

  it("a direct_services Equipo (e.g. Microsoldering, always exactly 1 internal model) indexes identically to a grouped one — no special case", () => {
    const equipo = {
      id: "et-micro",
      name: "Microsoldering",
      nameEs: "Microsoldadura",
      isDirectServices: true,
      models: [{ id: "m-internal", name: "Microsoldering", services: [makeService({ id: "sv-fpc", name: "FPC Connector Soldering" })] }],
    };
    const entries = buildWholesaleSearchEntries([equipo]);
    expect(entries).toHaveLength(1);
    expect(entries[0].searchText).toContain("fpc connector soldering");
    expect(entries[0].searchText).toContain("microsoldadura");
  });

  it("handles an empty/missing list gracefully — never throws", () => {
    expect(buildWholesaleSearchEntries([])).toEqual([]);
    expect(buildWholesaleSearchEntries(null)).toEqual([]);
    expect(buildWholesaleSearchEntries(undefined)).toEqual([]);
  });
});

describe("searchWholesaleCatalog: minimum length, max results, relevance ranking", () => {
  function fixtureEntries() {
    const equipo = {
      id: "et-1",
      name: "iPhone",
      nameEs: null,
      models: [
        {
          id: "m-1",
          name: "iPhone 12 / 13 / 14",
          services: [
            makeService({ id: "sv-1", name: "Screen Replacement", name_es: "Reemplazo de Pantalla" }),
            makeService({ id: "sv-2", name: "Battery Replacement", name_es: "Reemplazo de Batería" }),
            makeService({ id: "sv-3", name: "No Power", name_es: "Sin Encendido" }),
          ],
        },
      ],
    };
    return buildWholesaleSearchEntries([equipo]);
  }

  it("returns nothing for a query shorter than SEARCH_MIN_QUERY_LENGTH (2 chars) even if it would otherwise match", () => {
    expect(SEARCH_MIN_QUERY_LENGTH).toBe(2);
    expect(searchWholesaleCatalog(fixtureEntries(), "s")).toEqual([]);
    expect(searchWholesaleCatalog(fixtureEntries(), "")).toEqual([]);
    expect(searchWholesaleCatalog(fixtureEntries(), "  ")).toEqual([]);
  });

  it("matches starting at exactly 2 normalized characters", () => {
    const results = searchWholesaleCatalog(fixtureEntries(), "sc");
    expect(results.map((r) => r.service.id)).toEqual(["sv-1"]);
  });

  it("matches in Spanish too, regardless of query casing/accents", () => {
    const results = searchWholesaleCatalog(fixtureEntries(), "BATERÍA");
    expect(results.map((r) => r.service.id)).toEqual(["sv-2"]);
  });

  it("a word-start match ranks above a mid-word match", () => {
    // "no" starts "No Power" (word-start) and also appears mid-word
    // nowhere else in this fixture, but this proves the ranking rule
    // directly against scored entries via a fixture built to collide.
    const equipo = {
      id: "et-x",
      name: "Equipo",
      nameEs: null,
      models: [
        {
          id: "m-x",
          name: "Modelo",
          services: [
            makeService({ id: "mid-word", name: "Piano Repair" }), // "an" appears mid-word in "Piano"
            makeService({ id: "word-start", name: "Antenna Repair" }), // "an" starts "Antenna"
          ],
        },
      ],
    };
    const entries = buildWholesaleSearchEntries([equipo]);
    const results = searchWholesaleCatalog(entries, "an");
    expect(results.map((r) => r.service.id)).toEqual(["word-start", "mid-word"]);
  });

  it("among equal-relevance matches, the entry with the shorter searchable text (a more specific/compact match) ranks first", () => {
    const equipo = {
      id: "et-y",
      name: "AAAAAAAAAAAAAAAAAAAA", // long equipo name pads this entry's searchText
      nameEs: null,
      models: [
        {
          id: "m-y1",
          name: "M",
          services: [makeService({ id: "long", name: "Fix Screen" })],
        },
      ],
    };
    const equipoShort = {
      id: "et-z",
      name: "E",
      nameEs: null,
      models: [{ id: "m-z1", name: "M", services: [makeService({ id: "short", name: "Fix Screen" })] }],
    };
    const entries = buildWholesaleSearchEntries([equipo, equipoShort]);
    const results = searchWholesaleCatalog(entries, "fix screen");
    expect(results.map((r) => r.service.id)).toEqual(["short", "long"]);
  });

  it("caps at SEARCH_MAX_RESULTS (10) even when far more entries match", () => {
    expect(SEARCH_MAX_RESULTS).toBe(10);
    const services = Array.from({ length: 25 }, (_, i) => makeService({ id: `sv-${i}`, name: `Repair Issue ${i}` }));
    const equipo = { id: "et-many", name: "Equipo", nameEs: null, models: [{ id: "m-many", name: "Modelo", services }] };
    const entries = buildWholesaleSearchEntries([equipo]);
    const results = searchWholesaleCatalog(entries, "repair");
    expect(results).toHaveLength(10);
  });

  it("returns [] for a query that matches nothing at all — never throws, never fabricates a result", () => {
    expect(searchWholesaleCatalog(fixtureEntries(), "zzzzznotfound")).toEqual([]);
  });

  it("real-world exclusion proof: a service that was never included in the input (e.g. because it's hidden/inactive/still in maintenance — /api/wholesale-prices already excludes those server-side, see api/_lib/wholesaleDb.js) simply cannot be found, because it was never indexed in the first place — this file adds no filtering of its own, so it can't leak data the server didn't send", () => {
    // The fixture below stands in for what the server sends AFTER already
    // excluding a hidden "Water Damage Treatment" service — it's absent
    // from the very shape searchWholesaleCatalog receives.
    const results = searchWholesaleCatalog(fixtureEntries(), "water damage");
    expect(results).toEqual([]);
  });
});

describe("highlightSegments: matched-substring highlighting, case/accent-insensitive, safe fallbacks", () => {
  it("highlights an exact-case substring match", () => {
    expect(highlightSegments("Screen Replacement", "Screen")).toEqual([
      { text: "Screen", matched: true },
      { text: " Replacement", matched: false },
    ]);
  });

  it("matches regardless of query casing", () => {
    expect(highlightSegments("Screen Replacement", "screen")).toEqual([
      { text: "Screen", matched: true },
      { text: " Replacement", matched: false },
    ]);
  });

  it("matches accented display text against an unaccented query, highlighting the ORIGINAL accented substring untouched", () => {
    expect(highlightSegments("Reparación de Pantalla", "reparacion")).toEqual([
      { text: "Reparación", matched: true },
      { text: " de Pantalla", matched: false },
    ]);
  });

  it("splits into 3 segments when the match is in the middle", () => {
    expect(highlightSegments("No Power Issue", "power")).toEqual([
      { text: "No ", matched: false },
      { text: "Power", matched: true },
      { text: " Issue", matched: false },
    ]);
  });

  it("falls back to a single unmatched segment when the query doesn't occur in THIS specific displayed string (it may have matched via the other language's variant instead)", () => {
    expect(highlightSegments("Screen Replacement", "pantalla")).toEqual([{ text: "Screen Replacement", matched: false }]);
  });

  it("falls back safely for empty/short text or query — never throws", () => {
    expect(highlightSegments("", "sc")).toEqual([{ text: "", matched: false }]);
    expect(highlightSegments("Screen", "s")).toEqual([{ text: "Screen", matched: false }]);
    expect(highlightSegments(null, "sc")).toEqual([{ text: "", matched: false }]);
  });
});

describe("Full round-trip: real /api/wholesale-prices-shaped data -> buildWholesaleWizardCatalog -> buildWholesaleSearchEntries -> search -> select -> hydration stack", () => {
  it("finds a service by its English name, in a catalog mixing a grouped multi-model Equipo and a direct_services Equipo (Microsoldering) — same pipeline every screen already uses, zero mocking of the core logic", () => {
    const iphone = makeEquipmentType({
      id: "et-iphone",
      slug: "iphone",
      name: "iPhone",
      sort_order: 1,
      categories: [
        makeCategory({
          id: "cat-12-14",
          slug: "iphone-12-14",
          name: "iPhone 12 / 13 / 14",
          services: [makeService({ id: "sv-screen", name: "Screen Replacement", name_es: "Reemplazo de Pantalla" })],
        }),
        makeCategory({
          id: "cat-15-17",
          slug: "iphone-15-17",
          name: "iPhone 15 / 16 / 17",
          services: [makeService({ id: "sv-battery-2", name: "Battery Replacement" })],
        }),
      ],
    });
    const microsoldering = makeEquipmentType({
      id: "et-micro",
      slug: "microsoldering",
      name: "Microsoldering",
      name_es: "Microsoldadura",
      catalog_mode: "direct_services",
      sort_order: 0,
      categories: [
        makeCategory({
          id: "cat-micro",
          slug: "microsoldering-direct",
          name: "Microsoldering",
          services: [makeService({ id: "sv-fpc", name: "FPC Connector Soldering" })],
        }),
      ],
    });

    // The exact same call WholesaleWizard.jsx itself makes.
    const topEquipoList = buildWholesaleWizardCatalog([iphone, microsoldering], undefined, null, null);
    const entries = buildWholesaleSearchEntries(topEquipoList);

    const results = searchWholesaleCatalog(entries, "screen");
    expect(results).toHaveLength(1);
    const hit = results[0];
    expect(hit.service.id).toBe("sv-screen");
    expect(hit.model.id).toBe("cat-12-14");
    expect(hit.equipo.id).toBe("et-iphone");
    // Real IDs, real objects — exactly what WholesaleWizard's own
    // handleSelectEquipo/handleSelectModel/handleSelectFault would have
    // set, one click at a time.
    expect(hit.equipo.models.length).toBe(2); // multi-model -> "model" screen is part of its history
    expect(stackForSearchSelection(hit.equipo)).toEqual(["top", "model", "fault", "progress"]);
    expect(currentScreen(stackForSearchSelection(hit.equipo))).toBe("progress");
  });

  it("finds the direct_services Equipo's own service (FPC Connector Soldering under Microsoldering) and its hydration stack naturally skips the model screen — models.length===1, no special case", () => {
    const microsoldering = makeEquipmentType({
      id: "et-micro",
      slug: "microsoldering",
      name: "Microsoldering",
      name_es: "Microsoldadura",
      catalog_mode: "direct_services",
      sort_order: 0,
      categories: [
        makeCategory({
          id: "cat-micro",
          slug: "microsoldering-direct",
          name: "Microsoldering",
          services: [makeService({ id: "sv-fpc", name: "FPC Connector Soldering" })],
        }),
      ],
    });
    const topEquipoList = buildWholesaleWizardCatalog([microsoldering], undefined, null, null);
    const entries = buildWholesaleSearchEntries(topEquipoList);

    const results = searchWholesaleCatalog(entries, "fpc");
    expect(results).toHaveLength(1);
    const hit = results[0];
    expect(hit.service.id).toBe("sv-fpc");
    expect(hit.equipo.isDirectServices).toBe(true);
    expect(hit.equipo.models).toHaveLength(1);
    expect(stackForSearchSelection(hit.equipo)).toEqual(["top", "fault", "progress"]);
  });

  it("finds the SAME service by its Spanish name too, in a catalog whose services only carry English `name` (no name_es) — matches via the legacy CATALOG_NAME_ES dictionary, same as the rest of this file's ES coverage", () => {
    const equipo = makeEquipmentType({
      id: "et-ctrl",
      name: "Controllers",
      categories: [makeCategory({ id: "cat-ctrl", name: "Xbox Series X/S Controller", services: [makeService({ id: "sv-joy", name: "TMR Hall Joystick Upgrade – Pair" })] })],
    });
    const topEquipoList = buildWholesaleWizardCatalog([equipo], undefined, null, null);
    const entries = buildWholesaleSearchEntries(topEquipoList);

    const results = searchWholesaleCatalog(entries, "controles"); // ES translation of "Controllers"
    expect(results.map((r) => r.service.id)).toEqual(["sv-joy"]);
  });
});

describe("SEARCH_DEBOUNCE_MS: within the requested ~200ms window", () => {
  it("is exactly 200ms (the spec's own target)", () => {
    expect(SEARCH_DEBOUNCE_MS).toBe(200);
  });
});
