import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DEVICE_CATEGORIES, PROBLEMS_BY_GROUP, getCategoryById } from "../src/config/repairRequest.config.js";
import {
  DEVICE_TYPES,
  MODEL_CHIPS,
  getCategoryChoices,
  getDeviceTypeById,
  getDeviceTypeForCategory,
  getModelChips,
} from "../src/config/repairFlow.config.js";
import { translations } from "../src/i18n/translations.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(__dirname, "..", p), "utf8").replace(/\r\n?/g, "\n");

/**
 * The flow layer is the only thing standing between the six visible device
 * tiles and the ten real category ids the rest of the site (and every SEO
 * page, and every translation key) is built on. If it ever stops resolving,
 * the wizard degrades silently — so these are the loud checks.
 */

describe("The flow layer never touches the approved catalog", () => {
  it("repairRequest.config.js still defines exactly the 10 approved categories", () => {
    expect(DEVICE_CATEGORIES.map((c) => c.id)).toEqual([
      "iphone", "smartphones-other", "ipad", "tablets-other", "ps5",
      "xbox", "controllers", "macbook", "laptops-other", "data-recovery",
    ]);
  });

  it("the flow layer only reads the catalog — it never redefines a category, problem or question", () => {
    const flowSrc = read("src/config/repairFlow.config.js");
    expect(flowSrc).toContain('from "./repairRequest.config.js"');
    expect(flowSrc).not.toMatch(/export const DEVICE_CATEGORIES/);
    expect(flowSrc).not.toMatch(/export const PROBLEMS_BY_GROUP/);
    expect(flowSrc).not.toMatch(/export const SMART_QUESTIONS_BY_GROUP/);
    expect(flowSrc).not.toContain("slugify");
  });
});

describe("Six device types, resolving back to the ten real categories", () => {
  it("shows exactly the six approved types, in the approved order", () => {
    expect(DEVICE_TYPES.map((t) => t.id)).toEqual([
      "phone", "tablet", "console", "controller", "laptop", "data-recovery",
    ]);
  });

  it("every type is a real catalog group — none was invented", () => {
    const groups = new Set(DEVICE_CATEGORIES.map((c) => c.group));
    DEVICE_TYPES.forEach((t) => expect(groups).toContain(t.id));
  });

  it("every one of the 10 categories is reachable from exactly one type", () => {
    const reachable = DEVICE_TYPES.flatMap((t) => t.categoryIds);
    expect([...reachable].sort()).toEqual(DEVICE_CATEGORIES.map((c) => c.id).sort());
    expect(new Set(reachable).size).toBe(DEVICE_CATEGORIES.length); // no category listed twice
  });

  it("every category resolves back to the type it belongs to", () => {
    DEVICE_CATEGORIES.forEach((c) => {
      expect(getDeviceTypeForCategory(c.id).id).toBe(c.group);
    });
  });

  it("single-category types resolve straight through, with no choice row", () => {
    expect(getCategoryChoices("controller").map((c) => c.id)).toEqual(["controllers"]);
    expect(getCategoryChoices("data-recovery").map((c) => c.id)).toEqual(["data-recovery"]);
  });

  it("multi-category types offer their real siblings — never an invented brand", () => {
    expect(getCategoryChoices("phone").map((c) => c.id)).toEqual(["iphone", "smartphones-other"]);
    expect(getCategoryChoices("tablet").map((c) => c.id)).toEqual(["ipad", "tablets-other"]);
    expect(getCategoryChoices("console").map((c) => c.id)).toEqual(["ps5", "xbox"]);
    expect(getCategoryChoices("laptop").map((c) => c.id)).toEqual(["macbook", "laptops-other"]);
  });

  it("an unknown type resolves to nothing rather than throwing", () => {
    expect(getDeviceTypeById("nope")).toBeNull();
    expect(getCategoryChoices("nope")).toEqual([]);
  });

  it("every device type has a label in both languages", () => {
    DEVICE_TYPES.forEach((t) => {
      expect(translations.en.wizard.deviceTypes[t.id], `en ${t.id}`).toBeTruthy();
      expect(translations.es.wizard.deviceTypes[t.id], `es ${t.id}`).toBeTruthy();
    });
  });
});

describe("Model chips come from real history, and never replace the escape hatches", () => {
  it("only the four categories the history supported have chips", () => {
    expect(Object.keys(MODEL_CHIPS).sort()).toEqual(["ipad", "iphone", "ps5", "xbox"]);
  });

  it("MacBook is free text — 8 repairs across 7 models was not enough to rank", () => {
    expect(getModelChips("macbook")).toBeNull();
  });

  it("the 'Other Brands' categories stay free text", () => {
    ["smartphones-other", "tablets-other", "laptops-other", "controllers", "data-recovery"].forEach((id) => {
      expect(getModelChips(id), id).toBeNull();
    });
  });

  it("chip counts match what the history actually justified", () => {
    expect(MODEL_CHIPS.iphone).toHaveLength(8);
    expect(MODEL_CHIPS.ipad).toHaveLength(4);
    expect(MODEL_CHIPS.ps5).toHaveLength(4);
    expect(MODEL_CHIPS.xbox).toHaveLength(3);
  });

  it("chips are plain strings, never ids — they are typed into the model field verbatim", () => {
    Object.values(MODEL_CHIPS).flat().forEach((chip) => {
      expect(typeof chip).toBe("string");
      expect(chip.trim()).toBe(chip);
      expect(chip).not.toMatch(/^[a-z0-9-]+$/); // would look like an id
    });
  });

  it("no chip list contains a duplicate, and generations are never merged", () => {
    Object.entries(MODEL_CHIPS).forEach(([id, chips]) => {
      expect(new Set(chips).size, id).toBe(chips.length);
    });
    // the four PS5 variants stay four distinct entries
    expect(MODEL_CHIPS.ps5).toEqual(["PS5", "PS5 Slim", "PS5 Pro", "PS5 Slim Digital"]);
    expect(MODEL_CHIPS.xbox).toEqual(["Xbox Series X", "Xbox One", "Xbox Series S"]);
  });

  it("every chipped category still belongs to a real type, and its chips carry no price", () => {
    Object.keys(MODEL_CHIPS).forEach((id) => {
      expect(getCategoryById(id), id).toBeTruthy();
      expect(getDeviceTypeForCategory(id), id).toBeTruthy();
    });
    Object.values(MODEL_CHIPS).flat().forEach((chip) => {
      expect(chip).not.toMatch(/\$|\bUSD\b|\bfrom\b|\bdesde\b/i);
    });
  });
});

describe("Problems still come from the group, so every type has a working step 3", () => {
  it("each device type resolves to a non-empty problem list", () => {
    DEVICE_TYPES.forEach((t) => {
      expect(PROBLEMS_BY_GROUP[t.id], t.id).toBeTruthy();
      expect(PROBLEMS_BY_GROUP[t.id].length, t.id).toBeGreaterThan(0);
    });
  });
});
