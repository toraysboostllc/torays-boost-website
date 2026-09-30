import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Minus, Plus, Truck, ShieldCheck, MessageCircle, Check } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import { useSEO } from "../../lib/seo.js";
import { shopApi } from "../../lib/shopApi.js";
import { formatMoney, useCart } from "../../lib/shopCart.js";
import { buildWhatsAppLink } from "../../lib/whatsapp.js";
import { ShopShell, ProductImage, StockLabel, BTN, FOCUS } from "../../components/shop/ShopLayout.jsx";

export function ShopProduct() {
  const { id } = useParams();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const cart = useCart();
  const [product, setProduct] = useState(null);
  const [status, setStatus] = useState("loading");
  const [photo, setPhoto] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  useSEO({ title: product?.title || t("shop.title"), description: product?.description?.slice(0, 155) || t("shop.seoDescription"), path: `/tienda/producto/${id}` });

  useEffect(() => {
    setStatus("loading");
    shopApi
      .product(id)
      .then(({ product: p }) => {
        setProduct(p);
        setPhoto(0);
        setQty(1);
        setStatus("ok");
      })
      .catch(() => setStatus("missing"));
  }, [id]);

  const back = (
    <Link to="/tienda" className={`mb-4 inline-flex min-h-11 items-center gap-1.5 rounded-lg font-medium text-torays-navy ${FOCUS}`}>
      <ArrowLeft size={18} /> {t("shop.backToShop")}
    </Link>
  );

  if (status !== "ok") {
    return (
      <ShopShell>
        {back}
        {status === "loading" ? (
          <div className="grid gap-5 md:grid-cols-2" aria-busy="true">
            <div className="aspect-square animate-pulse rounded-2xl bg-torays-surface-alt" />
            <div className="h-64 animate-pulse rounded-2xl bg-torays-surface-alt" />
          </div>
        ) : (
          <p className="rounded-2xl border border-torays-line bg-torays-surface p-8 text-center text-torays-text-secondary">{t("shop.notFound")}</p>
        )}
      </ShopShell>
    );
  }

  const max = Math.max(0, product.stock);
  const soldOut = max === 0;
  function addToCart() {
    cart.add(product.id, qty, max);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <ShopShell>
      {back}
      <div className="grid gap-6 md:grid-cols-[1.1fr_1fr] md:gap-10">
        <div>
          <div className="overflow-hidden rounded-2xl border border-torays-line bg-torays-surface">
            <ProductImage src={product.images[photo]} alt={product.title} className="aspect-square w-full" iconSize={48} />
          </div>
          {product.images.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {product.images.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setPhoto(i)}
                  aria-label={t("shop.photo", { n: i + 1 })}
                  aria-pressed={photo === i}
                  className={`overflow-hidden rounded-xl border-2 ${FOCUS} ${photo === i ? "border-torays-navy" : "border-transparent"}`}
                >
                  <img src={src} alt="" className="aspect-square w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-torays-line bg-torays-surface-alt px-3 py-1 text-xs font-medium text-torays-text-secondary">
              {t(`shop.conditions.${product.condition}`)}
            </span>
            {product.category && (
              <span className="rounded-full border border-torays-line bg-torays-surface-alt px-3 py-1 text-xs font-medium text-torays-text-secondary">
                {product.category}
              </span>
            )}
          </div>
          <h1 className="mt-3 font-heading text-2xl font-bold leading-tight text-torays-text md:text-3xl">{product.title}</h1>
          <div className="mt-3 font-heading text-3xl font-bold text-torays-text">{formatMoney(product.priceCents, lang)}</div>
          <div className="mt-1">
            {soldOut ? <StockLabel stock={0} /> : <span className="text-sm font-medium text-quote-wa">{t("shop.available", { n: max })}</span>}
          </div>

          {!soldOut && (
            <>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <div className="flex items-center rounded-xl border border-torays-line bg-torays-surface" role="group" aria-label={t("shop.quantity")}>
                  <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className={`flex h-11 w-11 items-center justify-center rounded-l-xl ${FOCUS}`} aria-label="-">
                    <Minus size={16} />
                  </button>
                  <span className="w-9 text-center font-semibold" aria-live="polite">{qty}</span>
                  <button type="button" onClick={() => setQty((q) => Math.min(max, q + 1))} className={`flex h-11 w-11 items-center justify-center rounded-r-xl ${FOCUS}`} aria-label="+">
                    <Plus size={16} />
                  </button>
                </div>
                <button
                  type="button"
                  className={`${BTN.primary} flex-1 sm:min-w-[200px]`}
                  onClick={() => {
                    cart.add(product.id, qty, max);
                    navigate("/tienda/checkout");
                  }}
                >
                  {t("shop.buyNow")}
                </button>
              </div>
              <button type="button" onClick={addToCart} className={`${BTN.ghost} mt-3 w-full`}>
                {added ? (
                  <>
                    <Check size={18} className="text-quote-wa" /> {t("shop.added")}
                  </>
                ) : (
                  t("shop.addToCart")
                )}
              </button>
            </>
          )}

          {product.description && (
            <>
              <h2 className="mt-7 font-heading text-base font-semibold text-torays-text">{t("shop.description")}</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-torays-text-secondary md:text-[15px]">{product.description}</p>
            </>
          )}

          <ul className="mt-6 space-y-2.5 text-sm text-torays-text-secondary">
            <li className="flex gap-2">
              <Truck size={18} className="shrink-0 text-torays-navy" /> {t("shop.trustShip")}
            </li>
            <li className="flex gap-2">
              <ShieldCheck size={18} className="shrink-0 text-torays-navy" /> {t("shop.trustPay")}
            </li>
            <li className="flex gap-2">
              <MessageCircle size={18} className="shrink-0 text-torays-navy" />
              <a href={buildWhatsAppLink(`${product.title} — ${window.location.href}`)} target="_blank" rel="noreferrer" className="underline decoration-torays-line underline-offset-2 hover:text-torays-text">
                {t("shop.trustReturns")}
              </a>
            </li>
          </ul>
        </div>
      </div>
    </ShopShell>
  );
}
