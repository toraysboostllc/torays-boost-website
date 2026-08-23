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
import { WholesaleLegalAcceptModal } from "../components/wholesale/WholesaleLegalAcceptModal.jsx";
import { WholesaleEstimateDisclaimerAcceptModal } from "../components/wholesale/WholesaleEstimateDisclaimerAcceptModal.jsx";

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

  // status: "loading" | "ready" | "error" | "legal_required"
  const [state, setState] = useState({
    status: "loading",
    shopName: "",
    equipmentTypes: [],
    // Not read here, only forwarded to WholesaleWizard.
    microsolderingEquipmentType: null,
    // TEMPORARY compatibility passthrough — see buildWholesaleWizardCatalog's
    // header. Not read here, only forwarded to WholesaleWizard.
    legacyMicrosoldering: null,
    salesModule: null,
    // Global service warranty — see api/_lib/wholesaleDb.js's own comment.
    // Not read here, only forwarded to WholesaleWizard.
    warranty: null,
    errorMessage: "",
    legalDocumentId: null,
    // Which of the two independent legal gates (master_agreement /
    // estimate_disclaimer) is currently blocking — see fetchWholesaleCatalog's
    // own comment in wholesaleAuth.js for how this is derived from the
    // server's `missing` array.
    documentType: null,
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
        // "legal_required" is its OWN branch, never folded into "auth" —
        // the session/device are fine, the shop just needs to see the
        // clickwrap modal (see WholesaleLegalAcceptModal.jsx). This check
        // is re-run on every loadCatalog() call, including the one the
        // modal itself triggers right after a successful accept, so a
        // still-missing acceptance (e.g. a stale legalDocumentId a second
        // tab tried to accept against) re-shows the modal instead of
        // silently granting access.
        if (result.kind === "legal_required") {
          setState((prev) => ({
            ...prev,
            status: "legal_required",
            legalDocumentId: result.legalDocumentId,
            documentType: result.documentType,
          }));
          return;
        }
        setState((prev) => ({ ...prev, status: "error", errorMessage: result.message }));
        return;
      }
      setState({
        status: "ready",
        shopName: result.shopName,
        equipmentTypes: result.equipmentTypes,
        microsolderingEquipmentType: result.microsolderingEquipmentType,
        legacyMicrosoldering: result.legacyMicrosoldering,
        salesModule: result.salesModule,
        warranty: result.warranty,
        errorMessage: "",
        legalDocumentId: null,
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
      microsolderingEquipmentType: null,
      legacyMicrosoldering: null,
      salesModule: null,
      warranty: null,
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

  // Blocking gate — replaces the wizard entirely (there is no catalog data
  // to show behind it yet anyway). Two independent gates can appear here
  // (master_agreement, estimate_disclaimer — see wholesale-prices.js's own
  // `missing` array comment); state.documentType picks which modal to
  // render. onAccepted re-runs loadCatalog(), which either succeeds (modal
  // unmounts, wizard renders) or, if another gate is still unmet (the
  // second document type, or the version changed again mid-flow),
  // re-shows the appropriate modal with the newly-required
  // legalDocumentId/documentType. onLogout reuses the exact same
  // handleLogout as the rest of this page — always available, independent
  // of the form's validity, per each modal's own header comment.
  if (state.status === "legal_required") {
    // wsp-scope wrapper — same pattern as the loading/error branches above
    // and the main return below. Bug fixed 2026-08-22: this branch was the
    // only one of the four missing it, so none of the --wsp-* custom
    // properties (--wsp-blue, --wsp-blue-light, --wsp-navy, --wsp-btn-text,
    // --wsp-border-strong, ...) were defined anywhere in this modal's
    // render tree. .wsp-btn-primary's background is a gradient built
    // entirely from those undefined variables, so the whole `background`
    // declaration silently failed to resolve (an unresolvable var() makes
    // the property invalid, not merely blank) — the "Accept and Enter" /
    // "Accept and Continue" buttons rendered with no background and
    // effectively invisible white text on the modal's light card, exactly
    // the reported "casi no se ve" bug. Restoring the scope fixes both
    // legal modals' buttons (primary and ghost/Logout alike) at the root
    // cause, without touching wholesalePortal.css or either modal's markup.
    return (
      <div className="wsp-scope">
        {state.documentType === "estimate_disclaimer" ? (
          <WholesaleEstimateDisclaimerAcceptModal
            legalDocumentId={state.legalDocumentId}
            onAccepted={loadCatalog}
            onLogout={handleLogout}
          />
        ) : (
          <WholesaleLegalAcceptModal
            legalDocumentId={state.legalDocumentId}
            onAccepted={loadCatalog}
            onLogout={handleLogout}
          />
        )}
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
      <div className="mx-auto flex max-w-6xl flex-col px-4 py-[clamp(1px,0.25vh,14px)] sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-1">
          {/* Identity block — logo, WHOLESALE PORTAL / PRIVATE AREA, and the
              welcome line, grouped into one small light-glass block so they
              read clearly against the busy background photo instead of
              sitting directly on it. width: fit-content — never a big white
              card, just enough glass to back this specific content. Every
              text color here is an EXISTING token already tuned for a light
              surface (--wsp-blue, --wsp-text-soft, the badge tokens) — no
              new colors, just a background for them to sit on. */}
          <div className="wsp-identity-glass">
            {/* Logo and the WHOLESALE PORTAL/PRIVATE AREA badges share one
                row (badges are shorter than the logo, so this costs no
                extra height beyond the logo's own) — only the welcome line
                gets its own row below. */}
            <div className="flex items-center gap-2">
              <Logo size="sm" />
              <div className="wsp-portal-badges">
                <span className="wsp-portal-badge">{t("portal.badge")}</span>
                <span className="wsp-portal-private-badge">
                  <Lock size={11} aria-hidden="true" />
                  {t("portal.privateArea")}
                </span>
              </div>
            </div>
            <span className="wsp-text-soft text-xs font-medium sm:text-sm">
              {t("portal.welcome", { shopName: state.shopName })}
            </span>
          </div>

          {/* Sound/locale (top) and Main website/Logout (below it) stay
              exactly the controls they were — same classes, same touch
              targets, only their position shifted to the right column now
              that the identity content moved into its own glass block on
              the left. */}
          <div className="flex flex-col items-end gap-1">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <WholesaleSoundToggle />
              <WholesaleLocaleSelector />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
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

        {/* Wizard + Sales move together as one group with a single small
            gap between them (see .wsp-wizard-sales-group) — the ONLY
            separation from the identity/controls header above is this
            group's own margin-top, so there is exactly one controlled gap
            between header and Wizard, never a second one stacked on top of
            it. That margin widens from ≥768px (see the CSS) — mobile keeps
            today's tight spacing so the accepted 320×568 scroll allowance
            doesn't grow. No-scroll spec: the generic page title used to
            live here as its own <h1>, on top of the wizard's own per-screen
            heading right below it — redundant content taking its own row.
            Every wizard screen (and the progress/result panels) already
            renders its own heading, now promoted to <h1>, so the page keeps
            exactly one top-level heading at all times without a separate
            static one. */}
        <div className="wsp-wizard-sales-group">
          <WholesaleWizard
            equipmentTypes={state.equipmentTypes}
            microsolderingEquipmentType={state.microsolderingEquipmentType}
            legacyMicrosoldering={state.legacyMicrosoldering}
            warranty={state.warranty}
            onScreenChange={setWizardScreen}
          />

          {/* Hidden ONLY on the narrowest phones (see the CSS rule) while
              the price result is showing — everything the shop actually
              asked to see (Shop Cost, all three tiers, profit, margin, the
              recommendation, the button) stays full-size and fully visible;
              this unrelated maintenance-mode module is what yields the room
              instead. Every other screen and every wider breakpoint keeps
              it visible exactly as before. */}
          <div className={wizardScreen === "result" ? "wsp-sales-hide-on-narrow-result" : undefined}>
            <WholesaleSalesModule salesModule={state.salesModule} />
          </div>
        </div>
      </div>
    </div>
  );
}
