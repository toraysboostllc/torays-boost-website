import { wholesaleEquipmentIcon } from "../../lib/wholesaleIcons.js";

/**
 * Large photo card for the top-level grid — reused for both a real
 * Equipment Type and the special Microsoldering "lens" card (same visual
 * treatment, different click behavior decided entirely by the caller).
 * Falls back to the shared lucide-react icon mapping whenever `image` is
 * null (no cover photo uploaded yet, or its signed URL failed to resolve).
 */
export function EquipmentTypeCard({ entity, onClick }) {
  const Icon = wholesaleEquipmentIcon(entity);
  return (
    <button type="button" onClick={onClick} className="wsp-card wsp-card-clickable w-full text-left">
      <div className="wsp-card-photo">
        {entity.image?.url ? (
          <img
            src={entity.image.url}
            alt={entity.image.alt_text || entity.name}
            loading="lazy"
            width={400}
            height={300}
          />
        ) : (
          <Icon size={48} className="wsp-card-photo-icon" />
        )}
      </div>
      <div className="wsp-card-body">
        <span className="wsp-card-title">{entity.name}</span>
      </div>
    </button>
  );
}
