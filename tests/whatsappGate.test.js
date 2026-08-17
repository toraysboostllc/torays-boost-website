import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { siteConfig } from "../src/config/site.config.js";
import { translations } from "../src/i18n/translations.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const gateModalSrc = read("src/components/repair/WhatsAppGateModal.jsx");
const homeSrc = read("src/pages/Home.jsx");
const navbarSrc = read("src/components/layout/Navbar.jsx");
const whatsappCtaSrc = read("src/components/layout/WhatsAppCta.jsx");
const floatButtonSrc = read("src/components/layout/WhatsAppFloatButton.jsx");
const contactSrc = read("src/sections/Contact.jsx");
const repairModalSrc = read("src/components/repair/RepairRequestModal.jsx");
const whatsappLibSrc = read("src/lib/whatsapp.js");

describe("WhatsAppGateModal: exact bilingual copy", () => {
  it("English matches exactly: title, message, start, notNow, close", () => {
    const en = translations.en.whatsappGate;
    expect(en.title).toBe("Before messaging us");
    expect(en.message).toBe("Complete your repair request first so we can help you faster. It only takes a moment.");
    expect(en.start).toBe("Start request");
    expect(en.notNow).toBe("Not now");
    expect(en.close).toBe("Close");
  });

  it("Spanish matches exactly: title, message, start, notNow, close", () => {
    const es = translations.es.whatsappGate;
    expect(es.title).toBe("Antes de escribirnos");
    expect(es.message).toBe(
      "Completa primero tu solicitud de reparación para que podamos ayudarte más rápido. Solo tomará un momento."
    );
    expect(es.start).toBe("Iniciar solicitud");
    expect(es.notNow).toBe("Ahora no");
    expect(es.close).toBe("Cerrar");
  });
});

