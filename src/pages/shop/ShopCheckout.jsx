import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Minus, Plus, Trash2, Loader2, AlertTriangle, FlaskConical, Truck, Store, UserCheck } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import { useSEO } from "../../lib/seo.js";
import { shopApi } from "../../lib/shopApi.js";
import { formatMoney, useCart } from "../../lib/shopCart.js";
import { buildWhatsAppLink } from "../../lib/whatsapp.js";
import { ShopShell, ProductImage, BTN, INPUT, PANEL, FOCUS } from "../../components/shop/ShopLayout.jsx";
import { hoursRows } from "../../lib/shopHours.js";

const STATES = ("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR " +
  "PA RI SC SD TN TX UT VT VA WA WV WI WY").split(" ");

const CARRIER_STYLE = {
  USPS: "bg-torays-navy text-white",
  UPS: "bg-torays-text text-white",
};

/** Loads the PayPal JS SDK once per client id. */
function loadPaypalSdk(clientId) {
  const src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&components=buttons`;
  if (window.paypal && document.querySelector(`script[src="${src}"]`)) return Promise.resolve(window.paypal);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve(window.paypal);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function Field({ label, error, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-torays-text-secondary">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs font-medium text-torays-red-dark">{error}</span>}
    </label>
  );
}

export function ShopCheckout() {
  const { t, lang } = useLanguage();
  useSEO({ title: t("shop.checkout.title"), noindex: true });
  const navigate = useNavigate();
  const cart = useCart();
  const [config, setConfig] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", line1: "", line2: "", city: "", state: "FL", zip: "" });
  const [fulfillment, setFulfillment] = useState("shipping");
  // "Continue to payment" pressed with everything filled in; any later
  // change to cart, contact, address or delivery choice resets it.
  const [confirmed, setConfirmed] = useState(false);
  const [account, setAccount] = useState(null);
  const [optionId, setOptionId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fieldError, setFieldError] = useState(null);
  const [paying, setPaying] = useState(false);
  const paypalRef = useRef(null);
  const orderRef = useRef(null);

  useEffect(() => {
    shopApi
      .config()
      .then((c) => {
        setConfig(c);
        if (!c.shipping && c.pickup) setFulfillment("pickup");
        setOptionId(c.shippingOptions?.[0]?.id || null);
      })
      .catch(() => setConfig({ payments: false, shipping: false, pickup: false }));
    // Signed-in customers (optional account) get their saved details filled in.
    shopApi
      .accountMe()
      .then(({ customer }) => {
        setAccount(customer);
        setForm((f) => ({
          ...f,
          name: f.name || customer.name,
          email: f.email || customer.email,
          phone: f.phone || customer.phone,
          line1: f.line1 || customer.address.line1,
          line2: f.line2 || customer.address.line2,
          city: f.city || customer.address.city,
          state: customer.address.state || f.state,
          zip: f.zip || customer.address.zip,
        }));
      })
      .catch(() => {});
    shopApi.products().then(({ products }) => setCatalog(products)).catch(() => setCatalog([]));
  }, []);

  const lines = useMemo(() => {
    if (!catalog) return [];
    return cart.lines
      .map((l) => ({ ...l, product: catalog.find((p) => p.id === l.productId) }))
      .filter((l) => l.product);
  }, [cart.lines, catalog]);

  // Drop lines whose product disappeared, and cap quantities at stock.
  useEffect(() => {
    if (!catalog) return;
    const fixed = cart.lines
      .map((l) => {
        const p = catalog.find((x) => x.id === l.productId);
        return p ? { ...l, quantity: Math.min(l.quantity, p.stock) } : null;
      })
      .filter((l) => l && l.quantity > 0);
    if (JSON.stringify(fixed) !== JSON.stringify(cart.lines)) cart.replace(fixed);
  }, [catalog]); // eslint-disable-line react-hooks/exhaustive-deps

  const cartKey = JSON.stringify(cart.lines);
  useEffect(() => setConfirmed(false), [cartKey, form, fulfillment, optionId]);

  const isPickup = fulfillment === "pickup";

  const subtotal = lines.reduce((s, l) => s + l.product.priceCents * l.quantity, 0);
  // The price the owner set for this option — shown as exactly what it is.
  const option = isPickup ? null : config?.shippingOptions?.find((o) => o.id === optionId) || null;
  const total = subtotal + (option?.priceCents || 0);
  const canPay = config?.payments && (isPickup ? config?.pickup : config?.shipping);
  const readyToPay = confirmed;

  const payload = () => ({
    items: cart.lines.map(({ productId, quantity }) => ({ productId, quantity })),
    customer: { name: form.name, email: form.email, phone: form.phone },
    fulfillment,
    language: lang,
    ...(isPickup
      ? {}
      : { address: { line1: form.line1, line2: form.line2, city: form.city, state: form.state, zip: form.zip }, shippingOptionId: optionId }),
  });

  function explain(err) {
    const code = err?.code || "generic";
    if (code === "invalid") setFieldError(err.body?.field || null);
    if (code === "insufficient_stock" || code === "product_unavailable") {
      shopApi.products().then(({ products }) => setCatalog(products)).catch(() => {});
    }
    setConfirmed(false);
    const key = `shop.checkout.errors.${code}`;
    const msg = t(key);
    setError(msg === key ? t("shop.checkout.errors.generic") : msg);
  }

  function continueToPayment(e) {
    e.preventDefault();
    setError(null);
    setFieldError(null);
    const required = isPickup ? ["name", "email", "phone"] : ["name", "email", "phone", "line1", "city", "zip"];
    const missing = required.find((k) => !form[k].trim());
    if (missing || (!isPickup && !option)) {
      setFieldError(missing || "shippingOptionId");
      setError(t("shop.checkout.errors.invalid"));
      return;
    }
    setConfirmed(true);
  }

  async function createOrder() {
    setError(null);
    const created = await shopApi.createOrder(payload());
    orderRef.current = created;
    return created.paypalOrderId;
  }

  async function capture(paypalOrderId) {
    setPaying(true);
    try {
      const r = await shopApi.captureOrder(paypalOrderId);
      try {
        // Lets the order page offer "create an account" with this email
        // prefilled; this tab only, never sent anywhere else.
        window.sessionStorage.setItem("torays_shop_last_email", form.email);
      } catch {
        // storage blocked — the page just asks for the email instead
      }
      cart.clear();
      navigate(`/tienda/pedido/${r.orderNumber}?t=${r.token}`, { replace: true });
    } catch (err) {
      setPaying(false);
      throw err;
    }
  }

  // Real PayPal buttons (sandbox or live) — only once delivery is settled.
  useEffect(() => {
    if (!config?.paypalClientId || !readyToPay || !paypalRef.current) return undefined;
    let cancelled = false;
    let buttons = null;
    loadPaypalSdk(config.paypalClientId)
      .then((paypal) => {
        if (cancelled || !paypalRef.current) return;
        paypalRef.current.innerHTML = "";
        buttons = paypal.Buttons({
          style: { layout: "vertical", shape: "pill", label: "pay" },
          createOrder: () =>
            createOrder().catch((err) => {
              explain(err);
              throw err;
            }),
          onApprove: async (data, actions) => {
            try {
              await capture(data.orderID);
            } catch (err) {
              if (err.code === "instrument_declined") return actions.restart();
              explain(err);
            }
            return undefined;
          },
          onCancel: () => setError(t("shop.checkout.errors.cancelled")),
          onError: () => setError((cur) => cur || t("shop.checkout.errors.generic")),
        });
        buttons.render(paypalRef.current);
      })
      .catch(() => setError(t("shop.checkout.errors.payments_not_configured")));
    return () => {
      cancelled = true;
      buttons?.close?.().catch?.(() => {});
    };
  }, [config?.paypalClientId, readyToPay, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  async function devPay() {
    setBusy(true);
    try {
      const id = await createOrder();
      await capture(id);
    } catch (err) {
      explain(err);
    } finally {
      setBusy(false);
    }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const fe = (k) => (fieldError === k ? t("shop.checkout.errors.invalid") : null);
  const daysText = (o) =>
    o.daysMin && o.daysMax
      ? o.daysMin === o.daysMax
        ? t("shop.checkout.days", { n: o.daysMax })
        : t("shop.checkout.daysRange", { min: o.daysMin, max: o.daysMax })
      : o.daysMax || o.daysMin
        ? t("shop.checkout.days", { n: o.daysMax || o.daysMin })
        : t("shop.checkout.daysUnknown");

  if (catalog && lines.length === 0 && !paying) {
    return (
      <ShopShell>
        <div className="mx-auto max-w-md rounded-2xl border border-torays-line bg-torays-surface p-8 text-center">
          <p className="text-torays-text-secondary">{t("shop.cartEmpty")}</p>
          <Link to="/tienda" className={`${BTN.dark} mt-4`}>
            {t("shop.backToShop")}
          </Link>
        </div>
      </ShopShell>
    );
  }

  return (
    <ShopShell>
      <Link to="/tienda" className={`mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg font-medium text-torays-navy ${FOCUS}`}>
        <ArrowLeft size={18} /> {t("shop.backToShop")}
      </Link>
      <h1 className="font-heading text-2xl font-bold text-torays-text md:text-3xl">{t("shop.checkout.title")}</h1>
      <ol className="mt-2 flex flex-wrap gap-x-2 text-xs text-torays-text-muted">
        <li className="font-semibold text-torays-navy">1 {t("shop.checkout.stepAddress")}</li>
        <li>›</li>
        <li className={isPickup || option ? "font-semibold text-torays-navy" : ""}>2 {t("shop.checkout.stepShipping")}</li>
        <li>›</li>
        <li className={readyToPay ? "font-semibold text-torays-navy" : ""}>3 {t("shop.checkout.stepPay")}</li>
      </ol>

      {config?.environment === "sandbox" && (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-torays-navy/40 bg-torays-surface-alt px-3 py-2 text-xs font-semibold text-torays-navy">
          <FlaskConical size={16} /> {t("shop.checkout.sandbox")}
        </p>
      )}
      {config?.environment === "dev" && (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-torays-navy/40 bg-torays-surface-alt px-3 py-2 text-xs font-semibold text-torays-navy">
          <FlaskConical size={16} /> {t("shop.checkout.devMode")}
        </p>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="space-y-5">
          <form className={PANEL} onSubmit={continueToPayment} noValidate>
            <h2 className="font-heading text-lg font-semibold">{t("shop.checkout.contact")}</h2>
            {account ? (
              <p className="mb-3 mt-1 flex items-center gap-1.5 text-xs text-quote-wa">
                <UserCheck size={14} /> {t("shop.checkout.signedInAs", { email: account.email })}
              </p>
            ) : (
              <p className="mb-3 mt-1 text-xs text-torays-text-muted">{t("shop.checkout.guestNote")}</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("shop.checkout.name")} error={fe("name")}>
                <input className={INPUT} value={form.name} onChange={set("name")} autoComplete="name" required />
              </Field>
              <Field label={t("shop.checkout.email")} error={fe("email")}>
                <input className={INPUT} type="email" value={form.email} onChange={set("email")} autoComplete="email" required />
              </Field>
              <Field label={t("shop.checkout.phone")} error={fe("phone")} className="sm:col-span-2">
                <input className={INPUT} type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" required />
              </Field>
            </div>

            {config?.pickup && config?.shipping && (
              <fieldset className="mt-5">
                <legend className="mb-2 font-heading text-base font-semibold">{t("shop.checkout.delivery")}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    ["shipping", Truck, "ship", "shipSub"],
                    ["pickup", Store, "pickup", "pickupSub"],
                  ].map(([value, Icon, label, sub]) => (
                    <label
                      key={value}
                      className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-colors ${
                        fulfillment === value ? "border-torays-navy bg-torays-surface-alt" : "border-torays-line hover:border-torays-navy/30"
                      }`}
                    >
                      <input type="radio" name="fulfillment" className="h-4 w-4 accent-torays-navy" checked={fulfillment === value} onChange={() => setFulfillment(value)} />
                      <Icon size={20} className="shrink-0 text-torays-navy" />
                      <span>
                        <span className="block text-sm font-semibold">{t(`shop.checkout.${label}`)}</span>
                        <span className="block text-xs text-torays-text-muted">{t(`shop.checkout.${sub}`, { area: config.pickup?.area || "" })}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {isPickup ? (
              <div className="mt-4 rounded-xl bg-torays-surface-alt p-3 text-sm leading-relaxed text-torays-text-secondary">
                {config?.pickup?.hours?.length > 0 && (
                  <>
                    <p className="font-semibold text-torays-text">{t("shop.checkout.pickupHours")} · {config.pickup.area}</p>
                    <dl className="mb-2 mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
                      {hoursRows(config.pickup.hours, t).map((r) => (
                        <div key={r.day} className="contents">
                          <dt>{r.day}</dt>
                          <dd className="font-medium text-torays-text">{r.range}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                )}
                <p>{t("shop.checkout.pickupNote")}</p>
              </div>
            ) : (
            <>
            <h3 className="mb-3 mt-5 font-heading text-base font-semibold">{t("shop.checkout.address")}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("shop.checkout.line1")} error={fe("line1")} className="sm:col-span-2">
                <input className={INPUT} value={form.line1} onChange={set("line1")} autoComplete="address-line1" required />
              </Field>
              <Field label={t("shop.checkout.line2")} className="sm:col-span-2">
                <input className={INPUT} value={form.line2} onChange={set("line2")} autoComplete="address-line2" />
              </Field>
              <Field label={t("shop.checkout.city")} error={fe("city")}>
                <input className={INPUT} value={form.city} onChange={set("city")} autoComplete="address-level2" required />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("shop.checkout.state")} error={fe("state")}>
                  <select className={INPUT} value={form.state} onChange={set("state")} autoComplete="address-level1">
                    {STATES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label={t("shop.checkout.zip")} error={fe("zip")}>
                  <input className={INPUT} value={form.zip} onChange={set("zip")} autoComplete="postal-code" inputMode="numeric" required />
                </Field>
              </div>
            </div>
            <p className="mt-2 text-xs text-torays-text-muted">{t("shop.checkout.usOnly")}</p>

            <h3 className="mb-2 mt-5 font-heading text-base font-semibold">{t("shop.checkout.shippingMethod")}</h3>
            <div className="space-y-2" role="radiogroup" aria-label={t("shop.checkout.shippingMethod")}>
              {(config?.shippingOptions || []).map((o) => (
                <label
                  key={o.id}
                  className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-colors ${
                    optionId === o.id ? "border-torays-navy bg-torays-surface-alt" : "border-torays-line hover:border-torays-navy/30"
                  }`}
                >
                  <input type="radio" name="shippingOption" className="h-4 w-4 accent-torays-navy" checked={optionId === o.id} onChange={() => setOptionId(o.id)} />
                  <span className={`flex h-7 w-12 shrink-0 items-center justify-center rounded-md text-[10px] font-extrabold ${CARRIER_STYLE[o.carrier]}`}>{o.carrier}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-torays-text">{o.service}</span>
                    <span className="block text-xs text-torays-text-muted">{daysText(o)}</span>
                  </span>
                  <span className="font-heading font-bold">{formatMoney(o.priceCents, lang)}</span>
                </label>
              ))}
            </div>
            {fieldError === "shippingOptionId" && <p className="mt-1 text-xs font-medium text-torays-red-dark">{t("shop.checkout.chooseShipping")}</p>}
            <p className="mt-2 text-xs leading-relaxed text-torays-text-muted">{t("shop.checkout.ratesNote")}</p>
            </>
            )}
            {!confirmed && (
              <button type="submit" className={`${BTN.dark} mt-4 w-full sm:w-auto`} disabled={busy || (!isPickup && !config?.shipping)}>
                {t("shop.checkout.continuePickup")}
              </button>
            )}
          </form>

        </div>

        <aside className={`${PANEL} lg:sticky lg:top-24`}>
          <h2 className="mb-3 font-heading text-lg font-semibold">{t("shop.checkout.summary")}</h2>
          <ul className="divide-y divide-torays-line">
            {lines.map(({ product, quantity }) => (
              <li key={product.id} className="flex gap-3 py-3">
                <ProductImage src={product.images[0]} alt="" className="h-14 w-14 shrink-0 rounded-lg" iconSize={18} />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">{product.title}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex items-center rounded-lg border border-torays-line">
                      <button type="button" className={`flex h-8 w-8 items-center justify-center ${FOCUS}`} aria-label="-" onClick={() => cart.setQuantity(product.id, Math.max(1, quantity - 1))}>
                        <Minus size={14} />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold">{quantity}</span>
                      <button type="button" className={`flex h-8 w-8 items-center justify-center ${FOCUS}`} aria-label="+" onClick={() => cart.setQuantity(product.id, Math.min(product.stock, quantity + 1))}>
                        <Plus size={14} />
                      </button>
                    </div>
                    <button type="button" onClick={() => cart.remove(product.id)} aria-label={t("shop.remove")} className={`flex h-8 w-8 items-center justify-center rounded-lg text-torays-text-muted hover:text-torays-red-dark ${FOCUS}`}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <span className="text-sm font-semibold">{formatMoney(product.priceCents * quantity, lang)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex justify-between text-torays-text-secondary">
              <dt>{t("shop.checkout.subtotal")}</dt>
              <dd>{formatMoney(subtotal, lang)}</dd>
            </div>
            <div className="flex justify-between gap-3 text-torays-text-secondary">
              <dt>
                {isPickup ? t("shop.checkout.pickup") : t("shop.checkout.shipping")}
                {option && <span className="block text-xs text-torays-text-muted">{option.carrier} {option.service}</span>}
              </dt>
              <dd>
                {isPickup ? formatMoney(0, lang) : option ? formatMoney(option.priceCents, lang) : <span className="text-torays-text-muted">{t("shop.checkout.chooseShipping")}</span>}
              </dd>
            </div>
            <div className="flex justify-between border-t border-torays-line pt-3 font-heading text-lg font-bold">
              <dt>{t("shop.checkout.total")}</dt>
              <dd>{formatMoney(total, lang)}</dd>
            </div>
          </dl>

          {error && (
            <p role="alert" className="mt-3 flex gap-2 rounded-xl bg-torays-red/10 px-3 py-2 text-sm text-torays-red-dark">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}

          {config && !canPay ? (
            <div className="mt-4 rounded-xl bg-torays-surface-alt p-3 text-sm text-torays-text-secondary">
              <p>{t("shop.checkout.notReady")}</p>
              <a href={buildWhatsAppLink(lines.map((l) => `${l.quantity} x ${l.product.title}`).join("\n"))} target="_blank" rel="noreferrer" className={`${BTN.dark} mt-3 w-full`}>
                WhatsApp
              </a>
            </div>
          ) : readyToPay ? (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-torays-text-secondary">{t("shop.checkout.payWith")}</p>
              {paying && (
                <p className="mb-2 flex items-center gap-2 text-sm text-torays-navy" aria-live="polite">
                  <Loader2 size={16} className="animate-spin" /> {t("shop.checkout.processing")}
                </p>
              )}
              {config?.environment === "dev" ? (
                <button type="button" onClick={devPay} disabled={busy || paying} className={`${BTN.primary} w-full`}>
                  {t("shop.checkout.devPay")}
                </button>
              ) : (
                <div ref={paypalRef} className="min-h-[52px]" />
              )}
              <p className="mt-2 text-xs leading-relaxed text-torays-text-muted">{t("shop.checkout.payNote")}</p>
            </div>
          ) : null}
        </aside>
      </div>
    </ShopShell>
  );
}
