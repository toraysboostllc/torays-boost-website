// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { WholesaleLegal } from "../src/pages/WholesaleLegal.jsx";
import { WholesaleEstimateDisclaimerAcceptModal } from "../src/components/wholesale/WholesaleEstimateDisclaimerAcceptModal.jsx";
import { WholesaleLocaleProvider } from "../src/i18n/WholesaleLocaleContext.jsx";
import { WHOLESALE_LOCALE_STORAGE_KEY } from "../src/lib/wholesaleLocale.js";

/**
 * Regression coverage for a real reported bug (2026-08-22, Website Preview
 * of commit 02f1b38): Estimate Disclaimer version 1 published correctly
 * from DESK, the "Before you continue" modal appeared and showed its "Read
 * the Estimate Terms & Conditions" link — but clicking it opened
 * /wholesale/legal and showed "No published legal document bundle yet."
 * instead of the just-published Estimate Disclaimer.
 *
 * Root cause, found by reading src/pages/WholesaleLegal.jsx: the page
 * fetches the 6-document Master Agreement bundle (fetchWholesaleLegal
 * Documents) and the Estimate Disclaimer (fetchWholesaleEstimateDisclaimer)
 * independently and in parallel — but the ENTIRE page's render was gated
 * behind a single `state.status` derived SOLELY from the master-agreement
 * fetch. The Estimate Disclaimer JSX block was nested inside `{state.status
 * === "ready" && (...)}`, so on any Preview where an Estimate Disclaimer
 * had been published but the Master Agreement bundle never had (exactly
 * this Preview's real database state, confirmed by the reported error text
 * matching api/wholesale-legal-documents.js's own 404 message verbatim),
 * the page fell into `state.status === "error"` and never rendered the
 * Estimate Disclaimer section at all — even though it had already been
 * fetched successfully and sat ready in `estimateDoc` state.
 *
 * Fix: the Estimate Disclaimer section now renders from its own
 * `estimateDoc` state, as a sibling of (never nested inside) the master
 * bundle's status-gated block — so it always shows whenever it has been
 * published, independent of whether the Master Agreement bundle exists.
 *
 * This is the first component-render test in this repo (jsdom + React
 * Testing Library are new devDependencies, scoped to this file only via
 * the `@vitest-environment jsdom` directive above — every other test file
 * keeps running in the default node environment, unaffected). A real DOM
 * render is what's needed here: the bug is specifically about async
 * effect-driven state and JSX nesting, which a source-text/structural scan
 * cannot prove one way or the other.
 */

vi.mock("../src/lib/wholesaleAuth.js", () => ({
  fetchWholesaleLegalDocuments: vi.fn(),
  fetchWholesaleEstimateDisclaimer: vi.fn(),
}));

vi.mock("../src/lib/wholesaleSound.js", () => ({
  wholesaleHoverProps: (onClick) => ({ onClick }),
}));

import { fetchWholesaleLegalDocuments, fetchWholesaleEstimateDisclaimer } from "../src/lib/wholesaleAuth.js";

const NO_MASTER_BUNDLE = { ok: false, message: "No published legal document bundle yet." };

const PUBLISHED_ESTIMATE_DISCLAIMER = {
  ok: true,
  version: "1",
  content_en: { body: "Prices shown are wholesale estimates only, confirmed after inspection." },
  content_es: { body: "Los precios mostrados son solo estimaciones mayoristas, confirmadas tras la inspección." },
  content_hash: "abc123",
  published_at: "2026-08-22T12:00:00.000Z",
};

