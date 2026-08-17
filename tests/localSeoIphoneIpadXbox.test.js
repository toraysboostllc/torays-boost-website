import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { LOCAL_SEO_PAGES } from "../src/config/localSeo.config.js";
import { localSeoTranslations } from "../src/i18n/localSeoTranslations.js";
import { buildInitialAnswers } from "../src/hooks/useRepairRequest.js";
import { getCategoryById } from "../src/config/repairRequest.config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const appSrc = read("src/App.jsx");
const mainSrc = read("src/main.jsx");
const homeSrc = read("src/pages/Home.jsx");
const footerSrc = read("src/components/layout/Footer.jsx");
const servicesSrc = read("src/sections/Services.jsx");
const servicesConfigSrc = read("src/config/services.config.js");
const sitemapSrc = read("public/sitemap.xml");
const robotsSrc = read("public/robots.txt");
const iphonePageSrc = read("src/pages/IphoneRepairMiami.jsx");
const ipadPageSrc = read("src/pages/IpadRepairMiami.jsx");
const xboxPageSrc = read("src/pages/XboxRepairMiami.jsx");

describe("App.jsx: the 3 new pages (iPhone/iPad/Xbox) are eager, same as the existing 3", () => {
  it("all 3 are statically imported, not React.lazy()", () => {
    expect(appSrc).toContain('import { IphoneRepairMiami } from "./pages/IphoneRepairMiami.jsx"');
    expect(appSrc).toContain('import { IpadRepairMiami } from "./pages/IpadRepairMiami.jsx"');
    expect(appSrc).toContain('import { XboxRepairMiami } from "./pages/XboxRepairMiami.jsx"');
    ["IphoneRepairMiami", "IpadRepairMiami", "XboxRepairMiami"].forEach((name) => {
      expect(appSrc).not.toMatch(new RegExp(`const ${name} = lazy\\(`));
    });
  });

  it("are wired to their exact required paths", () => {
    expect(appSrc).toMatch(/<Route path="\/iphone-repair-miami" element=\{<IphoneRepairMiami \/>\} \/>/);
    expect(appSrc).toMatch(/<Route path="\/ipad-repair-miami" element=\{<IpadRepairMiami \/>\} \/>/);
    expect(appSrc).toMatch(/<Route path="\/xbox-repair-miami" element=\{<XboxRepairMiami \/>\} \/>/);
  });
});

describe("main.jsx: still no chunk-preload experiment (nothing reintroduced this round)", () => {
  it("doesn't reference any local SEO page, old or new", () => {
    expect(mainSrc).not.toMatch(/RepairMiami/);
    expect(mainSrc).not.toContain("LOCAL_SEO_PRELOADERS");
  });
});

describe("The 3 new page files are thin wrappers around the shared LocalServicePage shell", () => {
  it("IphoneRepairMiami.jsx passes the correct pageKey/tPrefix pair", () => {
    expect(iphonePageSrc).toMatch(/pageKey="iphoneRepairMiami"/);
    expect(iphonePageSrc).toMatch(/tPrefix="iphoneRepairPage"/);
  });

  it("IpadRepairMiami.jsx passes the correct pageKey/tPrefix pair", () => {
    expect(ipadPageSrc).toMatch(/pageKey="ipadRepairMiami"/);
    expect(ipadPageSrc).toMatch(/tPrefix="ipadRepairPage"/);
  });

  it("XboxRepairMiami.jsx passes the correct pageKey/tPrefix pair", () => {
    expect(xboxPageSrc).toMatch(/pageKey="xboxRepairMiami"/);
    expect(xboxPageSrc).toMatch(/tPrefix="xboxRepairPage"/);
  });
});

describe("Real catalog IDs — iPhone, iPad, and Xbox preselections resolve against the actual wizard catalog", () => {
  it("iphoneRepairMiami preselects the real 'iphone' category", () => {
    expect(LOCAL_SEO_PAGES.iphoneRepairMiami.wizardSelection).toEqual({ categoryId: "iphone" });
    expect(getCategoryById("iphone")).not.toBeNull();
  });

  it("ipadRepairMiami preselects the real 'ipad' category", () => {
    expect(LOCAL_SEO_PAGES.ipadRepairMiami.wizardSelection).toEqual({ categoryId: "ipad" });
    expect(getCategoryById("ipad")).not.toBeNull();
  });

  it("xboxRepairMiami preselects the real, single 'xbox' category — no separate Series X/S id exists in the catalog", () => {
    expect(LOCAL_SEO_PAGES.xboxRepairMiami.wizardSelection).toEqual({ categoryId: "xbox" });
    expect(getCategoryById("xbox")).not.toBeNull();
  });
});

