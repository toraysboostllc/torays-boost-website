import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext.jsx";
import { shopApi } from "../../../lib/shopApi.js";
import { formatMoney } from "../../../lib/shopCart.js";
import { ProductImage, BTN, FOCUS } from "../../../components/shop/ShopLayout.jsx";

export function Kpi({ label, value, tone = "" }) {
  return (
    <div className="rounded-2xl border border-torays-line bg-torays-surface p-3">
      <div className="text-[11px] font-medium text-torays-text-muted">{label}</div>
      <div className={`mt-0.5 font-heading text-xl font-bold ${tone}`}>{value}</div>
    </div>
  );
}

export function AdminProducts() {
  const { t, lang } = useLanguage();
  const [products, setProducts] = useState(null);
  const [toShip, setToShip] = useState(0);

  const load = () => {
    shopApi.adminProducts().then(({ products: p }) => setProducts(p)).catch(() => setProducts([]));
    shopApi.adminOrders("open").then(({ orders }) => setToShip(orders.filter((o) => o.status === "paid").length)).catch(() => {});
  };
  useEffect(load, []);

  async function remove(p) {
    if (!window.confirm(t("shop.admin.confirmDelete", { title: p.title }))) return;
    await shopApi.adminDeleteProduct(p.id);
    load();
  }

  const list = products || [];
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold">{t("shop.admin.nav.products")}</h1>
        <Link to="/tienda/admin/productos/nuevo" className={BTN.primary}>
          <Plus size={18} /> {t("shop.admin.newProduct")}
        </Link>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label={t("shop.admin.kpiPublished")} value={list.filter((p) => p.status === "published").length} />
        <Kpi label={t("shop.admin.kpiDrafts")} value={list.filter((p) => p.status === "draft").length} />
        <Kpi label={t("shop.admin.kpiSoldOut")} value={list.filter((p) => p.stock === 0).length} />
        <Kpi label={t("shop.admin.kpiToShip")} value={toShip} tone={toShip ? "text-torays-red-dark" : ""} />
      </div>
      {products === null ? (
        <div className="h-40 animate-pulse rounded-2xl bg-torays-surface-alt" />
      ) : (
        <ul className="space-y-2">
          {list.map((p) => {
            const badge =
              p.status === "draft"
                ? ["bg-torays-surface-alt text-torays-text-secondary", "draft"]
                : p.stock === 0
                  ? ["bg-torays-red/10 text-torays-red-dark", "soldOut"]
                  : ["bg-quote-wa/10 text-quote-wa", "published"];
            return (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-torays-line bg-torays-surface p-2.5">
                <ProductImage src={p.images[0]} alt="" className="h-14 w-14 shrink-0 rounded-xl" iconSize={18} />
                <div className="min-w-0 flex-1">
                  <Link to={`/tienda/admin/productos/${p.id}`} className={`block truncate rounded font-semibold hover:text-torays-navy ${FOCUS}`}>
                    {p.title}
                  </Link>
                  <div className="text-xs text-torays-text-muted">
                    {formatMoney(p.priceCents, lang)} · {t(`shop.conditions.${p.condition}`)} · {t("shop.admin.units", { n: p.stock })}
                  </div>
                </div>
                <span className={`hidden rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline ${badge[0]}`}>{t(`shop.admin.${badge[1]}`)}</span>
                <Link to={`/tienda/admin/productos/${p.id}`} aria-label={t("shop.admin.edit")} className={`flex h-10 w-10 items-center justify-center rounded-xl border border-torays-line ${FOCUS}`}>
                  <Pencil size={16} />
                </Link>
                <button type="button" onClick={() => remove(p)} aria-label={t("shop.admin.delete")} className={`flex h-10 w-10 items-center justify-center rounded-xl border border-torays-line text-torays-red-dark ${FOCUS}`}>
                  <Trash2 size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
