/**
 * Store emails: order confirmation (only once PayPal confirmed the
 * payment), "ready for pickup", "shipped" and the account sign-in link.
 *
 * Provider: Resend (RESEND_API_KEY + SHOP_EMAIL_FROM, a sender on a domain
 * verified in Resend, e.g. "Torays Boost <pedidos@toraysboost.com>").
 * Without it the "outbox" provider only records the message (dev/tests) —
 * the admin panel shows it as "not sent".
 *
 * Emails never block a payment: a send failure is logged in shop_email_log
 * and shown in the panel, the order itself is unaffected.
 */
import { centsToValue } from "./validate.js";
import { trackingUrl } from "./shippingOptions.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (c) => `$${centsToValue(c)}`;

const COPY = {
  en: {
    confirmSubject: (n) => `Order ${n} confirmed — Torays Boost`,
    confirmTitle: "Thanks! Your payment is confirmed.",
    confirmShip: "We'll email you the tracking number as soon as your package ships.",
    confirmPickup: "We'll email you again when your order is ready for pickup — please wait for that message before coming by.",
    viewOrder: "View your order",
    linkNote: "This private link shows only this order. Don't share it.",
    shipping: "Shipping",
    pickup: "Pickup in store",
    total: "Total paid",
    readySubject: (n) => `Order ${n} is ready for pickup — Torays Boost`,
    readyTitle: "Your order is ready for pickup!",
    shippedSubject: (n) => `Order ${n} shipped — Torays Boost`,
    shippedTitle: "Your order is on its way.",
    tracking: "Tracking number",
    trackButton: "Track your package",
    orderNumber: "Order number",
    address: "Pickup address",
    hours: "Pickup hours",
    readyText: "Come by during the hours below and bring your order number.",
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    accountSubject: "Your Torays Boost sign-in link",
    accountTitle: "Sign in to your Torays Boost account",
    accountText: "Open this link to see your orders and saved details. It works once and expires in 30 minutes. If you didn't ask for it, ignore this email.",
    accountButton: "Open my account",
    footer: "Torays Boost LLC · Miami, FL",
  },
  es: {
    confirmSubject: (n) => `Pedido ${n} confirmado — Torays Boost`,
    confirmTitle: "¡Gracias! Tu pago está confirmado.",
    confirmShip: "Te enviaremos el número de seguimiento en cuanto despachemos tu paquete.",
    confirmPickup: "Te escribiremos de nuevo cuando tu pedido esté listo para recoger — espera ese mensaje antes de venir.",
    viewOrder: "Ver tu pedido",
    linkNote: "Este enlace privado muestra solo este pedido. No lo compartas.",
    shipping: "Envío",
    pickup: "Recogida en tienda",
    total: "Total pagado",
    readySubject: (n) => `Pedido ${n} listo para recoger — Torays Boost`,
    readyTitle: "¡Tu pedido está listo para recoger!",
    shippedSubject: (n) => `Pedido ${n} enviado — Torays Boost`,
    shippedTitle: "Tu pedido va en camino.",
    tracking: "Número de seguimiento",
    trackButton: "Seguir mi paquete",
    orderNumber: "Número de pedido",
    address: "Dirección de recogida",
    hours: "Horario de recogida",
    readyText: "Pasa en el horario de abajo y trae tu número de pedido.",
    days: ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
    accountSubject: "Tu enlace para entrar a Torays Boost",
    accountTitle: "Entra a tu cuenta de Torays Boost",
    accountText: "Abre este enlace para ver tus pedidos y datos guardados. Funciona una sola vez y vence en 30 minutos. Si no lo pediste, ignora este correo.",
    accountButton: "Abrir mi cuenta",
    footer: "Torays Boost LLC · Miami, FL",
  },
};

function layout(title, bodyHtml, footer) {
  return `<!doctype html><html><body style="margin:0;background:#EDF1F9;font-family:Arial,Helvetica,sans-serif;color:#0F1424">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#20266F;color:#ffffff;padding:18px 24px;font-size:18px;font-weight:bold">TORAYS BOOST</td></tr>
<tr><td style="padding:24px">
<h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>
${bodyHtml}
</td></tr>
<tr><td style="padding:14px 24px;color:#8A91AC;font-size:12px;border-top:1px solid #E3E7F0">${esc(footer)}</td></tr>
</table></td></tr></table></body></html>`;
}

const button = (href, label) =>
  `<p style="margin:20px 0"><a href="${esc(href)}" style="display:inline-block;background:#DA1F26;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:10px">${esc(label)}</a></p>`;

function itemsTable(order, c) {
  const rows = (order.items || [])
    .map((i) => `<tr><td style="padding:6px 0">${esc(i.quantity)} × ${esc(i.title)}</td><td align="right">${money(i.unit_price_cents * i.quantity)}</td></tr>`)
    .join("");
  const ship = order.fulfillment === "pickup" ? c.pickup : `${c.shipping} · ${esc(order.shipping_carrier)} ${esc(order.shipping_service)}`;
  return `<table role="presentation" width="100%" style="font-size:14px;border-top:1px solid #E3E7F0;border-bottom:1px solid #E3E7F0;margin:12px 0">
${rows}<tr><td style="padding:6px 0;color:#525B78">${ship}</td><td align="right" style="color:#525B78">${money(order.shipping_cents)}</td></tr>
<tr><td style="padding:6px 0;font-weight:bold">${c.total}</td><td align="right" style="font-weight:bold">${money(order.total_cents)}</td></tr></table>`;
}

