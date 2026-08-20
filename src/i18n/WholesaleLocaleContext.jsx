import { createContext, useContext, useState } from "react";
import { wholesaleTranslations } from "./wholesaleTranslations.js";
import { formatTranslation } from "./translations.js";
import {
  SUPPORTED_LANGUAGES,
  WHOLESALE_LOCALE_STORAGE_KEY,
  detectInitialWholesaleLanguage,
  parseStoredWholesaleLocale,
  formatWholesalePrice,
  formatWholesaleDate,
} from "../lib/wholesaleLocale.js";

const WholesaleLocaleContext = createContext(null);

function lookup(dict, key) {
  return key.split(".").reduce((node, part) => (node == null ? undefined : node[part]), dict);
}

function readStoredLanguage() {
  if (typeof window === "undefined") return null;
  const parsed = parseStoredWholesaleLocale(window.localStorage.getItem(WHOLESALE_LOCALE_STORAGE_KEY));
  return parsed?.language ?? null;
}

function readBrowserLanguage() {
  if (typeof window === "undefined") return null;
  return window.navigator?.language || window.navigator?.userLanguage || null;
}

/**
 * Country/language/currency state for the wholesale login screen and
 * private portal — completely separate from the public site's
 * LanguageProvider (src/i18n/LanguageContext.jsx), which Wholesale has
 * never used and still doesn't. Country and currency are fixed to their
 * only supported value today (US / USD — see src/lib/wholesaleLocale.js);
 * only language is actually switchable, but all three are persisted
 * together in one localStorage entry so adding a real country/currency
 * picker later never needs a storage-shape migration.
 */
export function WholesaleLocaleProvider({ children }) {
  const [language, setLanguageState] = useState(() => detectInitialWholesaleLanguage(readStoredLanguage, readBrowserLanguage));
  const [country] = useState("US");
  const [currency] = useState("USD");

  function persist(next) {
    try {
      window.localStorage.setItem(WHOLESALE_LOCALE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // localStorage unavailable (private browsing, etc.) — the choice
      // still applies for the current session, it just won't persist.
    }
  }

  function setLanguage(next) {
    if (!SUPPORTED_LANGUAGES.includes(next)) return;
    setLanguageState(next);
    persist({ language: next, country, currency });
  }

  function t(key, vars) {
    const value = lookup(wholesaleTranslations[language], key) ?? lookup(wholesaleTranslations.en, key) ?? key;
    return typeof value === "string" && vars ? formatTranslation(value, vars) : value;
  }

  function formatPrice(amount) {
    return formatWholesalePrice(amount, { language, currency });
  }

  function formatDate(isoString) {
    return formatWholesaleDate(isoString, { language });
  }

  return (
    <WholesaleLocaleContext.Provider value={{ language, setLanguage, country, currency, t, formatPrice, formatDate }}>
      {children}
    </WholesaleLocaleContext.Provider>
  );
}

export function useWholesaleLocale() {
  const ctx = useContext(WholesaleLocaleContext);
  if (!ctx) throw new Error("useWholesaleLocale must be used within a WholesaleLocaleProvider");
  return ctx;
}
