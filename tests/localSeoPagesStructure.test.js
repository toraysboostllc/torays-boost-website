import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const appSrc = read("src/App.jsx");
const heroSrc = read("src/components/localSeo/LocalHero.jsx");
const pageSrc = read("src/components/localSeo/LocalServicePage.jsx");
const seoSrc = read("src/lib/seo.js");
const footerSrc = read("src/components/layout/Footer.jsx");
const servicesSrc = read("src/sections/Services.jsx");
const robotsSrc = read("public/robots.txt");
const sitemapSrc = read("public/sitemap.xml");
const phonePageSrc = read("src/pages/PhoneRepairMiami.jsx");
const ps5PageSrc = read("src/pages/Ps5RepairMiami.jsx");
const controllerPageSrc = read("src/pages/Ps5ControllerRepairMiami.jsx");
const mainSrc = read("src/main.jsx");

describe("main.jsx: no leftover chunk-preload experiment now that the 3 pages are eager", () => {
  it("doesn't reference the local SEO pages at all — nothing to preload once they're bundled with the app", () => {
    expect(mainSrc).not.toMatch(/PhoneRepairMiami|Ps5RepairMiami|Ps5ControllerRepairMiami/);
    expect(mainSrc).not.toContain("LOCAL_SEO_PRELOADERS");
  });
});

describe("App.jsx: the 3 local SEO routes are eager (bundled into the main chunk), Home/NotFound stay eager too", () => {
  it("all 3 pages are statically imported, not React.lazy() — approved trade-off for their own LCP", () => {
    expect(appSrc).toContain('import { PhoneRepairMiami } from "./pages/PhoneRepairMiami.jsx"');
    expect(appSrc).toContain('import { Ps5RepairMiami } from "./pages/Ps5RepairMiami.jsx"');
    expect(appSrc).toContain('import { Ps5ControllerRepairMiami } from "./pages/Ps5ControllerRepairMiami.jsx"');
    ["PhoneRepairMiami", "Ps5RepairMiami", "Ps5ControllerRepairMiami"].forEach((name) => {
      expect(appSrc).not.toMatch(new RegExp(`const ${name} = lazy\\(`));
    });
  });

  it("Home and NotFound are still statically imported — unaffected by this round", () => {
    expect(appSrc).toContain('import { Home } from "./pages/Home.jsx"');
    expect(appSrc).toContain('import { NotFound } from "./pages/NotFound.jsx"');
  });

  it("the 3 routes are wired to their exact required paths", () => {
    expect(appSrc).toMatch(/<Route path="\/phone-repair-miami" element=\{<PhoneRepairMiami \/>\} \/>/);
    expect(appSrc).toMatch(/<Route path="\/ps5-repair-miami" element=\{<Ps5RepairMiami \/>\} \/>/);
    expect(appSrc).toMatch(/<Route path="\/ps5-controller-repair-miami" element=\{<Ps5ControllerRepairMiami \/>\} \/>/);
  });

  it("the 3 new routes sit inside the existing Suspense boundary, not a new one", () => {
    const suspenseBlock = appSrc.match(/<Suspense fallback=\{<RouteLoadingFallback \/>\}>[\s\S]*<\/Suspense>/)[0];
    expect(suspenseBlock).toContain('path="/phone-repair-miami"');
    expect(suspenseBlock).toContain('path="/ps5-repair-miami"');
    expect(suspenseBlock).toContain('path="/ps5-controller-repair-miami"');
  });
});

describe("The 3 page files are thin wrappers around the shared LocalServicePage shell", () => {
  it("PhoneRepairMiami.jsx passes the correct pageKey/tPrefix pair", () => {
    expect(phonePageSrc).toMatch(/pageKey="phoneRepairMiami"/);
    expect(phonePageSrc).toMatch(/tPrefix="phoneRepairPage"/);
  });

  it("Ps5RepairMiami.jsx passes the correct pageKey/tPrefix pair", () => {
    expect(ps5PageSrc).toMatch(/pageKey="ps5RepairMiami"/);
    expect(ps5PageSrc).toMatch(/tPrefix="ps5RepairPage"/);
  });

  it("Ps5ControllerRepairMiami.jsx passes the correct pageKey/tPrefix pair", () => {
    expect(controllerPageSrc).toMatch(/pageKey="ps5ControllerRepairMiami"/);
    expect(controllerPageSrc).toMatch(/tPrefix="ps5ControllerRepairPage"/);
  });
});

