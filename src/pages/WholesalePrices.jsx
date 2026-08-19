import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Lock } from "lucide-react";
import { Logo } from "../components/ui/Logo.jsx";
import { useSEO } from "../lib/seo.js";
import { fetchWholesaleCatalog, wholesaleLogout } from "../lib/wholesaleAuth.js";
import { WholesaleLocaleProvider, useWholesaleLocale } from "../i18n/WholesaleLocaleContext.jsx";
import { WholesaleLocaleSelector } from "../components/wholesale/WholesaleLocaleSelector.jsx";
import { WholesaleSoundToggle } from "../components/wholesale/WholesaleSoundToggle.jsx";
import { WholesaleWizard } from "../components/wholesale/WholesaleWizard.jsx";
import { WholesaleSalesModule } from "../components/wholesale/WholesaleSalesModule.jsx";

/**
 * Same auth/session model as before this round — nothing here changed:
 * ws_session is an HttpOnly cookie the browser sends automatically, no
 * client-held token, no local session check. The only thing that changed
 * is HOW a failed fetch is handled — see loadCatalog() below.
 */
export function WholesalePrices() {
  return (
    <WholesaleLocaleProvider>
      <WholesalePricesContent />
    </WholesaleLocaleProvider>
  );
}

function WholesalePricesContent() {
  const { t } = useWholesaleLocale();
  useSEO({ title: "Wholesale Prices", noindex: true });
  const navigate = useNavigate();

  // status: "loading" | "ready" | "error"
  const [state, setState] = useState({
    status: "loading",
    shopName: "",
    equipmentTypes: [],
    microsoldering: null,
    salesModule: null,
    errorMessage: "",
  });

  function loadCatalog() {
    setState((prev) => ({ ...prev, status: "loading" }));
    fetchWholesaleCatalog().then((result) => {
      if (!result.ok) {
        // Fixed bug: only a genuine auth failure (expired session / revoked
        // access) redirects to the login screen. A transient server/network
        // error (result.kind === "transient") shows the real error inline
        // with a Retry button instead of silently bouncing the shop back to
        // /wholesale, which used to happen for ANY failure here.
        if (result.kind === "auth") {
          navigate("/wholesale");
          return;
        }
        setState((prev) => ({ ...prev, status: "error", errorMessage: result.message }));
        return;
      }
      setState({
        status: "ready",
        shopName: result.shopName,
        equipmentTypes: result.equipmentTypes,
        microsoldering: result.microsoldering,
        salesModule: result.salesModule,
        errorMessage: "",
      });
    });
  }

  useEffect(() => {
    loadCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadCatalog is
    // stable in intent (only reads navigate, which react-router guarantees
    // stable); re-running this on every render would refetch in a loop.
  }, []);

  async function handleLogout() {
    await wholesaleLogout();
    navigate("/wholesale");
  }

  if (state.status === "loading") {
    return (
      <div className="wsp-scope flex min-h-screen items-center justify-center">
        <p className="wsp-text-soft">{t("portal.loading")}</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="wsp-scope flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
        <p className="wsp-text-soft">{state.errorMessage || t("portal.errorTransient")}</p>
        <button type="button" onClick={loadCatalog} className="wsp-btn wsp-btn-primary">
          {t("portal.retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="wsp-scope">
      {/* No-scroll spec: this whole top chrome (logo/controls, badges/
          welcome/logout, page title) sits above the wizard on the same
          "Select a Device" screen that must fit a short phone viewport
          without scrolling — gaps/padding use clamp()/vh so they shrink
          together with the wizard's own spacing below instead of eating
          a fixed chunk of the budget regardless of available height. */}
      <div className="mx-auto flex max-w-6xl flex-col gap-[clamp(5px,1vh,16px)] px-4 py-[clamp(3px,0.8vh,14px)] sm:px-8">
        <div className="flex flex-col gap-[clamp(3px,0.8vh,10px)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Logo size="sm" />
            <div className="flex flex-wrap items-center gap-2">
              <WholesaleSoundToggle />
              <WholesaleLocaleSelector />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <div className="wsp-portal-badges">
                <span className="wsp-portal-badge">{t("portal.badge")}</span>
                <span className="wsp-portal-private-badge">
                  <Lock size={11} aria-hidden="true" />
                  {t("portal.privateArea")}
                </span>
              </div>
              <span className="wsp-text-soft text-xs font-medium sm:text-sm">
                {t("portal.welcome", { shopName: state.shopName })}
              </span>
            </div>
            <button type="button" onClick={handleLogout} className="wsp-btn wsp-btn-ghost">
              <LogOut size={16} />
              {t("portal.logout")}
            </button>
          </div>
        </div>

        {/* No-scroll spec: the generic page title used to live here as its
            own <h1>, on top of the wizard's own per-screen heading right
            below it (e.g. "Select a Device to View Pricing") — redundant
            content taking its own row of vertical space. Every wizard
            screen (and the progress/result panels) already renders its own
            heading, now promoted to <h1>, so the page keeps exactly one
            top-level heading at all times without a separate static one. */}
        <WholesaleWizard equipmentTypes={state.equipmentTypes} microsoldering={state.microsoldering} />

        <WholesaleSalesModule salesModule={state.salesModule} />
      </div>
    </div>
  );
}