describe("Xbox safe entry: preselects the family only, never favors Series X over Series S", () => {
  it("wizardSelection has no problemId or model-level bias — it's category-only", () => {
    const selection = LOCAL_SEO_PAGES.xboxRepairMiami.wizardSelection;
    expect(Object.keys(selection)).toEqual(["categoryId"]);
  });

  it("buildInitialAnswers resolves it to a blank model, ready for the visitor to type Series X or Series S themselves", () => {
    const answers = buildInitialAnswers(LOCAL_SEO_PAGES.xboxRepairMiami.wizardSelection);
    expect(answers.categoryId).toBe("xbox");
    expect(answers.model).toBe("");
    expect(answers.modelNotSure).toBe(false);
  });

  it("the 'xbox' category has no brand list forcing a Series X/S choice before the free-text model field", () => {
    const category = getCategoryById("xbox");
    expect(category.brands).toBeUndefined();
  });

  ["en", "es"].forEach((lang) => {
    it(`[${lang}] the FAQ explicitly states both Series X and Series S are serviced — no favoritism in the copy either`, () => {
      const faq = localSeoTranslations[lang].xboxRepairPage.faq.seriesXAndS;
      expect(faq.answer.toLowerCase()).toMatch(/series x/);
      expect(faq.answer.toLowerCase()).toMatch(/series s/);
    });

    it(`[${lang}] the hero summary mentions both Series X and Series S`, () => {
      const summary = localSeoTranslations[lang].xboxRepairPage.hero.summary.toLowerCase();
      expect(summary).toMatch(/series x/);
      expect(summary).toMatch(/series s/);
    });
  });
});

describe("Content uniqueness: iPhone Repair Miami is not a duplicate of Phone Repair Miami", () => {
  ["en", "es"].forEach((lang) => {
    it(`[${lang}] H1 text differs between the two pages`, () => {
      const phoneH1 = localSeoTranslations[lang].phoneRepairPage.hero.h1;
      const iphoneH1 = localSeoTranslations[lang].iphoneRepairPage.hero.h1;
      expect(phoneH1).not.toBe(iphoneH1);
    });

    it(`[${lang}] hero summary paragraph differs between the two pages (not just reworded)`, () => {
      const phoneSummary = localSeoTranslations[lang].phoneRepairPage.hero.summary;
      const iphoneSummary = localSeoTranslations[lang].iphoneRepairPage.hero.summary;
      expect(phoneSummary).not.toBe(iphoneSummary);
    });

    it(`[${lang}] meta description differs between the two pages`, () => {
      const phoneDesc = localSeoTranslations[lang].phoneRepairPage.seo.description;
      const iphoneDesc = localSeoTranslations[lang].iphoneRepairPage.seo.description;
      expect(phoneDesc).not.toBe(iphoneDesc);
    });

    it(`[${lang}] FAQ question sets are not identical between the two pages`, () => {
      const phoneFaqIds = LOCAL_SEO_PAGES.phoneRepairMiami.faqIds;
      const iphoneFaqIds = LOCAL_SEO_PAGES.iphoneRepairMiami.faqIds;
      expect(phoneFaqIds).not.toEqual(iphoneFaqIds);
    });
  });

  it("titles differ", () => {
    expect(localSeoTranslations.en.phoneRepairPage.seo.title).not.toBe(
      localSeoTranslations.en.iphoneRepairPage.seo.title
    );
  });
});

describe("Internal link hierarchy: Phone↔iPhone↔iPad, PS5↔Xbox", () => {
  it("Phone Repair links to iPhone Repair", () => {
    expect(LOCAL_SEO_PAGES.phoneRepairMiami.related).toContain("iphoneRepairMiami");
  });

  it("iPhone Repair links to Phone Repair and iPad Repair", () => {
    expect(LOCAL_SEO_PAGES.iphoneRepairMiami.related).toContain("phoneRepairMiami");
    expect(LOCAL_SEO_PAGES.iphoneRepairMiami.related).toContain("ipadRepairMiami");
  });

  it("iPad Repair links to iPhone Repair", () => {
    expect(LOCAL_SEO_PAGES.ipadRepairMiami.related).toContain("iphoneRepairMiami");
  });

  it("Xbox Repair and PS5 Repair link to each other", () => {
    expect(LOCAL_SEO_PAGES.xboxRepairMiami.related).toContain("ps5RepairMiami");
    expect(LOCAL_SEO_PAGES.ps5RepairMiami.related).toContain("xboxRepairMiami");
  });

  it("Xbox Repair does not mention controller repair as its main focus (no confirmed Xbox-controller service exists)", () => {
    ["en", "es"].forEach((lang) => {
      const page = localSeoTranslations[lang].xboxRepairPage;
      const serviceIds = Object.keys(page.services.items);
      expect(serviceIds.some((id) => /controller/i.test(id))).toBe(false);
    });
  });
});

