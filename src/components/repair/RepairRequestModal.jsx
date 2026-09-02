import { useEffect, useRef, useState } from "react";
import {
  X, ChevronLeft, ArrowRight, MessageCircle, Check, Lock,
  Smartphone, Tablet, Gamepad2, Laptop, Database, ShieldCheck,
} from "lucide-react";
import { useRepairRequest } from "../../hooks/useRepairRequest.js";
import { useScrollLock } from "../../hooks/useScrollLock.js";
import { useInertSiblings } from "../../hooks/useInertSiblings.js";
import { ANSWER_OPTIONS } from "../../config/repairRequest.config.js";
import { buildRepairRequestWhatsAppLink, buildRepairRequestMailtoLink } from "../../lib/repairRequestMessage.js";
import { formatPhone, isValidUsPhone } from "../../lib/phone.js";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import { QuoteReadyModal } from "./QuoteReadyModal.jsx";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-quote-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const INPUT_CLASS =
  "min-h-12 w-full rounded-xl border border-quote-line bg-white px-4 py-3 text-torays-text placeholder:text-torays-text-muted focus:border-quote-accent-soft focus:outline-none focus:ring-2 focus:ring-quote-accent/30";

const LABEL_CLASS = "text-xs font-heading font-semibold uppercase tracking-wide text-torays-text-secondary";

/** One simple technical glyph per device type — no emoji, no decoration. */
const TYPE_ICON = {
  phone: Smartphone,
  tablet: Tablet,
  console: Gamepad2,
  controller: Gamepad2,
  laptop: Laptop,
  "data-recovery": Database,
};

// A short delay lets the iOS keyboard finish animating in before the scroll
// runs — scrolling immediately measures the pre-keyboard layout.
function scrollFieldIntoView(el) {
  window.setTimeout(() => {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, 300);
}

/* ------------------------------------------------------------------ */
/* Shared controls                                                      */
/* ------------------------------------------------------------------ */

function Tile({ selected, onClick, children, icon: Icon, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`relative flex min-h-12 items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors active:translate-y-px ${FOCUS_RING} ${
        selected
          ? "border-quote-accent-soft bg-quote-wash text-quote-ink shadow-[0_0_0_1px_#12A594]"
          : "border-quote-line bg-white text-torays-text hover:border-quote-accent-soft hover:bg-quote-surface"
      } ${className}`}
    >
      {Icon && <Icon size={20} className={selected ? "text-quote-accent" : "text-torays-text-secondary"} />}
      <span className="flex-1">{children}</span>
      {selected && (
        <Check size={16} className="shrink-0 text-quote-accent" aria-hidden="true" />
      )}
    </button>
  );
}

