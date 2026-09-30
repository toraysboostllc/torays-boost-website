import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useLanguage } from "../../../i18n/LanguageContext.jsx";
import { shopApi } from "../../../lib/shopApi.js";
import { formatMoney } from "../../../lib/shopCart.js";
import { BTN, INPUT } from "../../../components/shop/ShopLayout.jsx";
import { Kpi } from "./AdminProducts.jsx";

const COLS = [
  ["date", "date"],
  ["order", "orderNumber"],
  ["products", "products"],
  ["sales", "itemsCents", true],
  ["shipping", "shippingChargedCents", true],
  ["tax", "taxCents", true],
  ["fee", "paypalFeeCents", true],
  ["refund", "refundCents", true],
  ["net", "netReceivedCents", true],
  ["label", "labelCostCents", true],
];

export function AdminSales({ environment }) {
  const { t, lang } = useLanguage();
  const year = new Date().getFullYear();
  const [range, setRange] = useState({ from: `${year}-01-01`, to: `${year}-12-31` });
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    shopApi.adminSales(range).then(setData).catch(() => setData({ rows: [], totals: {} }));
  }, [range]);

  const m = (c) => (c == null ? "—" : formatMoney(c, lang));
  const tt = data?.totals || {};
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold">{t("shop.admin.sales.title")}</h1>
        <div className="flex flex-wrap items-end gap-2">
          {["from", "to"].map((k) => (
            <label key={k} className="block">
              <span className="mb-1 block text-xs text-torays-text-secondary">{t(`shop.admin.sales.${k}`)}</span>
              <input type="date" className={`${INPUT} w-auto`} value={range[k]} onChange={(e) => setRange((r) => ({ ...r, [k]: e.target.value }))} />
            </label>
          ))}
          <a href={shopApi.salesCsvUrl(range)} className={BTN.dark} download>
            <Download size={18} /> {t("shop.admin.sales.exportCsv")}
          </a>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label={t("shop.admin.sales.gross")} value={m(tt.totalCents)} />
        <Kpi label={t("shop.admin.sales.fees")} value={m(tt.paypalFeeCents)} tone="text-torays-red-dark" />
        <Kpi label={t("shop.admin.sales.refunds")} value={m(tt.refundCents)} tone="text-torays-red-dark" />
        <Kpi label={t("shop.admin.sales.net")} value={m(tt.netReceivedCents)} tone="text-quote-wa" />
        {/* Label totals only mean something once labels are recorded. */}
        <Kpi label={t("shop.admin.sales.labels")} value={tt.orders && tt.labelsMissing === tt.orders ? "—" : m(tt.labelCostCents)} />
        <Kpi label={t("shop.admin.sales.netAfter")} value={tt.orders && tt.labelsMissing === tt.orders ? "—" : m(tt.netAfterShippingCents)} />
      </div>

      {!data ? (
        <div className="h-40 animate-pulse rounded-2xl bg-torays-surface-alt" />
      ) : data.rows.length === 0 ? (
        <p className="rounded-2xl border border-torays-line bg-torays-surface p-6 text-center text-sm text-torays-text-secondary">{t("shop.admin.sales.empty")}</p>
      ) : (
        <div className="max-h-[480px] overflow-auto rounded-2xl border border-torays-line bg-torays-surface">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead className="sticky top-0 bg-torays-surface-alt text-[11px] text-torays-text-muted">
              <tr>
                {COLS.map(([k, , money]) => (
                  <th key={k} className={`whitespace-nowrap px-3 py-2 font-semibold ${money ? "text-right" : "text-left"}`}>
                    {t(`shop.admin.sales.cols.${k}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.orderNumber} className="border-t border-torays-line">
                  {COLS.map(([k, field, money]) => (
                    <td key={k} className={`px-3 py-2 ${money ? "whitespace-nowrap text-right" : ""} ${k === "products" ? "max-w-[220px] truncate" : "whitespace-nowrap"}`}>
                      {money ? m(r[field]) : r[field]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs leading-relaxed text-torays-text-muted">
        {t("shop.admin.sales.note", { n: tt.labelsMissing ?? 0 })} {t("shop.admin.sales.envNote", { env: t(`shop.admin.settings.modes.${environment}`) })}
      </p>
    </div>
  );
}
