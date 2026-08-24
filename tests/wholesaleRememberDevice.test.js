import { describe, it, expect, beforeEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import { createFakeSupabase, mockReq, mockRes, extractCookie } from "./fakeSupabase.js";
import { sha256Hex } from "../api/_lib/wholesaleDb.js";

import loginHandler from "../api/wholesale-login.js";
import pricesHandler from "../api/wholesale-prices.js";
import logoutHandler from "../api/wholesale-logout.js";

/**
 * "Keep me signed in on this device" (rememberDevice in the login body).
 * Real end-to-end coverage through the actual shipped handlers
 * (api/wholesale-login.js, api/wholesale-prices.js, api/wholesale-logout.js)
 * and api/_lib/wholesaleDb.js's mintSession/attemptSilentDeviceSessionRefresh
 * — only the HTTP boundary is faked, via tests/fakeSupabase.js, same
 * established convention as tests/wholesale.test.js and
 * tests/wholesaleSilentDeviceRefresh.test.js.
 *
 * The core contract under test (see wholesale-remembered-sessions-
 * migration.sql and api/_lib/wholesaleDb.js's own header comments for the
 * full "why"):
 *   - Checked  -> ws_session cookie gets the usual persistent 30-day
 *     Max-Age; the session row is stored remembered=true; a later silent
 *     refresh (ws_device cookie, no valid ws_session) is allowed to keep
 *     the shop signed in.
 *   - Unchecked -> ws_session cookie has NO Max-Age at all (a real session
 *     cookie — the browser drops it when it closes); the session row is
 *     stored remembered=false; a later silent refresh explicitly declines.
 *   - The device's own APPROVAL (ws_device, 400-day) is completely
 *     unaffected either way — device approval and "remember me" are
 *     independent concepts (item 9 of the spec: keep device approval and
 *     every existing protection intact).
 *   - Every existing revocation path (logout, admin Close sessions, a
 *     regenerated Access Code, an individually revoked device, a blocked
 *     shop) still wins over remembered=true — revocation is checked first.
 *   - The Access Code itself is never stored anywhere retrievable in the
 *     browser: never in the JSON response body, never as a cookie value,
 *     never in localStorage/sessionStorage (client-side coverage in
 *     tests/wholesaleLoginRememberMeUi.test.jsx).
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

function seedApprovedDevice(shopId, deviceToken, overrides = {}) {
  const device = {
    id: fake.nextId(),
    shop_id: shopId,
    device_token_hash: sha256Hex(deviceToken),
    status: "approved",
    first_seen_at: new Date().toISOString(),
    approved_at: new Date().toISOString(),
    ...overrides,
  };
  fake.db.wholesale_devices.push(device);
  return device;
}

/** The full raw Set-Cookie entry for `name` (not just its value, unlike
 *  extractCookie) — needed to inspect whether Max-Age is present at all. */
function fullCookieEntry(setCookieHeader, name) {
  const list = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader].filter(Boolean);
  return list.find((entry) => entry.startsWith(`${name}=`)) || null;
}

async function login({ shopName = "Acme Repair", code = PLAIN_CODE, rememberDevice, deviceToken } = {}) {
  const req = mockReq({
    method: "POST",
    body: { shopName, code, rememberDevice },
    headers: deviceToken ? { cookie: `ws_device=${deviceToken}` } : {},
  });
  const res = mockRes();
  await loginHandler(req, res);
  return res;
}

async function callPricesWithCookies(cookieHeader) {
  const req = mockReq({ method: "GET", headers: { cookie: cookieHeader } });
  const res = mockRes();
  await pricesHandler(req, res);
  return res;
}

describe("Checked ('Keep me signed in'): persistent cookie, remembered=true, session survives to a later silent refresh", () => {
  it("issues a ws_session cookie WITH a 30-day Max-Age", async () => {
    const shop = seedShop();
    seedApprovedDevice(shop.id, "device-remember-true");

    const res = await login({ rememberDevice: true, deviceToken: "device-remember-true" });
    expect(res.statusCode).toBe(200);
    const entry = fullCookieEntry(res.headers["Set-Cookie"], "ws_session");
    expect(entry).toMatch(/Max-Age=2592000/);
  });

  it("stores the session row with remembered=true", async () => {
    const shop = seedShop();
    seedApprovedDevice(shop.id, "device-remember-true-2");

    await login({ rememberDevice: true, deviceToken: "device-remember-true-2" });
    expect(fake.db.wholesale_sessions[0].remembered).toBe(true);
  });

  it("a later request with no ws_session but the same ws_device cookie silently refreshes (session-only cookie loss simulated by simply not sending ws_session)", async () => {
    const shop = seedShop();
    seedApprovedDevice(shop.id, "device-remember-true-3");
    await login({ rememberDevice: true, deviceToken: "device-remember-true-3" });

    const res = await callPricesWithCookies("ws_device=device-remember-true-3");
    expect(res.statusCode).toBe(200);
    expect(res.headers["Set-Cookie"]).toBeDefined();
    // The chained refresh also mints remembered=true, so it keeps working indefinitely.
    const sessions = fake.db.wholesale_sessions.filter((s) => s.shop_id === shop.id);
    expect(sessions).toHaveLength(2);
    expect(sessions[1].remembered).toBe(true);
  });
});

