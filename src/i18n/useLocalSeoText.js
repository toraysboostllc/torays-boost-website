import { useLanguage } from "./LanguageContext.jsx";
import { formatTranslation } from "./translations.js";
import { localSeoTranslations } from "./localSeoTranslations.js";

function lookup(dict, key) {
  return key.split(".").reduce((node, part) => (node == null ? undefined : node[part]), dict);
}

/**
 * Same lookup/fallback-to-English behavior as useLanguage()'s own t(), but
 * reads from localSeoTranslations instead of the main translations dict —
 * see that file's header comment for why: keeping this content out of
 * translations.js keeps it out of the main/initial bundle entirely, since
 * only the local SEO pages' own (lazy-loaded) components import it.
 */
export function useLocalSeoText() {
  const { lang } = useLanguage();

  function t(key, vars) {
    const value = lookup(localSeoTranslations[lang], key) ?? lookup(localSeoTranslations.en, key) ?? key;
    return typeof value === "string" && vars ? formatTranslation(value, vars) : value;
  }

  return { t };
}