/** Pickup hours as "Monday: 10:00 – 18:00" lines, Monday first. */
export function hoursLines(hours, lang) {
  const c = COPY[lang === "es" ? "es" : "en"];
  return [...(hours || [])]
    .sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7))
    .map((h) => `${c.days[h.day]}: ${h.open} – ${h.close}`);
}

function pickupBlock(c, lang, pickup, { withAddress }) {
  const lines = hoursLines(pickup?.pickup_hours, lang);
  const address = pickup?.pickup_address || "";
  const notes = pickup?.pickup_notes || "";
  const html =
    (withAddress && address
      ? `<p style="font-size:14px;margin:12px 0 4px"><b>${esc(c.address)}</b><br>${esc(address).replace(/\n/g, "<br>")}</p>`
      : "") +
    (lines.length ? `<p style="font-size:14px;margin:12px 0 4px"><b>${esc(c.hours)}</b><br>${lines.map(esc).join("<br>")}</p>` : "") +
    (notes ? `<p style="font-size:13px;color:#525B78;margin:8px 0">${esc(notes)}</p>` : "");
  const text = [withAddress && address ? `${c.address}: ${address}` : "", lines.length ? `${c.hours}:\n${lines.join("\n")}` : "", notes]
    .filter(Boolean)
    .join("\n");
  return { html, text };
}

export function orderLink(origin, order) {
  return `${origin}/tienda/pedido/${encodeURIComponent(order.order_number)}?t=${order.public_token}`;
}

/** -> { subject, html, text } */
export function renderEmail(kind, { order, origin, pickup }) {
  const lang = order.language === "es" ? "es" : "en";
  const c = COPY[lang];
  const numberLine = `<p style="font-size:15px;margin:0 0 8px">${esc(c.orderNumber)}: <b>${esc(order.order_number)}</b></p>`;
  if (kind === "order_confirmation") {
    const isPickup = order.fulfillment === "pickup";
    const next = isPickup ? c.confirmPickup : c.confirmShip;
    // A pickup confirmation shows the hours but NOT the address yet: the
    // customer waits for the "ready" email before coming by.
    const hours = isPickup ? pickupBlock(c, lang, pickup, { withAddress: false }) : { html: "", text: "" };
    const url = orderLink(origin, order);
    return {
      subject: c.confirmSubject(order.order_number),
      html: layout(c.confirmTitle, `${numberLine}<p style="font-size:14px;line-height:1.5">${esc(next)}</p>${hours.html}${itemsTable(order, c)}${button(url, c.viewOrder)}<p style="font-size:12px;color:#8A91AC">${esc(c.linkNote)}</p>`, c.footer),
      text: [c.confirmTitle, `${c.orderNumber}: ${order.order_number}`, next, hours.text, `${c.total}: ${money(order.total_cents)}`, `${c.viewOrder}: ${url}`, c.linkNote]
        .filter(Boolean)
        .join("\n"),
    };
  }
  if (kind === "ready_for_pickup") {
    const url = orderLink(origin, order);
    const block = pickupBlock(c, lang, pickup, { withAddress: true });
    return {
      subject: c.readySubject(order.order_number),
      html: layout(c.readyTitle, `${numberLine}<p style="font-size:14px;line-height:1.5">${esc(c.readyText)}</p>${block.html}${itemsTable(order, c)}${button(url, c.viewOrder)}`, c.footer),
      text: [c.readyTitle, `${c.orderNumber}: ${order.order_number}`, c.readyText, block.text, `${c.viewOrder}: ${url}`].join("\n"),
    };
  }
  if (kind === "shipped") {
    const url = orderLink(origin, order);
    const carrierCode = order.label_carrier || order.shipping_carrier || "";
    const carrier = `${carrierCode} ${order.label_service || order.shipping_service || ""}`.trim();
    const track = trackingUrl(carrierCode, order.tracking_number);
    return {
      subject: c.shippedSubject(order.order_number),
      html: layout(
        c.shippedTitle,
        `${numberLine}<p style="font-size:14px">${esc(carrier)}<br>${esc(c.tracking)}: <b>${esc(order.tracking_number || "—")}</b></p>${track ? button(track, c.trackButton) : ""}<p style="font-size:13px"><a href="${esc(url)}" style="color:#20266F">${esc(c.viewOrder)}</a></p>`,
        c.footer
      ),
      text: [c.shippedTitle, `${c.orderNumber}: ${order.order_number}`, carrier, `${c.tracking}: ${order.tracking_number || "—"}`, track || "", `${c.viewOrder}: ${url}`].filter(Boolean).join("\n"),
    };
  }
  throw new Error(`unknown_email_${kind}`);
}

export function renderAccountLink(lang, link) {
  const c = COPY[lang === "es" ? "es" : "en"];
  return {
    subject: c.accountSubject,
    html: layout(c.accountTitle, `<p style="font-size:14px;line-height:1.5">${esc(c.accountText)}</p>${button(link, c.accountButton)}`, c.footer),
    text: `${c.accountTitle}\n${c.accountText}\n${link}`,
  };
}

export function createResendMailer({ apiKey, from, replyTo, fetchImpl = fetch }) {
  return {
    name: "resend",
    async send({ to, subject, html, text }) {
      const res = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`resend_${res.status}: ${body?.message || ""}`.trim());
      return { id: body.id || null };
    },
  };
}

/** Records instead of sending — dev server and tests read `sent`. */
export function createOutboxMailer() {
  const sent = [];
  return {
    name: "outbox",
    sent,
    async send(msg) {
      sent.push(msg);
      return { id: `outbox-${sent.length}` };
    },
  };
}
