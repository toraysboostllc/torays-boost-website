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
    const category = { id: fake.nextId(), name: "iPhone", active: true, sort_order: 0 };
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
    expect(res.body.categories).toHaveLength(1);
    expect(res.body.categories[0].services[0].name).toBe("Screen Replacement");
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
