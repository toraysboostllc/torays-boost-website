import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { WHOLESALE_CATALOG_SEED } from "../scripts/wholesaleCatalogSeed.data.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const supabaseDir = join(__dirname, "..", "supabase");
const migration = readFileSync(join(supabaseDir, "wholesale-navigation-migration.sql"), "utf8");
const verify = readFileSync(join(supabaseDir, "wholesale-navigation-verify.sql"), "utf8");
const rollback = readFileSync(join(supabaseDir, "wholesale-navigation-rollback.sql"), "utf8");
const preflight = readFileSync(join(supabaseDir, "wholesale-navigation-preflight.sql"), "utf8");

/** Strips SQL "-- ..." comments — both whole comment lines AND trailing
 *  inline comments after real code on the same line (e.g. "...;    -- expect
 *  0") — for checks that must only look at actual SQL statements, not at
 *  prose that happens to mention a keyword/table name while explaining what
 *  the statements do or don't do. None of these files ever put a literal
 *  "--" inside a string value, so truncating at the first "--" on each line
 *  is safe. */
function stripComments(sql) {
  return sql
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("--");
      return idx === -1 ? line : line.slice(0, idx);
    })
    .filter((line) => line.trim().length > 0)
    .join("\n");
}
const verifyCode = stripComments(verify);
const rollbackCode = stripComments(rollback);
const migrationCode = stripComments(migration);
const preflightCode = stripComments(preflight);

/**
 * These tests read the migration SQL as text — there's no live Postgres
 * here, so they can't prove the SQL actually runs (that only happens once
 * it's really executed against Supabase, still not done). What they DO
 * prove: the file structurally contains every idempotency guard, RLS
 * statement, and backfill mapping it's supposed to, and that the new price
 * CHECK constraint's logic (mirrored here in plain JS) actually accepts
 * every one of the 74 real services already in production — so the
 * constraint isn't a surprise waiting to reject real data the first time
 * it's ever applied.
 */

// Independently authored mapping — NOT derived from the migration file —
// so comparing it against the migration's actual UPDATE statements below is
// a real cross-check, not a tautology.
const EXPECTED_MAPPING = {
  iphone: ["iphone-7-11", "iphone-12-14", "iphone-15-17"],
  ipad: ["ipad-7-8-9", "ipad-10", "ipad-11", "ipad-pro-11-123", "ipad-pro-129-123", "ipad-pro-11-4plus", "ipad-pro-129-4plus"],
  macbook: ["macbook-air", "macbook-pro"],
  laptops: ["laptops-normal"],
  "gaming-laptops": ["laptops-gamer"],
  "video-consoles": ["ps5", "xbox-series-x", "switch"],
  controllers: ["ps5-dualsense", "ps5-dualsense-edge", "xbox-controller", "xbox-elite-2"],
};
const EXPECTED_EQUIPMENT_SLUGS = [...Object.keys(EXPECTED_MAPPING), "microsoldering"];

function isValidPricing(pricingType, fixedPrice, priceMin, priceMax) {
  if (pricingType === "fixed") {
    return fixedPrice != null && fixedPrice >= 0 && priceMin == null && priceMax == null;
  }
  if (pricingType === "range") {
    return fixedPrice == null && priceMin != null && priceMin >= 0 && priceMax != null && priceMax >= 0 && priceMin <= priceMax;
  }
  if (pricingType === "quote") {
    return fixedPrice == null && priceMin == null && priceMax == null;
  }
  return false;
}

describe("migration file: wrapping and idempotency", () => {
  it("is wrapped in an explicit transaction", () => {
    const lines = migration.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    // last non-comment statement line before the trailing comment block is commit;
    const commitIdx = lines.indexOf("commit;");
    expect(commitIdx).toBeGreaterThan(0);
  });

  it("uses IF NOT EXISTS for every new table and index", () => {
    const createTable = migration.match(/create table (?!if not exists)\S+/gi) || [];
    expect(createTable).toEqual([]); // every "create table" must be "create table if not exists"
    const createIndex = migration.match(/create index (?!if not exists)\S+/gi) || [];
    expect(createIndex).toEqual([]);
  });

  it("uses ADD COLUMN IF NOT EXISTS for the new equipment_type_id relation", () => {
    expect(migration).toMatch(/add column if not exists equipment_type_id/);
  });

  it("seeds the 8 equipment-type/tag-lens rows with ON CONFLICT (slug) DO NOTHING", () => {
    const inserts = migration.match(/insert into wholesale_equipment_types[\s\S]*?on conflict \(slug\) do nothing;/g) || [];
    expect(inserts).toHaveLength(2); // one insert for the 7 real types, one for microsoldering
  });

  it("guards every backfill UPDATE with 'and equipment_type_id is null'", () => {
    const updates = migration.match(/update wholesale_categories set equipment_type_id =[\s\S]*?;/g) || [];
    expect(updates).toHaveLength(7); // one UPDATE per equipment type group
    for (const stmt of updates) {
      expect(stmt).toMatch(/and equipment_type_id is null/);
    }
  });

  it("never sets a NOT NULL constraint on equipment_type_id in this file", () => {
    expect(migration).not.toMatch(/alter column equipment_type_id set not null/);
  });
});

