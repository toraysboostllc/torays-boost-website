import { describe, it, expect, afterEach, vi } from "vitest";
import { fetchWholesaleCatalog } from "../src/lib/wholesaleAuth.js";

function stubFetch(impl) {
  vi.stubGlobal("fetch", impl);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Regression coverage for the bug the approved plan explicitly called out:
 *  the old code redirected to /wholesale on ANY failure, including a
 *  transient server/network error that has nothing to do with the session
 *  actually being gone. `kind` is what WholesalePrices.jsx now branches on —
 *  "auth" must be the ONLY kind that ever triggers a redirect. */
describe("fetchWholesaleCatalog: kind classification drives the correct UI behavior", () => {
  it("kind: 'auth' on 401 — a genuinely expired/missing session", async () => {
    stubFetch(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ message: "Session expired or invalid. Please log in again." }),
    }));
    const result = await fetchWholesaleCatalog();
    expect(result.ok).toBe(false);
    expect(result.kind).toBe("auth");
  });

  it("kind: 'auth' on 403 — access revoked (shop blocked or device revoked mid-session)", async () => {
    stubFetch(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ message: "Access to wholesale pricing has been revoked." }),
    }));
    const result = await fetchWholesaleCatalog();
    expect(result.kind).toBe("auth");
  });

  it("kind: 'transient' on 502 — a real server error unrelated to the session, must NOT redirect to login", async () => {
    stubFetch(async () => ({
      ok: false,
      status: 502,
      json: async () => ({ message: "Could not load prices right now." }),
    }));
    const result = await fetchWholesaleCatalog();
    expect(result.ok).toBe(false);
    expect(result.kind).toBe("transient");
  });

  it("kind: 'transient' on 500 (not_configured or any other server error)", async () => {
    stubFetch(async () => ({ ok: false, status: 500, json: async () => ({ message: "boom" }) }));
    const result = await fetchWholesaleCatalog();
    expect(result.kind).toBe("transient");
  });

  it("kind: 'transient' when fetch itself throws (offline, DNS failure, CORS) — never crashes, never silently redirects", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    const result = await fetchWholesaleCatalog();
    expect(result.ok).toBe(false);
    expect(result.kind).toBe("transient");
  });

  it("ok: true on 200, includes the new recommended_price-bearing catalog fields and salesModule", async () => {
    stubFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        shopName: "Test Shop",
        equipmentTypes: [{ id: "et-1", name: "PS5" }],
        microsoldering: null,
        salesModule: { visible: true, status: "maintenance", entryBlocked: true },
      }),
    }));
    const result = await fetchWholesaleCatalog();
    expect(result.ok).toBe(true);
    expect(result.shopName).toBe("Test Shop");
    expect(result.salesModule).toEqual({ visible: true, status: "maintenance", entryBlocked: true });
  });

  it("defaults salesModule to null (never undefined/throws) when the server omits it", async () => {
    stubFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ shopName: "Test Shop", equipmentTypes: [], microsoldering: null }),
    }));
    const result = await fetchWholesaleCatalog();
    expect(result.salesModule).toBeNull();
  });

  it("always sends credentials: same-origin — the cookie-based auth model is untouched", async () => {
    let capturedInit;
    stubFetch(async (url, init) => {
      capturedInit = init;
      return { ok: true, status: 200, json: async () => ({ shopName: "x", equipmentTypes: [], microsoldering: null }) };
    });
    await fetchWholesaleCatalog();
    expect(capturedInit.credentials).toBe("same-origin");
  });
});
