/**
 * Vercel Function — records a shop's acceptance of the currently published
 * Estimate Disclaimer. Requires the same valid `ws_session` HttpOnly cookie
 * every other wholesale-*.js endpoint requires — session/device/shop are
 * revalidated here with the EXACT same lookup wholesale-prices.js already
 * does, not a lighter version of it.
 *
 * Lightweight by design (unlike wholesale-accept-legal.js): a SINGLE
 * checkbox, no representative name/title. The checkbox, the locale, and
 * that legalDocumentId matches the CURRENTLY published estimate_disclaimer
 * are re-validated again inside wholesale_accept_estimate_disclaimer()
 * itself (see supabase/wholesale-legal-document-types-migration.sql) — the
 * checks in this handler are a fast, friendly first pass, never a
 * substitute for the database's own enforcement.
 */
import { parse } from "cookie";
import {
  getEnv,
  setPrivateHeaders,
  sha256Hex,
  findActiveSessionByTokenHash,
  getShopById,
  getDeviceById,
  callWholesaleRpc,
  logEvent,
  clientIp,
} from "./_lib/wholesaleDb.js";

const SESSION_TOKEN_MAX = 128;

/** Maps a RAISE EXCEPTION message from wholesale_accept_estimate_disclaimer()
 *  to the {status, error} this endpoint returns — every message the
 *  function can raise (see the migration) is listed explicitly here so a
 *  message the function is never expected to raise falls through to the
 *  generic 500, rather than a guessed status code. */
const RPC_ERROR_MAP = {
  checkbox_required: { status: 400, error: "checkbox_required" },
  invalid_locale: { status: 400, error: "invalid_locale" },
  document_not_published: { status: 409, error: "document_superseded" },
  shop_not_active: { status: 403, error: "shop_not_active" },
};

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
    res.status(500).json({ error: "not_configured", message: "Estimate disclaimer acceptance isn't configured on the server yet." });
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
    res.status(403).json({ error: "access_revoked", message: "Access to wholesale pricing has been revoked." });
    return;
  }

  let body = {};
  try {
    body = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
  } catch {
    body = {};
  }

  const legalDocumentId = typeof body.legalDocumentId === "string" ? body.legalDocumentId : "";
  const locale = typeof body.locale === "string" ? body.locale : "";
  const accepted = body.accepted === true;

  if (!legalDocumentId || !["en", "es"].includes(locale)) {
    res.status(400).json({ error: "invalid_request", message: "Missing or invalid required fields." });
    return;
  }

  if (!accepted) {
    res.status(400).json({ error: "checkbox_required", message: "You must accept the Terms and Conditions to continue." });
    return;
  }

  const ip = clientIp(req);
  const userAgent = req.headers["user-agent"] || null;

  const rpcResult = await callWholesaleRpc(env, "wholesale_accept_estimate_disclaimer", {
    p_shop_id: shop.id,
    p_device_id: device.id,
    p_session_id: session.id,
    p_legal_document_id: legalDocumentId,
    p_accepts_terms: true,
    p_locale: locale,
    p_ip: ip,
    p_user_agent: userAgent,
  }).catch(() => null);

  if (!rpcResult) {
    res.status(503).json({ error: "service_unavailable", message: "Service temporarily unavailable. Please try again shortly." });
    return;
  }

  if (!rpcResult.ok) {
    const rpcMessage = rpcResult.data?.message || "";
    const mapped = RPC_ERROR_MAP[rpcMessage];
    if (mapped) {
      res.status(mapped.status).json({ error: mapped.error, message: "Could not record acceptance." });
      return;
    }
    console.error("wholesale-accept-estimate-disclaimer: RPC failed", rpcResult.status, rpcMessage);
    res.status(500).json({ error: "acceptance_failed", message: "Could not record acceptance right now." });
    return;
  }

  await logEvent(env, { shopId: shop.id, deviceId: device.id, event: "estimate_disclaimer_accepted", ip, userAgent }).catch(() => {});

  res.status(200).json({ status: "ok", acceptanceId: rpcResult.data });
}
