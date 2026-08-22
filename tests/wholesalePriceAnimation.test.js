import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  computeAnimatedDisplayPrice,
  prefersReducedMotion,
  SHOPCOST_COUNT_UP_DURATION_MS,
} from "../src/lib/wholesalePriceAnimation.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

/**
 * "Your Cost with Torays Boost" banner: centered, counts up once from
 * $0.00 to the real price (~600ms, eased), then a single fade/scale settle
 * + a discreet blue glow sweep — never a loop, never a flicker, fully
 * skipped under prefers-reduced-motion. Two guarantees matter most and are
 * both provable as pure functions, with no DOM/React render needed (this
 * project has no jsdom dependency — see every other *.test.js file's own
 * note):
 *
 *  1. The FINAL value is always exactly what the pricing engine already
 *     computed — computeAnimatedDisplayPrice(service, formatPrice, 1) must
 *     be byte-identical to the old, non-animated display logic, for fixed,
 *     range, AND quote (which shows no numeric hero at all).
 *  2. prefers-reduced-motion: reduce disables the animation, verified via
 *     a minimal faked `window.matchMedia` (no full jsdom needed for a
 *     function that only ever calls that one API).
 *
 * The RAF-driven count-up hook itself (useCountUpProgress) is a real React
 * hook and can't be unit-tested without a render harness this project
 * doesn't have — its wiring (requestAnimationFrame, easing, clamping, the
 * reduced-motion/enabled short-circuit) is covered structurally below
 * instead, the same source-based approach the rest of this suite uses.
 */

const animSrc = read("src/lib/wholesalePriceAnimation.js");
const panelSrc = read("src/components/wholesale/WholesaleResultPanel.jsx");
const cssSrc = read("src/styles/wholesalePortal.css");

function fixedService(overrides = {}) {
  return { pricing_type: "fixed", fixed_price: 85, price_min: null, price_max: null, ...overrides };
}
function rangeService(overrides = {}) {
  return { pricing_type: "range", fixed_price: null, price_min: 50, price_max: 90, ...overrides };
}
function quoteService(overrides = {}) {
  return { pricing_type: "quote", fixed_price: null, price_min: null, price_max: null, ...overrides };
}

// A tiny stand-in for the real formatPrice (see WholesaleLocaleContext.jsx)
// — good enough to prove the SHAPE/exactness of computeAnimatedDisplayPrice
// without pulling in the whole locale/currency machinery, which is already
// covered by its own tests elsewhere.
const formatPrice = (amount) => `$${amount.toFixed(2)}`;

describe("computeAnimatedDisplayPrice: at progress=1, byte-identical to the real, non-animated price — the exact value the pricing engine returned, never recalculated", () => {
  it("fixed pricing: formatPrice(fixed_price) exactly, same as calling formatPrice directly", () => {
    const service = fixedService({ fixed_price: 84.5 });
    expect(computeAnimatedDisplayPrice(service, formatPrice, 1)).toBe(formatPrice(service.fixed_price));
    expect(computeAnimatedDisplayPrice(service, formatPrice, 1)).toBe("$84.50");
  });

  it("range pricing: 'min – max' exactly, same two real numbers, never swapped or altered", () => {
    const service = rangeService({ price_min: 50, price_max: 90 });
    expect(computeAnimatedDisplayPrice(service, formatPrice, 1)).toBe(
      `${formatPrice(service.price_min)} – ${formatPrice(service.price_max)}`
    );
    expect(computeAnimatedDisplayPrice(service, formatPrice, 1)).toBe("$50.00 – $90.00");
  });

  it("quote pricing: null — WholesaleResultPanel never renders a numeric hero for this pricing_type at all (see the isQuote branch), so there is nothing to animate or display", () => {
    expect(computeAnimatedDisplayPrice(quoteService(), formatPrice, 1)).toBeNull();
  });

  it("progress defaults to 1 when omitted — calling it exactly like the old non-animated helper still produces the real value", () => {
    const service = fixedService({ fixed_price: 120 });
    expect(computeAnimatedDisplayPrice(service, formatPrice)).toBe("$120.00");
  });

  it("multiplying by progress=1 is an IEEE-754 no-op — no floating-point drift can ever creep into the final displayed price, for any real-world price value", () => {
    for (const price of [0.01, 1, 9.99, 84.5, 999999.99, 12345.67]) {
      const service = fixedService({ fixed_price: price });
      expect(computeAnimatedDisplayPrice(service, formatPrice, 1)).toBe(formatPrice(price));
    }
  });
});

