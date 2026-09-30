import { Link } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext.jsx";

/**
 * Public entry point into the online store (/tienda). Took over the exact
 * spot — and the exact look — of the old "Torays Boost Pro" chip, so the
 * header keeps its layout; only the destination and copy changed. Internal
 * SPA navigation via <Link>, same tab, nothing fetched before a click.
 *
 * /wholesale itself is deliberately still routed in App.jsx (the owner
 * retires it separately, after Wholesale leaves the DESK) — this component
 * just stops advertising it.
 *
 * Two variants, sized per placement:
 *  - "header": compact chip before the WhatsApp CTA, desktop only.
 *  - "mobile": full-width tappable row in the mobile drawer.
 */

// Same XP-style glossy light-purple relief the Pro chip used (contrast of
// the dark text verified >=5.68:1 against every stop, base and hover).
const PURPLE_XP_LIGHT =
  "text-[#3b0764] [text-shadow:0_1px_0_rgba(255,255,255,0.4)] bg-[linear-gradient(180deg,#f3e8ff_0%,#d8b4fe_48%,#c084fc_100%)] border border-[#7e22ce]/50 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_2px_6px_rgba(60,10,90,0.18)] transition-[filter,box-shadow,transform] duration-150 hover:bg-[linear-gradient(180deg,#ead1ff_0%,#c9a3fe_48%,#c084fc_100%)] active:translate-y-px active:brightness-95";

const VARIANT_CLASSES = {
  header: "hidden md:inline-flex items-center gap-2 rounded-full px-3.5 py-2 min-h-11",
  mobile: "flex w-full items-center gap-3 rounded-2xl px-5 py-3.5 min-h-11",
};

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-torays-red/60 focus-visible:ring-offset-2 focus-visible:ring-offset-torays-bg";

export function ShopLink({ variant = "header", onClick, className = "" }) {
  const { t } = useLanguage();
  const iconBoxSize = variant === "mobile" ? "h-10 w-10" : "h-7 w-7";
  const iconSize = variant === "mobile" ? 18 : 15;

  return (
    <Link
      to="/tienda"
      aria-label={t("nav.shopAria")}
      onClick={onClick}
      className={`${VARIANT_CLASSES[variant]} ${PURPLE_XP_LIGHT} ${FOCUS_RING} ${className}`}
    >
      <span className={`relative flex ${iconBoxSize} flex-shrink-0 items-center justify-center rounded-full bg-[#3b0764]/10 text-[#3b0764]`}>
        <ShoppingBag size={iconSize} />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-torays-red ring-2 ring-white/90" />
      </span>
      <span className="flex flex-col leading-tight text-left">
        <span className={`font-heading font-semibold text-[#3b0764] ${variant === "mobile" ? "text-base" : "text-xs"}`}>
          {t("nav.shop")}
        </span>
        <span className={`text-[#3b0764] ${variant === "mobile" ? "text-xs" : "text-[10px]"}`}>
          {t("nav.shopSub")}
        </span>
      </span>
    </Link>
  );
}
