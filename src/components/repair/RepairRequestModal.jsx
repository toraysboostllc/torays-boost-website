import { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, MessageCircle, Mail, Pencil } from "lucide-react";
import { useRepairRequest } from "../../hooks/useRepairRequest.js";
import { ANSWER_OPTIONS } from "../../config/repairRequest.config.js";
import { buildRepairRequestWhatsAppLink, buildRepairRequestMailtoLink } from "../../lib/repairRequestMessage.js";
import { useLanguage } from "../../i18n/LanguageContext.jsx";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-torays-red/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// XP-style relief tokens. Both gradients verified >=4.5:1 (WCAG AA) with
// white text against EVERY stop (blue: 5.71/7.61/13.23, green:
// 4.51/6.55/10.94) — see the round's own contrast-check notes. Hover only
// ever brightens a stop that was already proven safe, or (for green, where
// no safe brighter mid-stop existed) leaves color untouched and deepens
// the shadow instead — never a fresh, unverified color. Plain Tailwind
// bg-[...] classes (not inline style) so hover: variants actually apply.
const BLUE_XP_STATIC = "bg-[linear-gradient(180deg,#1D63C9_0%,#0B4FB0_48%,#062B70_100%)]";
const BLUE_XP =
  "bg-[linear-gradient(180deg,#1D63C9_0%,#0B4FB0_48%,#062B70_100%)] hover:bg-[linear-gradient(180deg,#1D63C9_0%,#1670E0_48%,#062B70_100%)]";
const GREEN_XP =
  "bg-[linear-gradient(180deg,#2E8740_0%,#206B30_48%,#144619_100%)] hover:shadow-[0_1px_0_rgba(255,255,255,0.35)_inset,0_4px_10px_rgba(10,40,15,0.45)]";

const INPUT_CLASS =
  "w-full rounded-xl border border-[#9FB3D6] bg-white px-4 py-3 text-torays-text placeholder:text-torays-text-muted focus:outline-none focus:ring-2 focus:ring-torays-red/50";

