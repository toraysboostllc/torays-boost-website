import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Store, Truck, ChevronRight, Download } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext.jsx";
import { shopApi } from "../../../lib/shopApi.js";
import { formatMoney } from "../../../lib/shopCart.js";
import { BTN, INPUT, FOCUS } from "../../../components/shop/ShopLayout.jsx";

export const STATUS_TONE = {
  paid: "bg-torays-red/10 text-torays-red-dark",
  paid_pickup: "bg-torays-red/10 text-torays-red-dark",
  ready_for_pickup: "bg-torays-navy/10 text-torays-navy",
  payment_review: "bg-torays-navy/10 text-torays-navy",
  shipped: "bg-quote-wa/10 text-quote-wa",
  picked_up: "bg-quote-wa/10 text-quote-wa",
  partially_refunded: "bg-torays-surface-alt text-torays-text-secondary",
  refunded: "bg-torays-surface-alt text-torays-text-secondary",
};

export function StatusBadge({ status }) {
  const { t } = useLanguage();
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[status] || "bg-torays-surface-alt text-torays-text-muted"}`}>
      {t(`shop.admin.orders.status.${status}`)}
    </span>
  );
}

const FILTERS = ["open", "shipped", "refunds", "unpaid", "all"];

export function AdminOrders() {
  const { t, lang } = useLanguage();
  const [filter, setFilter] = useState("open");
  const [orders, setOrders] = useState(null);
  const [toShip, setToShip] = useState([]);
  const [group, setGroup] = useState("");

  // Orders still waiting for a label, grouped by the service the customer
  // chose: Pirate Ship takes one service per spreadsheet upload.
  useEffect(() => {
    shopApi
      .adminOrders("open")
      .then(({ orders: o }) => setToShip(o.filter((x) => x.fulfillment === "shipping" && !x.shippedAt && ["paid", "partially_refunded"].includes(x.status))))
      .catch(() => setToShip([]));
  }, []);
  const groups = [...new Set(toShip.map((o) => `${o.carrier}|${o.service}`))];
  const [gCarrier, gService] = group ? group.split("|") : [];
  const groupCount = group ? toShip.filter((o) => o.carrier === gCarrier && o.service === gService).length : toShip.length;

  useEffect(() => {
    setOrders(null);
    shopApi
      .adminOrders(filter === "all" ? null : filter)
      .then(({ orders: o }) => setOrders(o))
      .catch(() => setOrders([]));
  }, [filter]);

  return (
    <div>
      <h1 className="mb-4 font-heading text-2xl font-bold">{t("shop.admin.nav.orders")}</h1>
      <section className="mb-4 rounded-2xl border border-torays-line bg-torays-surface p-3">
        <h2 className="font-heading text-base font-semibold">{t("shop.admin.orders.pirateTitle")}</h2>
        <p className="mb-2 text-xs text-torays-text-muted">{t("shop.admin.orders.pirateHint")}</p>
        {toShip.length === 0 ? (
          <p className="text-sm text-torays-text-secondary">{t("shop.admin.orders.pirateNone")}</p>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-xs text-torays-text-secondary">{t("shop.admin.orders.pirateGroup")}</span>
              <select className={`${INPUT} w-auto`} value={group} onChange={(e) => setGroup(e.target.value)}>
                <option value="">{t("shop.admin.orders.pirateAll")}</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g.replace("|", " ")}
                  </option>
                ))}
              </select>
            </label>
            <a className={BTN.dark} href={shopApi.pirateShipCsvUrl(group ? { carrier: gCarrier, service: gService } : {})} download>
              <Download size={18} /> {t("shop.admin.orders.pirateExport", { n: groupCount })}
            </a>
          </div>
        )}
      </section>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`min-h-10 whitespace-nowrap rounded-full border px-4 text-sm font-medium ${FOCUS} ${
              filter === f ? "border-torays-navy bg-torays-navy text-white" : "border-torays-line bg-torays-surface text-torays-text-secondary"
            }`}
          >
            {t(`shop.admin.orders.filters.${f}`)}
          </button>
        ))}
      </div>
      {orders === null ? (
        <div className="h-40 animate-pulse rounded-2xl bg-torays-surface-alt" />
      ) : orders.length === 0 ? (
        <p className="rounded-2xl border border-torays-line bg-torays-surface p-6 text-center text-sm text-torays-text-secondary">{t("shop.admin.orders.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id}>
              <Link to={`/tienda/admin/pedidos/${o.id}`} className={`flex items-center gap-3 rounded-2xl border border-torays-line bg-torays-surface p-3 hover:border-torays-navy/30 ${FOCUS}`}>
                {o.fulfillment === "pickup" ? <Store size={20} className="shrink-0 text-torays-navy" /> : <Truck size={20} className="shrink-0 text-torays-navy" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{o.orderNumber}</span>
                    <StatusBadge status={o.displayStatus} />
                  </div>
                  <div className="truncate text-xs text-torays-text-muted">
                    {o.customer.name} · {o.items.map((i) => `${i.quantity}× ${i.title}`).join(", ")}
                  </div>
                  <div className="text-[11px] text-torays-text-muted">{new Date(o.createdAt).toLocaleString(lang === "es" ? "es-US" : "en-US")}</div>
                </div>
                <span className="font-heading font-bold">{formatMoney(o.totalCents, lang)}</span>
                <ChevronRight size={18} className="shrink-0 text-torays-text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
