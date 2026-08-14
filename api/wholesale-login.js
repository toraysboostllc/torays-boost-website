/**
 * Vercel Function — wholesale shop login (shop name + code, not email/password).
 *
 * Custom auth, not Supabase Auth: the shop's code is compared with bcrypt
 * against the hash on file, failed attempts are rate-limited per shop, and
 * every device — including the shop's very first one, ever — is created
 * "pending" and stays that way until an admin approves it from the
 * Wholesale Shops module in TORAYS BOOST DESK. There is NO auto-approval
 * path, by explicit owner requirement.
 *
 * Session/device identity travel as HttpOnly cookies (ws_session, ws_device)
 * set here via Set-Cookie — never in the JSON body, never read/written by
 * client-side JS, never in localStorage.
 *
 * Every response is deliberately vague about *why* a login failed (shop
 * not found vs. wrong code look identical) so this endpoint can't be used
 * to enumerate shop names.
 */
import bcrypt from "bcryptjs";
import { serialize, parse } from "cookie";
import {
  getEnv,
  setPrivateHeaders,
  randomToken,
  sha256Hex,
  getShopByName,
  updateShop,
  findDeviceByTokenHash,
  createDevice,
  updateDevice,
  createSession,
  logEvent,
  clientIp,
} from "./_lib/wholesaleDb.js";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const SESSION_DAYS = 30;
const DEVICE_COOKIE_DAYS = 400; // browser-enforced cap on cookie lifetime
const INVALID_MSG = "Invalid shop name or code.";
const SHOP_NAME_MAX = 100;
const CODE_MAX = 128; // real codes are 8 chars — this is just a defensive cap
const DEVICE_TOKEN_MAX = 128;

function cookieOpts(maxAgeSeconds) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export default async function handler(req, res) {
  setPrivateHeaders(res);

  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed", message: "Method not allowed." });
    return;
  }

  let env;
  try {
    env = getEnv();
  } catch {
    res.status(500).json({ error: "not_configured", message: "Wholesale login isn't configured on the server yet." });
    return;
  }

  let body = {};
  try {
    body = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
  } catch {
    body = {};
  }
  const shopName = typeof body.shopName === "string" ? body.shopName.trim() : "";
  const code = typeof body.code === "string" ? body.code : "";
  const ip = clientIp(req);
  const userAgent = req.headers["user-agent"] || null;
  const incomingCookies = parse(req.headers.cookie || "");
  const rawDeviceToken = incomingCookies.ws_device || null;
  // A malformed/oversized cookie just means "unrecognized device" — never a 400.
  const incomingDeviceToken =
    rawDeviceToken && rawDeviceToken.length <= DEVICE_TOKEN_MAX ? rawDeviceToken : null;

  if (!shopName || !code || shopName.length > SHOP_NAME_MAX || code.length > CODE_MAX) {
    res.status(400).json({ error: "invalid_request", message: "Shop name and code are required." });
    return;
  }

  const shop = await getShopByName(env, shopName).catch(() => null);
  if (!shop) {
    res.status(401).json({ error: "invalid_credentials", message: INVALID_MSG });
    return;
  }

  if (shop.status === "blocked") {
    await logEvent(env, { shopId: shop.id, event: "login_failed", ip, userAgent }).catch(() => {});
    res.status(403).json({ error: "shop_blocked", message: "This account has been blocked. Contact Torays Boost." });
    return;
  }

  if (shop.locked_until && new Date(shop.locked_until) > new Date()) {
    await logEvent(env, { shopId: shop.id, event: "login_locked", ip, userAgent }).catch(() => {});
    res.status(429).json({ error: "locked", message: "Too many failed attempts. Try again later." });
    return;
  }

  const codeMatches = await bcrypt.compare(code, shop.code_hash);
  if (!codeMatches) {
    const nextAttempts = (shop.failed_attempts || 0) + 1;
    if (nextAttempts >= MAX_ATTEMPTS) {
      await updateShop(env, shop.id, {
        failed_attempts: 0,
        locked_until: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString(),
      });
    } else {
      await updateShop(env, shop.id, { failed_attempts: nextAttempts });
    }
    await logEvent(env, { shopId: shop.id, event: "login_failed", ip, userAgent }).catch(() => {});
    res.status(401).json({ error: "invalid_credentials", message: INVALID_MSG });
    return;
  }

  // Correct code from here on — reset the failed-attempt counter.
  await updateShop(env, shop.id, { failed_attempts: 0, locked_until: null });

  let device = incomingDeviceToken
    ? await findDeviceByTokenHash(env, shop.id, sha256Hex(incomingDeviceToken)).catch(() => null)
    : null;

  let deviceToken = incomingDeviceToken;
  const setCookies = [];

  if (!device) {
    // Unrecognized browser — always created pending. No exceptions, ever.
    deviceToken = randomToken();
    device = await createDevice(env, { shopId: shop.id, tokenHash: sha256Hex(deviceToken), status: "pending", userAgent });
    setCookies.push(serialize("ws_device", deviceToken, cookieOpts(DEVICE_COOKIE_DAYS * 24 * 60 * 60)));
    await logEvent(env, { shopId: shop.id, deviceId: device.id, event: "device_pending", ip, userAgent }).catch(() => {});
  }

  if (device.status === "revoked") {
    await logEvent(env, { shopId: shop.id, deviceId: device.id, event: "login_failed", ip, userAgent }).catch(() => {});
    if (setCookies.length) res.setHeader("Set-Cookie", setCookies);
    res.status(403).json({ error: "device_revoked", message: "This device's access was revoked. Contact Torays Boost." });
    return;
  }

  if (device.status === "pending") {
    await logEvent(env, { shopId: shop.id, deviceId: device.id, event: "device_pending", ip, userAgent }).catch(() => {});
    if (setCookies.length) res.setHeader("Set-Cookie", setCookies);
    res.status(202).json({
      status: "pending_device",
      message: "This device needs approval before you can view prices. We'll let you know once it's approved.",
    });
    return;
  }

  // device.status === "approved" — issue a 30-day session.
  const sessionToken = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await createSession(env, { shopId: shop.id, deviceId: device.id, tokenHash: sha256Hex(sessionToken), expiresAt });
  await updateDevice(env, device.id, { last_seen_at: new Date().toISOString() });
  await logEvent(env, { shopId: shop.id, deviceId: device.id, event: "login_success", ip, userAgent }).catch(() => {});

  setCookies.push(serialize("ws_session", sessionToken, cookieOpts(SESSION_DAYS * 24 * 60 * 60)));
  res.setHeader("Set-Cookie", setCookies);
  res.status(200).json({ status: "ok", shopName: shop.name });
}
