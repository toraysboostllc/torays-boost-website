import { useEffect } from "react";
import { siteConfig } from "../config/site.config.js";

// The confirmed live production host — canonical/OG/Twitter URLs are built
// from this, independent of siteConfig.url (which stays the apex domain
// used elsewhere, e.g. the Privacy/Terms "operates <url>" sentence, so
// changing this constant doesn't touch that unrelated copy).
const CANONICAL_ORIGIN = "https://www.toraysboost.com";

function upsertMeta(attr, key, content) {
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!content) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/**
 * Sets document title, meta description, and (optionally) canonical URL +
 * Open Graph + Twitter meta + JSON-LD structured data for the current page.
 *
 * Every field beyond title/description/noindex is opt-in via `path` — a
 * page that doesn't pass `path` gets exactly the old behavior (title +
 * description + optional noindex, nothing else touched), so every existing
 * call site (Home, Privacy, Terms, ImageCredits, Wholesale pages) is
 * unaffected by this extension.
 *
 * The noindex meta tag is defense-in-depth only — the real guarantee for
 * /wholesale is the X-Robots-Tag HTTP header set in vercel.json, since a
 * crawler that doesn't execute JS would never see this React-added tag.
 */
export function useSEO({ title, description, noindex = false, path, image, jsonLd } = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${siteConfig.shortName}` : siteConfig.seo.defaultTitle;
    document.title = fullTitle;

    const desc = description || siteConfig.seo.defaultDescription;
    upsertMeta("name", "description", desc);

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

    const canonicalUrl = path ? `${CANONICAL_ORIGIN}${path}` : null;
    let canonicalEl = document.querySelector('link[rel="canonical"]');
    if (canonicalUrl) {
      if (!canonicalEl) {
        canonicalEl = document.createElement("link");
        canonicalEl.rel = "canonical";
        document.head.appendChild(canonicalEl);
      }
      canonicalEl.href = canonicalUrl;
    } else {
      canonicalEl?.remove();
    }

    // Open Graph / Twitter only make sense once a page has a canonical URL
    // to point at — pages that don't pass `path` get these tags removed
    // (upsertMeta(..., null) deletes rather than sets), so navigating from
    // an SEO-enabled page to one that isn't never leaves stale meta behind.
    const imageUrl = image ? `${CANONICAL_ORIGIN}${image}` : null;
    upsertMeta("property", "og:title", canonicalUrl ? fullTitle : null);
    upsertMeta("property", "og:description", canonicalUrl ? desc : null);
    upsertMeta("property", "og:url", canonicalUrl);
    upsertMeta("property", "og:type", canonicalUrl ? "website" : null);
    upsertMeta("property", "og:site_name", canonicalUrl ? siteConfig.businessName : null);
    upsertMeta("property", "og:image", imageUrl);
    upsertMeta("name", "twitter:card", canonicalUrl ? (imageUrl ? "summary_large_image" : "summary") : null);
    upsertMeta("name", "twitter:title", canonicalUrl ? fullTitle : null);
    upsertMeta("name", "twitter:description", canonicalUrl ? desc : null);
    upsertMeta("name", "twitter:image", imageUrl);

    // Structured data — clear whatever the previous page injected, then add
    // this page's own. Clearing on every run (not just unmount) means a
    // page that doesn't pass jsonLd always ends up with zero <script>
    // tags, even coming from one that did.
    document.querySelectorAll("script[data-seo-jsonld]").forEach((el) => el.remove());
    (jsonLd || []).forEach((obj, i) => {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.seoJsonld = String(i);
      script.text = JSON.stringify(obj);
      document.head.appendChild(script);
    });
  }, [title, description, noindex, path, image, jsonLd]);
}

export const SEO_ORIGIN = CANONICAL_ORIGIN;