function Chip({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-11 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors active:translate-y-px ${FOCUS_RING} ${
        selected
          ? "border-quote-accent bg-quote-accent text-white"
          : "border-quote-line bg-white text-torays-text hover:border-quote-accent-soft hover:bg-quote-surface"
      }`}
    >
      {children}
    </button>
  );
}

function ContinueButton({ disabled, onClick, label }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-12 items-center justify-center gap-2 self-end rounded-xl px-6 py-3 text-sm font-heading font-semibold transition-colors active:translate-y-px ${FOCUS_RING} ${
        disabled
          ? "cursor-not-allowed bg-quote-line text-torays-text-muted"
          : "bg-quote-accent text-white hover:bg-quote-accent-hover"
      }`}
    >
      {label}
      <ArrowRight size={16} />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1 — device type                                                 */
/* ------------------------------------------------------------------ */

function DeviceStep({ estimator, onAdvance, t }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {estimator.deviceTypes.map((type) => (
        <Tile
          key={type.id}
          icon={TYPE_ICON[type.id]}
          selected={estimator.answers.deviceTypeId === type.id}
          onClick={() => onAdvance(() => estimator.selectDeviceType(type.id))}
        >
          {t(`wizard.deviceTypes.${type.id}`)}
        </Tile>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2 — brand + model, on one screen                                */
/* ------------------------------------------------------------------ */

function ModelStep({ estimator, onContinue, t }) {
  const { answers, brands, categoryChoices, needsCategoryChoice, modelChips, group } = estimator;
  const chips = modelChips || [];
  const modelIsChip = chips.includes(answers.model);
  // "Other model" stays open once chosen, even before anything is typed.
  const [customOpen, setCustomOpen] = useState(false);
  const showCustomModel = !chips.length || customOpen || (!answers.modelNotSure && answers.model && !modelIsChip);

  const placeholder =
    group === "laptop" ? t("wizard.fields.modelPlaceholderLaptop")
      : group === "phone" && answers.categoryId === "smartphones-other" ? t("wizard.fields.modelPlaceholderPhone")
        : t("wizard.fields.modelPlaceholder");

  function onFieldKeyDown(e) {
    if (e.key === "Enter" && estimator.canGoNext) {
      e.preventDefault();
      onContinue();
    }
  }

  function pickChip(value) {
    setCustomOpen(false);
    estimator.setModel(value);
  }

  return (
    <div className="flex flex-col gap-5">
      {needsCategoryChoice && (
        <fieldset className="flex flex-col gap-2.5">
          <legend className={LABEL_CLASS}>{t("wizard.fields.brand")}</legend>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {categoryChoices.map((choice) => (
              <Tile
                key={choice.id}
                selected={answers.categoryId === choice.id}
                onClick={() => estimator.selectCategory(choice.id)}
              >
                {t(`wizard.categories.${choice.id}`)}
              </Tile>
            ))}
          </div>
        </fieldset>
      )}

      {answers.categoryId && brands && (
        <fieldset className="flex flex-col gap-2.5">
          <legend className={LABEL_CLASS}>{t("wizard.fields.brand")}</legend>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {brands.map((b) => (
              <Tile key={b.id} selected={answers.brandId === b.id} onClick={() => estimator.selectBrand(b.id)}>
                {t(`wizard.brands.${b.id}`)}
              </Tile>
            ))}
          </div>
        </fieldset>
      )}

      {answers.categoryId && brands && answers.brandId === "other" && (
        <label className="flex flex-col gap-2">
          <span className={LABEL_CLASS}>{t("wizard.fields.customBrand")}</span>
          <input
            type="text"
            required
            maxLength={100}
            value={answers.customBrandName}
            onChange={(e) => estimator.setCustomBrandName(e.target.value)}
            onKeyDown={onFieldKeyDown}
            onFocus={(e) => scrollFieldIntoView(e.target)}
            placeholder={t("wizard.fields.customBrandPlaceholder")}
            className={INPUT_CLASS}
          />
        </label>
      )}

      {answers.categoryId && (!brands || answers.brandId) && (
        <fieldset className="flex flex-col gap-2.5">
          <legend className={LABEL_CLASS}>
            {chips.length ? t("wizard.fields.popularModels") : t("wizard.fields.exactModel")}
          </legend>

          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <Chip key={chip} selected={answers.model === chip && !answers.modelNotSure} onClick={() => pickChip(chip)}>
                  {chip}
                </Chip>
              ))}
              <Chip
                selected={showCustomModel && !answers.modelNotSure}
                onClick={() => {
                  setCustomOpen(true);
                  if (modelIsChip) estimator.setModel("");
                  else estimator.setModelNotSure(false);
                }}
              >
                {t("wizard.fields.otherModel")}
              </Chip>
              <Chip selected={answers.modelNotSure} onClick={() => { setCustomOpen(false); estimator.setModelNotSure(true); }}>
                {t("wizard.fields.notSureModel")}
              </Chip>
            </div>
          )}

          {showCustomModel && (
            <input
              type="text"
              maxLength={100}
              value={answers.model}
              disabled={answers.modelNotSure}
              onChange={(e) => estimator.setModel(e.target.value)}
              onKeyDown={onFieldKeyDown}
              onFocus={(e) => scrollFieldIntoView(e.target)}
              placeholder={placeholder}
              aria-label={t("wizard.fields.exactModel")}
              className={`${INPUT_CLASS} disabled:cursor-not-allowed disabled:opacity-40`}
            />
          )}

          {chips.length === 0 && (
            <label className="flex min-h-11 items-center gap-3 text-sm text-torays-text-secondary">
              <input
                type="checkbox"
                checked={answers.modelNotSure}
                onChange={(e) => estimator.setModelNotSure(e.target.checked)}
                className={`h-5 w-5 rounded border-quote-line text-quote-accent ${FOCUS_RING}`}
              />
              {t("wizard.notSureOther")}
            </label>
          )}
        </fieldset>
      )}

      <ContinueButton disabled={!estimator.canGoNext} onClick={onContinue} label={t("wizard.continueLabel")} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3 — issue + whatever diagnostic questions are still unanswered  */
/* ------------------------------------------------------------------ */

function IssueStep({ estimator, onContinue, t }) {
  const { answers, problems, visibleQuestions, group } = estimator;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {problems.map((p) => (
          <Tile
            key={p.id}
            selected={answers.problemId === p.id}
            onClick={() => estimator.selectProblem(p.id)}
            className="text-[13px]"
          >
            {t(`wizard.problems.${p.id}`)}
          </Tile>
        ))}
      </div>

      {answers.problemId && visibleQuestions.length > 0 && (
        <section className="flex flex-col gap-4 rounded-xl border border-quote-line bg-quote-surface p-4">
          <h3 className="text-xs font-heading font-semibold uppercase tracking-wide text-quote-ink">
            {t("wizard.diagnostics")}
          </h3>
          {visibleQuestions.map((question) => (
            <fieldset key={question.id} className="flex flex-col gap-2.5">
              <legend className="text-sm font-medium text-torays-text">
                {t(`wizard.questions.${group}.${question.id}`)}
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {ANSWER_OPTIONS.map((option) => (
                  <Chip
                    key={option.id}
                    selected={answers.smartAnswers[question.id] === option.id}
                    onClick={() => estimator.answerSmartQuestion(question.id, option.id)}
                  >
                    {t(`wizard.answers.${option.id}`)}
                  </Chip>
                ))}
              </div>
            </fieldset>
          ))}
        </section>
      )}

      <ContinueButton disabled={!estimator.canGoNext} onClick={onContinue} label={t("wizard.continueLabel")} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 4 — contact, consent, and the single CTA                        */
/* ------------------------------------------------------------------ */

function ContactStep({ estimator, onSubmit, showPolicyError, policyRef, phoneTouched, onPhoneBlur, t }) {
  const { answers } = estimator;
  const phoneInvalid = phoneTouched && answers.phone.trim() !== "" && !isValidUsPhone(answers.phone);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className={LABEL_CLASS}>
            {t("wizard.fields.name")} <span className="text-torays-red">*</span>
          </span>
          <input
            type="text"
            required
            maxLength={100}
            autoComplete="name"
            enterKeyHint="next"
            value={answers.name}
            onChange={(e) => estimator.setField("name", e.target.value)}
            onFocus={(e) => scrollFieldIntoView(e.target)}
            placeholder={t("wizard.fields.namePlaceholder")}
            className={INPUT_CLASS}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className={LABEL_CLASS}>
            {t("wizard.fields.phone")} <span className="text-torays-red">*</span>
          </span>
          <input
            type="tel"
            required
            maxLength={16}
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="next"
            aria-invalid={phoneInvalid}
            aria-describedby={phoneInvalid ? "phone-error" : undefined}
            value={answers.phone}
            // Formatting on every keystroke keeps the field readable without
            // ever asking the visitor to type punctuation themselves.
            onChange={(e) => estimator.setField("phone", formatPhone(e.target.value))}
            onBlur={onPhoneBlur}
            onFocus={(e) => scrollFieldIntoView(e.target)}
            placeholder={t("wizard.fields.phonePlaceholder")}
            className={`${INPUT_CLASS} ${phoneInvalid ? "border-torays-red focus:ring-torays-red/30" : ""}`}
          />
          {phoneInvalid && (
            <span id="phone-error" role="alert" className="text-xs text-torays-red">
              {t("wizard.fields.phoneError")}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-2">
          <span className={LABEL_CLASS}>{t("wizard.fields.email")}</span>
          <input
            type="email"
            maxLength={200}
            inputMode="email"
            autoComplete="email"
            enterKeyHint="next"
            value={answers.email}
            onChange={(e) => estimator.setField("email", e.target.value)}
            onFocus={(e) => scrollFieldIntoView(e.target)}
            placeholder={t("wizard.fields.emailPlaceholder")}
            className={INPUT_CLASS}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className={LABEL_CLASS}>{t("wizard.fields.details")}</span>
          <textarea
            rows={3}
            maxLength={1000}
            enterKeyHint="done"
            value={answers.details}
            onChange={(e) => estimator.setField("details", e.target.value)}
            onFocus={(e) => scrollFieldIntoView(e.target)}
            placeholder={t("wizard.fields.detailsPlaceholder")}
            className={`${INPUT_CLASS} resize-none`}
          />
        </label>
      </div>

      <p className="text-xs text-torays-text-muted">{t("wizard.photosNote")}</p>

      <div className="flex flex-col gap-2">
        <label className="flex min-h-11 items-start gap-3 rounded-xl border border-quote-line bg-white px-4 py-3">
          <input
            ref={policyRef}
            type="checkbox"
            checked={answers.policyAccepted}
            aria-describedby={showPolicyError ? "policy-consent-error" : undefined}
            aria-invalid={showPolicyError}
            onChange={(e) => estimator.setField("policyAccepted", e.target.checked)}
            className={`mt-0.5 h-5 w-5 shrink-0 rounded border-quote-line text-quote-accent ${FOCUS_RING}`}
          />
          <span className="text-xs leading-relaxed text-torays-text-secondary">
            {t("wizard.policyConsent.prefix")}
            <a
              href="/terms"
              target="_blank"
              rel="noreferrer"
              className="relative text-quote-accent underline decoration-quote-line before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] hover:text-quote-accent-hover"
            >
              {t("wizard.policyConsent.termsLabel")}
            </a>
            {t("wizard.policyConsent.middle")}
            <a
              href="/privacy"
              target="_blank"
              rel="noreferrer"
              className="relative text-quote-accent underline decoration-quote-line before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] hover:text-quote-accent-hover"
            >
              {t("wizard.policyConsent.privacyLabel")}
            </a>
            {t("wizard.policyConsent.suffix")}
            <span className="text-torays-red"> *</span>
          </span>
        </label>
        {showPolicyError && (
          <p id="policy-consent-error" role="alert" className="px-1 text-xs text-torays-red">
            {t("wizard.policyConsent.error")}
          </p>
        )}
        <p className="px-1 text-xs leading-relaxed text-torays-text-secondary">{t("wizard.whatsappAuthNote")}</p>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={!estimator.canSubmit}
        className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-heading font-semibold transition-colors active:translate-y-px ${FOCUS_RING} ${
          estimator.canSubmit
            ? "bg-quote-accent text-white hover:bg-quote-accent-hover"
            : "cursor-not-allowed bg-quote-line text-torays-text-muted"
        }`}
      >
        <MessageCircle size={19} />
        {t("wizard.getQuote")}
      </button>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-torays-text-muted">
        <Lock size={13} />
        {t("wizard.confirm.notStored")}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The wizard                                                           */
/* ------------------------------------------------------------------ */

/**
 * The public quote wizard: four steps, one screen each — device type,
 * brand+model, issue with whatever diagnostic questions the chosen problem
 * did not already answer, and contact details with consent and the single
 * WhatsApp CTA.
 *
 * Selection screens that have nothing else on them (Step 1) auto-advance on
 * tap; screens that continue below the selection (Steps 2 and 3) keep an
 * explicit Continue so the visitor can finish the rest of the screen. No
 * price, no ETA, no photo upload, no Wholesale/DESK involvement. Mounted only
 * while open, so all wizard state resets cleanly every time it reopens.
 */
export function RepairRequestModal({ onClose, initialSelection }) {
  const { t } = useLanguage();
  const estimator = useRepairRequest(initialSelection);
  const { step, STEP } = estimator;
  const overlayRef = useRef(null);
  const panelRef = useRef(null);
  const titleRef = useRef(null);
  const policyRef = useRef(null);
  const [locked, setLocked] = useState(false);
  const [showPolicyError, setShowPolicyError] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [quoteReadyOpen, setQuoteReadyOpen] = useState(false);
  useScrollLock();
  useInertSiblings(overlayRef);

  useEffect(() => {
    const previouslyFocused = document.activeElement;

    function onKeyDown(e) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      const panel = panelRef.current;
      if (e.key !== "Tab" || !panel) return;
      const items = panel.querySelectorAll(FOCUSABLE_SELECTOR);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    titleRef.current?.focus();
  }, [step]);

  // A tap on a Step-1 tile records the answer AND advances in one action.
  // `locked` absorbs a rapid double-tap so it can never fire two advances.
  function advance(recordAnswer) {
    if (locked) return;
    setLocked(true);
    recordAnswer();
    estimator.goNext();
    setTimeout(() => setLocked(false), 400);
  }

  const stepKey =
    step === STEP.DEVICE ? "device"
      : step === STEP.MODEL ? "model"
        : step === STEP.ISSUE ? "issue"
          : "contact";

  const messageState = {
    answers: estimator.answersForMessage,
    category: estimator.category,
    brand: estimator.brand,
    problem: estimator.problem,
    smartQuestions: estimator.smartQuestions,
    group: estimator.group,
    t,
  };

  function handleSubmit() {
    if (!estimator.answers.policyAccepted) {
      setShowPolicyError(true);
      policyRef.current?.focus();
      return;
    }
    setShowPolicyError(false);
    setQuoteReadyOpen(true);
  }

  /** The short recap shown inside the confirmation modal. */
  function buildSummaryRows() {
    const a = estimator.answersForMessage;
    const brandLabel = estimator.brand
      ? estimator.brand.id === "other" && a.customBrandName.trim()
        ? a.customBrandName.trim()
        : t(`wizard.brands.${estimator.brand.id}`)
      : null;
    const modelText = !a.modelNotSure && a.model.trim() ? a.model.trim() : t("wizard.summary.notSureModel");
    const rows = [
      { label: t("wizard.summary.device"), value: estimator.category ? t(`wizard.categories.${estimator.category.id}`) : "" },
      { label: t("wizard.summary.model"), value: brandLabel ? `${brandLabel} — ${modelText}` : modelText },
      { label: t("wizard.summary.problem"), value: estimator.problem ? t(`wizard.problems.${estimator.problem.id}`) : "" },
    ];
    estimator.smartQuestions.forEach((q) => {
      const answerId = a.smartAnswers[q.id];
      if (!answerId) return;
      rows.push({ label: t(`wizard.questions.${estimator.group}.${q.id}`), value: t(`wizard.answers.${answerId}`) });
    });
    rows.push({ label: t("wizard.summary.name"), value: a.name.trim() });
    rows.push({ label: t("wizard.summary.phone"), value: a.phone.trim() });
    return rows.filter((r) => r.value);
  }

  const progress = ((step + 1) / estimator.TOTAL_STEPS) * 100;

  return (
    <>
      <div
        ref={overlayRef}
        className="repair-wizard-overlay fixed inset-0 z-50 flex items-center justify-center bg-torays-text/50 p-4 sm:p-6"
        onClick={onClose}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="repair-wizard-title"
          onClick={(e) => e.stopPropagation()}
          className="repair-wizard-panel flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          <header className="border-b border-quote-line bg-white px-6 pb-4 pt-5 sm:px-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="rounded-md bg-quote-accent px-2.5 py-1 text-[11px] font-heading font-semibold uppercase tracking-wide text-white">
                    {t("wizard.stepOf", { current: step + 1, total: estimator.TOTAL_STEPS })}
                  </span>
                  <div
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-quote-line"
                    role="progressbar"
                    aria-valuenow={step + 1}
                    aria-valuemin={1}
                    aria-valuemax={estimator.TOTAL_STEPS}
                  >
                    <div className="h-full rounded-full bg-quote-accent-soft" style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <h2
                  ref={titleRef}
                  tabIndex={-1}
                  id="repair-wizard-title"
                  className="mt-3 font-heading text-xl font-semibold text-torays-text outline-none"
                >
                  {t(`wizard.titles.${stepKey}`)}
                </h2>
                <p className="mt-1 text-sm text-torays-text-secondary">{t(`wizard.subtitles.${stepKey}`)}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("wizard.close")}
                className={`-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-torays-text-secondary hover:bg-black/5 ${FOCUS_RING}`}
              >
                <X size={20} />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto bg-quote-surface px-6 py-6 sm:px-8">
            {step === STEP.DEVICE && <DeviceStep estimator={estimator} onAdvance={advance} t={t} />}
            {step === STEP.MODEL && <ModelStep estimator={estimator} onContinue={() => advance(() => {})} t={t} />}
            {step === STEP.ISSUE && <IssueStep estimator={estimator} onContinue={() => advance(() => {})} t={t} />}
            {step === STEP.CONTACT && (
              <ContactStep
                estimator={estimator}
                onSubmit={handleSubmit}
                showPolicyError={showPolicyError}
                policyRef={policyRef}
                phoneTouched={phoneTouched}
                onPhoneBlur={() => setPhoneTouched(true)}
                t={t}
              />
            )}
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-quote-line bg-white px-6 py-3.5 sm:px-8">
            {step > STEP.DEVICE ? (
              <button
                type="button"
                onClick={estimator.goBack}
                className={`inline-flex min-h-11 items-center gap-1 rounded-xl border border-quote-line px-4 py-2.5 text-sm font-heading font-medium text-torays-text transition-colors hover:border-quote-accent-soft hover:bg-quote-surface ${FOCUS_RING}`}
              >
                <ChevronLeft size={16} />
                {t("wizard.back")}
              </button>
            ) : (
              <span />
            )}
            <span className="flex items-center gap-1.5 text-xs text-torays-text-muted">
              <ShieldCheck size={14} className="text-quote-accent-soft" />
              {t("wizard.confirm.notStored")}
            </span>
          </footer>
        </div>
      </div>

      {quoteReadyOpen && (
        <QuoteReadyModal
          summaryRows={buildSummaryRows()}
          whatsappHref={buildRepairRequestWhatsAppLink(messageState)}
          mailtoHref={estimator.answers.email.trim() ? buildRepairRequestMailtoLink(messageState) : null}
          onClose={() => setQuoteReadyOpen(false)}
          onEdit={() => setQuoteReadyOpen(false)}
        />
      )}
    </>
  );
}
