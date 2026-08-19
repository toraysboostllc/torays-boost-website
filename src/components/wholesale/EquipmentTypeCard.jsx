import { ChevronRight } from "lucide-react";
import { wholesaleEquipmentIcon } from "../../lib/wholesaleIcons.js";
import { useWholesaleLocale } from "../../i18n/WholesaleLocaleContext.jsx";
import { translateCatalogLabel } from "../../lib/wholesaleCatalogI18n.js";
import { wholesaleHoverProps } from "../../lib/wholesaleSound.js";

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
  const hoverProps = wholesaleHoverProps(onClick);

  return (
    <button
      type="button"
      {...hoverProps}
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