const PUBLISHED_MASTER_BUNDLE = {
  ok: true,
  version: "2026-08-01",
  content_en: {
    access_agreement: { title: "Access Agreement", body: "Master EN access body." },
    pricing_policy: { title: "Pricing Policy", body: "Master EN pricing body." },
    pricing_disclaimer: { title: "Pricing Disclaimer", body: "Master EN disclaimer body." },
    privacy_security: { title: "Privacy & Security", body: "Master EN privacy body." },
    repair_warranty_terms: { title: "Warranty Terms", body: "Master EN warranty body." },
    econsent_disclosure: { title: "eConsent", body: "Master EN econsent body." },
  },
  content_es: {
    access_agreement: { title: "Acuerdo de Acceso", body: "Master ES access body." },
    pricing_policy: { title: "Política de Precios", body: "Master ES pricing body." },
    pricing_disclaimer: { title: "Aviso de Precios", body: "Master ES disclaimer body." },
    privacy_security: { title: "Privacidad y Seguridad", body: "Master ES privacy body." },
    repair_warranty_terms: { title: "Términos de Garantía", body: "Master ES warranty body." },
    econsent_disclosure: { title: "Consentimiento Electrónico", body: "Master ES econsent body." },
  },
  published_at: "2026-07-01T12:00:00.000Z",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
});

// WholesaleLegal renders a react-router <Link> (back to /wholesale) in its
// header — needs a Router context to render at all, even though this test
// never navigates.
function renderLegalPage() {
  return render(
    <MemoryRouter>
      <WholesaleLegal />
    </MemoryRouter>
  );
}

function setEnglish() {
  window.localStorage.setItem(WHOLESALE_LOCALE_STORAGE_KEY, JSON.stringify({ language: "en", country: "US", currency: "USD" }));
}
function setSpanish() {
  window.localStorage.setItem(WHOLESALE_LOCALE_STORAGE_KEY, JSON.stringify({ language: "es", country: "US", currency: "USD" }));
}

describe("The exact reported bug: Estimate Disclaimer published, Master Agreement not — /wholesale/legal", () => {
  it("shows the Estimate Disclaimer's real published content (EN) even though the Master Agreement bundle 404s with the exact reported message", async () => {
    setEnglish();
    fetchWholesaleLegalDocuments.mockResolvedValue(NO_MASTER_BUNDLE);
    fetchWholesaleEstimateDisclaimer.mockResolvedValue(PUBLISHED_ESTIMATE_DISCLAIMER);

    renderLegalPage();

    // The master bundle's own error is still shown (never silently
    // suppressed) — this proves the fix does not hide real master-bundle
    // errors, it only stops them from blocking the estimate disclaimer.
    expect(await screen.findByText("No published legal document bundle yet.")).toBeTruthy();

    // The exact reported failure: this must NOT be missing.
    const section = await screen.findByText("Estimate Terms & Conditions");
    expect(section).toBeTruthy();
    expect(
      screen.getByText("Prices shown are wholesale estimates only, confirmed after inspection.")
    ).toBeTruthy();

    // The section is addressable by the exact fragment id the modal's link
    // points to (/wholesale/legal#estimate_disclaimer).
    const anchored = document.getElementById("estimate_disclaimer");
    expect(anchored).toBeTruthy();
    expect(within(anchored).getByText("Prices shown are wholesale estimates only, confirmed after inspection.")).toBeTruthy();

    // Version/publish date shown for the estimate disclaimer specifically —
    // proves it reads estimateDoc.version, never the (absent) master
    // bundle's version.
    expect(screen.getByText(/Version: 1\b/)).toBeTruthy();
  });

  it("shows the Estimate Disclaimer's real published content (ES) when the shop's locale is Spanish", async () => {
    setSpanish();
    fetchWholesaleLegalDocuments.mockResolvedValue(NO_MASTER_BUNDLE);
    fetchWholesaleEstimateDisclaimer.mockResolvedValue(PUBLISHED_ESTIMATE_DISCLAIMER);

    renderLegalPage();

    // The master bundle's error text is the server's own raw message
    // (result.message), never localized client-side — same in EN and ES.
    expect(await screen.findByText("No published legal document bundle yet.")).toBeTruthy();
    expect(await screen.findByText("Términos y Condiciones de la Estimación")).toBeTruthy();
    expect(
      screen.getByText("Los precios mostrados son solo estimaciones mayoristas, confirmadas tras la inspección.")
    ).toBeTruthy();
    // The English body must never appear when Spanish is selected.
    expect(screen.queryByText("Prices shown are wholesale estimates only, confirmed after inspection.")).toBeNull();
  });

  it("renders nothing extra when no Estimate Disclaimer has ever been published — never an empty section", async () => {
    setEnglish();
    fetchWholesaleLegalDocuments.mockResolvedValue(NO_MASTER_BUNDLE);
    fetchWholesaleEstimateDisclaimer.mockResolvedValue({ ok: false, message: "No published estimate disclaimer yet." });

    renderLegalPage();

    await screen.findByText("No published legal document bundle yet.");
    expect(screen.queryByText("Estimate Terms & Conditions")).toBeNull();
    expect(document.getElementById("estimate_disclaimer")).toBeNull();
  });
});

