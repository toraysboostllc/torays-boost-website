import { useEffect, useRef } from "react";
import { MessageCircle } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext.jsx";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-torays-red/60 focus-visible:ring-offset-2 focus-visible:ring-offset-torays-bg";

/**
 * The friendly "gate" shown before any general WhatsApp button (Navbar,
 * the floating button, the Contact card) is allowed to open WhatsApp —
 * it never opens wa.me itself; it either starts the Smart Repair Request
 * wizard (onStart) or just closes (onClose). Only the wizard's own final
 * step opens a real wa.me link. Mounted only while open, same pattern as
 * RepairRequestModal — no `open` prop needed.
 */
export function WhatsAppGateModal({ onClose, onStart }) {
  const { t } = useLanguage();
  const panelRef = useRef(null);
  const titleRef = useRef(null);

  // Tab-trap + Escape-to-close + focus restoration, same pattern as
  // RepairRequestModal's own dialog.
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-torays-text/50 p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="whatsapp-gate-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-torays-bg p-6 shadow-2xl sm:p-8"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-torays-red/10 text-torays-red">
          <MessageCircle size={20} />
        </div>

        <h2
          ref={titleRef}
          tabIndex={-1}
          id="whatsapp-gate-title"
          className="mt-4 font-heading text-xl font-semibold text-torays-text outline-none sm:text-2xl"
        >
          {t("whatsappGate.title")}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-torays-text-secondary sm:text-base">
          {t("whatsappGate.message")}
        </p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className={`min-h-11 rounded-full border border-torays-line px-5 py-2.5 text-sm font-medium text-torays-text-secondary transition-colors hover:text-torays-text ${FOCUS_RING}`}
          >
            {t("whatsappGate.notNow")}
          </button>
          <button
            type="button"
            onClick={onStart}
            className={`min-h-11 rounded-full bg-torays-red px-5 py-2.5 text-sm font-heading font-semibold text-white transition-colors hover:bg-torays-red-light ${FOCUS_RING}`}
          >
            {t("whatsappGate.start")}
          </button>
        </div>
      </div>
    </div>
  );
}
