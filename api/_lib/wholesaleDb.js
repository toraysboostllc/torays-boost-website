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
 *  (already active-filtered) equipment-type/category ids — never a broader
 *  query filtered afterward in JS. Skips the request entirely when both id
 *  lists are empty (nothing to look up), and builds a plain `column=in.()`
 *  filter instead of an `or=(...)` wrapper when only one list is non-empty,
 *  so an empty side of the pair never has to appear in the filter string at
 *  all — there is no `in.()` with zero values sent to PostgREST here. */
export async function listActiveImagesForOwners(env, equipmentTypeIds, categoryIds) {
  const hasEquipmentTypes = equipmentTypeIds.length > 0;
  const hasCategories = categoryIds.length > 0;
  if (!hasEquipmentTypes && !hasCategories) return [];

  let filter;
  if (hasEquipmentTypes && hasCategories) {
    filter = `or=(equipment_type_id.in.(${equipmentTypeIds.join(",")}),category_id.in.(${categoryIds.join(",")}))`;
  } else if (hasEquipmentTypes) {
    filter = `equipment_type_id=in.(${equipmentTypeIds.join(",")})`;
  } else {
    filter = `category_id=in.(${categoryIds.join(",")})`;
  }
  return rest(
    env,
    `wholesale_images?active=eq.true&${filter}&select=equipment_type_id,category_id,storage_path,alt_text`
  );
}

/** ONE batch call to Supabase Storage's multi-path signing endpoint —
 *  never one signing request per image. Returns a Map of storage_path ->
 *  full signed URL; a path that errors or is simply absent from the
 *  response is left out of the map (callers treat a missing entry as
 *  `image: null`, never a broken/partial URL). Skips the Storage request
 *  completely when there are zero paths to sign. */
export async function signImagePaths(env, storagePaths) {
  if (!storagePaths.length) return new Map();

  const res = await fetch(`${env.SUPABASE_URL}/storage/v1/object/sign/${WHOLESALE_IMAGES_BUCKET}`, {
    method: "POST",
    headers: headers(env),
    body: JSON.stringify({ expiresIn: IMAGE_SIGN_TTL_SECONDS, paths: storagePaths }),
  }).catch(() => null);

  const byPath = new Map();
  if (!res || !res.ok) return byPath; // batch call itself failed — every image degrades to null, catalog still returns

  const entries = await res.json().catch(() => null);
  if (!Array.isArray(entries)) return byPath;
  for (const entry of entries) {
    if (entry && !entry.error && typeof entry.path === "string" && typeof entry.signedURL === "string") {
      byPath.set(entry.path, `${env.SUPABASE_URL}/storage/v1${entry.signedURL}`);
    }
  }
  return byPath;
}

export async function findMicrosolderingTagId(env) {
  const tags = await rest(env, `wholesale_tags?slug=eq.microsoldering&select=id`);
  return tags[0]?.id || null;
}

/** Which of the given (already active-filtered) service ids carry the
 *  Microsoldering tag — restricted to those ids at the query level, never
 *  the whole wholesale_service_tags table. Skips the request when there's
 *  no tag row yet or no active service to check against. */
