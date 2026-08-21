/**
 * Presentation-only adapter: transforms the real catalog shape returned by
 * /api/wholesale-prices (equipment types -> categories -> services) into the
 * flat "Equipo" list the pricing wizard shows first.
 *
 * HISTORY / WHY THIS FILE STILL HAS A "PROMOTED_CATEGORY_SLUGS" CONCEPT: PS5,
 * Xbox Series X, and Nintendo Switch used to be plain CATEGORIES nested under
 * one equipment type ("Video Consoles"), promoted to top-level cards purely
 * by this client-side function matching a hardcoded slug set. The dynamic-
 * equipment-types migration (see supabase/wholesale-dynamic-equipment-types-
 * migration.sql) converts all 3 into real, independent wholesale_equipment_
 * types rows — the correct, permanent fix, not a parametrized version of the
 * old hack. Once that migration has run, every equipment type the API
 * returns already IS a top-level card; this function's job shrinks to "one
 * card per active equipment type, in the order the API already returns
 * them" and nothing here needs to know any slug at all.
 *
 * The PROMOTED_CATEGORY_SLUGS branch below is NOT the permanent design — it
 * is a deliberately temporary, backward-compatible BRIDGE for the deployment
 * window where this Website code has shipped but the SQL migration hasn't
 * run yet (or vice versa). It is REQUIRED reading before deleting it:
 *
 *   - Old schema (categories still under Video Consoles) + this code: the
 *     bridge below still promotes ps5/xbox-series-x/switch by slug, exactly
 *     like the old hardcoded version — nothing regresses.
 *   - New schema (ps5/xbox-series-x/switch are now real equipment types) +
 *     this code: each of those 3 slugs is now ALSO the slug of a real
 *     top-level equipment type in the `equipmentTypes` array the API
 *     returns. The bridge explicitly checks for that and skips promoting
 *     the (now-redundant) nested category in that case — so the SAME card
 *     is never produced twice. This is what makes deployment order between
 *     this file and the SQL migration NOT matter, and is the concrete
 *     answer to "cero ventana con tarjetas duplicadas o faltantes."
 *
 * Once the migration has been live and verified for a while, DELETE
 * PROMOTED_CATEGORY_SLUGS and the entire promoted/remaining split below in a
 * small, separate follow-up change — do not leave it "just in case"
 * forever; it exists only to make the cutover safe, not as a feature.
 */

/** Legacy bridge only — see file header. Category slugs that, if NOT already
 *  present as their own real equipment type in the current API response,
 *  still get promoted to their own top-level Equipo card the old way. */
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

/** Every returned Equipo's fullBleedPhoto/imageFocusX/imageFocusY default to
 *  the "off, centered" values a card with no such data should render as —
 *  used for the legacy bridge's promoted-category cards (categories don't
 *  carry these fields; see wholesaleWizardCatalog.js's scope note) and as a
 *  safe fallback anywhere the source object is missing them for any reason. */
function cardPresentation(source) {
  return {
    nameEs: source?.name_es || null,
    fullBleedPhoto: Boolean(source?.full_bleed_photo),
    imageFocusX: source?.image_focus_x ?? 50,
    imageFocusY: source?.image_focus_y ?? 50,
  };
}

/**
 * Builds the wizard's top-level Equipo list from the real
 * equipmentTypes[] the API returns. `promotedSlugs` defaults to the module
 * constant above but is an explicit parameter so tests (and the eventual
 * follow-up that deletes this bridge) don't have to mutate module state.
 *
 * Every returned Equipo has the same shape regardless of whether it's a
 * (legacy-bridge) promoted category, a real equipment type, or the
 * Microsoldering tag-lens row (see api/_lib/wholesaleDb.js — it's a plain
 * member of the `equipmentTypes` array passed in here, not a separate
 * channel; this function has no special case for it at all):
 *   { id, slug, name, nameEs, fullBleedPhoto, imageFocusX, imageFocusY,
 *     image, sourceEquipmentTypeId, isTagLens, models: WizardModel[] }
 * `models` is always length >= 1. The wizard shows a "Modelo" selection
 * step only when models.length > 1 — a promoted category always has
 * exactly 1 model (itself), so it auto-advances straight to "Falla" without
 * any special-cased branch in the wizard component itself.
 *
 * An equipment type whose categories are ALL promoted away (e.g. "Video
 * Consoles", pre-migration) is dropped entirely from the returned list — it
 * would otherwise render as an empty card with nothing behind it.
 */
export function buildWholesaleWizardCatalog(equipmentTypes, promotedSlugs = PROMOTED_CATEGORY_SLUGS) {
  if (!Array.isArray(equipmentTypes)) return [];

  // Real top-level equipment-type slugs already present in this response —
  // the dedup signal the bridge uses to never double-produce a card for a
  // slug that already has its own real row (see file header).
  const realTopLevelSlugs = new Set(equipmentTypes.map((et) => et.slug).filter(Boolean));

  const equipoList = [];

  for (const equipmentType of equipmentTypes) {
    const categories = Array.isArray(equipmentType.categories) ? equipmentType.categories : [];
    const promoted = categories.filter((cat) => promotedSlugs.has(cat.slug) && !realTopLevelSlugs.has(cat.slug));
    const remaining = categories.filter((cat) => !(promotedSlugs.has(cat.slug) && !realTopLevelSlugs.has(cat.slug)));

    for (const category of promoted) {
      equipoList.push({
        id: category.id,
        slug: category.slug,
        name: category.name,
        ...cardPresentation(null), // categories don't carry these fields — bridge cards are always "off, centered"
        image: category.image ?? equipmentType.image ?? null,
        sourceEquipmentTypeId: equipmentType.id,
        // A promoted category is always a real, ordinary category — never
        // the tag-lens row itself (that never has a promotable category of
        // its own) — so this is always false here, never data-driven.
        isTagLens: false,
        models: [toWizardModel(category)],
      });
    }

    if (remaining.length > 0) {
      equipoList.push({
        id: equipmentType.id,
        slug: equipmentType.slug,
        name: equipmentType.name,
        ...cardPresentation(equipmentType),
        image: equipmentType.image ?? null,
        sourceEquipmentTypeId: equipmentType.id,
        // Data-driven, never a hardcoded slug check — true only for the one
        // real wholesale_equipment_types row with is_tag_lens=true (see
        // api/_lib/wholesaleDb.js). Purely presentational downstream (an
        // optional distinguishing banner/border) — never gates whether or
        // where this card appears; it's already an ordinary member of this
        // same equipoList by this point.
        isTagLens: Boolean(equipmentType.is_tag_lens),
        models: remaining.map(toWizardModel),
      });
    }
  }

  return equipoList;
}
