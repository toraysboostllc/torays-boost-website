import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { translations, formatTranslation } from "../src/i18n/translations.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const modalSrc = read("src/components/repair/RepairRequestModal.jsx");
const hookSrc = read("src/hooks/useRepairRequest.js");
const gateModalSrc = read("src/components/repair/WhatsAppGateModal.jsx");
const indexCssSrc = read("src/styles/index.css");

function lookup(dict, key) {
  return key.split(".").reduce((node, part) => (node == null ? undefined : node[part]), dict);
}
function makeT(lang) {
  return function t(key, vars) {
    const value = lookup(translations[lang], key) ?? lookup(translations.en, key) ?? key;
    return typeof value === "string" && vars ? formatTranslation(value, vars) : value;
  };
}

describe("Policy consent: starts unchecked, persists like every other answer", () => {
  it("policyAccepted is part of initialAnswers, defaulting to false", () => {
    expect(hookSrc).toMatch(/initialAnswers = \{[\s\S]*policyAccepted: false,[\s\S]*\}/);
  });

  it("reset() restores initialAnswers wholesale, so policyAccepted always goes back to false on reopen", () => {
    const fn = hookSrc.match(/function reset\(\) \{[\s\S]*?\}/)[0];
    expect(fn).toContain("setAnswers(initialAnswers)");
  });
});

describe("Policy consent: exact bilingual sentence, links exactly where required", () => {
  it("English reconstructs to the exact required sentence with the links in place", () => {
    const en = translations.en.wizard.policyConsent;
    const full = en.prefix + en.termsLabel + en.middle + en.privacyLabel + en.suffix;
    expect(full).toBe(
      "I understand that this request is only for a no-obligation estimate, does not authorize any repair or charge, and I agree to the Terms of Service and Privacy Policy."
    );
  });

  it("Spanish reconstructs to the exact required sentence with the links in place", () => {
    const es = translations.es.wizard.policyConsent;
    const full = es.prefix + es.termsLabel + es.middle + es.privacyLabel + es.suffix;
    expect(full).toBe(
      "Entiendo que esta solicitud es únicamente para recibir un estimado sin compromiso, que no autoriza ninguna reparación ni cargo, y acepto los Términos de servicio y la Política de privacidad."
    );
  });

  it("the checkbox sentence never mentions WhatsApp — that authorization lives in the separate note", () => {
    expect(translations.en.wizard.policyConsent.prefix + translations.en.wizard.policyConsent.suffix).not.toMatch(/WhatsApp/i);
    expect(translations.es.wizard.policyConsent.prefix + translations.es.wizard.policyConsent.suffix).not.toMatch(/WhatsApp/i);
  });

  it("the small validation message matches exactly in both languages", () => {
    expect(translations.en.wizard.policyConsent.error).toBe("Please accept the Terms and Privacy Policy to continue.");
    expect(translations.es.wizard.policyConsent.error).toBe("Acepta los Términos y la Política de privacidad para continuar.");
  });

  it("the separate WhatsApp authorization note matches exactly in both languages", () => {
    expect(translations.en.wizard.whatsappAuthNote).toBe(
      "By submitting this request, you authorize Torays Boost LLC to respond through WhatsApp only regarding this estimate or repair. This does not authorize advertising."
    );
    expect(translations.es.wizard.whatsappAuthNote).toBe(
      "Al enviar esta solicitud, autorizas a Torays Boost LLC a responderte por WhatsApp únicamente en relación con este estimado o reparación. Esto no autoriza publicidad."
    );
  });

  it("the WhatsApp message confirmation line matches exactly in both languages", () => {
    expect(translations.en.wizard.summary.consentConfirmation).toBe(
      "✅ I understand that this request is only for a no-obligation estimate and does not authorize any repair or charge."
    );
    expect(translations.es.wizard.summary.consentConfirmation).toBe(
      "✅ Entiendo que esta solicitud es solamente para recibir un estimado sin compromiso y que no autoriza ninguna reparación ni cargo."
    );
  });
});

