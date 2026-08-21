import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Cpu } from "lucide-react";
import { useWholesaleLocale } from "../../i18n/WholesaleLocaleContext.jsx";
import { buildWholesaleWizardCatalog } from "../../lib/wholesaleWizardCatalog.js";
import { translateCatalogLabel } from "../../lib/wholesaleCatalogI18n.js";
import { wholesaleHoverProps } from "../../lib/wholesaleSound.js";
import { EquipmentTypeCard } from "./EquipmentTypeCard.jsx";
import { WholesaleProgressPanel } from "./WholesaleProgressPanel.jsx";
import { WholesaleResultPanel } from "./WholesaleResultPanel.jsx";

/**
 * Equipo -> Modelo -> Falla progress indicator, shown above every selection
 * screen (never on the progress/result screens, which already communicate
 * their own state). A step is "done" once its real selection exists in
 * state — never a static decoration — so it stays honest even though a
 * 1-model Equipo skips straight past the Modelo screen (see
 * handleSelectEquipo below): that still marks Modelo done, because a model
 * WAS resolved, just not through an extra screen. The CURRENT step (the
 * first one not yet done) additionally gets `wsp-wizard-step-active` so it
 * reads clearly as "you are here", distinct from both done and upcoming.
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
            {i < steps.length - 1 && <span className="wsp-wizard-step-line" aria-hidden="true" />}
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
 * `equipmentTypes` (its `is_tag_lens`-derived `isTagLens` flag only changes
 * a purely presentational banner on the Modelo/Falla screens below — never
 * whether or where the card appears, never gated by its slug).
 *
 * `equipmentTypes` and `legacyMicrosoldering` are exactly what
 * /api/wholesale-prices already returned when the portal loaded (see
 * WholesalePrices.jsx) — this component never fetches anything itself.
 * `tagLensEquipmentTypes` (e.g. Microsoldering) is the PRIMARY channel for
 * tag-lens cards, kept as its own array at the wire level — see
 * api/_lib/wholesaleDb.js and buildWholesaleWizardCatalog's own header for
 * why. `legacyMicrosoldering` is a TEMPORARY compatibility fallback only,
 * consulted solely when `tagLensEquipmentTypes` itself is absent — see
 * buildWholesaleWizardCatalog's own header for what it's for and when to
 * delete it. Screen history is a simple stack (push forward, pop on Back)
 * instead of hardcoding a back-target per screen.
 */
export function WholesaleWizard({ equipmentTypes, tagLensEquipmentTypes, legacyMicrosoldering, onScreenChange }) {
  const { t, language } = useWholesaleLocale();

  const topEquipoList = useMemo(
    () => buildWholesaleWizardCatalog(equipmentTypes, undefined, tagLensEquipmentTypes, legacyMicrosoldering),
    [equipmentTypes, tagLensEquipmentTypes, legacyMicrosoldering]
  );

  const [screenStack, setScreenStack] = useState(["top"]);
  const screen = screenStack[screenStack.length - 1];

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
    setScreenStack((stack) => [...stack, next]);
  }
  function goBack() {
    setScreenStack((stack) => (stack.length > 1 ? stack.slice(0, -1) : stack));
  }
  function resetToTop() {
    setScreenStack(["top"]);
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

  const showSteps = screen === "top" || screen === "model" || screen === "fault";

  return (
    <div className="wsp-wizard">
      {showSteps && (
        <WizardSteps
          equipoDone={Boolean(selectedEquipo)}
          modeloDone={Boolean(selectedModel)}
          fallaDone={Boolean(selectedService)}
          t={t}
        />
      )}

      {screen === "top" && (
        <>
          <h1 className="wsp-wizard-heading">{t("wizard.chooseEquipment")}</h1>
          <p className="wsp-wizard-subtitle">{t("wizard.chooseEquipmentSubtitle")}</p>
          <div className="wsp-grid wsp-grid-compact">
            {/* ONE list, ONE map — Microsoldering is just another entry in
                topEquipoList (it's a plain member of equipmentTypes[], see
                api/_lib/wholesaleDb.js and this file's own header). Its
                `isTagLens` flag only decides the `featured` border/shadow
                here — never whether it appears, never a hardcoded id/slug
                check. A brand-new equipment type DESK creates shows up the
                exact same way, with zero code change here. */}
            {topEquipoList.map((equipo) => (
              <EquipmentTypeCard
                key={equipo.id}
                entity={equipo}
                onClick={() => handleSelectEquipo(equipo)}
                featured={equipo.isTagLens}
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
              is_tag_lens=true (today only Microsoldering), never gated by a
              hardcoded slug. Explains why models from many device families
              show up together here. */}
          {selectedEquipo.isTagLens && (
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
          {selectedEquipo?.isTagLens && (
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
                    {translateCatalogLabel(service.name, language)}
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
            microsoldering: Boolean(selectedEquipo?.isTagLens),
            equipoName: selectedEquipo?.name,
            modelName: selectedModel?.name,
          }}
          service={selectedService}
          onConsultAnother={resetToTop}
        />
      )}
    </div>
  );
}
