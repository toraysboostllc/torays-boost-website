import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Store, Loader2, Truck, Plus, Trash2 } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext.jsx";
import { shopApi } from "../../../lib/shopApi.js";
import { BTN, INPUT, PANEL } from "../../../components/shop/ShopLayout.jsx";

const WEEK = [1, 2, 3, 4, 5, 6, 0]; // Monday first

/** Pickup settings (editable, stored in Supabase) + the read-only status of
 *  every connection. Keys and payment switches stay in Vercel environment
 *  variables on purpose — nothing secret is editable here. */
function PickupSettings() {
  const { t } = useLanguage();
  const S = (k) => t(`shop.admin.settings.${k}`);
  const [form, setForm] = useState(null);
  const [state, setState] = useState({ busy: false, msg: null, ok: false });

  useEffect(() => {
    shopApi.adminSettings().then(({ settings }) => {
      const byDay = Object.fromEntries(settings.pickupHours.map((h) => [h.day, h]));
      setForm({
        ...settings,
        week: WEEK.map((day) => ({ day, on: !!byDay[day], open: byDay[day]?.open || "10:00", close: byDay[day]?.close || "18:00" })),
      });
    });
  }, []);

  async function save(e) {
    e.preventDefault();
    setState({ busy: true, msg: null, ok: false });
    try {
      const { settings } = await shopApi.adminSaveSettings({
        pickup: {
          pickupEnabled: form.pickupEnabled,
          pickupArea: form.pickupArea,
          pickupAddress: form.pickupAddress,
          pickupNotes: form.pickupNotes,
          pickupHours: form.week.filter((d) => d.on).map(({ day, open, close }) => ({ day, open, close })),
        },
      });
      setForm((f) => ({ ...f, updatedAt: settings.updatedAt }));
      setState({ busy: false, msg: S("saved"), ok: true });
    } catch (err) {
      const field = err.body?.field;
      setState({ busy: false, msg: S(`errors.${field === "pickupAddress" || field === "pickupHours" ? field : "generic"}`), ok: false });
    }
  }

  if (!form) return <div className="h-64 animate-pulse rounded-2xl bg-torays-surface-alt" />;
  const setDay = (i, patch) => setForm((f) => ({ ...f, week: f.week.map((d, j) => (j === i ? { ...d, ...patch } : d)) }));
  const days = t("shop.days");

  return (
    <form onSubmit={save} className={`${PANEL} space-y-4`}>
      <div className="flex items-center gap-2">
        <Store size={20} className="text-torays-navy" />
        <h2 className="font-heading text-lg font-semibold">{S("pickupTitle")}</h2>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          className="h-5 w-5 accent-torays-navy"
          checked={form.pickupEnabled}
          onChange={(e) => setForm((f) => ({ ...f, pickupEnabled: e.target.checked }))}
        />
        {S("pickupEnable")}
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-torays-text-secondary">{S("area")}</span>
          <input className={INPUT} value={form.pickupArea} maxLength={80} onChange={(e) => setForm((f) => ({ ...f, pickupArea: e.target.value }))} />
          <span className="mt-1 block text-xs text-torays-text-muted">{S("areaHint")}</span>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-torays-text-secondary">{S("address")}</span>
          <textarea className={`${INPUT} min-h-[76px]`} value={form.pickupAddress} maxLength={300} onChange={(e) => setForm((f) => ({ ...f, pickupAddress: e.target.value }))} />
          <span className="mt-1 block text-xs text-torays-text-muted">{S("addressHint")}</span>
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">{S("hoursTitle")}</legend>
        <p className="mb-2 text-xs text-torays-text-muted">{S("hoursHint")}</p>
        <div className="divide-y divide-torays-line rounded-xl border border-torays-line">
          {form.week.map((d, i) => (
            <div key={d.day} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
              <label className="flex min-h-11 w-32 items-center gap-2 text-sm font-medium">
                <input type="checkbox" className="h-4 w-4 accent-torays-navy" checked={d.on} onChange={(e) => setDay(i, { on: e.target.checked })} />
                {Array.isArray(days) ? days[d.day] : d.day}
              </label>
              {d.on ? (
                <div className="flex items-center gap-2 text-sm">
                  <label className="sr-only" htmlFor={`open-${d.day}`}>{S("open")}</label>
                  <input id={`open-${d.day}`} type="time" className={`${INPUT} w-[120px]`} value={d.open} onChange={(e) => setDay(i, { open: e.target.value })} />
                  <span className="text-torays-text-muted">–</span>
                  <label className="sr-only" htmlFor={`close-${d.day}`}>{S("close")}</label>
                  <input id={`close-${d.day}`} type="time" className={`${INPUT} w-[120px]`} value={d.close} onChange={(e) => setDay(i, { close: e.target.value })} />
                </div>
              ) : (
                <span className="text-sm text-torays-text-muted">{S("closed")}</span>
              )}
            </div>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-torays-text-secondary">{S("notes")}</span>
        <textarea className={`${INPUT} min-h-[64px]`} value={form.pickupNotes} maxLength={600} onChange={(e) => setForm((f) => ({ ...f, pickupNotes: e.target.value }))} />
        <span className="mt-1 block text-xs text-torays-text-muted">{S("notesHint")}</span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={BTN.dark} disabled={state.busy}>
          {state.busy ? <Loader2 size={18} className="animate-spin" /> : null} {state.busy ? S("saving") : S("save")}
        </button>
        {state.msg && (
          <span role="status" className={`text-sm font-medium ${state.ok ? "text-quote-wa" : "text-torays-red-dark"}`}>
            {state.msg}
          </span>
        )}
      </div>
    </form>
  );
}

const SERVICE_SUGGESTIONS = {
  USPS: ["Ground Advantage", "Priority Mail", "Priority Mail Express"],
  UPS: ["Ground", "Ground Saver", "2nd Day Air", "Next Day Air Saver"],
};

/** What the customer pays per option. Labels are bought by hand in Pirate
 *  Ship, so these are the owner's prices — never live carrier rates. */
function ShippingSettings() {
  const { t } = useLanguage();
  const S = (k, v) => t(`shop.admin.settings.${k}`, v);
  const [rows, setRows] = useState(null);
  const [state, setState] = useState({ busy: false, msg: null, ok: false });

  useEffect(() => {
    shopApi.adminSettings().then(({ settings }) => setRows(settings.shippingOptions));
  }, []);

  const setRow = (i, patch) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function save(e) {
    e.preventDefault();
    setState({ busy: true, msg: null, ok: false });
    try {
      const { settings } = await shopApi.adminSaveSettings({ shippingOptions: rows });
      setRows(settings.shippingOptions);
      setState({ busy: false, msg: S("saved"), ok: true });
    } catch (err) {
      const m = /^shippingOptions\.(\d+)$/.exec(err.body?.field || "");
      setState({ busy: false, msg: m ? S("shippingRowError", { n: Number(m[1]) + 1 }) : S("errors.generic"), ok: false });
    }
  }

  if (!rows) return <div className="h-48 animate-pulse rounded-2xl bg-torays-surface-alt" />;
  return (
    <form onSubmit={save} className={`${PANEL} space-y-4`}>
      <div className="flex items-center gap-2">
        <Truck size={20} className="text-torays-navy" />
        <h2 className="font-heading text-lg font-semibold">{S("shippingTitle")}</h2>
      </div>
      <p className="text-sm text-torays-text-secondary">{S("shippingHint")}</p>
      <datalist id="usps-services">{SERVICE_SUGGESTIONS.USPS.map((x) => <option key={x} value={x} />)}</datalist>
      <datalist id="ups-services">{SERVICE_SUGGESTIONS.UPS.map((x) => <option key={x} value={x} />)}</datalist>
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={r.id || i} className="grid grid-cols-2 gap-2 rounded-xl border border-torays-line p-3 md:grid-cols-[110px_1fr_110px_150px_auto_auto] md:items-end">
            <label className="block">
              <span className="mb-1 block text-xs text-torays-text-secondary">{S("carrier")}</span>
              <select className={INPUT} value={r.carrier} onChange={(e) => setRow(i, { carrier: e.target.value })}>
                <option>USPS</option>
                <option>UPS</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-torays-text-secondary">{S("service")}</span>
              <input className={INPUT} list={r.carrier === "UPS" ? "ups-services" : "usps-services"} value={r.service} maxLength={60} onChange={(e) => setRow(i, { service: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-torays-text-secondary">{S("price")}</span>
              <input className={INPUT} inputMode="decimal" value={r.price} onChange={(e) => setRow(i, { price: e.target.value })} placeholder="0.00" />
            </label>
            <div>
              <span className="mb-1 block text-xs text-torays-text-secondary">{S("days")}</span>
              <div className="flex items-center gap-1">
                <input className={`${INPUT} w-16`} inputMode="numeric" aria-label={S("daysMin")} value={r.daysMin} onChange={(e) => setRow(i, { daysMin: e.target.value })} />
                <span className="text-torays-text-muted">–</span>
                <input className={`${INPUT} w-16`} inputMode="numeric" aria-label={S("daysMax")} value={r.daysMax} onChange={(e) => setRow(i, { daysMax: e.target.value })} />
              </div>
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-torays-navy" checked={r.enabled} onChange={(e) => setRow(i, { enabled: e.target.checked })} />
              {S("offered")}
            </label>
            <button type="button" aria-label={S("removeOption")} onClick={() => setRows((x) => x.filter((_, j) => j !== i))} className={`${BTN.ghost} min-h-11 px-3 text-torays-red-dark`}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      {rows.length < 10 && (
        <button type="button" className={BTN.ghost} onClick={() => setRows((x) => [...x, { carrier: "USPS", service: "Ground Advantage", price: "", daysMin: "", daysMax: "", enabled: true }])}>
          <Plus size={16} /> {S("addOption")}
        </button>
      )}
      {rows.length === 0 && <p className="text-sm font-medium text-torays-red-dark">{S("noOptions")}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={BTN.dark} disabled={state.busy}>
          {state.busy ? <Loader2 size={18} className="animate-spin" /> : null} {state.busy ? S("saving") : S("save")}
        </button>
        {state.msg && (
          <span role="status" className={`text-sm font-medium ${state.ok ? "text-quote-wa" : "text-torays-red-dark"}`}>
            {state.msg}
          </span>
        )}
      </div>
    </form>
  );
}

export function AdminSettings({ me }) {
  const { t } = useLanguage();
  const S = (k) => t(`shop.admin.settings.${k}`);
  const rows = [
    [S("paypal"), me.paymentsConfigured, me.paymentsConfigured ? t(`shop.admin.settings.modes.${me.environment}`) : `${S("notConfigured")}${me.paymentsError ? ` (${me.paymentsError})` : ""}`],
    [S("webhook"), me.webhookConfigured, me.webhookConfigured ? S("configured") : S("notConfigured")],
    [S("shipping"), me.shippingOptions > 0, me.shippingOptions > 0 ? S("shippingManual", { n: me.shippingOptions }) : S("noOptions")],
    [S("email"), me.mailer === "resend", me.mailer === "resend" ? "Resend" : S("emailOff")],
    [S("taxes"), false, S("taxesOff")],
  ];
  return (
    <div className="space-y-5">
      <h1 className="font-heading text-2xl font-bold">{S("title")}</h1>
      <ShippingSettings />
      <PickupSettings />
      <div>
        <h2 className="mb-2 font-heading text-lg font-semibold">{S("connections")}</h2>
        <ul className={`${PANEL} divide-y divide-torays-line p-0 md:p-0`}>
          {rows.map(([label, ok, detail]) => (
            <li key={label} className="flex items-start gap-3 px-4 py-3">
              {ok ? <CheckCircle2 size={20} className="shrink-0 text-quote-wa" /> : <XCircle size={20} className="shrink-0 text-torays-text-muted" />}
              <div>
                <div className="font-semibold">{label}</div>
                <div className="text-sm text-torays-text-secondary">{detail}</div>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-torays-text-muted">{me.email}</p>
      </div>
    </div>
  );
}
