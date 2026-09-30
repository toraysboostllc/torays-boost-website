import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock, XCircle, Truck, RotateCcw, Store, Mail, UserPlus } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import { useSEO } from "../../lib/seo.js";
import { shopApi } from "../../lib/shopApi.js";
import { formatMoney } from "../../lib/shopCart.js";
import { ShopShell, BTN, INPUT, PANEL } from "../../components/shop/ShopLayout.jsx";
import { hoursRows } from "../../lib/shopHours.js";

/**
 * The buyer's order page. It states only what PayPal has confirmed:
 * "paid" copy appears exclusively for paid/shipped statuses; while PayPal
 * is still reviewing, it says so (and polls a few times).
 */
const VIEW = {
  paid: { icon: CheckCircle2, tone: "text-quote-wa bg-quote-wa/10", title: "paidTitle", text: "paidText" },
  shipped: { icon: Truck, tone: "text-quote-wa bg-quote-wa/10", title: "shippedTitle", text: "shippedText" },
  payment_review: { icon: Clock, tone: "text-torays-navy bg-torays-navy/10", title: "reviewTitle", text: "reviewText" },
  pending_payment: { icon: Clock, tone: "text-torays-navy bg-torays-navy/10", title: "pendingTitle", text: "pendingText" },
  payment_failed: { icon: XCircle, tone: "text-torays-red-dark bg-torays-red/10", title: "failedTitle", text: "failedText" },
  cancelled: { icon: XCircle, tone: "text-torays-red-dark bg-torays-red/10", title: "failedTitle", text: "failedText" },
  partially_refunded: { icon: CheckCircle2, tone: "text-quote-wa bg-quote-wa/10", title: "paidTitle", text: "paidText" },
  refunded: { icon: RotateCcw, tone: "text-torays-navy bg-torays-navy/10", title: "refundedTitle", text: "refundedText" },
  ready_for_pickup: { icon: Store, tone: "text-quote-wa bg-quote-wa/10", title: "readyTitle", text: "readyText" },
  picked_up: { icon: CheckCircle2, tone: "text-quote-wa bg-quote-wa/10", title: "pickedUpTitle", text: "pickedUpText" },
};
const PAID = ["paid", "shipped", "ready_for_pickup", "picked_up", "partially_refunded"];

/** Optional account, offered only AFTER the purchase. Passwordless: the
 *  server emails a one-time sign-in link to the address. */
