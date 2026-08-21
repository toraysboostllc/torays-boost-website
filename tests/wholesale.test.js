import { describe, it, expect, beforeEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import { createFakeSupabase, mockReq, mockRes, extractCookie } from "./fakeSupabase.js";
import { sha256Hex } from "../api/_lib/wholesaleDb.js";

import loginHandler from "../api/wholesale-login.js";
import pricesHandler from "../api/wholesale-prices.js";
import logoutHandler from "../api/wholesale-logout.js";

const PLAIN_CODE = "SECRET123";

let fake;

beforeEach(() => {
  process.env.SUPABASE_URL = "https://fake.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role-key";
  fake = createFakeSupabase();
  vi.stubGlobal("fetch", fake.fakeFetch);
});

function seedShop(overrides = {}) {
  const shop = {
    id: fake.nextId(),
    name: "Acme Repair",
    code_hash: bcrypt.hashSync(PLAIN_CODE, 4), // low cost factor — tests don't need production hardness, just correctness
    status: "active",
    failed_attempts: 0,
    locked_until: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
  fake.db.wholesale_shops.push(shop);
  return shop;
}

function seedApprovedDevice(shopId, deviceToken) {
  const device = {
    id: fake.nextId(),
    shop_id: shopId,
    device_token_hash: sha256Hex(deviceToken),
    status: "approved",
    first_seen_at: new Date().toISOString(),
    approved_at: new Date().toISOString(),
  };
  fake.db.wholesale_devices.push(device);
  return device;
}

describe("wholesale-login: correct login", () => {
  it("issues a 30-day session for an already-approved device", async () => {
    const shop = seedShop();
    seedApprovedDevice(shop.id, "known-device-token");

    const req = mockReq({
      method: "POST",
      body: { shopName: "Acme Repair", code: PLAIN_CODE },
      headers: { cookie: "ws_device=known-device-token" },
    });
    const res = mockRes();
    await loginHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("ok");
    const sessionCookie = extractCookie(res.headers["Set-Cookie"], "ws_session");
    expect(sessionCookie).toBeTruthy();

    const session = fake.db.wholesale_sessions[0];
    expect(session).toBeTruthy();
    const daysUntilExpiry = (new Date(session.expires_at) - Date.now()) / (1000 * 60 * 60 * 24);
    expect(daysUntilExpiry).toBeGreaterThan(29.9);
    expect(daysUntilExpiry).toBeLessThan(30.1);
  });

  it("sets Cache-Control: private, no-store and X-Robots-Tag noindex", async () => {
    const shop = seedShop();
    seedApprovedDevice(shop.id, "known-device-token");
    const req = mockReq({
      method: "POST",
      body: { shopName: "Acme Repair", code: PLAIN_CODE },
      headers: { cookie: "ws_device=known-device-token" },
    });
    const res = mockRes();
    await loginHandler(req, res);
    expect(res.headers["Cache-Control"]).toBe("private, no-store");
    expect(res.headers["X-Robots-Tag"]).toBe("noindex, nofollow, noarchive");
  });
});

describe("wholesale-login: incorrect code", () => {
  it("rejects with a generic message and increments failed_attempts", async () => {
    const shop = seedShop();
    const req = mockReq({ method: "POST", body: { shopName: "Acme Repair", code: "wrong-code" } });
    const res = mockRes();
    await loginHandler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Invalid shop name or code.");
    expect(fake.db.wholesale_shops[0].failed_attempts).toBe(1);
  });

  it("gives the same message for an unknown shop name (no enumeration)", async () => {
    const req = mockReq({ method: "POST", body: { shopName: "Nonexistent Shop", code: "whatever" } });
    const res = mockRes();
    await loginHandler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Invalid shop name or code.");
  });
});

describe("wholesale-login: code normalization (trim + uppercase) matches DESK's stored hash", () => {
  it.each([
    ["SECRET123", "exact match"],
    ["secret123", "lowercase"],
    ["SeCrEt123", "mixed case"],
    ["  SECRET123  ", "external whitespace"],
    ["  secret123  ", "lowercase with external whitespace"],
  ])("authenticates with %s (%s)", async (submittedCode) => {
    const shop = seedShop();
    seedApprovedDevice(shop.id, "known-device-token");
    const req = mockReq({
      method: "POST",
      body: { shopName: "Acme Repair", code: submittedCode },
      headers: { cookie: "ws_device=known-device-token" },
    });
    const res = mockRes();
    await loginHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("still rejects a code containing characters other than letters/numbers — never matches any real hash", async () => {
    seedShop();
    const req = mockReq({ method: "POST", body: { shopName: "Acme Repair", code: "SECRET-123!" } });
    const res = mockRes();
    await loginHandler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Invalid shop name or code.");
  });

  it("an all-whitespace code normalizes to empty and is rejected as a missing field (400), not a credentials failure", async () => {
    seedShop();
    const req = mockReq({ method: "POST", body: { shopName: "Acme Repair", code: "   " } });
    const res = mockRes();
    await loginHandler(req, res);
    expect(res.statusCode).toBe(400);
  });
});

describe("wholesale-login: unknown shop and wrong code stay indistinguishable", () => {
  it("produce byte-for-byte identical error responses", async () => {
    seedShop();
    const resUnknownShop = mockRes();
    await loginHandler(mockReq({ method: "POST", body: { shopName: "Nonexistent Shop", code: "whatever1" } }), resUnknownShop);

    const resWrongCode = mockRes();
    await loginHandler(mockReq({ method: "POST", body: { shopName: "Acme Repair", code: "wrongcode1" } }), resWrongCode);

    expect(resUnknownShop.statusCode).toBe(resWrongCode.statusCode);
    expect(resUnknownShop.body).toEqual(resWrongCode.body);
  });
});

describe("wholesale-login: a genuine Supabase failure is never reported as invalid credentials", () => {
  it("returns 503 service_unavailable (not 401) when the shop-lookup fetch itself fails (network error)", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("ECONNREFUSED 10.0.0.1:5432 — internal-db-host.example"))));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const req = mockReq({ method: "POST", body: { shopName: "Acme Repair", code: "SECRET123" } });
    const res = mockRes();
    await loginHandler(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.error).toBe("service_unavailable");
    expect(res.body.message).not.toMatch(/invalid/i);

    errorSpy.mockRestore();
  });

  it("returns 503 (not 401) when Supabase answers the shop lookup with a non-2xx status", async () => {
    vi.stubGlobal("fetch", async (url, options) => {
      const u = new URL(url);
      if (u.pathname === "/rest/v1/wholesale_shops") {
        return {
          ok: false,
          status: 500,
          text: async () => "internal Supabase detail: connection string postgres://user:pass@host/db, table wholesale_shops",
          json: async () => ({}),
        };
      }
      return fake.fakeFetch(url, options);
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const req = mockReq({ method: "POST", body: { shopName: "Acme Repair", code: "SECRET123" } });
    const res = mockRes();
    await loginHandler(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.error).toBe("service_unavailable");
    errorSpy.mockRestore();
  });

  it("never leaks the underlying error detail, URL, or credentials into the JSON response or server logs", async () => {
    const secretDetail = "postgres://admin:s3cr3tPass@internal-db.example.com/wholesale — service_role JWT eyJhbGciOiJIUzI1NiJ9";
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error(secretDetail))));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const req = mockReq({ method: "POST", body: { shopName: "Acme Repair", code: "SECRET123" } });
    const res = mockRes();
    await loginHandler(req, res);

    const responseText = JSON.stringify(res.body);
    expect(responseText).not.toContain(secretDetail);
    expect(responseText).not.toContain("postgres://");
    expect(responseText).not.toContain("service_role");

    for (const call of errorSpy.mock.calls) {
      const logged = call.join(" ");
      expect(logged).not.toContain(secretDetail);
      expect(logged).not.toContain("postgres://");
      expect(logged).not.toContain("s3cr3tPass");
    }

    errorSpy.mockRestore();
  });
});

