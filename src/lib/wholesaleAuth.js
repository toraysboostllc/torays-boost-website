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
 */
export async function fetchWholesaleCatalog() {
  let res;
  try {
    res = await fetch("/api/wholesale-prices", { credentials: "same-origin" });
  } catch {
    return { ok: false, kind: "transient", message: "Could not reach the server." };
  }

  const data = await res.json().catch(() => ({}));

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
    microsoldering: data.microsoldering || null,
    salesModule: data.salesModule || null,
  };
}

export async function wholesaleLogout() {
  await fetch("/api/wholesale-logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
}
