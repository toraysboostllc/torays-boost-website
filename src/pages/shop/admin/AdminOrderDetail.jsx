import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, AlertTriangle, Store, Truck, Mail, ExternalLink, Loader2 } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext.jsx";
import { shopApi } from "../../../lib/shopApi.js";
import { formatMoney } from "../../../lib/shopCart.js";
import { BTN, INPUT, PANEL, FOCUS } from "../../../components/shop/ShopLayout.jsx";
import { StatusBadge } from "./AdminOrders.jsx";

function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <span className="text-torays-text-secondary">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

const PAID = ["paid", "shipped", "ready_for_pickup", "picked_up", "partially_refunded"];

export function AdminOrderDetail() {
  const { id } = useParams();
  const { t, lang } = useLanguage();
  const [o, setO] = useState(null);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const [manual, setManual] = useState({ labelCarrier: "", labelService: "", trackingNumber: "", labelCost: "" });
  const [refund, setRefund] = useState({ amount: "", restock: false });
  const [notes, setNotes] = useState("");

  const apply = (order) => {
    setO(order);
    setManual({
      // Pre-filled with what the customer chose; change it if you bought a different label.
      labelCarrier: order.labelCarrier || order.carrier || "",
      labelService: order.labelService || order.service || "",
      trackingNumber: order.trackingNumber || "",
      labelCost: order.label.costCents != null ? (order.label.costCents / 100).toFixed(2) : "",
    });
    setNotes(order.adminNotes || "");
  };
  useEffect(() => {
    shopApi.adminOrder(id).then(({ order }) => apply(order));
  }, [id]);

  async function run(key, fn) {
    setBusy(key);
    setMsg(null);
    try {
      const r = await fn();
      if (r?.order) apply(r.order);
      setMsg({ ok: true, text: t("shop.admin.orders.saved") });
    } catch (err) {
      setMsg({
        ok: false,
        text:
          err.code === "pickup_not_configured"
            ? t("shop.admin.orders.pickupNotConfigured")
            : err.body?.field === "trackingNumber" || err.body?.field === "labelCarrier"
              ? t("shop.admin.orders.needTracking")
              : `${t("shop.checkout.errors.generic")} (${err.code})`,
      });
    } finally {
      setBusy(null);
    }
  }

  if (!o) return <div className="h-80 animate-pulse rounded-2xl bg-torays-surface-alt" />;
  const m = (c) => (c == null ? "—" : formatMoney(c, lang));
  const pickup = o.fulfillment === "pickup";
  const refundable = o.paypalCaptureId && PAID.includes(o.status);
  const maxRefund = o.totalCents - o.refundedCents;
  const L = (k) => t(`shop.admin.orders.${k}`);

  return (
    <div className="space-y-4">
      <Link to="/tienda/admin/pedidos" className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg font-medium text-torays-navy ${FOCUS}`}>
        <ArrowLeft size={18} /> {L("back")}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-2xl font-bold">{o.orderNumber}</h1>
        <StatusBadge status={o.displayStatus} />
        <span className="inline-flex items-center gap-1 text-sm text-torays-text-secondary">
          {pickup ? <Store size={16} /> : <Truck size={16} />} {pickup ? L("pickupOrder") : `${o.carrier} ${o.service}`}
        </span>
      </div>
      {o.oversold && (
        <p className="flex gap-2 rounded-xl bg-torays-red/10 p-3 text-sm font-medium text-torays-red-dark">
          <AlertTriangle size={18} className="shrink-0" /> {L("oversold")}
        </p>
      )}
      {msg && (
        <p role="status" className={`text-sm font-medium ${msg.ok ? "text-quote-wa" : "text-torays-red-dark"}`}>
          {msg.text}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={PANEL}>
          <h2 className="mb-2 font-heading text-base font-semibold">{L("customer")}</h2>
          <p className="text-sm">{o.customer.name}</p>
          <p className="text-sm">
            <a className="text-torays-navy underline underline-offset-2" href={`mailto:${o.customer.email}`}>{o.customer.email}</a>
          </p>
          <p className="text-sm">{o.customer.phone}</p>
          <p className="mt-1 text-xs text-torays-text-muted">{L("language")}: {o.language === "es" ? "Español" : "English"}</p>
          {!pickup && (
            <>
              <h3 className="mb-1 mt-4 text-sm font-semibold">{L("shipTo")}</h3>
              <p className="text-sm leading-relaxed">
                {o.address.line1}
                {o.address.line2 ? `, ${o.address.line2}` : ""}
                <br />
                {o.address.city}, {o.address.state} {o.address.zip}
              </p>
            </>
          )}
          <h3 className="mb-1 mt-4 text-sm font-semibold">{L("items")}</h3>
          <ul className="text-sm">
            {o.items.map((i) => (
              <li key={i.title} className="flex justify-between gap-3 py-1">
                <span>
                  {i.quantity} × {i.title}
                </span>
                <span>{m(i.unitPriceCents * i.quantity)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={PANEL}>
          <h2 className="mb-2 font-heading text-base font-semibold">{L("payment")}</h2>
          <Row label={t("shop.checkout.subtotal")}>{m(o.itemsCents)}</Row>
          <Row label={pickup ? t("shop.checkout.pickup") : t("shop.checkout.shipping")}>{m(o.shippingCents)}</Row>
          <Row label={t("shop.checkout.total")}>{m(o.totalCents)}</Row>
          <Row label={L("paypalFee")}>{m(o.paypalFeeCents)}</Row>
          <Row label={L("net")}>{m(o.paypalNetCents)}</Row>
          <Row label={L("captureId")}>
            <span className="break-all text-xs">{o.paypalCaptureId || "—"}</span>
          </Row>
          {o.refunds.length > 0 && (
            <>
              <h3 className="mb-1 mt-3 text-sm font-semibold">{L("refunds")}</h3>
              {o.refunds.map((r) => (
                <Row key={r.id} label={`${new Date(r.createdAt).toLocaleDateString()} · ${r.status}`}>
                  −{m(r.amountCents)}
                </Row>
              ))}
            </>
          )}
        </section>
      </div>

      {/* Fulfillment actions */}
      {pickup ? (
        PAID.includes(o.status) && (
          <section className={`${PANEL} flex flex-wrap gap-3`}>
            {["paid", "partially_refunded"].includes(o.status) && !o.readyAt && (
              <button type="button" className={BTN.primary} disabled={!!busy} onClick={() => run("ready", () => shopApi.adminUpdateOrder({ id: o.id, markReady: true }))}>
                {busy === "ready" ? <Loader2 size={18} className="animate-spin" /> : <Store size={18} />} {L("markReady")}
              </button>
            )}
            {(o.status === "ready_for_pickup" || (o.status === "partially_refunded" && o.readyAt && !o.pickedUpAt)) && (
              <button type="button" className={BTN.dark} disabled={!!busy} onClick={() => run("picked", () => shopApi.adminUpdateOrder({ id: o.id, markPickedUp: true }))}>
                {L("markPickedUp")}
              </button>
            )}
          </section>
        )
      ) : (
        PAID.includes(o.status) && (
          <section className={PANEL}>
            <h2 className="font-heading text-base font-semibold">{L("label")}</h2>
            <p className="mb-3 mt-1 text-sm text-torays-text-secondary">
              {L("customerChose")}: <b>{o.carrier} {o.service}</b> ({m(o.shippingCents)}). {L("buyInPirate")}
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[110px_1fr_1fr_140px] lg:items-end">
              <label className="block">
                <span className="mb-1 block text-xs text-torays-text-secondary">{L("carrier")}</span>
                <select className={INPUT} value={manual.labelCarrier} onChange={(e) => setManual((x) => ({ ...x, labelCarrier: e.target.value }))}>
                  <option value="USPS">USPS</option>
                  <option value="UPS">UPS</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-torays-text-secondary">{L("service")}</span>
                <input className={INPUT} value={manual.labelService} onChange={(e) => setManual((x) => ({ ...x, labelService: e.target.value }))} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-torays-text-secondary">{L("tracking")}</span>
                <input className={INPUT} value={manual.trackingNumber} onChange={(e) => setManual((x) => ({ ...x, trackingNumber: e.target.value }))} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-torays-text-secondary">{L("labelCost")}</span>
                <input className={INPUT} inputMode="decimal" placeholder="0.00" value={manual.labelCost} onChange={(e) => setManual((x) => ({ ...x, labelCost: e.target.value }))} />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={BTN.ghost} disabled={!!busy} onClick={() => run("manual", () => shopApi.adminUpdateOrder({ id: o.id, ...manual }))}>
                {L("saveShipping")}
              </button>
            </div>
            {o.trackingUrl && (
              <a href={o.trackingUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-torays-navy underline underline-offset-2">
                <ExternalLink size={14} /> {L("openTracking")}
              </a>
            )}
            {["paid", "partially_refunded"].includes(o.status) && !o.shippedAt && (
              <button type="button" className={`${BTN.primary} mt-4`} disabled={!!busy} onClick={() => run("ship", () => shopApi.adminUpdateOrder({ id: o.id, ...manual, markShipped: true }))}>
                <Truck size={18} /> {L("markShipped")}
              </button>
            )}
          </section>
        )
      )}

      <section className={PANEL}>
        <h2 className="mb-2 font-heading text-base font-semibold">{L("emails")}</h2>
        {o.emails.length === 0 ? (
          <p className="text-sm text-torays-text-muted">{L("noEmails")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {o.emails.map((e, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <Mail size={14} className="text-torays-text-muted" />
                <span>{t(`shop.admin.orders.emailKinds.${e.kind}`)}</span>
                <span className={e.status === "sent" ? "text-quote-wa" : "font-semibold text-torays-red-dark"}>· {t(`shop.admin.orders.emailStatus.${e.status}`)}</span>
                <span className="text-xs text-torays-text-muted">{new Date(e.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
        {PAID.includes(o.status) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              ["order_confirmation", true],
              ["ready_for_pickup", o.status === "ready_for_pickup"],
              ["shipped", o.status === "shipped"],
            ]
              .filter(([, ok]) => ok)
              .map(([kind]) => (
                <button key={kind} type="button" className={`${BTN.ghost} min-h-10 px-3 py-1.5 text-xs`} disabled={!!busy} onClick={() => run(`mail-${kind}`, () => shopApi.adminUpdateOrder({ id: o.id, resendEmail: kind }))}>
                  {L("resend")}: {t(`shop.admin.orders.emailKinds.${kind}`)}
                </button>
              ))}
          </div>
        )}
      </section>

      {refundable && maxRefund > 0 && (
        <section className={PANEL}>
          <h2 className="mb-3 font-heading text-base font-semibold">{L("refund")}</h2>
          <div className="grid gap-3 sm:grid-cols-[200px_1fr] sm:items-end">
            <label className="block">
              <span className="mb-1 block text-xs text-torays-text-secondary">
                {L("refundAmount")} · {t("shop.admin.orders.refundMax", { max: m(maxRefund) })}
              </span>
              <input className={INPUT} inputMode="decimal" value={refund.amount} onChange={(e) => setRefund((r) => ({ ...r, amount: e.target.value }))} placeholder={(maxRefund / 100).toFixed(2)} />
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-torays-navy" checked={refund.restock} onChange={(e) => setRefund((r) => ({ ...r, restock: e.target.checked }))} />
              {L("restock")}
            </label>
          </div>
          <button
            type="button"
            className={`${BTN.ghost} mt-3 text-torays-red-dark`}
            disabled={!!busy || !refund.amount}
            onClick={() => {
              if (!window.confirm(t("shop.admin.orders.confirmRefund", { amount: `$${refund.amount}`, name: o.customer.name }))) return;
              run("refund", () => shopApi.adminRefund(o.id, refund.amount, refund.restock));
            }}
          >
            {L("doRefund")}
          </button>
        </section>
      )}

      <section className={PANEL}>
        <h2 className="mb-2 font-heading text-base font-semibold">{L("notes")}</h2>
        <textarea className={`${INPUT} min-h-[90px]`} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className={BTN.ghost} disabled={!!busy} onClick={() => run("notes", () => shopApi.adminUpdateOrder({ id: o.id, adminNotes: notes }))}>
            {L("saveShipping")}
          </button>
          {["pending_payment", "payment_failed"].includes(o.status) && (
            <button type="button" className={`${BTN.ghost} text-torays-red-dark`} disabled={!!busy} onClick={() => run("cancel", () => shopApi.adminUpdateOrder({ id: o.id, cancel: true }))}>
              {L("cancelOrder")}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
