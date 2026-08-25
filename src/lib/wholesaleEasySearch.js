/**
 * Easy Search — pure, framework-free normalization/ranking logic plus the
 * authenticated fetch wrapper for the model-code lookup endpoint
 * (api/wholesale-easy-search.js). Deliberately separate from the React
 * component (EasySearchPanel.jsx), same reasoning as wholesaleSearch.js:
 * every rule below is a plain, directly-testable function.
 *
 * NOT the same feature as wholesaleSearch.js's "Live Search" (Buscador
 * Predictivo) — that one searches the already-loaded PRICE catalog
 * client-side, with zero network calls per keystroke. Easy Search searches a
 * separate, DB-backed device-spec directory (wholesale_device_models /
 * wholesale_device_model_codes) that has nothing to do with pricing, and
 * calls the server on every debounced keystroke because the directory is
 * far larger than any one shop's already-loaded catalog and never ships to
 * the client in full.
 */

export const EASY_SEARCH_MIN_QUERY_LENGTH = 2;
export const EASY_SEARCH_MAX_RESULTS = 10;
export const EASY_SEARCH_DEBOUNCE_MS = 200;

/** Uppercase, alphanumeric-only. "a2218", "A-2218", "A 2218", and "A2218"
 *  all normalize to the identical "A2218" — this is the ONLY normalization
 *  Easy Search ever applies, on both the query and (via the same function,
 *  server-side, in the seed generator and the API) every stored code, so a
 *  match is always an exact comparison of two normalized strings, never a
 *  fuzzy one. */
export function normalizeEasySearchCode(raw) {
  if (typeof raw !== "string") return "";
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Splits a combined label like "A1549 / A1586" (or "A1549/A1586",
 *  "A1549, A1586") into its individual codes, each kept in its ORIGINAL
 *  (non-normalized) form — normalization happens separately, once, wherever
 *  a code is actually stored or compared. Used by the CSV/seed pipeline to
 *  turn one catalog cell into multiple wholesale_device_model_codes rows
 *  that all point at the same device. A label with no separator returns a
 *  single-element array unchanged. */
export function splitCombinedCodes(rawLabel) {
  if (typeof rawLabel !== "string") return [];
  return rawLabel
    .split(/[/,]/)
    .map((piece) => piece.trim())
    .filter(Boolean);
}

/** Client-side ranking of already-fetched results — the server applies the
 *  same exact > prefix > partial priority when building the response (see
 *  api/wholesale-easy-search.js), so this is redundant-by-design
 *  belt-and-suspenders for a caller that receives results from any source
 *  (tests, a future cache), not a second independent implementation the
 *  server's ranking could silently drift from: both derive the ranking
 *  purely from each result's own `normalizedCode` compared against the
 *  normalized query, which is the entire rule. */
export function rankEasySearchResults(results, rawQuery) {
  const normalizedQuery = normalizeEasySearchCode(rawQuery);
  if (!Array.isArray(results) || !normalizedQuery) return [];
  function tier(result) {
    const code = normalizeEasySearchCode(result.normalizedCode ?? result.code);
    if (code === normalizedQuery) return 0;
    if (code.startsWith(normalizedQuery)) return 1;
    return 2;
  }
  return [...results].sort((a, b) => tier(a) - tier(b));
}

/**
 * Same {kind: "auth"|"legal_required"|"transient"} classification
 * fetchWholesaleCatalog() already established in wholesaleAuth.js, so a
 * caller can plug this straight into the exact same redirect/retry handling
 * used everywhere else in the portal. "legal_required" is included for
 * completeness/consistency even though, in practice, a shop already past
 * the legal gate to be using the wizard at all would only hit "auth" or a
 * real result here — api/wholesale-easy-search.js re-checks session/device/
 * shop status on every call, exactly like api/wholesale-prices.js, but does
 * NOT re-check legal acceptance (Easy Search shows specs, never pricing —
 * there is nothing here for the legal gates to protect).
 */
export async function fetchEasySearchResults(query) {
  const normalizedQuery = normalizeEasySearchCode(query);
  if (normalizedQuery.length < EASY_SEARCH_MIN_QUERY_LENGTH) {
    return { ok: true, results: [] };
  }
  let res;
  try {
    res = await fetch(`/api/wholesale-easy-search?q=${encodeURIComponent(query)}`, {
      credentials: "same-origin",
    });
  } catch {
    return { ok: false, kind: "transient", message: "Could not reach the server." };
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) {
    return { ok: false, kind: "auth", message: data.message || "Session expired." };
  }
  if (!res.ok) {
    return { ok: false, kind: "transient", message: data.message || "Could not search." };
  }
  return { ok: true, results: Array.isArray(data.results) ? data.results : [] };
}
