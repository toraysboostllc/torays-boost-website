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
 * "Keep me signed in on this device" (rememberDevice in the request body):
 * checked -> the ws_session cookie gets its usual persistent 30-day Max-Age,
 * and the session row is stored with remembered=true, so a later silent
 * refresh (see attemptSilentDeviceSessionRefresh in _lib/wholesaleDb.js) is
 * allowed to keep the shop signed in past a browser restart. Unchecked ->
 * the ws_session cookie is set with NO Max-Age at all (a true session
 * cookie — gone when the browser closes; standard cookie semantics, the
 * only mechanism available for this), and the session row is stored with
 * remembered=false, so a later silent refresh explicitly declines rather
 * than silently re-authenticating the shop against their own choice. Either
 * way, the ws_device cookie (400-day, tracks device APPROVAL, a completely
 * separate concept — see wholesale-remembered-sessions-migration.sql) is
 * unaffected: not checking the box never forces a device back into
 * "pending" or strips its approval, it only changes whether that approved
 * device is allowed to silently sign back in later.
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
  normalizeShopCode,
  getShopByName,
  updateShop,
  findDeviceByTokenHash,
  createDevice,
  updateDevice,
  mintSession,
  wholesaleSessionCookieOptions,
  WHOLESALE_SESSION_DAYS,
  logEvent,
  clientIp,
} from "./_lib/wholesaleDb.js";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const DEVICE_COOKIE_DAYS = 400; // browser-enforced cap on cookie lifetime
const INVALID_MSG = "Invalid shop name or code.";
const SHOP_NAME_MAX = 100;
const CODE_MAX = 128; // real codes are 8 chars — this is just a defensive cap
const DEVICE_TOKEN_MAX = 128;

// cookieOpts() used to be defined locally here; it's now
// wholesaleSessionCookieOptions() in _lib/wholesaleDb.js, shared with the
// silent trusted-device session refresh in wholesale-prices.js — same
// attributes (httpOnly/secure-in-production/sameSite=lax/path=/), so a
// freshly-logged-in session cookie and a silently-refreshed one are
// provably byte-identical in shape, not two independently-maintained
// definitions.
const cookieOpts = wholesaleSessionCookieOptions;

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
  const code = normalizeShopCode(body.code);
  // Strict boolean check — anything other than the literal `true` (missing,
  // "true" the string, 1, etc.) is treated as unchecked. Never trust a truthy
  // coercion here: this value ends up deciding whether a session cookie
  // outlives the browser.
  const rememberDevice = body.rememberDevice === true;
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

  // A genuine failure reaching/querying Supabase here (network error, bad
  // config, an expired/invalid service key) must NEVER be reported as
  // "invalid credentials" — that would tell an admin their code is wrong
  // when the real problem is the server. Only a successful query that
  // genuinely found no matching row means "no such shop"; any exception is
  // its own distinct, safe operational error. The caught error itself is
  // never logged or returned — it can carry Supabase's raw response detail
  // (see rest()'s own thrown message), which has no business in a log line
  // or a client response.
  let shop;
  try {
    shop = await getShopByName(env, shopName);
  } catch {
    console.error("wholesale-login: shop lookup failed (Supabase unreachable or misconfigured)");
    res.status(503).json({ error: "service_unavailable", message: "Service temporarily unavailable. Please try again shortly." });
    return;
  }
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

  if (!device || device.status === "revoked") {
    // Unrecognized browser, OR a browser whose device was revoked (code
    // regeneration revokes every device; an admin can also revoke one
    // directly) — the code just verified above is the CURRENT correct one,
    // so the shop is who they say they are, but a revoked/unknown browser
    // never gets back in automatically. Mint a brand-new device token and a
    // brand-new "pending" row every time; the old revoked row (if any) is
    // left completely untouched, so the audit trail of what got revoked and
    // when never disappears. Same rule whether the shop got here via a
    // rotated code or by knowing the still-current one after a manual
    // revoke — either way this is a fresh approval request, never a
    // reinstatement of the old device.
    deviceToken = randomToken();
    device = await createDevice(env, { shopId: shop.id, tokenHash: sha256Hex(deviceToken), status: "pending", userAgent });
    setCookies.push(serialize("ws_device", deviceToken, cookieOpts(DEVICE_COOKIE_DAYS * 24 * 60 * 60)));
    await logEvent(env, { shopId: shop.id, deviceId: device.id, event: "device_pending", ip, userAgent }).catch(() => {});
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

  // device.status === "approved" — issue a session via the same
  // mintSession() helper the silent trusted-device refresh in
  // wholesale-prices.js also calls, so both paths mint sessions identically.
  // `remembered` records the shop's own "Keep me signed in" choice for this
  // login — see this file's own header and mintSession's own doc comment.
  const { sessionToken } = await mintSession(env, {
    shopId: shop.id,
    deviceId: device.id,
    sessionDays: WHOLESALE_SESSION_DAYS,
    remembered: rememberDevice,
  });
  await updateDevice(env, device.id, { last_seen_at: new Date().toISOString() });
  await logEvent(env, { shopId: shop.id, deviceId: device.id, event: "login_success", ip, userAgent }).catch(() => {});

  // Checked -> the existing persistent 30-day Max-Age. Unchecked -> no
  // Max-Age at all, so the browser treats it as a session cookie and drops
  // it when it closes (cookieOpts()/wholesaleSessionCookieOptions() already
  // omits the Max-Age attribute entirely when passed `undefined` — verified
  // against the installed `cookie` package, not assumed).
  setCookies.push(
    serialize("ws_session", sessionToken, cookieOpts(rememberDevice ? WHOLESALE_SESSION_DAYS * 24 * 60 * 60 : undefined))
  );
  res.setHeader("Set-Cookie", setCookies);
  res.status(200).json({ status: "ok", shopName: shop.name });
}
