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

const VARIANT_CLASSES = {
  header:
    "hidden md:inline-flex items-center gap-2 rounded-full border border-torays-navy/25 bg-torays-navy/5 px-3.5 py-2 min-h-11 transition-colors hover:bg-torays-navy/10 hover:border-torays-navy/40",
  mobile:
    "flex w-full items-center gap-3 rounded-2xl border border-torays-navy/25 bg-torays-navy/5 px-5 py-3.5 min-h-11 transition-colors hover:bg-torays-navy/10",
  hero: "inline-flex items-center gap-1.5 min-h-11 text-xs font-medium text-torays-text-muted transition-colors hover:text-torays-navy",
};

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-torays-red/60 focus-visible:ring-offset-2 focus-visible:ring-offset-torays-bg";

export function WholesalePortalLink({ variant = "header", onClick, className = "" }) {
  if (variant === "hero") {
    return (
      <Link
        to="/wholesale"
        aria-label={ARIA_LABEL}
        onClick={onClick}
        className={`${VARIANT_CLASSES.hero} ${FOCUS_RING} rounded-full ${className}`}
      >
        <Store size={14} />
        <span>
          <span className="font-heading font-semibold text-torays-navy">Torays Boost Pro</span> — For Repair Shops
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
      className={`${VARIANT_CLASSES[variant]} ${FOCUS_RING} ${className}`}
    >
      <span className={`relative flex ${iconBoxSize} flex-shrink-0 items-center justify-center rounded-full bg-torays-navy/10 text-torays-navy`}>
        <Store size={iconSize} />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-torays-red ring-2 ring-torays-bg" />
      </span>
      <span className="flex flex-col leading-tight text-left">
        <span className={`font-heading font-semibold text-torays-navy ${variant === "mobile" ? "text-base" : "text-xs"}`}>
          Torays Boost Pro
        </span>
        <span className={`text-torays-text-muted ${variant === "mobile" ? "text-xs" : "text-[10px]"}`}>
          For Repair Shops
        </span>
      </span>
    </Link>
  );
}
