import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { Package, Receipt, BarChart3, Settings, LogOut, Lock, Loader2 } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext.jsx";
import { useSEO } from "../../../lib/seo.js";
import { shopApi } from "../../../lib/shopApi.js";
import { ShopShell, BTN, INPUT, PANEL, FOCUS } from "../../../components/shop/ShopLayout.jsx";
import { AdminProducts } from "./AdminProducts.jsx";
import { ProductEditor } from "./ProductEditor.jsx";
import { AdminOrders } from "./AdminOrders.jsx";
import { AdminOrderDetail } from "./AdminOrderDetail.jsx";
import { AdminSales } from "./AdminSales.jsx";
import { AdminSettings } from "./AdminSettings.jsx";

function Login({ onDone }) {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    try {
      await shopApi.adminLogin(email, password);
      onDone();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={`${PANEL} mx-auto mt-6 max-w-sm space-y-3`}>
      <div className="flex items-center gap-2 text-torays-navy">
        <Lock size={18} />
        <h1 className="font-heading text-xl font-bold">{t("shop.admin.signIn")}</h1>
      </div>
      <p className="text-sm text-torays-text-secondary">{t("shop.admin.signInText")}</p>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-torays-text-secondary">{t("shop.admin.email")}</span>
        <input className={INPUT} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-torays-text-secondary">{t("shop.admin.password")}</span>
        <input className={INPUT} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </label>
      {error && (
        <p role="alert" className="text-sm font-medium text-torays-red-dark">
          {t("shop.admin.badLogin")}
        </p>
      )}
      <button type="submit" className={`${BTN.dark} w-full`} disabled={busy}>
        {busy ? <Loader2 size={18} className="animate-spin" /> : t("shop.admin.signIn")}
      </button>
    </form>
  );
}

const NAV = [
  ["/tienda/admin", "products", Package, true],
  ["/tienda/admin/pedidos", "orders", Receipt, false],
  ["/tienda/admin/ventas", "sales", BarChart3, false],
  ["/tienda/admin/ajustes", "settings", Settings, false],
];

export function ShopAdmin() {
  const { t } = useLanguage();
  useSEO({ title: t("shop.admin.title"), noindex: true });
  const [me, setMe] = useState(undefined);

  const refresh = () =>
    shopApi
      .adminMe()
      .then(setMe)
      .catch(() => setMe(null));
  useEffect(() => {
    refresh();
  }, []);

  if (me === undefined) {
    return (
      <ShopShell admin>
        <div className="flex justify-center py-20 text-torays-text-muted">
          <Loader2 className="animate-spin" />
        </div>
      </ShopShell>
    );
  }
  if (!me) {
    return (
      <ShopShell admin>
        <Login onDone={refresh} />
      </ShopShell>
    );
  }

  return (
    <ShopShell admin>
      <div className="grid gap-4 lg:grid-cols-[210px_1fr] lg:gap-6">
        <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-torays-line px-4 pb-2 lg:mx-0 lg:flex-col lg:self-start lg:rounded-2xl lg:border lg:bg-torays-surface lg:p-2" aria-label={t("shop.admin.title")}>
          {NAV.map(([to, key, Icon, end]) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-medium ${FOCUS} ${
                  isActive ? "bg-torays-surface-alt font-semibold text-torays-navy lg:bg-torays-bg" : "text-torays-text-secondary hover:text-torays-text"
                }`
              }
            >
              <Icon size={17} /> {t(`shop.admin.nav.${key}`)}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => shopApi.adminLogout().finally(() => setMe(null))}
            className={`inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm text-torays-text-muted hover:text-torays-text lg:mt-4 ${FOCUS}`}
          >
            <LogOut size={17} /> {t("shop.admin.signOut")}
          </button>
        </nav>
        <div className="min-w-0">
          {me.environment !== "live" && (
            <p className="mb-4 rounded-xl border border-dashed border-torays-navy/40 bg-torays-surface-alt px-3 py-2 text-xs font-semibold text-torays-navy">
              {t(`shop.admin.settings.modes.${me.environment}`)}
            </p>
          )}
          <Routes>
            <Route index element={<AdminProducts />} />
            <Route path="productos/nuevo" element={<ProductEditor />} />
            <Route path="productos/:id" element={<ProductEditor />} />
            <Route path="pedidos" element={<AdminOrders />} />
            <Route path="pedidos/:id" element={<AdminOrderDetail />} />
            <Route path="ventas" element={<AdminSales environment={me.environment} />} />
            <Route path="ajustes" element={<AdminSettings me={me} />} />
          </Routes>
        </div>
      </div>
    </ShopShell>
  );
}
