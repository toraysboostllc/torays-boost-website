import { describe, it, expect } from "vitest";
import {
  applyRoundingRule,
  computeRecommendedPriceFromMargin,
  resolveRecommendedPrice,
} from "../api/_lib/wholesaleMargin.js";

describe("computeRecommendedPriceFromMargin: the exact approved formula, not markup", () => {
  it("matches the worked example verbatim: wholesale=80, margin=47% -> 150.94", () => {
    const result = computeRecommendedPriceFromMargin(80, 47);
    expect(result).toBeCloseTo(150.9433962, 6);
  });

  it("is NOT the markup formula (wholesale * (1 + margin/100)) — would give a smaller, wrong number", () => {
    const correct = computeRecommendedPriceFromMargin(80, 47);
    const markupFormula = 80 * (1 + 47 / 100); // 117.6 — the WRONG formula this correction was written against
    expect(correct).not.toBeCloseTo(markupFormula, 1);
    expect(correct).toBeGreaterThan(markupFormula);
  });

  it("0% margin returns the wholesale price unchanged", () => {
    expect(computeRecommendedPriceFromMargin(100, 0)).toBe(100);
  });

  it("returns null for a margin of exactly 100 or above (would divide by zero or go negative)", () => {
    expect(computeRecommendedPriceFromMargin(80, 100)).toBeNull();
    expect(computeRecommendedPriceFromMargin(80, 150)).toBeNull();
  });

  it("returns null for a negative margin or negative/NaN wholesale price", () => {
    expect(computeRecommendedPriceFromMargin(80, -5)).toBeNull();
    expect(computeRecommendedPriceFromMargin(-80, 47)).toBeNull();
    expect(computeRecommendedPriceFromMargin(NaN, 47)).toBeNull();
    expect(computeRecommendedPriceFromMargin(80, NaN)).toBeNull();
  });

  it("wholesale price of 0 with a valid margin returns 0", () => {
    expect(computeRecommendedPriceFromMargin(0, 47)).toBe(0);
  });
});

describe("applyRoundingRule: 4 configured options, applied only to margin-formula results", () => {
  it("'none' normalizes to cents without a rule-based rounding step", () => {
    expect(applyRoundingRule(150.9433962, "none")).toBe(150.94);
  });

  it("'nearest_1' rounds to the nearest whole dollar", () => {
    expect(applyRoundingRule(150.94, "nearest_1")).toBe(151);
    expect(applyRoundingRule(150.49, "nearest_1")).toBe(150);
  });

  it("'nearest_5' rounds to the nearest $5", () => {
    expect(applyRoundingRule(151, "nearest_5")).toBe(150);
    expect(applyRoundingRule(153, "nearest_5")).toBe(155);
  });

  it("'charm_99' always rounds UP to the next whole dollar minus a cent, never down", () => {
    expect(applyRoundingRule(150.01, "charm_99")).toBe(150.99);
    expect(applyRoundingRule(150.94, "charm_99")).toBe(150.99);
    expect(applyRoundingRule(150.0, "charm_99")).toBe(149.99);
  });

  it("charm_99 never goes negative even for a value near zero", () => {
    expect(applyRoundingRule(0, "charm_99")).toBe(0);
  });

  it("an unrecognized rule falls back to the same behavior as 'none'", () => {
    expect(applyRoundingRule(150.9433962, "not_a_real_rule")).toBe(150.94);
  });

  it("returns null for non-finite input", () => {
    expect(applyRoundingRule(NaN, "nearest_1")).toBeNull();
  });
});

describe("resolveRecommendedPrice: 4-step priority, never reordered", () => {
  const settings = { default_target_margin_percent: 40, rounding_rule: "none" };

  it("priority 1: a manual recommended_price wins outright, no rounding applied to it", () => {
    const service = {
      pricing_type: "fixed",
      fixed_price: 80,
      recommended_price: 199.5, // deliberately not what the formula/rounding would produce
      target_margin_percent: 10,
    };
    expect(resolveRecommendedPrice(service, settings)).toBe(199.5);
  });

  it("priority 2: no manual price, falls back to the service's own target_margin_percent", () => {
    const service = {
      pricing_type: "fixed",
      fixed_price: 80,
      recommended_price: null,
      target_margin_percent: 47,
    };
    expect(resolveRecommendedPrice(service, settings)).toBeCloseTo(150.94, 2);
  });

  it("priority 3: no manual price and no per-service margin, falls back to the global default", () => {
    const service = { pricing_type: "fixed", fixed_price: 100, recommended_price: null, target_margin_percent: null };
    // default_target_margin_percent = 40 -> 100 / (1 - 0.4) = 166.666...
    expect(resolveRecommendedPrice(service, settings)).toBeCloseTo(166.67, 2);
  });

  it("priority 4: the configured rounding rule is applied after the formula wins", () => {
    const roundedSettings = { default_target_margin_percent: 47, rounding_rule: "nearest_1" };
    const service = { pricing_type: "fixed", fixed_price: 80, recommended_price: null, target_margin_percent: null };
    expect(resolveRecommendedPrice(service, roundedSettings)).toBe(151);
  });

  it("`range` pricing_type uses price_max (conservative — worst case) as the formula basis", () => {
    const service = {
      pricing_type: "range",
      price_min: 70,
      price_max: 90,
      recommended_price: null,
      target_margin_percent: 40,
    };
    // 90 / (1 - 0.4) = 150 exactly
    expect(resolveRecommendedPrice(service, settings)).toBeCloseTo(150, 2);
  });

  it("`quote` pricing_type always returns null — no wholesale basis exists to recommend against", () => {
    const service = { pricing_type: "quote", fixed_price: null, price_min: null, price_max: null, recommended_price: null };
    expect(resolveRecommendedPrice(service, settings)).toBeNull();
  });

  it("`quote` returns null even if a stray target_margin_percent were somehow set — short-circuits before the formula", () => {
    const service = { pricing_type: "quote", target_margin_percent: 50, recommended_price: null };
    expect(resolveRecommendedPrice(service, settings)).toBeNull();
  });

  it("returns null when neither a per-service nor a usable global margin is available", () => {
    const brokenSettings = { default_target_margin_percent: null, rounding_rule: "none" };
    const service = { pricing_type: "fixed", fixed_price: 80, recommended_price: null, target_margin_percent: null };
    expect(resolveRecommendedPrice(service, brokenSettings)).toBeNull();
  });

  it("a manual recommended_price of 0 is respected (not treated as falsy/absent)", () => {
    const service = { pricing_type: "fixed", fixed_price: 80, recommended_price: 0, target_margin_percent: 47 };
    expect(resolveRecommendedPrice(service, settings)).toBe(0);
  });
});
