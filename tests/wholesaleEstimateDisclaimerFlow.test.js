import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createFakeSupabase, mockReq, mockRes } from "./fakeSupabase.js";
import { sha256Hex } from "../api/_lib/wholesaleDb.js";
import { wholesaleTranslations } from "../src/i18n/wholesaleTranslations.js";
import documentsHandler from "../api/wholesale-estimate-disclaimer.js";
import acceptHandler from "../api/wholesale-accept-estimate-disclaimer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const modalSrc = readFileSync(join(root, "src/components/wholesale/WholesaleEstimateDisclaimerAcceptModal.jsx"), "utf8");
const pricesSrc = readFileSync(join(root, "src/pages/WholesalePrices.jsx"), "utf8");
const authSrc = readFileSync(join(root, "src/lib/wholesaleAuth.js"), "utf8");
const modalCodeOnly = modalSrc.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Structural guard: same "no dismiss path other than Logout" discipline as
 * WholesaleLegalAcceptModal.jsx (see wholesaleLegalAcceptModalGuard.test.js)
 * — deliberately copied for this lighter, single-checkbox sibling modal.
 */
describe("WholesaleEstimateDisclaimerAcceptModal: no dismiss path other than Logout", () => {
  it("the overlay <div> has no onClick handler (no backdrop-click-to-close)", () => {
    const overlayMatch = modalSrc.match(/<div className="fixed inset-0[\s\S]*?>/)[0];
    expect(overlayMatch).not.toMatch(/onClick/);
  });

  it("no keydown/Escape handler anywhere in the component (no Escape-to-dismiss)", () => {
    expect(modalCodeOnly).not.toMatch(/onKeyDown|keydown|Escape|onKeyUp/i);
  });

  it("no close/X icon or dismiss button of any kind", () => {
    expect(modalCodeOnly).not.toMatch(/<X[\s/]|aria-label="[Cc]lose"|onClose|\bclose\(/);
  });

  it("no skip/continue-without-accepting control", () => {
    expect(modalCodeOnly).not.toMatch(/skip|continue without|later|remind me|dismiss/i);
  });

  it("exactly one <button type=\"submit\"> (Accept) and one plain action button (Logout) — no third control", () => {
    const buttonCount = (modalSrc.match(/<button\b/g) || []).length;
    expect(buttonCount).toBe(2);
  });

  it("the Accept button is disabled until canSubmit, the Logout button is never disabled", () => {
    const acceptButtonBlock = modalSrc.match(/<button type="submit"[\s\S]*?<\/button>/)[0];
    expect(acceptButtonBlock).toContain("disabled={!canSubmit}");
    const logoutButtonBlock = modalSrc.match(/<button\s+type="button"[\s\S]*?onLogout[\s\S]*?<\/button>/)[0];
    expect(logoutButtonBlock).not.toMatch(/disabled/);
  });

  it("canSubmit requires ONLY the single checkbox — no representative name/title fields exist at all in this component", () => {
    const canSubmitLine = modalSrc.match(/const canSubmit = [^\n]+/)[0];
    expect(canSubmitLine).toBe("const canSubmit = accepted && !submitting;");
    expect(modalSrc).not.toContain("representativeName");
    expect(modalSrc).not.toContain("representativeTitle");
  });

  it("starts unchecked — no pre-selection", () => {
    expect(modalSrc).toContain("useState(false)");
  });

  it("exactly ONE checkbox input in the whole component (never 5)", () => {
    const checkboxCount = (modalSrc.match(/type="checkbox"/g) || []).length;
    expect(checkboxCount).toBe(1);
  });

  it("the Read link opens the estimate_disclaimer anchor on /wholesale/legal in a new tab", () => {
    const linkBlock = modalSrc.match(/<a\s+href="\/wholesale\/legal#estimate_disclaimer"[\s\S]*?<\/a>/)[0];
    expect(linkBlock).toContain('target="_blank"');
    expect(linkBlock).toContain('rel="noopener noreferrer"');
  });

  it("meets the 44px minimum touch-target convention already used by the master-agreement modal (min-h-11 = 2.75rem = 44px on the checkbox label)", () => {
    expect(modalSrc).toContain("min-h-11");
  });

  it("role=dialog, aria-modal=true, aria-labelledby pointing at the real heading id", () => {
    expect(modalSrc).toContain('role="dialog"');
    expect(modalSrc).toContain('aria-modal="true"');
    expect(modalSrc).toContain('aria-labelledby="wsl-estimate-disclaimer-heading"');
    expect(modalSrc).toContain('id="wsl-estimate-disclaimer-heading"');
  });
});

describe("WholesalePrices.jsx: legal_required branches on documentType — estimate_disclaimer gets the lightweight modal, everything else gets the master-agreement modal", () => {
  it("mounts WholesaleEstimateDisclaimerAcceptModal only when state.documentType === 'estimate_disclaimer', both branches reusing the same onAccepted/onLogout", () => {
    const block = pricesSrc.match(/if \(state\.status === "legal_required"\) \{[\s\S]*?\n  \}/)[0];
    expect(block).toContain('state.documentType === "estimate_disclaimer"');
    expect(block).toContain("<WholesaleEstimateDisclaimerAcceptModal");
    expect(block).toContain("<WholesaleLegalAcceptModal");
    const onAcceptedCount = (block.match(/onAccepted=\{loadCatalog\}/g) || []).length;
    const onLogoutCount = (block.match(/onLogout=\{handleLogout\}/g) || []).length;
    expect(onAcceptedCount).toBe(2);
    expect(onLogoutCount).toBe(2);
  });
});

describe("Bilingual checkbox copy — exact user-specified text, present in both languages", () => {
  it("EN checkbox text is exactly 'I have read and accept the Terms and Conditions.'", () => {
    expect(wholesaleTranslations.en.estimateDisclaimerAccept.checkboxLabel).toBe(
      "I have read and accept the Terms and Conditions."
    );
  });

  it("ES checkbox text is exactly 'He leído y acepto los Términos y Condiciones.'", () => {
    expect(wholesaleTranslations.es.estimateDisclaimerAccept.checkboxLabel).toBe(
      "He leído y acepto los Términos y Condiciones."
    );
  });

  it("both languages have complete, non-empty copy for every key the modal reads", () => {
    for (const key of ["heading", "subheading", "readLink", "checkboxLabel", "accept", "accepting", "logout", "errorGeneric", "errorCheckbox", "errorSuperseded"]) {
      expect(typeof wholesaleTranslations.en.estimateDisclaimerAccept[key]).toBe("string");
      expect(wholesaleTranslations.en.estimateDisclaimerAccept[key].length).toBeGreaterThan(0);
      expect(typeof wholesaleTranslations.es.estimateDisclaimerAccept[key]).toBe("string");
      expect(wholesaleTranslations.es.estimateDisclaimerAccept[key].length).toBeGreaterThan(0);
    }
  });
});

describe("src/lib/wholesaleAuth.js: fetchWholesaleEstimateDisclaimer / acceptWholesaleEstimateDisclaimer", () => {
  it("fetchWholesaleEstimateDisclaimer hits /api/wholesale-estimate-disclaimer with credentials: same-origin", () => {
    const fn = authSrc.match(/export async function fetchWholesaleEstimateDisclaimer\(\)[\s\S]*?\n}/)[0];
    expect(fn).toContain('"/api/wholesale-estimate-disclaimer"');
    expect(fn).toContain('credentials: "same-origin"');
  });

  it("acceptWholesaleEstimateDisclaimer posts {legalDocumentId, accepted, locale} — no representative fields", () => {
    const fn = authSrc.match(/export async function acceptWholesaleEstimateDisclaimer\([\s\S]*?\n}/)[0];
    expect(fn).toContain('"/api/wholesale-accept-estimate-disclaimer"');
    expect(fn).toContain("legalDocumentId, accepted, locale");
    expect(fn).not.toContain("representativeName");
  });

  it("fetchWholesaleCatalog's legal_required branch derives documentType/legalDocumentId/version from missing[0], with a fallback for a response with no missing array", () => {
    const fn = authSrc.match(/export async function fetchWholesaleCatalog\(\)[\s\S]*?\n}/)[0];
    expect(fn).toContain("Array.isArray(data.missing)");
    expect(fn).toContain("missing[0].documentType");
  });
});