describe("wholesale-login: rate limiting", () => {
  it("locks the shop after 5 failed attempts, rejecting even the correct code", async () => {
    const shop = seedShop();

    for (let i = 0; i < 5; i++) {
      const res = mockRes();
      await loginHandler(mockReq({ method: "POST", body: { shopName: "Acme Repair", code: "wrong" } }), res);
      expect(res.statusCode).toBe(401);
    }

    expect(fake.db.wholesale_shops[0].locked_until).toBeTruthy();
    expect(fake.db.wholesale_shops[0].failed_attempts).toBe(0); // reset when the lockout kicks in

    const res = mockRes();
    await loginHandler(mockReq({ method: "POST", body: { shopName: "Acme Repair", code: PLAIN_CODE } }), res);
    expect(res.statusCode).toBe(429);
    expect(res.body.error).toBe("locked");
  });
});

describe("wholesale-login: new device", () => {
  it("creates a pending device and issues NO session — not even the shop's first-ever device", async () => {
    seedShop();
    const req = mockReq({ method: "POST", body: { shopName: "Acme Repair", code: PLAIN_CODE } });
    const res = mockRes();
    await loginHandler(req, res);

    expect(res.statusCode).toBe(202);
    expect(res.body.status).toBe("pending_device");
    expect(extractCookie(res.headers["Set-Cookie"], "ws_device")).toBeTruthy();
    expect(extractCookie(res.headers["Set-Cookie"], "ws_session")).toBeNull();

    expect(fake.db.wholesale_devices).toHaveLength(1);
    expect(fake.db.wholesale_devices[0].status).toBe("pending");
  });

  it("keeps a device pending on repeat logins until an admin approves it", async () => {
    const shop = seedShop();
    seedApprovedDevice(shop.id, "other-device"); // shop already has an approved device elsewhere
    const req = mockReq({ method: "POST", body: { shopName: "Acme Repair", code: PLAIN_CODE } }); // no cookie = new device
    const res = mockRes();
    await loginHandler(req, res);

    expect(res.statusCode).toBe(202); // still pending even though this shop already has an approved device
    expect(fake.db.wholesale_devices.find((d) => d.status === "pending")).toBeTruthy();
  });
});