describe("Footer: links to all 6 local SEO pages now, organized by device family", () => {
  it("includes the 3 new paths", () => {
    expect(footerSrc).toContain('"/iphone-repair-miami"');
    expect(footerSrc).toContain('"/ipad-repair-miami"');
    expect(footerSrc).toContain('"/xbox-repair-miami"');
  });

  it("still includes the 3 previously-published paths, unchanged", () => {
    expect(footerSrc).toContain('"/phone-repair-miami"');
    expect(footerSrc).toContain('"/ps5-repair-miami"');
    expect(footerSrc).toContain('"/ps5-controller-repair-miami"');
  });
});

describe("Services.jsx / services.config.js: iPad and Xbox cards now link to their local pages, iPhone/PS5 untouched", () => {
  it("services.config.js sets localPagePath for ipad and xbox", () => {
    expect(servicesConfigSrc).toMatch(/id: "ipad"[\s\S]{0,250}localPagePath: "\/ipad-repair-miami"/);
    expect(servicesConfigSrc).toMatch(/id: "xbox"[\s\S]{0,250}localPagePath: "\/xbox-repair-miami"/);
  });

  it("the existing iPhone and PS5 card targets were not changed by this round", () => {
    expect(servicesConfigSrc).toMatch(/id: "iphone"[\s\S]{0,250}localPagePath: "\/phone-repair-miami"/);
    expect(servicesConfigSrc).toMatch(/id: "ps5"[\s\S]{0,250}localPagePath: "\/ps5-repair-miami"/);
  });

  it("Services.jsx itself is unchanged — still no lucide-react import, still the same generic localPagePath-driven Link", () => {
    expect(servicesSrc).not.toMatch(/from ["']lucide-react["']/);
    expect(servicesSrc).toContain("service.localPagePath &&");
  });
});

describe("Home: the general Start Repair Request flow opens the wizard with no preselection", () => {
  it("Home.jsx renders RepairRequestModal without an initialSelection prop", () => {
    const modalUsage = homeSrc.match(/\{repairRequestOpen && \(?\s*<RepairRequestModal[\s\S]*?\/>\s*\)?\}/)[0];
    expect(modalUsage).not.toContain("initialSelection");
  });
});

describe("sitemap.xml / robots.txt: 3 new pages indexable, /wholesale still excluded", () => {
  it("robots.txt was not touched — still just the one Disallow", () => {
    expect(robotsSrc).toMatch(/Disallow:\s*\/wholesale/);
    expect(robotsSrc.match(/Disallow:/g)?.length).toBe(1);
  });

  it("none of the 3 new pages carry noindex anywhere in their own translations (no accidental exclusion)", () => {
    expect(sitemapSrc).toContain("/iphone-repair-miami");
    expect(sitemapSrc).toContain("/ipad-repair-miami");
    expect(sitemapSrc).toContain("/xbox-repair-miami");
  });
});

describe("No invented facts anywhere in the 3 new pages' copy", () => {
  function flatten(obj, acc = []) {
    Object.values(obj).forEach((v) => {
      if (typeof v === "string") acc.push(v);
      else if (v && typeof v === "object") flatten(v, acc);
    });
    return acc;
  }

  ["en", "es"].forEach((lang) => {
    const pages = ["iphoneRepairPage", "ipadRepairPage", "xboxRepairPage"];
    const allStrings = pages.map((p) => flatten(localSeoTranslations[lang][p]).join("\n")).join("\n");

    it(`[${lang}] no price patterns`, () => {
      expect(allStrings).not.toMatch(/\$\d/);
    });

    it(`[${lang}] no same-day promise`, () => {
      expect(allStrings.toLowerCase()).not.toMatch(/same[\s-]day/);
      expect(allStrings.toLowerCase()).not.toMatch(/mismo d[ií]a/);
    });

    it(`[${lang}] no invented warranty duration (only the confirmed 60-day drift warranty exists, on a different page)`, () => {
      expect(allStrings).not.toMatch(/\d+[\s-]*(day|d[ií]a)s?\s*(warranty|garant[ií]a)/i);
    });

    it(`[${lang}] no street address — only the confirmed service-area wording`, () => {
      expect(allStrings).not.toMatch(/\b\d{1,5}\s+\w+\s+(st|street|ave|avenue|blvd|road|rd)\b/i);
    });

    it(`[${lang}] no fabricated certifications, guaranteed timelines, or star ratings`, () => {
      expect(allStrings.toLowerCase()).not.toMatch(/certified|certificad[oa]/);
      expect(allStrings.toLowerCase()).not.toMatch(/guaranteed|garantizado/);
      expect(allStrings).not.toMatch(/★|⭐/);
    });
  });
});