describe("computeAnimatedDisplayPrice: mid-animation frames scale both fixed and range values off the SAME progress, never recalculating or re-deriving the underlying price", () => {
  it("progress=0 reads as the true start of a count-up — $0.00 for a fixed price", () => {
    expect(computeAnimatedDisplayPrice(fixedService({ fixed_price: 84.5 }), formatPrice, 0)).toBe("$0.00");
  });

  it("progress=0 scales BOTH range bounds to $0.00 in lockstep — they start and finish together, never independently", () => {
    expect(computeAnimatedDisplayPrice(rangeService({ price_min: 50, price_max: 90 }), formatPrice, 0)).toBe(
      "$0.00 – $0.00"
    );
  });

  it("a fractional progress scales the real stored number, never a hardcoded/precomputed intermediate value", () => {
    const service = fixedService({ fixed_price: 100 });
    expect(computeAnimatedDisplayPrice(service, formatPrice, 0.5)).toBe("$50.00");
    expect(computeAnimatedDisplayPrice(service, formatPrice, 0.25)).toBe("$25.00");
  });

  it("a range's two bounds stay proportionally scaled together at every progress value — never one bound animating ahead of the other", () => {
    const service = rangeService({ price_min: 40, price_max: 80 });
    expect(computeAnimatedDisplayPrice(service, formatPrice, 0.5)).toBe("$20.00 – $40.00");
  });
});

