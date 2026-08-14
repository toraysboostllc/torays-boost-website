import { describe, it, expect, beforeEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import { createFakeSupabase, mockReq, mockRes, extractCookie } from "./fakeSupabase.js";
import { sha256Hex } from "../api/_lib/wholesaleDb.js";

import loginHandler from "../api/wholesale-login.js";

/**
 * Real-world case reported by the owner: shop "Mikea" had its code
 * regenerated (a full security reset — every device/session revoked), then
 * logged in again from the SAME browser with the NEW correct code. The old
 * code path treated the still-recognized (now-revoked) device cookie as a
 * permanent block ("Contact Torays Boost"), with no way back in short of the
 * user manually clearing cookies. These tests pin down the fixed behavior:
 * a revoked device + the CURRENT correct code always starts a fresh pending
 * request — never an automatic session, never a permanent dead end.
 */

const OLD_CODE = "OLDCODE1";
const NEW_CODE = "NEWCODE2";

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
    name: "Mikea",
    code_hash: bcrypt.hashSync(OLD_CODE, 4),
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

/** Exercises the SAME RPC the DESK admin "regenerate code" action calls —
 *  not a hand-rolled approximation — so this test suite stays honest about
 *  what a real full security reset actually does to devices/sessions. */
async function regenerateCode(shop, newPlainCode) {
  const newHash = bcrypt.hashSync(newPlainCode, 4);
  await fake.fakeFetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/wholesale_regenerate_shop_code`, {
    method: "POST",
    body: JSON.stringify({ p_shop_id: shop.id, p_code_hash: newHash }),
  });
}

describe("wholesale-login: revoked device + current code (post-regeneration)", () => {
  it("full sequence: regenerate → old code rejected → new code from the same browser requests approval → repeat doesn't duplicate → admin approves → session issues", async () => {
    const shop = seedShop();
    const oldDevice = seedApprovedDevice(shop.id, "mikea-browser-token");
    seedApprovedDevice(shop.id, "some-other-approved-device"); // unrelated device, also gets revoked by the reset

    // 1-3. Admin regenerates the code — a full security reset.
    await regenerateCode(shop, NEW_CODE);
    expect(fake.db.wholesale_devices.every((d) => d.status === "revoked")).toBe(true);

    // 4. Old code, same browser: always rejected, regardless of device state.
    const oldCodeRes = mockRes();
    await loginHandler(
      mockReq({ method: "POST", body: { shopName: "Mikea", code: OLD_CODE }, headers: { cookie: "ws_device=mikea-browser-token" } }),
      oldCodeRes
    );
    expect(oldCodeRes.statusCode).toBe(401);
    expect(oldCodeRes.body.error).toBe("invalid_credentials");
    expect(extractCookie(oldCodeRes.headers["Set-Cookie"], "ws_session")).toBeNull();

    // 5. New correct code, SAME browser (still carrying the now-revoked device cookie):
    // must NOT be a permanent block — must start a fresh pending request instead.
    const firstNewCodeRes = mockRes();
    await loginHandler(
      mockReq({ method: "POST", body: { shopName: "Mikea", code: NEW_CODE }, headers: { cookie: "ws_device=mikea-browser-token" } }),
      firstNewCodeRes
    );
    expect(firstNewCodeRes.statusCode).toBe(202);
    expect(firstNewCodeRes.body.status).toBe("pending_device");
    expect(extractCookie(firstNewCodeRes.headers["Set-Cookie"], "ws_session")).toBeNull(); // never a session
    expect(firstNewCodeRes.body.categories).toBeUndefined(); // never prices

    const newDeviceToken = extractCookie(firstNewCodeRes.headers["Set-Cookie"], "ws_device");
    expect(newDeviceToken).toBeTruthy();
    expect(newDeviceToken).not.toBe("mikea-browser-token"); // a genuinely new token, not a reinstated old one

    // The old revoked row must survive completely untouched — audit trail preserved.
    const oldDeviceAfter = fake.db.wholesale_devices.find((d) => d.id === oldDevice.id);
    expect(oldDeviceAfter.status).toBe("revoked");
    expect(oldDeviceAfter.device_token_hash).toBe(sha256Hex("mikea-browser-token"));

    // A brand-new pending row now exists, distinct from the old one.
    const pendingDevices = fake.db.wholesale_devices.filter((d) => d.status === "pending");
    expect(pendingDevices).toHaveLength(1);
    const newDevice = pendingDevices[0];
    expect(newDevice.id).not.toBe(oldDevice.id);
    expect(newDevice.device_token_hash).toBe(sha256Hex(newDeviceToken));

    const deviceCountAfterFirstRetry = fake.db.wholesale_devices.length;

    // 6. Repeat attempts from the NEW (pending) cookie must not create duplicates.
    const secondNewCodeRes = mockRes();
    await loginHandler(
      mockReq({ method: "POST", body: { shopName: "Mikea", code: NEW_CODE }, headers: { cookie: `ws_device=${newDeviceToken}` } }),
      secondNewCodeRes
    );
    expect(secondNewCodeRes.statusCode).toBe(202);
    expect(secondNewCodeRes.body.status).toBe("pending_device");
    expect(fake.db.wholesale_devices).toHaveLength(deviceCountAfterFirstRetry); // no new row
    expect(fake.db.wholesale_devices.filter((d) => d.status === "pending")).toHaveLength(1); // still just the one

    // 7. Only now does the admin approve the NEW device (DESK-side action — simulated here
    // exactly like the rest of this suite simulates admin/session-state changes directly).
    newDevice.status = "approved";
    newDevice.approved_at = new Date().toISOString();

    // 8. Next login from that same (now-approved) device: a real session, finally.
    const finalRes = mockRes();
    await loginHandler(
      mockReq({ method: "POST", body: { shopName: "Mikea", code: NEW_CODE }, headers: { cookie: `ws_device=${newDeviceToken}` } }),
      finalRes
    );
    expect(finalRes.statusCode).toBe(200);
    expect(finalRes.body.status).toBe("ok");
    const sessionToken = extractCookie(finalRes.headers["Set-Cookie"], "ws_session");
    expect(sessionToken).toBeTruthy();
    expect(fake.db.wholesale_sessions.some((s) => s.session_token_hash === sha256Hex(sessionToken) && !s.revoked_at)).toBe(true);
  });

  it("also applies to a single device the admin revokes directly (no code rotation)", async () => {
    // Requirement: manual revocation must allow a fresh pending request as long as the
    // shop still knows the CURRENT valid code — never automatic reinstatement.
    const shop = seedShop();
    const device = seedApprovedDevice(shop.id, "manually-revoked-browser");
    device.status = "revoked"; // admin revokes this one device directly, code untouched

    const res = mockRes();
    await loginHandler(
      mockReq({ method: "POST", body: { shopName: "Mikea", code: OLD_CODE }, headers: { cookie: "ws_device=manually-revoked-browser" } }),
      res
    );

    expect(res.statusCode).toBe(202);
    expect(res.body.status).toBe("pending_device");
    expect(extractCookie(res.headers["Set-Cookie"], "ws_session")).toBeNull();
    const newToken = extractCookie(res.headers["Set-Cookie"], "ws_device");
    expect(newToken).toBeTruthy();
    expect(newToken).not.toBe("manually-revoked-browser");

    // Old row untouched, new pending row created — same guarantee as the regeneration case.
    expect(fake.db.wholesale_devices.find((d) => d.id === device.id).status).toBe("revoked");
    expect(fake.db.wholesale_devices.filter((d) => d.status === "pending")).toHaveLength(1);
  });

  it("still rejects a revoked device outright when the code is wrong — revocation never weakens the code check", async () => {
    const shop = seedShop();
    seedApprovedDevice(shop.id, "revoked-browser").status = "revoked";

    const res = mockRes();
    await loginHandler(
      mockReq({ method: "POST", body: { shopName: "Mikea", code: "totally-wrong" }, headers: { cookie: "ws_device=revoked-browser" } }),
      res
    );

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe("invalid_credentials");
    // No new device row — the code check fails before any device logic ever runs.
    expect(fake.db.wholesale_devices).toHaveLength(1);
  });
});