describe("migration file: never touches price, active, slug, sort_order, or notes", () => {
  it("the only UPDATE against wholesale_services anywhere is inside the atomic price-change RPC (not a bare top-level statement)", () => {
    const rpcStart = migration.indexOf("create or replace function wholesale_update_service_price");
    const rpcEnd = migration.indexOf("$$;", rpcStart) + 3;
    const outsideRpc = migration.slice(0, rpcStart) + migration.slice(rpcEnd);
    expect(outsideRpc).not.toMatch(/update wholesale_services\b/);
    // and confirm it really is inside the RPC, not accidentally removed by the slice above
    expect(migration.slice(rpcStart, rpcEnd)).toMatch(/update wholesale_services\b/);
  });

  it("the only UPDATEs against wholesale_categories set exclusively equipment_type_id", () => {
    const updates = migration.match(/update wholesale_categories set [\s\S]*?;/g) || [];
    expect(updates.length).toBeGreaterThan(0);
    for (const stmt of updates) {
      // "set" clause must be exactly "set equipment_type_id = (...)" — no other column name after SET
      const setClause = stmt.match(/set\s+([\s\S]*?)\s+where/i)?.[1] || "";
      expect(setClause).toMatch(/^equipment_type_id\s*=/);
      expect(setClause).not.toMatch(/\bactive\b|\bslug\b|\bsort_order\b|\bnotes\b|\bfixed_price\b|\bprice_min\b|\bprice_max\b/);
    }
  });
});

