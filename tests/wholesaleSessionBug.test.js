import { describe, it, expect, beforeEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import { createFakeSupabase, mockReq, mockRes, extractCookie } from "./fakeSupabase.js";
import { rest, getEnv, sha256Hex } from "../api/_lib/wholesaleDb.js";

import loginHandler from "../api/wholesale-login.js";

/**
 * Real-world case: Mikea logged in with the current code, DESK approved the
 * pending device, and the NEXT login crashed with a generic "Login failed."
 * — no session, no login_success in the log. Root cause: rest() treated
 * "no body" as meaning status 204 specifically, but a POST with
 * Prefer: return=minimal (createSession's insert into wholesale_sessions)
 * answers 201 Created with an empty body, not 204 — so rest() called
 * res.json() on nothing and threw, after the session row had already been
 * inserted. createSession() has no .catch(), so the exception crashed the
 * whole handler before the cookie or the login_success log entry ever
 * happened. These tests pin down the fix (read as text, only JSON.parse
 * when there's actually something) at both the rest()-contract level and
 * the full login-handler level.
 */

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
    code_hash: bcrypt.hashSync(PLAIN_CODE, 4),
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

function mockRawResponse({ status, text }) {
  return { ok: status >= 200 && status < 300, status, text: async () => text };
}

describe("rest(): empty-body handling (1-3)", () => {
  it("1. a 201 Created with an empty body (POST + Prefer: return=minimal) returns null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockRawResponse({ status: 201, text: "" })));
    const result = await rest(getEnv(), "wholesale_sessions", { method: "POST", headers: { Prefer: "return=minimal" } });
    expect(result).toBeNull();
  });

  it("2. a 204 No Content (PATCH/DELETE + Prefer: return=minimal) returns null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockRawResponse({ status: 204, text: "" })));
    const result = await rest(getEnv(), "wholesale_shops?id=eq.x", { method: "PATCH" });
    expect(result).toBeNull();
  });

  it("3. a response with an actual JSON body is parsed correctly", async () => {
    const row = { id: "abc-123", name: "Test Shop" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockRawResponse({ status: 200, text: JSON.stringify([row]) })));
    const result = await rest(getEnv(), "wholesale_shops?select=*");
    expect(result).toEqual([row]);
  });
});

describe("wholesale-login: approved device completes login (4-6)", () => {
  it("4. creates exactly one session row", async () => {
    const shop = seedShop();
    seedApprovedDevice(shop.id, "known-device-token");

    const res = mockRes();
    await loginHandler(
      mockReq({ method: "POST", body: { shopName: "Acme Repair", code: PLAIN_CODE }, headers: { cookie: "ws_device=known-device-token" } }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(fake.db.wholesale_sessions).toHaveLength(1);
  });

  it("5. issues the ws_session cookie", async () => {
    const shop = seedShop();
    seedApprovedDevice(shop.id, "known-device-token");

    const res = mockRes();
    await loginHandler(
      mockReq({ method: "POST", body: { shopName: "Acme Repair", code: PLAIN_CODE }, headers: { cookie: "ws_device=known-device-token" } }),
      res
    );

    expect(extractCookie(res.headers["Set-Cookie"], "ws_session")).toBeTruthy();
  });

  it("6. logs login_success", async () => {
    const shop = seedShop();
    seedApprovedDevice(shop.id, "known-device-token");

    const res = mockRes();
    await loginHandler(
      mockReq({ method: "POST", body: { shopName: "Acme Repair", code: PLAIN_CODE }, headers: { cookie: "ws_device=known-device-token" } }),
      res
    );

    const events = fake.db.wholesale_access_log.map((e) => e.event);
    expect(events).toContain("login_success");
  });
});

describe("wholesale-login: a genuine session-creation failure (7)", () => {
  it("7. still fails the request and never issues a session cookie or a session row", async () => {
    const shop = seedShop();
    seedApprovedDevice(shop.id, "known-device-token");

    const realFetch = fake.fakeFetch;
    vi.stubGlobal("fetch", async (url, options) => {
      const isSessionInsert = typeof url === "string" && url.includes("/wholesale_sessions") && (options?.method || "GET").toUpperCase() === "POST";
      if (isSessionInsert) {
        return { ok: false, status: 500, text: async () => "simulated database error" };
      }
      return realFetch(url, options);
    });

    const req = mockReq({ method: "POST", body: { shopName: "Acme Repair", code: PLAIN_CODE }, headers: { cookie: "ws_device=known-device-token" } });
    const res = mockRes();

    await expect(loginHandler(req, res)).rejects.toThrow(/supabase_rest_failed/);

    // The handler crashes before ever calling res.json(...)/res.status(...) —
    // mockRes() defaults statusCode to 200, so that field isn't meaningful
    // here; what actually proves "no fake success" is that no success body
    // and no session cookie were ever written.
    expect(res.body).toBeNull();
    expect(extractCookie(res.headers["Set-Cookie"], "ws_session")).toBeNull();
    expect(fake.db.wholesale_sessions).toHaveLength(0);
  });
});

describe("wholesale-login: catalog state never affects login (8)", () => {
  it("8. succeeds with a fully inactive catalog (21 categories, 74 services, 0 active) — login never reads these tables", async () => {
    const shop = seedShop();
    seedApprovedDevice(shop.id, "known-device-token");

    let servicesLeft = 74;
    for (let i = 0; i < 21; i++) {
      const remainingCategories = 21 - i;
      const take = Math.ceil(servicesLeft / remainingCategories);
      const category = { id: fake.nextId(), name: `Category ${i}`, active: false, sort_order: i };
      fake.db.wholesale_categories.push(category);
      for (let j = 0; j < take; j++) {
        fake.db.wholesale_services.push({
          id: fake.nextId(), category_id: category.id, name: `Service ${i}-${j}`,
          pricing_type: "fixed", fixed_price: 10, active: false, sort_order: j,
        });
      }
      servicesLeft -= take;
    }
    expect(fake.db.wholesale_categories).toHaveLength(21);
    expect(fake.db.wholesale_services).toHaveLength(74);

    const res = mockRes();
    await loginHandler(
      mockReq({ method: "POST", body: { shopName: "Acme Repair", code: PLAIN_CODE }, headers: { cookie: "ws_device=known-device-token" } }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(extractCookie(res.headers["Set-Cookie"], "ws_session")).toBeTruthy();
  });
});