describe("wholesale-prices: access gating", () => {
  it("rejects with no session cookie at all", async () => {
    const req = mockReq({ headers: {} });
    const res = mockRes();
    await pricesHandler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("rejects an expired session even if the cookie is present", async () => {
    const shop = seedShop();
    const device = seedApprovedDevice(shop.id, "known-device-token");
    fake.db.wholesale_sessions.push({
      id: fake.nextId(),
      shop_id: shop.id,
      device_id: device.id,
      session_token_hash: sha256Hex("expired-session-token"),
      created_at: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // expired yesterday
      revoked_at: null,
    });

    const req = mockReq({ headers: { cookie: "ws_session=expired-session-token" } });
    const res = mockRes();
    await pricesHandler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("blocks a device the moment it's no longer approved, even mid-session", async () => {
    const shop = seedShop();
    const device = seedApprovedDevice(shop.id, "known-device-token");
    fake.db.wholesale_sessions.push({
      id: fake.nextId(),
      shop_id: shop.id,
      device_id: device.id,
      session_token_hash: sha256Hex("live-session-token"),
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString(),
      revoked_at: null,
    });
    device.status = "revoked"; // admin revokes mid-session

    const req = mockReq({ headers: { cookie: "ws_session=live-session-token" } });
    const res = mockRes();
    await pricesHandler(req, res);
    expect(res.statusCode).toBe(403);
  });

  it("returns the active catalog for a valid session on an approved device", async () => {
    const shop = seedShop();
    const device = seedApprovedDevice(shop.id, "known-device-token");
    fake.db.wholesale_sessions.push({
      id: fake.nextId(),
      shop_id: shop.id,
      device_id: device.id,
      session_token_hash: sha256Hex("live-session-token"),
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString(),
      revoked_at: null,
    });
    const equipmentType = { id: fake.nextId(), slug: "iphone", name: "iPhone", is_tag_lens: false, active: true, sort_order: 0 };
    fake.db.wholesale_equipment_types.push(equipmentType);
    const category = { id: fake.nextId(), name: "iPhone", active: true, sort_order: 0, equipment_type_id: equipmentType.id };
    fake.db.wholesale_categories.push(category);
    fake.db.wholesale_services.push({
      id: fake.nextId(),
      category_id: category.id,
      name: "Screen Replacement",
      pricing_type: "fixed",
      fixed_price: 89,
      active: true,
      sort_order: 0,
    });

    const req = mockReq({ headers: { cookie: "ws_session=live-session-token" } });
    const res = mockRes();
    await pricesHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.equipmentTypes).toHaveLength(1);
    expect(res.body.equipmentTypes[0].categories[0].services[0].name).toBe("Screen Replacement");
    // Microsoldering is a plain member of equipmentTypes[] (is_tag_lens
    // true) — see api/_lib/wholesaleDb.js. `microsoldering` is still present
    // in the response as a TEMPORARY legacy-compatibility key (null here
    // since no tag-lens row was seeded in this fixture) — see
    // buildWholesaleWizardCatalog's header for what it's for.
    expect(res.body.microsoldering).toBeNull();
    expect(res.body.categories).toBeUndefined(); // old flat shape is fully replaced, not additive
  });
});

describe("wholesale-logout", () => {
  it("revokes the session so it can't be reused for prices", async () => {
    const shop = seedShop();
    seedApprovedDevice(shop.id, "known-device-token");
    const loginRes = mockRes();
    await loginHandler(
      mockReq({ method: "POST", body: { shopName: "Acme Repair", code: PLAIN_CODE }, headers: { cookie: "ws_device=known-device-token" } }),
      loginRes
    );
    const sessionToken = extractCookie(loginRes.headers["Set-Cookie"], "ws_session");
    expect(sessionToken).toBeTruthy();

    const logoutRes = mockRes();
    await logoutHandler(mockReq({ method: "POST", headers: { cookie: `ws_session=${sessionToken}` } }), logoutRes);
    expect(logoutRes.statusCode).toBe(200);
    expect(fake.db.wholesale_sessions[0].revoked_at).toBeTruthy();

    const pricesRes = mockRes();
    await pricesHandler(mockReq({ headers: { cookie: `ws_session=${sessionToken}` } }), pricesRes);
    expect(pricesRes.statusCode).toBe(401);
  });
});

describe("method rejection", () => {
  it("rejects GET on the login endpoint", async () => {
    const res = mockRes();
    await loginHandler(mockReq({ method: "GET" }), res);
    expect(res.statusCode).toBe(405);
  });
  it("rejects POST on the prices endpoint", async () => {
    const res = mockRes();
    await pricesHandler(mockReq({ method: "POST" }), res);
    expect(res.statusCode).toBe(405);
  });
});