export async function listMicrosolderingServiceIds(env, tagId, activeServiceIds) {
  if (!tagId || !activeServiceIds.length) return new Set();
  const rows = await rest(
    env,
    `wholesale_service_tags?tag_id=eq.${tagId}&service_id=in.(${activeServiceIds.join(",")})&select=service_id`
  );
  return new Set(rows.map((r) => r.service_id));
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
function toClientService(sv, portalSettings) {
  return {
    id: sv.id,
    slug: sv.slug,
    name: sv.name,
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
  };
}

/** Builds the full portal response — equipment-type-grouped catalog plus the
 *  Microsoldering lens — for a logged-in shop. Fixed query count regardless
 *  of catalog size: 3 catalog fetches (equipment types, categories,
 *  services) + 1 portal settings fetch + 1 images fetch + 1 tag lookup + 1
 *  service-tag fetch = 7 Postgres round-trips, plus at most ONE batch
 *  Storage signing call. Never returns `storage_path` — only
 *  `{ url, alt_text }` per image, or `null`. Every service's
 *  `recommended_price` is resolved here, once, from the SAME portalSettings
 *  row fetched at the top — never refetched per service. */
export async function buildWholesaleCatalog(env) {
  const [equipmentTypes, categories, services, portalSettings] = await Promise.all([
    listActiveEquipmentTypes(env),
    rest(env, `wholesale_categories?active=eq.true&select=*&order=sort_order.asc,name.asc`),
    rest(env, `wholesale_services?active=eq.true&select=*&order=sort_order.asc,name.asc`),
    getPortalSettings(env),
  ]);

  const realEquipmentTypes = equipmentTypes.filter((et) => !et.is_tag_lens);
  const microsolderingType = equipmentTypes.find((et) => et.is_tag_lens) || null;

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

  // -- images: one fetch for every active owner id, then one batch sign --
  const equipmentTypeIds = realEquipmentTypes.map((et) => et.id);
  if (microsolderingType) equipmentTypeIds.push(microsolderingType.id);
  const categoryIds = categories.filter((c) => c.equipment_type_id).map((c) => c.id);

  const imageRows = await listActiveImagesForOwners(env, equipmentTypeIds, categoryIds);
  const signedByPath = await signImagePaths(env, imageRows.map((row) => row.storage_path));

  const imageByEquipmentType = new Map();
  const imageByCategory = new Map();
  for (const row of imageRows) {
    const url = signedByPath.get(row.storage_path) || null;
    const image = url ? { url, alt_text: row.alt_text || null } : null;
    if (row.equipment_type_id) imageByEquipmentType.set(row.equipment_type_id, image);
    if (row.category_id) imageByCategory.set(row.category_id, image);
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
      services: (servicesByCategory.get(cat.id) || []).map((sv) => toClientService(sv, portalSettings)),
    };
  }

  const equipmentTypesOut = realEquipmentTypes
    .map((et) => ({
      id: et.id,
      slug: et.slug,
      name: et.name,
      image: imageByEquipmentType.get(et.id) || null,
      categories: (categoriesByEquipmentType.get(et.id) || [])
        .map(toClientCategory)
        .filter((cat) => cat.services.length > 0),
    }))
    .filter((et) => et.categories.length > 0);

  // -- Microsoldering lens: reuses the SAME already-active data above, never
  //    a separate/looser query — a Hidden equipment type/category/service can
  //    never reach this view either. `microsoldering` stays null when the
  //    Microsoldering equipment type itself is hidden or missing (no card at
  //    all); it's an object (possibly with an empty equipmentTypes[]) whenever
  //    that type is active, even if zero services are currently tagged. --
  let microsoldering = null;
  if (microsolderingType) {
    const tagId = await findMicrosolderingTagId(env);
    const activeServiceIds = services.map((s) => s.id);
    const taggedServiceIds = await listMicrosolderingServiceIds(env, tagId, activeServiceIds);

    const lensEquipmentTypes = realEquipmentTypes
      .map((et) => ({
        id: et.id,
        name: et.name,
        categories: (categoriesByEquipmentType.get(et.id) || [])
          .map((cat) => ({
            id: cat.id,
            // `slug` (not present in this lens shape before) is required so
            // buildWholesaleWizardCatalog's PS5/Xbox/Switch promotion logic
            // (src/lib/wholesaleWizardCatalog.js) behaves identically inside
            // the Microsoldering branch as it does for the regular catalog —
            // otherwise a PS5 microsoldering service would only ever surface
            // nested under "Video Consoles" here, inconsistent with the rest
            // of the wizard.
            slug: cat.slug,
            name: cat.name,
            services: (servicesByCategory.get(cat.id) || [])
              .filter((sv) => taggedServiceIds.has(sv.id))
              .map((sv) => toClientService(sv, portalSettings)),
          }))
          .filter((cat) => cat.services.length > 0),
      }))
      .filter((et) => et.categories.length > 0);

    microsoldering = {
      image: imageByEquipmentType.get(microsolderingType.id) || null,
      equipmentTypes: lensEquipmentTypes,
    };
  }

  return {
    equipmentTypes: equipmentTypesOut,
    microsoldering,
    // Read-only for the portal — shops never write either of these. Falls
    // back to safe, conservative defaults (maintenance + blocked, no
    // rounding) if the singleton settings row is somehow missing, rather
    // than throwing and breaking the whole catalog response over it.
    salesModule: {
      visible: portalSettings?.sales_visible ?? true,
      status: portalSettings?.sales_status ?? "maintenance",
      entryBlocked: portalSettings?.sales_entry_blocked ?? true,
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
 *  runs wholesale_publish_legal_document) — callers must treat `null` as
 *  "the legal-acceptance gate is not active yet", never as an error. The
 *  partial unique index in the migration (idx_wholesale_legal_documents_
 *  one_published) guarantees at most one row can ever have
 *  status=eq.published, so `rows[0]` is always the right (and only) one. */
export async function getPublishedLegalDocument(env) {
  const rows = await rest(
    env,
    `wholesale_legal_documents?status=eq.published&select=id,version,content_en,content_es,content_hash,published_at`
  );
  return rows[0] || null;
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
