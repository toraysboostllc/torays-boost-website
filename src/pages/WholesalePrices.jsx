import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Logo } from "../components/ui/Logo.jsx";
import { useSEO } from "../lib/seo.js";
import { fetchWholesaleCatalog, wholesaleLogout } from "../lib/wholesaleAuth.js";
import { EquipmentTypeCard } from "../components/wholesale/EquipmentTypeCard.jsx";
import { CategoryDrilldown } from "../components/wholesale/CategoryDrilldown.jsx";
import { MicrosolderingLensView } from "../components/wholesale/MicrosolderingLensView.jsx";

export function WholesalePrices() {
  useSEO({ title: "Wholesale Prices", noindex: true });
  const navigate = useNavigate();

  // status: "loading" | "ready". view: "grid" | an equipmentTypes[].id | "microsoldering".
  const [state, setState] = useState({ status: "loading", shopName: "", equipmentTypes: [], microsoldering: null });
  const [view, setView] = useState("grid");

  useEffect(() => {
    // No local session check possible (or needed) — ws_session is an
    // HttpOnly cookie the browser sends automatically. If it's missing or
    // expired, the API just returns 401 and we redirect from there.
    fetchWholesaleCatalog().then((result) => {
      if (!result.ok) {
        navigate("/wholesale");
        return;
      }
      setState({
        status: "ready",
        shopName: result.shopName,
        equipmentTypes: result.equipmentTypes,
        microsoldering: result.microsoldering,
      });
    });
  }, [navigate]);

  async function handleLogout() {
    await wholesaleLogout();
    navigate("/wholesale");
  }

  if (state.status === "loading") {
    return (
      <div className="wsp-scope flex min-h-screen items-center justify-center">
        <p className="wsp-text-soft">Loading…</p>
      </div>
    );
  }

  const selectedEquipmentType =
    typeof view === "string" && view !== "grid" && view !== "microsoldering"
      ? state.equipmentTypes.find((et) => et.id === view)
      : null;

  return (
    <div className="wsp-scope">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-10 sm:px-8">
        <div className="flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-4">
            <span className="wsp-text-soft text-sm font-medium">{state.shopName}</span>
            <button type="button" onClick={handleLogout} className="wsp-btn wsp-btn-ghost">
              <LogOut size={16} />
              Log Out
            </button>
          </div>
        </div>

        {view === "grid" && (
          <>
            <h1 className="text-2xl font-bold sm:text-3xl">Wholesale Prices</h1>

            {state.equipmentTypes.length === 0 && !state.microsoldering && (
              <div className="wsp-empty">No prices have been added yet.</div>
            )}

            <div className="wsp-grid">
              {state.equipmentTypes.map((equipmentType) => (
                <EquipmentTypeCard
                  key={equipmentType.id}
                  entity={equipmentType}
                  onClick={() => setView(equipmentType.id)}
                />
              ))}
              {state.microsoldering && (
                <EquipmentTypeCard
                  entity={{ slug: "microsoldering", name: "Microsoldering", image: state.microsoldering.image }}
                  onClick={() => setView("microsoldering")}
                />
              )}
            </div>
          </>
        )}

        {selectedEquipmentType && (
          <CategoryDrilldown equipmentType={selectedEquipmentType} onBack={() => setView("grid")} />
        )}

        {view === "microsoldering" && state.microsoldering && (
          <MicrosolderingLensView microsoldering={state.microsoldering} onBack={() => setView("grid")} />
        )}
      </div>
    </div>
  );
}
