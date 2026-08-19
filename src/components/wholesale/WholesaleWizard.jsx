import { useMemo, useState } from "react";
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
 * categories (see buildWholesaleWizardCatalog's header) and the
 * Microsoldadura branch (same Equipo/Modelo/Falla shape, scoped to tagged
 * services) — never a separate page or hardcoded block per device.
 *
 * `equipmentTypes` and `microsoldering` are exactly what /api/wholesale-prices
 * already returned when the portal loaded (see WholesalePrices.jsx) — this
 * component never fetches anything itself. Screen history is a simple stack
 * (push forward, pop on Back) instead of hardcoding a back-target per screen.
 */
export function WholesaleWizard({ equipmentTypes, microsoldering }) {
  const { t, language } = useWholesaleLocale();

  const topEquipoList = useMemo(() => buildWholesaleWizardCatalog(equipmentTypes), [equipmentTypes]);
  const microsolderingEquipoList = useMemo(
    () => buildWholesaleWizardCatalog(microsoldering?.equipmentTypes || []),
    [microsoldering]
  );

  const [screenStack, setScreenStack] = useState(["top"]);
  const screen = screenStack[screenStack.length - 1];
  const [isMicrosoldering, setIsMicrosoldering] = useState(false);
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
    setIsMicrosoldering(false);
    setSelectedEquipo(null);
    setSelectedModel(null);
    setSelectedService(null);
  }

  function handleSelectMicrosoldering() {
    setIsMicrosoldering(true);
    goTo("microsolderingGrid");
  }

  function handleSelectEquipo(equipo, { microsoldering: fromMicrosoldering } = {}) {
    setSelectedEquipo(equipo);
    setIsMicrosoldering(Boolean(fromMicrosoldering));
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

  const showSteps = screen === "top" || screen === "microsolderingGrid" || screen === "model" || screen === "fault";

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
            {/* Only rendered when the server actually returned a
                microsoldering object — same server-trust rule as the rest
                of the portal: never assume the Equipment Type exists just
                because this component was mounted (it's Hidden/inactive on
                the server otherwise, exactly like any other equipment
                type). `featured` gives it a subtle distinguishing border/
                shadow, never a larger size than the other cards. */}
            {microsoldering && (
              <EquipmentTypeCard
                entity={{ slug: "microsoldering", name: t("microsoldering.title"), image: microsoldering.image }}
                onClick={handleSelectMicrosoldering}
                featured
              />
            )}
            {topEquipoList.map((equipo) => (
              <EquipmentTypeCard key={equipo.id} entity={equipo} onClick={() => handleSelectEquipo(equipo)} />
            ))}
          </div>
        </>
      )}

      {screen === "microsolderingGrid" && (
        <>
          <button type="button" {...wholesaleHoverProps(goBack)} className="wsp-btn wsp-btn-ghost wsp-wizard-back">
            <ArrowLeft size={16} />
            {t("wizard.back")}
          </button>
          <div className="wsp-wizard-microsoldering-banner">
            <Cpu size={18} aria-hidden="true" />
            <div>
              <p className="wsp-wizard-microsoldering-title">{t("microsoldering.title")}</p>
              <p className="wsp-wizard-microsoldering-subtitle">{t("microsoldering.subtitle")}</p>
            </div>
          </div>
          <h1 className="wsp-wizard-heading">{t("wizard.chooseEquipment")}</h1>
          {microsolderingEquipoList.length === 0 ? (
            <div className="wsp-empty">{t("wizard.chooseFault")}</div>
          ) : (
            <div className="wsp-grid wsp-grid-compact">
              {microsolderingEquipoList.map((equipo) => (
                <EquipmentTypeCard
                  key={equipo.id}
                  entity={equipo}
                  onClick={() => handleSelectEquipo(equipo, { microsoldering: true })}
                />
              ))}
            </div>
          )}
        </>
      )}

      {screen === "model" && selectedEquipo && (
        <>
          <button type="button" {...wholesaleHoverProps(goBack)} className="wsp-btn wsp-btn-ghost wsp-wizard-back">
            <ArrowLeft size={16} />
            {t("wizard.back")}
          </button>
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
            microsoldering: isMicrosoldering,
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
