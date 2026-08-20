import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Lock, Home } from "lucide-react";
import { Logo } from "../components/ui/Logo.jsx";
import { useSEO } from "../lib/seo.js";
import { fetchWholesaleCatalog, wholesaleLogout } from "../lib/wholesaleAuth.js";
import { wholesaleHoverProps } from "../lib/wholesaleSound.js";
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

// Where "Main website" and (after a real logout) "Log out" both send the
// shop, same tab, full navigation — a single constant so both call sites
// and every test that pins the exact URL stay in sync automatically.
const MAIN_WEBSITE_URL = "https://www.toraysboost.com/";
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

  // Which wizard screen is currently showing — used only to hide the
  // (unrelated) Sales module on the narrowest phones while the price
  // result is on screen, see .wsp-sales-hide-on-narrow-result in
  // wholesalePortal.css. Every other screen/breakpoint keeps it visible.
  const [wizardScreen, setWizardScreen] = useState("top");

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

  // "Main website" — a plain external link, same tab, never touches the
  // session in any way (Pro stays logged in behind it).
  function handleMainWebsite() {
    window.location.href = MAIN_WEBSITE_URL;
  }

  // Real logout FIRST (revokes the session + clears the ws_session cookie
  // server-side — see api/wholesale-logout.js, unchanged, not reimplemented
  // here), THEN clear whatever private data this component is still holding
  // in memory, and only THEN redirect. wholesaleLogout() already swallows
  // its own network errors (never rejects) so this ordering — and the
  // redirect specifically — runs unconditionally whether the revoke call
  // succeeded or not: a network failure must never leave the private
  // catalog visible in the UI, even if the server-side session technically
  // outlives it.
  async function handleLogout() {
    await wholesaleLogout();
    setState({
      status: "loading",
      shopName: "",
      equipmentTypes: [],
      microsoldering: null,
      salesModule: null,
      errorMessage: "",
    });
    window.location.href = MAIN_WEBSITE_URL;
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
        <button type="button" {...wholesaleHoverProps(loadCatalog)} className="wsp-btn wsp-btn-primary">
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
      <div className="mx-auto flex max-w-6xl flex-col gap-[clamp(2px,0.5vh,16px)] px-4 py-[clamp(1px,0.25vh,14px)] sm:px-8">
        <div className="flex flex-col gap-[clamp(2px,0.5vh,10px)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Logo size="sm" />
            <div className="flex flex-wrap items-center gap-2">
              <WholesaleSoundToggle />
              <WholesaleLocaleSelector />
            </div>
          </div>

          {/* "Main website" sits beside Logout rather than in the Sound/
              Locale row above: that row is already the tightest one in this
              header at 320px (the locale selector alone needs real width),
              and Logout's own row already wraps to its full available width
              at this size with plenty of room to spare beside it — adding
              Main Website here costs far less vertical space than adding a
              fourth control to the already-cramped row above would. It's
              still visually distinct from Logout (own quiet pill class, see
              .wsp-main-site-link — never .wsp-btn-ghost), just physically
              adjacent, satisfying "near Sound/locale/Logout" without
              growing the header more than necessary. */}
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
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                {...wholesaleHoverProps(handleMainWebsite)}
                className="wsp-main-site-link"
                aria-label={t("portal.mainWebsite")}
              >
                <Home size={14} aria-hidden="true" />
                <span className="wsp-main-site-link-text">{t("portal.mainWebsite")}</span>
              </button>
              <button type="button" {...wholesaleHoverProps(handleLogout)} className="wsp-btn wsp-btn-ghost">
                <LogOut size={16} />
                {t("portal.logout")}
              </button>
            </div>
          </div>
        </div>

        {/* No-scroll spec: the generic page title used to live here as its
            own <h1>, on top of the wizard's own per-screen heading right
            below it (e.g. "Select a Device to View Pricing") — redundant
            content taking its own row of vertical space. Every wizard
            screen (and the progress/result panels) already renders its own
            heading, now promoted to <h1>, so the page keeps exactly one
            top-level heading at all times without a separate static one. */}
        <WholesaleWizard
          equipmentTypes={state.equipmentTypes}
          microsoldering={state.microsoldering}
          onScreenChange={setWizardScreen}
        />

        {/* Hidden ONLY on the narrowest phones (see the CSS rule) while the
            price result is showing — everything the shop actually asked to
            see (Shop Cost, all three tiers, profit, margin, the
            recommendation, the button) stays full-size and fully visible;
            this unrelated maintenance-mode module is what yields the room
            instead. Every other screen and every wider breakpoint keeps it
            visible exactly as before. */}
        <div className={wizardScreen === "result" ? "wsp-sales-hide-on-narrow-result" : undefined}>
          <WholesaleSalesModule salesModule={state.salesModule} />
        </div>
      </div>
    </div>
  );
}
