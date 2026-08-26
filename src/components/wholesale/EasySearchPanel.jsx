import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { useWholesaleLocale } from "../../i18n/WholesaleLocaleContext.jsx";
import {
  normalizeEasySearchCode,
  rankEasySearchResults,
  fetchEasySearchResults,
  EASY_SEARCH_MIN_QUERY_LENGTH,
  EASY_SEARCH_DEBOUNCE_MS,
} from "../../lib/wholesaleEasySearch.js";

/** DOM id for a given result's <li role="option"> — index-based since a
 *  result has no stable catalog id of its own worth exposing to the DOM
 *  (unlike WholesaleSearch's entry.id, a real Equipo:Model:Service key). */
function optionDomId(index) {
  return `wsp-easy-search-option-${index}`;
}

/**
 * Easy Search — a purple capsule/floating trigger button that opens a
 * bottom-sheet-style panel: type a printed model code (or a commercial
 * name/brand), get back real-world device specs, and — only when the
 * device is tied to the existing Wholesale catalog — a button into the
 * unmodified Equipment -> Model -> Failure/Service -> Price flow.
 *
 * NOT the same feature as WholesaleSearch.jsx (Live Search / Buscador
 * Predictivo) — that one is an always-visible inline combobox indexing the
 * already-loaded PRICE catalog entirely client-side. Easy Search is a
 * separate, closed-by-default entry point that queries a much larger,
 * DB-backed device-spec directory server-side (api/wholesale-easy-search.js)
 * — see that file's own header for why a price is structurally impossible
 * in its response.
 *
 * `onSelectCatalogModel({ catalogEquipmentTypeId, catalogCategoryId })` is
 * the ONLY way this component talks to the wizard, called only when a shop
 * clicks "View Services & Wholesale Prices" on a result that has
 * hasWholesaleCatalog === true — see WholesaleWizard.jsx's
 * handleSelectEasySearchResult for how those ids resolve into the real
 * Equipo/Model objects and hydrate the existing, unmodified pricing flow.
 */
