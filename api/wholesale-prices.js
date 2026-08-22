/**
 * Vercel Function — returns the wholesale catalog (equipment types →
 * categories → services, including the direct-services Microsoldering card)
 * for a valid session.
 * Session travels as the HttpOnly `ws_session` cookie set by
 * wholesale-login.js — never a header, never localStorage. Re-checks shop
 * status and device approval on every call (not just at login) so a
 * block/revoke from the admin module takes effect immediately.
 *
 * Persistent trusted device: if ws_session is missing/expired but ws_device
 * is present and still points at an approved device whose most recent
 * session was never explicitly revoked, a fresh session is silently minted
 * here (see attemptSilentDeviceSessionRefresh in _lib/wholesaleDb.js) BEFORE
 * giving up with 401 — so a shop that already completed login + device
 * approval once doesn't have to re-enter Shop Name/Access Code just because
 * 30 days passed. Every existing revocation cause (logout, Close sessions,
 * a code change, a device revoke, the shop being blocked) still forces a
 * real login, exactly as before — see that function's own header for how
 * each is distinguished from plain time-expiry.
 *
 * Fase 3B: also resolves each active Equipment Type's/category's cover
 * photo to a short-lived (5 minute) signed Storage URL — see
 * buildWholesaleCatalog() in _lib/wholesaleDb.js for the query/signing
 * detail. A Hidden Equipment Type, Hidden category, or Hidden image can
 * never reach this response: buildWholesaleCatalog() only ever looks up
 * images for owners it already fetched with active=eq.true.
 */
import { parse, serialize } from "cookie";
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
  getPublishedEstimateDisclaimer,
  hasAcceptedEstimateDisclaimer,
  attemptSilentDeviceSessionRefresh,
  wholesaleSessionCookieOptions,
  WHOLESALE_SESSION_DAYS,
  clientIp,
} from "./_lib/wholesaleDb.js";

