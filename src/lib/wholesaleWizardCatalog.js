/**
 * Presentation-only adapter: transforms the real catalog shape returned by
 * /api/wholesale-prices (equipment types -> categories -> services) into the
 * flat "Equipo" list the pricing wizard shows first.
 *
 * Why this exists instead of a schema change: PS5, Xbox Series X, and
 * Nintendo Switch are, in the real database, plain CATEGORIES nested under
 * one broader equipment type ("Video Consoles") — not separate equipment
 * types. The approved decision (Opción C) is to keep that schema exactly as
 * it is — no new equipment types, no reassigned categories, no migration —
 * and instead let this one pure function project the 3 promoted categories
 * up to top-level "Equipo" cards for the wizard's sake only. Every id this
 * function outputs is the REAL underlying equipment_type_id/category_id;
 * nothing is renamed, duplicated, or given a synthetic id. DESK's admin
 * data, wholesale_categories.equipment_type_id, and every other consumer of
 * the raw catalog response are completely unaware this projection exists.
 *
 * Deliberately data-driven, not one hardcoded block per device: adding or
 * removing a promoted category is a one-line change to PROMOTED_CATEGORY_SLUGS
 * below, never a new component or a new branch of UI code.
 */

/** Category slugs presented as their own top-level Equipo card. See file
 *  header for why these three specifically (matches the approved spec's
 *  "Equipos visibles inicialmente" list for the non-Apple/non-MacBook
 *  devices) — anything else in the real catalog (Controllers, Laptops,
 *  Gaming Laptops, iPhone, iPad, MacBook, ...) passes through unmodified,
 *  grouped under its own real equipment type exactly as the API returns it. */
export const PROMOTED_CATEGORY_SLUGS = new Set(["ps5", "xbox-series-x", "switch"]);

function toWizardModel(category) {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    notes: category.notes ?? null,
    diagnostic_fee: category.diagnostic_fee ?? null,
    diagnostic_description: category.diagnostic_description ?? null,
    image: category.image ?? null,
    services: category.services,
  };
}

/**
 * Builds the wizard's top-level Equipo list from the real
 * equipmentTypes[] the API returns. `promotedSlugs` defaults to the module
 * constant above but is an explicit parameter so tests (and, if ever
 * needed, a future config source) don't have to mutate module state.
 *
 * Every returned Equipo has the same shape regardless of whether it's a
 * promoted category or a real multi-category equipment type:
 *   { id, name, image, sourceEquipmentTypeId, models: WizardModel[] }
 * `models` is always length >= 1. The wizard shows a "Modelo" selection
 * step only when models.length > 1 — a promoted category always has
 * exactly 1 model (itself), so it auto-advances straight to "Falla" without
 * any special-cased branch in the wizard component itself.
 *
 * An equipment type whose categories are ALL promoted away (e.g. "Video
 * Consoles" once ps5/xbox-series-x/switch are pulled out) is dropped
 * entirely from the returned list — it would otherwise render as an empty
 * card with nothing behind it, which is not useful and was never asked for.
 */
export function buildWholesaleWizardCatalog(equipmentTypes, promotedSlugs = PROMOTED_CATEGORY_SLUGS) {
  if (!Array.isArray(equipmentTypes)) return [];

  const equipoList = [];

  for (const equipmentType of equipmentTypes) {
    const categories = Array.isArray(equipmentType.categories) ? equipmentType.categories : [];
    const promoted = categories.filter((cat) => promotedSlugs.has(cat.slug));
    const remaining = categories.filter((cat) => !promotedSlugs.has(cat.slug));

    for (const category of promoted) {
      equipoList.push({
        id: category.id,
        name: category.name,
        image: category.image ?? equipmentType.image ?? null,
        sourceEquipmentTypeId: equipmentType.id,
        models: [toWizardModel(category)],
      });
    }

    if (remaining.length > 0) {
      equipoList.push({
        id: equipmentType.id,
        name: equipmentType.name,
        image: equipmentType.image ?? null,
        sourceEquipmentTypeId: equipmentType.id,
        models: remaining.map(toWizardModel),
      });
    }
  }

  return equipoList;
}
