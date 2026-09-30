/**
 * LOCAL DEVELOPMENT ONLY — never deployed (Vercel only ships /api and the
 * built site). Runs the REAL store handler (api/_lib/shop/handler.js)
 * against:
 *   - PGlite: a real in-process Postgres with supabase/shop-migration.sql
 *     applied, so reservations/paid/refunds run the exact production SQL;
 *   - an in-memory photo bucket;
 *   - a fake PayPal (no network; fee modeled as 3.49% + $0.49 just so the
 *     screens have numbers — production always stores PayPal's real fee);
 *   - the "test" shipping provider (fake rates, clearly labeled).
 *
 * Dev admin login: see DEV_ADMIN below (test-only credentials for this
 * local server; production uses the owner's Supabase account).
 */
import crypto from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { createShopHandler } from "../../api/_lib/shop/handler.js";
import { centsToValue, toCents } from "../../api/_lib/shop/validate.js";
import { createOutboxMailer } from "../../api/_lib/shop/mailer.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DEV_ADMIN = { email: "admin@tienda.dev", password: "tienda-dev-2026" };

async function createPg() {
  const db = await PGlite.create();
  await db.exec(`
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id serial primary key, bucket_id text, name text);
  `);
  await db.exec(readFileSync(join(ROOT, "supabase", "shop-migration.sql"), "utf8"));
  return db;
}

/** Same method set as api/_lib/shop/restStore.js, in plain SQL. */
export async function createPgStore({ db, imageBase = "/__shop_dev/img/" } = {}) {
  db = db || (await createPg());
  const q = async (sql, params = []) => (await db.query(sql, params)).rows;
  const one = async (sql, params) => (await q(sql, params))[0] || null;
  const json = (v) => (v === undefined ? null : typeof v === "object" && v !== null ? JSON.stringify(v) : v);
  const files = new Map();

  async function withChildren(order) {
    if (!order) return null;
    order.items = await q(`select * from shop_order_items where order_id = $1 order by title`, [order.id]);
    order.refunds = await q(`select * from shop_refunds where order_id = $1 order by created_at`, [order.id]);
    order.emails = await q(`select * from shop_email_log where order_id = $1 order by created_at`, [order.id]);
    return order;
  }

  function setClause(patch, start = 1) {
    const keys = Object.keys(patch);
    return { sql: keys.map((k, i) => `${k} = $${i + start}`).join(", "), values: keys.map((k) => json(patch[k])) };
  }

  async function insert(table, row) {
    const keys = Object.keys(row);
    return one(
      `insert into ${table} (${keys.join(",")}) values (${keys.map((_, i) => `$${i + 1}`).join(",")}) returning *`,
      keys.map((k) => json(row[k]))
    );
  }

  return {
    kind: "pglite",
    db,
    files,
    publicImageUrl: (path) => `${imageBase}${path}`,
    createSignedUpload: async (path) => `/__shop_dev/upload/${path}`,
    removeImages: async (paths) => paths.forEach((p) => files.delete(p)),

    listPublishedProducts: () => q(`select * from shop_products where status = 'published' order by created_at desc`),
    listAllProducts: () => q(`select * from shop_products order by created_at desc`),
    getProduct: (id) => one(`select * from shop_products where id = $1`, [id]),
    productsByIds: (ids) => (ids.length ? q(`select * from shop_products where id = any($1::uuid[])`, [ids]) : []),
    insertProduct: (f) => insert("shop_products", f),
    async updateProduct(id, f) {
      const { sql, values } = setClause({ ...f, updated_at: new Date().toISOString() }, 2);
      return one(`update shop_products set ${sql} where id = $1 returning *`, [id, ...values]);
    },
    deleteProduct: (id) => q(`delete from shop_products where id = $1`, [id]),

    async createOrder(p) {
      return (await one(`select shop_create_order($1::jsonb) as r`, [JSON.stringify(p)])).r;
    },
    async markOrderPaid(id, cap) {
      return (await one(`select shop_mark_order_paid($1, $2::jsonb) as r`, [id, JSON.stringify(cap)])).r;
    },
    async recordRefund(id, r) {
      return (await one(`select shop_record_refund($1, $2::jsonb) as r`, [id, JSON.stringify(r)])).r;
    },

    getOrder: async (id) => withChildren(await one(`select * from shop_orders where id = $1`, [id])),
    getOrderByPaypalId: async (pid) => withChildren(await one(`select * from shop_orders where paypal_order_id = $1`, [pid])),
    getOrderByCaptureId: async (cid) => withChildren(await one(`select * from shop_orders where paypal_capture_id = $1`, [cid])),
    getOrderByNumber: async (n) => withChildren(await one(`select * from shop_orders where order_number = $1`, [n])),
    async updateOrder(id, patch, { onlyIfStatus } = {}) {
      const { sql, values } = setClause({ ...patch, updated_at: new Date().toISOString() }, 2);
      const cond = onlyIfStatus ? ` and status = any($${values.length + 2}::text[])` : "";
      return one(`update shop_orders set ${sql} where id = $1${cond} returning *`, [id, ...values, ...(onlyIfStatus ? [onlyIfStatus] : [])]);
    },
    async listOrders({ statuses, limit = 200 } = {}) {
      const rows = statuses?.length
        ? await q(`select * from shop_orders where status = any($1::text[]) order by created_at desc limit ${limit}`, [statuses])
        : await q(`select * from shop_orders order by created_at desc limit ${limit}`);
      return Promise.all(rows.map(withChildren));
    },
    async ordersPaidBetween(fromIso, toIso, environment) {
      const rows = await q(
        `select * from shop_orders where paid_at >= $1 and paid_at < $2 and environment = $3 order by paid_at`,
        [fromIso, toIso, environment]
      );
      return Promise.all(rows.map(withChildren));
    },

    async insertEvent(ev) {
      const r = await q(
        `insert into shop_payment_events (id, event_type, resource_id, payload) values ($1,$2,$3,$4::jsonb) on conflict (id) do nothing returning id`,
        [ev.id, ev.event_type, ev.resource_id, JSON.stringify(ev.payload)]
      );
      return r.length > 0;
    },
    finishEvent: (id, error = null) => q(`update shop_payment_events set processed_at = now(), error = $2 where id = $1`, [id, error]),

    async ordersByEmail(email, environment) {
      const rows = await q(`select * from shop_orders where customer_email = $1 and environment = $2 order by created_at desc limit 100`, [email, environment]);
      return Promise.all(rows.map(withChildren));
    },
    logEmail: (row) => insert("shop_email_log", row),
    getCustomer: (email) => one(`select * from shop_customers where email = $1`, [email]),
    async upsertCustomer(row) {
      const keys = Object.keys(row);
      return one(
        `insert into shop_customers (${keys.join(",")}) values (${keys.map((_, i) => `$${i + 1}`).join(",")})
         on conflict (email) do update set ${keys.filter((k) => k !== "email").map((k) => `${k} = excluded.${k}`).join(", ")}, updated_at = now()
         returning *`,
        keys.map((k) => row[k])
      );
    },
    async deleteCustomer(email) {
      await q(`delete from shop_customer_sessions where email = $1`, [email]);
      await q(`delete from shop_customers where email = $1`, [email]);
    },
    countCustomerLinksSince: async (email, sinceIso) =>
      (await one(`select count(*)::int as n from shop_customer_links where email = $1 and created_at > $2`, [email, sinceIso])).n,
    insertCustomerLink: (row) => insert("shop_customer_links", row),
    consumeCustomerLink: (hash) =>
      one(`update shop_customer_links set used_at = now() where token_hash = $1 and used_at is null and expires_at > now() returning *`, [hash]),
    insertCustomerSession: (row) => insert("shop_customer_sessions", row),
    getCustomerSession: (hash) => one(`select * from shop_customer_sessions where token_hash = $1 and expires_at > now()`, [hash]),
    deleteCustomerSession: (hash) => q(`delete from shop_customer_sessions where token_hash = $1`, [hash]),

    getSettings: () => one(`select * from shop_settings where id = 1`),
    async saveSettings(row) {
      const { sql, values } = setClause({ ...row, updated_at: new Date().toISOString() }, 1);
      return one(`update shop_settings set ${sql} where id = 1 returning *`, values);
    },

    insertSession: (row) => insert("shop_admin_sessions", row),
    getSession: (hash) => one(`select * from shop_admin_sessions where token_hash = $1 and expires_at > now()`, [hash]),
    deleteSession: (hash) => q(`delete from shop_admin_sessions where token_hash = $1`, [hash]),
  };
}

