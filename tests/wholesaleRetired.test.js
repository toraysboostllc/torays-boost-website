import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const appSrc = read("src/App.jsx");
const navbarSrc = read("src/components/layout/Navbar.jsx");
const mainSrc = read("src/main.jsx");
const vercel = JSON.parse(read("vercel.json"));

// Torays Boost Pro / Wholesale was retired on 2026-10-01 — removed from the
// DESK first, then from this site. /quote must keep working exactly as before.
describe("Wholesale / Torays Boost Pro is retired", () => {
  it("App.jsx no longer defines any /wholesale route or Wholesale page", () => {
    expect(appSrc).not.toMatch(/\/wholesale/);
    expect(appSrc).not.toMatch(/Wholesale/);
  });

  it("/quote still opens the repair quote wizard", () => {
    expect(appSrc).toContain('<Route path="/quote" element={<Home openRepairRequestOnLoad />} />');
  });

  it("the Navbar has no portal link, and the portal stylesheet is no longer loaded globally", () => {
    expect(navbarSrc).not.toMatch(/WholesalePortalLink|wholesale/i);
    expect(mainSrc).not.toMatch(/wholesalePortal\.css/);
  });

  it("the portal's pages, components and serverless endpoints are gone", () => {
    [
      "src/pages/WholesaleLogin.jsx",
      "src/pages/WholesalePrices.jsx",
      "src/pages/WholesaleLegal.jsx",
      "src/components/layout/WholesalePortalLink.jsx",
      "src/components/wholesale",
      "src/styles/wholesalePortal.css",
      "api/wholesale-login.js",
      "api/wholesale-prices.js",
    ].forEach((relPath) => expect(existsSync(join(root, relPath)), relPath).toBe(false));
  });

  it("old /wholesale links redirect to the home page instead of a 404", () => {
    const sources = (vercel.redirects || []).filter((r) => r.destination === "/").map((r) => r.source);
    expect(sources).toContain("/wholesale");
    expect(sources).toContain("/wholesale/:path*");
  });
});
