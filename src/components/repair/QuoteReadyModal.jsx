import { useEffect, useRef } from "react";
import { Check, X, MessageCircle, Lock, Pencil } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import { useScrollLock } from "../../hooks/useScrollLock.js";
import { useInertSiblings } from "../../hooks/useInertSiblings.js";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-quote-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

/**
 * The last thing the visitor sees before leaving for WhatsApp.
 *
 * Its whole job is to be honest about state: the request is BUILT, not SENT.
 * Nothing on this screen says "sent" in either language, because nothing has
 * been — the message only reaches Torays Boost once the visitor presses send
 * inside WhatsApp itself. It also carries the short summary that used to live
 * on the old standalone review step, so folding that step away didn't cost the
 * visitor their last look at what they're about to send.
 *
 * The action is a real <a href>, not window.open(): a link is never treated as
 * a popup, whereas window.open() is blocked whenever the browser decides the
 * click wasn't direct enough. That also removes a failure mode the old flow had.
 *
 * Not a wizard step — the header still reads "Step 4 of 4" behind it, and
 * closing this returns the visitor to that step with everything intact.
 */
export function QuoteReadyModal({ summaryRows, whatsappHref, mailtoHref, onClose, onEdit }) {
  const { t } = useLanguage();
  const overlayRef = useRef(null);
  const panelRef = useRef(null);
  const titleRef = useRef(null);
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
  }, []);

  const steps = [t("wizard.confirm.next1"), t("wizard.confirm.next2"), t("wizard.confirm.next3")];

  return (
    <div
      ref={overlayRef}
      className="repair-wizard-overlay fixed inset-0 z-[60] flex items-center justify-center bg-torays-text/50 p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quote-ready-title"
        onClick={(e) => e.stopPropagation()}
        className="repair-wizard-panel relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex-1 overflow-y-auto px-6 py-7 sm:px-8">
          <button
            type="button"
            onClick={onClose}
            aria-label={t("wizard.confirm.close")}
            className={`absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full text-torays-text-secondary hover:bg-black/5 ${FOCUS_RING}`}
          >
            <X size={18} />
          </button>

          <div className="flex justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-quote-accent-soft bg-quote-wash">
              <Check size={30} className="text-quote-accent" strokeWidth={2.5} />
            </span>
          </div>

          <h2
            ref={titleRef}
            tabIndex={-1}
            id="quote-ready-title"
            className="mt-5 text-center font-heading text-xl font-semibold text-torays-text outline-none"
          >
            {t("wizard.confirm.title")}
          </h2>
          <p className="mt-2.5 text-center text-sm leading-relaxed text-torays-text-secondary">
            {t("wizard.confirm.body")}
          </p>

          <section className="mt-5 rounded-xl border border-quote-line bg-quote-surface px-4 py-3">
            <h3 className="text-xs font-heading font-semibold uppercase tracking-wide text-quote-ink">
              {t("wizard.confirm.summaryTitle")}
            </h3>
            <dl className="mt-2 flex flex-col gap-1.5">
              {summaryRows.map((row) => (
                // A long diagnostic question must wrap and keep its answer
                // visible rather than pushing it off the right edge on a
                // narrow phone.
                <div key={row.label} className="flex flex-wrap gap-x-2 text-[13px] leading-snug">
                  <dt className="min-w-0 font-medium text-torays-text-secondary">{row.label}:</dt>
                  <dd className="min-w-0 font-medium text-torays-text">{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-4 rounded-xl bg-quote-wash px-4 py-3.5">
            <h3 className="text-sm font-heading font-semibold text-quote-ink">{t("wizard.confirm.whatNext")}</h3>
            <ul className="mt-2 flex flex-col gap-1.5">
              {steps.map((label) => (
                <li key={label} className="flex items-start gap-2 text-[13px] text-torays-text-secondary">
                  <Check size={15} className="mt-0.5 shrink-0 text-quote-accent" />
                  {label}
                </li>
              ))}
            </ul>
          </section>

          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className={`mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-quote-wa px-6 py-3.5 text-base font-heading font-semibold text-white transition-colors hover:bg-quote-wa-hover active:translate-y-px ${FOCUS_RING}`}
          >
            <MessageCircle size={19} />
            {t("wizard.confirm.send")}
          </a>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-torays-text-muted">
            <Lock size={13} />
            {t("wizard.confirm.notStored")}
          </p>

          <div className="mt-4 flex flex-col items-center gap-2 border-t border-quote-line pt-4">
            <button
              type="button"
              onClick={onEdit}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-quote-accent hover:underline ${FOCUS_RING}`}
            >
              <Pencil size={14} />
              {t("wizard.confirm.edit")}
            </button>
            {mailtoHref && (
              <a
                href={mailtoHref}
                className={`inline-flex min-h-11 items-center rounded-lg px-3 text-xs text-torays-text-muted hover:text-quote-accent hover:underline ${FOCUS_RING}`}
              >
                {t("wizard.confirm.emailInstead")}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
