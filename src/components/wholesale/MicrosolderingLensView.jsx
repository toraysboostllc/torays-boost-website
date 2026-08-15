import { ArrowLeft } from "lucide-react";
import { formatWholesalePrice } from "../../lib/wholesalePricing.js";

/**
 * The Microsoldering "lens" card's drill-down: not a real Equipment Type
 * with its own categories — it groups whatever ACTIVE services are tagged
 * Microsoldering, by their REAL Equipment Type -> category, reusing exactly
 * the data the normal grid already fetched (never a separate/looser query).
 * `microsoldering.equipmentTypes` is `[]` whenever no active service is
 * currently tagged — rendered as a professional empty state, no further
 * navigation implied, per spec.
 */
export function MicrosolderingLensView({ microsoldering, onBack }) {
  const hasResults = microsoldering.equipmentTypes.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <button type="button" onClick={onBack} className="wsp-btn wsp-btn-ghost self-start">
        <ArrowLeft size={16} />
        Back
      </button>

      <h2 className="text-xl font-bold sm:text-2xl">Microsoldering</h2>

      {!hasResults && <div className="wsp-empty">No Microsoldering services are currently available.</div>}

      {microsoldering.equipmentTypes.map((equipmentType) => (
        <div key={equipmentType.id} className="flex flex-col gap-3">
          <h3 className="wsp-text-soft text-xs font-semibold uppercase tracking-wide">{equipmentType.name}</h3>
          {equipmentType.categories.map((category) => (
            <div key={category.id} className="wsp-card">
              <div className="p-4" style={{ borderBottom: "1px solid var(--wsp-card-border)" }}>
                <h4 className="text-[14px] font-semibold">{category.name}</h4>
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
                        <td className="wsp-card-text-soft">{service.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
