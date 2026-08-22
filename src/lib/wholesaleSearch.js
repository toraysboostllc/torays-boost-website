import { translateCatalogLabel, translateServiceName } from "./wholesaleCatalogI18n.js";

/**
 * Live Search (Buscador Predictivo) — pure, framework-free indexing/
 * matching/highlighting logic for the global search bar in
 * WholesaleWizard.jsx. Deliberately separate from the React component
 * (WholesaleSearch.jsx) so every rule below is a plain, directly-testable
 * function — no render harness needed (this project has no jsdom
 * dependency, matching every other test file's own note).
 *
 * The ONLY input this file ever consumes is `equipoList`, the exact same
 * flat Equipo -> Modelo -> Falla structure buildWholesaleWizardCatalog(...)
 * already produces from the authenticated /api/wholesale-prices payload
 * (see wholesaleWizardCatalog.js) — WholesaleWizard.jsx passes it its own
 * `topEquipoList` unchanged. That means every exclusion this feature needs
 * (hidden/inactive/empty equipment types, categories, services) is already
 * applied server-side and by that function — this file adds zero filtering
 * of its own, and a brand-new card/model/service DESK creates appears here
 * automatically the next time the catalog is (re)fetched, with zero code
 * change. No API call happens anywhere in this file — the index is built
 * once from data already in memory, and re-searched entirely client-side
 * on every keystroke.
 */

export const SEARCH_MIN_QUERY_LENGTH = 2;
export const SEARCH_MAX_RESULTS = 10;
export const SEARCH_DEBOUNCE_MS = 200;

/** Case-insensitive, accent-insensitive, repeated-whitespace-insensitive.
 *  NFD-decomposes so a precomposed accented letter (e.g. "é") becomes
 *  [base][combining mark], then strips the combining marks — for the
 *  Spanish alphabet this nets out to the exact same character COUNT as the
 *  original (1 precomposed char in, 1 base char out), which is what lets
 *  highlightSegments below map a match found in normalized text back onto
 *  the original display string by plain index, no separate alignment
 *  bookkeeping needed for the common case. */
// Combining Diacritical Marks block (U+0300-U+036F) — built from
// String.fromCharCode(...) rather than a /\uXXXX-\uXXXX/ regex literal, so
// this file's source never risks silently holding the literal combining
// characters themselves (invisible/easy to mis-paste) instead of a plain,
// unambiguous ASCII escape.
const COMBINING_MARKS_RE = new RegExp(
  "[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]",
  "g"
);

