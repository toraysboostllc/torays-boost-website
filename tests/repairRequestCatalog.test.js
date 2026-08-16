import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  DEVICE_CATEGORIES,
  PROBLEMS_BY_GROUP,
  SMART_QUESTIONS_BY_GROUP,
  ANSWER_OPTIONS,
  getCategoryById,
} from "../src/config/repairRequest.config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const EXPECTED_CATEGORY_IDS = [
  "iphone",
  "smartphones-other",
  "ipad",
  "tablets-other",
  "ps5",
  "xbox",
  "controllers",
  "macbook",
  "laptops-other",
  "data-recovery",
];

describe("repairRequest.config.js: no price, no ETA, anywhere", () => {
  it("never defines a price or etaDays field on any category/problem/question", () => {
    const json = JSON.stringify({ DEVICE_CATEGORIES, PROBLEMS_BY_GROUP, SMART_QUESTIONS_BY_GROUP });
    expect(json).not.toMatch(/price|etaDays|eta_days/i);
  });

  it("has no numeric dollar amounts anywhere in the module source", () => {
    const src = readFileSync(join(__dirname, "../src/config/repairRequest.config.js"), "utf8");
    expect(src).not.toMatch(/\$\d/);
  });
});

describe("repairRequest.config.js: 10 device categories, exact order", () => {
  it("has exactly the 10 approved categories in the approved order", () => {
    expect(DEVICE_CATEGORIES.map((c) => c.id)).toEqual(EXPECTED_CATEGORY_IDS);
  });

  it("labels match the approved copy", () => {
    expect(getCategoryById("iphone").label).toBe("iPhone");
    expect(getCategoryById("smartphones-other").label).toBe("Smartphones — Other Brands");
    expect(getCategoryById("ipad").label).toBe("iPad");
    expect(getCategoryById("tablets-other").label).toBe("Tablets — Other Brands");
    expect(getCategoryById("ps5").label).toBe("PlayStation / PS5");
    expect(getCategoryById("xbox").label).toBe("Xbox");
    expect(getCategoryById("controllers").label).toBe("Controllers");
    expect(getCategoryById("macbook").label).toBe("MacBook");
    expect(getCategoryById("laptops-other").label).toBe("Laptops — Other Brands");
    expect(getCategoryById("data-recovery").label).toBe("Data Recovery");
  });
});

describe("Brand rules: Apple never appears in either 'Other Brands' category", () => {
  it("Smartphones — Other Brands has exactly the approved brand list, no Apple", () => {
    const brands = getCategoryById("smartphones-other").brands.map((b) => b.label);
    expect(brands).toEqual(["Samsung", "Google Pixel", "Motorola", "OnePlus", "LG", "Other"]);
    expect(brands.join(" ")).not.toMatch(/apple/i);
  });

  it("Laptops — Other Brands has exactly the approved brand list, no Apple", () => {
    const brands = getCategoryById("laptops-other").brands.map((b) => b.label);
    expect(brands).toEqual(["Dell", "HP", "Lenovo", "ASUS", "Acer", "Microsoft Surface", "Other"]);
    expect(brands.join(" ")).not.toMatch(/apple/i);
  });

  it("iPhone and MacBook are their own categories, never brand options inside 'Other Brands'", () => {
    expect(getCategoryById("iphone").brands).toBeUndefined();
    expect(getCategoryById("macbook").brands).toBeUndefined();
  });

  it("no other category defines a brands list (free-text model entry only)", () => {
    const withBrands = DEVICE_CATEGORIES.filter((c) => c.brands).map((c) => c.id);
    expect(withBrands).toEqual(["smartphones-other", "laptops-other"]);
  });
});

