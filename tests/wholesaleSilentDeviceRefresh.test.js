import { describe, it, expect } from "vitest";
import { createFakeSupabase, mockReq, mockRes } from "./fakeSupabase.js";
import { sha256Hex } from "../api/_lib/wholesaleDb.js";
import pricesHandler from "../api/wholesale-prices.js";

/**
 * Persistent trusted device — silent session refresh. Reuses the exact
 * ws_device (400-day)/ws_session (30-day) cookie pair wholesale-login.js
 * already established. On a return visit where ws_session is missing/
 * expired but ws_device still points at an approved device whose most
 * recent session was never explicitly revoked, wholesale-prices.js silently
 * mints a fresh session instead of forcing the shop back through Shop
 * Name/Access Code — see attemptSilentDeviceSessionRefresh's own header in
 * api/_lib/wholesaleDb.js for exactly how each explicit revocation cause
 * (logout, Close sessions, code change, device revoke, shop blocked) is
 * distinguished from plain time-expiry using only columns that already
 * exist (no new schema).
 */

function seedShop(fake, overrides = {}) {
  const shopId = fake.nextId();
  fake.db.wholesale_shops.push({ id: shopId, name: "Test Shop", status: "active", code_hash: "x", failed_attempts: 0, ...overrides });
  return shopId;
}

function seedApprovedDevice(fake, shopId, deviceTokenHash, overrides = {}) {
  const deviceId = fake.nextId();
  fake.db.wholesale_devices.push({ id: deviceId, shop_id: shopId, device_token_hash: deviceTokenHash, status: "approved", ...overrides });
  return deviceId;
}

async function callPricesWithCookies(fake, cookieHeader) {
  const req = mockReq({ method: "GET", headers: { cookie: cookieHeader } });
  const res = mockRes();
  const originalFetch = global.fetch;
  global.fetch = fake.fakeFetch;
  process.env.SUPABASE_URL = "https://fake.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "fake-key";
  try {
    await pricesHandler(req, res);
  } finally {
    global.fetch = originalFetch;
  }
  return res;
}

describe("GET /api/wholesale-prices: silent trusted-device session refresh — positive case", () => {
  it("no ws_session cookie at all, but a valid ws_device cookie for an approved device with no prior session — silently mints a session, returns 200 catalog, sets a new ws_session cookie", async () => {
    const fake = createFakeSupabase();
    const shopId = seedShop(fake);
    const deviceTokenHash = sha256Hex("device-token-abc");
    seedApprovedDevice(fake, shopId, deviceTokenHash);

    const res = await callPricesWithCookies(fake, "ws_device=device-token-abc");
    expect(res.statusCode).toBe(200);
    expect(res.headers["Set-Cookie"]).toBeDefined();
    const setCookie = Array.isArray(res.headers["Set-Cookie"]) ? res.headers["Set-Cookie"].join(";") : res.headers["Set-Cookie"];
    expect(setCookie).toMatch(/^ws_session=/);
    expect(setCookie).toMatch(/HttpOnly/i);
  });

  it("an expired ws_session cookie (device's most recent session simply timed out, revoked_at still null) — silently refreshes rather than forcing a real login", async () => {
    const fake = createFakeSupabase();
    const shopId = seedShop(fake);
    const deviceTokenHash = sha256Hex("device-token-expired");
    const deviceId = seedApprovedDevice(fake, shopId, deviceTokenHash);
    fake.db.wholesale_sessions.push({
      id: fake.nextId(), shop_id: shopId, device_id: deviceId,
      session_token_hash: sha256Hex("old-expired-session-token"),
      created_at: new Date(Date.now() - 40 * 86400000).toISOString(),
      expires_at: new Date(Date.now() - 10 * 86400000).toISOString(), // expired 10 days ago
      revoked_at: null,
    });

    const res = await callPricesWithCookies(fake, `ws_session=old-expired-session-token; ws_device=device-token-expired`);
    expect(res.statusCode).toBe(200);
    // A genuinely new session row was minted (not the expired one reused).
    const sessionsForDevice = fake.db.wholesale_sessions.filter((s) => s.device_id === deviceId);
    expect(sessionsForDevice.length).toBe(2);
    const fresh = sessionsForDevice.find((s) => new Date(s.expires_at) > new Date());
    expect(fresh).toBeTruthy();
    // createSession()'s real insert never sets revoked_at at all on a brand
    // new row (absent, not explicitly null) — both mean "not revoked"
    // everywhere else in this codebase (see the falsy check in
    // attemptSilentDeviceSessionRefresh itself), so this asserts falsy, not
    // strictly null.
    expect(fresh.revoked_at).toBeFalsy();
  });

  it("logs a session_silently_refreshed event distinct from login_success", async () => {
    const fake = createFakeSupabase();
    const shopId = seedShop(fake);
    const deviceTokenHash = sha256Hex("device-token-logevent");
    seedApprovedDevice(fake, shopId, deviceTokenHash);

    await callPricesWithCookies(fake, "ws_device=device-token-logevent");
    const events = fake.db.wholesale_access_log.map((e) => e.event);
    expect(events).toContain("session_silently_refreshed");
    expect(events).not.toContain("login_success");
  });

  it("the resulting session is subject to the legal-acceptance gate exactly like a freshly-logged-in one — no special-casing", async () => {
    const fake = createFakeSupabase();
    const shopId = seedShop(fake);
    const deviceTokenHash = sha256Hex("device-token-legal");
    seedApprovedDevice(fake, shopId, deviceTokenHash);
    fake.db.wholesale_legal_documents.push({
      id: fake.nextId(), document_type: "master_agreement", version: "1.0", status: "published",
      content_en: {}, content_es: {}, content_hash: "h", published_at: new Date().toISOString(),
    });

    const res = await callPricesWithCookies(fake, "ws_device=device-token-legal");
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe("legal_acceptance_required");
    // The refreshed session cookie is still set even though the legal gate
    // blocks the catalog — the shop is genuinely authenticated, it just has
    // one more step, exactly like a fresh login would.
    expect(res.headers["Set-Cookie"]).toBeDefined();
  });
});

