/**
 * Browser side of the store API (api/shop.js). Every call is same-origin;
 * every POST carries the x-shop-client header the server requires (CSRF
 * guard) and rely on the HttpOnly session cookie — no token is ever
 * stored in JS or localStorage.
 */
export class ShopApiError extends Error {
  constructor(status, body) {
    super(body?.error || `http_${status}`);
    this.status = status;
    this.code = body?.error || "generic";
    this.body = body || {};
  }
}

async function request(op, { method = "GET", body, query = {} } = {}) {
  const qs = new URLSearchParams({ op, ...query }).toString();
  const res = await fetch(`/api/shop?${qs}`, {
    method,
    credentials: "same-origin",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(method === "POST" ? { "x-shop-client": "1" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ShopApiError(res.status, json);
  return json;
}

export const shopApi = {
  config: () => request("config"),
  products: () => request("products"),
  product: (id) => request("product", { query: { id } }),
  createOrder: (body) => request("create-order", { method: "POST", body }),
  captureOrder: (paypalOrderId) => request("capture-order", { method: "POST", body: { paypalOrderId } }),
  order: (number, token) => request("order", { query: { number, token } }),

  accountRequestLink: (email, language) => request("account-request-link", { method: "POST", body: { email, language } }),
  accountVerify: (link) => request("account-verify", { method: "POST", body: { link } }),
  accountMe: () => request("account-me"),
  accountUpdate: (data) => request("account-update", { method: "POST", body: data }),
  accountLogout: () => request("account-logout", { method: "POST", body: {} }),
  accountForget: () => request("account-forget", { method: "POST", body: {} }),

  adminLogin: (email, password) => request("admin-login", { method: "POST", body: { email, password } }),
  adminLogout: () => request("admin-logout", { method: "POST", body: {} }),
  adminMe: () => request("admin-me"),
  adminProducts: () => request("admin-products"),
  adminSaveProduct: (p) => request("admin-product-save", { method: "POST", body: p }),
  adminDeleteProduct: (id) => request("admin-product-delete", { method: "POST", body: { id } }),
  adminUploadUrl: (contentType) => request("admin-upload-url", { method: "POST", body: { contentType } }),
  adminOrders: (filter) => request("admin-orders", { query: filter ? { filter } : {} }),
  adminOrder: (id) => request("admin-order", { query: { id } }),
  adminUpdateOrder: (patch) => request("admin-order-update", { method: "POST", body: patch }),
  pirateShipCsvUrl: (query = {}) => `/api/shop?${new URLSearchParams({ op: "admin-pirateship-csv", ...query })}`,
  adminRefund: (id, amount, restock) => request("admin-refund", { method: "POST", body: { id, amount, restock } }),
  adminSales: (query) => request("admin-sales", { query }),
  adminSettings: () => request("admin-settings"),
  adminSaveSettings: (s) => request("admin-settings-save", { method: "POST", body: s }),
  salesCsvUrl: (query) => `/api/shop?${new URLSearchParams({ op: "admin-sales-csv", ...query })}`,
};

/** Downscales a photo in the browser (max 1600px, WebP ~0.85) so uploads
 *  are small and fast on a phone connection. Falls back to the original
 *  file when the browser can't encode WebP. */
export async function prepareImage(file, maxSide = 1600) {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  return blob && blob.type === "image/webp" ? blob : file;
}

export async function uploadImage(file) {
  const prepared = await prepareImage(file);
  const type = prepared.type || file.type;
  const { path, uploadUrl, publicUrl } = await shopApi.adminUploadUrl(type);
  const res = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": type }, body: prepared });
  if (!res.ok) throw new ShopApiError(res.status, { error: "upload_failed" });
  return { path, url: publicUrl };
}
