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
 * (legacy-bridge) promoted category, a real equipment type, or a tag-lens
 * row like Microsoldering:
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
 *
 * `tagLensEquipmentTypes` (3rd param, e.g. Microsoldering) arrives as its
 * OWN array from the API — see api/_lib/wholesaleDb.js's own comment for
 * why it's not simply concatenated server-side into `equipmentTypes`
 * itself (a real, tested duplicate-card bug for an old cached client tab).
 * This function is what actually unifies them: both arrays are merged and
 * sorted by `sort_order` BEFORE the single loop below runs, so a tag-lens
 * row flows through the exact same promoted/remaining logic as any other
 * equipment type — genuinely one pipeline, the split is a wire-level
 * concern only.
 *
 * `legacyMicrosoldering`, 4th param, TEMPORARY (see its own comment at the
 * usage site below): a fallback for when `tagLensEquipmentTypes` itself is
 * absent (an old, pre-this-round server) — this function only ever
 * CONSULTS it as a fallback, never as a primary source.
 */
export function buildWholesaleWizardCatalog(
  equipmentTypes,
  promotedSlugs = PROMOTED_CATEGORY_SLUGS,
  tagLensEquipmentTypes = [],
  legacyMicrosoldering = null
) {
  if (!Array.isArray(equipmentTypes)) return [];

  const combinedEquipmentTypes = [...equipmentTypes, ...(Array.isArray(tagLensEquipmentTypes) ? tagLensEquipmentTypes : [])]
    // Sorted once, here, by the same sort_order DESK's reorder buttons
    // write to every row — missing values (e.g. fixtures that predate this
    // field) fall back to Infinity, a stable no-op that preserves whatever
    // order the arrays already came in, never throwing or producing NaN.
    .sort((a, b) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity));

  // Real top-level equipment-type slugs already present in this response —
  // the dedup signal the bridge uses to never double-produce a card for a
  // slug that already has its own real row (see file header). Built from
  // the COMBINED array so a tag-lens card's own flattened categories (which
  // can legitimately share a slug with a real top-level type, e.g. a
  // Microsoldering-tagged PS5 service) are deduped against it too.
  const realTopLevelSlugs = new Set(combinedEquipmentTypes.map((et) => et.slug).filter(Boolean));

  const equipoList = [];

  for (const equipmentType of combinedEquipmentTypes) {
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

  // LEGACY-SERVER COMPATIBILITY BRIDGE — TEMPORARY, same spirit and same
  // removal obligation as PROMOTED_CATEGORY_SLUGS above (see file header):
  // exists ONLY for a server that predates `tagLensEquipmentTypes` itself
  // (an old server rolled back, or genuinely not yet upgraded) — signaled
  // by that field being absent/empty. On any real, current server this
  // branch never fires: `tagLensEquipmentTypes` is always present (even as
  // `[]` when nothing is currently tagged), so `legacyMicrosoldering` is
  // ignored — this function does NOT depend on the legacy field for its
  // normal behavior, only falls back to it. DELETE this block (and the
  // `legacyMicrosoldering` parameter) once the compatibility window has
  // passed — see the audit report accompanying this round.
  const hasTagLensChannel = Array.isArray(tagLensEquipmentTypes) && tagLensEquipmentTypes.length > 0;
  if (!hasTagLensChannel && legacyMicrosoldering && Array.isArray(legacyMicrosoldering.equipmentTypes)) {
    const models = legacyMicrosoldering.equipmentTypes.flatMap((et) =>
      Array.isArray(et.categories) ? et.categories.map(toWizardModel) : []
    );
    if (models.length > 0) {
      // Always inserted first — matches the OLD client's own hardcoded
      // position for this card (see git history), and the approved final
      // order's own permanent placement (Microsoldering is always card 1).
      // The legacy object never carries a sort_order this function could
      // use instead, since it predates that field entirely.
      equipoList.unshift({
        id: legacyMicrosoldering.id,
        slug: legacyMicrosoldering.slug || "microsoldering",
        name: legacyMicrosoldering.name,
        ...cardPresentation(legacyMicrosoldering),
        image: legacyMicrosoldering.image ?? null,
        sourceEquipmentTypeId: legacyMicrosoldering.id,
        isTagLens: true,
        models,
      });
    }
  }

  return equipoList;
}