describe("Problems by group: exact approved lists", () => {
  it("phone group (iPhone, Smartphones-Other) includes Back Glass", () => {
    const labels = PROBLEMS_BY_GROUP.phone.map((p) => p.label);
    expect(labels).toEqual([
      "Broken Screen",
      "Back Glass",
      "Battery Replacement",
      "Charging Port",
      "Camera",
      "No Power",
      "Water Damage",
      "Data Recovery",
      "Other",
    ]);
  });

  it("tablet group (iPad, Tablets-Other) never includes Back Glass", () => {
    const labels = PROBLEMS_BY_GROUP.tablet.map((p) => p.label);
    expect(labels).not.toContain("Back Glass");
    expect(labels).toEqual([
      "Broken Screen",
      "Battery Replacement",
      "Charging Port",
      "Camera",
      "No Power",
      "Water Damage",
      "Data Recovery",
      "Other",
    ]);
  });

  it("console group (PS5, Xbox) matches the approved list", () => {
    expect(PROBLEMS_BY_GROUP.console.map((p) => p.label)).toEqual([
      "HDMI / No Image",
      "No Power",
      "Overheating",
      "Disc Drive",
      "Liquid Damage",
      "Other",
    ]);
  });

  it("controller group matches the approved list", () => {
    expect(PROBLEMS_BY_GROUP.controller.map((p) => p.label)).toEqual([
      "Stick Drift",
      "Buttons",
      "Charging Port",
      "No Power",
      "Physical/Liquid Damage",
      "Other",
    ]);
  });

  it("laptop group (MacBook, Laptops-Other) matches the approved list", () => {
    expect(PROBLEMS_BY_GROUP.laptop.map((p) => p.label)).toEqual([
      "No Power",
      "Broken Screen",
      "Battery Replacement",
      "Charging Port",
      "Overheating",
      "Slow Performance",
      "Liquid Damage",
      "Data Recovery",
      "Motherboard Repair",
      "Other",
    ]);
  });
});

describe("Smart questions: exactly 3 per category, matching the approved text", () => {
  it("every one of the 10 categories resolves to a group with exactly 3 smart questions", () => {
    DEVICE_CATEGORIES.forEach((category) => {
      const questions = SMART_QUESTIONS_BY_GROUP[category.group];
      expect(questions, `group "${category.group}" for category "${category.id}"`).toBeDefined();
      expect(questions.length, `category "${category.id}"`).toBe(3);
    });
  });

  it("phone group questions match exactly", () => {
    expect(SMART_QUESTIONS_BY_GROUP.phone.map((q) => q.text)).toEqual([
      "Has the device had water or liquid damage?",
      "Is the front screen or glass cracked?",
      "Is the back glass cracked?",
    ]);
  });

  it("tablet group questions match exactly", () => {
    expect(SMART_QUESTIONS_BY_GROUP.tablet.map((q) => q.text)).toEqual([
      "Has the device had water or liquid damage?",
      "Is the screen or front glass cracked?",
      "Has the device been dropped or bent?",
    ]);
  });

  it("console group questions match exactly", () => {
    expect(SMART_QUESTIONS_BY_GROUP.console.map((q) => q.text)).toEqual([
      "Does the console power on?",
      "Does it display an image on the TV?",
      "Has it had liquid or physical damage?",
    ]);
  });

  it("controller group questions match exactly", () => {
    expect(SMART_QUESTIONS_BY_GROUP.controller.map((q) => q.text)).toEqual([
      "Does the controller power on and connect?",
      "Is the stick drift constant?",
      "Has it been dropped or exposed to liquid?",
    ]);
  });

  it("laptop group questions match exactly", () => {
    expect(SMART_QUESTIONS_BY_GROUP.laptop.map((q) => q.text)).toEqual([
      "Does the computer power on?",
      "Has it had liquid damage?",
      "Is the screen cracked or damaged?",
    ]);
  });

  it("data-recovery group questions match exactly", () => {
    expect(SMART_QUESTIONS_BY_GROUP["data-recovery"].map((q) => q.text)).toEqual([
      "Does the device power on?",
      "Is the storage device recognized?",
      "Has it been dropped or exposed to liquid?",
    ]);
  });

  it("every question uses the same three-way Yes/No/Not sure answer set", () => {
    expect(ANSWER_OPTIONS.map((a) => a.label)).toEqual(["Yes", "No", "Not sure"]);
  });
});
