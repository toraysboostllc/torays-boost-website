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
import { resolveRecommendedPrice } from "./wholesaleMargin.js";

/** `SUPABASE_URL` must be the bare project origin (e.g.
 *  "https://xxxx.supabase.co") — every caller in this file appends its own
 *  "/rest/v1/..." or "/storage/v1/..." path on top of it. Strips exactly the
 *  trailing slash(es) a misconfigured env var commonly has, and rejects a
 *  value that already ends in "/rest/v1" outright (rather than silently
 *  producing a broken "/rest/v1/rest/v1/..." URL) — treated the same as a
 *  missing value, since either way this function is not safely configured.
 *  Returns `null` on anything invalid; never throws itself. */
export function normalizeSupabaseUrl(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed || /\/rest\/v1$/i.test(trimmed)) return null;
  return trimmed;
}

export function getEnv() {
  const SUPABASE_URL = normalizeSupabaseUrl(process.env.SUPABASE_URL);
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

/** Matches api/wholesale-admin.js's normalizeShopCode() in the DESK repo
 *  byte-for-byte on purpose — DESK trims and uppercases a shop's access code
 *  before hashing it at creation/regeneration time, so an incoming login
 *  attempt MUST be normalized the exact same way before bcrypt.compare(), or
 *  a code typed in a different case or with stray whitespace would wrongly
 *  fail to match its own hash. The two repos share no code (see this file's
 *  own header), so this is a deliberate duplicate, not an import. */
export function normalizeShopCode(raw) {
  return typeof raw === "string" ? raw.trim().toUpperCase() : "";
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

/* ===========================================================================
 * Persistent trusted device — silent session refresh. Reuses the exact same
 * cookie/token/hash primitives wholesale-login.js already established
 * (ws_device: 400-day, sha256-hashed, DB-tracked device.status; ws_session:
 * 30-day, revocable, DB-checked every request) — never a parallel mechanism.
 * On a return visit where ws_session is missing/expired but ws_device is
 * still present and approved, wholesale-prices.js calls
 * attemptSilentDeviceSessionRefresh() below BEFORE giving up with 401, so a
 * shop that already completed login + device approval once never has to
 * re-enter Shop Name/Access Code just because 30 days passed, as long as
 * nothing has explicitly revoked that trust in the meantime (logout, Close
 * sessions, a code change, a device revoke, or the shop being blocked — see
 * that function's own header for exactly how each is distinguished from a
 * plain time-expiry using only columns that already exist).
 * ===========================================================================
 */

export const WHOLESALE_SESSION_DAYS = 30; // single source of truth — both
  // wholesale-login.js's real login and this file's silent refresh mint
  // sessions with this exact same lifetime, so the two paths can never
  // silently drift apart.

/** Same cookie attributes wholesale-login.js already sets for both
 *  ws_session and ws_device (httpOnly/secure-in-production/sameSite=lax/
 *  path=/) — exported so the silently-refreshed cookie is provably
 *  byte-identical in shape to a freshly-issued one, not a re-derived
 *  parallel definition. */
export function wholesaleSessionCookieOptions(maxAgeSeconds) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/** Looks up a device by its token hash alone, with NO shop_id scoping —
 *  unlike findDeviceByTokenHash() above (used at login, where the shop is
 *  already known from the shopName field the shop just typed), a bare
 *  ws_device cookie on a silent-refresh attempt doesn't come with a shop
 *  name attached, so the shop has to be resolved FROM the device. This
 *  mirrors findActiveSessionByTokenHash()'s own established "look up by
 *  hash alone, no extra scoping" convention above — device_token_hash, like
 *  session_token_hash, is a 32-byte cryptographically random value where a
 *  cross-shop collision is not a realistic concern. */
export async function findDeviceByTokenHashAnyShop(env, tokenHash) {
  const rows = await rest(env, `wholesale_devices?device_token_hash=eq.${tokenHash}&select=*`);
  return rows[0] || null;
}

/** The single most recent session ever created for this device, in ANY
 *  state (active, expired, or revoked) — deliberately not filtered to
 *  "currently active" the way findActiveSessionByTokenHash() is, because
 *  attemptSilentDeviceSessionRefresh() below needs to see whether the most
 *  recent one was ever explicitly revoked, not just whether one happens to
 *  still be valid right now. */
export async function findMostRecentSessionForDevice(env, deviceId) {
  const rows = await rest(env, `wholesale_sessions?device_id=eq.${deviceId}&select=*&order=created_at.desc&limit=1`);
  return rows[0] || null;
}

/** Mints and stores a brand-new session for an already-approved device —
 *  extracted from wholesale-login.js's own inline session-issuing block so
 *  both the real login path and the silent-refresh path below call the
 *  SAME code, never two independent reimplementations of "create a session
 *  token, hash it, store it, hand back the plaintext token to set as a
 *  cookie." Returns the plaintext token (never stored anywhere itself —
 *  only its hash is) so the caller can set the ws_session cookie. */
export async function mintSession(env, { shopId, deviceId, sessionDays }) {
  const sessionToken = randomToken();
  const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000).toISOString();
  await createSession(env, { shopId, deviceId, tokenHash: sha256Hex(sessionToken), expiresAt });
  return { sessionToken, expiresAt };
}

/** The core of persistent trusted-device login. Returns null (never
 *  throws) in every case where a silent refresh must NOT happen — which
 *  includes every existing explicit-revocation cause the owner listed:
 *
 *   - Logout: revokeSessionByTokenHash() sets revoked_at on that session
 *     row. ws_device is deliberately left alone by logout (see
 *     wholesale-logout.js), so the device itself still looks "approved" —
 *     but its MOST RECENT session now has revoked_at set, which is exactly
 *     what the check below catches.
 *   - Admin uses "Close sessions": revokes every session for the shop the
 *     same way (revoked_at set), without touching the device at all — same
 *     signal, same result: declined.
 *   - Admin changes the Access Code (wholesale_regenerate_shop_code):
 *     revokes every session AND flips every device to 'revoked' — caught
 *     by the device.status !== 'approved' check below, independently of
 *     the session check.
 *   - Admin revokes/rejects a single device: same device.status check.
 *   - Shop blocked: same shop.status check already used everywhere else.
 *   - A device with a cookie that doesn't match any row (new browser, or a
 *     tampered/bogus token): findDeviceByTokenHashAnyShop returns null.
 *
 *  A device that simply has NO session yet (approved by an admin, but the
 *  shop never actually completed a login on this browser) is treated the
 *  same as "nothing to have been revoked" — proceed. This function never
 *  creates a wholesale_devices row under any circumstance; an unrecognized
 *  device cookie always falls through to the ordinary "please log in"
 *  path, exactly like having no cookie at all — the "every new device
 *  starts pending" rule in wholesale-login.js is completely untouched by
 *  this code path. */
export async function attemptSilentDeviceSessionRefresh(env, { deviceTokenHash, ip, userAgent }) {
  const device = await findDeviceByTokenHashAnyShop(env, deviceTokenHash).catch(() => null);
  if (!device || device.status !== "approved") return null;

  const shop = await getShopById(env, device.shop_id).catch(() => null);
  if (!shop || shop.status !== "active") return null;

  // Distinguishes "this device's session merely expired by the calendar"
  // (revoked_at still null — proceed) from "something explicitly ended
  // this trust" (revoked_at set — decline, exactly as if no device cookie
  // had been sent at all). No new column needed: revoked_at already means
  // exactly this everywhere else in the codebase.
  const mostRecent = await findMostRecentSessionForDevice(env, device.id).catch(() => null);
  if (mostRecent && mostRecent.revoked_at) return null;

  const { sessionToken } = await mintSession(env, {
    shopId: shop.id,
    deviceId: device.id,
    sessionDays: WHOLESALE_SESSION_DAYS,
  });
  await logEvent(env, {
    shopId: shop.id,
    deviceId: device.id,
    event: "session_silently_refreshed",
    ip,
    userAgent,
  }).catch(() => {});

  return { sessionToken, shop, device };
}

/** Active categories with their active services nested — what a logged-in shop sees.
 *  Kept for tests/wholesaleCatalogSeed.test.js, which verifies the seed data's
 *  visibility independently of the equipment-type/image response shape below —
 *  not used by wholesale-prices.js anymore (see buildWholesaleCatalog). */
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

/* ===========================================================================
 * Wholesale portal images — Fase 3B. Read-only: this repo never uploads or
 * mutates wholesale_images (that stays DESK's job). Every read here goes
 * through the SAME active-owner gating the rest of this file already
 * establishes (active=eq.true at the query level, never fetch-then-filter),
 * extended so a Hidden Equipment Type or Hidden category's photo can never
 * even be looked up, let alone signed — its id simply never enters the
 * `.in.()` filter below. See buildWholesaleCatalog(), the single entry point
 * wholesale-prices.js calls.
 * ========================================================================= */
const WHOLESALE_IMAGES_BUCKET = "wholesale-images";
const IMAGE_SIGN_TTL_SECONDS = 300; // 5 minutes, matches the approved plan exactly

export async function listActiveEquipmentTypes(env) {
  return rest(env, `wholesale_equipment_types?active=eq.true&select=*&order=sort_order.asc,name.asc`);
}

/** Fetches active `wholesale_images` rows owned by any of the given
 *  (already active-filtered) equipment-type/category/service ids — never a
 *  broader query filtered afterward in JS. Skips the request entirely when
 *  every list is empty (nothing to look up), and only includes the
 *  `column.in.(...)` clauses for lists that are actually non-empty — there
 *  is no `in.()` with zero values sent to PostgREST here, and a single
 *  non-empty list gets a plain `column=in.()` filter instead of a
 *  redundant one-clause `or=(...)` wrapper. */
export async function listActiveImagesForOwners(env, equipmentTypeIds, categoryIds, serviceIds = []) {
  // PostgREST's operator syntax differs between a bare filter
  // (`column=in.(...)`) and one nested inside `or=(...)` (`column.in.(...)`)
  // — built as two parallel clause lists rather than one string-replaced
  // from the other.
  const bareClauses = [
    equipmentTypeIds.length > 0 ? `equipment_type_id=in.(${equipmentTypeIds.join(",")})` : null,
    categoryIds.length > 0 ? `category_id=in.(${categoryIds.join(",")})` : null,
    serviceIds.length > 0 ? `service_id=in.(${serviceIds.join(",")})` : null,
  ].filter(Boolean);
  if (bareClauses.length === 0) return [];

  const filter = bareClauses.length === 1
    ? bareClauses[0]
    : `or=(${[
        equipmentTypeIds.length > 0 ? `equipment_type_id.in.(${equipmentTypeIds.join(",")})` : null,
        categoryIds.length > 0 ? `category_id.in.(${categoryIds.join(",")})` : null,
        serviceIds.length > 0 ? `service_id.in.(${serviceIds.join(",")})` : null,
      ].filter(Boolean).join(",")})`;

  return rest(
    env,
    `wholesale_images?active=eq.true&${filter}&select=equipment_type_id,category_id,service_id,storage_path,alt_text`
  );
}

/** ONE batch call to Supabase Storage's multi-path signing endpoint —
 *  never one signing request per image. Returns a Map of storage_path ->
 *  full signed URL; a path that errors or is simply absent from the
 *  response is left out of the map (callers treat a missing entry as
 *  `image: null`, never a broken/partial URL). Skips the Storage request
 *  completely when there are zero paths to sign.
 *
 *  Retries the WHOLE batch call exactly once on a transient failure (a
 *  non-2xx response, or the fetch itself throwing — network blip, a cold
 *  serverless instance's first outbound connection to Supabase, etc.)
 *  before giving up. This is the fix for a reported bug: every image on
 *  the portal would occasionally degrade to its icon fallback right after
 *  a shop's first request of a session, self-correcting only on a manual
 *  reload — because a one-off hiccup on this SINGLE batch call used to
 *  silently fail EVERY image in the response with no retry at all. One
 *  immediate retry absorbs exactly that class of transient failure before
 *  it ever reaches the client. */
export async function signImagePaths(env, storagePaths) {
  if (!storagePaths.length) return new Map();

  async function attemptSign() {
    return fetch(`${env.SUPABASE_URL}/storage/v1/object/sign/${WHOLESALE_IMAGES_BUCKET}`, {
      method: "POST",
      headers: headers(env),
      body: JSON.stringify({ expiresIn: IMAGE_SIGN_TTL_SECONDS, paths: storagePaths }),
    }).catch(() => null);
  }

  let res = await attemptSign();
  if (!res || !res.ok) res = await attemptSign();

  const byPath = new Map();
  if (!res || !res.ok) return byPath; // both attempts failed — every image degrades to null, catalog still returns

  const entries = await res.json().catch(() => null);
  if (!Array.isArray(entries)) return byPath;
  for (const entry of entries) {
    if (entry && !entry.error && typeof entry.path === "string" && typeof entry.signedURL === "string") {
      byPath.set(entry.path, `${env.SUPABASE_URL}/storage/v1${entry.signedURL}`);
    }
  }
  return byPath;
}

/** Fetches the single wholesale_portal_settings row (id=1, seeded by
 *  wholesale-pricing-intelligence-migration.sql — always exists). Used both
 *  to resolve each service's recommended_price (see resolveRecommendedPrice
 *  in ./wholesaleMargin.js) and to surface the Torays Boost Sales module's
 *  visible/status/entry_blocked flags to the portal. */
export async function getPortalSettings(env) {
  const rows = await rest(env, `wholesale_portal_settings?id=eq.1&select=*`);
  return rows[0] || null;
}

/** `portalSettings` is required — every caller must resolve it once (see
 *  buildWholesaleCatalog) and thread it through, never fetch it per-service.
 *  recommended_price is computed server-side ONLY (see
 *  api/_lib/wholesaleMargin.js's header for why) — this is the one place in
 *  either repo that number is attached to a service before it reaches the
 *  client. */
function toClientService(sv, portalSettings, image) {
  return {
    id: sv.id,
    slug: sv.slug,
    name: sv.name,
    // Generic, optional — available to every service (grouped or
    // direct_services), same null/empty-falls-back-to-English contract
    // wholesale_equipment_types.name_es already established. Not populated
    // for any existing service by this change; only DESK ever writes them.
    name_es: sv.name_es || null,
    description_en: sv.description_en || null,
    description_es: sv.description_es || null,
    pricing_type: sv.pricing_type,
    fixed_price: sv.fixed_price ?? null,
    price_min: sv.price_min ?? null,
    price_max: sv.price_max ?? null,
    notes: sv.notes ?? null,
    currency: sv.currency,
    recommended_price: resolveRecommendedPrice(sv, portalSettings),
    // Silver/Gold price tiers (Phase 1, pricing_type='fixed' only) — raw
    // passthrough, no formula/fallback of any kind (unlike
    // recommended_price above): the DB constraint
    // wholesale_services_price_tiers_check already guarantees these two
    // columns are either both null (legacy — the client falls back to
    // today's single recommended-price experience) or both set alongside a
    // non-null recommended_price, so the client can safely tell "complete"
    // from "legacy" just by checking these two for null.
    competitive_price: sv.competitive_price ?? null,
    high_profit_price: sv.high_profit_price ?? null,
    // Document 3 (Pricing Estimates & Independent Retail Pricing
    // Disclaimer), Section 5: informational only, never a reserved price,
    // and never fabricated — a service with zero recorded price_history
    // rows has this as `null` (wholesale-legal-migration.sql's backfill
    // deliberately leaves it null rather than inventing a date), and the
    // client must render that as a plain "no date yet" state, never a made-
    // up one.
    price_updated_at: sv.price_updated_at ?? null,
    // Per-service photo — new capability (see wholesale-catalog-
    // architecture-fix-migration.sql's uq_wholesale_images_service index).
    // Same { url, alt_text } | null shape as every other image in this
    // response; `image` is looked up by the caller and passed in, never
    // fetched here (this function stays a pure formatter).
    image: image || null,
  };
}

/** Builds the full portal response — equipment-type-grouped catalog — for a
 *  logged-in shop. Every active equipment type flows through the EXACT SAME
 *  categories -> services path, regardless of `catalog_mode` — 'grouped'
 *  (the default) and 'direct_services' (today: Microsoldering) differ only
 *  in the `catalog_mode` value attached to each card; a direct_services
 *  card simply has exactly one (DESK-managed, internal) category, so it
 *  needs no special-cased query or branch here at all. This replaced the
 *  prior tag-based ("tag_lens") mechanism entirely — see
 *  wholesale-catalog-architecture-fix-migration.sql for why (Microsoldering
 *  was never meant to be an aggregation of OTHER equipment types' tagged
 *  services; it is its own card with its own directly-owned services).
 *
 *  Fixed query count regardless of catalog size: 3 catalog fetches
 *  (equipment types, categories, services) + 1 portal settings fetch + 1
 *  images fetch (equipment types + categories + services in one call) = 5
 *  Postgres round-trips, plus at most ONE batch Storage signing call.
 *  Never returns `storage_path` — only `{ url, alt_text }` per image, or
 *  `null`. Every service's `recommended_price` is resolved here, once,
 *  from the SAME portalSettings row fetched at the top — never refetched
 *  per service.
 *
 *  MICROSOLDERING WIRE SPLIT (see the dedicated comment further down, right
 *  where it happens, for the full reproduced-bug rationale): the
 *  Microsoldering row is pulled OUT of `equipmentTypes` before the response
 *  is built and returned in its own `microsolderingEquipmentType` field
 *  instead — the ONE deliberate, narrow exception to "every equipment type
 *  is a plain equipmentTypes[] member" in this file, needed only because
 *  git main's still-deployed WholesaleWizard.jsx renders an unconditional
 *  manual tile from a separate legacy key and would double-render
 *  Microsoldering if it were also a normal array member. The CURRENT
 *  client (wholesaleWizardCatalog.js) merges that field straight back into
 *  the same unified pipeline every other equipment type already flows
 *  through. `tagLensEquipmentTypes`, the OLDER (tag-based) version of this
 *  same idea, is REMOVED entirely — nothing in Production ever shipped
 *  reading it.
 *
 *  LEGACY COMPATIBILITY (TEMPORARY — remove once this deploy has been live
 *  and verified for a while): the response ALSO carries a top-level
 *  `microsoldering` key, in the OLD pre-unification nested shape
 *  (`{ id, name, image, equipmentTypes: [{ id, name, categories: [{ id,
 *  slug, name, services }] }] }`) that git `main`'s WholesaleWizard.jsx
 *  actually reads for its manual tile and click-through. Built from the
 *  SAME extracted row as `microsolderingEquipmentType` above, wrapped as
 *  ONE synthetic "equipment type" entry containing the real Microsoldering
 *  card's own (single, internal) category and its real services — never a
 *  second query, never invented data. */
export async function buildWholesaleCatalog(env) {
  const [equipmentTypes, categories, services, portalSettings] = await Promise.all([
    listActiveEquipmentTypes(env),
    rest(env, `wholesale_categories?active=eq.true&select=*&order=sort_order.asc,name.asc`),
    rest(env, `wholesale_services?active=eq.true&select=*&order=sort_order.asc,name.asc`),
    getPortalSettings(env),
  ]);

  const categoriesByEquipmentType = new Map();
  for (const cat of categories) {
    // Defensive: a category with no equipment_type_id (should not happen —
    // DESK requires it for every category it creates) can't be placed in
    // the grouped hierarchy, so it's excluded rather than guessed at.
    if (!cat.equipment_type_id) continue;
    if (!categoriesByEquipmentType.has(cat.equipment_type_id)) categoriesByEquipmentType.set(cat.equipment_type_id, []);
    categoriesByEquipmentType.get(cat.equipment_type_id).push(cat);
  }

  const servicesByCategory = new Map();
  for (const sv of services) {
    if (!servicesByCategory.has(sv.category_id)) servicesByCategory.set(sv.category_id, []);
    servicesByCategory.get(sv.category_id).push(sv);
  }

  // -- images: one fetch for every active owner id (equipment type,
  //    category, AND service now — see uq_wholesale_images_service), then
  //    one batch sign --
  const equipmentTypeIds = equipmentTypes.map((et) => et.id);
  const categoryIds = categories.filter((c) => c.equipment_type_id).map((c) => c.id);
  const serviceIds = services.map((s) => s.id);

  const imageRows = await listActiveImagesForOwners(env, equipmentTypeIds, categoryIds, serviceIds);
  const signedByPath = await signImagePaths(env, imageRows.map((row) => row.storage_path));

  const imageByEquipmentType = new Map();
  const imageByCategory = new Map();
  const imageByService = new Map();
  for (const row of imageRows) {
    const url = signedByPath.get(row.storage_path) || null;
    const image = url ? { url, alt_text: row.alt_text || null } : null;
    if (row.equipment_type_id) imageByEquipmentType.set(row.equipment_type_id, image);
    else if (row.category_id) imageByCategory.set(row.category_id, image);
    else if (row.service_id) imageByService.set(row.service_id, image);
  }

  function toClientCategory(cat) {
    return {
      id: cat.id,
      slug: cat.slug,
      name: cat.name,
      notes: cat.notes ?? null,
      diagnostic_fee: cat.diagnostic_fee ?? null,
      diagnostic_description: cat.diagnostic_description ?? null,
      image: imageByCategory.get(cat.id) || null,
      services: (servicesByCategory.get(cat.id) || []).map((sv) => toClientService(sv, portalSettings, imageByService.get(sv.id))),
    };
  }

  const equipmentTypesOut = equipmentTypes
    .map((et) => ({
      id: et.id,
      slug: et.slug,
      name: et.name,
      name_es: et.name_es || null,
      // 'grouped' | 'direct_services' — the sole signal for how a card's
      // model-selection step behaves; see wholesaleWizardCatalog.js. Never
      // gated on slug anywhere in this file or the client.
      catalog_mode: et.catalog_mode || "grouped",
      full_bleed_photo: Boolean(et.full_bleed_photo),
      image_focus_x: et.image_focus_x ?? 50,
      image_focus_y: et.image_focus_y ?? 50,
      image: imageByEquipmentType.get(et.id) || null,
      sort_order: et.sort_order,
      categories: (categoriesByEquipmentType.get(et.id) || [])
        .map(toClientCategory)
        .filter((cat) => cat.services.length > 0),
    }))
    // Same "hide if empty" rule for every card, grouped or direct_services
    // alike — a fresh, content-free Microsoldering (or any future
    // direct_services card) simply has zero categories yet, so it's
    // excluded here exactly like an empty grouped card always has been.
    .filter((et) => et.categories.length > 0);

  // MICROSOLDERING WIRE SPLIT — the ONE deliberate, narrow, backward-
  // compat-only exception to "never gate on slug": git main's still-
  // deployed WholesaleWizard.jsx renders an UNCONDITIONAL manual tile
  // whenever `data.microsoldering` is non-null, IN ADDITION TO its own
  // generic loop over `data.equipmentTypes`. If the Microsoldering row
  // stayed a normal member of `equipmentTypesOut` (which is the
  // architecturally correct place for it — see this function's own
  // header), an already-open old client tab would render it TWICE: once
  // via the manual tile, once via its own unmodified per-equipment-type
  // loop. This was a REAL, reproduced duplicate-card bug found while
  // testing this exact stale-tab scenario against a real snapshot of
  // main's WholesaleWizard.jsx — not a hypothetical. The fix: pull the
  // Microsoldering row OUT of `equipmentTypesOut` before it's sent, into
  // its own `microsolderingEquipmentType` field; the CURRENT client (see
  // wholesaleWizardCatalog.js) merges it straight back into the same
  // unified pipeline every other equipment type already flows through —
  // genuinely one pipeline, the split exists ONLY at the wire level, for
  // this one specific old-client hardcoded reader. This does NOT
  // generalize to a future second direct_services card: only
  // 'microsoldering' has a legacy `data.microsoldering` reader in old
  // client code, so only it needs this treatment.
  const microsolderingIndex = equipmentTypesOut.findIndex((et) => et.slug === "microsoldering" && et.catalog_mode === "direct_services");
  const microsolderingOut = microsolderingIndex >= 0 ? equipmentTypesOut.splice(microsolderingIndex, 1)[0] : null;

  // LEGACY COMPATIBILITY BRIDGE — see this function's own header for the
  // full rationale and removal plan. Nested shape, DIFFERENT from
  // `microsolderingEquipmentType` above (which is flat, for the current
  // client) — built from the SAME extracted row so it can never drift.
  const legacyMicrosoldering = microsolderingOut
    ? {
        id: microsolderingOut.id,
        slug: microsolderingOut.slug,
        name: microsolderingOut.name,
        name_es: microsolderingOut.name_es,
        full_bleed_photo: microsolderingOut.full_bleed_photo,
        image_focus_x: microsolderingOut.image_focus_x,
        image_focus_y: microsolderingOut.image_focus_y,
        image: microsolderingOut.image,
        sort_order: microsolderingOut.sort_order,
        equipmentTypes: [{ id: microsolderingOut.id, name: microsolderingOut.name, categories: microsolderingOut.categories }],
      }
    : null;

  return {
    equipmentTypes: equipmentTypesOut,
    // PRIMARY channel for the current client to recover Microsoldering —
    // see the wire-split comment above. Same per-card shape as
    // `equipmentTypes`'s own entries; `null` when Microsoldering has no
    // content yet (same "hide if empty" rule, nothing special).
    microsolderingEquipmentType: microsolderingOut,
    // LEGACY, TEMPORARY — see this function's own header for what this is
    // and the removal plan. The current client only consults it as a
    // fallback, when `microsolderingEquipmentType` itself is absent (an
    // old server — see wholesaleWizardCatalog.js).
    microsoldering: legacyMicrosoldering,
    // Read-only for the portal — shops never write either of these. Falls
    // back to safe, conservative defaults (maintenance + blocked, no
    // rounding) if the singleton settings row is somehow missing, rather
    // than throwing and breaking the whole catalog response over it.
    salesModule: {
      visible: portalSettings?.sales_visible ?? true,
      status: portalSettings?.sales_status ?? "maintenance",
      entryBlocked: portalSettings?.sales_entry_blocked ?? true,
    },
    // Global service warranty (Wholesale Shops -> Catalog -> Pricing &
    // Sales Settings in DESK) — ONE setting for the whole portal, applied
    // to every quote alike. Never a per-service/per-equipment-type/
    // per-model concept: this object is built exclusively from the same
    // singleton portalSettings row salesModule above already reads, never
    // from `service`/`equipmentTypes`/anything else. `?? false`/`?? null`
    // throughout — see wholesale-global-warranty-migration.sql — is what
    // keeps this endpoint working unchanged against a database where that
    // migration hasn't run yet: portalSettings simply won't have these 4
    // columns at all (a plain `select *`, not a column list that would
    // error on a missing column), so every field here safely falls back to
    // "warranty off", exactly like a freshly migrated, never-configured
    // database would report.
    warranty: {
      enabled: portalSettings?.warranty_enabled ?? false,
      durationDays: portalSettings?.warranty_duration_days ?? null,
      termsEn: portalSettings?.warranty_terms_en ?? null,
      termsEs: portalSettings?.warranty_terms_es ?? null,
    },
  };
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

/* ===========================================================================
 * Torays Boost Pro Legal Bundle — wholesale_legal_documents /
 * wholesale_legal_acceptances (supabase/wholesale-legal-migration.sql).
 * ========================================================================= */

/** The single currently-live version of the 6-document bundle, or `null`
 *  if nothing has ever been published yet (a fresh install before an admin
 *  runs wholesale_publish_legal_document_v2) — callers must treat `null` as
 *  "the legal-acceptance gate is not active yet for this type", never as an
 *  error. Since wholesale-legal-document-types-migration.sql, the "at most
 *  one published row" guarantee is scoped PER document_type
 *  (idx_wholesale_legal_documents_one_published_per_type) — a bare
 *  status=eq.published filter with no type would return one row per
 *  existing type, so `documentType` is always required and `rows[0]` is
 *  the right (and only) one FOR THAT TYPE. */
export async function getPublishedLegalDocumentByType(env, documentType) {
  const rows = await rest(
    env,
    `wholesale_legal_documents?status=eq.published&document_type=eq.${documentType}&select=id,version,content_en,content_es,content_hash,published_at`
  );
  return rows[0] || null;
}

/** The original master-agreement bundle (6 documents, EN+ES) — kept as its
 *  own exported name so every existing caller (wholesale-prices.js,
 *  wholesale-legal-documents.js) needs zero changes; it is now a thin,
 *  type-scoped call into getPublishedLegalDocumentByType above. */
export function getPublishedLegalDocument(env) {
  return getPublishedLegalDocumentByType(env, "master_agreement");
}

/** The new, lightweight standalone disclaimer — accepted IN PARALLEL with
 *  the master agreement above, never instead of it. See wholesale-legal-
 *  document-types-migration.sql's own header for the full "why two
 *  independent document types" reasoning. */
export function getPublishedEstimateDisclaimer(env) {
  return getPublishedLegalDocumentByType(env, "estimate_disclaimer");
}

/** Whether this shop already has a recorded acceptance of this exact
 *  legal_document_id — never "any acceptance ever", always scoped to the
 *  CURRENTLY published version, so a shop that accepted an older superseded
 *  version is correctly treated as not-yet-accepted for a newer one. */
export async function hasAcceptedLegalDocument(env, shopId, legalDocumentId) {
  const rows = await rest(
    env,
    `wholesale_legal_acceptances?shop_id=eq.${shopId}&legal_document_id=eq.${legalDocumentId}&select=id&limit=1`
  );
  return rows.length > 0;
}

/** Same shape as hasAcceptedLegalDocument, against the estimate disclaimer's
 *  own separate acceptances table. */
export async function hasAcceptedEstimateDisclaimer(env, shopId, legalDocumentId) {
  const rows = await rest(
    env,
    `wholesale_estimate_disclaimer_acceptances?shop_id=eq.${shopId}&legal_document_id=eq.${legalDocumentId}&select=id&limit=1`
  );
  return rows.length > 0;
}

/** Calls a Postgres RPC directly (not through rest()) because a RAISE
 *  EXCEPTION inside the function — e.g. wholesale_accept_legal_terms
 *  rejecting an incomplete checkbox set — must reach the caller as
 *  structured detail (PostgREST's {code, message, details, hint} body), not
 *  as rest()'s generic thrown Error. Never throws itself; the caller always
 *  gets back {ok, status, data} and decides what each specific rejection
 *  reason means for its own response. */
export async function callWholesaleRpc(env, fnName, args) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: "POST",
    headers: headers(env),
    body: JSON.stringify(args),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text.trim() ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}
