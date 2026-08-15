import { ArrowLeft } from "lucide-react";
import { wholesaleEquipmentIcon } from "../../lib/wholesaleIcons.js";
import { formatWholesalePrice } from "../../lib/wholesalePricing.js";

/** Equipment Type drill-down: its categories (with cover photo, notes,
 *  diagnostic fee) each followed by their service/price table — the same
 *  table the portal already had, restyled onto the dark scoped theme. */
export function CategoryDrilldown({ equipmentType, onBack }) {
  return (
    <div className="flex flex-col gap-6">
      <button type="button" onClick={onBack} className="wsp-btn wsp-btn-ghost self-start">
        <ArrowLeft size={16} />
        Back
      </button>

      <h2 className="text-xl font-bold sm:text-2xl">{equipmentType.name}</h2>

      {equipmentType.categories.length === 0 && (
        <div className="wsp-empty">No prices have been added for this equipment type yet.</div>
      )}

      {equipmentType.categories.map((category) => {
        const Icon = wholesaleEquipmentIcon(category);
        return (
          <div key={category.id} className="wsp-card">
            <div className="flex items-center gap-3 p-4" style={{ borderBottom: "1px solid var(--wsp-border)" }}>
              <div className="wsp-category-photo">
                {category.image?.url ? (
                  <img
                    src={category.image.url}
                    alt={category.image.alt_text || category.name}
                    loading="lazy"
                    width={64}
                    height={64}
                  />
                ) : (
                  <Icon size={22} className="wsp-card-photo-icon" />
                )}
              </div>
              <div>
                <h3 className="text-[15px] font-semibold">{category.name}</h3>
                {category.notes && <p className="wsp-text-soft mt-0.5 text-xs italic">{category.notes}</p>}
                {category.diagnostic_fee != null && (
                  <p className="wsp-text-soft mt-0.5 text-xs">
                    Diagnostic fee:{" "}
                    <span style={{ color: "var(--wsp-text-strong)" }} className="font-semibold">
                      ${Number(category.diagnostic_fee).toFixed(2)}
                    </span>
                    {category.diagnostic_description ? ` — ${category.diagnostic_description}` : ""}
                  </p>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="wsp-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Price</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {category.services.map((service) => (
                    <tr key={service.id}>
                      <td>{service.name}</td>
                      <td className="font-semibold">{formatWholesalePrice(service)}</td>
                      <td className="wsp-text-soft">{service.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
