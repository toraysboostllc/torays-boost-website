import { MessageCircle } from "lucide-react";
import { buildContactLink } from "../../lib/whatsapp.js";

/**
 * Header/mobile-drawer WhatsApp entry point — light green XP-style relief.
 * Text is a dark, near-black green (not white — white fails WCAG contrast
 * against a light gradient), verified >=8.5:1 against every gradient stop
 * in both the base and hover backgrounds (darkest hover stop is capped at
 * the same value as the base gradient's darkest stop, so hover never drops
 * contrast below the base state). Same wa.me destination as before this
 * restyle — only the visual treatment changed.
 */
const GREEN_XP_LIGHT =
  "text-[#052e16] [text-shadow:0_1px_0_rgba(255,255,255,0.4)] bg-[linear-gradient(180deg,#eafbf0_0%,#86efac_48%,#4ade80_100%)] border border-[#16a34a]/50 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_2px_6px_rgba(6,60,20,0.18)] transition-[filter,box-shadow,transform] duration-150 hover:bg-[linear-gradient(180deg,#d2f8df_0%,#5ee28c_48%,#4ade80_100%)] active:translate-y-px active:brightness-95";

const VARIANT_CLASSES = {
  header: "hidden md:inline-flex items-center gap-2 rounded-full px-4 py-2 min-h-11",
  mobile: "flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 min-h-11",
};

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-torays-red/60 focus-visible:ring-offset-2 focus-visible:ring-offset-torays-bg";

export function WhatsAppCta({ variant = "header", onClick, className = "" }) {
  const iconSize = variant === "mobile" ? 18 : 15;

  return (
    <a
      href={buildContactLink()}
      target="_blank"
      rel="noreferrer"
      onClick={onClick}
      className={`${VARIANT_CLASSES[variant]} ${GREEN_XP_LIGHT} ${FOCUS_RING} ${className}`}
    >
      <MessageCircle size={iconSize} />
      <span className={`font-heading font-semibold ${variant === "mobile" ? "text-base" : "text-sm"}`}>WhatsApp</span>
    </a>
  );
}