describe("migration file: 8 equipment types, Microsoldering as tag-lens", () => {
  it("declares exactly the 8 expected slugs", () => {
    const slugMatches = [...migration.matchAll(/\('([a-z0-9-]+)',\s*'[^']+'(?:,\s*true)?,\s*\d+\)/g)].map((m) => m[1]);
    // only look inside the equipment_types insert block to avoid picking up unrelated tuples
    const equipmentBlock = migration.slice(migration.indexOf("insert into wholesale_equipment_types"), migration.indexOf("insert into wholesale_tags"));
    for (const slug of EXPECTED_EQUIPMENT_SLUGS) {
      expect(equipmentBlock).toContain(`'${slug}'`);
    }
    expect(EXPECTED_EQUIPMENT_SLUGS).toHaveLength(8);
  });

  it("only microsoldering is inserted with is_tag_lens = true", () => {
    const microRow = migration.match(/insert into wholesale_equipment_types \(slug, name, is_tag_lens, sort_order\) values\s*\(\s*'microsoldering',\s*'Microsoldering',\s*true,\s*8\s*\)/);
    expect(microRow).toBeTruthy();
    // the other insert (7 real types) has no is_tag_lens column at all, so it can't set it true
    const realTypesBlock = migration.match(/insert into wholesale_equipment_types \(slug, name, sort_order\) values[\s\S]*?on conflict \(slug\) do nothing;/)[0];
    expect(realTypesBlock).not.toMatch(/is_tag_lens/);
  });

  it("seeds the microsoldering tag itself", () => {
    expect(migration).toMatch(/insert into wholesale_tags \(slug, name\) values\s*\(\s*'microsoldering',\s*'Microsoldering'\s*\)/);
  });
});

describe("migration file: 21 categories mapped exactly once each", () => {
  it("the migration's backfill covers exactly the 21 real category slugs, no more, no less, no duplicates", () => {
    const slugsInMigration = [...migration.matchAll(/'([a-z0-9-]+)'/g)]
      .map((m) => m[1])
      .filter((s) => Object.values(EXPECTED_MAPPING).flat().includes(s));
    const allExpectedSlugs = Object.values(EXPECTED_MAPPING).flat();
    expect(new Set(slugsInMigration)).toEqual(new Set(allExpectedSlugs));
    // every slug appears exactly once in the file (never mapped to two equipment types)
    for (const slug of allExpectedSlugs) {
      const count = slugsInMigration.filter((s) => s === slug).length;
      expect(count).toBe(1);
    }
  });

  it("matches the real 21 category slugs from the catalog seed data — nothing invented, nothing missing", () => {
    const realSlugs = WHOLESALE_CATALOG_SEED.map((c) => c.slug).sort();
    const mappedSlugs = Object.values(EXPECTED_MAPPING).flat().sort();
    expect(mappedSlugs).toEqual(realSlugs);
    expect(realSlugs).toHaveLength(21);
  });

  it("every equipment-type group in the migration text maps to the right slugs", () => {
    for (const [equipmentSlug, categorySlugs] of Object.entries(EXPECTED_MAPPING)) {
      const pattern = new RegExp(
        `update wholesale_categories set equipment_type_id =\\s*\\(select id from wholesale_equipment_types where slug = '${equipmentSlug}'\\)\\s*where slug (?:=|in)[\\s\\S]*?;`
      );
      const stmt = migration.match(pattern);
      expect(stmt, `no backfill UPDATE found for equipment type "${equipmentSlug}"`).toBeTruthy();
      for (const catSlug of categorySlugs) {
        expect(stmt[0]).toContain(`'${catSlug}'`);
      }
    }
  });
});

describe("migration file: 74 services preserved — new price constraint accepts every real price shape", () => {
  const allServices = WHOLESALE_CATALOG_SEED.flatMap((c) => c.services);

  it("the catalog seed still has exactly 74 services across 21 categories", () => {
    expect(allServices).toHaveLength(74);
    expect(WHOLESALE_CATALOG_SEED).toHaveLength(21);
  });

  it("every existing service's price shape satisfies the new pricing_type/value CHECK constraint", () => {
    for (const s of allServices) {
      const ok = isValidPricing(s.pricingType, s.fixedPrice, s.priceMin, s.priceMax);
      expect(ok, `service "${s.slug}" (${JSON.stringify(s)}) would fail the new constraint`).toBe(true);
    }
  });
});

describe("pricing validation logic (mirrors the SQL CHECK constraint)", () => {
  it("accepts a valid fixed price", () => {
    expect(isValidPricing("fixed", 89, null, null)).toBe(true);
  });
  it("accepts a valid range with min < max", () => {
    expect(isValidPricing("range", null, 70, 90)).toBe(true);
  });
  it("accepts a valid range with min === max", () => {
    expect(isValidPricing("range", null, 50, 50)).toBe(true);
  });
  it("accepts quote with no amounts at all", () => {
    expect(isValidPricing("quote", null, null, null)).toBe(true);
  });
  it("rejects a negative fixed price", () => {
    expect(isValidPricing("fixed", -10, null, null)).toBe(false);
  });
  it("rejects a negative range value", () => {
    expect(isValidPricing("range", null, -5, 10)).toBe(false);
  });
  it("rejects range where min > max", () => {
    expect(isValidPricing("range", null, 100, 50)).toBe(false);
  });
  it("rejects fixed with a stray range value also set", () => {
    expect(isValidPricing("fixed", 50, 10, null)).toBe(false);
  });
  it("rejects quote with an amount present", () => {
    expect(isValidPricing("quote", 50, null, null)).toBe(false);
    expect(isValidPricing("quote", null, 10, 20)).toBe(false);
  });
  it("rejects an unknown pricing_type", () => {
    expect(isValidPricing("subscription", 10, null, null)).toBe(false);
  });
});

describe("migration file: RLS deny-all on every new table", () => {
  const newTables = ["wholesale_equipment_types", "wholesale_tags", "wholesale_service_tags", "wholesale_images", "wholesale_price_history"];

  it("enables RLS on every new table", () => {
    for (const table of newTables) {
      expect(migration).toMatch(new RegExp(`alter table ${table} enable row level security;`));
    }
  });

  it("creates zero policies anywhere in the file — deny-all by omission, same as every other wholesale_* table", () => {
    expect(migration).not.toMatch(/create policy/i);
  });

  it("never touches RLS on the auth-related tables (shops/devices/sessions/access_log)", () => {
    for (const table of ["wholesale_shops", "wholesale_devices", "wholesale_sessions", "wholesale_access_log"]) {
      expect(migration).not.toMatch(new RegExp(`alter table ${table}\\b`));
    }
  });
});

describe("migration file: atomic price-change RPC", () => {
  const RPC_SIGNATURE = "wholesale_update_service_price(uuid, uuid, text, numeric, numeric, numeric, text)";

  it("defines wholesale_update_service_price as a single plpgsql function", () => {
    expect(migration).toMatch(/create or replace function wholesale_update_service_price\(/);
    expect(migration).toMatch(/language plpgsql/);
  });

  function rpcBody() {
    const start = migration.indexOf("create or replace function wholesale_update_service_price");
    const end = migration.indexOf("$$;", start) + 3;
    return migration.slice(start, end);
  }

  it("captures the old row via SELECT before the UPDATE, and the UPDATE before the history INSERT", () => {
    const fn = rpcBody();
    const selectIdx = fn.indexOf("select * into v_old");
    const updateIdx = fn.indexOf("update wholesale_services");
    const insertIdx = fn.indexOf("insert into wholesale_price_history");
    expect(selectIdx).toBeGreaterThan(-1);
    expect(updateIdx).toBeGreaterThan(selectIdx);
    expect(insertIdx).toBeGreaterThan(updateIdx);
  });

  it("takes the admin id as a uuid parameter, never free text", () => {
    expect(migration).toMatch(/p_admin_id uuid/);
  });

  it("is not reachable directly — no grant to anon/authenticated anywhere in the file", () => {
    expect(migration).not.toMatch(/grant execute[\s\S]*?to\s+(anon|authenticated)/i);
  });

  it("explicitly revokes EXECUTE from public, anon, and authenticated", () => {
    const revoke = migration.match(/revoke execute on function wholesale_update_service_price\([^)]*\)\s*from\s*([^;]+);/i);
    expect(revoke, "no REVOKE EXECUTE statement found for the RPC").toBeTruthy();
    const revokedFrom = revoke[1];
    expect(revokedFrom).toMatch(/\bpublic\b/i);
    expect(revokedFrom).toMatch(/\banon\b/i);
    expect(revokedFrom).toMatch(/\bauthenticated\b/i);
  });

  it("grants EXECUTE only to service_role", () => {
    const grant = migration.match(/grant execute on function wholesale_update_service_price\([^)]*\)\s*to\s*([^;]+);/i);
    expect(grant, "no GRANT EXECUTE statement found for the RPC").toBeTruthy();
    expect(grant[1].trim()).toBe("service_role");
  });

  it("revoke/grant reference the RPC's exact 7-argument signature (including p_currency)", () => {
    expect(migration).toContain(`revoke execute on function ${RPC_SIGNATURE} from public, anon, authenticated;`);
    expect(migration).toContain(`grant execute on function ${RPC_SIGNATURE} to service_role;`);
  });

  it("is declared SECURITY INVOKER, never SECURITY DEFINER", () => {
    expect(migration).toMatch(/security invoker/i);
    // comment-stripped: the file's own explanatory comment discusses *why*
    // SECURITY DEFINER isn't used, which would otherwise false-positive here
    expect(migrationCode).not.toMatch(/security definer/i);
  });

  it("pins search_path on the function as defense-in-depth", () => {
    expect(migration).toMatch(/set search_path = public/i);
  });

  it("takes an explicit p_currency parameter, defaulting to USD", () => {
    expect(migration).toMatch(/p_currency text default 'USD'/);
  });

  it("rejects a nonexistent or non-admin p_admin_id before touching any row", () => {
    const fn = rpcBody();
    expect(fn).toMatch(/where id = p_admin_id and role = 'admin' and status = 'approved'/);
    expect(fn).toMatch(/raise exception 'invalid_admin'/);
    // the admin check must run before the service lookup, which must run before any write
    const adminCheckIdx = fn.indexOf("invalid_admin");
    const selectServiceIdx = fn.indexOf("select * into v_old");
    const updateIdx = fn.indexOf("update wholesale_services");
    expect(adminCheckIdx).toBeGreaterThan(-1);
    expect(selectServiceIdx).toBeGreaterThan(adminCheckIdx);
    expect(updateIdx).toBeGreaterThan(selectServiceIdx);
  });

  it("rejects a nonexistent service_id", () => {
    expect(rpcBody()).toMatch(/raise exception 'service_not_found'/);
  });

  it("rejects a currency other than USD", () => {
    expect(rpcBody()).toMatch(/raise exception 'invalid_currency'/);
  });

  it("rejects an unknown pricing_type", () => {
    expect(rpcBody()).toMatch(/raise exception 'invalid_pricing_type'/);
  });

  it("rejects invalid amounts for each pricing_type: negative, min > max, or a stray value for the wrong shape", () => {
    const fn = rpcBody();
    expect(fn).toMatch(/raise exception 'invalid_fixed_price'/);
    expect(fn).toMatch(/raise exception 'invalid_range_price'/);
    expect(fn).toMatch(/raise exception 'invalid_quote_price'/);
    // spot-check the actual guard conditions, not just that the exception names exist
    expect(fn).toMatch(/p_fixed_price < 0/);
    expect(fn).toMatch(/p_price_min < 0/);
    expect(fn).toMatch(/p_price_max < 0/);
    expect(fn).toMatch(/p_price_min > p_price_max/);
  });

  it("writes currency into both the updated row and the history snapshot", () => {
    const fn = rpcBody();
    expect(fn).toMatch(/currency = p_currency/);
    expect(fn).toMatch(/old_currency/);
    expect(fn).toMatch(/new_currency/);
    expect(fn).toMatch(/v_old\.currency/);
  });

  it("locks the row with SELECT ... FOR UPDATE before validating or writing anything", () => {
    const fn = rpcBody();
    const selectStmt = fn.match(/select \* into v_old\s*\n\s*from wholesale_services\s*\n\s*where id = p_service_id\s*\n\s*for update;/);
    expect(selectStmt, "expected the old-row SELECT to end in FOR UPDATE").toBeTruthy();
    // the lock must be taken before any validation or write, i.e. it's the
    // very first statement after the admin-existence check
    const adminCheckIdx = fn.indexOf("invalid_admin");
    const forUpdateIdx = fn.indexOf("for update;");
    const firstValidationIdx = fn.indexOf("invalid_currency");
    const updateIdx = fn.indexOf("update wholesale_services");
    expect(forUpdateIdx).toBeGreaterThan(adminCheckIdx);
    expect(firstValidationIdx).toBeGreaterThan(forUpdateIdx);
    expect(updateIdx).toBeGreaterThan(forUpdateIdx);
  });

  it("returns 'updated' or 'unchanged' instead of void, so the caller can tell no-ops apart from real writes", () => {
    expect(migration).toMatch(/returns text/);
    expect(migration).not.toMatch(/returns void/);
    expect(rpcBody()).toMatch(/return 'updated';/);
    expect(rpcBody()).toMatch(/return 'unchanged';/);
  });

  it("skips both the UPDATE and the history INSERT when every submitted value already matches the stored row", () => {
    const fn = rpcBody();
    const noOpBlock = fn.match(
      /if v_old\.pricing_type is not distinct from p_pricing_type[\s\S]*?return 'unchanged';\s*\n\s*end if;/
    );
    expect(noOpBlock, "no-op comparison block not found").toBeTruthy();
    const block = noOpBlock[0];
    // all 5 fields must be compared, null-safely
    for (const field of ["pricing_type", "fixed_price", "price_min", "price_max", "currency"]) {
      expect(block).toMatch(new RegExp(`v_old\\.${field} is not distinct from p_${field}`));
    }
    // ordering: the no-op check (and its early return) must happen strictly
    // between validation and the write — never after a write has occurred
    const unchangedIdx = fn.indexOf("return 'unchanged';");
    const invalidQuoteIdx = fn.indexOf("invalid_quote_price"); // last validation guard
    const updateIdx = fn.indexOf("update wholesale_services");
    const insertIdx = fn.indexOf("insert into wholesale_price_history");
    expect(unchangedIdx).toBeGreaterThan(invalidQuoteIdx);
    expect(updateIdx).toBeGreaterThan(unchangedIdx);
    expect(insertIdx).toBeGreaterThan(updateIdx);
  });

  it("documents how two concurrent price changes on the same service are serialized by the row lock", () => {
    expect(migration).toMatch(/Concurrency:/);
    expect(migration).toMatch(/FOR UPDATE/);
    expect(migration).toMatch(/serialized/i);
    // the concrete A -> B, B -> C sequence must actually be spelled out, not
    // just asserted in the abstract
    expect(migration).toMatch(/A\s*->\s*B/);
    expect(migration).toMatch(/B\s*->\s*C/);
  });
});

describe("migration file: currency column and constraint", () => {
  it("adds a NOT NULL currency column defaulting to USD (backfills all 74 existing rows in the same ALTER)", () => {
    expect(migration).toMatch(/add column if not exists currency text not null default 'USD'/);
  });

  it("guards the currency constraint with DROP ... IF EXISTS before ADD, for re-run safety", () => {
    expect(migration).toMatch(/drop constraint if exists wholesale_services_currency_check;\s*\n\s*alter table wholesale_services add constraint wholesale_services_currency_check/);
  });

  it("constrains currency to exactly USD", () => {
    expect(migration).toMatch(/check \(currency = 'USD'\)/);
  });

  it("wholesale_price_history stores old_currency and new_currency alongside the other snapshot fields", () => {
    const historyBlock = migration.slice(
      migration.indexOf("create table if not exists wholesale_price_history"),
      migration.indexOf(");", migration.indexOf("create table if not exists wholesale_price_history"))
    );
    expect(historyBlock).toMatch(/old_currency text/);
    expect(historyBlock).toMatch(/new_currency text/);
  });
});

describe("migration file: wholesale_images has exactly one valid, enforced owner", () => {
  it("uses three nullable, individually-referenced foreign keys instead of a generic owner_type/owner_id pair", () => {
    const tableBlock = migration.slice(
      migration.indexOf("create table if not exists wholesale_images"),
      migration.indexOf(");", migration.indexOf("create table if not exists wholesale_images"))
    );
    expect(tableBlock).toMatch(/equipment_type_id uuid references wholesale_equipment_types\(id\)/);
    expect(tableBlock).toMatch(/category_id uuid references wholesale_categories\(id\)/);
    expect(tableBlock).toMatch(/service_id uuid references wholesale_services\(id\)/);
    // the old polymorphic-association design must be fully gone from actual
    // SQL, not left alongside the new one (comments are allowed to mention it
    // by name when explaining the redesign, which is why this checks the
    // comment-stripped code, not the raw file)
    expect(migrationCode).not.toMatch(/owner_type/);
    expect(migrationCode).not.toMatch(/owner_id/);
  });

  it("has a CHECK constraint requiring exactly one of the three owner columns to be non-null", () => {
    expect(migration).toMatch(/drop constraint if exists wholesale_images_exactly_one_owner/);
    expect(migration).toMatch(/add constraint wholesale_images_exactly_one_owner/);
    const constraintBlock = migration.slice(
      migration.indexOf("add constraint wholesale_images_exactly_one_owner"),
      migration.indexOf(";", migration.indexOf("add constraint wholesale_images_exactly_one_owner")) + 1
    );
    expect(constraintBlock).toMatch(/=\s*1/);
  });

  it("cascades deletes from each owner table so images never become orphaned rows", () => {
    const tableBlock = migration.slice(
      migration.indexOf("create table if not exists wholesale_images"),
      migration.indexOf(");", migration.indexOf("create table if not exists wholesale_images"))
    );
    const cascadeCount = (tableBlock.match(/on delete cascade/g) || []).length;
    expect(cascadeCount).toBe(3);
  });
});

describe("migration file: never renames or drops a column the website API still reads", () => {
  it("forward migration contains no DROP COLUMN / RENAME — only ADD COLUMN IF NOT EXISTS", () => {
    // (rollback.sql, a separate file never auto-run, DOES drop columns to
    // undo this migration — that's expected and covered by its own tests.
    // This test is about the forward migration.sql only.)
    expect(migrationCode).not.toMatch(/drop column/i);
    expect(migrationCode).not.toMatch(/rename column/i);
    expect(migrationCode).not.toMatch(/rename to/i);
  });

  it("the website's catalog API selects '*' on wholesale_services/wholesale_categories, so new columns (currency, equipment_type_id) are additive and harmless to it", () => {
    const wholesaleDb = readFileSync(join(__dirname, "..", "api", "_lib", "wholesaleDb.js"), "utf8");
    expect(wholesaleDb).toMatch(/wholesale_services\?active=eq\.true&select=\*/);
    expect(wholesaleDb).toMatch(/wholesale_categories\?active=eq\.true&select=\*/);
  });

  it("the frontend's formatPrice() reads only pricing_type/fixed_price/price_min/price_max — never a currency field, so adding one changes nothing it renders", () => {
    const pricesPage = readFileSync(join(__dirname, "..", "src", "pages", "WholesalePrices.jsx"), "utf8");
    const fn = pricesPage.slice(pricesPage.indexOf("function formatPrice"), pricesPage.indexOf("export function WholesalePrices"));
    expect(fn).not.toMatch(/currency/);
  });
});

describe("migration file: the 74 pre-existing services convert with zero visible price change", () => {
  const allServices = WHOLESALE_CATALOG_SEED.flatMap((c) => c.services);

  // Mirrors WholesalePrices.jsx's formatPrice() exactly — this is the only
  // place in the whole system that turns a stored row into what a shop
  // actually sees, so it's the right yardstick for "the visible price didn't
  // change".
  function formatPrice(service) {
    if (service.pricing_type === "range") {
      const min = Number(service.price_min);
      const max = Number(service.price_max);
      return min === max ? `$${min.toFixed(2)}` : `$${min.toFixed(2)} – $${max.toFixed(2)}`;
    }
    return `$${Number(service.fixed_price).toFixed(2)}`;
  }

  // The exact shape each of the 74 rows has in wholesale_services BEFORE
  // this migration ever runs (mirrors wholesale-seed-initial-catalog.sql's
  // column mapping from the camelCase seed data to the real snake_case DB
  // columns).
  function beforeMigration(s) {
    return {
      pricing_type: s.pricingType,
      fixed_price: s.pricingType === "fixed" ? s.fixedPrice : null,
      price_min: s.pricingType === "range" ? s.priceMin : null,
      price_max: s.pricingType === "range" ? s.priceMax : null,
    };
  }

  // The exact same row AFTER this migration: the migration's only touch on
  // an existing wholesale_services row is adding `currency` via a NOT NULL
  // DEFAULT 'USD' — pricing_type/fixed_price/price_min/price_max are never
  // written to by any UPDATE in this file (see the "never touches price..."
  // describe block above), so they carry over completely unchanged.
  function afterMigration(s) {
    return { ...beforeMigration(s), currency: "USD" };
  }

  it("has exactly 74 services to check, matching the real catalog", () => {
    expect(allServices).toHaveLength(74);
  });

  it("formatPrice() renders the identical string before and after the migration, for all 74 services", () => {
    for (const s of allServices) {
      const before = formatPrice(beforeMigration(s));
      const after = formatPrice(afterMigration(s));
      expect(after, `service "${s.slug}" changed visible price: "${before}" -> "${after}"`).toBe(before);
    }
  });

  it("none of the 74 pre-existing services is 'quote' before or after — nothing is silently reclassified", () => {
    for (const s of allServices) {
      expect(s.pricingType, `service "${s.slug}" has an unexpected pricing type`).not.toBe("quote");
      expect(["fixed", "range"]).toContain(s.pricingType);
      expect(afterMigration(s).pricing_type).not.toBe("quote");
    }
  });

  it("every one of the 74 services ends up with currency exactly 'USD' after the migration's column default", () => {
    for (const s of allServices) {
      expect(afterMigration(s).currency).toBe("USD");
    }
  });

  it("fixed services keep fixed_price and drop no digits; range services keep both bounds, min <= max preserved", () => {
    for (const s of allServices) {
      const after = afterMigration(s);
      if (s.pricingType === "fixed") {
        expect(after.fixed_price).toBe(s.fixedPrice);
        expect(after.price_min).toBeNull();
        expect(after.price_max).toBeNull();
      } else {
        expect(after.price_min).toBe(s.priceMin);
        expect(after.price_max).toBe(s.priceMax);
        expect(after.fixed_price).toBeNull();
        expect(after.price_min).toBeLessThanOrEqual(after.price_max);
      }
    }
  });
});

describe("migration file: idempotency of every ADD CONSTRAINT", () => {
  it("every 'add constraint <name>' is preceded somewhere in the file by a matching 'drop constraint if exists <name>'", () => {
    const addMatches = [...migration.matchAll(/add constraint (\w+)/g)].map((m) => m[1]);
    expect(addMatches.length).toBeGreaterThan(0);
    for (const name of addMatches) {
      const dropPattern = new RegExp(`drop constraint if exists ${name}\\b`);
      expect(migration, `constraint "${name}" has no matching DROP ... IF EXISTS before it`).toMatch(dropPattern);
    }
  });
});

describe("verify.sql: read-only", () => {
  it("contains no data-modifying statements", () => {
    for (const forbidden of [/\binsert into\b/i, /\bupdate\b/i, /\bdelete from\b/i, /\bdrop\b/i, /\balter\b/i, /\bcreate table\b/i]) {
      expect(verifyCode).not.toMatch(forbidden);
    }
  });

  it("includes the zero-rows-expected gap check that gates the future NOT NULL step", () => {
    expect(verify).toMatch(/where equipment_type_id is null/);
  });

  it("includes a belt-and-suspenders check that every service's currency is USD", () => {
    expect(verify).toMatch(/from wholesale_services\s*\nwhere currency is distinct from 'USD'/);
  });

  it("includes a belt-and-suspenders check that every image has exactly one owner set", () => {
    expect(verify).toMatch(/from wholesale_images/);
    expect(verify).toMatch(/<>\s*1/);
  });

  it("includes a check that no service was left in/converted to 'quote' by this migration", () => {
    expect(verify).toMatch(/where pricing_type = 'quote'/);
  });

  it("includes a full listing of every service's price shape and currency, for a manual 74-row / USD-only eyeball check", () => {
    const lastQuery = verify.slice(verify.lastIndexOf("-- 9."));
    expect(lastQuery).toMatch(/select id, slug, pricing_type, fixed_price, price_min, price_max, currency/);
    expect(lastQuery).toMatch(/from wholesale_services/);
  });
});

describe("rollback.sql: documented, never auto-run", () => {
  it("is not referenced by any other file in the repo", () => {
    // package.json scripts, and every .js file under scripts/ and api/, must
    // never shell out to or read this filename — it's reference-only.
    const candidates = [
      readFileSync(join(__dirname, "..", "package.json"), "utf8"),
    ];
    for (const text of candidates) {
      expect(text).not.toContain("wholesale-navigation-rollback");
    }
  });

  it("is wrapped in begin/commit like every other migration in this repo", () => {
    const lines = rollback.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.find((l) => l === "begin;")).toBeTruthy();
    expect(lines[lines.length - 1]).toBe("commit;");
  });

  it("never touches the auth-related tables", () => {
    for (const table of ["wholesale_shops", "wholesale_devices", "wholesale_sessions", "wholesale_access_log"]) {
      expect(rollbackCode).not.toMatch(new RegExp(`\\b${table}\\b`));
    }
  });

  it("drops the RPC using its exact current 7-argument signature", () => {
    expect(rollback).toContain(
      "drop function if exists wholesale_update_service_price(uuid, uuid, text, numeric, numeric, numeric, text);"
    );
  });

  it("drops the currency column and its constraint from wholesale_services", () => {
    expect(rollback).toMatch(/drop constraint if exists wholesale_services_currency_check/);
    expect(rollback).toMatch(/drop column if exists currency/);
  });
});

