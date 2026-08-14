import { useEffect } from "react";
import { siteConfig } from "../config/site.config.js";

/**
 * Sets document title + meta description for the current page, and
 * optionally a noindex meta tag.
 *
 * The meta tag is defense-in-depth only — the real guarantee for
 * /wholesale is the X-Robots-Tag HTTP header set in vercel.json, since a
 * crawler that doesn't execute JS would never see this React-added tag.
 */
export function useSEO({ title, description, noindex = false } = {}) {
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

    let robotsMeta = document.querySelector('meta[name="robots"]');
    if (noindex) {
      if (!robotsMeta) {
        robotsMeta = document.createElement("meta");
        robotsMeta.name = "robots";
        document.head.appendChild(robotsMeta);
      }
      robotsMeta.content = "noindex, nofollow, noarchive";
    } else if (robotsMeta) {
      robotsMeta.remove();
    }
  }, [title, description, noindex]);
}
