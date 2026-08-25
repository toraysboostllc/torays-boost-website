import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Cpu } from "lucide-react";
import { useWholesaleLocale } from "../../i18n/WholesaleLocaleContext.jsx";
import { buildWholesaleWizardCatalog } from "../../lib/wholesaleWizardCatalog.js";
import { translateServiceName } from "../../lib/wholesaleCatalogI18n.js";
import { wholesaleHoverProps } from "../../lib/wholesaleSound.js";
import {
  pushScreen,
  popScreen,
  resetStack,
  currentScreen,
  stackForSearchSelection,
  stackForEasySearchSelection,
  TOP_SCREEN,
} from "../../lib/wizardScreenStack.js";
import { EquipmentTypeCard } from "./EquipmentTypeCard.jsx";
import { ServicePhoto } from "./ServicePhoto.jsx";
import { WholesaleProgressPanel } from "./WholesaleProgressPanel.jsx";
import { WholesaleResultPanel } from "./WholesaleResultPanel.jsx";
import { WholesaleSearch } from "./WholesaleSearch.jsx";
import { EasySearchPanel } from "./EasySearchPanel.jsx";

/**
 * Equipo -> Modelo -> Falla progress indicator, shown above every selection
 * screen (never on the progress/result screens, which already communicate
 * their own state).
 *
 * Each step's "done" state is derived from the CURRENT screen the caller
 * passes in (see equipoDone/modeloDone/fallaDone at the WizardSteps call
 * site below) — never from whether a selection object merely still exists
 * in state. This matters for a real, reported bug: selectedEquipo/
 * selectedModel/selectedService are only ever CLEARED by resetToTop(), not
 * by goBack() (goBack only pops the screen stack — see
 * lib/wizardScreenStack.js), so a shop that picks Equipo -> Modelo -> Falla
 * and then presses Back twice, landing back on the Equipo grid, would keep
 * seeing steps 1 and 2 marked "done" and step 3 "active" — the stepper
 * claiming a position the shop isn't actually looking at — if done-ness
 * were derived from the stale selection objects instead of from `screen`.
 * Screen-based done-ness self-corrects the instant Back changes `screen`,
 * with zero extra state to keep in sync.
 *
 * Markup: each `<li>` (`.wsp-wizard-step`) is a flex column with its own
 * `.wsp-wizard-step-row` wrapping ONLY the circle, centered inside it — the
 * connecting line to the NEXT step is drawn by that row's own `::after`
 * (see wholesalePortal.css), spanning from this row's horizontal center to
 * the next column's center (equal-width flex:1 columns make that exact
 * math trivial: left:50%, width:100%). The circle sits at a higher
 * z-index than the line and keeps its own opaque fill, so the line visibly
 * starts and ends AT the circles rather than crossing through them or
 * stopping short — never a separate flex-sibling "line" element competing
 * for row width with the circle, which is what previously pushed the
 * circle off-center from the label below it.
 */
