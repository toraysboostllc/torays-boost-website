import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(join(__dirname, "..", "supabase", f), "utf8");
const migration = read("shop-migration.sql");
const rollback = read("shop-rollback.sql");

/** Real Postgres (PGlite) with a minimal stand-in for Supabase's storage
 *  schema — the only non-public object the migration touches. */
async function freshDb() {
  const db = await PGlite.create();
  await db.exec(`
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id serial primary key, bucket_id text, name text);
  `);
  await db.exec(migration);
  return db;
}

async function addProduct(db, { stock = 5, price = 2299, status = "published", title = "HDMI" } = {}) {
  const { rows } = await db.query(
    `insert into shop_products (title, price_cents, stock, status) values ($1, $2, $3, $4) returning id`,
    [title, price, stock, status]
  );
  return rows[0].id;
}

function orderPayload(items, extra = {}) {
  return {
    items,
    shipping_cents: 645,
    public_token: "tok",
    environment: "sandbox",
    customer_name: "Juan",
    customer_email: "j@x.com",
    ship_line1: "1 Main",
    ship_city: "Miami",
    ship_state: "FL",
    ship_zip: "33131",
    shipping_provider: "test",
    shipping_carrier: "USPS",
    shipping_service: "Ground Advantage",
    ...extra,
  };
}

async function createOrder(db, items) {
  const { rows } = await db.query(`select shop_create_order($1::jsonb) as r`, [JSON.stringify(orderPayload(items))]);
  return rows[0].r;
}

async function stockOf(db, id) {
  const { rows } = await db.query(`select stock from shop_products where id = $1`, [id]);
  return rows[0].stock;
}

