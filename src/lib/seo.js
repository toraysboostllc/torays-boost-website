import { useEffect } from "react";
import { siteConfig } from "../config/site.config.js";

/** Sets document title + meta description for the current page. */
export function useSEO({ title, description } = {}) {
  useEffect(() => {
    document.title = title
      ? `${title} | ${siteConfig.shortName}`
      : siteConfig.seo.defaultTitle;

    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = description || siteConfig.seo.defaultDescription;
  }, [title, description]);
}