function WizardSteps({ equipoDone, modeloDone, fallaDone, t }) {
  const steps = [
    { key: "equipo", label: t("wizard.stepEquipment"), done: equipoDone },
    { key: "modelo", label: t("wizard.stepModel"), done: modeloDone },
    { key: "falla", label: t("wizard.stepIssue"), done: fallaDone },
  ];
  const activeIndex = steps.findIndex((step) => !step.done);
  return (
    <ol className="wsp-wizard-steps">
      {steps.map((step, i) => (
        <li
          key={step.key}
          className={`wsp-wizard-step${step.done ? " wsp-wizard-step-done" : ""}${i === activeIndex ? " wsp-wizard-step-active" : ""}`}
        >
          <span className="wsp-wizard-step-row">
            <span className="wsp-wizard-step-circle" aria-hidden="true">
              {step.done ? <Check size={14} /> : i + 1}
            </span>
          </span>
          <span className="wsp-wizard-step-label">{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * The single data-driven wizard: Equipo -> Modelo (skipped when an Equipo
 * has only 1 model) -> Falla -> ~3s reveal -> Precio listo. One component
 * for every equipment type, including the 3 promoted PS5/Xbox/Switch
 * categories (see buildWholesaleWizardCatalog's header) and Microsoldering
 * — same Equipo/Modelo/Falla shape, same list, same click handler, no
 * separate screen or hardcoded block. Microsoldering is a plain member of
 * `equipmentTypes` (its `catalog_mode`-derived `isDirectServices` flag only
 * changes a purely presentational banner on the Modelo/Falla screens below
 * — never whether or where the card appears, never gated by its slug).
 *
 * `equipmentTypes`, `microsolderingEquipmentType`, and `legacyMicrosoldering`
 * are exactly what /api/wholesale-prices already returned when the portal
 * loaded (see WholesalePrices.jsx) — this component never fetches anything
 * itself. `microsolderingEquipmentType` is the PRIMARY channel Microsoldering
 * arrives through (kept as its own field at the wire level for a real,
 * reproduced old-client-tab reason — see api/_lib/wholesaleDb.js and
 * buildWholesaleWizardCatalog's own header). `legacyMicrosoldering` is a
 * TEMPORARY compatibility fallback only, consulted solely when
 * `microsolderingEquipmentType` itself is absent (an old server) — see
 * buildWholesaleWizardCatalog's own header for what it's for and when to
 * delete it. Screen history is a simple stack (push forward, pop on Back)
 * instead of hardcoding a back-target per screen.
 */
export function WholesaleWizard({ equipmentTypes, microsolderingEquipmentType, legacyMicrosoldering, warranty, onScreenChange }) {
  const { t, language } = useWholesaleLocale();

  const topEquipoList = useMemo(
    () => buildWholesaleWizardCatalog(equipmentTypes, undefined, microsolderingEquipmentType, legacyMicrosoldering),
    [equipmentTypes, microsolderingEquipmentType, legacyMicrosoldering]
  );

  const [screenStack, setScreenStack] = useState(resetStack());
  const screen = currentScreen(screenStack);

  // Lets the parent page know which screen is showing — used only to
  // conditionally hide the (unrelated) Torays Boost Sales module below the
  // wizard on the narrowest phones while the result screen is active (see
  // WholesalePrices.jsx). Purely presentational; the wizard itself doesn't
  // need or use this value.
  useEffect(() => {
    onScreenChange?.(screen);
  }, [screen, onScreenChange]);
  const [selectedEquipo, setSelectedEquipo] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [selectedService, setSelectedService] = useState(null);

  function goTo(next) {
    setScreenStack((stack) => pushScreen(stack, next));
  }
  function goBack() {
    setScreenStack((stack) => popScreen(stack));
  }
  function resetToTop() {
    setScreenStack(resetStack());
    setSelectedEquipo(null);
    setSelectedModel(null);
    setSelectedService(null);
  }

  function handleSelectEquipo(equipo) {
    setSelectedEquipo(equipo);
    if (equipo.models.length === 1) {
      setSelectedModel(equipo.models[0]);
      goTo("fault");
    } else {
      goTo("model");
    }
  }

  function handleSelectModel(model) {
    setSelectedModel(model);
    goTo("fault");
  }

  function handleSelectFault(service) {
    setSelectedService(service);
    goTo("progress");
  }

  /** Live Search result selection — hydrates ALL THREE selections at once
   *  (Equipment Type, model when one applies, service) using the exact
   *  same real catalog objects handleSelectEquipo/handleSelectModel/
   *  handleSelectFault above would have set one click at a time, and lands
   *  on the SAME "progress" screen (the same ~3s reveal) those manual
   *  clicks would have reached — never a shortcut into "result" directly,
   *  so nothing about the progress reveal, the pricing engine, or
   *  WholesaleResultPanel's own diagnostic/terms/animated-price logic is
   *  ever bypassed or duplicated. The screen stack is rebuilt to match
   *  what that click-through would have produced (including the "model"
   *  entry for a multi-model Equipo, so Back still lands somewhere
   *  sensible), NOT just jumped to directly — this is what makes a
   *  direct_services card like Microsoldering (always exactly 1 internal
   *  model) naturally skip the "model" screen here too, with zero special
   *  case: equipo.models.length is the only thing this branches on, same
   *  as handleSelectEquipo already does. */
  function handleSelectSearchResult({ equipo, model, service }) {
    setSelectedEquipo(equipo);
    setSelectedModel(model);
    setSelectedService(service);
    setScreenStack(stackForSearchSelection(equipo));
  }

  /** Easy Search result -> catalog navigation. Only ever called when the
   *  shop clicked "View Services & Wholesale Prices" on a result that had
   *  hasWholesaleCatalog === true (see EasySearchPanel.jsx) — catalogCategoryId
   *  is wholesale_categories.id (== the Easy Search device's catalog_model_id),
   *  which is exactly what toWizardModel() sets as a model's own `id` (see
   *  wholesaleWizardCatalog.js). Scans EVERY equipo's `.models` for that id
   *  rather than looking the equipo up by equipmentTypeId first — a
   *  "promoted" category (e.g. a bridge card like PS5) appears in
   *  topEquipoList with `equipo.id === category.id`, NOT
   *  `category.equipment_type_id`, so matching by equipmentTypeId first
   *  would miss that case. Never sets selectedService (Easy Search never
   *  resolves a specific Failure/Service, only Equipo+Model — see
   *  api/wholesale-easy-search.js's own header), landing on "fault" via
   *  stackForEasySearchSelection() so the shop picks the actual issue from
   *  there, same as a manual Equipo->Modelo click-through would. */
  function handleSelectEasySearchResult({ catalogCategoryId }) {
    let foundEquipo = null;
    let foundModel = null;
    for (const equipo of topEquipoList) {
      const model = (equipo.models || []).find((m) => m.id === catalogCategoryId);
      if (model) {
        foundEquipo = equipo;
        foundModel = model;
        break;
      }
    }
    if (!foundEquipo || !foundModel) return;
    setSelectedEquipo(foundEquipo);
    setSelectedModel(foundModel);
    setSelectedService(null);
    setScreenStack(stackForEasySearchSelection());
  }

  const showSteps = screen === TOP_SCREEN || screen === "model" || screen === "fault";

  return (
    <div className="wsp-wizard-outer">
      {/* Global Live Search — deliberately rendered OUTSIDE .wsp-wizard
          (which has its own overflow:hidden, needed to clip its rounded-
          corner glass background — see that class's own CSS) instead of
          inside it: an absolutely-positioned dropdown living inside an
          overflow:hidden ancestor would get clipped at that ancestor's own
          edge, breaking the "sin recortes" requirement. This wrapper adds
          no overflow constraint of its own, so the dropdown (positioned
          relative to the search bar itself) can extend down over the
          Equipo/Modelo grid or Falla list below it without being cut off,
          on any screen. */}
      <WholesaleSearch equipoList={topEquipoList} onSelectResult={handleSelectSearchResult} />
      {/* Easy Search — a separate, closed-by-default entry point (see
          EasySearchPanel.jsx's own header for why this is NOT the same
          feature as WholesaleSearch above). `position: fixed` internally,
          so mounting it here (rather than in WholesalePrices.jsx's header
          row) costs nothing visually while giving direct access to
          topEquipoList for handleSelectEasySearchResult — no prop-drilling
          through an extra layer. */}
      <EasySearchPanel onSelectCatalogModel={handleSelectEasySearchResult} />
      <div className="wsp-wizard">
      {showSteps && (
        <WizardSteps
          // Screen-derived, not selection-derived — see WizardSteps' own
          // header comment for the real Back-navigation bug this fixes.
          equipoDone={screen !== TOP_SCREEN}
          modeloDone={screen === "fault"}
          fallaDone={screen === "progress" || screen === "result"}
          t={t}
        />
      )}

      {screen === TOP_SCREEN && (
        <>
          <h1 className="wsp-wizard-heading">{t("wizard.chooseEquipment")}</h1>
          <p className="wsp-wizard-subtitle">{t("wizard.chooseEquipmentSubtitle")}</p>
          <div className="wsp-grid wsp-grid-compact">
            {/* ONE list, ONE map — Microsoldering is just another entry in
                topEquipoList (it's a plain member of equipmentTypes[], see
                api/_lib/wholesaleDb.js and this file's own header). Its
                `isDirectServices` flag only decides the `featured`
                border/shadow here — never whether it appears, never a
                hardcoded id/slug check. A brand-new equipment type DESK
                creates shows up the exact same way, with zero code change
                here — grouped or direct_services alike. */}
            {topEquipoList.map((equipo) => (
              <EquipmentTypeCard
                key={equipo.id}
                entity={equipo}
                onClick={() => handleSelectEquipo(equipo)}
                featured={equipo.isDirectServices}
              />
            ))}
          </div>
        </>
      )}

      {screen === "model" && selectedEquipo && (
        <>
          <button type="button" {...wholesaleHoverProps(goBack)} className="wsp-btn wsp-btn-ghost wsp-wizard-back">
            <ArrowLeft size={16} />
            {t("wizard.back")}
          </button>
          {/* Purely informational — shown for ANY equipo whose real row has
              catalog_mode='direct_services' (today only Microsoldering),
              never gated by a hardcoded slug. Explains why this card skips
              straight to a flat services list. */}
          {selectedEquipo.isDirectServices && (
            <div className="wsp-wizard-microsoldering-banner">
              <Cpu size={18} aria-hidden="true" />
              <div>
                <p className="wsp-wizard-microsoldering-title">{t("microsoldering.title")}</p>
                <p className="wsp-wizard-microsoldering-subtitle">{t("microsoldering.subtitle")}</p>
              </div>
            </div>
          )}
          <h1 className="wsp-wizard-heading">{t("wizard.chooseModel")}</h1>
          <div className="wsp-grid wsp-grid-compact">
            {selectedEquipo.models.map((model) => (
              <EquipmentTypeCard key={model.id} entity={model} onClick={() => handleSelectModel(model)} />
            ))}
          </div>
        </>
      )}

      {screen === "fault" && selectedModel && (
        <>
          <button type="button" {...wholesaleHoverProps(goBack)} className="wsp-btn wsp-btn-ghost wsp-wizard-back">
            <ArrowLeft size={16} />
            {t("wizard.back")}
          </button>
          {selectedEquipo?.isDirectServices && (
            <div className="wsp-wizard-microsoldering-banner">
              <Cpu size={18} aria-hidden="true" />
              <div>
                <p className="wsp-wizard-microsoldering-title">{t("microsoldering.title")}</p>
                <p className="wsp-wizard-microsoldering-subtitle">{t("microsoldering.subtitle")}</p>
              </div>
            </div>
          )}
          <h1 className="wsp-wizard-heading">{t("wizard.chooseFault")}</h1>
          {selectedModel.services.length === 0 ? (
            <div className="wsp-empty">{t("wizard.chooseFault")}</div>
          ) : (
            <ul className="wsp-wizard-fault-list">
              {selectedModel.services.map((service) => (
                <li key={service.id}>
                  <button
                    type="button"
                    className="wsp-wizard-fault-item"
                    {...wholesaleHoverProps(() => handleSelectFault(service))}
                  >
                    <ServicePhoto
                      image={service.image}
                      alt={service.image?.alt_text || translateServiceName(service, language)}
                      size={40}
                      className="wsp-wizard-fault-item-photo"
                    />
                    <span className="wsp-wizard-fault-item-label">{translateServiceName(service, language)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {screen === "progress" && <WholesaleProgressPanel onComplete={() => goTo("result")} />}

      {screen === "result" && selectedService && (
        <WholesaleResultPanel
          selection={{
            microsoldering: Boolean(selectedEquipo?.isDirectServices),
            equipoName: selectedEquipo?.name,
            modelName: selectedModel?.name,
            // Fallback photo chain (see WholesaleResultPanel's own header for
            // the full "why" and priority order) -- both already carry the
            // exact same { url, alt_text } | null shape service.image does
            // (toWizardModel/the equipo-list builder in wholesaleWizardCatalog.js
            // resolve them from the SAME per-owner image map buildWholesaleCatalog
            // already built server-side; nothing new fetched or computed here).
            modelImage: selectedModel?.image ?? null,
            equipoImage: selectedEquipo?.image ?? null,
          }}
          service={selectedService}
          warranty={warranty}
          onConsultAnother={resetToTop}
        />
      )}
      </div>
    </div>
  );
}
