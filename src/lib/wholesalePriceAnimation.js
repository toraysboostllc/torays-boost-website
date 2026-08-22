import { useEffect, useState } from "react";

/** Coupled 1:1 with the CSS animation-delay on .wsp-result-shopcost-hero's
 *  ::after (the glow sweep) and .wsp-result-shopcost-settle (the fade/scale)
 *  in wholesalePortal.css — both are timed to start right as the count-up
 *  finishes. Change this and update those two `animation-delay` values to
 *  match. Within the requested 500–700ms range. */
export const SHOPCOST_COUNT_UP_DURATION_MS = 600;

/** Standard ease-out cubic — decelerates into the final value instead of a
 *  linear/mechanical count, which is what "transición suave" calls for. */
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Drives a single once-only count-up from 0 to 1, via requestAnimationFrame,
 *  eased with easeOutCubic. Renders the FINAL, real value immediately (no
 *  animation at all) when the user has prefers-reduced-motion: reduce set —
 *  this is a JS-level check because a CSS `animation: none` override alone
 *  cannot stop a requestAnimationFrame loop.
 *
 *  The very last frame sets progress to EXACTLY 1 (elapsed clamped to
 *  durationMs, and easeOutCubic(1) === 1 by construction — 1 - 0^3), so
 *  `realValue * progress` at completion is `realValue * 1`, an IEEE-754
 *  no-op — the animation can never end even a fraction of a cent off from
 *  the real, unmodified price the pricing engine returned. See
 *  computeAnimatedDisplayPrice below, the only place progress is actually
 *  applied to a price.
 *
 *  `enabled=false` (the 'quote' pricing type, which never displays a
 *  numeric shop-cost value at all) skips the RAF loop entirely and stays at
 *  1 — no wasted animation work for a number nothing renders. Rules of
 *  Hooks still allow the CALLER to invoke this hook unconditionally on
 *  every render; `enabled` is what actually turns the work off. */
export function useCountUpProgress(durationMs = SHOPCOST_COUNT_UP_DURATION_MS, enabled = true) {
  const [progress, setProgress] = useState(() => (!enabled || prefersReducedMotion() ? 1 : 0));

  useEffect(() => {
    if (!enabled || prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    let rafId = null;
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / durationMs);
      setProgress(easeOutCubic(t));
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      }
    }
    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
    };
    // Deliberately no dependency on prefersReducedMotion()'s own return
    // value — it's read once per mount, matching the "animate exactly once
    // per result" requirement; a user toggling the OS setting mid-animation
    // is an edge case out of scope, same as every other one-shot reveal
    // already in this file (see wsp-result-money-reveal).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMs, enabled]);

  return progress;
}

/** Pure, side-effect-free — the ONLY place a price number is ever scaled
 *  for this animation, and only ever by `progress` (0..1), never by any
 *  other factor. At progress=1 (animation complete, or reduced-motion,
 *  which starts AND stays at 1) this returns byte-identical output to
 *  calling formatPrice on the real, untouched service field(s) — same
 *  fixed_price/price_min/price_max the non-animated pricing engine already
 *  computed, same formatPrice function, zero re-derivation of the price
 *  itself. 'quote' has nothing to animate (WholesaleResultPanel never even
 *  mounts this UI for that pricing_type — the isQuote branch shows the
 *  diagnostic note instead), so it simply returns null here too, matching
 *  the non-animated wholesaleDisplayPrice's own contract. */
export function computeAnimatedDisplayPrice(service, formatPrice, progress = 1) {
  if (service.pricing_type === "fixed") {
    return formatPrice(service.fixed_price * progress);
  }
  if (service.pricing_type === "range") {
    return `${formatPrice(service.price_min * progress)} – ${formatPrice(service.price_max * progress)}`;
  }
  return null; // quote
}
