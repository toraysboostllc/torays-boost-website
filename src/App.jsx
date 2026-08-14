import { Routes, Route } from "react-router-dom";
import { Home } from "./pages/Home.jsx";
import { Privacy } from "./pages/Privacy.jsx";
import { Terms } from "./pages/Terms.jsx";
import { WholesaleLogin } from "./pages/WholesaleLogin.jsx";
import { WholesalePrices } from "./pages/WholesalePrices.jsx";
import { NotFound } from "./pages/NotFound.jsx";

export default function App() {
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
