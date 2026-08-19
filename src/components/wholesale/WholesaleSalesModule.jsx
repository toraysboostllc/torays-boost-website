import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import { useWholesaleLocale } from "../../i18n/WholesaleLocaleContext.jsx";

/**
 * "Torays Boost Sales" — visible but not yet functional, per the approved
 * scope ("No construir todavía el sistema completo de ventas"). Every flag
 * here (`visible`, `status`, `entryBlocked`) comes straight from
 * wholesale_portal_settings via /api/wholesale-prices's `salesModule` field
 * — DESK is the only place any of it is ever set. There is genuinely no
 * real sales destination to navigate to yet in either state, so clicking
 * always shows the maintenance message inline (never a route change, never
 * a new tab) — but `status` still drives the visible badge text end to end,
 * so the DESK toggle is not a dead control even before the real flow exists.
 */
export function WholesaleSalesModule({ salesModule }) {
  const { t } = useWholesaleLocale();
  const [showMessage, setShowMessage] = useState(false);

  if (!salesModule?.visible) return null;

  return (
    <div className="wsp-card wsp-sales-module">
      <button
        type="button"
        className="wsp-sales-module-trigger"
        onClick={() => setShowMessage((prev) => !prev)}
        aria-expanded={showMessage}
      >
        <span className="wsp-sales-module-icon" aria-hidden="true">
          <ShoppingBag size={22} />
        </span>
        <span className="wsp-sales-module-text">
          <span className="wsp-sales-module-title">{t("sales.title")}</span>
          <span className="wsp-sales-module-subtitle">{t("sales.subtitle")}</span>
        </span>
        <span className={`wsp-sales-module-badge wsp-sales-module-badge-${salesModule.status}`}>
          {salesModule.status === "active" ? t("sales.statusActive") : t("sales.statusBadge")}
        </span>
      </button>

      {showMessage && <p className="wsp-sales-module-message">{t("sales.maintenanceMessage")}</p>}
    </div>
  );
}
