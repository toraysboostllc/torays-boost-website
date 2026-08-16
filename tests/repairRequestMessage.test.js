import { describe, it, expect } from "vitest";
import {
  buildRepairRequestSummary,
  buildRepairRequestWhatsAppLink,
  buildRepairRequestEmailSubject,
  buildRepairRequestMailtoLink,
} from "../src/lib/repairRequestMessage.js";
import { getCategoryById, PROBLEMS_BY_GROUP, SMART_QUESTIONS_BY_GROUP } from "../src/config/repairRequest.config.js";
import { siteConfig } from "../src/config/site.config.js";
import { translations, formatTranslation } from "../src/i18n/translations.js";

function lookup(dict, key) {
  return key.split(".").reduce((node, part) => (node == null ? undefined : node[part]), dict);
}

// Mirrors LanguageContext.jsx's t() exactly (dot-path lookup, EN fallback,
// {var} interpolation) so these tests exercise the real translation data
// instead of re-typing expected strings.
function makeT(lang) {
  return function t(key, vars) {
    const value = lookup(translations[lang], key) ?? lookup(translations.en, key) ?? key;
    return typeof value === "string" && vars ? formatTranslation(value, vars) : value;
  };
}

function buildState(overrides = {}, lang = "en") {
  const category = getCategoryById(overrides.categoryId || "smartphones-other");
  const problem = PROBLEMS_BY_GROUP[category.group][0];
  const smartQuestions = SMART_QUESTIONS_BY_GROUP[category.group];
  const brand = category.brands ? category.brands[0] : null;

  return {
    answers: {
      name: "Jane Doe",
      phone: "3055551234",
      email: "jane@example.com",
      model: "Galaxy S23",
      modelNotSure: false,
      details: "Screen flickers sometimes",
      smartAnswers: {
        [smartQuestions[0].id]: "yes",
        [smartQuestions[1].id]: "no",
        [smartQuestions[2].id]: "not-sure",
      },
      ...overrides.answers,
    },
    category,
    brand: overrides.brand === undefined ? brand : overrides.brand,
    problem,
    smartQuestions,
    group: category.group,
    t: makeT(lang),
  };
}

describe("Confirmed public contacts", () => {
  it("site.config.js WhatsApp number is exactly the confirmed number", () => {
    expect(siteConfig.whatsapp.number).toBe("13053011152");
  });

  it("site.config.js shows the WhatsApp number formatted as approved", () => {
    expect(siteConfig.whatsapp.displayNumber).toBe("(305) 301-1152");
  });

  it("site.config.js email is exactly toraysboost@gmail.com — never the payments address", () => {
    expect(siteConfig.email).toBe("toraysboost@gmail.com");
    expect(siteConfig.email).not.toBe("payments@toraysboost.com");
  });
});

describe("buildRepairRequestSummary: every answer present, never a price", () => {
  it("includes name, phone, email, device, brand, model, problem, all 3 smart answers, and details", () => {
    const state = buildState();
    const summary = buildRepairRequestSummary(state);
    expect(summary).toContain("Name: Jane Doe");
    expect(summary).toContain("Phone: 3055551234");
    expect(summary).toContain("Email: jane@example.com");
    expect(summary).toContain(`Device: ${state.category.label}`);
    expect(summary).toContain(`Brand: ${state.brand.label}`);
    expect(summary).toContain("Model: Galaxy S23");
    expect(summary).toContain(`Problem: ${state.problem.label}`);
    state.smartQuestions.forEach((q) => expect(summary).toContain(q.text));
    expect(summary).toContain("Yes");
    expect(summary).toContain("No");
    expect(summary).toContain("Not sure");
    expect(summary).toContain("Additional details: Screen flickers sometimes");
  });

  it("omits Email and Brand lines when not applicable, never renders empty labels", () => {
    const state = buildState({ categoryId: "iphone", brand: null, answers: { email: "", details: "" } });
    const summary = buildRepairRequestSummary(state);
    expect(summary).not.toMatch(/Email:/);
    expect(summary).not.toMatch(/Brand:/);
    expect(summary).not.toMatch(/Additional details:/);
  });

  it("shows 'Not sure' for the model when modelNotSure is checked, even if stale text remains in state", () => {
    const state = buildState({ answers: { model: "leftover text", modelNotSure: true } });
    expect(buildRepairRequestSummary(state)).toContain("Model: Not sure");
  });

  it("never contains a dollar amount, a price range, an ETA, or 'starting at'", () => {
    const summary = buildRepairRequestSummary(buildState());
    expect(summary).not.toMatch(/\$\d/);
    expect(summary).not.toMatch(/starting at/i);
    expect(summary).not.toMatch(/estimate/i);
    expect(summary).not.toMatch(/\betaDays?\b/i);
  });
});