/** Real-handler-against-fake-network tests for the two new endpoints, same
 *  convention as wholesaleLegalDocumentsEndpoint.test.js /
 *  wholesaleAcceptLegalEndpoint.test.js. */
function seedShopDeviceSession(fake) {
  const shopId = fake.nextId();
  fake.db.wholesale_shops.push({ id: shopId, name: "Test Shop", status: "active", code_hash: "x", failed_attempts: 0 });
  const deviceId = fake.nextId();
  fake.db.wholesale_devices.push({ id: deviceId, shop_id: shopId, device_token_hash: "device-hash", status: "approved" });
  fake.db.wholesale_sessions.push({
    id: fake.nextId(), shop_id: shopId, device_id: deviceId,
    session_token_hash: sha256Hex("live-session-token"),
    expires_at: new Date(Date.now() + 86400000).toISOString(), revoked_at: null,
  });
  return { shopId, deviceId };
}

function seedPublishedDisclaimer(fake, overrides = {}) {
  const doc = {
    id: fake.nextId(), document_type: "estimate_disclaimer", version: "1.0", status: "published",
    content_en: { body: "Prices shown are wholesale estimates." },
    content_es: { body: "Los precios mostrados son estimaciones mayoristas." },
    content_hash: "hash-est-1", published_at: new Date().toISOString(),
    ...overrides,
  };
  fake.db.wholesale_legal_documents.push(doc);
  return doc;
}

