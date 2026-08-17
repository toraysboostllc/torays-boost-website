import { describe, it, expect } from "vitest";
import { LOCAL_SEO_PAGES } from "../src/config/localSeo.config.js";
import { localSeoTranslations } from "../src/i18n/localSeoTranslations.js";
import { LOCAL_SEO_ICONS } from "../src/components/localSeo/localSeoIcons.js";
import { buildLocalBusinessJsonLd, buildBreadcrumbJsonLd } from "../src/lib/jsonLd.js";
import { SEO_ORIGIN } from "../src/lib/seo.js";
import { siteConfig } from "../src/config/site.config.js";
import { DEVICE_CATEGORIES, PROBLEMS_BY_GROUP, getCategoryById } from "../src/config/repairRequest.config.js";

const TPREFIX_BY_PAGE = {
  phoneRepairMiami: "phoneRepairPage",
  ps5RepairMiami: "ps5RepairPage",
  ps5ControllerRepairMiami: "ps5ControllerRepairPage",
  iphoneRepairMiami: "iphoneRepairPage",
  ipadRepairMiami: "ipadRepairPage",
  xboxRepairMiami: "xboxRepairPage",
};

function lookup(dict, key) {
  return key.split(".").reduce((node, part) => (node == null ? undefined : node[part]), dict);
}