describe("shop-migration.sql", () => {
  let db;
  beforeEach(async () => {
    db = await freshDb();
  });

  it("is idempotent — running it twice succeeds", async () => {
    await db.exec(migration);
  });

  it("enables RLS on every shop table and defines no policies", async () => {
    const { rows } = await db.query(
      `select relname, relrowsecurity from pg_class where relkind = 'r' and relname like 'shop\\_%'`
    );
    expect(rows.length).toBe(11);
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
    expect(migration).not.toMatch(/create policy/i);
  });

  it("rejects a 6th photo and invalid conditions at the database level", async () => {
    await expect(
      db.query(`insert into shop_products (title, price_cents, images) values ('x', 100, '["a","b","c","d","e","f"]')`)
    ).rejects.toThrow();
    await expect(db.query(`insert into shop_products (title, price_cents, condition) values ('x', 100, 'broken')`)).rejects.toThrow();
    await db.query(`insert into shop_products (title, price_cents, images) values ('x', 100, '["a","b","c","d","e"]')`);
  });

  it("prices the order from the database, never the request, and numbers it TB-YYYY-NNNN", async () => {
    const p = await addProduct(db, { price: 2299 });
    const { rows } = await db.query(`select shop_create_order($1::jsonb) as r`, [
      JSON.stringify(orderPayload([{ product_id: p, quantity: 2, unit_price_cents: 1 }])),
    ]);
    const r = rows[0].r;
    expect(r.items_cents).toBe(4598);
    expect(r.total_cents).toBe(4598 + 645);
    expect(r.order_number).toMatch(/^TB-\d{4}-0001$/);
    const items = await db.query(`select unit_price_cents, quantity from shop_order_items where order_id = $1`, [r.id]);
    expect(items.rows).toEqual([{ unit_price_cents: 2299, quantity: 2 }]);
  });

  it("merges duplicate lines of the same product before checking stock", async () => {
    const p = await addProduct(db, { stock: 3 });
    await expect(createOrder(db, [{ product_id: p, quantity: 2 }, { product_id: p, quantity: 2 }])).rejects.toThrow(/insufficient_stock/);
  });

  it("refuses drafts and unknown products", async () => {
    const draft = await addProduct(db, { status: "draft" });
    await expect(createOrder(db, [{ product_id: draft, quantity: 1 }])).rejects.toThrow(/product_unavailable/);
    await expect(
      createOrder(db, [{ product_id: "00000000-0000-0000-0000-000000000000", quantity: 1 }])
    ).rejects.toThrow(/product_unavailable/);
  });

  it("reserves units while pending, and releases them when the reservation expires", async () => {
    const p = await addProduct(db, { stock: 1 });
    const first = await createOrder(db, [{ product_id: p, quantity: 1 }]);
    await expect(createOrder(db, [{ product_id: p, quantity: 1 }])).rejects.toThrow(/insufficient_stock/);
    expect(await stockOf(db, p)).toBe(1); // nothing decremented before payment
    await db.query(`update shop_orders set reserved_until = now() - interval '1 minute' where id = $1`, [first.id]);
    await createOrder(db, [{ product_id: p, quantity: 1 }]);
  });

  it("a payment_review order keeps holding its units even after the timer", async () => {
    const p = await addProduct(db, { stock: 1 });
    const o = await createOrder(db, [{ product_id: p, quantity: 1 }]);
    await db.query(
      `update shop_orders set status = 'payment_review', reserved_until = now() - interval '1 hour' where id = $1`,
      [o.id]
    );
    await expect(createOrder(db, [{ product_id: p, quantity: 1 }])).rejects.toThrow(/insufficient_stock/);
  });

  it("marks paid only once, decrements stock once, stores PayPal's fee/net", async () => {
    const p = await addProduct(db, { stock: 5 });
    const o = await createOrder(db, [{ product_id: p, quantity: 2 }]);
    const cap = { capture_id: "CAP1", gross_cents: 5243, fee_cents: 232, net_cents: 5011 };
    const first = (await db.query(`select shop_mark_order_paid($1, $2::jsonb) as r`, [o.id, JSON.stringify(cap)])).rows[0].r;
    const again = (await db.query(`select shop_mark_order_paid($1, $2::jsonb) as r`, [o.id, JSON.stringify(cap)])).rows[0].r;
    expect(first).toMatchObject({ status: "paid", already: false, oversold: false });
    expect(again).toMatchObject({ already: true });
    expect(await stockOf(db, p)).toBe(3);
    const row = (await db.query(`select status, paypal_fee_cents, paypal_net_cents, paid_at from shop_orders where id = $1`, [o.id])).rows[0];
    expect(row).toMatchObject({ status: "paid", paypal_fee_cents: 232, paypal_net_cents: 5011 });
    expect(row.paid_at).toBeTruthy();
  });

  it("flags oversold instead of refusing when PayPal already took the money", async () => {
    const p = await addProduct(db, { stock: 1 });
    const a = await createOrder(db, [{ product_id: p, quantity: 1 }]);
    await db.query(`update shop_orders set reserved_until = now() - interval '1 minute' where id = $1`, [a.id]);
    const b = await createOrder(db, [{ product_id: p, quantity: 1 }]);
    await db.query(`select shop_mark_order_paid($1, '{"capture_id":"B"}'::jsonb)`, [b.id]);
    const late = (await db.query(`select shop_mark_order_paid($1, '{"capture_id":"A"}'::jsonb) as r`, [a.id])).rows[0].r;
    expect(late.oversold).toBe(true);
    expect(await stockOf(db, p)).toBe(0);
  });

  it("records refunds idempotently, restocks once, and moves partial -> full", async () => {
    const p = await addProduct(db, { stock: 5, price: 1000 });
    const o = await createOrder(db, [{ product_id: p, quantity: 1 }]); // total 1645
    await db.query(`select shop_mark_order_paid($1, '{"capture_id":"C"}'::jsonb)`, [o.id]);
    const r1 = { paypal_refund_id: "R1", status: "COMPLETED", amount_cents: 645, fee_returned_cents: 0, net_cents: 645, source: "admin" };
    let res = (await db.query(`select shop_record_refund($1, $2::jsonb) as r`, [o.id, JSON.stringify(r1)])).rows[0].r;
    expect(res).toMatchObject({ inserted: true, status: "partially_refunded", refunded_cents: 645 });
    res = (await db.query(`select shop_record_refund($1, $2::jsonb) as r`, [o.id, JSON.stringify({ ...r1, source: "webhook" })])).rows[0].r;
    expect(res).toMatchObject({ inserted: false, refunded_cents: 645 });
    const r2 = { paypal_refund_id: "R2", status: "COMPLETED", amount_cents: 1000, net_cents: 1000, source: "admin", restock: true };
    await db.query(`select shop_record_refund($1, $2::jsonb)`, [o.id, JSON.stringify(r2)]);
    await db.query(`select shop_record_refund($1, $2::jsonb)`, [o.id, JSON.stringify(r2)]);
    expect(await stockOf(db, p)).toBe(5); // 5 - 1 sold + 1 restocked, once
    const st = (await db.query(`select status from shop_orders where id = $1`, [o.id])).rows[0].status;
    expect(st).toBe("refunded");
  });

  it("pickup orders need no address and charge no shipping; shipping orders still need both", async () => {
    const p = await addProduct(db, { stock: 2 });
    const pickup = orderPayload([{ product_id: p, quantity: 1 }], {
      fulfillment: "pickup", shipping_cents: 0, ship_line1: "", ship_city: "", ship_state: "", ship_zip: "",
      shipping_provider: "", shipping_carrier: "", shipping_service: "",
    });
    const r = (await db.query(`select shop_create_order($1::jsonb) as r`, [JSON.stringify(pickup)])).rows[0].r;
    const row = (await db.query(`select fulfillment, ship_line1, total_cents from shop_orders where id = $1`, [r.id])).rows[0];
    expect(row).toEqual({ fulfillment: "pickup", ship_line1: null, total_cents: 2299 });
    await expect(
      db.query(`select shop_create_order($1::jsonb)`, [JSON.stringify({ ...pickup, shipping_cents: 500 })])
    ).rejects.toThrow();
    await expect(
      db.query(`select shop_create_order($1::jsonb)`, [JSON.stringify({ ...pickup, fulfillment: "shipping" })])
    ).rejects.toThrow();
    await db.query(`select shop_mark_order_paid($1, '{"capture_id":"P"}'::jsonb)`, [r.id]);
    await db.query(`update shop_orders set status = 'ready_for_pickup' where id = $1`, [r.id]);
    const again = (await db.query(`select shop_mark_order_paid($1, '{"capture_id":"P"}'::jsonb) as r`, [r.id])).rows[0].r;
    expect(again.already).toBe(true);
  });

  it("rollback removes everything and can be re-applied", async () => {
    await db.exec(rollback);
    const { rows } = await db.query(`select count(*)::int as n from pg_class where relname like 'shop\\_%' and relkind = 'r'`);
    expect(rows[0].n).toBe(0);
    await db.exec(migration);
  });
});
