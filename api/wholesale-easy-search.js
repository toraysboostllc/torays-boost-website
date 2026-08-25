/**
 * Vercel Function — Easy Search's model-code lookup for the Wholesale
 * portal. GET only, query param `q`. Requires the exact same valid session
 * (or silently-refreshable trusted device) as api/wholesale-prices.js —
 * reuses resolveWholesaleSession() in _lib/wholesaleDb.js rather than
 * duplicating that check, but wholesale-prices.js itself is untouched.
 *
 * Deliberately does NOT re-check legal acceptance (unlike
 * wholesale-prices.js) — Easy Search shows device specs, never pricing,
 * so there is nothing here for the legal gates to protect. A shop that is
 * mid-login (session valid, device approved, shop active) can use Easy
 * Search even before accepting the master agreement / estimate disclaimer.
 *
 * Response NEVER includes a price field of any kind — structurally
 * impossible, since wholesale_device_models/wholesale_device_model_codes
 * (see supabase/wholesale-easy-search-migration.sql) carry no price column
 * at all. `hasWholesaleCatalog` + `catalogEquipmentTypeId`/
 * `catalogCategorySlug` are the only bridge into the existing pricing
 * catalog — the UI uses them to decide whether to show "View Services &
 * Wholesale Prices" and, if so, where it should navigate.
 */
import { parse, serialize } from "cookie";
import {
  getEnv,
  setPrivateHeaders,
  resolveWholesaleSession,
  searchWholesaleDeviceModels,
  wholesaleSessionCookieOptions,
  WHOLESALE_SESSION_DAYS,
  clientIp,
  rest,
} from "./_lib/wholesaleDb.js";

const SESSION_TOKEN_MAX = 128;
const DEVICE_TOKEN_MAX = 128;
const RESULT_LIMIT = 10;

/** Uppercase, alphanumeric-only — same rule as
 *  src/lib/wholesaleEasySearch.js's normalizeEasySearchCode(), duplicated
 *  here on purpose (server code, no shared module with the client bundle)
 *  rather than imported, matching how normalizeShopCode() is already
 *  deliberately duplicated between this repo and DESK — see that
 *  function's own comment in _lib/wholesaleDb.js. */
function normalizeEasySearchCode(raw) {
  if (typeof raw !== "string") return "";
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

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
    res.status(500).json({ error: "not_configured", message: "Easy Search isn't configured on the server yet." });
    return;
  }

  const cookies = parse(req.headers.cookie || "");
  const sessionToken = cookies.ws_session || null;
  const rawDeviceToken = cookies.ws_device || null;
  const deviceToken = rawDeviceToken && rawDeviceToken.length <= DEVICE_TOKEN_MAX ? rawDeviceToken : null;

  const auth = await resolveWholesaleSession(env, {
    sessionToken: sessionToken && sessionToken.length <= SESSION_TOKEN_MAX ? sessionToken : null,
    deviceToken,
    ip: clientIp(req),
    userAgent: req.headers["user-agent"] || null,
  });
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error, message: auth.message });
    return;
  }
  if (auth.refreshedSessionToken) {
    res.setHeader(
      "Set-Cookie",
      serialize("ws_session", auth.refreshedSessionToken, wholesaleSessionCookieOptions(WHOLESALE_SESSION_DAYS * 24 * 60 * 60))
    );
  }

  const rawQuery = typeof req.query?.q === "string" ? req.query.q : "";
  const normalizedQuery = normalizeEasySearchCode(rawQuery);
  if (normalizedQuery.length < 2 && rawQuery.trim().length < 2) {
    res.status(200).json({ results: [] });
    return;
  }

  const models = await searchWholesaleDeviceModels(env, { normalizedQuery, rawQuery, limit: RESULT_LIMIT });

  // Resolve the catalog bridge (equipment_type_id + category slug) for
  // whichever results are actually linked — a single batched lookup rather
  // than N+1 requests.
  const linkedCategoryIds = [...new Set(models.map((m) => m.catalog_model_id).filter(Boolean))];
  let categoryById = new Map();
  if (linkedCategoryIds.length) {
    const categories = await rest(
      env,
      `wholesale_categories?id=in.(${linkedCategoryIds.join(",")})&active=eq.true&select=id,slug,equipment_type_id`
    );
    categoryById = new Map(categories.map((c) => [c.id, c]));
  }

  const results = models.map((m) => {
    const category = m.catalog_model_id ? categoryById.get(m.catalog_model_id) : null;
    return {
      brand: m.brand,
      commercialName: m.commercial_name,
      deviceCategory: m.device_category,
      year: m.year,
      screen: m.screen,
      processor: m.processor,
      ram: m.ram,
      storage: m.storage,
      mainCamera: m.main_camera,
      battery: m.battery,
      // Only true when the link target ITSELF is still active — a model
      // pointed at a since-hidden category never offers a dead button.
      // catalogCategoryId is the real join key against the wizard's
      // already-loaded model objects (wholesale_categories.id); slug ships
      // alongside it for display/analytics only.
      hasWholesaleCatalog: Boolean(category),
      catalogEquipmentTypeId: category ? category.equipment_type_id : null,
      catalogCategoryId: category ? category.id : null,
      catalogCategorySlug: category ? category.slug : null,
    };
  });

  res.status(200).json({ results });
}