describe("Unchecked (default): session-only cookie, remembered=false, a later silent refresh DECLINES", () => {
  it("issues a ws_session cookie with NO Max-Age at all when rememberDevice is false", async () => {
    const shop = seedShop();
    seedApprovedDevice(shop.id, "device-remember-false");

    const res = await login({ rememberDevice: false, deviceToken: "device-remember-false" });
    expect(res.statusCode).toBe(200);
    const entry = fullCookieEntry(res.headers["Set-Cookie"], "ws_session");
    expect(entry).toBeTruthy();
    expect(entry).not.toMatch(/Max-Age/);
    expect(entry).not.toMatch(/Expires/);
  });

  it("issues a session-only cookie when rememberDevice is simply omitted from the request body", async () => {
    const shop = seedShop();
    seedApprovedDevice(shop.id, "device-remember-omitted");

    const res = await login({ rememberDevice: undefined, deviceToken: "device-remember-omitted" });
    const entry = fullCookieEntry(res.headers["Set-Cookie"], "ws_session");
    expect(entry).not.toMatch(/Max-Age/);
  });

  it("a truthy-but-not-literal-true value (e.g. the string \"true\") is treated as unchecked — strict === true only", async () => {
    const shop = seedShop();
    seedApprovedDevice(shop.id, "device-remember-stringtrue");

    const res = await login({ rememberDevice: "true", deviceToken: "device-remember-stringtrue" });
    const entry = fullCookieEntry(res.headers["Set-Cookie"], "ws_session");
    expect(entry).not.toMatch(/Max-Age/);
    expect(fake.db.wholesale_sessions[0].remembered).toBe(false);
  });

  it("stores the session row with remembered=false", async () => {
    const shop = seedShop();
    seedApprovedDevice(shop.id, "device-remember-false-2");

    await login({ rememberDevice: false, deviceToken: "device-remember-false-2" });
    expect(fake.db.wholesale_sessions[0].remembered).toBe(false);
  });

  it("the device itself stays fully approved either way — 'don't remember me' never touches device approval", async () => {
    const shop = seedShop();
    const device = seedApprovedDevice(shop.id, "device-remember-false-3");

    await login({ rememberDevice: false, deviceToken: "device-remember-false-3" });
    expect(fake.db.wholesale_devices.find((d) => d.id === device.id).status).toBe("approved");
  });

  it("a later request with no ws_session cookie (simulating the browser having discarded it on close) but the same ws_device cookie DECLINES the silent refresh — plain 401, no new session minted", async () => {
    const shop = seedShop();
    seedApprovedDevice(shop.id, "device-remember-false-4");
    await login({ rememberDevice: false, deviceToken: "device-remember-false-4" });
    expect(fake.db.wholesale_sessions).toHaveLength(1);

    const res = await callPricesWithCookies("ws_device=device-remember-false-4");
    expect(res.statusCode).toBe(401);
    expect(res.headers["Set-Cookie"]).toBeUndefined();
    // No second session row was minted by the declined refresh attempt.
    expect(fake.db.wholesale_sessions).toHaveLength(1);
  });

  it("the shop can still browse normally for as long as the (session-only) ws_session cookie is actually presented — only its ABSENCE triggers the decline above", async () => {
    const shop = seedShop();
    seedApprovedDevice(shop.id, "device-remember-false-5");
    const loginRes = await login({ rememberDevice: false, deviceToken: "device-remember-false-5" });
    const sessionToken = extractCookie(loginRes.headers["Set-Cookie"], "ws_session");

    const res = await callPricesWithCookies(`ws_session=${sessionToken}; ws_device=device-remember-false-5`);
    expect(res.statusCode).toBe(200);
    expect(res.headers["Set-Cookie"]).toBeUndefined(); // no refresh needed — the cookie was still valid
  });
});

describe("A later real login can change the choice — the MOST RECENT session's remembered flag governs", () => {
  it("logging in again with the box now checked, after previously leaving it unchecked, re-enables silent refresh going forward", async () => {
    const shop = seedShop();
    seedApprovedDevice(shop.id, "device-changed-mind");

    await login({ rememberDevice: false, deviceToken: "device-changed-mind" });
    await login({ rememberDevice: true, deviceToken: "device-changed-mind" });
    expect(fake.db.wholesale_sessions).toHaveLength(2);

    const res = await callPricesWithCookies("ws_device=device-changed-mind");
    expect(res.statusCode).toBe(200); // the SECOND (remembered=true) login governs, not the first
  });

  it("logging in again with the box now unchecked, after previously checking it, disables silent refresh going forward", async () => {
    const shop = seedShop();
    seedApprovedDevice(shop.id, "device-changed-mind-2");

    await login({ rememberDevice: true, deviceToken: "device-changed-mind-2" });
    await login({ rememberDevice: false, deviceToken: "device-changed-mind-2" });

    const res = await callPricesWithCookies("ws_device=device-changed-mind-2");
    expect(res.statusCode).toBe(401);
  });
});

