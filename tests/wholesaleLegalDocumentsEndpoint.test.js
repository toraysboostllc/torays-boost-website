import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeSupabase, mockReq, mockRes } from "./fakeSupabase.js";
import handler from "../api/wholesale-legal-documents.js";

const CONTENT_KEYS = [
  "access_agreement",
  "pricing_policy",
  "pricing_disclaimer",
  "privacy_security",
  "repair_warranty_terms",
  "econsent_disclosure",
];

function fullContent(marker) {
  return Object.fromEntries(CONTENT_KEYS.map((k) => [k, { title: `${k} ${marker}`, body: `body for ${k}` }]));
}

let fake;

beforeEach(() => {
  process.env.SUPABASE_URL = "https://fake.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role-key";
  fake = createFakeSupabase();
  vi.stubGlobal("fetch", fake.fakeFetch);
});

function seedPublished() {
  const doc = {
    id: fake.nextId(),
    version: "1.0",
    status: "published",
    content_en: fullContent("en"),
    content_es: fullContent("es"),
    content_hash: "hash-1",
    published_at: new Date().toISOString(),
  };
  fake.db.wholesale_legal_documents.push(doc);
  return doc;
}

describe("api/wholesale-legal-documents.js: public, no session cookie required", () => {
  it("returns 200 with no Authorization/cookie of any kind on the request", async () => {
    seedPublished();
    const req = mockReq({ method: "GET", headers: {} }); // deliberately no cookie header at all
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it("still works when a stale/garbage cookie header is present — this endpoint never reads it", async () => {
    seedPublished();
    const req = mockReq({ method: "GET", headers: { cookie: "ws_session=totally-invalid-garbage" } });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  it("returns exactly the 6 expected content keys, in both content_en and content_es", async () => {
    seedPublished();
    const res = mockRes();
    await handler(mockReq({ method: "GET" }), res);

    expect(Object.keys(res.body.content_en).sort()).toEqual([...CONTENT_KEYS].sort());
    expect(Object.keys(res.body.content_es).sort()).toEqual([...CONTENT_KEYS].sort());
  });

  it("returns version, content_hash, and published_at alongside the content", async () => {
    const doc = seedPublished();
    const res = mockRes();
    await handler(mockReq({ method: "GET" }), res);

    expect(res.body.version).toBe(doc.version);
    expect(res.body.content_hash).toBe(doc.content_hash);
    expect(res.body.published_at).toBe(doc.published_at);
  });

  it("sets Cache-Control to never cache (no-store)", async () => {
    seedPublished();
    const res = mockRes();
    await handler(mockReq({ method: "GET" }), res);
    expect(res.headers["Cache-Control"]).toMatch(/no-store/);
  });

  it("404s with a clear error when nothing has ever been published yet", async () => {
    const res = mockRes();
    await handler(mockReq({ method: "GET" }), res);
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe("not_found");
  });

  it("ignores a draft/superseded row — only status='published' is ever returned", async () => {
    fake.db.wholesale_legal_documents.push({
      id: fake.nextId(),
      version: "0.9-draft",
      status: "draft",
      content_en: fullContent("en"),
      content_es: fullContent("es"),
      content_hash: "hash-draft",
      published_at: null,
    });
    const res = mockRes();
    await handler(mockReq({ method: "GET" }), res);
    expect(res.statusCode).toBe(404);
  });

  it("rejects non-GET methods", async () => {
    const res = mockRes();
    await handler(mockReq({ method: "POST" }), res);
    expect(res.statusCode).toBe(405);
  });
});
