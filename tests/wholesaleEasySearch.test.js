import { describe, it, expect } from "vitest";
import {
  normalizeEasySearchCode,
  splitCombinedCodes,
  rankEasySearchResults,
  EASY_SEARCH_MIN_QUERY_LENGTH,
  EASY_SEARCH_MAX_RESULTS,
  EASY_SEARCH_DEBOUNCE_MS,
} from "../src/lib/wholesaleEasySearch.js";
import { EASY_SEARCH_DEVICE_SEED } from "../scripts/wholesaleEasySearchSeed.data.js";

describe("normalizeEasySearchCode: case/space/hyphen-insensitive, alphanumeric-only", () => {
  it("uppercases", () => {
    expect(normalizeEasySearchCode("a2218")).toBe("A2218");
  });
  it("strips hyphens", () => {
    expect(normalizeEasySearchCode("A-2218")).toBe("A2218");
  });
  it("strips spaces", () => {
    expect(normalizeEasySearchCode("A 2218")).toBe("A2218");
  });
  it("all four spec-required equivalents normalize identically", () => {
    const forms = ["A2218", "a2218", "A-2218", "A 2218"];
    const normalized = forms.map(normalizeEasySearchCode);
    expect(new Set(normalized).size).toBe(1);
    expect(normalized[0]).toBe("A2218");
  });
  it("strips slashes and commas too (combined-code punctuation)", () => {
    expect(normalizeEasySearchCode("SM-S918U/U1")).toBe("SMS918UU1");
  });
  it("non-string input never throws", () => {
    expect(normalizeEasySearchCode(null)).toBe("");
    expect(normalizeEasySearchCode(undefined)).toBe("");
    expect(normalizeEasySearchCode(42)).toBe("");
  });
});

describe("splitCombinedCodes: 'A1549 / A1586' becomes independent aliases on the same device", () => {
  it("splits on a slash with surrounding spaces", () => {
    expect(splitCombinedCodes("A1549 / A1586")).toEqual(["A1549", "A1586"]);
  });
  it("splits on a slash with no spaces", () => {
    expect(splitCombinedCodes("A1549/A1586")).toEqual(["A1549", "A1586"]);
  });
  it("splits on a comma too", () => {
    expect(splitCombinedCodes("A1549, A1586")).toEqual(["A1549", "A1586"]);
  });
  it("a single code with no separator returns a 1-element array unchanged", () => {
    expect(splitCombinedCodes("A2218")).toEqual(["A2218"]);
  });
  it("non-string input returns an empty array", () => {
    expect(splitCombinedCodes(null)).toEqual([]);
  });
});

describe("rankEasySearchResults: exact > prefix > partial", () => {
  it("an exact normalized_code match ranks first", () => {
    const results = [
      { normalizedCode: "A22185" }, // partial (contains, doesn't start with)
      { normalizedCode: "A2218" }, // exact
      { normalizedCode: "A221" }, // prefix of the query — not applicable here, query is A2218
    ];
    const ranked = rankEasySearchResults(results, "A2218");
    expect(ranked[0].normalizedCode).toBe("A2218");
  });
  it("a prefix match ranks above a non-prefix partial match", () => {
    const results = [
      { normalizedCode: "SMA2218Z" }, // contains but doesn't start with
      { normalizedCode: "A22180" }, // starts with
    ];
    const ranked = rankEasySearchResults(results, "A2218");
    expect(ranked[0].normalizedCode).toBe("A22180");
  });
  it("empty query or non-array input returns an empty array", () => {
    expect(rankEasySearchResults([{ normalizedCode: "A2218" }], "")).toEqual([]);
    expect(rankEasySearchResults(null, "A2218")).toEqual([]);
  });
});

describe("Easy Search constants", () => {
  it("has sane, non-zero values", () => {
    expect(EASY_SEARCH_MIN_QUERY_LENGTH).toBeGreaterThan(0);
    expect(EASY_SEARCH_MAX_RESULTS).toBeGreaterThan(0);
    expect(EASY_SEARCH_DEBOUNCE_MS).toBeGreaterThan(0);
  });
});

describe("Result shape never carries a price field — structurally, not just by convention", () => {
  it("no seed device object has any key that looks like a price", () => {
    const priceLikeKeys = ["price", "cost", "fixedPrice", "recommendedPrice", "competitivePrice", "highProfitPrice"];
    for (const device of EASY_SEARCH_DEVICE_SEED) {
      const keys = Object.keys(device);
      for (const priceKey of priceLikeKeys) {
        expect(keys, `${device.commercialName} must not carry ${priceKey}`).not.toContain(priceKey);
      }
    }
  });
});

describe("Seed data: the exact codes Carlos's spec calls out", () => {
  function findByCode(code) {
    const normalized = normalizeEasySearchCode(code);
    for (const device of EASY_SEARCH_DEVICE_SEED) {
      if (device.codes.some((c) => normalizeEasySearchCode(c.code) === normalized)) return device;
    }
    return null;
  }

  it("A2218 resolves to iPhone 11 Pro Max", () => {
    expect(findByCode("A2218")?.commercialName).toBe("iPhone 11 Pro Max");
  });

  it("A2214 resolves to nothing (not a real iPhone model number)", () => {
    expect(findByCode("A2214")).toBeNull();
  });

  it("A3575 resolves to iPhone 17e, not iPhone 17 Pro Max", () => {
    expect(findByCode("A3575")?.commercialName).toBe("iPhone 17e");
  });

  it("all 4 iPhone 16e codes resolve to the same device", () => {
    for (const code of ["A3212", "A3408", "A3410", "A3409"]) {
      expect(findByCode(code)?.commercialName).toBe("iPhone 16e");
    }
  });

  it("SM-S918U, SM-S918U1, and SM-S918B (any casing/spacing) all resolve to the same Galaxy S23 Ultra device", () => {
    for (const code of ["SM-S918U", "sm-s918u1", "SM S918B", "SMS918U"]) {
      expect(findByCode(code)?.commercialName).toBe("Galaxy S23 Ultra");
    }
  });
});