/** Behaves like PayPal Orders v2 for the handler's purposes. */
export function createFakePaypal() {
  const orders = new Map();
  const fee = (cents) => Math.round(cents * 0.0349) + 49;
  const money = (c) => ({ currency_code: "USD", value: centsToValue(c) });
  return {
    mode: "dev",
    clientId: null,
    orders,
    nextCaptureStatus: "COMPLETED",
    async createOrder(order) {
      const id = `DEV${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
      orders.set(id, { id, customId: order.id, total: order.total_cents, captured: null });
      return { id, status: "CREATED" };
    },
    async getOrder(id) {
      const o = orders.get(id);
      return { id, status: o.captured ? "COMPLETED" : "APPROVED", purchase_units: [{ payments: { captures: o.captured ? [o.captured] : [] } }] };
    },
    async captureOrder(id) {
      const o = orders.get(id);
      if (!o) throw Object.assign(new Error("not found"), { status: 404 });
      if (!o.captured) {
        const status = this.nextCaptureStatus;
        o.captured = {
          id: `CAP${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
          status,
          amount: money(o.total),
          custom_id: o.customId,
          create_time: new Date().toISOString(),
          seller_receivable_breakdown: status === "COMPLETED"
            ? { gross_amount: money(o.total), paypal_fee: money(fee(o.total)), net_amount: money(o.total - fee(o.total)) }
            : undefined,
        };
      }
      return this.getOrder(id);
    },
    async refundCapture(captureId, amountCents) {
      return {
        id: `REF${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
        status: "COMPLETED",
        amount: money(amountCents),
        // US PayPal keeps the fixed part of the fee on refunds; returns the
        // proportional part. Modeled so the ledger shows a realistic shape.
        seller_payable_breakdown: {
          gross_amount: money(amountCents),
          paypal_fee: money(Math.round(amountCents * 0.0349)),
          net_amount: money(amountCents - Math.round(amountCents * 0.0349)),
        },
        links: [{ rel: "up", href: `https://fake/v2/payments/captures/${captureId}` }],
      };
    },
    async verifyWebhook() {
      return true;
    },
  };
}

