import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Logo } from "../components/ui/Logo.jsx";
import { Card } from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";
import { useSEO } from "../lib/seo.js";
import { fetchWholesaleCatalog, wholesaleLogout } from "../lib/wholesaleAuth.js";

function formatPrice(service) {
  if (service.pricing_type === "range") {
    const min = Number(service.price_min);
    const max = Number(service.price_max);
    return min === max ? `$${min.toFixed(2)}` : `$${min.toFixed(2)} – $${max.toFixed(2)}`;
  }
  return `$${Number(service.fixed_price).toFixed(2)}`;
}

export function WholesalePrices() {
  useSEO({ title: "Wholesale Prices", noindex: true });
  const navigate = useNavigate();

  const [state, setState] = useState({ status: "loading", shopName: "", categories: [] });

  useEffect(() => {
    // No local session check possible (or needed) — ws_session is an
    // HttpOnly cookie the browser sends automatically. If it's missing or
    // expired, the API just returns 401 and we redirect from there.
    fetchWholesaleCatalog().then((result) => {
      if (!result.ok) {
        navigate("/wholesale");
        return;
      }
      setState({ status: "ready", shopName: result.shopName, categories: result.categories });
    });
  }, [navigate]);

  async function handleLogout() {
    await wholesaleLogout();
    navigate("/wholesale");
  }

  if (state.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-torays-text-secondary">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-5 py-12 sm:px-8">
      <div className="flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-torays-text-secondary">{state.shopName}</span>
          <Button variant="outline" size="md" icon={LogOut} onClick={handleLogout}>
            Log Out
          </Button>
        </div>
      </div>

      <h1 className="font-heading text-2xl font-semibold text-torays-text sm:text-3xl">Wholesale Prices</h1>

      {state.categories.length === 0 && (
        <Card>
          <p className="text-sm text-torays-text-secondary">No prices have been added yet.</p>
        </Card>
      )}

      {state.categories.map((category) => (
        <Card key={category.id} className="overflow-hidden p-0">
          <div className="border-b border-torays-line px-6 py-4">
            <h2 className="font-heading text-base font-semibold text-torays-text">{category.name}</h2>
            {category.notes && <p className="mt-1 text-xs italic text-torays-text-secondary">{category.notes}</p>}
            {category.diagnostic_fee != null && (
              <p className="mt-1 text-xs text-torays-text-secondary">
                Diagnostic fee: <span className="font-semibold text-torays-text">${Number(category.diagnostic_fee).toFixed(2)}</span>
                {category.diagnostic_description ? ` — ${category.diagnostic_description}` : ""}
              </p>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-torays-text-muted">
                  <th className="px-6 py-3 font-medium">Service</th>
                  <th className="px-6 py-3 font-medium">Price</th>
                  <th className="px-6 py-3 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {category.services.map((service) => (
                  <tr key={service.id} className="border-t border-torays-line">
                    <td className="px-6 py-3 text-torays-text">{service.name}</td>
                    <td className="px-6 py-3 font-semibold text-torays-text">{formatPrice(service)}</td>
                    <td className="px-6 py-3 text-torays-text-secondary">{service.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}
