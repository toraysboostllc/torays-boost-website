/**
 * Vercel Function — public GET of the currently published Torays Boost Pro
 * Legal Bundle (6 documents, EN+ES). No auth, no cookie, no session check:
 * this is the "pre-login legal pages" every one of the 6 documents itself
 * promises (Document 6, Electronic Consent & Records Disclosure, Section 2:
 * "Every document may be printed or downloaded before or after acceptance,
 * at no charge, from the Portal or from the pre-login legal pages.") — a
 * Shop must be able to read and print these before ever logging in, and the
 * clickwrap modal's own "read" links reuse this same endpoint.
 *
 * Cache-Control: no-store on purpose (never no-store's usual companion,
 * "public, max-age=..." — this must always be live, never a cached stale
 * version) — reuses setPrivateHeaders() from _lib/wholesaleDb.js, the same
 * helper every other wholesale-*.js handler calls first, which already sets
 * exactly that plus X-Robots-Tag. The response body itself carries no
 * session/shop-specific data (it's the same content for every visitor), but
 * "private" in Cache-Control only affects shared/proxy caching — it does
 * not make the content itself session-scoped, and it costs nothing here.
 */
import { getEnv, setPrivateHeaders, getPublishedLegalDocument } from "./_lib/wholesaleDb.js";

export default async function handler(req, res) {
  setPrivateHeaders(res);

  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed", message: "Method not allowed." });
    return;
  }

  let env;
  try {
    env = getEnv();
  } catch {
    res.status(500).json({ error: "not_configured", message: "Legal documents aren't configured on the server yet." });
    return;
  }

  const doc = await getPublishedLegalDocument(env).catch(() => null);
  if (!doc) {
    res.status(404).json({ error: "not_found", message: "No published legal document bundle yet." });
    return;
  }

  res.status(200).json({
    version: doc.version,
    content_en: doc.content_en,
    content_es: doc.content_es,
    content_hash: doc.content_hash,
    published_at: doc.published_at,
  });
}