function TileButton({ selected, onClick, children, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-11 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors active:translate-y-px ${FOCUS_RING} ${
        selected
          ? `border-transparent text-white shadow-[0_1px_0_rgba(255,255,255,0.35)_inset,0_2px_6px_rgba(10,40,15,0.35)] ${GREEN_XP}`
          : "border-[#9FB3D6] bg-white text-torays-text shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_1px_2px_rgba(15,40,90,0.12)] hover:border-[#5C82C4] hover:bg-[#EAF1FC]"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function DeviceStep({ estimator, onAdvance, t }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {estimator.devices.map((device) => (
        <TileButton
          key={device.id}
          selected={estimator.answers.categoryId === device.id}
          onClick={() => onAdvance(() => estimator.selectCategory(device.id))}
        >
          {t(`wizard.categories.${device.id}`)}
        </TileButton>
      ))}
    </div>
  );
}

function ModelStep({ estimator, onContinue, t }) {
  const { brands, answers, group } = estimator;

  // Pressing Enter in either text field submits Continue as soon as the
  // form is valid — same affordance a <form onSubmit> would give, without
  // needing a real <form> wrapper around a single wizard step.
  function onFieldKeyDown(e) {
    if (e.key === "Enter" && estimator.canGoNext) {
      e.preventDefault();
      onContinue();
    }
  }

  if (brands) {
    const isOther = answers.brandId === "other";
    const modelPlaceholder =
      group === "laptop" ? t("wizard.fields.modelPlaceholderLaptop") : t("wizard.fields.modelPlaceholderPhone");

    return (
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {brands.map((b) => (
            <TileButton key={b.id} selected={answers.brandId === b.id} onClick={() => estimator.selectBrand(b.id)}>
              {t(`wizard.brands.${b.id}`)}
            </TileButton>
          ))}
        </div>

        {answers.brandId && (
          <div className="flex flex-col gap-4">
            {isOther && (
              <label className="flex flex-col gap-2">
                <span className="text-xs font-heading font-semibold uppercase tracking-wide text-torays-text-secondary">
                  {t("wizard.fields.customBrand")}
                </span>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={answers.customBrandName}
                  onChange={(e) => estimator.setCustomBrandName(e.target.value)}
                  onKeyDown={onFieldKeyDown}
                  placeholder={t("wizard.fields.customBrandPlaceholder")}
                  className={INPUT_CLASS}
                />
              </label>
            )}
            <label className="flex flex-col gap-2">
              <span className="text-xs font-heading font-semibold uppercase tracking-wide text-torays-text-secondary">
                {isOther ? t("wizard.fields.exactModel") : t("wizard.fields.enterExactModel")}
              </span>
              <input
                type="text"
                required
                maxLength={100}
                value={answers.model}
                onChange={(e) => estimator.setModel(e.target.value)}
                onKeyDown={onFieldKeyDown}
                placeholder={modelPlaceholder}
                className={INPUT_CLASS}
              />
            </label>
            <ContinueButton disabled={!estimator.canGoNext} onClick={onContinue} label={t("wizard.continueLabel")} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className="text-xs font-heading font-semibold uppercase tracking-wide text-torays-text-secondary">
          {t("wizard.fields.exactModelOptional")}
        </span>
        <input
          type="text"
          maxLength={100}
          value={answers.model}
          disabled={answers.modelNotSure}
          onChange={(e) => estimator.setModel(e.target.value)}
          placeholder={t("wizard.fields.modelPlaceholder")}
          className={`${INPUT_CLASS} disabled:cursor-not-allowed disabled:opacity-40`}
        />
      </label>

      <label className="flex min-h-11 items-center gap-3 text-sm text-torays-text-secondary">
        <input
          type="checkbox"
          checked={answers.modelNotSure}
          onChange={(e) => estimator.setModelNotSure(e.target.checked)}
          className={`h-5 w-5 rounded border-[#9FB3D6] text-torays-red ${FOCUS_RING}`}
        />
        {t("wizard.notSureOther")}
      </label>

      <ContinueButton disabled={!estimator.canGoNext} onClick={onContinue} label={t("wizard.continueLabel")} />
    </div>
  );
}

function ProblemStep({ estimator, onAdvance, t }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {estimator.problems.map((p) => (
        <TileButton
          key={p.id}
          selected={estimator.answers.problemId === p.id}
          onClick={() => onAdvance(() => estimator.selectProblem(p.id))}
        >
          {t(`wizard.problems.${p.id}`)}
        </TileButton>
      ))}
    </div>
  );
}

function SmartQuestionStep({ estimator, step, onAdvance, t }) {
  const question = estimator.smartQuestionForStep(step);
  if (!question) return null;
  const current = estimator.answers.smartAnswers[question.id];
  return (
    <div className="flex flex-col gap-5">
      <p className="text-lg font-heading font-semibold text-torays-text">
        {t(`wizard.questions.${estimator.group}.${question.id}`)}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {ANSWER_OPTIONS.map((option) => (
          <TileButton
            key={option.id}
            selected={current === option.id}
            onClick={() => onAdvance(() => estimator.answerSmartQuestion(question.id, option.id))}
            className="text-center"
          >
            {t(`wizard.answers.${option.id}`)}
          </TileButton>
        ))}
      </div>
    </div>
  );
}

function ContactStep({ estimator, onContinue, t }) {
  const { answers } = estimator;
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-xs font-heading font-semibold uppercase tracking-wide text-torays-text-secondary">
          {t("wizard.fields.name")}
        </span>
        <input
          type="text"
          required
          maxLength={100}
          value={answers.name}
          onChange={(e) => estimator.setField("name", e.target.value)}
          className={INPUT_CLASS}
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-xs font-heading font-semibold uppercase tracking-wide text-torays-text-secondary">
          {t("wizard.fields.phone")}
        </span>
        <input
          type="tel"
          required
          maxLength={30}
          value={answers.phone}
          onChange={(e) => estimator.setField("phone", e.target.value)}
          className={INPUT_CLASS}
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-xs font-heading font-semibold uppercase tracking-wide text-torays-text-secondary">
          {t("wizard.fields.email")}
        </span>
        <input
          type="email"
          maxLength={200}
          value={answers.email}
          onChange={(e) => estimator.setField("email", e.target.value)}
          className={INPUT_CLASS}
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-xs font-heading font-semibold uppercase tracking-wide text-torays-text-secondary">
          {t("wizard.fields.details")}
        </span>
        <textarea
          rows={3}
          maxLength={1000}
          value={answers.details}
          onChange={(e) => estimator.setField("details", e.target.value)}
          className={`${INPUT_CLASS} resize-none`}
        />
      </label>
      <p className="text-xs text-torays-text-muted">{t("wizard.photosNote")}</p>

      <ContinueButton disabled={!estimator.canGoNext} onClick={onContinue} label={t("wizard.reviewRequest")} />
    </div>
  );
}

function ContinueButton({ disabled, onClick, label }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`min-h-11 self-start rounded-full px-6 py-3 text-sm font-heading font-medium transition-colors active:translate-y-px ${FOCUS_RING} ${
        disabled
          ? "cursor-not-allowed bg-torays-line text-torays-text-muted"
          : `text-white shadow-[0_1px_0_rgba(255,255,255,0.35)_inset,0_2px_6px_rgba(10,40,15,0.3)] ${GREEN_XP}`
      }`}
    >
      {label}
    </button>
  );
}

function SummaryRow({ label, value, onEdit, t }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#D8E1F2] py-2 last:border-0">
      <div>
        <p className="text-xs font-heading font-semibold uppercase tracking-wide text-torays-text-secondary">
          {label}
        </p>
        <p className="mt-0.5 text-sm text-torays-text">{value}</p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label={t("wizard.editLabel", { label })}
        className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-torays-text-secondary hover:text-torays-red ${FOCUS_RING}`}
      >
        <Pencil size={16} />
      </button>
    </div>
  );
}

function ReviewStep({ estimator, t }) {
  const { answers, category, brand, problem, smartQuestions, group, STEP } = estimator;
  const email = answers.email.trim();
  const modelValue = !answers.modelNotSure && answers.model.trim() ? answers.model.trim() : t("wizard.summary.notSureModel");
  const brandValue = brand
    ? brand.id === "other" && answers.customBrandName.trim()
      ? answers.customBrandName.trim()
      : t(`wizard.brands.${brand.id}`)
    : null;
  const messageState = { answers, category, brand, problem, smartQuestions, group, t };
  const [showPolicyError, setShowPolicyError] = useState(false);
  const policyCheckboxRef = useRef(null);

  // Shared gate for every way this request can be sent (WhatsApp or
  // email) — all earlier steps already required device/problem/name/phone
  // via their own canGoNext checks, so by the time the visitor reaches
  // Review the rest of the form is already valid; this checkbox is the one
  // remaining thing that can block submission through either method.
  function ensurePolicyAccepted() {
    if (!answers.policyAccepted) {
      setShowPolicyError(true);
      policyCheckboxRef.current?.focus();
      return false;
    }
    setShowPolicyError(false);
    return true;
  }

  // window.open() must run synchronously inside this click handler (no
  // awaits before it) or browsers treat it as an unrequested popup and
  // block it.
  function handleGetQuote() {
    if (!ensurePolicyAccepted()) return;
    window.open(buildRepairRequestWhatsAppLink(messageState), "_blank", "noopener,noreferrer");
  }

  function handleSendEmail() {
    if (!ensurePolicyAccepted()) return;
    window.location.href = buildRepairRequestMailtoLink(messageState);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-[#D8E1F2] bg-white px-4">
        <SummaryRow label={t("wizard.summary.device")} value={category ? t(`wizard.categories.${category.id}`) : ""} onEdit={() => estimator.editStep(STEP.DEVICE)} t={t} />
        {brand && <SummaryRow label={t("wizard.summary.brand")} value={brandValue} onEdit={() => estimator.editStep(STEP.MODEL)} t={t} />}
        <SummaryRow label={t("wizard.summary.model")} value={modelValue} onEdit={() => estimator.editStep(STEP.MODEL)} t={t} />
        <SummaryRow label={t("wizard.summary.problem")} value={problem ? t(`wizard.problems.${problem.id}`) : ""} onEdit={() => estimator.editStep(STEP.PROBLEM)} t={t} />
        {smartQuestions.map((q, i) => (
          <SummaryRow
            key={q.id}
            label={t(`wizard.questions.${group}.${q.id}`)}
            value={answers.smartAnswers[q.id] ? t(`wizard.answers.${answers.smartAnswers[q.id]}`) : null}
            onEdit={() => estimator.editStep(STEP.SMART_1 + i)}
            t={t}
          />
        ))}
        <SummaryRow label={t("wizard.summary.name")} value={answers.name} onEdit={() => estimator.editStep(STEP.CONTACT)} t={t} />
        <SummaryRow label={t("wizard.summary.phone")} value={answers.phone} onEdit={() => estimator.editStep(STEP.CONTACT)} t={t} />
        <SummaryRow label={t("wizard.summary.email")} value={email} onEdit={() => estimator.editStep(STEP.CONTACT)} t={t} />
        <SummaryRow label={t("wizard.summary.additionalDetails")} value={answers.details.trim()} onEdit={() => estimator.editStep(STEP.CONTACT)} t={t} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <label className="flex min-h-11 items-start gap-3 rounded-xl border border-[#D8E1F2] bg-white px-4 py-3">
            <input
              ref={policyCheckboxRef}
              type="checkbox"
              checked={answers.policyAccepted}
              aria-describedby={showPolicyError ? "policy-consent-error" : undefined}
              aria-invalid={showPolicyError}
              onChange={(e) => {
                estimator.setField("policyAccepted", e.target.checked);
                if (e.target.checked) setShowPolicyError(false);
              }}
              className={`mt-0.5 h-5 w-5 shrink-0 rounded border-[#9FB3D6] text-torays-red ${FOCUS_RING}`}
            />
            <span className="text-xs leading-relaxed text-torays-text-secondary">
              {t("wizard.policyConsent.prefix")}
              <a
                href="/terms"
                target="_blank"
                rel="noreferrer"
                className="text-torays-navy underline decoration-torays-line hover:text-torays-red"
              >
                {t("wizard.policyConsent.termsLabel")}
              </a>
              {t("wizard.policyConsent.middle")}
              <a
                href="/privacy"
                target="_blank"
                rel="noreferrer"
                className="text-torays-navy underline decoration-torays-line hover:text-torays-red"
              >
                {t("wizard.policyConsent.privacyLabel")}
              </a>
              {t("wizard.policyConsent.suffix")}
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
          onClick={handleGetQuote}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 py-3.5 text-base font-heading font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.35)_inset,0_2px_6px_rgba(10,40,15,0.3)] transition-colors active:translate-y-px ${GREEN_XP} ${FOCUS_RING}`}
        >
          <MessageCircle size={18} />
          {t("wizard.getQuote")}
        </button>

        {email ? (
          <button
            type="button"
            onClick={handleSendEmail}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 py-3.5 text-base font-heading font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.35)_inset,0_2px_6px_rgba(6,30,80,0.3)] transition-colors active:translate-y-px ${BLUE_XP} ${FOCUS_RING}`}
          >
            <Mail size={18} />
            {t("wizard.sendEmail")}
          </button>
        ) : (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              disabled
              className="inline-flex min-h-11 cursor-not-allowed items-center justify-center gap-2 rounded-full border border-[#D8E1F2] px-6 py-3.5 text-base font-heading font-medium text-torays-text-muted"
            >
              <Mail size={18} />
              {t("wizard.sendEmail")}
            </button>
            <p className="text-center text-xs text-torays-text-muted">{t("wizard.addEmailHint")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The public Smart Repair Request wizard — one step per screen, no visible
 * "Next" anywhere: selection screens (device, branded-model, problem,
 * smart questions) save the answer and auto-advance on tap/click/Enter;
 * typed-field screens (custom model, contact details) keep an explicit
 * Continue/Review Request button, gated on required fields. Back is blue
 * XP, everything selected/confirming is green XP. No price, no ETA, no
 * photo upload, no Wholesale/DESK involvement. Mounted only while open
 * (see Home.jsx), so all wizard state resets cleanly every time it's
 * reopened.
 */
export function RepairRequestModal({ onClose }) {
  const { t } = useLanguage();
  const estimator = useRepairRequest();
  const { step, STEP } = estimator;
  const panelRef = useRef(null);
  const titleRef = useRef(null);
  const [locked, setLocked] = useState(false);

  // Tab-trap + Escape-to-close + focus restoration — set up once, torn
  // down on unmount (i.e. when the modal fully closes).
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

  // Move focus to the new step's title every time the step changes
  // (including the initial mount) — screen readers announce the step
  // context, and it's a predictable place to start Tabbing from.
  useEffect(() => {
    titleRef.current?.focus();
  }, [step]);

  // A tap/click on a selection tile both records the answer AND advances
  // the step in one user action. `locked` absorbs a rapid double-tap/
  // double-click so it can never fire two advances for one gesture.
  function advance(recordAnswer) {
    if (locked) return;
    setLocked(true);
    recordAnswer();
    estimator.goNext();
    setTimeout(() => setLocked(false), 400);
  }

  const stepTitleKey =
    step === STEP.DEVICE
      ? "device"
      : step === STEP.MODEL
        ? "model"
        : step === STEP.PROBLEM
          ? "problem"
          : step === STEP.CONTACT
            ? "contact"
            : step === STEP.REVIEW
              ? "review"
              : "smart";
  const title = t(`wizard.titles.${stepTitleKey}`);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-torays-text/50 p-4 sm:p-6" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="repair-wizard-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-[#F3F7FF] shadow-2xl"
      >
        <div
          className={`flex items-center justify-between px-6 py-4 text-white shadow-[0_1px_0_rgba(255,255,255,0.4)_inset] ${BLUE_XP_STATIC}`}
        >
          <div>
            <p className="text-xs font-heading font-semibold uppercase tracking-wide text-white/85">
              {t("wizard.stepOf", { current: step + 1, total: estimator.TOTAL_STEPS })}
            </p>
            <h2
              ref={titleRef}
              tabIndex={-1}
              id="repair-wizard-title"
              className="mt-0.5 font-heading text-lg font-semibold text-white outline-none"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("wizard.close")}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/15 ${FOCUS_RING}`}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
          {step === STEP.DEVICE && <DeviceStep estimator={estimator} onAdvance={advance} t={t} />}
          {step === STEP.MODEL && <ModelStep estimator={estimator} onContinue={() => advance(() => {})} t={t} />}
          {step === STEP.PROBLEM && <ProblemStep estimator={estimator} onAdvance={advance} t={t} />}
          {(step === STEP.SMART_1 || step === STEP.SMART_2 || step === STEP.SMART_3) && (
            <SmartQuestionStep estimator={estimator} step={step} onAdvance={advance} t={t} />
          )}
          {step === STEP.CONTACT && (
            <ContactStep estimator={estimator} onContinue={() => advance(() => {})} t={t} />
          )}
          {step === STEP.REVIEW && <ReviewStep estimator={estimator} t={t} />}
        </div>

        {step > STEP.DEVICE && (
          <div className="flex items-center justify-start border-t border-[#D8E1F2] px-6 py-4">
            <button
              type="button"
              onClick={estimator.goBack}
              className={`inline-flex min-h-11 items-center gap-1 rounded-full px-5 py-2.5 text-sm font-heading font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.3)_inset,0_2px_5px_rgba(6,30,80,0.3)] transition-colors active:translate-y-px ${BLUE_XP} ${FOCUS_RING}`}
            >
              <ChevronLeft size={16} />
              {t("wizard.back")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