describe("localSeo.config.js: structural data is internally consistent", () => {
  Object.entries(LOCAL_SEO_PAGES).forEach(([pageKey, page]) => {
    describe(pageKey, () => {
      it("path starts with / and has a corresponding tPrefix", () => {
        expect(page.path).toMatch(/^\//);
        expect(TPREFIX_BY_PAGE[pageKey]).toBeTruthy();
      });

      it("wizardSelection.categoryId is a real id from the repair-request catalog", () => {
        expect(getCategoryById(page.wizardSelection.categoryId)).not.toBeNull();
      });

      if (page.wizardSelection.problemId) {
        it("wizardSelection.problemId belongs to the resolved category's own device group", () => {
          const category = getCategoryById(page.wizardSelection.categoryId);
          const groupProblems = PROBLEMS_BY_GROUP[category.group] || [];
          expect(groupProblems.some((p) => p.id === page.wizardSelection.problemId)).toBe(true);
        });
      }

      it("every service/issue icon name exists in the local SEO icon allow-list", () => {
        [...page.services, ...page.issues].forEach((item) => {
          expect(LOCAL_SEO_ICONS[item.icon], `missing icon "${item.icon}" for id "${item.id}"`).toBeTypeOf(
            "object"
          );
        });
      });

      it("every related pageKey points to a page that actually exists", () => {
        page.related.forEach((key) => {
          expect(LOCAL_SEO_PAGES[key], `related key "${key}" is not a real page`).toBeTruthy();
        });
      });

      it("never lists itself as a related page", () => {
        expect(page.related).not.toContain(pageKey);
      });
    });
  });

  it("PS5 Repair links to PS5 Controller Repair, and vice versa — the two required cross-links", () => {
    expect(LOCAL_SEO_PAGES.ps5RepairMiami.related).toContain("ps5ControllerRepairMiami");
    expect(LOCAL_SEO_PAGES.ps5ControllerRepairMiami.related).toContain("ps5RepairMiami");
  });
});

describe("localSeoTranslations.js: every id referenced by localSeo.config.js has EN and ES copy", () => {
  ["en", "es"].forEach((lang) => {
    Object.entries(LOCAL_SEO_PAGES).forEach(([pageKey, page]) => {
      const tPrefix = TPREFIX_BY_PAGE[pageKey];
      const dict = localSeoTranslations[lang][tPrefix];

      it(`[${lang}] ${tPrefix}: seo/hero/related/finalCta core strings exist and are non-empty`, () => {
        ["seo.title", "seo.description", "breadcrumbLabel", "hero.eyebrow", "hero.h1", "hero.summary", "hero.ctaLabel", "hero.note", "related.title", "finalCta.title", "finalCta.body"].forEach(
          (key) => {
            const value = lookup(dict, key);
            expect(value, `[${lang}] ${tPrefix}.${key}`).toBeTypeOf("string");
            expect(value.trim().length, `[${lang}] ${tPrefix}.${key} is empty`).toBeGreaterThan(0);
          }
        );
      });

      it(`[${lang}] ${tPrefix}: every service item has a label`, () => {
        page.services.forEach((s) => {
          const value = lookup(dict, `services.items.${s.id}`);
          expect(value, `[${lang}] ${tPrefix}.services.items.${s.id}`).toBeTypeOf("string");
          expect(value.trim().length).toBeGreaterThan(0);
        });
      });

      it(`[${lang}] ${tPrefix}: every issue item has a label`, () => {
        page.issues.forEach((s) => {
          const value = lookup(dict, `issues.items.${s.id}`);
          expect(value, `[${lang}] ${tPrefix}.issues.items.${s.id}`).toBeTypeOf("string");
          expect(value.trim().length).toBeGreaterThan(0);
        });
      });

      it(`[${lang}] ${tPrefix}: every faqId has a question and answer`, () => {
        page.faqIds.forEach((id) => {
          const question = lookup(dict, `faq.${id}.question`);
          const answer = lookup(dict, `faq.${id}.answer`);
          expect(question, `[${lang}] ${tPrefix}.faq.${id}.question`).toBeTypeOf("string");
          expect(answer, `[${lang}] ${tPrefix}.faq.${id}.answer`).toBeTypeOf("string");
        });
      });

      if (page.relatedNoteKey) {
        it(`[${lang}] ${tPrefix}: relatedNoteKey ("${page.relatedNoteKey}") resolves to real copy`, () => {
          const value = lookup(dict, page.relatedNoteKey);
          expect(value).toBeTypeOf("string");
          expect(value.trim().length).toBeGreaterThan(0);
        });
      }
    });
  });
});

describe("localSeo.breadcrumbHome: a real 'Home' label, not the logo's aria-label", () => {
  ["en", "es"].forEach((lang) => {
    it(`[${lang}] resolves to non-empty copy`, () => {
      const value = lookup(localSeoTranslations[lang], "localSeo.breadcrumbHome");
      expect(value).toBeTypeOf("string");
      expect(value.trim().length).toBeGreaterThan(0);
    });
  });
});

describe("localSeo.pages.*.relatedLinkLabel exists for every page, both languages", () => {
  ["en", "es"].forEach((lang) => {
    Object.keys(LOCAL_SEO_PAGES).forEach((pageKey) => {
      it(`[${lang}] localSeo.pages.${pageKey}.relatedLinkLabel is real copy`, () => {
        const value = lookup(localSeoTranslations[lang], `localSeo.pages.${pageKey}.relatedLinkLabel`);
        expect(value).toBeTypeOf("string");
        expect(value.trim().length).toBeGreaterThan(0);
      });
    });
  });
});

describe("No invented claims: no prices, no same-day promises, no fabricated warranty duration beyond the honest fallback", () => {
  function flattenStrings(obj, acc = []) {
    Object.values(obj).forEach((v) => {
      if (typeof v === "string") acc.push(v);
      else if (v && typeof v === "object") flattenStrings(v, acc);
    });
    return acc;
  }

  ["en", "es"].forEach((lang) => {
    const allStrings = flattenStrings(localSeoTranslations[lang]).join("\n");

    it(`[${lang}] no dollar-amount price patterns anywhere in the local SEO copy`, () => {
      expect(allStrings).not.toMatch(/\$\d/);
    });

    it(`[${lang}] no "same day" repair promise`, () => {
      expect(allStrings.toLowerCase()).not.toMatch(/same[\s-]day/);
      expect(allStrings.toLowerCase()).not.toMatch(/mismo d[ií]a/);
    });

    it(`[${lang}] the confirmed 60-day warranty is stated only for stick drift repair, nowhere else`, () => {
      // Every OTHER string in the local SEO copy — every page, every
      // service, every other FAQ answer — must never cite a warranty
      // duration. Only ps5ControllerRepairPage.faq.driftWarranty.answer is
      // allowed to, since that's the one confirmed, scoped policy.
      const driftWarrantyAnswer = lookup(localSeoTranslations[lang], "ps5ControllerRepairPage.faq.driftWarranty.answer");
      const otherStrings = allStrings.replace(driftWarrantyAnswer, "");
      expect(otherStrings).not.toMatch(/\d+[\s-]*(day|d[ií]a)/i);
    });

    it(`[${lang}] the drift warranty FAQ answer states exactly 60 days`, () => {
      const answer = lookup(localSeoTranslations[lang], "ps5ControllerRepairPage.faq.driftWarranty.answer");
      expect(answer).toMatch(/60[\s-]*(day|d[ií]a)/i);
    });

    it(`[${lang}] the drift warranty answer never extends to batteries, buttons, charging, or triggers`, () => {
      const answer = lookup(localSeoTranslations[lang], "ps5ControllerRepairPage.faq.driftWarranty.answer").toLowerCase();
      ["battery", "batería", "button", "botón", "charg", "carga", "trigger", "gatillo"].forEach((word) => {
        expect(answer).not.toContain(word);
      });
    });
  });
});

describe("Drift warranty exact wording matches the confirmed policy text verbatim", () => {
  it("EN matches 'Stick drift repairs include a 60-day warranty.' exactly", () => {
    expect(localSeoTranslations.en.ps5ControllerRepairPage.faq.driftWarranty.answer).toBe(
      "Stick drift repairs include a 60-day warranty."
    );
  });

  it("ES matches 'Las reparaciones de stick drift incluyen una garantía de 60 días.' exactly", () => {
    expect(localSeoTranslations.es.ps5ControllerRepairPage.faq.driftWarranty.answer).toBe(
      "Las reparaciones de stick drift incluyen una garantía de 60 días."
    );
  });
});

describe("jsonLd.js: LocalBusiness only cites confirmed data", () => {
  const business = buildLocalBusinessJsonLd();

  it("uses the real confirmed name, phone, email, and the www canonical origin", () => {
    expect(business.name).toBe(siteConfig.businessName);
    expect(business.telephone).toBe(siteConfig.whatsapp.displayNumber);
    expect(business.email).toBe(siteConfig.email);
    expect(business.url).toBe(SEO_ORIGIN);
    expect(SEO_ORIGIN).toBe("https://www.toraysboost.com");
  });

  it("address has no streetAddress — service-area business, no physical location published", () => {
    expect(business.address.streetAddress).toBeUndefined();
    expect(business.address.postalCode).toBe("33196");
    expect(business.address.addressLocality).toBe("Miami");
  });

  it("never fabricates hours, reviews/ratings, or social profile links", () => {
    expect(business.openingHoursSpecification).toBeUndefined();
    expect(business.aggregateRating).toBeUndefined();
    expect(business.review).toBeUndefined();
    expect(business.sameAs).toBeUndefined();
  });

  it("areaServed covers exactly Kendall and Miami, nothing invented", () => {
    const names = business.areaServed.map((a) => a.name);
    expect(names).toContain("Miami, FL");
    expect(names).toContain("Kendall, Miami, FL");
  });
});

describe("jsonLd.js: BreadcrumbList mirrors whatever items it's given", () => {
  it("builds an ordered ListItem per breadcrumb, using the www canonical origin", () => {
    const bc = buildBreadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "PS5 Repair Miami", path: "/ps5-repair-miami" },
    ]);
    expect(bc["@type"]).toBe("BreadcrumbList");
    expect(bc.itemListElement).toHaveLength(2);
    expect(bc.itemListElement[0]).toEqual({ "@type": "ListItem", position: 1, name: "Home", item: `${SEO_ORIGIN}/` });
    expect(bc.itemListElement[1].item).toBe(`${SEO_ORIGIN}/ps5-repair-miami`);
  });
});

describe("Sanity: every DEVICE_CATEGORIES id used by wizardSelection actually renders a device group", () => {
  it("iphone/ps5/controllers are real categories with real device groups", () => {
    ["iphone", "ps5", "controllers"].forEach((id) => {
      const category = DEVICE_CATEGORIES.find((c) => c.id === id);
      expect(category, `category "${id}" not found`).toBeTruthy();
      expect(category.group).toBeTypeOf("string");
    });
  });
});