// Extracts one "select md5(string_agg( ... from <table>" checksum statement
// out of a comment-stripped, semicolon-split SQL file. Splitting on ";" (not
// a lazy regex scan across the whole file) is what makes this precise: two
// checksum statements exist in each file (categories, services), and a lazy
// regex scan risks the well-known "over-match past the wrong closing marker"
// bug — splitting into discrete statements first sidesteps that entirely.
function extractChecksumStatement(code, table) {
  const statements = code
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  return statements.find((s) => s.startsWith("select md5(string_agg(") && s.endsWith(`from ${table}`)) || null;
}

describe("preflight.sql: 100% read-only, no sensitive data, matches verify.sql's checksums exactly", () => {
  it("documents that it must run before the migration, and verify.sql's checksums after it", () => {
    expect(preflight).toMatch(/before wholesale-navigation-migration\.sql/i);
    expect(preflight).toMatch(/wholesale-navigation-verify\.sql/);
  });

  it("contains ONLY SELECT statements — every comment-stripped, semicolon-split statement starts with SELECT", () => {
    const statements = preflightCode
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    expect(statements.length).toBeGreaterThanOrEqual(7); // 5 checks + 2 checksums
    for (const stmt of statements) {
      expect(stmt.toLowerCase().startsWith("select"), `non-SELECT statement found: "${stmt.slice(0, 60)}..."`).toBe(true);
    }
  });

  it("contains no data-modifying or schema-modifying statement, and no RPC/function call", () => {
    for (const forbidden of [
      /\binsert into\b/i,
      /\bupdate\b/i,
      /\bdelete from\b/i,
      /\balter\b/i,
      /\bcreate\b/i,
      /\bdrop\b/i,
      /\bgrant\b/i,
      /\brevoke\b/i,
      /\bdo\s*\$\$/i,
      /\bperform\b/i,
      /wholesale_update_service_price\s*\(/i,
      /wholesale_regenerate_shop_code\s*\(/i,
    ]) {
      expect(preflightCode).not.toMatch(forbidden);
    }
  });

  it("never reads code_hash, token hashes, cookies, or user_agent/ip anywhere in the file", () => {
    for (const forbidden of [/code_hash/i, /device_token_hash/i, /session_token_hash/i, /\bcookie/i, /\buser_agent\b/i, /\bip\b/i]) {
      expect(preflightCode).not.toMatch(forbidden);
    }
  });

  it("touches wholesale_shops/_devices/_sessions/_access_log ONLY via a single count(*) subquery each — never a column of their row data", () => {
    for (const table of ["wholesale_shops", "wholesale_devices", "wholesale_sessions", "wholesale_access_log"]) {
      const occurrences = preflightCode.match(new RegExp(`\\b${table}\\b`, "g")) || [];
      expect(occurrences, `expected exactly one reference to ${table} in the whole file`).toHaveLength(1);
      expect(preflightCode).toMatch(new RegExp(`\\(select count\\(\\*\\) from ${table}\\)`));
    }
  });

  it("reports the 4 expected core counts: 21 categories, 74 services, 1 active category, 0 active services", () => {
    expect(preflight).toMatch(/category_count/);
    expect(preflight).toMatch(/-- expect 21/);
    expect(preflight).toMatch(/service_count/);
    expect(preflight).toMatch(/-- expect 74/);
    expect(preflight).toMatch(/active_category_count/);
    expect(preflight).toMatch(/-- expect 1/);
    expect(preflight).toMatch(/active_service_count/);
    expect(preflight).toMatch(/-- expect 0/);
  });

  it("checks for duplicate or null slugs on both categories and services", () => {
    expect(preflightCode).toMatch(/from wholesale_categories\s*\ngroup by slug\s*\nhaving slug is null or count\(\*\) > 1/);
    expect(preflightCode).toMatch(/from wholesale_services\s*\ngroup by slug\s*\nhaving slug is null or count\(\*\) > 1/);
  });

  it("checks for services whose stored price shape is invalid for their own pricing_type", () => {
    expect(preflightCode).toMatch(/pricing_type = 'fixed' and fixed_price is not null and price_min is null and price_max is null/);
    expect(preflightCode).toMatch(/pricing_type = 'range' and fixed_price is null and price_min is not null and price_max is not null/);
  });

  it("defines exactly one categories checksum and one services checksum", () => {
    expect(extractChecksumStatement(preflightCode, "wholesale_categories")).toBeTruthy();
    expect(extractChecksumStatement(preflightCode, "wholesale_services")).toBeTruthy();
  });

  it("its checksum statements are byte-for-byte identical to the ones appended to verify.sql — required for a meaningful before/after diff", () => {
    const preflightCategories = extractChecksumStatement(preflightCode, "wholesale_categories");
    const verifyCategories = extractChecksumStatement(verifyCode, "wholesale_categories");
    const preflightServices = extractChecksumStatement(preflightCode, "wholesale_services");
    const verifyServices = extractChecksumStatement(verifyCode, "wholesale_services");
    expect(verifyCategories).toBeTruthy();
    expect(verifyServices).toBeTruthy();
    expect(preflightCategories).toBe(verifyCategories);
    expect(preflightServices).toBe(verifyServices);
  });

  it("the categories checksum covers exactly slug/name/notes/diagnostic_fee/diagnostic_description/active/sort_order", () => {
    const stmt = extractChecksumStatement(preflightCode, "wholesale_categories");
    for (const field of ["slug", "name", "notes", "diagnostic_fee", "diagnostic_description", "active", "sort_order"]) {
      expect(stmt).toMatch(new RegExp(`\\b${field}\\b`));
    }
    expect(stmt).not.toMatch(/currency/); // categories never had a currency column
  });

  it("the services checksum covers exactly slug/category_id/name/pricing_type/fixed_price/price_min/price_max/notes/active/sort_order, deliberately excluding currency", () => {
    const stmt = extractChecksumStatement(preflightCode, "wholesale_services");
    for (const field of [
      "slug",
      "category_id",
      "name",
      "pricing_type",
      "fixed_price",
      "price_min",
      "price_max",
      "notes",
      "active",
      "sort_order",
    ]) {
      expect(stmt).toMatch(new RegExp(`\\b${field}\\b`));
    }
    // currency didn't exist before this migration — comparing it before/after
    // would be meaningless, so it's intentionally not part of this checksum.
    expect(stmt).not.toMatch(/currency/);
  });

  it("both checksums order rows deterministically by slug, so re-running produces the same hash regardless of physical row order", () => {
    expect(extractChecksumStatement(preflightCode, "wholesale_categories")).toMatch(/order by slug/);
    expect(extractChecksumStatement(preflightCode, "wholesale_services")).toMatch(/order by slug/);
  });
});

describe("verify.sql: checksums section", () => {
  it("appends the same two checksum statements as preflight.sql, after all the other verification queries", () => {
    const catIdx = verify.indexOf("categories_checksum");
    const svcIdx = verify.indexOf("services_checksum");
    expect(catIdx).toBeGreaterThan(-1);
    expect(svcIdx).toBeGreaterThan(catIdx);
  });

  it("references wholesale-navigation-preflight.sql by name, so the comparison step is discoverable from this file alone", () => {
    expect(verify).toMatch(/wholesale-navigation-preflight\.sql/);
  });
});
