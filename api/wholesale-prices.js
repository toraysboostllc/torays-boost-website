/**
 * Vercel Function — returns the wholesale catalog (equipment types →
 * categories → services, plus the Microsoldering lens) for a valid session.
 * Session travels as the HttpOnly `ws_session` cookie set by
 * wholesale-login.js — never a header, never localStorage. Re-checks shop
 * status and device approval on every call (not just at login) so a
 * block/revoke from the admin module takes effect immediately.
 *
 * Fase 3B: also resolves each active Equipment Type's/category's cover
 * photo to a short-lived (5 minute) signed Storage URL — see
 * buildWholesaleCatalog() in _lib/wholesaleDb.js for the query/signing
 * detail. A Hidden Equipment Type, Hidden category, or Hidden image can
 * never reach this response: buildWholesaleCatalog() only ever looks up
 * images for owners it already fetched with active=eq.true.
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
  buildWholesaleCatalog,
  revokeSessionByTokenHash,
  getPublishedLegalDocument,
  hasAcceptedLegalDocument,
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

  // Torays Boost Pro Legal Bundle gate — re-checked on EVERY call, not just
  // the first one after login: a shop that was already inside the portal
  // when an admin publishes a new version must be gated on its very next
  // catalog fetch, exactly like the shop/device status re-check above. A
  // fresh install with nothing published yet (getPublishedLegalDocument()
  // returns null) skips this gate entirely — the feature simply isn't
  // active until an admin publishes a first version. Deliberately its own
  // distinct error code — 'legal_acceptance_required' — and never the
  // 'unauthorized'/'access_revoked' codes used above: the session and the
  // device are both genuinely fine here, so the frontend must be able to
  // tell "log in again" apart from "show the clickwrap modal" instead of
  // treating both the same way.
  const publishedLegalDoc = await getPublishedLegalDocument(env).catch(() => null);
  if (publishedLegalDoc) {
    const accepted = await hasAcceptedLegalDocument(env, shop.id, publishedLegalDoc.id).catch(() => false);
    if (!accepted) {
      res.status(403).json({
        error: "legal_acceptance_required",
        legalDocumentId: publishedLegalDoc.id,
        version: publishedLegalDoc.version,
        message: "Please review and accept the Torays Boost Pro legal terms to continue.",
      });
      return;
    }
  }

  const catalog = await buildWholesaleCatalog(env).catch(() => null);
  if (!catalog) {
    res.status(502).json({ error: "data_read_failed", message: "Could not load prices right now." });
    return;
  }

  res.status(200).json({
    shopName: shop.name,
    equipmentTypes: catalog.equipmentTypes,
    tagLensEquipmentTypes: catalog.tagLensEquipmentTypes,
    // LEGACY, TEMPORARY — see api/_lib/wholesaleDb.js's own comment.
    microsoldering: catalog.microsoldering,
    salesModule: catalog.salesModule,
  });
}
