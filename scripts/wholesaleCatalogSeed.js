/**
 * Core seeding logic — insert-only-if-missing, keyed by the stable `slug`
 * column (not `name`, which the owner can freely rename from DESK without
 * ever causing a re-run to "not recognize" that row and re-insert it).
 *
 * NOT a CLI entrypoint, not run standalone against production — the one
 * operational way to load the catalog is running
 * supabase/wholesale-seed-initial-catalog.sql in the Supabase SQL Editor
 * (see generateWholesaleSeedSql.js, which turns the same data below into
 * that file). This function exists so tests/wholesaleCatalogSeed.test.js
 * can exercise the real insert-if-missing/idempotency/no-overwrite logic
 * against a fake fetch, without needing a second operational path that
 * asks for the Service Role Key in a terminal.
 */
import { WHOLESALE_CATALOG_SEED, DIAGNOSTIC_DESCRIPTION } from "./wholesaleCatalogSeed.data.js";

function headers(serviceKey, extra = {}) {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", ...extra };
}

async function findBySlug(fetchImpl, supabaseUrl, serviceKey, table, slug) {
  const res = await fetchImpl(`${supabaseUrl}/rest/v1/${table}?slug=eq.${encodeURIComponent(slug)}&select=id`, {
    headers: headers(serviceKey),
  });
  if (!res.ok) throw new Error(`Failed reading ${table} (HTTP ${res.status})`);
  const rows = await res.json();
  return rows[0] || null;
}

async function insertRow(fetchImpl, supabaseUrl, serviceKey, table, body) {
  const res = await fetchImpl(`${supabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: headers(serviceKey, { Prefer: "return=representation" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Failed inserting into ${table}: HTTP ${res.status} ${detail}`);
  }
  const rows = await res.json();
  return rows[0];
}

/**
 * @param {object} opts
 * @param {string} opts.supabaseUrl
 * @param {string} opts.serviceKey
 * @param {typeof fetch} [opts.fetchImpl] — injectable for tests.
 * @param {(line: string) => void} [opts.log] — injectable for tests (defaults to no-op).
 */
export async function seedWholesaleCatalog({ supabaseUrl, serviceKey, fetchImpl = fetch, log = () => {} }) {
  if (!supabaseUrl || !serviceKey) {
    throw new Error("supabaseUrl and serviceKey are both required.");
  }

  const summary = { categoriesCreated: 0, categoriesSkipped: 0, servicesCreated: 0, servicesSkipped: 0 };

  for (const cat of WHOLESALE_CATALOG_SEED) {
    let categoryId;
    const existingCategory = await findBySlug(fetchImpl, supabaseUrl, serviceKey, "wholesale_categories", cat.slug);
    if (existingCategory) {
      categoryId = existingCategory.id;
      summary.categoriesSkipped++;
      log(`= category "${cat.name}" already exists — left untouched.`);
    } else {
      const row = await insertRow(fetchImpl, supabaseUrl, serviceKey, "wholesale_categories", {
        slug: cat.slug,
        name: cat.name,
        notes: cat.notes || null,
        diagnostic_fee: null,
        diagnostic_description: DIAGNOSTIC_DESCRIPTION,
        active: false,
        sort_order: cat.sortOrder,
      });
      categoryId = row.id;
      summary.categoriesCreated++;
      log(`+ created category "${cat.name}" (inactive)`);
    }

    for (let i = 0; i < cat.services.length; i++) {
      const s = cat.services[i];
      const existingService = await findBySlug(fetchImpl, supabaseUrl, serviceKey, "wholesale_services", s.slug);
      if (existingService) {
        summary.servicesSkipped++;
        continue;
      }
      await insertRow(fetchImpl, supabaseUrl, serviceKey, "wholesale_services", {
        slug: s.slug,
        category_id: categoryId,
        name: s.name,
        pricing_type: s.pricingType,
        fixed_price: s.pricingType === "fixed" ? s.fixedPrice : null,
        price_min: s.pricingType === "range" ? s.priceMin : null,
        price_max: s.pricingType === "range" ? s.priceMax : null,
        notes: s.notes || null,
        active: false,
        sort_order: i,
      });
      summary.servicesCreated++;
      log(`  + created service "${s.name}" (inactive)`);
    }
  }

  return summary;
}
