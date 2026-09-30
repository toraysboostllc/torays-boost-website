/**
 * Store backed by Supabase (PostgREST + Storage) with the SECRET/service
 * key — server-side only, never imported by client code. Every shop table
 * has RLS on with no policies, so this key is the only way in.
 *
 * Same method set as the dev/test store (scripts/dev/shopPgStore.js); the
 * business rules that must be atomic (reservations, paid, refunds) live in
 * SQL functions both stores call, so they can't drift apart.
 */
export const BUCKET = "shop-product-images";

export function normalizeSupabaseUrl(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed || /\/rest\/v1$/i.test(trimmed)) return null;
  return trimmed;
}

const ORDER_SELECT = "*,items:shop_order_items(*),refunds:shop_refunds(*),emails:shop_email_log(*)";

export function createRestStore({ url, serviceKey, fetchImpl = fetch }) {
  const baseHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };

  async function rest(path, { method = "GET", body, prefer } = {}) {
    const res = await fetchImpl(`${url}/rest/v1/${path}`, {
      method,
      headers: { ...baseHeaders, ...(prefer ? { Prefer: prefer } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      const err = new Error(`supabase_rest_failed: ${res.status}`);
      try {
        err.pg = JSON.parse(text);
      } catch {
        err.pg = { message: text };
      }
      throw err;
    }
    return text.trim() ? JSON.parse(text) : null;
  }

  const rpc = (fn, args) => rest(`rpc/${fn}`, { method: "POST", body: args });
  const one = (rows) => (Array.isArray(rows) ? rows[0] || null : rows);
  const enc = encodeURIComponent;

  return {
    kind: "rest",

    publicImageUrl: (path) => `${url}/storage/v1/object/public/${BUCKET}/${path}`,

    async createSignedUpload(path) {
      const res = await fetchImpl(`${url}/storage/v1/object/upload/sign/${BUCKET}/${path}`, {
        method: "POST",
        headers: baseHeaders,
        body: "{}",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) throw new Error(`storage_sign_failed: ${res.status}`);
      return `${url}/storage/v1${body.url}`;
    },

    async removeImages(paths) {
      if (!paths.length) return;
      await fetchImpl(`${url}/storage/v1/object/${BUCKET}`, {
        method: "DELETE",
        headers: baseHeaders,
        body: JSON.stringify({ prefixes: paths }),
      });
    },

    listPublishedProducts: () => rest("shop_products?status=eq.published&order=created_at.desc&select=*"),
    listAllProducts: () => rest("shop_products?order=created_at.desc&select=*"),
    getProduct: async (id) => one(await rest(`shop_products?id=eq.${enc(id)}&select=*`)),
    productsByIds: (ids) => (ids.length ? rest(`shop_products?id=in.(${ids.map(enc).join(",")})&select=*`) : []),
    insertProduct: async (fields) => one(await rest("shop_products", { method: "POST", body: fields, prefer: "return=representation" })),
    updateProduct: async (id, fields) =>
      one(await rest(`shop_products?id=eq.${enc(id)}`, { method: "PATCH", body: { ...fields, updated_at: new Date().toISOString() }, prefer: "return=representation" })),
    deleteProduct: (id) => rest(`shop_products?id=eq.${enc(id)}`, { method: "DELETE" }),

    createOrder: (payload) => rpc("shop_create_order", { p: payload }),
    markOrderPaid: (orderId, capture) => rpc("shop_mark_order_paid", { p_order_id: orderId, p: capture }),
    recordRefund: (orderId, refund) => rpc("shop_record_refund", { p_order_id: orderId, p: refund }),

    getOrder: async (id) => one(await rest(`shop_orders?id=eq.${enc(id)}&select=${ORDER_SELECT}`)),
    getOrderByPaypalId: async (pid) => one(await rest(`shop_orders?paypal_order_id=eq.${enc(pid)}&select=${ORDER_SELECT}`)),
    getOrderByCaptureId: async (cid) => one(await rest(`shop_orders?paypal_capture_id=eq.${enc(cid)}&select=${ORDER_SELECT}`)),
    getOrderByNumber: async (n) => one(await rest(`shop_orders?order_number=eq.${enc(n)}&select=${ORDER_SELECT}`)),
    /** Conditional update: only applied while the order is still in one of
     *  `onlyIfStatus` (when given). Returns the updated row or null. */
    async updateOrder(id, patch, { onlyIfStatus } = {}) {
      const cond = onlyIfStatus ? `&status=in.(${onlyIfStatus.join(",")})` : "";
      return one(await rest(`shop_orders?id=eq.${enc(id)}${cond}`, {
        method: "PATCH",
        body: { ...patch, updated_at: new Date().toISOString() },
        prefer: "return=representation",
      }));
    },
    listOrders({ statuses, limit = 200 } = {}) {
      const cond = statuses?.length ? `status=in.(${statuses.join(",")})&` : "";
      return rest(`shop_orders?${cond}order=created_at.desc&limit=${limit}&select=${ORDER_SELECT}`);
    },
    ordersPaidBetween(fromIso, toIso, environment) {
      return rest(
        `shop_orders?paid_at=gte.${enc(fromIso)}&paid_at=lt.${enc(toIso)}&environment=eq.${enc(environment)}&order=paid_at.asc&select=${ORDER_SELECT}`
      );
    },

    /** true if new, false if PayPal already delivered this event id. */
    async insertEvent(ev) {
      const rows = await rest("shop_payment_events?on_conflict=id", {
        method: "POST",
        body: ev,
        prefer: "resolution=ignore-duplicates,return=representation",
      });
      return Array.isArray(rows) && rows.length > 0;
    },
    finishEvent: (id, error = null) =>
      rest(`shop_payment_events?id=eq.${enc(id)}`, { method: "PATCH", body: { processed_at: new Date().toISOString(), error } }),

    ordersByEmail: (email, environment) =>
      rest(`shop_orders?customer_email=eq.${enc(email)}&environment=eq.${enc(environment)}&order=created_at.desc&limit=100&select=${ORDER_SELECT}`),
    logEmail: (row) => rest("shop_email_log", { method: "POST", body: row }),

    getCustomer: async (email) => one(await rest(`shop_customers?email=eq.${enc(email)}&select=*`)),
    upsertCustomer: async (row) =>
      one(await rest("shop_customers?on_conflict=email", {
        method: "POST",
        body: { ...row, updated_at: new Date().toISOString() },
        prefer: "resolution=merge-duplicates,return=representation",
      })),
    async deleteCustomer(email) {
      await rest(`shop_customer_sessions?email=eq.${enc(email)}`, { method: "DELETE" });
      await rest(`shop_customers?email=eq.${enc(email)}`, { method: "DELETE" });
    },
    countCustomerLinksSince: async (email, sinceIso) =>
      (await rest(`shop_customer_links?email=eq.${enc(email)}&created_at=gt.${enc(sinceIso)}&select=token_hash`)).length,
    insertCustomerLink: (row) => rest("shop_customer_links", { method: "POST", body: row }),
    /** One-time: marks the link used in the same statement that finds it,
     *  so a link can never open two sessions. */
    consumeCustomerLink: async (hash) =>
      one(await rest(`shop_customer_links?token_hash=eq.${enc(hash)}&used_at=is.null&expires_at=gt.${enc(new Date().toISOString())}`, {
        method: "PATCH",
        body: { used_at: new Date().toISOString() },
        prefer: "return=representation",
      })),
    insertCustomerSession: (row) => rest("shop_customer_sessions", { method: "POST", body: row }),
    getCustomerSession: async (hash) =>
      one(await rest(`shop_customer_sessions?token_hash=eq.${enc(hash)}&expires_at=gt.${enc(new Date().toISOString())}&select=*`)),
    deleteCustomerSession: (hash) => rest(`shop_customer_sessions?token_hash=eq.${enc(hash)}`, { method: "DELETE" }),

    getSettings: async () => one(await rest("shop_settings?id=eq.1&select=*")),
    saveSettings: async (row) =>
      one(await rest("shop_settings?id=eq.1", { method: "PATCH", body: { ...row, updated_at: new Date().toISOString() }, prefer: "return=representation" })),

    insertSession: (row) => rest("shop_admin_sessions", { method: "POST", body: row }),
    getSession: async (hash) => one(await rest(`shop_admin_sessions?token_hash=eq.${enc(hash)}&expires_at=gt.${enc(new Date().toISOString())}&select=*`)),
    deleteSession: (hash) => rest(`shop_admin_sessions?token_hash=eq.${enc(hash)}`, { method: "DELETE" }),
  };
}

/** Checks the owner's own Supabase Auth credentials (the DESK login),
 *  server-side. Returns the verified email or null. */
export async function supabasePasswordAuth({ url, serviceKey, fetchImpl = fetch }, email, password) {
  const res = await fetchImpl(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: serviceKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  const body = await res.json().catch(() => ({}));
  return body?.user?.email ? String(body.user.email).toLowerCase() : null;
}