describe("Every existing revocation path still wins over remembered=true", () => {
  it("logout revokes the session even when it was remembered=true — the next silent-refresh attempt still declines", async () => {
    const shop = seedShop();
    seedApprovedDevice(shop.id, "device-logout-remembered");
    const loginRes = await login({ rememberDevice: true, deviceToken: "device-logout-remembered" });
    const sessionToken = extractCookie(loginRes.headers["Set-Cookie"], "ws_session");

    const logoutReq = mockReq({ method: "POST", headers: { cookie: `ws_session=${sessionToken}` } });
    const logoutRes = mockRes();
    await logoutHandler(logoutReq, logoutRes);
    expect(logoutRes.statusCode).toBe(200);

    const res = await callPricesWithCookies("ws_device=device-logout-remembered");
    expect(res.statusCode).toBe(401);
  });

  it("shop blocked declines even though the most recent session was remembered=true", async () => {
    const shop = seedShop();
    seedApprovedDevice(shop.id, "device-blocked-remembered");
    await login({ rememberDevice: true, deviceToken: "device-blocked-remembered" });
    shop.status = "blocked";

    const res = await callPricesWithCookies("ws_device=device-blocked-remembered");
    expect(res.statusCode).toBe(401);
  });

  it("an individually revoked device declines even though its most recent session was remembered=true", async () => {
    const shop = seedShop();
    const device = seedApprovedDevice(shop.id, "device-revoked-remembered");
    await login({ rememberDevice: true, deviceToken: "device-revoked-remembered" });
    device.status = "revoked";

    const res = await callPricesWithCookies("ws_device=device-revoked-remembered");
    expect(res.statusCode).toBe(401);
  });
});

describe("Backward compatibility: a session minted before this feature existed (no `remembered` field at all) behaves like remembered=true", () => {
  it("silently refreshes exactly as it always did", async () => {
    const shop = seedShop();
    const device = seedApprovedDevice(shop.id, "device-legacy-session");
    fake.db.wholesale_sessions.push({
      id: fake.nextId(),
      shop_id: shop.id,
      device_id: device.id,
      session_token_hash: sha256Hex("legacy-session-token"),
      created_at: new Date(Date.now() - 40 * 86400000).toISOString(),
      expires_at: new Date(Date.now() - 10 * 86400000).toISOString(), // expired 10 days ago
      revoked_at: null,
      // deliberately no `remembered` key — simulates a row from before this migration
    });

    const res = await callPricesWithCookies("ws_device=device-legacy-session");
    expect(res.statusCode).toBe(200);
  });
});

describe("The Access Code is never stored anywhere retrievable in the browser", () => {
  it("the login JSON response body never includes the submitted code", async () => {
    const shop = seedShop();
    seedApprovedDevice(shop.id, "device-no-code-leak");

    const res = await login({ rememberDevice: true, deviceToken: "device-no-code-leak" });
    expect(JSON.stringify(res.body)).not.toContain(PLAIN_CODE);
    expect(res.body).toEqual({ status: "ok", shopName: "Acme Repair" });
  });

  it("no Set-Cookie value ever equals the submitted plaintext code", async () => {
    const shop = seedShop();
    seedApprovedDevice(shop.id, "device-no-code-in-cookie");

    const res = await login({ rememberDevice: true, deviceToken: "device-no-code-in-cookie" });
    const cookies = Array.isArray(res.headers["Set-Cookie"]) ? res.headers["Set-Cookie"] : [res.headers["Set-Cookie"]];
    for (const entry of cookies.filter(Boolean)) {
      expect(entry).not.toContain(PLAIN_CODE);
    }
  });

  it("a failed login (wrong code) never echoes the attempted code back in the response", async () => {
    seedShop();
    const res = await login({ code: "totally-wrong-code", rememberDevice: true });
    expect(JSON.stringify(res.body)).not.toContain("totally-wrong-code");
  });

  it("only the session/device TOKENS (random, unrelated to the code) are ever stored server-side alongside a hash — never the code itself in any column this test can see", async () => {
    const shop = seedShop();
    seedApprovedDevice(shop.id, "device-hash-only");
    await login({ rememberDevice: true, deviceToken: "device-hash-only" });

    const session = fake.db.wholesale_sessions[0];
    expect(session.session_token_hash).not.toContain(PLAIN_CODE);
    expect(JSON.stringify(session)).not.toContain(PLAIN_CODE);
  });
});
