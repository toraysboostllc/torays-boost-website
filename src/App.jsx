import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import { Home } from "./pages/Home.jsx";
import { NotFound } from "./pages/NotFound.jsx";
import { MaintenancePage } from "./pages/MaintenancePage.jsx";
import { SITE_MAINTENANCE_MODE } from "./config/maintenance.config.js";
import { useLanguage } from "./i18n/LanguageContext.jsx";

// Not needed to land on Home or start a repair quote — split into their
// own chunks so visiting "/" never downloads the Wholesale portal or the
// legal pages. NotFound stays a static import: it only needs Button +
// useSEO, both already pulled in by Home, so lazy-loading it would add a
// network round-trip for zero real byte savings.
const Privacy = lazy(() => import("./pages/Privacy.jsx").then((m) => ({ default: m.Privacy })));
const Terms = lazy(() => import("./pages/Terms.jsx").then((m) => ({ default: m.Terms })));
const ImageCredits = lazy(() => import("./pages/ImageCredits.jsx").then((m) => ({ default: m.ImageCredits })));
const WholesaleLogin = lazy(() =>
  import("./pages/WholesaleLogin.jsx").then((m) => ({ default: m.WholesaleLogin }))
);
const WholesalePrices = lazy(() =>
  import("./pages/WholesalePrices.jsx").then((m) => ({ default: m.WholesalePrices }))
);

// Deliberately not a spinner: a single centered line of text, same
// background token as the rest of the site, `min-h-screen` so the
// fallback occupies the full viewport it's about to be replaced in —
// nothing shifts when the real page mounts on top of it.
function RouteLoadingFallback() {
  const { t } = useLanguage();
  return (
    <div className="flex min-h-screen items-center justify-center bg-torays-bg" role="status" aria-live="polite">
      <span className="text-sm text-torays-text-secondary">{t("common.loading")}</span>
    </div>
  );
}

export default function App() {
  // Global site lock — see maintenance.config.js. While true, NONE of the
  // routes below mount for ANY path: this return happens before <Routes>
  // is ever reached, so Home/WholesaleLogin/WholesalePrices never render
  // and nothing they do (including the Wholesale API) ever runs.
  // TO RELAUNCH: set SITE_MAINTENANCE_MODE to false in maintenance.config.js.
  if (SITE_MAINTENANCE_MODE) {
    return <MaintenancePage />;
  }

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/image-credits" element={<ImageCredits />} />
        <Route path="/wholesale" element={<WholesaleLogin />} />
        <Route path="/wholesale/prices" element={<WholesalePrices />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
