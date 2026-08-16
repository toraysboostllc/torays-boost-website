import { useEffect, useRef } from "react";
import { X, ChevronLeft, ChevronRight, MessageCircle, Mail, Pencil } from "lucide-react";
import { useRepairRequest } from "../../hooks/useRepairRequest.js";
import { ANSWER_OPTIONS } from "../../config/repairRequest.config.js";
import { buildRepairRequestWhatsAppLink, buildRepairRequestMailtoLink } from "../../lib/repairRequestMessage.js";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-torays-red/60 focus-visible:ring-offset-2 focus-visible:ring-offset-torays-surface";

const INPUT_CLASS =
  "w-full rounded-xl border border-torays-line bg-torays-surface-alt px-4 py-3 text-torays-text placeholder:text-torays-text-muted focus:outline-none focus:ring-2 focus:ring-torays-red/50";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const STEP_TITLES = {
  0: "Choose your device",
  1: "Select or enter the model",
  2: "What is the problem?",
  6: "Your name and details",
  7: "Review and contact",
};

function TileButton({ selected, onClick, children, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-11 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${FOCUS_RING} ${
        selected
          ? "border-torays-red bg-torays-red/10 text-torays-red"
          : "border-torays-line bg-torays-surface-alt text-torays-text hover:border-torays-red/40"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function DeviceStep({ estimator }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {estimator.devices.map((device) => (
        <TileButton
          key={device.id}
          selected={estimator.answers.categoryId === device.id}
          onClick={() => estimator.selectCategory(device.id)}
        >
          {device.label}
        </TileButton>
      ))}
    </div>
  );
}

function ModelStep({ estimator }) {
  const { brands, answers } = estimator;
  return (
    <div className="flex flex-col gap-5">
      {brands && (
        <label className="flex flex-col gap-2">
          <span className="text-xs font-heading font-semibold uppercase tracking-wide text-torays-text-secondary">
            Brand
          </span>
          <select
            value={answers.brandId}
            onChange={(e) => estimator.selectBrand(e.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">Select brand</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-2">
        <span className="text-xs font-heading font-semibold uppercase tracking-wide text-torays-text-secondary">
          Exact model {brands ? "(optional)" : ""}
        </span>
        <input
          type="text"
          maxLength={100}
          value={answers.model}
          disabled={answers.modelNotSure}
          onChange={(e) => estimator.setModel(e.target.value)}
          placeholder="e.g. iPhone 14 Pro, PS5 Slim, MacBook Air M2"
          className={`${INPUT_CLASS} disabled:cursor-not-allowed disabled:opacity-40`}
        />
      </label>

      <label className="flex min-h-11 items-center gap-3 text-sm text-torays-text-secondary">
        <input
          type="checkbox"
          checked={answers.modelNotSure}
          onChange={(e) => estimator.setModelNotSure(e.target.checked)}
          className={`h-5 w-5 rounded border-torays-line text-torays-red ${FOCUS_RING}`}
        />
        Not sure / Other
      </label>
    </div>
  );
}

function ProblemStep({ estimator }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {estimator.problems.map((p) => (
        <TileButton
          key={p.id}
          selected={estimator.answers.problemId === p.id}
          onClick={() => estimator.selectProblem(p.id)}
        >
          {p.label}
        </TileButton>
      ))}
    </div>
  );
}

function SmartQuestionStep({ estimator, step }) {
  const question = estimator.smartQuestionForStep(step);
  if (!question) return null;
  const current = estimator.answers.smartAnswers[question.id];
  return (
    <div className="flex flex-col gap-5">
      <p className="text-lg font-heading font-semibold text-torays-text">{question.text}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {ANSWER_OPTIONS.map((option) => (
          <TileButton
            key={option.id}
            selected={current === option.id}
            onClick={() => estimator.answerSmartQuestion(question.id, option.id)}
            className="text-center"
          >
            {option.label}
          </TileButton>
        ))}
      </div>
    </div>
  );
}

function ContactStep({ estimator }) {
  const { answers } = estimator;
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-xs font-heading font-semibold uppercase tracking-wide text-torays-text-secondary">
          Name
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
          Phone
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
          Email (optional — required only if you choose to send by email)
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
          Additional details (optional)
        </span>
        <textarea
          rows={3}
          maxLength={1000}
          value={answers.details}
          onChange={(e) => estimator.setField("details", e.target.value)}
          className={`${INPUT_CLASS} resize-none`}
        />
      </label>
      <p className="text-xs text-torays-text-muted">You can attach photos after WhatsApp opens.</p>
    </div>
  );
}

function SummaryRow({ label, value, onEdit }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-torays-line py-2 last:border-0">
      <div>
        <p className="text-xs font-heading font-semibold uppercase tracking-wide text-torays-text-secondary">
          {label}
        </p>
        <p className="mt-0.5 text-sm text-torays-text">{value}</p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${label}`}
        className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-torays-text-secondary hover:text-torays-red ${FOCUS_RING}`}
      >
        <Pencil size={16} />
      </button>
    </div>
  );
}

function ReviewStep({ estimator }) {
  const { answers, category, brand, problem, smartQuestions, STEP } = estimator;
  const email = answers.email.trim();
  const modelValue = !answers.modelNotSure && answers.model.trim() ? answers.model.trim() : "Not sure";

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-torays-line bg-torays-surface-alt px-4">
        <SummaryRow label="Device" value={category?.label} onEdit={() => estimator.editStep(STEP.DEVICE)} />
        {brand && <SummaryRow label="Brand" value={brand.label} onEdit={() => estimator.editStep(STEP.MODEL)} />}
        <SummaryRow label="Model" value={modelValue} onEdit={() => estimator.editStep(STEP.MODEL)} />
        <SummaryRow label="Problem" value={problem?.label} onEdit={() => estimator.editStep(STEP.PROBLEM)} />
        {smartQuestions.map((q, i) => (
          <SummaryRow
            key={q.id}
            label={q.text}
            value={
              { yes: "Yes", no: "No", "not-sure": "Not sure" }[answers.smartAnswers[q.id]] || null
            }
            onEdit={() => estimator.editStep(STEP.SMART_1 + i)}
          />
        ))}
        <SummaryRow label="Name" value={answers.name} onEdit={() => estimator.editStep(STEP.CONTACT)} />
        <SummaryRow label="Phone" value={answers.phone} onEdit={() => estimator.editStep(STEP.CONTACT)} />
        <SummaryRow label="Email" value={email} onEdit={() => estimator.editStep(STEP.CONTACT)} />
        <SummaryRow label="Additional details" value={answers.details.trim()} onEdit={() => estimator.editStep(STEP.CONTACT)} />
      </div>

      <div className="flex flex-col gap-3">
        <a
          href={buildRepairRequestWhatsAppLink(estimator)}
          target="_blank"
          rel="noreferrer"
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-torays-red px-6 py-3.5 text-base font-heading font-medium text-white shadow-glow-red transition-colors hover:bg-torays-red-light ${FOCUS_RING}`}
        >
          <MessageCircle size={18} />
          Send via WhatsApp
        </a>

        {email ? (
          <a
            href={buildRepairRequestMailtoLink(estimator)}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-torays-navy-light/50 px-6 py-3.5 text-base font-heading font-medium text-torays-text transition-colors hover:bg-torays-navy/10 ${FOCUS_RING}`}
          >
            <Mail size={18} />
            Send via Email
          </a>
        ) : (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              disabled
              className="inline-flex min-h-11 cursor-not-allowed items-center justify-center gap-2 rounded-full border border-torays-line px-6 py-3.5 text-base font-heading font-medium text-torays-text-muted opacity-60"
            >
              <Mail size={18} />
              Send via Email
            </button>
            <p className="text-center text-xs text-torays-text-muted">Add your email above to send via email.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The public Smart Repair Request wizard — one step per screen, Back/Next
 * navigation, editable review before contact. No price, no ETA, no photo
 * upload (see the note in ContactStep), no Wholesale/DESK involvement.
 * Mounted only while open (see Home.jsx), so all wizard state resets
 * cleanly every time it's reopened.
 */
export function RepairRequestModal({ onClose }) {
  const estimator = useRepairRequest();
  const { step, TOTAL_STEPS, STEP } = estimator;
  const panelRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;
    const focusable = panel?.querySelectorAll(FOCUSABLE_SELECTOR);
    focusable?.[0]?.focus();

    function onKeyDown(e) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
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

  const title =
    STEP_TITLES[step] ?? (step >= STEP.SMART_1 && step <= STEP.SMART_3 ? "Quick question" : "Repair Request");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-torays-text/50 p-4 sm:p-6" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="repair-wizard-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-torays-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-torays-line px-6 py-4">
          <div>
            <p className="text-xs font-heading font-semibold uppercase tracking-wide text-torays-text-muted">
              Step {step + 1} of {TOTAL_STEPS}
            </p>
            <h2 id="repair-wizard-title" className="mt-0.5 font-heading text-lg font-semibold text-torays-text">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-torays-text-secondary hover:bg-torays-surface-alt ${FOCUS_RING}`}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
          {step === STEP.DEVICE && <DeviceStep estimator={estimator} />}
          {step === STEP.MODEL && <ModelStep estimator={estimator} />}
          {step === STEP.PROBLEM && <ProblemStep estimator={estimator} />}
          {(step === STEP.SMART_1 || step === STEP.SMART_2 || step === STEP.SMART_3) && (
            <SmartQuestionStep estimator={estimator} step={step} />
          )}
          {step === STEP.CONTACT && <ContactStep estimator={estimator} />}
          {step === STEP.REVIEW && <ReviewStep estimator={estimator} />}
        </div>

        {step !== STEP.REVIEW && (
          <div className="flex items-center justify-between gap-3 border-t border-torays-line px-6 py-4">
            <button
              type="button"
              onClick={estimator.goBack}
              disabled={step === STEP.DEVICE}
              className={`inline-flex min-h-11 items-center gap-1 rounded-full px-4 py-2.5 text-sm font-heading font-medium text-torays-text-secondary transition-colors hover:bg-torays-surface-alt disabled:cursor-not-allowed disabled:opacity-0 ${FOCUS_RING}`}
            >
              <ChevronLeft size={16} />
              Back
            </button>
            <button
              type="button"
              onClick={estimator.goNext}
              disabled={!estimator.canGoNext}
              className={`inline-flex min-h-11 items-center gap-1 rounded-full bg-torays-red px-6 py-2.5 text-sm font-heading font-medium text-white transition-colors hover:bg-torays-red-light disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        )}
        {step === STEP.REVIEW && (
          <div className="flex items-center justify-start border-t border-torays-line px-6 py-4">
            <button
              type="button"
              onClick={estimator.goBack}
              className={`inline-flex min-h-11 items-center gap-1 rounded-full px-4 py-2.5 text-sm font-heading font-medium text-torays-text-secondary transition-colors hover:bg-torays-surface-alt ${FOCUS_RING}`}
            >
              <ChevronLeft size={16} />
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
