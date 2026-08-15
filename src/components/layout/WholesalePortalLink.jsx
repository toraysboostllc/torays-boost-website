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
 * Two variants, one shared aria-label/destination, sized differently per
 * placement (see the header/mobile-menu call sites):
 *  - "header": compact chip before the WhatsApp CTA, desktop only.
 *  - "mobile": full-width tappable row in the mobile drawer.
 */
const ARIA_LABEL = "Torays Boost Pro — For Repair Shops";

// XP-style glossy light-purple relief. Text is a dark, near-black purple
// (not white — white fails WCAG contrast against a light gradient),
// verified >=5.68:1 against every gradient stop in both the base and hover
// backgrounds (darkest hover stop is capped at the same value as the base
// gradient's darkest stop, so hover never drops contrast below the base
// state). The small red dot is the Torays brand accent, kept unchanged.
const PURPLE_XP_LIGHT =
  "text-[#3b0764] [text-shadow:0_1px_0_rgba(255,255,255,0.4)] bg-[linear-gradient(180deg,#f3e8ff_0%,#d8b4fe_48%,#c084fc_100%)] border border-[#7e22ce]/50 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_2px_6px_rgba(60,10,90,0.18)] transition-[filter,box-shadow,transform] duration-150 hover:bg-[linear-gradient(180deg,#ead1ff_0%,#c9a3fe_48%,#c084fc_100%)] active:translate-y-px active:brightness-95";

const VARIANT_CLASSES = {
  header: "hidden md:inline-flex items-center gap-2 rounded-full px-3.5 py-2 min-h-11",
  mobile: "flex w-full items-center gap-3 rounded-2xl px-5 py-3.5 min-h-11",
};

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-torays-red/60 focus-visible:ring-offset-2 focus-visible:ring-offset-torays-bg";

export function WholesalePortalLink({ variant = "header", onClick, className = "" }) {
  const iconBoxSize = variant === "mobile" ? "h-10 w-10" : "h-7 w-7";
  const iconSize = variant === "mobile" ? 18 : 15;

  return (
    <Link
      to="/wholesale"
      aria-label={ARIA_LABEL}
      onClick={onClick}
      className={`${VARIANT_CLASSES[variant]} ${PURPLE_XP_LIGHT} ${FOCUS_RING} ${className}`}
    >
      <span className={`relative flex ${iconBoxSize} flex-shrink-0 items-center justify-center rounded-full bg-[#3b0764]/10 text-[#3b0764]`}>
        <Store size={iconSize} />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-torays-red ring-2 ring-white/90" />
      </span>
      <span className="flex flex-col leading-tight text-left">
        <span className={`font-heading font-semibold text-[#3b0764] ${variant === "mobile" ? "text-base" : "text-xs"}`}>
          Torays Boost Pro
        </span>
        <span className={`text-[#3b0764] ${variant === "mobile" ? "text-xs" : "text-[10px]"}`}>
          For Repair Shops
        </span>
      </span>
    </Link>
  );
}
