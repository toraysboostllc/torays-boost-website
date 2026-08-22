import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { useWholesaleLocale } from "../../i18n/WholesaleLocaleContext.jsx";
import { translateCatalogLabel, translateServiceName } from "../../lib/wholesaleCatalogI18n.js";
import {
  buildWholesaleSearchEntries,
  searchWholesaleCatalog,
  highlightSegments,
  SEARCH_MIN_QUERY_LENGTH,
  SEARCH_DEBOUNCE_MS,
} from "../../lib/wholesaleSearch.js";
import { ServicePhoto } from "./ServicePhoto.jsx";

/** DOM id for a given result's <li role="option"> — colons (from
 *  entry.id's "equipoId:modelId:serviceId" shape) swapped for dashes,
 *  purely so the id stays a conventional CSS-selector-friendly token; it
 *  carries no other meaning. */
function optionDomId(entryId) {
  return `wsp-search-option-${entryId.replace(/:/g, "-")}`;
}

/** Same 3-tier precedence as EquipmentTypeCard.jsx's own inline version —
 *  see wholesaleSearch.js's translateEquipoDisplayName for why this isn't
 *  shared/imported instead (kept local to each presentation site,
 *  deliberately not refactored into a shared export touching already-
 *  shipped, already-tested components). */
function equipoDisplayName(equipo, language) {
  if (language === "es" && typeof equipo?.nameEs === "string" && equipo.nameEs.trim()) {
    return equipo.nameEs.trim();
  }
  return translateCatalogLabel(equipo?.name, language);
}

function HighlightedText({ text, query }) {
  const segments = highlightSegments(text, query);
  return (
    <>
      {segments.map((segment, i) =>
        segment.matched ? (
          <mark key={i} className="wsp-search-highlight">
            {segment.text}
          </mark>
        ) : (
          <span key={i}>{segment.text}</span>
        )
      )}
    </>
  );
}

/**
 * Live Search (Buscador Predictivo) — a global WAI-ARIA combobox above the
 * Equipo grid. Indexes the SAME `equipoList` WholesaleWizard already
 * builds via buildWholesaleWizardCatalog (its own `topEquipoList`) — no
 * fetch of any kind happens in this component or in wholesaleSearch.js;
 * every exclusion (hidden/inactive/empty cards, catalog_mode='grouped' AND
 * 'direct_services' alike, e.g. Microsoldering) is already applied by that
 * shared pipeline, so refreshing the page after DESK adds a new card/
 * model/service is the only thing needed for it to show up here too — zero
 * code change.
 *
 * `onSelectResult({ equipo, model, service })` is the ONLY way this
 * component talks to the wizard — it never touches screenStack/selected*
 * state itself (see WholesaleWizard.jsx's handleSelectSearchResult, which
 * hydrates the exact same state a manual Equipo->Modelo->Falla click-
 * through would have produced, so nothing about diagnostic/terms/pricing/
 * validation is ever bypassed or duplicated).
 */
export function WholesaleSearch({ equipoList, onSelectResult }) {
  const { t, language } = useWholesaleLocale();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const entries = useMemo(() => buildWholesaleSearchEntries(equipoList), [equipoList]);

  // Debounced ~200ms — the ONLY thing that changes on every raw keystroke
  // is `query` itself (a controlled input, instant echo); the actual
  // search only re-runs once typing pauses, and it's always a pure,
  // synchronous, in-memory computation — never a network request.
  useEffect(() => {
    if (query === debouncedQuery) return;
    setIsPending(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setIsPending(false);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const results = useMemo(() => searchWholesaleCatalog(entries, debouncedQuery), [entries, debouncedQuery]);

  const normalizedLength = debouncedQuery.trim().length;
  const meetsMinLength = normalizedLength >= SEARCH_MIN_QUERY_LENGTH;
  const showDropdown = isOpen && query.trim().length >= SEARCH_MIN_QUERY_LENGTH;
  const showNoResults = showDropdown && meetsMinLength && !isPending && results.length === 0;

  useEffect(() => {
    setActiveIndex(-1);
  }, [debouncedQuery]);

  useEffect(() => {
    function handlePointerDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function selectEntry(entry) {
    if (!entry) return;
    onSelectResult({ equipo: entry.equipo, model: entry.model, service: entry.service });
    setQuery("");
    setDebouncedQuery("");
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!showDropdown && query.trim().length >= SEARCH_MIN_QUERY_LENGTH) setIsOpen(true);
      if (results.length === 0) return;
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length === 0) return;
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (!showDropdown || results.length === 0) return;
      e.preventDefault();
      const entry = results[activeIndex >= 0 ? activeIndex : 0];
      selectEntry(entry);
    } else if (e.key === "Escape") {
      if (isOpen) {
        e.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }
    // Tab: no handler needed — native focus-out behavior already moves
    // focus away; the blur/click-outside handling below closes the
    // dropdown the same way a click outside does.
  }

  function handleClear() {
    setQuery("");
    setDebouncedQuery("");
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  const activeEntry = activeIndex >= 0 ? results[activeIndex] : null;

  return (
    <div className="wsp-search" ref={containerRef}>
      <div className="wsp-search-field">
        <Search size={16} className="wsp-search-icon" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
          aria-controls="wsp-search-listbox"
          aria-autocomplete="list"
          aria-activedescendant={activeEntry ? optionDomId(activeEntry.id) : undefined}
          aria-label={t("search.ariaLabel")}
          autoComplete="off"
          className="wsp-search-input"
          placeholder={t("search.placeholder")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (query.trim().length >= SEARCH_MIN_QUERY_LENGTH) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
        {isPending && showDropdown && (
          <Loader2 size={16} className="wsp-search-spinner" aria-hidden="true" />
        )}
        {query.length > 0 && (
          <button
            type="button"
            className="wsp-search-clear"
            onClick={handleClear}
            aria-label={t("search.clearLabel")}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      {showDropdown && (
        <ul id="wsp-search-listbox" role="listbox" className="wsp-search-listbox" aria-label={t("search.resultsLabel")}>
          {results.map((entry, i) => {
            const serviceName = translateServiceName(entry.service, language);
            const equipoName = equipoDisplayName(entry.equipo, language);
            const modelName = translateCatalogLabel(entry.model?.name, language);
            const showModel = modelName && modelName !== equipoName;
            const breadcrumb = [equipoName, showModel ? modelName : null].filter(Boolean).join(" · ");
            return (
              <li
                key={entry.id}
                id={optionDomId(entry.id)}
                role="option"
                aria-selected={i === activeIndex}
                className={`wsp-search-option${i === activeIndex ? " wsp-search-option-active" : ""}`}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => {
                  // mousedown (not click) — fires before the input's blur/
                  // the document-level mousedown-outside listener above,
                  // so a click on a result always resolves as a real
                  // selection rather than being swallowed by the close-on-
                  // outside-click handler.
                  e.preventDefault();
                  selectEntry(entry);
                }}
              >
                <ServicePhoto image={entry.service.image} alt="" size={36} className="wsp-search-option-photo" />
                <span className="wsp-search-option-text">
                  <span className="wsp-search-option-primary">
                    <HighlightedText text={serviceName} query={debouncedQuery} />
                  </span>
                  <span className="wsp-search-option-secondary">
                    <HighlightedText text={breadcrumb} query={debouncedQuery} />
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {showNoResults && (
        <div className="wsp-search-listbox wsp-search-empty" role="status">
          {t("search.noResults")}
        </div>
      )}
    </div>
  );
}
