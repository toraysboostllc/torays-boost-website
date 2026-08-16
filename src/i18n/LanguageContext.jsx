import { createContext, useContext, useEffect, useState } from "react";
import { translations, formatTranslation } from "./translations.js";

const LanguageContext = createContext(null);
const STORAGE_KEY = "torays_lang";

function detectInitialLanguage() {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "es") return stored;
  const browserLang = window.navigator?.language || window.navigator?.userLanguage || "en";
  return browserLang.toLowerCase().startsWith("es") ? "es" : "en";
}

function lookup(dict, key) {
  return key.split(".").reduce((node, part) => (node == null ? undefined : node[part]), dict);
}

/**
 * App-wide language state — English/Spanish only, per the approved i18n
 * scope. Wraps the whole app in main.jsx, but Wholesale pages never import
 * useLanguage(), so they're completely unaffected (still English, exactly
 * as before this change).
 */
export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(detectInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  function setLang(next) {
    if (next !== "en" && next !== "es") return;
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage unavailable (private browsing, etc.) — language still
      // works for the session, it just won't persist across visits.
    }
  }

  function t(key, vars) {
    const value = lookup(translations[lang], key) ?? lookup(translations.en, key) ?? key;
    return typeof value === "string" && vars ? formatTranslation(value, vars) : value;
  }

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