describe("GET /api/wholesale-prices: silent refresh correctly DECLINES for every explicit revocation cause", () => {
  it("logout: the device's most recent session has revoked_at set — declines, falls through to ordinary 401 (no silent bypass of logout)", async () => {
    const fake = createFakeSupabase();
    const shopId = seedShop(fake);
    const deviceTokenHash = sha256Hex("device-token-loggedout");
    const deviceId = seedApprovedDevice(fake, shopId, deviceTokenHash);
    fake.db.wholesale_sessions.push({
      id: fake.nextId(), shop_id: shopId, device_id: deviceId,
      session_token_hash: sha256Hex("logged-out-session-token"),
      created_at: new Date(Date.now() - 86400000).toISOString(),
      expires_at: new Date(Date.now() + 29 * 86400000).toISOString(), // NOT time-expired
      revoked_at: new Date().toISOString(), // explicitly revoked via logout
    });

    const res = await callPricesWithCookies(fake, "ws_device=device-token-loggedout");
    expect(res.statusCode).toBe(401);
    expect(res.headers["Set-Cookie"]).toBeUndefined();
  });

  it("admin 'Close sessions': same signal as logout (revoked_at set on the most recent session), device itself stays approved — declines", async () => {
    const fake = createFakeSupabase();
    const shopId = seedShop(fake);
    const deviceTokenHash = sha256Hex("device-token-closedsessions");
    const deviceId = seedApprovedDevice(fake, shopId, deviceTokenHash);
    fake.db.wholesale_sessions.push({
      id: fake.nextId(), shop_id: shopId, device_id: deviceId,
      session_token_hash: sha256Hex("closed-session-token"),
      expires_at: new Date(Date.now() + 20 * 86400000).toISOString(),
      revoked_at: new Date().toISOString(), // Close sessions revoked it
    });

    const res = await callPricesWithCookies(fake, "ws_device=device-token-closedsessions");
    expect(res.statusCode).toBe(401);
    expect(fake.db.wholesale_devices.find((d) => d.id === deviceId).status).toBe("approved"); // device untouched by Close sessions
  });

  it("access code changed: the device itself was flipped to 'revoked' by wholesale_regenerate_shop_code — declines via the device.status check", async () => {
    const fake = createFakeSupabase();
    const shopId = seedShop(fake);
    const deviceTokenHash = sha256Hex("device-token-coderotated");
    seedApprovedDevice(fake, shopId, deviceTokenHash, { status: "revoked" });

    const res = await callPricesWithCookies(fake, "ws_device=device-token-coderotated");
    expect(res.statusCode).toBe(401);
  });

  it("device individually revoked by an admin (reject action) — same decline as a code-rotation revoke", async () => {
    const fake = createFakeSupabase();
    const shopId = seedShop(fake);
    const deviceTokenHash = sha256Hex("device-token-rejected");
    seedApprovedDevice(fake, shopId, deviceTokenHash, { status: "revoked" });

    const res = await callPricesWithCookies(fake, "ws_device=device-token-rejected");
    expect(res.statusCode).toBe(401);
  });

  it("shop blocked — declines even though the device itself is still 'approved'", async () => {
    const fake = createFakeSupabase();
    const shopId = seedShop(fake, { status: "blocked" });
    const deviceTokenHash = sha256Hex("device-token-blockedshop");
    seedApprovedDevice(fake, shopId, deviceTokenHash);

    const res = await callPricesWithCookies(fake, "ws_device=device-token-blockedshop");
    expect(res.statusCode).toBe(401);
  });

  it("device is still 'pending' (never approved) — declines, same as a brand-new unrecognized device; no auto-approval sneaks in through this path", async () => {
    const fake = createFakeSupabase();
    const shopId = seedShop(fake);
    const deviceTokenHash = sha256Hex("device-token-pending");
    seedApprovedDevice(fake, shopId, deviceTokenHash, { status: "pending" });

    const res = await callPricesWithCookies(fake, "ws_device=device-token-pending");
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /api/wholesale-prices: silent refresh — new browser/device, tampered token, no crash", () => {
  it("ws_device cookie present but matches no row in the database at all — 401, never a crash, never creates a device row", async () => {
    const fake = createFakeSupabase();
    const res = await callPricesWithCookies(fake, "ws_device=totally-unknown-token");
    expect(res.statusCode).toBe(401);
    expect(fake.db.wholesale_devices).toHaveLength(0);
  });

  it("no ws_device cookie and no ws_session cookie at all — plain 401, silent-refresh path never even attempted", async () => {
    const fake = createFakeSupabase();
    const res = await callPricesWithCookies(fake, "");
    expect(res.statusCode).toBe(401);
  });

  it("an oversized/malformed ws_device cookie value is ignored, not treated as a lookup attempt", async () => {
    const fake = createFakeSupabase();
    const res = await callPricesWithCookies(fake, `ws_device=${"x".repeat(500)}`);
    expect(res.statusCode).toBe(401);
  });

  it("a valid ws_session cookie takes priority — silent refresh is never even attempted when the session cookie is already valid", async () => {
    const fake = createFakeSupabase();
    const shopId = seedShop(fake);
    const deviceTokenHash = sha256Hex("device-token-both-valid");
    const deviceId = seedApprovedDevice(fake, shopId, deviceTokenHash);
    fake.db.wholesale_sessions.push({
      id: fake.nextId(), shop_id: shopId, device_id: deviceId,
      session_token_hash: sha256Hex("still-valid-session-token"),
      expires_at: new Date(Date.now() + 20 * 86400000).toISOString(), revoked_at: null,
    });

    const res = await callPricesWithCookies(fake, "ws_session=still-valid-session-token; ws_device=device-token-both-valid");
    expect(res.statusCode).toBe(200);
    // No NEW session was minted — still exactly the one seeded above.
    expect(fake.db.wholesale_sessions.filter((s) => s.device_id === deviceId)).toHaveLength(1);
    expect(res.headers["Set-Cookie"]).toBeUndefined();
  });
});

describe("GET /api/wholesale-prices: silent refresh never creates duplicate/orphaned rows on repeated attempts", () => {
  it("two sequential requests with the SAME stale ws_device cookie (simulating the client not yet having applied the first response's new cookie) each mint their own valid session — not an error, not data corruption", async () => {
    const fake = createFakeSupabase();
    const shopId = seedShop(fake);
    const deviceTokenHash = sha256Hex("device-token-concurrent");
    const deviceId = seedApprovedDevice(fake, shopId, deviceTokenHash);

    const first = await callPricesWithCookies(fake, "ws_device=device-token-concurrent");
    const second = await callPricesWithCookies(fake, "ws_device=device-token-concurrent");

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    const sessions = fake.db.wholesale_sessions.filter((s) => s.device_id === deviceId);
    expect(sessions).toHaveLength(2);
    // Both are genuinely valid (not revoked) — no corruption, just two
    // legitimate sessions for the same device, matching wholesale-login.js's
    // own pre-existing behavior for concurrent logins.
    expect(sessions.every((s) => !s.revoked_at)).toBe(true);
  });

  it("applying the FIRST response's new ws_session cookie on the next request no longer triggers a silent refresh at all (the normal cookie path takes over)", async () => {
    const fake = createFakeSupabase();
    const shopId = seedShop(fake);
    const deviceTokenHash = sha256Hex("device-token-followup");
    const deviceId = seedApprovedDevice(fake, shopId, deviceTokenHash);

    const first = await callPricesWithCookies(fake, "ws_device=device-token-followup");
    expect(first.statusCode).toBe(200);
    const setCookie = Array.isArray(first.headers["Set-Cookie"]) ? first.headers["Set-Cookie"][0] : first.headers["Set-Cookie"];
    const newSessionToken = setCookie.match(/ws_session=([^;]+)/)[1];

    const second = await callPricesWithCookies(fake, `ws_session=${newSessionToken}; ws_device=device-token-followup`);
    expect(second.statusCode).toBe(200);
    expect(second.headers["Set-Cookie"]).toBeUndefined(); // no further refresh needed
    expect(fake.db.wholesale_sessions.filter((s) => s.device_id === deviceId)).toHaveLength(1);
  });
});
