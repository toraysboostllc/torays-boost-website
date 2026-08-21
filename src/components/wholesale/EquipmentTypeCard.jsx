import { useEffect, useState } from "react";
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
 * null (no cover photo uploaded yet, or its signed URL failed to resolve
 * server-side) OR whenever a URL WAS provided but the browser fails to
 * actually load it (onError below) — e.g. the signed Storage URL's 5-minute
 * TTL (see IMAGE_SIGN_TTL_SECONDS in api/_lib/wholesaleDb.js) has expired
 * because the shop kept this screen open past that window, or the object
 * itself 404s. Before this fix there was no onError handler at all, so a
 * failed load fell through to the bare browser broken-image icon with the
 * raw alt text sitting inside the card — this makes that same failure
 * degrade to the exact same icon fallback a missing image already uses.
 *
 * `featured` marks the Microsoldering tile with a subtle distinguishing
 * accent (border/shadow only — never a larger size, per the approved spec).
 *
 * Display name is a three-tier fallback, in order: `entity.nameEs` (typed
 * into DESK directly — see wholesale_equipment_types.name_es, the dynamic-
 * equipment-types migration) when present and we're in Spanish; else the
 * legacy hardcoded translateCatalogLabel dictionary (kept only as a fallback
 * for the small set of pre-existing cards that already have an entry there
 * and haven't had name_es filled in yet); else the raw, stored-in-English
 * `entity.name`. `entity.name` itself is NEVER mutated or sent anywhere —
 * the alt text and the click handler always see the original.
 *
 * Full-bleed (photo covers the whole card edge-to-edge, bottom gradient
 * scrim, title/arrow overlaid) is driven entirely by `entity.fullBleedPhoto`
 * (a DESK-editable boolean — see wholesale_equipment_types.full_bleed_photo)
 * and `entity.imageFocusX`/`entity.imageFocusY` (normalized 0-100 crop-focus
 * point DESK's admin UI sets via a visual grid/drag control, never typed
 * CSS — see wholesale_equipment_types.image_focus_x/image_focus_y). There is
 * deliberately no hardcoded slug map here: any card, present or future, gets
 * this treatment purely by what its own database row says.
 */
export function EquipmentTypeCard({ entity, onClick, featured = false }) {
  const { language } = useWholesaleLocale();
  const Icon = wholesaleEquipmentIcon(entity);
  const displayName =
    language === "es" && entity.nameEs && entity.nameEs.trim()
      ? entity.nameEs.trim()
      : translateCatalogLabel(entity.name, language);
  const hoverProps = wholesaleHoverProps(onClick);
  const imageUrl = entity.image?.url || null;

  // Tracks the URL this card has already given up on, keyed by value (not
  // just a boolean) so a fresh catalog fetch with a NEW signed URL for the
  // same entity gets a real chance to load again instead of staying stuck
  // on the icon forever. Comparing to imageUrl on every render — rather
  // than a bare boolean flipped once — is what keeps onError from ever
  // being able to loop: once `src` fails, the element re-renders with the
  // icon instead of the <img>, so there is no failed <img> left in the DOM
  // to fire a second error event.
  const [failedUrl, setFailedUrl] = useState(null);
  useEffect(() => {
    setFailedUrl(null);
  }, [imageUrl]);

  const showImage = imageUrl && imageUrl !== failedUrl;
  // Only takes effect when there's actually a photo to show — with no
  // image (or a failed one), this card falls back to the exact same icon
  // treatment as every other card, never a "full bleed" empty/icon card.
  const isFullBleed = Boolean(entity.fullBleedPhoto) && showImage;
  const focusX = Number.isFinite(entity.imageFocusX) ? entity.imageFocusX : 50;
  const focusY = Number.isFinite(entity.imageFocusY) ? entity.imageFocusY : 50;

  return (
    <button
      type="button"
      {...hoverProps}
      className={`wsp-card wsp-card-clickable w-full text-left${featured ? " wsp-card-featured" : ""}${isFullBleed ? " wsp-card-fullbleed" : ""}`}
    >
      <span className="wsp-card-accent" aria-hidden="true" />
      <div className="wsp-card-photo">
        {showImage ? (
          <img
            src={imageUrl}
            alt={entity.image.alt_text || displayName}
            loading="lazy"
            width={400}
            height={300}
            style={isFullBleed ? { objectPosition: `${focusX}% ${focusY}%` } : undefined}
            onError={() => setFailedUrl(imageUrl)}
          />
        ) : (
          <Icon size={44} className="wsp-card-photo-icon" aria-hidden="true" />
        )}
      </div>
      {isFullBleed && <span className="wsp-card-fullbleed-gradient" aria-hidden="true" />}
      <div className="wsp-card-body flex items-center justify-between gap-2">
        <span className="wsp-card-title">{displayName}</span>
        <ChevronRight size={18} className="wsp-card-arrow" aria-hidden="true" />
      </div>
    </button>
  );
}