describe("LocalHero.jsx: critical content (H1/summary/CTA) has no entrance animation", () => {
  it("doesn't import framer-motion at all — nothing here needs it", () => {
    expect(heroSrc).not.toMatch(/from ["']framer-motion["']/);
  });

  it("no motion.* components, no opacity/transform/delay on mount", () => {
    expect(heroSrc).not.toMatch(/<motion\.\w+/);
    expect(heroSrc).not.toMatch(/initial=\{\{/);
    expect(heroSrc).not.toMatch(/animate=\{\{/);
  });

  it("renders H1 and the primary CTA button", () => {
    expect(heroSrc).toMatch(/<h1[^>]*>\{h1\}<\/h1>/);
    expect(heroSrc).toMatch(/onClick=\{onOpenRepairRequest\}/);
  });

  it("includes visible breadcrumbs", () => {
    expect(heroSrc).toContain("<Breadcrumbs items={breadcrumbs} />");
  });
});

describe("LocalServicePage.jsx: the required 10-section structure, in order", () => {
  const order = [
    "<LocalHero",
    "<IconInfoGrid",
    "<HowItWorks",
    "<EstimateExplainer",
    "<WhyChooseUs",
    "<ServiceArea",
    "<LocalFAQ",
    "<RelatedServices",
    "<LocalFinalCTA",
  ];

  it("every required section is present", () => {
    order.forEach((tag) => expect(pageSrc).toContain(tag));
  });

  it("sections render in the documented order (Hero, Services, Issues, Process, Estimate, WhyUs, Area, FAQ, Related, Final CTA)", () => {
    const indices = order.map((tag) => pageSrc.indexOf(tag));
    // IconInfoGrid appears twice (Services then Issues) — indexOf finds the
    // first only, so check there are exactly 2 occurrences and both come
    // before HowItWorks, which is what actually matters for ordering.
    expect(pageSrc.split("<IconInfoGrid").length - 1).toBe(2);
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i], `${order[i]} should come after ${order[i - 1]}`).toBeGreaterThan(indices[i - 1]);
    }
  });

  it("reuses Home's exact HowItWorks and WhyChooseUs sections, not page-specific rewrites", () => {
    expect(pageSrc).toContain('import { HowItWorks } from "../../sections/HowItWorks.jsx"');
    expect(pageSrc).toContain('import { WhyChooseUs } from "../../sections/WhyChooseUs.jsx"');
  });

  it("useSEO is called with a canonical path and JSON-LD (LocalBusiness + BreadcrumbList)", () => {
    expect(pageSrc).toMatch(/useSEO\(\{[\s\S]*?path: page\.path/);
    expect(pageSrc).toContain("buildLocalBusinessJsonLd()");
    expect(pageSrc).toContain("buildBreadcrumbJsonLd(breadcrumbItems)");
  });

  it("the wizard modal is the shared RepairRequestModal, not a page-specific fork, and only mounts while open", () => {
    expect(pageSrc).toContain('import { RepairRequestModal } from "../repair/RepairRequestModal.jsx"');
    expect(pageSrc).toMatch(/\{repairRequestOpen && \(\s*<RepairRequestModal/);
    expect(pageSrc).toContain("initialSelection={page.wizardSelection}");
  });

  it("the breadcrumb's Home label uses a dedicated breadcrumb string, not the logo's 'Torays Boost home' aria-label", () => {
    expect(pageSrc).toContain('tLocal("localSeo.breadcrumbHome")');
    expect(pageSrc).not.toMatch(/name: t\("nav\.home"\)/);
  });

  it("the general WhatsApp button still routes through the gate modal, exactly like Home", () => {
    expect(pageSrc).toContain('import { WhatsAppGateModal } from "../repair/WhatsAppGateModal.jsx"');
    expect(pageSrc).toMatch(/onWhatsAppClick=\{openWhatsAppGate\}/);
  });
});

describe("useSEO (src/lib/seo.js): canonical/OG/Twitter/JSON-LD are opt-in and backward compatible", () => {
  it("canonical link is only set when a path is passed, removed otherwise", () => {
    expect(seoSrc).toContain('link[rel="canonical"]');
    expect(seoSrc).toMatch(/canonicalEl\.href = canonicalUrl/);
    expect(seoSrc).toMatch(/canonicalEl\?\.remove\(\)/);
  });

  it("Open Graph and Twitter tags are written via the same upsert-or-remove helper", () => {
    expect(seoSrc).toContain('upsertMeta("property", "og:title"');
    expect(seoSrc).toContain('upsertMeta("property", "og:url"');
    expect(seoSrc).toContain('upsertMeta("name", "twitter:card"');
  });

  it("JSON-LD scripts are cleared and re-added on every run, never accumulate across route changes", () => {
    expect(seoSrc).toMatch(/document\.querySelectorAll\("script\[data-seo-jsonld\]"\)\.forEach\(\(el\) => el\.remove\(\)\)/);
    expect(seoSrc).toContain('script.type = "application/ld+json"');
  });

  it("the noindex mechanism from before this round is untouched", () => {
    expect(seoSrc).toContain('robotsMeta.content = "noindex, nofollow, noarchive"');
  });

  it("canonical/OG use the confirmed www production host", () => {
    expect(seoSrc).toContain('"https://www.toraysboost.com"');
  });
});

describe("Footer.jsx: links to the 3 local SEO pages with descriptive text, not 'click here'", () => {
  it("links to all 3 exact paths via react-router Link", () => {
    expect(footerSrc).toMatch(/to=\{link\.path\}/);
    expect(footerSrc).toContain('"/phone-repair-miami"');
    expect(footerSrc).toContain('"/ps5-repair-miami"');
    expect(footerSrc).toContain('"/ps5-controller-repair-miami"');
  });

  it("no generic 'click here' anchor text anywhere in the footer", () => {
    expect(footerSrc.toLowerCase()).not.toMatch(/click here/);
  });
});

describe("Services.jsx: iPhone and PS5 cards link to their local SEO pages", () => {
  it("no lucide-react re-introduced into this file (photos already replaced icons here, per the earlier round)", () => {
    expect(servicesSrc).not.toMatch(/from ["']lucide-react["']/);
  });

  it("renders a Link driven by service.localPagePath, not a hardcoded per-card href", () => {
    expect(servicesSrc).toContain("service.localPagePath &&");
    expect(servicesSrc).toMatch(/<Link\s+to=\{service\.localPagePath\}/);
  });
});

describe("robots.txt: allows the 3 new pages, still blocks /wholesale, points at the www sitemap", () => {
  it("does not disallow any of the 3 new paths", () => {
    expect(robotsSrc).not.toMatch(/Disallow:\s*\/phone-repair-miami/);
    expect(robotsSrc).not.toMatch(/Disallow:\s*\/ps5-repair-miami/);
    expect(robotsSrc).not.toMatch(/Disallow:\s*\/ps5-controller-repair-miami/);
  });

  it("still disallows /wholesale", () => {
    expect(robotsSrc).toMatch(/Disallow:\s*\/wholesale/);
  });

  it("Sitemap directive uses the www canonical host", () => {
    expect(robotsSrc).toContain("Sitemap: https://www.toraysboost.com/sitemap.xml");
  });
});

describe("sitemap.xml: includes Home + the 3 new pages + Privacy/Terms, all on www, nothing private", () => {
  it("includes exactly the expected 6 URLs", () => {
    const locs = [...sitemapSrc.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    expect(locs.sort()).toEqual(
      [
        "https://www.toraysboost.com/",
        "https://www.toraysboost.com/phone-repair-miami",
        "https://www.toraysboost.com/ps5-repair-miami",
        "https://www.toraysboost.com/ps5-controller-repair-miami",
        "https://www.toraysboost.com/privacy",
        "https://www.toraysboost.com/terms",
      ].sort()
    );
  });

  it("never lists /wholesale, /wholesale/prices, or /image-credits", () => {
    expect(sitemapSrc).not.toContain("/wholesale");
    expect(sitemapSrc).not.toContain("/image-credits");
  });

  it("every URL uses the www host and no query parameters", () => {
    const locs = [...sitemapSrc.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    locs.forEach((loc) => {
      expect(loc).toMatch(/^https:\/\/www\.toraysboost\.com\//);
      expect(loc).not.toContain("?");
    });
  });
});
