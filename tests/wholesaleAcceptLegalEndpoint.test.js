import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeSupabase, mockReq, mockRes } from "./fakeSupabase.js";
import { sha256Hex } from "../api/_lib/wholesaleDb.js";
import acceptHandler from "../api/wholesale-accept-legal.js";

let fake;

beforeEach(() => {
  process.env.SUPABASE_URL = "https://fake.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role-key";
  fake = createFakeSupabase();
  vi.stubGlobal("fetch", fake.fakeFetch);
});

function seedApprovedShopAndDevice() {
  const shopId = fake.nextId();
  const deviceId = fake.nextId();
  fake.db.wholesale_shops.push({ id: shopId, name: "Test Shop", status: "active", code_hash: "x", failed_attempts: 0 });
  fake.db.wholesale_devices.push({ id: deviceId, shop_id: shopId, device_token_hash: "dev-hash", status: "approved" });
  fake.db.wholesale_sessions.push({
    id: fake.nextId(),
    shop_id: shopId,
    device_id: deviceId,
    session_token_hash: sha256Hex("live-session-token"),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    revoked_at: null,
  });
  return { shopId, deviceId };
}

function seedPublishedDoc(overrides = {}) {
  const doc = {
    id: fake.nextId(),
    document_type: "master_agreement",
    version: "1.0",
    status: "published",
    content_en: {},
    content_es: {},
    content_hash: "hash-1",
    published_at: new Date().toISOString(),
    ...overrides,
  };
  fake.db.wholesale_legal_documents.push(doc);
  return doc;
}

const VALID_CHECKBOXES = {
  confirmsAuthority: true,
  acceptsTermsPrivacy: true,
  understandsTiersOptional: true,
  understandsIndependentPricing: true,
  acceptsConfidentiality: true,
};

async function callAccept(body, { cookie = "ws_session=live-session-token" } = {}) {
  const req = mockReq({ method: "POST", body, headers: { cookie } });
  const res = mockRes();
  await acceptHandler(req, res);
  return res;
}

describe("POST /api/wholesale-accept-legal: session required", () => {
  it("401s with no ws_session cookie", async () => {
    seedApprovedShopAndDevice();
    const doc = seedPublishedDoc();
    const res = await callAccept(
      { legalDocumentId: doc.id, representativeName: "Jane Doe", representativeTitle: "Owner", checkboxes: VALID_CHECKBOXES, locale: "en" },
      { cookie: "" }
    );
    expect(res.statusCode).toBe(401);
  });
});