async function callHandler(handler, fake, req) {
  const res = mockRes();
  const originalFetch = global.fetch;
  global.fetch = fake.fakeFetch;
  process.env.SUPABASE_URL = "https://fake.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "fake-key";
  try {
    await handler(req, res);
  } finally {
    global.fetch = originalFetch;
  }
  return res;
}

describe("api/wholesale-estimate-disclaimer.js: public, no session cookie required, no access-code/price leakage", () => {
  it("returns 200 with no Authorization/cookie at all", async () => {
    const fake = createFakeSupabase();
    seedPublishedDisclaimer(fake);
    const res = await callHandler(documentsHandler, fake, mockReq({ method: "GET", headers: {} }));
    expect(res.statusCode).toBe(200);
  });

  it("returns version/content_en/content_es/content_hash/published_at — never storage/internal fields, never a price/code", async () => {
    const fake = createFakeSupabase();
    const doc = seedPublishedDisclaimer(fake);
    const res = await callHandler(documentsHandler, fake, mockReq({ method: "GET" }));
    expect(res.body.version).toBe(doc.version);
    expect(res.body.content_en.body).toBe(doc.content_en.body);
    expect(res.body.content_hash).toBe(doc.content_hash);
    // Real internal field names only — not a bare "price" check, since the
    // disclaimer's own legitimate body text talks about prices/estimates.
    expect(JSON.stringify(res.body)).not.toMatch(/code_hash|fixed_price|price_min|price_max|storage_path/i);
  });

  it("sets Cache-Control: no-store", async () => {
    const fake = createFakeSupabase();
    seedPublishedDisclaimer(fake);
    const res = await callHandler(documentsHandler, fake, mockReq({ method: "GET" }));
    expect(res.headers["Cache-Control"]).toMatch(/no-store/);
  });

  it("404s when nothing published yet — never leaks a draft/superseded row", async () => {
    const fake = createFakeSupabase();
    seedPublishedDisclaimer(fake, { id: "draft-x", status: "draft", published_at: null });
    const res = await callHandler(documentsHandler, fake, mockReq({ method: "GET" }));
    expect(res.statusCode).toBe(404);
  });

  it("ignores a published master_agreement row entirely — never crosses document types", async () => {
    const fake = createFakeSupabase();
    fake.db.wholesale_legal_documents.push({
      id: "master-x", document_type: "master_agreement", version: "1.0", status: "published",
      content_en: {}, content_es: {}, content_hash: "h", published_at: new Date().toISOString(),
    });
    const res = await callHandler(documentsHandler, fake, mockReq({ method: "GET" }));
    expect(res.statusCode).toBe(404);
  });

  it("rejects non-GET", async () => {
    const fake = createFakeSupabase();
    const res = await callHandler(documentsHandler, fake, mockReq({ method: "POST" }));
    expect(res.statusCode).toBe(405);
  });
});