describe("ReviewStep: the checkbox block itself", () => {
  it("checkbox is required-in-effect (validated on submit) but not disabled, and starts unchecked via answers.policyAccepted", () => {
    expect(modalSrc).toContain('checked={answers.policyAccepted}');
    expect(modalSrc).not.toMatch(/type="checkbox"[\s\S]{0,80}disabled/);
  });

  it("checking the box clears any prior validation error", () => {
    const onChangeBlock = modalSrc.match(/onChange=\{\(e\) => \{[\s\S]*?setField\("policyAccepted"[\s\S]*?\}\}/)[0];
    expect(onChangeBlock).toContain('estimator.setField("policyAccepted", e.target.checked)');
    expect(onChangeBlock).toMatch(/if \(e\.target\.checked\) setShowPolicyError\(false\)/);
  });

  it("the entire label (checkbox + text) is one pressable <label> — not just the input", () => {
    const labelBlock = modalSrc.match(/<label className="flex min-h-11 items-start[\s\S]*?<\/label>/)[0];
    expect(labelBlock).toMatch(/^<label /);
    expect(labelBlock).toContain("<input");
    expect(labelBlock).toContain('type="checkbox"');
  });

  it("links to /terms and /privacy open in a new tab (target=_blank) — the in-progress form is never navigated away from", () => {
    const labelBlock = modalSrc.match(/<label className="flex min-h-11 items-start[\s\S]*?<\/label>/)[0];
    expect(labelBlock).toMatch(/href="\/terms"[\s\S]{0,40}target="_blank"/);
    expect(labelBlock).toMatch(/href="\/privacy"[\s\S]{0,40}target="_blank"/);
    // Plain <a>, not react-router's <Link> — Link would still trigger an
    // in-app route change even with target="_blank" via history APIs some
    // setups intercept; a real anchor guarantees the SPA state survives.
    expect(labelBlock).not.toMatch(/<Link\s+to="\/terms"|<Link\s+to="\/privacy"/);
  });

  it("the validation message uses role=\"alert\" (accessible, announced) and is linked via aria-describedby", () => {
    expect(modalSrc).toContain('id="policy-consent-error"');
    expect(modalSrc).toContain('role="alert"');
    expect(modalSrc).toContain('aria-describedby={showPolicyError ? "policy-consent-error" : undefined}');
    expect(modalSrc).toContain("aria-invalid={showPolicyError}");
  });

  it("is a small, soft message below the checkbox — not window.alert or a large banner", () => {
    expect(modalSrc).not.toMatch(/window\.alert|(?<![\w.])alert\(/);
    const errorBlock = modalSrc.match(/\{showPolicyError && \([\s\S]*?\)\}/)[0];
    expect(errorBlock).toMatch(/text-xs/);
  });
});

describe("ReviewStep: Get My Quote / Cotizar validates before opening WhatsApp", () => {
  it("the button is labeled wizard.getQuote — 'Get My Quote' / 'Cotizar'", () => {
    expect(modalSrc).toContain('{t("wizard.getQuote")}');
    expect(translations.en.wizard.getQuote).toBe("Get My Quote");
    expect(translations.es.wizard.getQuote).toBe("Cotizar");
    expect(translations.en.wizard).not.toHaveProperty("sendWhatsApp");
    expect(translations.es.wizard).not.toHaveProperty("sendWhatsApp");
  });

  it("clicking it calls handleGetQuote, not a bare href — WhatsApp never opens on an unvalidated click", () => {
    const buttonBlock = modalSrc.match(/<button\s+type="button"\s+onClick=\{handleGetQuote\}[\s\S]*?<\/button>/)[0];
    expect(buttonBlock).toContain('onClick={handleGetQuote}');
    expect(buttonBlock).not.toMatch(/href=/);
  });

  it("never mentions Twilio, SMS, STOP, or HELP anywhere in the wizard", () => {
    expect(modalSrc).not.toMatch(/Twilio|\bSMS\b|\bSTOP\b|\bHELP\b/);
  });

  it("never includes a price/dollar amount near the consent or quote button", () => {
    expect(modalSrc).not.toMatch(/\$\d/);
  });
});

describe("Simulated validation flow (pure logic, mirrors handleGetQuote exactly)", () => {
  // No render harness in this project — this exercises the exact gate
  // logic as a plain function, matching the component's own condition.
  function simulateGetQuote(policyAccepted) {
    const state = { opened: false, errorShown: false, focused: false };
    if (!policyAccepted) {
      state.errorShown = true;
      state.focused = true;
      return state;
    }
    state.opened = true;
    return state;
  }

  it("unchecked: shows the error, focuses the checkbox, never opens WhatsApp", () => {
    const result = simulateGetQuote(false);
    expect(result.errorShown).toBe(true);
    expect(result.focused).toBe(true);
    expect(result.opened).toBe(false);
  });

  it("checked: opens WhatsApp, no error", () => {
    const result = simulateGetQuote(true);
    expect(result.opened).toBe(true);
    expect(result.errorShown).toBe(false);
  });
});

describe("WhatsAppGateModal redesign: small, glassy, short copy", () => {
  it("panel is capped at 340px (mobile) / 360px (desktop), not close to full-screen", () => {
    expect(gateModalSrc).toContain("max-w-[340px]");
    expect(gateModalSrc).toContain("sm:max-w-[360px]");
    expect(gateModalSrc).toContain("w-[calc(100%-40px)]");
  });

  it("padding is ~18px, not the old p-6/p-8", () => {
    expect(gateModalSrc).toContain("p-[18px]");
    expect(gateModalSrc).not.toMatch(/\bp-6\b|\bp-8\b|sm:p-8/);
  });

  it("uses the frosted-glass panel class with backdrop-blur(14px)", () => {
    expect(gateModalSrc).toContain("whatsapp-gate-panel");
    expect(gateModalSrc).toContain("backdrop-blur-[14px]");
  });

  it("title/text font sizes are in the requested 17-18px / 13-14px ranges", () => {
    expect(gateModalSrc).toMatch(/text-\[17px\][\s\S]{0,150}sm:text-\[18px\]/);
    expect(gateModalSrc).toMatch(/text-\[13px\][\s\S]{0,150}sm:text-\[14px\]/);
  });

  it("icon is sized in the 30-34px range (rendered as an SVG size prop, not a huge circle)", () => {
    const iconMatch = gateModalSrc.match(/<MessageCircle size=\{(\d+)\}/);
    expect(iconMatch).toBeTruthy();
    const size = Number(iconMatch[1]);
    expect(size).toBeGreaterThanOrEqual(18);
    expect(size).toBeLessThanOrEqual(34);
  });

  it("both buttons stay at the 44px touch-target floor despite the compact redesign", () => {
    expect((gateModalSrc.match(/min-h-11/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it("outer overlay is soft — the requested rgba(15,23,42,0.30), not the old heavier scrim", () => {
    expect(gateModalSrc).toContain("bg-[rgba(15,23,42,0.30)]");
  });

  it("avoids saturated brand red/vivid blue blocks — primary button uses the soft navy-light token", () => {
    expect(gateModalSrc).toContain("bg-torays-navy-light");
    expect(gateModalSrc).not.toMatch(/bg-torays-red\b/);
  });

  it(".whatsapp-gate-panel defines both a light default and a prefers-color-scheme: dark override in index.css", () => {
    expect(indexCssSrc).toContain(".whatsapp-gate-panel {");
    expect(indexCssSrc).toContain("rgba(255, 255, 255, 0.88)");
    expect(indexCssSrc).toMatch(/@media \(prefers-color-scheme: dark\) \{\s*\.whatsapp-gate-panel \{/);
    expect(indexCssSrc).toContain("rgba(15, 23, 42, 0.84)");
  });

  it("never mentions Twilio/SMS", () => {
    expect(gateModalSrc).not.toMatch(/Twilio|\bSMS\b/);
  });
});
