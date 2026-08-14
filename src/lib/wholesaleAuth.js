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

export async function fetchWholesaleCatalog() {
  const res = await fetch("/api/wholesale-prices", { credentials: "same-origin" });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return { ok: false, message: data.message || "Could not load prices." };
  }
  return { ok: true, shopName: data.shopName, categories: data.categories || [] };
}

export async function wholesaleLogout() {
  await fetch("/api/wholesale-logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
}