function AccountOffer() {
  const { t, lang } = useLanguage();
  const [email, setEmail] = useState(() => {
    try {
      return window.sessionStorage.getItem("torays_shop_last_email") || "";
    } catch {
      return "";
    }
  });
  const [state, setState] = useState("idle");
  async function submit(e) {
    e.preventDefault();
    setState("busy");
    try {
      await shopApi.accountRequestLink(email, lang);
      setState("sent");
    } catch {
      setState("idle");
    }
  }
  return (
    <div className={`${PANEL} mx-auto mt-4 max-w-lg`}>
      <div className="flex items-start gap-3">
        <UserPlus size={22} className="mt-0.5 shrink-0 text-torays-navy" />
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-base font-semibold">{t("shop.order.accountTitle")}</h2>
          <p className="mt-1 text-sm leading-relaxed text-torays-text-secondary">{t("shop.order.accountText")}</p>
          {state === "sent" ? (
            <p className="mt-3 flex items-center gap-2 text-sm font-medium text-quote-wa" role="status">
              <Mail size={16} /> {t("shop.order.accountSent")}
            </p>
          ) : (
            <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <label className="sr-only" htmlFor="acct-email">{t("shop.order.accountEmail")}</label>
              <input id="acct-email" className={INPUT} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("shop.order.accountEmail")} required />
              <button type="submit" className={`${BTN.ghost} whitespace-nowrap`} disabled={state === "busy"}>
                {t("shop.order.accountButton")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export function ShopOrder() {
  const { number } = useParams();
  const [params] = useSearchParams();
  const { t, lang } = useLanguage();
  useSEO({ title: t("shop.order.number", { n: number }), noindex: true });
  const [order, setOrder] = useState(null);
  const [missing, setMissing] = useState(false);
  const [signedIn, setSignedIn] = useState(true);
  const [pickupInfo, setPickupInfo] = useState(null);
  useEffect(() => {
    shopApi.config().then((c) => setPickupInfo(c.pickup)).catch(() => {});
  }, []);

  useEffect(() => {
    shopApi.accountMe().then(() => setSignedIn(true)).catch(() => setSignedIn(false));
  }, []);

  useEffect(() => {
    let tries = 0;
    let timer = null;
    const load = () =>
      shopApi
        .order(number, params.get("t") || "")
        .then(({ order: o }) => {
          setOrder(o);
          if (["payment_review", "pending_payment"].includes(o.status) && tries++ < 6) timer = setTimeout(load, 5000);
        })
        .catch(() => setMissing(true));
    load();
    return () => clearTimeout(timer);
  }, [number, params]);

  if (missing) {
    return (
      <ShopShell>
        <p className="mx-auto max-w-md rounded-2xl border border-torays-line bg-torays-surface p-8 text-center text-torays-text-secondary">
          {t("shop.order.notFound")}
        </p>
      </ShopShell>
    );
  }
  if (!order) {
    return (
      <ShopShell>
        <div className="mx-auto h-72 max-w-lg animate-pulse rounded-2xl bg-torays-surface-alt" aria-busy="true" />
      </ShopShell>
    );
  }

  const v = VIEW[order.status] || VIEW.pending_payment;
  const pickup = order.fulfillment === "pickup";
  const text = pickup && ["paid", "partially_refunded"].includes(order.status) ? "paidPickupText" : v.text;
  const Icon = v.icon;
  return (
    <ShopShell>
      <div className="mx-auto max-w-lg rounded-2xl border border-torays-line bg-torays-surface p-6 text-center md:p-8">
        <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${v.tone}`}>
          <Icon size={32} />
        </span>
        <h1 className="mt-4 font-heading text-2xl font-bold">{t(`shop.order.${v.title}`)}</h1>
        <p className="mt-1 font-heading text-lg font-semibold text-torays-navy">{t("shop.order.number", { n: order.orderNumber })}</p>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-torays-text-secondary">
          {t(`shop.order.${text}`, {
            total: formatMoney(order.totalCents, lang),
            carrier: `${order.carrier} ${order.service}`,
            tracking: order.trackingNumber || "—",
          })}
        </p>
        {pickup && ["paid", "ready_for_pickup"].includes(order.status) && pickupInfo?.hours?.length > 0 && (
          <div className="mx-auto mt-3 max-w-xs rounded-xl bg-torays-surface-alt p-3 text-left text-sm">
            <p className="font-semibold">{t("shop.checkout.pickupHours")} · {pickupInfo.area}</p>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-4 text-torays-text-secondary">
              {hoursRows(pickupInfo.hours, t).map((r) => (
                <div key={r.day} className="contents">
                  <dt>{r.day}</dt>
                  <dd className="font-medium text-torays-text">{r.range}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {PAID.includes(order.status) && (
          <p className="mx-auto mt-2 flex max-w-sm items-center justify-center gap-1.5 text-xs text-torays-text-muted">
            <Mail size={14} /> {t("shop.order.emailSent")}
          </p>
        )}
        <ul className="mt-5 divide-y divide-torays-line border-y border-torays-line text-left text-sm">
          {order.items.map((i) => (
            <li key={i.title} className="flex justify-between gap-3 py-2">
              <span>
                {i.quantity} × {i.title}
              </span>
              <span className="font-medium">{formatMoney(i.unitPriceCents * i.quantity, lang)}</span>
            </li>
          ))}
          <li className="flex justify-between py-2 text-torays-text-secondary">
            <span>{pickup ? t("shop.order.pickup") : `${t("shop.checkout.shipping")} · ${order.carrier} ${order.service}`}</span>
            <span>{formatMoney(order.shippingCents, lang)}</span>
          </li>
          <li className="flex justify-between py-2 font-heading font-bold">
            <span>{t("shop.checkout.total")}</span>
            <span>{formatMoney(order.totalCents, lang)}</span>
          </li>
        </ul>
        <Link to="/tienda" className={`${BTN.dark} mt-6`}>
          {t("shop.order.keepShopping")}
        </Link>
      </div>
      {PAID.includes(order.status) && !signedIn && <AccountOffer />}
    </ShopShell>
  );
}