describe("api/wholesale-accept-estimate-disclaimer.js: requires a valid session, single checkbox, no direct-API bypass", () => {
  it("401 with no session cookie — direct API access without authentication is rejected", async () => {
    const fake = createFakeSupabase();
    const res = await callHandler(acceptHandler, fake, mockReq({ method: "POST", headers: {}, body: { legalDocumentId: "x", accepted: true, locale: "en" } }));
    expect(res.statusCode).toBe(401);
  });

  it("400 checkbox_required when accepted is not exactly true (false, missing, or a truthy non-boolean)", async () => {
    const fake = createFakeSupabase();
    seedShopDeviceSession(fake);
    const doc = seedPublishedDisclaimer(fake);
    for (const bad of [false, undefined, "true", 1]) {
      const res = await callHandler(
        acceptHandler, fake,
        mockReq({ method: "POST", headers: { cookie: "ws_session=live-session-token" }, body: { legalDocumentId: doc.id, accepted: bad, locale: "en" } })
      );
      expect(res.statusCode, `accepted=${JSON.stringify(bad)} should be rejected`).toBe(400);
    }
    expect(fake.db.wholesale_estimate_disclaimer_acceptances).toHaveLength(0);
  });

  it("400 invalid_request for a missing legalDocumentId or an invalid locale", async () => {
    const fake = createFakeSupabase();
    seedShopDeviceSession(fake);
    const doc = seedPublishedDisclaimer(fake);
    const noDocId = await callHandler(acceptHandler, fake, mockReq({ method: "POST", headers: { cookie: "ws_session=live-session-token" }, body: { accepted: true, locale: "en" } }));
    expect(noDocId.statusCode).toBe(400);
    const badLocale = await callHandler(acceptHandler, fake, mockReq({ method: "POST", headers: { cookie: "ws_session=live-session-token" }, body: { legalDocumentId: doc.id, accepted: true, locale: "fr" } }));
    expect(badLocale.statusCode).toBe(400);
  });

  it("409 document_superseded when legalDocumentId doesn't match the currently published estimate_disclaimer", async () => {
    const fake = createFakeSupabase();
    seedShopDeviceSession(fake);
    seedPublishedDisclaimer(fake, { id: "old-doc", status: "superseded" });
    seedPublishedDisclaimer(fake, { id: "new-doc" });
    const res = await callHandler(
      acceptHandler, fake,
      mockReq({ method: "POST", headers: { cookie: "ws_session=live-session-token" }, body: { legalDocumentId: "old-doc", accepted: true, locale: "en" } })
    );
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe("document_superseded");
  });

  it("409 document_superseded when legalDocumentId belongs to a master_agreement document — cannot accept the wrong type through this endpoint", async () => {
    const fake = createFakeSupabase();
    seedShopDeviceSession(fake);
    fake.db.wholesale_legal_documents.push({
      id: "master-doc", document_type: "master_agreement", version: "1.0", status: "published",
      content_en: {}, content_es: {}, content_hash: "h", published_at: new Date().toISOString(),
    });
    const res = await callHandler(
      acceptHandler, fake,
      mockReq({ method: "POST", headers: { cookie: "ws_session=live-session-token" }, body: { legalDocumentId: "master-doc", accepted: true, locale: "en" } })
    );
    expect(res.statusCode).toBe(409);
  });

  it("success: records the acceptance with the correct content_hash snapshot and no representative name/title fields, logs estimate_disclaimer_accepted", async () => {
    const fake = createFakeSupabase();
    const { shopId, deviceId } = seedShopDeviceSession(fake);
    const doc = seedPublishedDisclaimer(fake);
    const res = await callHandler(
      acceptHandler, fake,
      mockReq({ method: "POST", headers: { cookie: "ws_session=live-session-token" }, body: { legalDocumentId: doc.id, accepted: true, locale: "es" } })
    );
    expect(res.statusCode).toBe(200);
    expect(fake.db.wholesale_estimate_disclaimer_acceptances).toHaveLength(1);
    const row = fake.db.wholesale_estimate_disclaimer_acceptances[0];
    expect(row.shop_id).toBe(shopId);
    expect(row.device_id).toBe(deviceId);
    expect(row.content_hash).toBe(doc.content_hash);
    expect(row.locale).toBe("es");
    expect(row.representative_name).toBeUndefined();
    expect(fake.db.wholesale_access_log.some((e) => e.event === "estimate_disclaimer_accepted")).toBe(true);
  });

  it("403 access_revoked when the shop is blocked mid-flow", async () => {
    const fake = createFakeSupabase();
    const { shopId } = seedShopDeviceSession(fake);
    const doc = seedPublishedDisclaimer(fake);
    fake.db.wholesale_shops.find((s) => s.id === shopId).status = "blocked";
    const res = await callHandler(
      acceptHandler, fake,
      mockReq({ method: "POST", headers: { cookie: "ws_session=live-session-token" }, body: { legalDocumentId: doc.id, accepted: true, locale: "en" } })
    );
    expect(res.statusCode).toBe(403);
  });

  it("rejects non-POST", async () => {
    const fake = createFakeSupabase();
    const res = await callHandler(acceptHandler, fake, mockReq({ method: "GET" }));
    expect(res.statusCode).toBe(405);
  });
});
