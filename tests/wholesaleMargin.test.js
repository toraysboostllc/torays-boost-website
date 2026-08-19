import { describe, it, expect } from "vitest";
import {
  computePotentialProfit,
  computeEstimatedMarginPercent,
  computeMarkupPercent,
  computeFixedPricing,
  computeRangePricing,
  hasCompletePriceTiers,
  isHighProfitPrice,
} from "../src/lib/wholesaleMargin.js";

describe("computePotentialProfit: customerPrice - wholesalePrice, never clamped to zero", () => {
  it("computes a normal positive profit", () => {
    expect(computePotentialProfit(150, 80)).toBe(70);
  });

  it("computes and preserves a real negative profit (a loss) — never hidden or zeroed", () => {
    expect(computePotentialProfit(50, 80)).toBe(-30);
  });

  it("zero profit when customer price equals wholesale price", () => {
    expect(computePotentialProfit(80, 80)).toBe(0);
  });

  it("returns null for NaN, non-number, or negative customer price", () => {
    expect(computePotentialProfit(NaN, 80)).toBeNull();
    expect(computePotentialProfit("150", 80)).toBeNull();
    expect(computePotentialProfit(-10, 80)).toBeNull();
    expect(computePotentialProfit(null, 80)).toBeNull();
    expect(computePotentialProfit(undefined, 80)).toBeNull();
  });

  it("returns null for an invalid wholesale price", () => {
    expect(computePotentialProfit(150, NaN)).toBeNull();
    expect(computePotentialProfit(150, -5)).toBeNull();
  });
});

describe("computeEstimatedMarginPercent: profit / customerPrice x 100 (margin, not markup)", () => {
  it("matches the worked example from the approved spec (inverse direction: given the recommended price, the margin should come back out)", () => {
    // wholesalePrice=80, targetMarginPercent=47 -> recommendedPrice=150.94
    expect(computeEstimatedMarginPercent(150.94, 80)).toBeCloseTo(47, 1);
  });

  it("50/50 sale: profit is half of wholesale price, margin is 50% of sale price, not 100%", () => {
    // customerPrice=160, wholesalePrice=80 -> profit=80, margin=80/160=50%
    expect(computeEstimatedMarginPercent(160, 80)).toBeCloseTo(50, 5);
  });

  it("negative margin when the customer price is below wholesale (a real loss)", () => {
    expect(computeEstimatedMarginPercent(50, 80)).toBeCloseTo(-60, 5);
  });

  it("returns null when customerPrice is 0 (division by zero guarded, never NaN/Infinity)", () => {
    expect(computeEstimatedMarginPercent(0, 80)).toBeNull();
  });

  it("returns null for invalid input", () => {
    expect(computeEstimatedMarginPercent(NaN, 80)).toBeNull();
    expect(computeEstimatedMarginPercent(150, NaN)).toBeNull();
    expect(computeEstimatedMarginPercent(-10, 80)).toBeNull();
  });
});

describe("computeMarkupPercent: profit / wholesalePrice x 100 — a DIFFERENT, larger number than margin", () => {
  it("markup is always >= margin for the same positive-profit sale (markup denominator is smaller)", () => {
    // customerPrice=160, wholesalePrice=80 -> markup=80/80=100%, margin=80/160=50%
    expect(computeMarkupPercent(160, 80)).toBeCloseTo(100, 5);
    expect(computeEstimatedMarginPercent(160, 80)).toBeCloseTo(50, 5);
  });

  it("returns null when wholesalePrice is 0 (division by zero guarded)", () => {
    expect(computeMarkupPercent(150, 0)).toBeNull();
  });

  it("returns null for invalid input", () => {
    expect(computeMarkupPercent(NaN, 80)).toBeNull();
    expect(computeMarkupPercent(150, NaN)).toBeNull();
  });
});

