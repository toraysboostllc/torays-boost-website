/**
 * Shared helpers for the wholesale gateway serverless functions.
 * Prefixed folder (`_lib`) so Vercel does NOT expose this as a route —
 * it's only ever imported by the actual api/wholesale-*.js handlers.
 *
 * Every call here uses the Supabase SERVICE ROLE key (bypasses RLS on
 * purpose — see supabase/wholesale-migration.sql). This file must never
 * be imported from client-side code.
 */
import crypto from "node:crypto";

export function getEnv() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  // SUPABASE_SECRET_KEY is Supabase's modern replacement for the legacy
  // service_role JWT — same bypass-RLS privilege, new key format. Prefer it
  // when present; SUPABASE_SERVICE_ROLE_KEY stays supported as a fallback
  // for installs that haven't rotated yet.
  const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("not_configured");
  }
  return { SUPABASE_URL, SERVICE_KEY };
}

/**
 * Every wholesale-*.js response carries pricing/session-adjacent data —
 * call this first thing in every handler, before any other res.* call, so
 * it's on every response path including early errors.
 *  - Cache-Control: private, no-store — never cached by a browser, proxy, or CDN.
 *  - X-Robots-Tag: belt-and-suspenders alongside the HTML-level noindex in
 *    vercel.json/robots.txt — these are JSON API responses, not pages, but
 *    it costs nothing to say it here too.
 */
export function setPrivateHeaders(res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
}

function headers(env) {
  return {
    apikey: env.SERVICE_KEY,
    Authorization: `Bearer ${env.SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

export function randomToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function rest(env, path, options = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: { ...headers(env), ...(options.headers || {}) },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`supabase_rest_failed: ${res.status} ${detail}`);
  }
  // Real PostgREST sends an empty body on more than just 204 — a POST with
  // Prefer: return=minimal answers 201 Created with NO body, not 204. Reading
  // as text first (and only parsing when there's actually something to parse)
  // handles every "no body" case Supabase can send, instead of assuming 204
  // is the only one — that wrong assumption is what silently crashed
  // createSession() after a successful insert (see wholesale-login.js).
  const text = await res.text();
  return text.trim() ? JSON.parse(text) : null;
}
export { rest };

export async function getShopByName(env, name) {
  const rows = await rest(env, `wholesale_shops?name=eq.${encodeURIComponent(name)}&select=*`);
  return rows[0] || null;
}

export async function updateShop(env, id, patch) {
  await rest(env, `wholesale_shops?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
}

export async function findDeviceByTokenHash(env, shopId, tokenHash) {
  const rows = await rest(
    env,
    `wholesale_devices?shop_id=eq.${shopId}&device_token_hash=eq.${tokenHash}&select=*`
  );
  return rows[0] || null;
}

export async function createDevice(env, { shopId, tokenHash, status, userAgent }) {
  const rows = await rest(env, `wholesale_devices`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      shop_id: shopId,
      device_token_hash: tokenHash,
      status,
      user_agent: userAgent || null,
      approved_at: status === "approved" ? new Date().toISOString() : null,
    }),
  });
  return rows[0];
}

export async function updateDevice(env, id, patch) {
  await rest(env, `wholesale_devices?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
}

export async function createSession(env, { shopId, deviceId, tokenHash, expiresAt }) {
  await rest(env, `wholesale_sessions`, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      shop_id: shopId,
      device_id: deviceId,
      session_token_hash: tokenHash,
      expires_at: expiresAt,
    }),
  });
}

export async function findActiveSessionByTokenHash(env, tokenHash) {
  const nowIso = new Date().toISOString();
  const rows = await rest(
    env,
    `wholesale_sessions?session_token_hash=eq.${tokenHash}&revoked_at=is.null&expires_at=gt.${encodeURIComponent(
      nowIso
    )}&select=*`
  );
  return rows[0] || null;
}

export async function revokeSessionByTokenHash(env, tokenHash) {
  await rest(env, `wholesale_sessions?session_token_hash=eq.${tokenHash}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ revoked_at: new Date().toISOString() }),
  });
}

export async function getShopById(env, id) {
  const rows = await rest(env, `wholesale_shops?id=eq.${id}&select=*`);
  return rows[0] || null;
}

export async function getDeviceById(env, id) {
  const rows = await rest(env, `wholesale_devices?id=eq.${id}&select=*`);
  return rows[0] || null;
}

/** Active categories with their active services nested — what a logged-in shop sees. */
export async function listActiveCatalog(env) {
  const [categories, services] = await Promise.all([
    rest(env, `wholesale_categories?active=eq.true&select=*&order=sort_order.asc,name.asc`),
    rest(env, `wholesale_services?active=eq.true&select=*&order=sort_order.asc,name.asc`),
  ]);
  const byCategory = new Map();
  for (const s of services) {
    if (!byCategory.has(s.category_id)) byCategory.set(s.category_id, []);
    byCategory.get(s.category_id).push(s);
  }
  return categories
    .map((c) => ({ ...c, services: byCategory.get(c.id) || [] }))
    .filter((c) => c.services.length > 0);
}

export async function logEvent(env, { shopId, deviceId, event, ip, userAgent }) {
  await rest(env, `wholesale_access_log`, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      shop_id: shopId || null,
      device_id: deviceId || null,
      event,
      ip: ip || null,
      user_agent: userAgent || null,
    }),
  });
}

export function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || null;
}
