import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const navbarSrc = read("src/components/layout/Navbar.jsx");

// The Shop button took the spot of the retired Torays Boost Pro chip. The
// WhatsApp / Navbar / Hero checks shared with main live in publicCtas.test.js.
describe("Navbar: exactly one Shop CTA per context", () => {
  it("desktop header group renders exactly one ShopLink, variant=\"header\"", () => {
    expect(navbarSrc).toContain('import { ShopLink } from "./ShopLink.jsx"');
    const desktopGroup = navbarSrc.match(/<div className="hidden xl:flex items-center gap-3">[\s\S]*?<\/div>/)[0];
    expect((desktopGroup.match(/<ShopLink/g) || []).length).toBe(1);
    expect(desktopGroup).toContain('<ShopLink variant="header" />');
  });

  it("mobile drawer renders exactly one ShopLink, variant=\"mobile\", closing the drawer on click", () => {
    const drawer = navbarSrc.match(/<div className="flex flex-col gap-6 px-8 py-10">[\s\S]*?<\/div>\s*<\/motion\.div>/)[0];
    expect((drawer.match(/<ShopLink/g) || []).length).toBe(1);
    expect(drawer).toMatch(/<ShopLink variant="mobile"[^>]*onClick=\{\(\) => setOpen\(false\)\}/);
  });
});