describe("computeFixedPricing: full bundle for a `fixed` service", () => {
  it("the PS5 HDMI worked example: wholesale=80, customer=150 -> profit=70, margin ~46.67%, not a loss", () => {
    const result = computeFixedPricing({ wholesalePrice: 80, customerPrice: 150 });
    expect(result.potentialProfit).toBe(70);
    expect(result.estimatedMarginPercent).toBeCloseTo(46.6667, 3);
    expect(result.markupPercent).toBeCloseTo(87.5, 3);
    expect(result.isLoss).toBe(false);
  });

  it("flags isLoss=true when the shop types a customer price below wholesale", () => {
    const result = computeFixedPricing({ wholesalePrice: 80, customerPrice: 60 });
    expect(result.potentialProfit).toBe(-20);
    expect(result.isLoss).toBe(true);
  });

  it("isLoss is false (not true) when the calc itself is unavailable — an unknown result is not a confirmed loss", () => {
    const result = computeFixedPricing({ wholesalePrice: 80, customerPrice: NaN });
    expect(result.potentialProfit).toBeNull();
    expect(result.isLoss).toBe(false);
  });
});

describe("computeRangePricing: full bundle for a `range` service — always a range, never false precision", () => {
  it("computes profit/margin as [min, max], min uses the higher wholesale bound (worst case)", () => {
    // wholesale range 70-90, customer price 150
    const result = computeRangePricing({ wholesaleMin: 70, wholesaleMax: 90, customerPrice: 150 });
    expect(result.potentialProfitMin).toBe(60); // 150 - 90 (worst case: most expensive wholesale outcome)
    expect(result.potentialProfitMax).toBe(80); // 150 - 70 (best case: cheapest wholesale outcome)
    expect(result.estimatedMarginPercentMin).toBeCloseTo(40, 5); // 60/150
    expect(result.estimatedMarginPercentMax).toBeCloseTo(53.333, 2); // 80/150
  });

  it("isLoss (possible loss) true when the worst case is negative but the best case is still positive", () => {
    const result = computeRangePricing({ wholesaleMin: 70, wholesaleMax: 90, customerPrice: 80 });
    expect(result.potentialProfitMin).toBe(-10); // 80 - 90
    expect(result.potentialProfitMax).toBe(10); // 80 - 70
    expect(result.isLoss).toBe(true);
    expect(result.isGuaranteedLoss).toBe(false);
  });

  it("isGuaranteedLoss true when even the best case is negative", () => {
    const result = computeRangePricing({ wholesaleMin: 70, wholesaleMax: 90, customerPrice: 50 });
    expect(result.potentialProfitMax).toBe(-20); // 50 - 70, best case
    expect(result.isLoss).toBe(true);
    expect(result.isGuaranteedLoss).toBe(true);
  });

  it("returns null when wholesaleMin > wholesaleMax (malformed range, never silently swapped)", () => {
    expect(computeRangePricing({ wholesaleMin: 90, wholesaleMax: 70, customerPrice: 150 })).toBeNull();
  });

  it("returns null for invalid/negative input anywhere in the triple", () => {
    expect(computeRangePricing({ wholesaleMin: NaN, wholesaleMax: 90, customerPrice: 150 })).toBeNull();
    expect(computeRangePricing({ wholesaleMin: 70, wholesaleMax: 90, customerPrice: -5 })).toBeNull();
    expect(computeRangePricing({ wholesaleMin: -70, wholesaleMax: 90, customerPrice: 150 })).toBeNull();
  });
});

describe("hasCompletePriceTiers: legacy vs configured, never a partial/guessed shape", () => {
  it("true only when all three tier prices are real numbers", () => {
    expect(hasCompletePriceTiers({ competitive_price: 40, recommended_price: 45, high_profit_price: 55 })).toBe(true);
  });

  it("false when all three are null (legacy — never treated as 'configured with zeros')", () => {
    expect(hasCompletePriceTiers({ competitive_price: null, recommended_price: null, high_profit_price: null })).toBe(false);
  });

  it("false when only one or two of the three are set — never a partial tier UI", () => {
    expect(hasCompletePriceTiers({ competitive_price: 40, recommended_price: null, high_profit_price: 55 })).toBe(false);
    expect(hasCompletePriceTiers({ competitive_price: null, recommended_price: 45, high_profit_price: 55 })).toBe(false);
    expect(hasCompletePriceTiers({ competitive_price: 40, recommended_price: 45, high_profit_price: null })).toBe(false);
  });

  it("false for a missing/null service object, never throws", () => {
    expect(hasCompletePriceTiers(null)).toBe(false);
    expect(hasCompletePriceTiers(undefined)).toBe(false);
  });
});

