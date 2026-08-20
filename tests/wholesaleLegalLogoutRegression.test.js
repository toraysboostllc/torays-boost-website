import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createFakeSupabase, mockReq, mockRes } from "./fakeSupabase.js";
import { sha256Hex } from "../api/_lib/wholesaleDb.js";
import logoutHandler from "../api/wholesale-logout.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const logoutSrc = readFileSync(join(root, "api/wholesale-logout.js"), "utf8");

let fake;

beforeEach(() => {
  process.env.SUPABASE_URL = "https://fake.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role-key";
  fake = createFakeSupabase();
  vi.stubGlobal("fetch", fake.fakeFetch);
});

function seedActiveSession(token = "live-session-token") {
  const shopId = fake.nextId();
  const deviceId = fake.nextId();
  fake.db.wholesale_shops.push({ id: shopId, name: "Test Shop", status: "active", code_hash: "x", failed_attempts: 0 });
  fake.db.wholesale_devices.push({ id: deviceId, shop_id: shopId, device_token_hash: "dev-hash", status: "approved" });
  fake.db.wholesale_sessions.push({
    id: fake.nextId(),
    shop_id: shopId,
    device_id: deviceId,
    session_token_hash: sha256Hex(token),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    revoked_at: null,
  });
  return { shopId, deviceId };
}

/**
 * Explicit regression coverage requested for the legal-acceptance feature:
 * a Shop that is blocked from the catalog by a missing legal acceptance
 * (wholesale-prices.js's 403 legal_acceptance_required — see
 * wholesaleLegalAcceptanceGate.test.js) must still be able to log out at
 * any time. The clickwrap modal's ONLY other control besides Accept is
 * Logout — if this endpoint were ever accidentally coupled to acceptance
 * status, a Shop stuck at the clickwrap screen would have zero working
 * escape hatch.
 */
describe("api/wholesale-logout.js: unaffected by legal-acceptance status", () => {
  it("logs out successfully even when a legal document is published and the shop has never accepted it", async () => {
    seedActiveSession("live-session-token");
    fake.db.wholesale_legal_documents.push({
      id: fake.nextId(),
      version: "1.0",
      status: "published",
      content_en: {},
      content_es: {},
      content_hash: "hash-1",
      published_at: new Date().toISOString(),
    });
    // Deliberately zero rows in wholesale_legal_acceptances.

    const req = mockReq({ method: "POST", headers: { cookie: "ws_session=live-session-token" } });
    const res = mockRes();
    await logoutHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("actually revokes the session (not just a 200 status) regardless of acceptance status", async () => {
    seedActiveSession("live-session-token");
    fake.db.wholesale_legal_documents.push({
      id: fake.nextId(), version: "1.0", status: "published",
      content_en: {}, content_es: {}, content_hash: "h", published_at: new Date().toISOString(),
    });

    const req = mockReq({ method: "POST", headers: { cookie: "ws_session=live-session-token" } });
    const res = mockRes();
    await logoutHandler(req, res);

    const session = fake.db.wholesale_sessions.find((s) => s.session_token_hash === sha256Hex("live-session-token"));
    expect(session.revoked_at).toBeTruthy();
  });

  it("clears the ws_session cookie regardless of acceptance status", async () => {
    seedActiveSession("live-session-token");
    fake.db.wholesale_legal_documents.push({
      id: fake.nextId(), version: "1.0", status: "published",
      content_en: {}, content_es: {}, content_hash: "h", published_at: new Date().toISOString(),
    });

    const req = mockReq({ method: "POST", headers: { cookie: "ws_session=live-session-token" } });
    const res = mockRes();
    await logoutHandler(req, res);

    expect(res.headers["Set-Cookie"]).toMatch(/^ws_session=;/);
  });

  it("succeeds even with no session cookie at all — logout is never a hard failure", async () => {
    const req = mockReq({ method: "POST", headers: {} });
    const res = mockRes();
    await logoutHandler(req, res);
    expect(res.statusCode).toBe(200);
  });
});

describe("api/wholesale-logout.js source: never references legal acceptance at all", () => {
  it("does not import or query wholesale_legal_documents / wholesale_legal_acceptances / getPublishedLegalDocument / hasAcceptedLegalDocument", () => {
    expect(logoutSrc).not.toMatch(/wholesale_legal_documents|wholesale_legal_acceptances|getPublishedLegalDocument|hasAcceptedLegalDocument/);
  });
});