describe("Regression: Master Agreement and Estimate Disclaimer never mix, even when both are published", () => {
  it("shows all 6 Master sections AND the Estimate Disclaimer, each with only its own content", async () => {
    setEnglish();
    fetchWholesaleLegalDocuments.mockResolvedValue(PUBLISHED_MASTER_BUNDLE);
    fetchWholesaleEstimateDisclaimer.mockResolvedValue(PUBLISHED_ESTIMATE_DISCLAIMER);

    renderLegalPage();

    for (const title of [
      "Access Agreement", "Pricing Policy", "Pricing Disclaimer",
      "Privacy & Security", "Warranty Terms", "eConsent",
    ]) {
      expect(await screen.findByText(title)).toBeTruthy();
    }
    expect(await screen.findByText("Estimate Terms & Conditions")).toBeTruthy();

    // The master bundle's own generic error/loading text is gone once ready.
    expect(screen.queryByText("No published legal document bundle yet.")).toBeNull();

    // The estimate disclaimer's body never leaks into any master section,
    // and no master section's body leaks into the estimate disclaimer's.
    const estimateSection = document.getElementById("estimate_disclaimer");
    expect(within(estimateSection).queryByText(/Master EN/)).toBeNull();
    const accessSection = document.getElementById("access_agreement");
    expect(within(accessSection).queryByText(/Prices shown are wholesale estimates/)).toBeNull();
  });
});

describe("The modal's link points exactly where the fixed page can show the content", () => {
  it("WholesaleEstimateDisclaimerAcceptModal's 'Read the Estimate Terms & Conditions' link is exactly /wholesale/legal#estimate_disclaimer", () => {
    render(
      <WholesaleLocaleProvider>
        <WholesaleEstimateDisclaimerAcceptModal legalDocumentId="doc-1" onAccepted={() => {}} onLogout={() => {}} />
      </WholesaleLocaleProvider>
    );
    const link = screen.getByText("Read the Estimate Terms & Conditions");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/wholesale/legal#estimate_disclaimer");
    expect(link.getAttribute("target")).toBe("_blank");
    // Matches the exact id LegalDocSection assigns to the estimate
    // disclaimer section in WholesaleLegal.jsx (docKey="estimate_disclaimer").
    expect(link.getAttribute("href").split("#")[1]).toBe("estimate_disclaimer");
  });

  it("the checkbox starts unchecked and Accept stays disabled until it's checked — unrelated to this bug, confirmed unaffected", () => {
    render(
      <WholesaleLocaleProvider>
        <WholesaleEstimateDisclaimerAcceptModal legalDocumentId="doc-1" onAccepted={() => {}} onLogout={() => {}} />
      </WholesaleLocaleProvider>
    );
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox.checked).toBe(false);
    const acceptButton = screen.getByRole("button", { name: "Accept and Enter" });
    expect(acceptButton.disabled).toBe(true);
  });
});