export function EasySearchPanel({ onSelectCatalogModel }) {
  const { t } = useWholesaleLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [results, setResults] = useState([]);
  const [errorKind, setErrorKind] = useState(null); // null | "transient" | "auth"
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selectedResult, setSelectedResult] = useState(null); // detail view, or null = list view

  const inputRef = useRef(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (query === debouncedQuery) return;
    setIsPending(true);
    const timer = setTimeout(() => setDebouncedQuery(query), EASY_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    const normalized = normalizeEasySearchCode(debouncedQuery);
    const trimmed = debouncedQuery.trim();
    if (normalized.length < EASY_SEARCH_MIN_QUERY_LENGTH && trimmed.length < EASY_SEARCH_MIN_QUERY_LENGTH) {
      setResults([]);
      setIsPending(false);
      setErrorKind(null);
      return;
    }
    const requestId = ++requestIdRef.current;
    fetchEasySearchResults(debouncedQuery).then((result) => {
      // A slower, earlier request resolving after a newer one must never
      // clobber the newer results — the classic stale-response race.
      if (requestId !== requestIdRef.current) return;
      setIsPending(false);
      if (!result.ok) {
        setErrorKind(result.kind);
        setResults([]);
        return;
      }
      setErrorKind(null);
      setResults(rankEasySearchResults(result.results, debouncedQuery));
    });
  }, [debouncedQuery]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [results]);

  /**
   * NO outside-click listener, on purpose. There used to be a document-level
   * "mousedown" handler here that closed the panel on any press landing
   * outside panelRef, and it was actively harmful on a phone: the backdrop
   * is most of the screen, a browser synthesizes mousedown from touch, and
   * closePanel() wipes the query and the results — so a stray thumb while
   * scrolling the sheet threw away whatever the shop had typed. The red
   * close button is now the only pointer path out, which is why it is
   * styled to be impossible to miss.
   *
   * Escape is deliberately KEPT. It is a keyboard affordance, not an
   * accidental-dismissal risk (nobody brushes Escape with a thumb), and
   * dropping it from a role="dialog" aria-modal="true" element would break
   * the ARIA dialog pattern for keyboard and screen-reader users.
   */
  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKeyDown(e) {
      if (e.key === "Escape") closePanel();
    }
    document.addEventListener("keydown", handleKeyDown);
    // Autofocus the search input the moment the panel opens, so keyboard
    // users land ready to type without an extra Tab.
    inputRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function openPanel() {
    setIsOpen(true);
  }
  function closePanel() {
    setIsOpen(false);
    setQuery("");
    setDebouncedQuery("");
    setResults([]);
    setSelectedResult(null);
    setActiveIndex(-1);
    setErrorKind(null);
  }

  function selectResult(result) {
    setSelectedResult(result);
  }

  function backToList() {
    setSelectedResult(null);
  }

  function handleViewCatalog() {
    if (!selectedResult?.hasWholesaleCatalog) return;
    onSelectCatalogModel({
      catalogEquipmentTypeId: selectedResult.catalogEquipmentTypeId,
      catalogCategoryId: selectedResult.catalogCategoryId,
    });
    closePanel();
  }

  function handleInputKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length === 0) return;
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length === 0) return;
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (results.length === 0) return;
      e.preventDefault();
      selectResult(results[activeIndex >= 0 ? activeIndex : 0]);
    }
  }

  const trimmedLength = normalizeEasySearchCode(debouncedQuery).length || debouncedQuery.trim().length;
  const meetsMinLength = trimmedLength >= EASY_SEARCH_MIN_QUERY_LENGTH;
  const showListbox = !selectedResult && meetsMinLength && !isPending && !errorKind && results.length > 0;
  const showNoResults = !selectedResult && meetsMinLength && !isPending && !errorKind && results.length === 0;
  const activeResult = activeIndex >= 0 ? results[activeIndex] : null;

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="wsp-easy-search-panel"
        className="wsp-easy-search-trigger"
      >
        <Search size={16} aria-hidden="true" />
        <span className="wsp-easy-search-trigger-label">{t("easySearch.buttonLabel")}</span>
      </button>

      {isOpen && (
        <div className="wsp-easy-search-backdrop">
          <div
            id="wsp-easy-search-panel"
            role="dialog"
            aria-modal="true"
            aria-label={t("easySearch.panelLabel")}
            className="wsp-easy-search-panel"
          >
            <div className="wsp-easy-search-panel-header">
              <span className="wsp-easy-search-panel-title">{t("easySearch.buttonLabel")}</span>
              <button
                type="button"
                onClick={closePanel}
                aria-label={t("easySearch.closeLabel")}
                className="wsp-easy-search-close"
              >
                {/* Thicker than lucide's default 2: at 40px the glyph has to
                    carry the whole button, and a hairline X on a saturated
                    red fill reads as washed out. */}
                <X size={22} strokeWidth={3} aria-hidden="true" />
              </button>
            </div>

            {!selectedResult && (
              <div className="wsp-easy-search-field">
                <Search size={16} className="wsp-easy-search-field-icon" aria-hidden="true" />
                <input
                  ref={inputRef}
                  type="text"
                  role="combobox"
                  aria-expanded={showListbox}
                  aria-haspopup="listbox"
                  aria-controls="wsp-easy-search-listbox"
                  aria-autocomplete="list"
                  aria-activedescendant={activeResult ? optionDomId(activeIndex) : undefined}
                  aria-label={t("easySearch.inputAriaLabel")}
                  autoComplete="off"
                  className="wsp-easy-search-input"
                  placeholder={t("easySearch.placeholder")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                />
                {isPending && <Loader2 size={16} className="wsp-easy-search-spinner" aria-hidden="true" />}
              </div>
            )}

            {!selectedResult && errorKind && (
              <p role="status" className="wsp-easy-search-status">
                {errorKind === "auth" ? t("easySearch.sessionExpired") : t("easySearch.transientError")}
              </p>
            )}

            {showNoResults && (
              <p role="status" className="wsp-easy-search-status">
                {t("easySearch.noResults")}
              </p>
            )}

            {showListbox && (
              <ul id="wsp-easy-search-listbox" role="listbox" aria-label={t("easySearch.resultsLabel")} className="wsp-easy-search-listbox">
                {results.map((result, i) => (
                  <li
                    key={i}
                    id={optionDomId(i)}
                    role="option"
                    aria-selected={i === activeIndex}
                    className={`wsp-easy-search-option${i === activeIndex ? " wsp-easy-search-option-active" : ""}`}
                    onMouseEnter={() => setActiveIndex(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectResult(result);
                    }}
                  >
                    <span className="wsp-easy-search-option-primary">{result.commercialName}</span>
                    <span className="wsp-easy-search-option-secondary">
                      {result.brand}
                      {result.year ? ` · ${result.year}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {selectedResult && (
              <div className="wsp-easy-search-detail">
                <button type="button" onClick={backToList} className="wsp-easy-search-back">
                  {t("easySearch.backToResults")}
                </button>
                <h3 className="wsp-easy-search-detail-title">{selectedResult.commercialName}</h3>
                <p className="wsp-easy-search-detail-subtitle">
                  {selectedResult.brand}
                  {selectedResult.year ? ` · ${selectedResult.year}` : ""}
                </p>
                <dl className="wsp-easy-search-spec-list">
                  {[
                    ["easySearch.specScreen", selectedResult.screen],
                    ["easySearch.specProcessor", selectedResult.processor],
                    ["easySearch.specRam", selectedResult.ram],
                    ["easySearch.specStorage", selectedResult.storage],
                    ["easySearch.specCamera", selectedResult.mainCamera],
                    ["easySearch.specBattery", selectedResult.battery],
                  ]
                    .filter(([, value]) => value)
                    .map(([labelKey, value]) => (
                      <div key={labelKey} className="wsp-easy-search-spec-row">
                        <dt>{t(labelKey)}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                </dl>
                {selectedResult.hasWholesaleCatalog && (
                  <button type="button" onClick={handleViewCatalog} className="wsp-easy-search-view-catalog">
                    {t("easySearch.viewCatalogButton")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