describe("isHighProfitPrice: 'igual o superior' al nivel Gold siempre clasifica como High Profit", () => {
  it("true when the customer price exceeds the Gold price", () => {
    expect(isHighProfitPrice(60, 55)).toBe(true);
  });

  it("true on an exact match — 'igual o superior', not just 'superior'", () => {
    expect(isHighProfitPrice(55, 55)).toBe(true);
  });

  it("false when below the Gold price, even by a cent", () => {
    expect(isHighProfitPrice(54.99, 55)).toBe(false);
  });

  it("false (never a guess) when either input is missing/invalid", () => {
    expect(isHighProfitPrice(null, 55)).toBe(false);
    expect(isHighProfitPrice(60, null)).toBe(false);
    expect(isHighProfitPrice(NaN, 55)).toBe(false);
  });
});

describe("Price tier examples from the approved spec — exact numbers, verified through the real pure-calc functions", () => {
  it("DualSense: Shop Cost $25, Silver $40/$15 profit/37.5% margin, Purple $45/$20/44.4%, Gold $55/$30/54.5%", () => {
    const shopCost = 25;
    const silver = computeFixedPricing({ wholesalePrice: shopCost, customerPrice: 40 });
    expect(silver.potentialProfit).toBe(15);
    expect(silver.estimatedMarginPercent).toBeCloseTo(37.5, 1);

    const purple = computeFixedPricing({ wholesalePrice: shopCost, customerPrice: 45 });
    expect(purple.potentialProfit).toBe(20);
    expect(purple.estimatedMarginPercent).toBeCloseTo(44.4, 1);

    const gold = computeFixedPricing({ wholesalePrice: shopCost, customerPrice: 55 });
    expect(gold.potentialProfit).toBe(30);
    expect(gold.estimatedMarginPercent).toBeCloseTo(54.5, 1);
  });

  it("Board-level repair: Shop Cost $50, Silver $90, Purple $120, Gold $140 — all real profits, none a loss", () => {
    const shopCost = 50;
    const silver = computeFixedPricing({ wholesalePrice: shopCost, customerPrice: 90 });
    expect(silver.potentialProfit).toBe(40);
    expect(silver.isLoss).toBe(false);

    const purple = computeFixedPricing({ wholesalePrice: shopCost, customerPrice: 120 });
    expect(purple.potentialProfit).toBe(70);
    expect(purple.isLoss).toBe(false);

    const gold = computeFixedPricing({ wholesalePrice: shopCost, customerPrice: 140 });
    expect(gold.potentialProfit).toBe(90);
    expect(gold.isLoss).toBe(false);
  });

  it("a custom price below Shop Cost is a real loss, on either example", () => {
    expect(computeFixedPricing({ wholesalePrice: 25, customerPrice: 20 }).isLoss).toBe(true);
    expect(computeFixedPricing({ wholesalePrice: 50, customerPrice: 45 }).isLoss).toBe(true);
  });

  it("a custom price at or above Gold classifies as High Profit on both examples", () => {
    expect(isHighProfitPrice(55, 55)).toBe(true); // DualSense, exact Gold
    expect(isHighProfitPrice(60, 55)).toBe(true); // DualSense, above Gold
    expect(isHighProfitPrice(140, 140)).toBe(true); // board repair, exact Gold
    expect(isHighProfitPrice(200, 140)).toBe(true); // board repair, above Gold
  });

  it("Tactile result redesign fixture: Shop Cost $75, Silver $120/$45 profit, Purple $159/$84, Gold $190/$115 — the exact numbers from the approved mock", () => {
    const shopCost = 75;
    const silver = computeFixedPricing({ wholesalePrice: shopCost, customerPrice: 120 });
    expect(silver.potentialProfit).toBe(45);

    const purple = computeFixedPricing({ wholesalePrice: shopCost, customerPrice: 159 });
    expect(purple.potentialProfit).toBe(84);

    const gold = computeFixedPricing({ wholesalePrice: shopCost, customerPrice: 190 });
    expect(gold.potentialProfit).toBe(115);
  });
});
