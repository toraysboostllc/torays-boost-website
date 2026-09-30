import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Mail, LogOut, Package } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import { useSEO } from "../../lib/seo.js";
import { shopApi } from "../../lib/shopApi.js";
import { formatMoney } from "../../lib/shopCart.js";
import { ShopShell, BTN, INPUT, PANEL } from "../../components/shop/ShopLayout.jsx";

/**
 * Optional customer account — passwordless. /tienda/cuenta?link=… is the
 * one-time link from the email; it's exchanged for an HttpOnly session and
 * immediately removed from the address bar.
 */
function RequestLink({ notice }) {
  const { t, lang } = useLanguage();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await shopApi.accountRequestLink(email, lang);
      setSent(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`${PANEL} mx-auto max-w-md`}>
      <h1 className="font-heading text-xl font-bold">{t("shop.account.signInTitle")}</h1>
      {notice && <p className="mt-2 text-sm font-medium text-torays-red-dark" role="alert">{notice}</p>}
      <p className="mt-2 text-sm leading-relaxed text-torays-text-secondary">{t("shop.account.signInText")}</p>
      {sent ? (
        <p className="mt-4 flex items-center gap-2 text-sm font-medium text-quote-wa" role="status">
          <Mail size={16} /> {t("shop.account.sent")}
        </p>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input className={INPUT} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@email.com" required />
          <button type="submit" className={`${BTN.dark} w-full`} disabled={busy}>
            {t("shop.account.send")}
          </button>
        </form>
      )}
    </div>
  );
}

export function ShopAccount() {
  const { t, lang } = useLanguage();
  useSEO({ title: t("shop.account.title"), noindex: true });
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState(undefined);
  const [form, setForm] = useState(null);
  const [notice, setNotice] = useState(null);
  const [saved, setSaved] = useState(false);
  const verifying = useRef(false);

  const load = () =>
    shopApi
      .accountMe()
      .then((d) => {
        setData(d);
        setForm({ name: d.customer.name, phone: d.customer.phone, ...d.customer.address });
      })
      .catch(() => setData(null));

  useEffect(() => {
    const link = params.get("link");
    if (link && !verifying.current) {
      verifying.current = true;
      // Drop the one-time token from the URL/history right away.
      navigate("/tienda/cuenta", { replace: true });
      shopApi
        .accountVerify(link)
        .then(load)
        .catch(() => {
          setNotice(t("shop.account.linkInvalid"));
          setData(null);
        });
      return;
    }
    if (!link) load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e) {
    e.preventDefault();
    const { name, phone, line1, line2, city, state, zip } = form;
    await shopApi.accountUpdate({ name, phone, address: { line1, line2, city, state, zip } });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (data === undefined) {
    return (
      <ShopShell>
        <p className="flex items-center justify-center gap-2 py-16 text-torays-text-secondary">
          <Loader2 className="animate-spin" size={18} /> {t("shop.account.verifying")}
        </p>
      </ShopShell>
    );
  }
  if (!data) {
    return (
      <ShopShell>
        <RequestLink notice={notice} />
      </ShopShell>
    );
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <ShopShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">{t("shop.account.title")}</h1>
          <p className="text-sm text-torays-text-muted">{data.customer.email}</p>
        </div>
        <button type="button" className={BTN.ghost} onClick={() => shopApi.accountLogout().finally(() => setData(null))}>
          <LogOut size={16} /> {t("shop.account.signOut")}
        </button>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_1fr] lg:items-start">
        <section className={PANEL}>
          <h2 className="mb-3 font-heading text-lg font-semibold">{t("shop.account.orders")}</h2>
          {data.orders.length === 0 ? (
            <p className="text-sm text-torays-text-secondary">{t("shop.account.noOrders")}</p>
          ) : (
            <ul className="divide-y divide-torays-line">
              {data.orders.map((o) => (
                <li key={o.orderNumber} className="flex items-center gap-3 py-3">
                  <Package size={18} className="shrink-0 text-torays-navy" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{o.orderNumber}</div>
                    <div className="truncate text-xs text-torays-text-muted">
                      {o.items.map((i) => `${i.quantity} × ${i.title}`).join(", ")}
                    </div>
                    <div className="text-xs text-torays-text-secondary">{t(`shop.admin.orders.status.${o.status}`)}</div>
                  </div>
                  <span className="text-sm font-semibold">{formatMoney(o.totalCents, lang)}</span>
                  <Link to={o.link} className={`${BTN.ghost} min-h-10 px-3 py-1.5 text-sm`}>
                    {t("shop.account.open")}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <form onSubmit={save} className={`${PANEL} space-y-3`}>
          <div>
            <h2 className="font-heading text-lg font-semibold">{t("shop.account.details")}</h2>
            <p className="text-xs text-torays-text-muted">{t("shop.account.detailsHint")}</p>
          </div>
          {[
            ["name", "shop.checkout.name"],
            ["phone", "shop.checkout.phone"],
            ["line1", "shop.checkout.line1"],
            ["line2", "shop.checkout.line2"],
            ["city", "shop.checkout.city"],
          ].map(([k, label]) => (
            <label key={k} className="block">
              <span className="mb-1 block text-xs font-medium text-torays-text-secondary">{t(label)}</span>
              <input className={INPUT} value={form[k]} onChange={set(k)} />
            </label>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-torays-text-secondary">{t("shop.checkout.state")}</span>
              <input className={INPUT} value={form.state} onChange={set("state")} maxLength={2} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-torays-text-secondary">{t("shop.checkout.zip")}</span>
              <input className={INPUT} value={form.zip} onChange={set("zip")} inputMode="numeric" />
            </label>
          </div>
          <button type="submit" className={`${BTN.dark} w-full`}>
            {saved ? t("shop.account.saved") : t("shop.account.save")}
          </button>
          <button
            type="button"
            className="w-full text-center text-xs text-torays-text-muted underline underline-offset-2 hover:text-torays-red-dark"
            onClick={async () => {
              if (!window.confirm(t("shop.account.confirmForget"))) return;
              await shopApi.accountForget();
              setData(null);
            }}
          >
            {t("shop.account.forget")}
          </button>
        </form>
      </div>
    </ShopShell>
  );
}