describe("buildRepairRequestWhatsAppLink", () => {
  it("opens exactly https://wa.me/13053011152 with a prefilled message", () => {
    const link = buildRepairRequestWhatsAppLink(buildState());
    expect(link).toMatch(/^https:\/\/wa\.me\/13053011152\?text=/);
  });

  it("the prefilled text, once decoded, contains the full summary and no price", () => {
    const link = buildRepairRequestWhatsAppLink(buildState());
    const text = decodeURIComponent(link.split("?text=")[1]);
    expect(text).toContain("Jane Doe");
    expect(text).toContain("Galaxy S23");
    expect(text).not.toMatch(/\$\d/);
  });
});

describe("buildRepairRequestEmailSubject / buildRepairRequestMailtoLink", () => {
  it("subject follows 'Repair Request — [Device] [Model]' exactly", () => {
    const state = buildState({ categoryId: "iphone", brand: null, answers: { model: "14 Pro" } });
    expect(buildRepairRequestEmailSubject(state)).toBe("Repair Request — iPhone 14 Pro");
  });

  it("falls back to 'Not sure' in the subject when no model was given", () => {
    const state = buildState({ categoryId: "ps5", brand: null, answers: { model: "", modelNotSure: true } });
    expect(buildRepairRequestEmailSubject(state)).toBe("Repair Request — PlayStation / PS5 Not sure");
  });

  it("mailto targets exactly toraysboost@gmail.com with the subject and full body", () => {
    const state = buildState({ categoryId: "iphone", brand: null, answers: { model: "14 Pro" } });
    const link = buildRepairRequestMailtoLink(state);
    expect(link).toMatch(/^mailto:toraysboost@gmail\.com\?/);
    const params = new URLSearchParams(link.split("?")[1]);
    expect(params.get("subject")).toBe("Repair Request — iPhone 14 Pro");
    const body = params.get("body");
    expect(body).toContain("Jane Doe");
    expect(body).not.toMatch(/\$\d/);
  });
});

describe("Spanish (es): the same builders produce fully Spanish, price-free output", () => {
  it("summary uses Spanish labels and the Spanish smart-question text", () => {
    const state = buildState({}, "es");
    const summary = buildRepairRequestSummary(state);
    expect(summary).toContain("Nombre: Jane Doe");
    expect(summary).toContain("Teléfono: 3055551234");
    expect(summary).toContain("Correo: jane@example.com");
    expect(summary).toContain(`Dispositivo: ${translations.es.wizard.categories[state.category.id]}`);
    expect(summary).toContain(`Marca: ${translations.es.wizard.brands[state.brand.id]}`);
    expect(summary).toContain(`Problema: ${translations.es.wizard.problems[state.problem.id]}`);
    state.smartQuestions.forEach((q) =>
      expect(summary).toContain(translations.es.wizard.questions[state.group][q.id])
    );
    expect(summary).toContain("Sí");
    expect(summary).toContain("No estoy seguro");
    expect(summary).toContain("Detalles adicionales: Screen flickers sometimes");
    expect(summary).not.toMatch(/\$\d/);
  });

  it("WhatsApp link opens with the Spanish greeting and no price", () => {
    const link = buildRepairRequestWhatsAppLink(buildState({}, "es"));
    const text = decodeURIComponent(link.split("?text=")[1]);
    expect(text).toContain(translations.es.wizard.summary.whatsappGreeting);
    expect(text).not.toMatch(/\$\d/);
  });

  it("email subject uses the Spanish prefix and device name", () => {
    const state = buildState({ categoryId: "iphone", brand: null, answers: { model: "14 Pro" } }, "es");
    expect(buildRepairRequestEmailSubject(state)).toBe("Solicitud de Reparación — iPhone 14 Pro");
  });

  it("falls back to the Spanish 'not sure' phrase in the subject when no model was given", () => {
    const state = buildState({ categoryId: "ps5", brand: null, answers: { model: "", modelNotSure: true } }, "es");
    expect(buildRepairRequestEmailSubject(state)).toBe("Solicitud de Reparación — PlayStation / PS5 No estoy seguro");
  });
});
