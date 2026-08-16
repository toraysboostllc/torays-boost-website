import { Routes, Route } from "react-router-dom";
import { Home } from "./pages/Home.jsx";
import { Privacy } from "./pages/Privacy.jsx";
import { Terms } from "./pages/Terms.jsx";
import { WholesaleLogin } from "./pages/WholesaleLogin.jsx";
import { WholesalePrices } from "./pages/WholesalePrices.jsx";
import { NotFound } from "./pages/NotFound.jsx";
import { MaintenancePage } from "./pages/MaintenancePage.jsx";
import { SITE_MAINTENANCE_MODE } from "./config/maintenance.config.js";

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
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/wholesale" element={<WholesaleLogin />} />
      <Route path="/wholesale/prices" element={<WholesalePrices />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
