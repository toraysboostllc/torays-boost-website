import { useEffect, useRef } from "react";
import { MessageCircle, X } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext.jsx";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-torays-navy-light/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";

/**
 * The friendly "gate" shown before any general WhatsApp button (Navbar,
 * the floating button, the Contact card) is allowed to open WhatsApp —
 * it never opens wa.me itself; it either starts the Smart Repair Request
 * wizard (onStart) or just closes (onClose). Only the wizard's own final
 * step (its Get My Quote / Cotizar button) opens a real wa.me link.
 * Mounted only while open, same pattern as RepairRequestModal — no `open`
 * prop needed. Deliberately small and light (a nudge, not a warning) —
 * see .whatsapp-gate-panel in index.css for the frosted-glass surface.
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.30)] p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="whatsapp-gate-title"
        onClick={(e) => e.stopPropagation()}
        className="whatsapp-gate-panel relative w-[calc(100%-40px)] max-w-[340px] rounded-2xl border p-[18px] shadow-[0_8px_32px_rgba(15,23,42,0.16)] backdrop-blur-[14px] sm:max-w-[360px]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("whatsappGate.close")}
          className={`absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--wgp-close)] transition-colors hover:bg-black/5 ${FOCUS_RING}`}
        >
          <X size={15} />
        </button>

        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--wgp-icon-bg)]">
          <MessageCircle size={20} className="text-torays-navy-light" />
        </div>

        <h2
          ref={titleRef}
          tabIndex={-1}
          id="whatsapp-gate-title"
          className="mt-2.5 pr-5 font-heading text-[17px] font-semibold leading-snug text-[color:var(--wgp-title)] outline-none sm:text-[18px]"
        >
          {t("whatsappGate.title")}
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[color:var(--wgp-text)] sm:text-[14px]">
          {t("whatsappGate.message")}
        </p>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={onStart}
            className={`min-h-11 rounded-full bg-torays-navy-light px-4 py-2 text-[13px] font-heading font-semibold text-white transition-colors hover:bg-torays-navy sm:text-sm ${FOCUS_RING}`}
          >
            {t("whatsappGate.start")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`min-h-11 rounded-full border border-[color:var(--wgp-secondary-border)] bg-transparent px-4 py-2 text-[13px] font-medium text-[color:var(--wgp-secondary-text)] transition-colors hover:bg-black/5 sm:text-sm ${FOCUS_RING}`}
          >
            {t("whatsappGate.notNow")}
          </button>
        </div>
      </div>
    </div>
  );
}