async function seed(store) {
  const img = (file) => {
    const path = `uploads/2026/${crypto.createHash("md5").update(file).digest("hex")}.webp`;
    store.files.set(path, { type: "image/webp", body: readFileSync(join(ROOT, "src", "assets", ...file.split("/"))) });
    return path;
  };
  const services = readdirSync(join(ROOT, "src", "assets", "services"));
  const pick = (name) => `services/${services.find((f) => f.includes(name))}`;
  const rows = [
    ["PS5 HDMI port replacement kit (x5)", "Genuine-spec HDMI 2.1 ports for PS5 / PS5 Slim, tested before shipping. For experienced microsoldering techs.", "14.50", "new", "Parts", 12, [img(pick("ps5-hdmi")), img("promo-ps5-hdmi.webp")], 3, 5, 4, 1],
    ["DualSense controller — TMR sticks installed", "Refurbished DualSense with TMR (no-drift) joysticks installed and calibrated in our Miami shop. 30-day warranty.", "64.00", "refurbished", "Gaming", 2, [img("promo-controller-tmr.webp")], 20, 8, 7, 4],
    ["iPad board-level repair bench mat", "Silicone microsoldering mat, heat resistant to 500 °C, magnetic screw zones.", "22.99", "new", "Tools", 8, [img(pick("service-ipad")), img(pick("microsoldering"))], 18, 16, 12, 1],
    ["Xbox Series X — tested, like new", "Console tested for 48 hours, cleaned and repasted. Includes power cable.", "329.00", "used_like_new", "Gaming", 1, [img(pick("xbox"))], 160, 16, 12, 8],
    ["MacBook logic board — for parts", "Water-damaged board sold as-is for parts. Untested.", "45.00", "for_parts", "Parts", 0, [img(pick("macbook"))], 24, 14, 10, 3],
  ];
  for (const [title, description, price, condition, category, stock, images, w, l, wi, h] of rows) {
    await store.insertProduct({
      title, description, price_cents: toCents(price), condition, category, stock, status: "published",
      images, weight_oz: w, length_in: l, width_in: wi, height_in: h,
    });
  }
  await store.insertProduct({
    title: "JBC soldering tip holder (draft)", description: "", price_cents: 1299, condition: "used_like_new",
    category: "Tools", stock: 1, status: "draft", images: [], weight_oz: 6, length_in: 6, width_in: 4, height_in: 3,
  });
}

export async function createDevShop({ seedData = true, origin = "http://localhost:5173" } = {}) {
  const store = await createPgStore();
  if (seedData) await seed(store);
  if (seedData) {
    // Fake address for LOCAL DEVELOPMENT only — the real one is typed in
    // the panel (Settings) and lives in Supabase.
    await store.saveSettings({
      pickup_enabled: true,
      pickup_area: "Kendall, Miami",
      pickup_address: "123 Dev Test St, Suite 4, Miami, FL 33196 (DEV — not a real address)",
      pickup_hours: [
        { day: 1, open: "10:00", close: "18:00" },
        { day: 2, open: "10:00", close: "18:00" },
        { day: 3, open: "10:00", close: "18:00" },
        { day: 4, open: "10:00", close: "18:00" },
        { day: 5, open: "10:00", close: "18:00" },
        { day: 6, open: "10:00", close: "14:00" },
      ],
      pickup_notes: "Bring your order number.",
      // Example prices for LOCAL DEVELOPMENT only — the owner sets the real
      // ones in the panel (Settings → Shipping).
      shipping_options: [
        { id: "devuspsga", carrier: "USPS", service: "Ground Advantage", price_cents: 650, days_min: 2, days_max: 5, enabled: true },
        { id: "devuspspri", carrier: "USPS", service: "Priority Mail", price_cents: 995, days_min: 1, days_max: 3, enabled: true },
        { id: "devupsgnd", carrier: "UPS", service: "Ground", price_cents: 1150, days_min: 1, days_max: 5, enabled: true },
      ],
    });
  }
  const paypal = createFakePaypal();
  const mailer = createOutboxMailer();
  const handler = createShopHandler({
    store,
    config: {
      environment: "dev",
      paypal,
      webhookConfigured: false,
      adminEmails: [DEV_ADMIN.email],
      mailer,
      origin,
      authenticate: async (email, password) => (email === DEV_ADMIN.email && password === DEV_ADMIN.password ? email : null),
      secureCookies: false,
    },
  });
  return { handler, store, paypal, mailer };
}
