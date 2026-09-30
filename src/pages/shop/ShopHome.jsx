import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Truck, Wrench } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import { useSEO } from "../../lib/seo.js";
import { shopApi } from "../../lib/shopApi.js";
import { formatMoney } from "../../lib/shopCart.js";
import { ShopShell, ProductImage, StockLabel, BTN, FOCUS } from "../../components/shop/ShopLayout.jsx";

export function ProductCard({ product }) {
  const { t, lang } = useLanguage();
  return (
    <Link
      to={`/tienda/producto/${product.id}`}
      className={`group flex flex-col overflow-hidden rounded-2xl border border-torays-line bg-torays-surface transition-shadow hover:shadow-glow-navy ${FOCUS}`}
    >
      <div className="relative aspect-square overflow-hidden">
        <ProductImage
          src={product.images[0]}
          alt={product.title}
          className="h-full w-full transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <span className="absolute left-2 top-2 rounded-full bg-torays-surface/95 px-2 py-0.5 text-[10px] font-semibold text-torays-navy md:text-[11px]">
          {t(`shop.conditions.${product.condition}`)}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-torays-text md:text-[15px]">{product.title}</h3>
        <div className="mt-auto pt-1 font-heading text-lg font-bold text-torays-text">{formatMoney(product.priceCents, lang)}</div>
        <StockLabel stock={product.stock} />
      </div>
    </Link>
  );
}

export function ShopHome() {
  const { t } = useLanguage();
  useSEO({ title: t("shop.title"), description: t("shop.seoDescription"), path: "/tienda" });
  const [state, setState] = useState({ loading: true, error: false, products: [] });
  const [category, setCategory] = useState("");

  function load() {
    setState((s) => ({ ...s, loading: true, error: false }));
    shopApi
      .products()
      .then(({ products }) => setState({ loading: false, error: false, products }))
      .catch(() => setState({ loading: false, error: true, products: [] }));
  }
  useEffect(load, []);

  const categories = useMemo(
    () => [...new Set(state.products.map((p) => p.category).filter(Boolean))].sort(),
    [state.products]
  );
  // In-stock first, then newest (the API already sorts newest first).
  const shown = useMemo(
    () =>
      state.products
        .filter((p) => !category || p.category === category)
        .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0)),
    [state.products, category]
  );

  return (
    <ShopShell>
      <section className="relative overflow-hidden rounded-3xl bg-torays-navy px-5 py-6 text-white md:px-10 md:py-10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border-[28px] border-white/5" aria-hidden="true" />
        <h1 className="font-heading text-2xl font-bold md:text-4xl">{t("shop.title")}</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/80 md:text-base">{t("shop.heroText")}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs md:text-sm">
          {[
            [ShieldCheck, "shop.badgePaypal"],
            [Truck, "shop.badgeShipping"],
            [Wrench, "shop.badgeChecked"],
          ].map(([Icon, key]) => (
            <span key={key} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1">
              <Icon size={14} /> {t(key)}
            </span>
          ))}
        </div>
      </section>

      {categories.length > 1 && (
        <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" role="group">
          {["", ...categories].map((c) => (
            <button
              key={c || "all"}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={`min-h-10 whitespace-nowrap rounded-full border px-4 text-sm font-medium ${FOCUS} ${
                category === c
                  ? "border-torays-text bg-torays-text text-white"
                  : "border-torays-line bg-torays-surface text-torays-text-secondary hover:text-torays-text"
              }`}
            >
              {c || t("shop.all")}
            </button>
          ))}
        </div>
      )}

      <div className="mt-5">
        {state.loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4" aria-busy="true">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-torays-surface-alt" />
            ))}
          </div>
        ) : state.error ? (
          <div className="rounded-2xl border border-torays-line bg-torays-surface p-8 text-center">
            <p className="text-torays-text-secondary">{t("shop.loadError")}</p>
            <button type="button" onClick={load} className={`${BTN.ghost} mt-4`}>
              {t("shop.retry")}
            </button>
          </div>
        ) : shown.length === 0 ? (
          <p className="rounded-2xl border border-torays-line bg-torays-surface p-8 text-center text-torays-text-secondary">
            {t("shop.empty")}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
            {shown.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </ShopShell>
  );
}