export function normalizeSearchText(raw) {
  if (typeof raw !== "string") return "";
  return raw
    .normalize("NFD")
    .replace(COMBINING_MARKS_RE, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Same 3-tier precedence EquipmentTypeCard.jsx already established for a
 *  top-level Equipo card (real nameEs > legacy CATALOG_NAME_ES dictionary >
 *  raw English) and translateServiceName established for services — models
 *  never carry a real name_es field at all (see
 *  wholesaleCatalogI18n.js's own header on categories/models), so a model
 *  always falls straight to the dictionary/English. Kept local to this
 *  file rather than added to wholesaleCatalogI18n.js's shared exports: it's
 *  presentation logic for search results specifically, and EquipmentTypeCard
 *  already has its own tested inline version — duplicating one 3-line
 *  expression here is cheaper and safer than refactoring an already-shipped,
 *  already-tested component to share it. */
function translateEquipoDisplayName(equipo, language) {
  if (language === "es" && typeof equipo?.nameEs === "string" && equipo.nameEs.trim()) {
    return equipo.nameEs.trim();
  }
  return translateCatalogLabel(equipo?.name, language);
}

/** Builds one searchable entry per (Equipo, Modelo, Falla) leaf — the
 *  granularity a search RESULT is ultimately selected at, since selecting
 *  a result must hydrate the wizard down to a specific service (see
 *  WholesaleWizard.jsx's handleSelectSearchResult). `searchText` is a
 *  single normalized blob combining BOTH the English and Spanish names of
 *  the equipo, model, and service — search matches in either language
 *  regardless of which language the UI is currently displaying (the
 *  request: "Indexar ... en inglés y español"), while `entry.equipo` /
 *  `entry.model` / `entry.service` (the real, untouched catalog objects)
 *  are what the RENDERING layer uses to display in whichever language IS
 *  currently active, via the normal translate* helpers. */
export function buildWholesaleSearchEntries(equipoList) {
  if (!Array.isArray(equipoList)) return [];
  const entries = [];
  for (const equipo of equipoList) {
    const equipoEn = equipo?.name || "";
    const equipoEs = translateEquipoDisplayName(equipo, "es");
    for (const model of equipo?.models || []) {
      const modelEn = model?.name || "";
      const modelEs = translateCatalogLabel(model?.name, "es");
      for (const service of model?.services || []) {
        const serviceEn = translateServiceName(service, "en");
        const serviceEs = translateServiceName(service, "es");
        entries.push({
          id: `${equipo.id}:${model.id}:${service.id}`,
          equipo,
          model,
          service,
          searchText: normalizeSearchText([equipoEn, equipoEs, modelEn, modelEs, serviceEn, serviceEs].join(" ")),
        });
      }
    }
  }
  return entries;
}

/** null when the (normalized) query doesn't appear in this entry's
 *  searchText at all. Otherwise a plain, deterministic relevance score,
 *  compared in this priority order by searchWholesaleCatalog's sort below:
 *   1. wordStart — a match that starts a WORD (index 0, or the previous
 *      character is a space) ranks above one buried mid-word.
 *   2. length — among same-wordStart matches, the entry with the SHORTER
 *      searchText (a more specific/compact equipo+model+service
 *      combination, not padded by a long name elsewhere in the blob)
 *      ranks first.
 *   3. index — among same-wordStart, same-length matches, the one whose
 *      match occurs earlier in its own blob ranks first.
 *   4. originalIndex (applied by the caller) — final, stable tie-break:
 *      the entry's position in the original list, which — since
 *      equipoList/its models/services already arrive in DESK's own
 *      sort_order — keeps results in a predictable order rather than
 *      shuffling on every keystroke. */
function scoreEntry(entry, normalizedQuery) {
  const index = entry.searchText.indexOf(normalizedQuery);
  if (index === -1) return null;
  const wordStart = index === 0 || entry.searchText[index - 1] === " ";
  return { wordStart, index, length: entry.searchText.length };
}

/** The only function the component calls on every debounced keystroke.
 *  Returns [] (not an error, not null) for a query shorter than
 *  SEARCH_MIN_QUERY_LENGTH once normalized — "Comenzar con 2 caracteres"
 *  — and always caps at `limit` (default SEARCH_MAX_RESULTS). Pure and
 *  synchronous: no network request happens here or anywhere else in this
 *  file, matching "cero solicitud por cada tecla". */
export function searchWholesaleCatalog(entries, rawQuery, limit = SEARCH_MAX_RESULTS) {
  const normalizedQuery = normalizeSearchText(rawQuery);
  if (normalizedQuery.length < SEARCH_MIN_QUERY_LENGTH) return [];
  const scored = [];
  for (let i = 0; i < entries.length; i++) {
    const score = scoreEntry(entries[i], normalizedQuery);
    if (score) scored.push({ entry: entries[i], score, originalIndex: i });
  }
  scored.sort((a, b) => {
    if (a.score.wordStart !== b.score.wordStart) return a.score.wordStart ? -1 : 1;
    if (a.score.length !== b.score.length) return a.score.length - b.score.length;
    if (a.score.index !== b.score.index) return a.score.index - b.score.index;
    return a.originalIndex - b.originalIndex;
  });
  return scored.slice(0, limit).map((s) => s.entry);
}

/** Splits `displayText` into [{ text, matched }] segments for rendering a
 *  highlighted substring, matching case/accent-insensitively against
 *  `rawQuery`. Falls back to a single unmatched segment (plain text, no
 *  highlight, never a crash/misrender) whenever: the query is too short,
 *  there's no display text, normalization changed the string's length
 *  (a rare edge case — e.g. unusual Unicode, or internal whitespace that
 *  collapsed — where a normalized-index could misalign with the original
 *  string), or the normalized query simply never occurs in this
 *  particular displayed string (it may still have matched via the OTHER
 *  language's variant, which is why this entry is in the results at all —
 *  that's fine, this specific segment just shows unhighlighted). */
export function highlightSegments(displayText, rawQuery) {
  const text = typeof displayText === "string" ? displayText : "";
  const normalizedQuery = normalizeSearchText(rawQuery);
  if (!text || normalizedQuery.length < SEARCH_MIN_QUERY_LENGTH) {
    return [{ text, matched: false }];
  }
  const normalizedText = normalizeSearchText(text);
  if (normalizedText.length !== text.length) {
    return [{ text, matched: false }];
  }
  const index = normalizedText.indexOf(normalizedQuery);
  if (index === -1) {
    return [{ text, matched: false }];
  }
  const end = index + normalizedQuery.length;
  const segments = [];
  if (index > 0) segments.push({ text: text.slice(0, index), matched: false });
  segments.push({ text: text.slice(index, end), matched: true });
  if (end < text.length) segments.push({ text: text.slice(end), matched: false });
  return segments;
}