describe("POST /api/wholesale-accept-legal: rejects an incomplete checkbox set", () => {
  it("400s all_boxes_required when one of the 5 is false", async () => {
    seedApprovedShopAndDevice();
    const doc = seedPublishedDoc();
    const res = await callAccept({
      legalDocumentId: doc.id,
      representativeName: "Jane Doe",
      representativeTitle: "Owner",
      checkboxes: { ...VALID_CHECKBOXES, acceptsConfidentiality: false },
      locale: "en",
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("all_boxes_required");
  });

  it("400s all_boxes_required when a checkbox key is entirely missing from the body", async () => {
    seedApprovedShopAndDevice();
    const doc = seedPublishedDoc();
    const { acceptsConfidentiality, ...missingOne } = VALID_CHECKBOXES;
    const res = await callAccept({
      legalDocumentId: doc.id,
      representativeName: "Jane Doe",
      representativeTitle: "Owner",
      checkboxes: missingOne,
      locale: "en",
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("all_boxes_required");
  });

  it("400s when a checkbox is a truthy non-boolean (e.g. the string 'true') — only === true counts", async () => {
    seedApprovedShopAndDevice();
    const doc = seedPublishedDoc();
    const res = await callAccept({
      legalDocumentId: doc.id,
      representativeName: "Jane Doe",
      representativeTitle: "Owner",
      checkboxes: { ...VALID_CHECKBOXES, acceptsConfidentiality: "true" },
      locale: "en",
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("all_boxes_required");
  });

  it("never even reaches the RPC when checkboxes are incomplete — no acceptance row is written", async () => {
    seedApprovedShopAndDevice();
    const doc = seedPublishedDoc();
    await callAccept({
      legalDocumentId: doc.id,
      representativeName: "Jane Doe",
      representativeTitle: "Owner",
      checkboxes: { ...VALID_CHECKBOXES, confirmsAuthority: false },
      locale: "en",
    });
    expect(fake.db.wholesale_legal_acceptances).toHaveLength(0);
  });
});

describe("POST /api/wholesale-accept-legal: rejects empty representative name/title", () => {
  it("400s on an empty (or whitespace-only) representativeName", async () => {
    seedApprovedShopAndDevice();
    const doc = seedPublishedDoc();
    const res = await callAccept({
      legalDocumentId: doc.id,
      representativeName: "   ",
      representativeTitle: "Owner",
      checkboxes: VALID_CHECKBOXES,
      locale: "en",
    });
    expect(res.statusCode).toBe(400);
  });

  it("400s on a missing representativeTitle", async () => {
    seedApprovedShopAndDevice();
    const doc = seedPublishedDoc();
    const res = await callAccept({
      legalDocumentId: doc.id,
      representativeName: "Jane Doe",
      checkboxes: VALID_CHECKBOXES,
      locale: "en",
    });
    expect(res.statusCode).toBe(400);
  });

  it("400s on a representativeName over 200 characters", async () => {
    seedApprovedShopAndDevice();
    const doc = seedPublishedDoc();
    const res = await callAccept({
      legalDocumentId: doc.id,
      representativeName: "x".repeat(201),
      representativeTitle: "Owner",
      checkboxes: VALID_CHECKBOXES,
      locale: "en",
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /api/wholesale-accept-legal: legalDocumentId must match the currently published version", () => {
  it("409s document_superseded when legalDocumentId points at a superseded/unknown document", async () => {
    seedApprovedShopAndDevice();
    seedPublishedDoc({ id: "current-doc" });
    const res = await callAccept({
      legalDocumentId: "stale-doc-id-from-an-old-tab",
      representativeName: "Jane Doe",
      representativeTitle: "Owner",
      checkboxes: VALID_CHECKBOXES,
      locale: "en",
    });
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe("document_superseded");
  });

  it("400s invalid_request when legalDocumentId is missing entirely", async () => {
    seedApprovedShopAndDevice();
    seedPublishedDoc();
    const res = await callAccept({
      representativeName: "Jane Doe",
      representativeTitle: "Owner",
      checkboxes: VALID_CHECKBOXES,
      locale: "en",
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /api/wholesale-accept-legal: success path", () => {
  it("200s and records a real acceptance row with all fields", async () => {
    const { shopId, deviceId } = seedApprovedShopAndDevice();
    const doc = seedPublishedDoc();

    const res = await callAccept({
      legalDocumentId: doc.id,
      representativeName: "  Jane Doe  ",
      representativeTitle: "  Owner  ",
      checkboxes: VALID_CHECKBOXES,
      locale: "en",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(fake.db.wholesale_legal_acceptances).toHaveLength(1);
    const row = fake.db.wholesale_legal_acceptances[0];
    expect(row.shop_id).toBe(shopId);
    expect(row.device_id).toBe(deviceId);
    expect(row.legal_document_id).toBe(doc.id);
    // Trimmed server-side, same as the DB function's own btrim().
    expect(row.representative_name).toBe("Jane Doe");
    expect(row.representative_title).toBe("Owner");
    expect(row.content_hash).toBe(doc.content_hash);
    expect(row.locale).toBe("en");
  });

  it("subsequent wholesale-prices.js calls now succeed after a real acceptance is recorded", async () => {
    seedApprovedShopAndDevice();
    const doc = seedPublishedDoc();
    const res = await callAccept({
      legalDocumentId: doc.id,
      representativeName: "Jane Doe",
      representativeTitle: "Owner",
      checkboxes: VALID_CHECKBOXES,
      locale: "en",
    });
    expect(res.statusCode).toBe(200);

    const { default: pricesHandler } = await import("../api/wholesale-prices.js");
    const pricesReq = mockReq({ method: "GET", headers: { cookie: "ws_session=live-session-token" } });
    const pricesRes = mockRes();
    await pricesHandler(pricesReq, pricesRes);
    expect(pricesRes.statusCode).toBe(200);
  });
});

describe("POST /api/wholesale-accept-legal: shop must be active", () => {
  it("403s when the shop was blocked between session issuance and this call", async () => {
    const { shopId } = seedApprovedShopAndDevice();
    const doc = seedPublishedDoc();
    fake.db.wholesale_shops.find((s) => s.id === shopId).status = "blocked";

    const res = await callAccept({
      legalDocumentId: doc.id,
      representativeName: "Jane Doe",
      representativeTitle: "Owner",
      checkboxes: VALID_CHECKBOXES,
      locale: "en",
    });
    expect(res.statusCode).toBe(403);
  });
});
