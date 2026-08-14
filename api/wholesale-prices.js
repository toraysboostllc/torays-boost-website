/**
 * Vercel Function — returns the wholesale catalog (categories + services)
 * for a valid session. Session travels as the HttpOnly `ws_session` cookie
 * set by wholesale-login.js — never a header, never localStorage.
 * Re-checks shop status and device approval on every call (not just at
 * login) so a block/revoke from the admin module takes effect immediately.
 */
import { parse } from "cookie";
import {
  getEnv,
  setPrivateHeaders,
  sha256Hex,
  findActiveSessionByTokenHash,
  getShopById,
  getDeviceById,
  updateDevice,
  listActiveCatalog,
  revokeSessionByTokenHash,
} from "./_lib/wholesaleDb.js";

const SESSION_TOKEN_MAX = 128;

export default async function handler(req, res) {
  setPrivateHeaders(res);

  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed", message: "Method not allowed." });
    return;
  }

  let env;
  try {
    env = getEnv();
  } catch {
    res.status(500).json({ error: "not_configured", message: "Wholesale prices aren't configured on the server yet." });
    return;
  }

  const cookies = parse(req.headers.cookie || "");
  const token = cookies.ws_session || null;
  if (!token || token.length > SESSION_TOKEN_MAX) {
    res.status(401).json({ error: "unauthorized", message: "Missing session." });
    return;
  }

  const tokenHash = sha256Hex(token);
  const session = await findActiveSessionByTokenHash(env, tokenHash).catch(() => null);
  if (!session) {
    res.status(401).json({ error: "unauthorized", message: "Session expired or invalid. Please log in again." });
    return;
  }

  const [shop, device] = await Promise.all([
    getShopById(env, session.shop_id),
    getDeviceById(env, session.device_id),
  ]);

  if (!shop || shop.status !== "active" || !device || device.status !== "approved") {
    await revokeSessionByTokenHash(env, tokenHash).catch(() => {});
    res.status(403).json({ error: "access_revoked", message: "Access to wholesale pricing has been revoked." });
    return;
  }

  await updateDevice(env, device.id, { last_seen_at: new Date().toISOString() });

  const categories = await listActiveCatalog(env).catch(() => null);
  if (!categories) {
    res.status(502).json({ error: "data_read_failed", message: "Could not load prices right now." });
    return;
  }

  res.status(200).json({ shopName: shop.name, categories });
}
