import { describe, it, expect } from "vitest";

/**
 * Pure-logic replica of wholesale_touch_service_price_updated_at()'s
 * condition (supabase/wholesale-legal-migration.sql, section 3) — same
 * "mirror the DB trigger's exact condition as a plain JS function, tested
 * directly, no live database" convention as wholesaleMargin.test.js uses
 * for wholesale_update_service_full_v2's price-tier math. The trigger body
 * itself is:
 *
 *   if (new.fixed_price is distinct from old.fixed_price)
 *      or (new.price_min is distinct from old.price_min)
 *      or (new.price_max is distinct from old.price_max)
 *      or (new.competitive_price is distinct from old.competitive_price)
 *      or (new.recommended_price is distinct from old.recommended_price)
 *      or (new.high_profit_price is distinct from old.high_profit_price)
 *   then new.price_updated_at := now();
 *
 * Postgres's "IS DISTINCT FROM" is a null-safe inequality (unlike a plain
 * `<>`, it never returns NULL for a NULL operand) — the JS mirror below
 * uses the same not-strictly-equal semantics, correct for null-vs-value
 * and value-vs-value alike.
 */
function isDistinctFrom(a, b) {
  return a !== b;
}

const PRICE_FIELDS = ["fixed_price", "price_min", "price_max", "competitive_price", "recommended_price", "high_profit_price"];

/** Returns true iff the trigger would fire (i.e. price_updated_at gets
 *  bumped) for this old -> new transition. */
function wouldBumpPriceUpdatedAt(oldRow, newRow) {
  return PRICE_FIELDS.some((field) => isDistinctFrom(newRow[field], oldRow[field]));
}

const BASE_ROW = {
  name: "HDMI Port Replacement",
  notes: "original notes",
  fixed_price: 80,
  price_min: null,
  price_max: null,
  competitive_price: 70,
  recommended_price: 90,
  high_profit_price: 110,
};

describe("wouldBumpPriceUpdatedAt: mirrors the 6-field DB trigger condition exactly", () => {
  it("a notes-only change does NOT trigger a bump", () => {
    const next = { ...BASE_ROW, notes: "changed notes only" };
    expect(wouldBumpPriceUpdatedAt(BASE_ROW, next)).toBe(false);
  });

  it("a name-only change does NOT trigger a bump", () => {
    const next = { ...BASE_ROW, name: "Renamed Service" };
    expect(wouldBumpPriceUpdatedAt(BASE_ROW, next)).toBe(false);
  });

  it("a name AND notes change together still does NOT trigger a bump", () => {
    const next = { ...BASE_ROW, name: "Renamed", notes: "also changed" };
    expect(wouldBumpPriceUpdatedAt(BASE_ROW, next)).toBe(false);
  });

  it("no change at all does NOT trigger a bump", () => {
    expect(wouldBumpPriceUpdatedAt(BASE_ROW, { ...BASE_ROW })).toBe(false);
  });

  it("a fixed_price change DOES trigger a bump", () => {
    const next = { ...BASE_ROW, fixed_price: 85 };
    expect(wouldBumpPriceUpdatedAt(BASE_ROW, next)).toBe(true);
  });

  it("a price_min change DOES trigger a bump", () => {
    const next = { ...BASE_ROW, price_min: 60 };
    expect(wouldBumpPriceUpdatedAt(BASE_ROW, next)).toBe(true);
  });

  it("a price_max change DOES trigger a bump", () => {
    const next = { ...BASE_ROW, price_max: 100 };
    expect(wouldBumpPriceUpdatedAt(BASE_ROW, next)).toBe(true);
  });

  it("a competitive_price change DOES trigger a bump", () => {
    const next = { ...BASE_ROW, competitive_price: 72 };
    expect(wouldBumpPriceUpdatedAt(BASE_ROW, next)).toBe(true);
  });

  it("a recommended_price change DOES trigger a bump", () => {
    const next = { ...BASE_ROW, recommended_price: 95 };
    expect(wouldBumpPriceUpdatedAt(BASE_ROW, next)).toBe(true);
  });

  it("a high_profit_price change DOES trigger a bump", () => {
    const next = { ...BASE_ROW, high_profit_price: 115 };
    expect(wouldBumpPriceUpdatedAt(BASE_ROW, next)).toBe(true);
  });

  it("going from a real value to null on a price field still counts as distinct (DOES trigger)", () => {
    const next = { ...BASE_ROW, competitive_price: null };
    expect(wouldBumpPriceUpdatedAt(BASE_ROW, next)).toBe(true);
  });

  it("null-to-null on a price field is NOT distinct (does not falsely trigger)", () => {
    const oldRow = { ...BASE_ROW, price_min: null };
    const next = { ...BASE_ROW, price_min: null };
    expect(wouldBumpPriceUpdatedAt(oldRow, next)).toBe(false);
  });

  it("a mixed update (name changed AND fixed_price changed) still triggers — any one of the 6 fields is sufficient", () => {
    const next = { ...BASE_ROW, name: "Renamed", fixed_price: 82 };
    expect(wouldBumpPriceUpdatedAt(BASE_ROW, next)).toBe(true);
  });
});
