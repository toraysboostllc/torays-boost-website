import { describe, it, expect, afterEach, vi } from "vitest";
import {
  fetchWholesaleCatalog,
  fetchWholesaleLegalDocuments,
  acceptWholesaleLegalTerms,
} from "../src/lib/wholesaleAuth.js";

function stubFetch(impl) {
  vi.stubGlobal("fetch", impl);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Regression coverage mirroring wholesaleAuthFetch.test.js's existing
 *  "kind" classification suite — extended for the new legal-acceptance gate.
 *  "legal_required" must be its OWN kind, distinct from "auth": both are
 *  403s, but the frontend has to do something completely different with
 *  each (show the clickwrap modal vs. redirect to /wholesale). */
describe("fetchWholesaleCatalog: kind: 'legal_required' on 403 + error: 'legal_acceptance_required'", () => {
  it("classifies as 'legal_required', not 'auth', and carries legalDocumentId/version through", async () => {
    stubFetch(async () => ({
      ok: false,
      status: 403,
      json: async () => ({
        error: "legal_acceptance_required",
        legalDocumentId: "doc-123",
        version: "1.0",
        message: "Please review and accept the Torays Boost Pro legal terms to continue.",
      }),
    }));
    const result = await fetchWholesaleCatalog();
    expect(result.ok).toBe(false);
    expect(result.kind).toBe("legal_required");
    expect(result.legalDocumentId).toBe("doc-123");
    expect(result.version).toBe("1.0");
  });

  it("a plain 403 with no error field (access revoked) still classifies as 'auth' — the existing behavior is untouched", async () => {
    stubFetch(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ message: "Access to wholesale pricing has been revoked." }),
    }));
    const result = await fetchWholesaleCatalog();
    expect(result.kind).toBe("auth");
  });

  it("a 403 with an unrelated error string still classifies as 'auth', never 'legal_required'", async () => {
    stubFetch(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: "shop_blocked", message: "Blocked." }),
    }));
    const result = await fetchWholesaleCatalog();
    expect(result.kind).toBe("auth");
  });
});

describe("fetchWholesaleLegalDocuments: public GET wrapper", () => {
  it("returns ok:true with the 6-key content and metadata on 200", async () => {
    stubFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        version: "1.0",
        content_en: { access_agreement: { title: "x", body: "y" } },
        content_es: { access_agreement: { title: "x", body: "y" } },
        content_hash: "hash-1",
        published_at: "2026-01-01T00:00:00.000Z",
      }),
    }));
    const result = await fetchWholesaleLegalDocuments();
    expect(result.ok).toBe(true);
    expect(result.version).toBe("1.0");
    expect(result.content_hash).toBe("hash-1");
  });

  it("returns ok:false with a message on 404 (nothing published yet)", async () => {
    stubFetch(async () => ({ ok: false, status: 404, json: async () => ({ error: "not_found", message: "None yet." }) }));
    const result = await fetchWholesaleLegalDocuments();
    expect(result.ok).toBe(false);
    expect(result.message).toBe("None yet.");
  });

  it("never throws when fetch itself throws (offline)", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    const result = await fetchWholesaleLegalDocuments();
    expect(result.ok).toBe(false);
  });

  it("sends credentials: same-origin, consistent with every other wholesale API call", async () => {
    let capturedInit;
    stubFetch(async (url, init) => {
      capturedInit = init;
      return { ok: true, status: 200, json: async () => ({ content_en: {}, content_es: {} }) };
    });
    await fetchWholesaleLegalDocuments();
    expect(capturedInit.credentials).toBe("same-origin");
  });
});

describe("acceptWholesaleLegalTerms: POST wrapper", () => {
  it("posts the exact payload shape the API expects, unchanged", async () => {
    let capturedBody;
    stubFetch(async (url, init) => {
      capturedBody = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => ({ status: "ok" }) };
    });
    const checkboxes = {
      confirmsAuthority: true,
      acceptsTermsPrivacy: true,
      understandsTiersOptional: true,
      understandsIndependentPricing: true,
      acceptsConfidentiality: true,
    };
    await acceptWholesaleLegalTerms({
      legalDocumentId: "doc-1",
      representativeName: "Jane Doe",
      representativeTitle: "Owner",
      checkboxes,
      locale: "en",
    });
    expect(capturedBody).toEqual({
      legalDocumentId: "doc-1",
      representativeName: "Jane Doe",
      representativeTitle: "Owner",
      checkboxes,
      locale: "en",
    });
  });

  it("returns ok:true on 200", async () => {
    stubFetch(async () => ({ ok: true, status: 200, json: async () => ({ status: "ok" }) }));
    const result = await acceptWholesaleLegalTerms({
      legalDocumentId: "doc-1",
      representativeName: "Jane Doe",
      representativeTitle: "Owner",
      checkboxes: {},
      locale: "en",
    });
    expect(result.ok).toBe(true);
  });

  it("returns ok:false with the server's error code on a 400 rejection", async () => {
    stubFetch(async () => ({ ok: false, status: 400, json: async () => ({ error: "all_boxes_required", message: "All 5 checkboxes must be accepted." }) }));
    const result = await acceptWholesaleLegalTerms({
      legalDocumentId: "doc-1",
      representativeName: "Jane Doe",
      representativeTitle: "Owner",
      checkboxes: {},
      locale: "en",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("all_boxes_required");
  });
});