describe("prefersReducedMotion(): reads the real browser API, never a hardcoded value", () => {
  const originalWindow = globalThis.window;
  afterEach(() => {
    globalThis.window = originalWindow;
  });

  it("returns true when prefers-reduced-motion: reduce matches", () => {
    globalThis.window = { matchMedia: (query) => ({ matches: query === "(prefers-reduced-motion: reduce)" }) };
    expect(prefersReducedMotion()).toBe(true);
  });

  it("returns false when it does not match", () => {
    globalThis.window = { matchMedia: () => ({ matches: false }) };
    expect(prefersReducedMotion()).toBe(false);
  });

  it("never throws when window/matchMedia is unavailable — degrades to false, never assumes reduced motion by accident", () => {
    globalThis.window = undefined;
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe("wholesalePriceAnimation.js: hook wiring (structural — see this file's own header for why a real render isn't used here)", () => {
  it("useCountUpProgress starts at 1 immediately (no animation at all) when disabled OR prefers-reduced-motion is set — never starts at 0 and skips ahead, which would still flash intermediate frames", () => {
    expect(animSrc).toMatch(/useState\(\(\) => \(!enabled \|\| prefersReducedMotion\(\) \? 1 : 0\)\)/);
    expect(animSrc).toMatch(/if \(!enabled \|\| prefersReducedMotion\(\)\) \{\s*\n\s*setProgress\(1\);\s*\n\s*return;/);
  });

  it("uses requestAnimationFrame (never setInterval/setTimeout polling) and cancels it on unmount — no orphaned loop surviving a Consult Another/Back navigation away from the result screen", () => {
    expect(animSrc).toContain("requestAnimationFrame(tick)");
    expect(animSrc).toMatch(/return \(\) => \{\s*\n\s*if \(rafId != null\) cancelAnimationFrame\(rafId\);/);
    expect(animSrc).not.toContain("setInterval(");
  });

  it("progress is clamped to a max of 1 and eased with a cubic ease-out — smooth deceleration into the final value, never a linear/mechanical count, and never overshoots 1", () => {
    expect(animSrc).toContain("Math.min(1, (now - start) / durationMs)");
    expect(animSrc).toMatch(/function easeOutCubic\(t\) \{\s*\n\s*return 1 - Math\.pow\(1 - t, 3\);/);
  });

  it("the shared duration constant is within the requested 500–700ms window", () => {
    expect(SHOPCOST_COUNT_UP_DURATION_MS).toBeGreaterThanOrEqual(500);
    expect(SHOPCOST_COUNT_UP_DURATION_MS).toBeLessThanOrEqual(700);
  });
});

describe("WholesaleResultPanel.jsx: wires the animation in without ever recalculating the price, and disables it for 'quote'", () => {
  it("imports and calls useCountUpProgress, passing enabled=!isQuote", () => {
    expect(panelSrc).toContain(
      'import { computeAnimatedDisplayPrice, useCountUpProgress } from "../../lib/wholesalePriceAnimation.js";'
    );
    expect(panelSrc).toContain("const shopCostProgress = useCountUpProgress(undefined, !isQuote);");
  });

  it("the shop-cost value is rendered via computeAnimatedDisplayPrice(service, formatPrice, shopCostProgress) — the real service object and the real formatPrice function, never a duplicated/local formatter", () => {
    expect(panelSrc).toContain("{computeAnimatedDisplayPrice(service, formatPrice, shopCostProgress)}");
  });

  it("no leftover non-animated wholesaleDisplayPrice function — the animated version is the ONLY code path that formats the shop-cost value now", () => {
    expect(panelSrc).not.toContain("function wholesaleDisplayPrice");
    expect(panelSrc).not.toContain("wholesaleDisplayPrice(service, formatPrice)");
  });

  it("the hero carries the settle animation class, alongside its existing centered layout", () => {
    expect(panelSrc).toContain('<div className="wsp-result-shopcost-hero wsp-result-shopcost-settle">');
  });
});

describe("wholesalePortal.css: shop-cost hero is centered, and its once-only animations are fully disabled under prefers-reduced-motion", () => {
  it(".wsp-result-shopcost-hero centers both the label and the value (align-items + text-align), and is the containing block (position:relative, overflow:hidden) for the glow sweep", () => {
    const idx = cssSrc.indexOf(".wsp-result-shopcost-hero {");
    const block = cssSrc.slice(idx, cssSrc.indexOf("}", idx));
    expect(block).toMatch(/align-items:\s*center/);
    expect(block).toMatch(/text-align:\s*center/);
    expect(block).toMatch(/position:\s*relative/);
    expect(block).toMatch(/overflow:\s*hidden/);
  });

  it("the settle keyframe is a fade/scale, plays ONCE (no infinite/repeat keyword), and ends pixel-identical to the element's static styles (scale(1), opacity:1) — no visible snap when it finishes", () => {
    const idx = cssSrc.indexOf("@keyframes wsp-result-shopcost-settle {");
    expect(idx).toBeGreaterThan(-1);
    const block = cssSrc.slice(idx, cssSrc.indexOf("\n}\n", idx));
    expect(block).toMatch(/transform:\s*scale\(0\.98\)/);
    expect(block).toMatch(/transform:\s*scale\(1\)/);
    expect(cssSrc).not.toMatch(/\.wsp-result-shopcost-settle\s*\{[^}]*infinite/);
  });

  it("the glow sweep is a translucent blue band that fades back to fully transparent and stays there (animation-fill-mode: forwards) — never left stuck visible, never repeating", () => {
    const idx = cssSrc.indexOf("@keyframes wsp-result-shopcost-glow {");
    expect(idx).toBeGreaterThan(-1);
    const block = cssSrc.slice(idx, cssSrc.indexOf("\n}\n", idx));
    expect(block).toMatch(/opacity:\s*0;\s*\n\s*\}\s*\n\s*35%/); // starts at 0 opacity
    expect(block.trim().endsWith("opacity: 0;\n  }")).toBe(true); // ends at 0 opacity too
    const afterIdx = cssSrc.indexOf(".wsp-result-shopcost-hero::after {");
    const afterBlock = cssSrc.slice(afterIdx, cssSrc.indexOf("}", afterIdx));
    expect(afterBlock).toMatch(/pointer-events:\s*none/);
    expect(afterBlock).toMatch(/animation-fill-mode:\s*forwards/);
    expect(cssSrc).not.toMatch(/\.wsp-result-shopcost-hero::after\s*\{[^}]*infinite/);
  });

  it("both the settle and the glow are timed to start right as the ~600ms count-up finishes (animation-delay: 600ms) — never simultaneous with the counting itself", () => {
    const settleIdx = cssSrc.indexOf(".wsp-result-shopcost-settle {");
    const settleBlock = cssSrc.slice(settleIdx, cssSrc.indexOf("}", settleIdx));
    expect(settleBlock).toMatch(/animation-delay:\s*600ms/);
    const afterIdx = cssSrc.indexOf(".wsp-result-shopcost-hero::after {");
    const afterBlock = cssSrc.slice(afterIdx, cssSrc.indexOf("}", afterIdx));
    expect(afterBlock).toMatch(/animation-delay:\s*600ms/);
  });

  it("prefers-reduced-motion: reduce turns off BOTH the settle and the glow sweep entirely, resetting the glow's opacity to 0 so it can never render mid-sweep", () => {
    const mqIdx = cssSrc.indexOf("@media (prefers-reduced-motion: reduce) {\n  .wsp-result-shopcost-settle");
    expect(mqIdx).toBeGreaterThan(-1);
    const block = cssSrc.slice(mqIdx, mqIdx + 400);
    expect(block).toMatch(/\.wsp-result-shopcost-settle\s*\{\s*\n\s*animation:\s*none;/);
    expect(block).toMatch(/\.wsp-result-shopcost-hero::after\s*\{\s*\n\s*animation:\s*none;\s*\n\s*opacity:\s*0;/);
  });

  it("reuses the existing --wsp-blue rgba() channels already established elsewhere in this file for a translucent glow — no new arbitrary color", () => {
    const afterIdx = cssSrc.indexOf(".wsp-result-shopcost-hero::after {");
    const afterBlock = cssSrc.slice(afterIdx, cssSrc.indexOf("}", afterIdx));
    expect(afterBlock).toContain("rgba(37, 99, 235,");
    expect(cssSrc).toContain("rgba(37, 99, 235, 0.18)"); // same channels used by .wsp-wizard-step-active's box-shadow
  });
});
