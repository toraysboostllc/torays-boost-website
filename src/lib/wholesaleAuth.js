/**
 * Wholesale gateway API calls. No localStorage, no client-held tokens —
 * session/device identity live entirely in HttpOnly cookies set by
 * api/wholesale-login.js. The browser sends them automatically on
 * same-origin requests; this file just calls the endpoints and reads
 * their responses.
 */
export async function wholesaleLogin(shopName, code) {
  const res = await fetch("/api/wholesale-login", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shopName, code }),
  });
  const data = await res.json().catch(() => ({}));

  if (res.status === 200 && data.status === "ok") {
    return { ok: true };
  }
  if (res.status === 202 && data.status === "pending_device") {
    return { ok: false, pending: true, message: data.message };
  }
  return { ok: false, message: data.message || "Login failed." };
}

/**
 * `kind` on a failed result tells the caller what to DO about it — this is
 * the fix for a real bug: WholesalePrices.jsx used to redirect to /wholesale
 * on ANY failure here, including a transient 502/network error that has
 * nothing to do with the session. Only "auth" (401/403 — the session is
 * genuinely gone or access was revoked) should ever trigger a redirect;
 * "transient" (any other non-2xx, or the fetch itself throwing — offline,
 * DNS, CORS, etc.) means the caller should show the real error inline and
 * offer Retry, never silently bounce to the login screen.
 *
 * "legal_required" is its own distinct kind, not folded into "auth" — a
 * 403 with error: 'legal_acceptance_required' (see api/wholesale-prices.js)
 * means the session and device are both genuinely fine; the shop just needs
 * to see one of the legal gates before the catalog is released, which is a
 * completely different UI response than "redirect to the login screen".
 * There are now TWO independent gates (the master agreement and the
 * lightweight Estimate Disclaimer), reported by the server as a `missing`
 * array in a fixed priority order — `documentType`/`legalDocumentId`/
 * `version` here mirror `missing[0]` (the single gate the caller should
 * show right now); accepting it and calling fetchWholesaleCatalog() again
 * naturally surfaces the next one, if any, with no client-side sequencing
 * logic needed.
 */
export async function fetchWholesaleCatalog() {
  let res;
  try {
    res = await fetch("/api/wholesale-prices", { credentials: "same-origin" });
  } catch {
    return { ok: false, kind: "transient", message: "Could not reach the server." };
  }

  const data = await res.json().catch(() => ({}));

  if (res.status === 403 && data.error === "legal_acceptance_required") {
    const missing = Array.isArray(data.missing) && data.missing.length ? data.missing : [
      { documentType: data.documentType, legalDocumentId: data.legalDocumentId, version: data.version },
    ];
    return {
      ok: false,
      kind: "legal_required",
      missing,
      documentType: missing[0].documentType,
      legalDocumentId: missing[0].legalDocumentId,
      version: missing[0].version,
      message: data.message || "Legal acceptance required.",
    };
  }
  if (res.status === 401 || res.status === 403) {
    return { ok: false, kind: "auth", message: data.message || "Session expired." };
  }
  if (!res.ok) {
    return { ok: false, kind: "transient", message: data.message || "Could not load prices." };
  }
  return {
    ok: true,
    shopName: data.shopName,
    equipmentTypes: data.equipmentTypes || [],
    // PRIMARY channel Microsoldering arrives through — see
    // api/_lib/wholesaleDb.js's own comment for the real, reproduced
    // old-client-tab reason this is a separate field.
    microsolderingEquipmentType: data.microsolderingEquipmentType || null,
    // TEMPORARY compatibility passthrough — see buildWholesaleWizardCatalog's
    // header for what this is for (an old server only) and when to delete
    // it. Not read anywhere else in this file.
    legacyMicrosoldering: data.microsoldering || null,
    salesModule: data.salesModule || null,
    // Global service warranty — see api/_lib/wholesaleDb.js's own comment.
    // `|| null`, same fallback shape as every other field here, so an old
    // cached client tab hitting a server response with no `warranty` key
    // at all (impossible today, but the same defensive convention as the
    // rest of this file) degrades to "no warranty configured" rather than
    // throwing.
    warranty: data.warranty || null,
  };
}

export async function wholesaleLogout() {
  await fetch("/api/wholesale-logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
}

/**
 * Public GET, no auth — used both by the standalone /wholesale/legal page
 * and by the clickwrap modal's own "read the full document" links, so both
 * always show the exact same live published bundle. Never throws; a
 * transient failure just means the caller shows its own inline error.
 */
export async function fetchWholesaleLegalDocuments() {
  let res;
  try {
    res = await fetch("/api/wholesale-legal-documents", { credentials: "same-origin" });
  } catch {
    return { ok: false, message: "Could not reach the server." };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, message: data.message || "Could not load the legal documents." };
  }
  return {
    ok: true,
    version: data.version,
    content_en: data.content_en,
    content_es: data.content_es,
    content_hash: data.content_hash,
    published_at: data.published_at,
  };
}

/**
 * Submits the clickwrap acceptance. `checkboxes` is passed through exactly
 * as the 5-key shape api/wholesale-accept-legal.js expects
 * ({confirmsAuthority, acceptsTermsPrivacy, understandsTiersOptional,
 * understandsIndependentPricing, acceptsConfidentiality}) — this function
 * does no re-shaping or renaming, so the modal's own state object and the
 * wire shape stay identical and easy to audit against each other.
 */
export async function acceptWholesaleLegalTerms({ legalDocumentId, representativeName, representativeTitle, checkboxes, locale }) {
  let res;
  try {
    res = await fetch("/api/wholesale-accept-legal", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ legalDocumentId, representativeName, representativeTitle, checkboxes, locale }),
    });
  } catch {
    return { ok: false, message: "Could not reach the server." };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data.error, message: data.message || "Could not record acceptance." };
  }
  return { ok: true };
}

/**
 * The lightweight Estimate Disclaimer — a single bilingual body of text,
 * accepted with one checkbox, independent of and in parallel with the
 * master agreement above (see wholesale-legal-document-types-migration.sql
 * for the full "why two document types" reasoning). Same public,
 * no-auth, never-throws shape as fetchWholesaleLegalDocuments() above.
 */
export async function fetchWholesaleEstimateDisclaimer() {
  let res;
  try {
    res = await fetch("/api/wholesale-estimate-disclaimer", { credentials: "same-origin" });
  } catch {
    return { ok: false, message: "Could not reach the server." };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, message: data.message || "Could not load the estimate disclaimer." };
  }
  return {
    ok: true,
    version: data.version,
    content_en: data.content_en,
    content_es: data.content_es,
    content_hash: data.content_hash,
    published_at: data.published_at,
  };
}

/** Submits the single-checkbox acceptance — no representative name/title,
 *  matching api/wholesale-accept-estimate-disclaimer.js's own lighter
 *  payload shape. */
export async function acceptWholesaleEstimateDisclaimer({ legalDocumentId, accepted, locale }) {
  let res;
  try {
    res = await fetch("/api/wholesale-accept-estimate-disclaimer", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ legalDocumentId, accepted, locale }),
    });
  } catch {
    return { ok: false, message: "Could not reach the server." };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data.error, message: data.message || "Could not record acceptance." };
  }
  return { ok: true };
}
