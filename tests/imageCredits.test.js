import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const pageSrc = read("src/pages/ImageCredits.jsx");
const appSrc = read("src/App.jsx");
const footerSrc = read("src/components/layout/Footer.jsx");
const docSrc = read("docs/service-image-attributions.md");

describe("docs/service-image-attributions.md: source-of-truth attribution text", () => {
  it("exists and contains the required iPad and Xbox Series X credits", () => {
    expect(existsSync(join(root, "docs/service-image-attributions.md"))).toBe(true);
    expect(docSrc).toContain("service-ipad.webp");
    expect(docSrc).toContain("彭家杰");
    expect(docSrc).toContain("service-xbox.webp");
    expect(docSrc).toContain("Der. Bellemer");
    expect(docSrc).toContain("CC BY-SA 4.0");
  });
});

describe("/image-credits route: wired and renders the required attributions", () => {
  it("App.jsx registers the /image-credits route", () => {
    expect(appSrc).toContain('<Route path="/image-credits" element={<ImageCredits />} />');
  });

  it("page includes both required credits with author, source, and license", () => {
    expect(pageSrc).toContain("彭家杰");
    expect(pageSrc).toContain("IPad Pro 11 silver");
    expect(pageSrc).toContain("Der. Bellemer");
    expect(pageSrc).toContain("Xbox Series X 2");
    expect((pageSrc.match(/CC BY-SA 4\.0/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(pageSrc).toContain("https://creativecommons.org/licenses/by-sa/4.0/");
  });

  it("includes the trademark notice", () => {
    expect(pageSrc).toMatch(/does not imply\s+sponsorship or affiliation/);
  });
});

describe("Footer: discreet bilingual 'Image Credits' link", () => {
  it("links to /image-credits using the shared t() system, alongside Privacy/Terms", () => {
    expect(footerSrc).toContain('to="/image-credits"');
    expect(footerSrc).toContain('{t("footer.imageCredits")}');
  });
});