describe("WhatsAppGateModal: never opens window.alert or wa.me directly", () => {
  it("never calls window.alert", () => {
    expect(gateModalSrc).not.toMatch(/window\.alert|(?<![\w.])alert\(/);
  });

  it("never imports or builds a wa.me link — only calls the onStart/onClose props it's given", () => {
    const stripped = gateModalSrc.replace(/\/\*\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(stripped).not.toMatch(/wa\.me|buildWhatsAppLink|buildContactLink/);
    expect(stripped).toContain("onClick={onClose}");
    expect(stripped).toContain("onClick={onStart}");
  });
});

describe("WhatsAppGateModal: accessibility", () => {
  it('uses role="dialog" and aria-modal="true" with an accessible title', () => {
    expect(gateModalSrc).toContain('role="dialog"');
    expect(gateModalSrc).toContain('aria-modal="true"');
    expect(gateModalSrc).toContain('aria-labelledby="whatsapp-gate-title"');
    expect(gateModalSrc).toContain('id="whatsapp-gate-title"');
  });

  it("closes on Escape", () => {
    expect(gateModalSrc).toMatch(/e\.key === "Escape"/);
  });

  it("traps Tab focus within the panel (first/last focusable wrap-around)", () => {
    expect(gateModalSrc).toContain("FOCUSABLE_SELECTOR");
    expect(gateModalSrc).toMatch(/e\.shiftKey && document\.activeElement === first/);
    expect(gateModalSrc).toMatch(/!e\.shiftKey && document\.activeElement === last/);
  });

  it("restores focus to whatever was focused before the modal opened", () => {
    expect(gateModalSrc).toContain("const previouslyFocused = document.activeElement;");
    expect(gateModalSrc).toContain("previouslyFocused?.focus?.();");
  });

  it("moves focus to the modal's own title on open", () => {
    expect(gateModalSrc).toContain("titleRef.current?.focus();");
  });

  it("both buttons meet the 44px minimum touch target", () => {
    const buttonBlock = gateModalSrc.match(/<div className="mt-4 flex flex-col[\s\S]*?<\/div>\s*<\/div>/)[0];
    expect((buttonBlock.match(/min-h-11/g) || []).length).toBe(2);
  });

  it("backdrop click closes the same as Not Now (onClose), never triggers onStart", () => {
    expect(gateModalSrc).toMatch(/className="fixed inset-0[\s\S]*?onClick=\{onClose\}/);
  });

  it("has a small X close button that also calls onClose", () => {
    const closeButtonBlock = gateModalSrc.match(/<button[\s\S]*?whatsappGate\.close[\s\S]*?<\/button>/)[0];
    expect(closeButtonBlock).toContain("onClick={onClose}");
    expect(closeButtonBlock).toContain("<X ");
  });
});

describe("WhatsAppGateModal: Not Now / notNow only closes, never opens WhatsApp or navigates", () => {
  it("the Not Now button's only action is onClose — no href, no window.location, no wa.me", () => {
    // Index-based slice (not a single regex) since the modal now has three
    // <button> elements (X close, start, notNow) — a naive first-<button>
    // match would swallow the start button (and its onClick={onStart}) too.
    const notNowIdx = gateModalSrc.indexOf("whatsappGate.notNow");
    const buttonStart = gateModalSrc.lastIndexOf("<button", notNowIdx);
    const buttonEnd = gateModalSrc.indexOf("</button>", notNowIdx) + "</button>".length;
    const notNowButton = gateModalSrc.slice(buttonStart, buttonEnd);
    expect(notNowButton).toContain("onClick={onClose}");
    expect(notNowButton).not.toMatch(/href=|window\.location|wa\.me|onStart/);
  });
});

describe("Home.jsx: wires the gate between general WhatsApp buttons and the wizard", () => {
  it("owns whatsappGateOpen state, separate from repairRequestOpen", () => {
    expect(homeSrc).toContain("const [repairRequestOpen, setRepairRequestOpen] = useState(false);");
    expect(homeSrc).toContain("const [whatsappGateOpen, setWhatsappGateOpen] = useState(false);");
  });

  it("openWhatsAppGate only opens the gate — never touches repairRequestOpen or WhatsApp", () => {
    const fn = homeSrc.match(/function openWhatsAppGate\(\) \{[\s\S]*?\}/)[0];
    expect(fn).toContain("setWhatsappGateOpen(true)");
    expect(fn).not.toMatch(/setRepairRequestOpen|wa\.me/);
  });

  it("starting from the gate closes the gate AND opens the wizard, in that order, within one handler", () => {
    const fn = homeSrc.match(/function startRepairRequestFromGate\(\) \{[\s\S]*?\}/)[0];
    const closeIdx = fn.indexOf("setWhatsappGateOpen(false)");
    const openIdx = fn.indexOf("setRepairRequestOpen(true)");
    expect(closeIdx).toBeGreaterThan(-1);
    expect(openIdx).toBeGreaterThan(closeIdx);
  });

  it("passes openWhatsAppGate to Navbar, WhatsAppFloatButton, and Contact — the three general WhatsApp entry points", () => {
    expect(homeSrc).toContain("<Navbar onWhatsAppClick={openWhatsAppGate} />");
    expect(homeSrc).toContain("<WhatsAppFloatButton onClick={openWhatsAppGate} />");
    expect(homeSrc).toContain("<Contact onWhatsAppClick={openWhatsAppGate} />");
  });

  it("the gate modal only mounts onStart=startRepairRequestFromGate, onClose=close-only", () => {
    expect(homeSrc).toMatch(
      /<WhatsAppGateModal onClose=\{\(\) => setWhatsappGateOpen\(false\)\} onStart=\{startRepairRequestFromGate\} \/>/
    );
  });
});

describe("General WhatsApp buttons never open wa.me directly — Navbar, floating button, Contact card", () => {
  it("WhatsAppCta.jsx (Navbar, both variants) is a plain button with no href/wa.me/target=_blank", () => {
    const stripped = whatsappCtaSrc.replace(/\/\*\*[\s\S]*?\*\//g, "");
    expect(stripped).toMatch(/<button\s/);
    expect(stripped).not.toMatch(/href=|wa\.me|target="_blank"/);
  });

  it("WhatsAppFloatButton.jsx is a plain button with no href/wa.me/target=_blank", () => {
    const stripped = floatButtonSrc.replace(/\/\*\*[\s\S]*?\*\//g, "");
    expect(stripped).toMatch(/<motion\.button\s/);
    expect(stripped).not.toMatch(/href=|wa\.me|target="_blank"/);
  });

  it("Navbar.jsx wires onWhatsAppClick into both WhatsAppCta instances (header and mobile)", () => {
    expect(navbarSrc).toContain("onWhatsAppClick");
    expect(navbarSrc).toContain('<WhatsAppCta variant="header" onClick={onWhatsAppClick} />');
    const mobileBlock = navbarSrc.match(/<WhatsAppCta\s+variant="mobile"[\s\S]*?\/>/)[0];
    expect(mobileBlock).toContain("onWhatsAppClick()");
  });

  it("Contact.jsx's WhatsApp card is a button calling onWhatsAppClick, not a wa.me <a>", () => {
    const waCardBlock = contactSrc.match(/\{hasWhatsApp && \([\s\S]*?\)\)\}/)[0];
    expect(waCardBlock).toMatch(/<button\s/);
    expect(waCardBlock).toContain("onClick={onWhatsAppClick}");
    expect(waCardBlock).not.toMatch(/href=|wa\.me|target="_blank"/);
  });

  it("Contact.jsx no longer imports buildWhatsAppLink — it never builds a WhatsApp link itself", () => {
    expect(contactSrc).not.toMatch(/buildWhatsAppLink/);
  });
});

describe("Only the Smart Repair Request's final step opens a real wa.me link", () => {
  it("RepairRequestModal's ReviewStep opens buildRepairRequestWhatsAppLink via window.open with noopener/noreferrer, gated on policyAccepted", () => {
    const guard = repairModalSrc.match(/function ensurePolicyAccepted\(\) \{[\s\S]*?\n  \}/)[0];
    expect(guard).toMatch(/if \(!answers\.policyAccepted\) \{/);
    expect(guard).toContain("setShowPolicyError(true)");
    expect(guard).toContain("policyCheckboxRef.current?.focus()");

    const fn = repairModalSrc.match(/function handleGetQuote\(\) \{[\s\S]*?\n  \}/)[0];
    expect(fn).toMatch(/if \(!ensurePolicyAccepted\(\)\) return;/);
    expect(fn).toContain('window.open(buildRepairRequestWhatsAppLink(messageState), "_blank", "noopener,noreferrer")');
  });

  it("RepairRequestModal's ReviewStep also gates 'Send via Email' behind the same policyAccepted check", () => {
    const fn = repairModalSrc.match(/function handleSendEmail\(\) \{[\s\S]*?\n  \}/)[0];
    expect(fn).toMatch(/if \(!ensurePolicyAccepted\(\)\) return;/);
    expect(fn).toContain("window.location.href = buildRepairRequestMailtoLink(messageState)");
  });

  it("the email action is a gated <button>, not a plain <a href> that would bypass the checkbox", () => {
    expect(repairModalSrc).not.toMatch(/<a\s+href=\{buildRepairRequestMailtoLink/);
    const emailButtonIdx = repairModalSrc.indexOf("onClick={handleSendEmail}");
    expect(emailButtonIdx).toBeGreaterThan(-1);
    const buttonStart = repairModalSrc.lastIndexOf("<button", emailButtonIdx);
    const buttonEnd = repairModalSrc.indexOf("</button>", emailButtonIdx) + "</button>".length;
    const emailButton = repairModalSrc.slice(buttonStart, buttonEnd);
    expect(emailButton).toContain('type="button"');
  });

  it("buildWhatsAppLink (the only wa.me builder in the codebase) still targets siteConfig.whatsapp.number", () => {
    expect(whatsappLibSrc).toContain("https://wa.me/${siteConfig.whatsapp.number}");
  });
});

describe("Confirmed contact data: single source of truth, no duplicates, old data fully gone", () => {
  it("phone, email, and address each appear exactly once across every component file touched this round", () => {
    const files = [navbarSrc, whatsappCtaSrc, floatButtonSrc, contactSrc, repairModalSrc, whatsappLibSrc, homeSrc];
    files.forEach((src) => {
      expect(src).not.toMatch(/17867937665|786.*793.*7665/); // no hardcoded number outside site.config.js
      expect(src).not.toMatch(/toraysboostllc@gmail\.com/); // no hardcoded email outside site.config.js
    });
  });

  it("site.config.js is the only place the real number/email/address literals live", () => {
    expect(siteConfig.whatsapp.number).toBe("17867937665");
    expect(siteConfig.whatsapp.displayNumber).toBe("+1 (786) 793-7665");
    expect(siteConfig.email).toBe("toraysboostllc@gmail.com");
    expect(siteConfig.address.line1).toBe("Kendall, Miami, FL 33196");
  });

  it("old phone (305) 301-1152 / 13053011152 no longer appears anywhere in src/", () => {
    const files = [navbarSrc, whatsappCtaSrc, floatButtonSrc, contactSrc, repairModalSrc, whatsappLibSrc, homeSrc, gateModalSrc];
    files.forEach((src) => {
      expect(src).not.toMatch(/13053011152|301-1152/);
    });
    expect(JSON.stringify(siteConfig)).not.toMatch(/13053011152|301-1152/);
  });

  it("old email toraysboost@gmail.com (without llc) no longer appears anywhere", () => {
    const files = [navbarSrc, whatsappCtaSrc, floatButtonSrc, contactSrc, repairModalSrc, whatsappLibSrc, homeSrc, gateModalSrc];
    files.forEach((src) => {
      expect(src).not.toMatch(/(?<!llc)toraysboost@gmail\.com/);
    });
  });

  it('"Address coming soon" placeholder text and key are fully removed from both languages', () => {
    expect(translations.en.contact.addressPlaceholder).toBeUndefined();
    expect(translations.es.contact.addressPlaceholder).toBeUndefined();
    expect(JSON.stringify(translations)).not.toMatch(/Address coming soon|Dirección próximamente/);
  });

  it("no Google Maps link/embed was added — mapEmbedUrl stays empty, per the no-precise-address requirement", () => {
    expect(siteConfig.address.mapEmbedUrl).toBe("");
  });

  it("hours were not touched this round", () => {
    expect(siteConfig.hours).toEqual([
      { days: "Monday – Friday", time: "TBD" },
      { days: "Saturday", time: "TBD" },
      { days: "Sunday", time: "Closed" },
    ]);
  });
});
