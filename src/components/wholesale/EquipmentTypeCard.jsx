import { ChevronRight } from "lucide-react";
import { wholesaleEquipmentIcon } from "../../lib/wholesaleIcons.js";
import { useWholesaleLocale } from "../../i18n/WholesaleLocaleContext.jsx";
import { translateCatalogLabel } from "../../lib/wholesaleCatalogI18n.js";
import { playHoverTone } from "../../lib/wholesaleSound.js";

/** True only on devices that support a real mouse hover — touch devices get
 *  no hover sound at all (there's no "entering" a card on a touch screen),
 *  they get a tone on tap/select instead. Re-checked at call time rather
 *  than cached, matching the CSS (hover: hover) gate this mirrors. */
function isHoverCapable() {
  return typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
}

/**
 * Large photo card for the top-level grid — reused for both a real
 * Equipment Type and the special Microsoldering "lens" card (same visual
 * treatment, different click behavior decided entirely by the caller).
 * Falls back to the shared lucide-react icon mapping whenever `image` is
 * null (no cover photo uploaded yet, or its signed URL failed to resolve).
 *
 * `featured` marks the Microsoldering tile with a subtle distinguishing
 * accent (border/shadow only — never a larger size, per the approved spec).
 * `entity.name` is the raw, stored-in-English catalog name; it's translated
 * for display only via translateCatalogLabel, never mutated or sent
 * anywhere — the alt text and the click handler still see the original.
 */
export function EquipmentTypeCard({ entity, onClick, featured = false }) {
  const { language } = useWholesaleLocale();
  const Icon = wholesaleEquipmentIcon(entity);
  const displayName = translateCatalogLabel(entity.name, language);

  function handleEnter() {
    if (isHoverCapable()) playHoverTone();
  }
  function handleClick() {
    if (!isHoverCapable()) playHoverTone();
    onClick();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={handleEnter}
      onFocus={handleEnter}
      className={`wsp-card wsp-card-clickable w-full text-left${featured ? " wsp-card-featured" : ""}`}
    >
      <span className="wsp-card-accent" aria-hidden="true" />
      <div className="wsp-card-photo">
        {entity.image?.url ? (
          <img
            src={entity.image.url}
            alt={entity.image.alt_text || displayName}
            loading="lazy"
            width={400}
            height={300}
          />
        ) : (
          <Icon size={44} className="wsp-card-photo-icon" />
        )}
      </div>
      <div className="wsp-card-body flex items-center justify-between gap-2">
        <span className="wsp-card-title">{displayName}</span>
        <ChevronRight size={18} className="wsp-card-arrow" aria-hidden="true" />
      </div>
    </button>
  );
}
