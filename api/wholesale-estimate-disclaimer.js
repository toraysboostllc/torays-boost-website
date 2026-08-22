/**
 * Vercel Function — public GET of the currently published Estimate
 * Disclaimer (a single bilingual body of text, independent of and in
 * parallel with the Torays Boost Pro Legal Bundle — see
 * supabase/wholesale-legal-document-types-migration.sql's own header for
 * the full "why two separate document types" reasoning). No auth, no
 * cookie, no session check — same "readable before ever logging in"
 * posture as wholesale-legal-documents.js.
 *
 * Cache-Control: no-store (never a cached stale version) — reuses
 * setPrivateHeaders() from _lib/wholesaleDb.js, same as every other
 * wholesale-*.js handler.
 */
import { getEnv, setPrivateHeaders, getPublishedEstimateDisclaimer } from "./_lib/wholesaleDb.js";

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
    res.status(500).json({ error: "not_configured", message: "The estimate disclaimer isn't configured on the server yet." });
    return;
  }

  const doc = await getPublishedEstimateDisclaimer(env).catch(() => null);
  if (!doc) {
    res.status(404).json({ error: "not_found", message: "No published estimate disclaimer yet." });
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
