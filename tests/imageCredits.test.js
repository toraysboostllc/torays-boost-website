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
  it("exists and contains the required iPad credit", () => {
    expect(existsSync(join(root, "docs/service-image-attributions.md"))).toBe(true);
    expect(docSrc).toContain("service-ipad.webp");
    expect(docSrc).toContain("彭家杰");
    expect(docSrc).toContain("CC BY-SA 4.0");
  });

  it("no longer lists the Xbox credit — that photo was replaced with an original graphic", () => {
    expect(docSrc).not.toContain("service-xbox.webp");
    expect(docSrc).not.toContain("Der. Bellemer");
    expect(docSrc).not.toMatch(/Xbox Series X 2/);
  });
});

describe("/image-credits route: wired and renders the required attributions", () => {
  it("App.jsx registers the /image-credits route", () => {
    expect(appSrc).toContain('<Route path="/image-credits" element={<ImageCredits />} />');
  });

  it("page includes the required iPad credit with author, source, and license", () => {
    expect(pageSrc).toContain("彭家杰");
    expect(pageSrc).toContain("IPad Pro 11 silver");
    expect((pageSrc.match(/CC BY-SA 4\.0/g) || []).length).toBeGreaterThanOrEqual(1);
    expect(pageSrc).toContain("https://creativecommons.org/licenses/by-sa/4.0/");
  });

  it("no longer credits the Xbox stock photo — it was replaced by an original Torays Boost graphic, no license required", () => {
    expect(pageSrc).not.toContain("Der. Bellemer");
    expect(pageSrc).not.toMatch(/Xbox Series X 2/);
    expect(pageSrc).not.toContain("service-xbox.webp");
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