const SESSION_TOKEN_MAX = 128;
const DEVICE_TOKEN_MAX = 128;

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
  const sessionToken = cookies.ws_session || null;
  const rawDeviceToken = cookies.ws_device || null;
  const deviceToken = rawDeviceToken && rawDeviceToken.length <= DEVICE_TOKEN_MAX ? rawDeviceToken : null;

  let session =
    sessionToken && sessionToken.length <= SESSION_TOKEN_MAX
      ? await findActiveSessionByTokenHash(env, sha256Hex(sessionToken)).catch(() => null)
      : null;

  // No valid session cookie (missing, malformed, or genuinely expired) —
  // attempt a silent trusted-device refresh before giving up. Only runs
  // when there was no valid session to begin with; a shop with an already-
  // valid session never touches this path.
  let newSessionCookie = null;
  if (!session && deviceToken) {
    const refreshed = await attemptSilentDeviceSessionRefresh(env, {
      deviceTokenHash: sha256Hex(deviceToken),
      ip: clientIp(req),
      userAgent: req.headers["user-agent"] || null,
    }).catch(() => null);
    if (refreshed) {
      // Enough shape for the shop/device recheck and the rest of this
      // handler below — the real row is re-fetched via getShopById/
      // getDeviceById immediately after, same as the cookie-based path.
      session = { shop_id: refreshed.shop.id, device_id: refreshed.device.id };
      newSessionCookie = serialize(
        "ws_session",
        refreshed.sessionToken,
        wholesaleSessionCookieOptions(WHOLESALE_SESSION_DAYS * 24 * 60 * 60)
      );
    }
  }

  if (!session) {
    res.status(401).json({ error: "unauthorized", message: "Session expired or invalid. Please log in again." });
    return;
  }

  const [shop, device] = await Promise.all([
    getShopById(env, session.shop_id),
    getDeviceById(env, session.device_id),
  ]);

  if (!shop || shop.status !== "active" || !device || device.status !== "approved") {
    // Defense-in-depth: attemptSilentDeviceSessionRefresh() already checked
    // shop/device status before minting, so this branch is only realistically
    // reachable via the ordinary cookie-based session path (a session that
    // was valid moments ago but whose shop/device has since been
    // blocked/revoked) — kept exactly as before for that case. Only revoke
    // by hash when a real session TOKEN was actually presented; a silently-
    // refreshed session has no incoming token to revoke (nothing was ever
    // trusted from a bad cookie in that path to begin with).
    if (sessionToken) await revokeSessionByTokenHash(env, sha256Hex(sessionToken)).catch(() => {});
    res.status(403).json({ error: "access_revoked", message: "Access to wholesale pricing has been revoked." });
    return;
  }

  // A silently-refreshed session's cookie is set only once the shop/device
  // recheck above has passed — never on the access_revoked path, and never
  // before it.
  if (newSessionCookie) res.setHeader("Set-Cookie", newSessionCookie);

  await updateDevice(env, device.id, { last_seen_at: new Date().toISOString() });

  // Legal acceptance gates — re-checked on EVERY call, not just the first
  // one after login: a shop that was already inside the portal when an
  // admin publishes a new version must be gated on its very next catalog
  // fetch, exactly like the shop/device status re-check above. TWO
  // independent gates, both required, neither replacing the other — the
  // existing Torays Boost Pro Legal Bundle (master agreement, 6 documents)
  // and the lightweight Estimate Disclaimer (see wholesale-legal-document-
  // types-migration.sql). Reported in a fixed priority order
  // (master_agreement first) so the client always knows which single gate
  // to show next without needing its own sequencing logic — accepting one
  // and re-fetching naturally surfaces the next, exactly the same
  // onAccepted={loadCatalog} loop the client already used for one gate. A
  // fresh install / pre-migration environment with nothing published yet
  // for a given type skips that type's gate entirely (getPublished*
  // returns null) — this is unaffected by whether the OTHER type has ever
  // been published.
  const [masterDoc, disclaimerDoc] = await Promise.all([
    getPublishedLegalDocument(env).catch(() => null),
    getPublishedEstimateDisclaimer(env).catch(() => null),
  ]);
  const missingLegal = [];
  if (masterDoc && !(await hasAcceptedLegalDocument(env, shop.id, masterDoc.id).catch(() => false))) {
    missingLegal.push({ documentType: "master_agreement", legalDocumentId: masterDoc.id, version: masterDoc.version });
  }
  if (disclaimerDoc && !(await hasAcceptedEstimateDisclaimer(env, shop.id, disclaimerDoc.id).catch(() => false))) {
    missingLegal.push({ documentType: "estimate_disclaimer", legalDocumentId: disclaimerDoc.id, version: disclaimerDoc.version });
  }
  if (missingLegal.length) {
    res.status(403).json({
      error: "legal_acceptance_required",
      missing: missingLegal,
      // Flat fields mirror missing[0] — kept for any caller still reading
      // the pre-dual-gate shape directly; every real caller in this
      // codebase (fetchWholesaleCatalog in src/lib/wholesaleAuth.js) reads
      // both.
      documentType: missingLegal[0].documentType,
      legalDocumentId: missingLegal[0].legalDocumentId,
      version: missingLegal[0].version,
      message: "Please review and accept the Torays Boost Pro legal terms to continue.",
    });
    return;
  }

  const catalog = await buildWholesaleCatalog(env).catch(() => null);
  if (!catalog) {
    res.status(502).json({ error: "data_read_failed", message: "Could not load prices right now." });
    return;
  }

  res.status(200).json({
    shopName: shop.name,
    equipmentTypes: catalog.equipmentTypes,
    // Microsoldering wire split — see api/_lib/wholesaleDb.js's own comment.
    microsolderingEquipmentType: catalog.microsolderingEquipmentType,
    // LEGACY, TEMPORARY — see api/_lib/wholesaleDb.js's own comment.
    microsoldering: catalog.microsoldering,
    salesModule: catalog.salesModule,
    // Global service warranty — see api/_lib/wholesaleDb.js's own comment.
    warranty: catalog.warranty,
  });
}
