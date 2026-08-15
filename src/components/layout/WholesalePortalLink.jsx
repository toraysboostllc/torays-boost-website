import { Link } from "react-router-dom";
import { Store } from "lucide-react";

/**
 * The one public entry point into the private wholesale/repair-shop portal
 * (/wholesale). Never linked to an absolute URL, a Preview domain, or
 * `target="_blank"` — this is internal SPA navigation, same tab, so
 * react-router-dom's <Link> picks it up without a full page reload. It
 * never fetches anything itself (no wholesale API import here at all) —
 * the portal's own login screen is what starts that flow, only after the
 * shop actually lands on /wholesale.
 *
 * Three variants, one shared aria-label/destination, sized differently per
 * placement (see the header/Hero/mobile-menu call sites):
 *  - "header": compact chip before the WhatsApp button, desktop only.
 *  - "mobile": full-width tappable row in the mobile drawer.
 *  - "hero": a discreet secondary text link near the Hero's two CTAs.
 */
const ARIA_LABEL = "Torays Boost Pro — For Repair Shops";

// XP-style glossy green relief — same gradient/inset-highlight/press idiom
// already approved for the wholesale portal's own buttons (see
// .wsp-btn-primary in src/styles/wholesalePortal.css), reproduced here as
// Tailwind arbitrary values since this component has no dedicated
// stylesheet. Brightness-based hover/active (not a color swap) keeps a
// single gradient definition instead of a second hover gradient to hand-tune.
const GREEN_XP =
  "text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.25)] bg-[linear-gradient(180deg,#4ecb82_0%,#1e9e56_48%,#0b5c30_100%)] border border-[#0b6b38]/60 shadow-[0_1px_0_rgba(255,255,255,0.35)_inset,0_2px_6px_rgba(6,40,20,0.35)] transition-[filter,box-shadow,transform] duration-150 hover:brightness-110 active:translate-y-px active:brightness-95";

const VARIANT_CLASSES = {
  header: "hidden md:inline-flex items-center gap-2 rounded-full px-3.5 py-2 min-h-11",
  mobile: "flex w-full items-center gap-3 rounded-2xl px-5 py-3.5 min-h-11",
  hero: "inline-flex items-center gap-1.5 min-h-11 rounded-full px-3 py-1.5 text-xs font-medium",
};

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-torays-red/60 focus-visible:ring-offset-2 focus-visible:ring-offset-torays-bg";

export function WholesalePortalLink({ variant = "header", onClick, className = "" }) {
  if (variant === "hero") {
    return (
      <Link
        to="/wholesale"
        aria-label={ARIA_LABEL}
        onClick={onClick}
        className={`${VARIANT_CLASSES.hero} ${GREEN_XP} ${FOCUS_RING} ${className}`}
      >
        <Store size={14} />
        <span className="text-white/90">
          <span className="font-heading font-semibold text-white">Torays Boost Pro</span> — For Repair Shops
        </span>
      </Link>
    );
  }

  const iconBoxSize = variant === "mobile" ? "h-10 w-10" : "h-7 w-7";
  const iconSize = variant === "mobile" ? 18 : 15;

  return (
    <Link
      to="/wholesale"
      aria-label={ARIA_LABEL}
      onClick={onClick}
      className={`${VARIANT_CLASSES[variant]} ${GREEN_XP} ${FOCUS_RING} ${className}`}
    >
      <span className={`relative flex ${iconBoxSize} flex-shrink-0 items-center justify-center rounded-full bg-white/20 text-white`}>
        <Store size={iconSize} />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-torays-red ring-2 ring-white/90" />
      </span>
      <span className="flex flex-col leading-tight text-left">
        <span className={`font-heading font-semibold text-white ${variant === "mobile" ? "text-base" : "text-xs"}`}>
          Torays Boost Pro
        </span>
        <span className={`text-white/80 ${variant === "mobile" ? "text-xs" : "text-[10px]"}`}>
          For Repair Shops
        </span>
      </span>
    </Link>
  );
}
