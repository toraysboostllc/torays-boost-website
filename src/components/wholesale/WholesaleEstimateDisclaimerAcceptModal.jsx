import { useState } from "react";
import { LogOut, ShieldCheck } from "lucide-react";
import { useWholesaleLocale } from "../../i18n/WholesaleLocaleContext.jsx";
import { acceptWholesaleEstimateDisclaimer } from "../../lib/wholesaleAuth.js";
import { wholesaleHoverProps } from "../../lib/wholesaleSound.js";

/**
 * Blocking clickwrap gate for the Estimate Disclaimer — a lightweight,
 * standalone sibling of WholesaleLegalAcceptModal.jsx (the 6-document
 * master agreement), never a replacement for it. Both gates can appear in
 * the same first visit; WholesalePrices.jsx mounts whichever one the
 * server's `missing` array currently names, and re-fetches on Accept,
 * naturally surfacing the next one if any (see that file's own comment).
 *
 * Same "no dismiss except Logout" hardening as the master-agreement modal
 * (deliberately copied, not re-derived): no backdrop click-to-dismiss, no
 * Escape-key handler, no visible X, no "skip" control. Unlike that modal,
 * there is exactly ONE checkbox and no representative name/title fields —
 * this document is a lightweight pricing disclaimer, not a signed
 * agreement.
 */
export function WholesaleEstimateDisclaimerAcceptModal({ legalDocumentId, onAccepted, onLogout }) {
  const { t, language } = useWholesaleLocale();

  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const canSubmit = accepted && !submitting;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorMessage("");

    const result = await acceptWholesaleEstimateDisclaimer({ legalDocumentId, accepted: true, locale: language });

    if (!result.ok) {
      setSubmitting(false);
      if (result.error === "checkbox_required") {
        setErrorMessage(t("estimateDisclaimerAccept.errorCheckbox"));
      } else if (result.error === "document_superseded") {
        setErrorMessage(t("estimateDisclaimerAccept.errorSuperseded"));
      } else {
        setErrorMessage(result.message || t("estimateDisclaimerAccept.errorGeneric"));
      }
      return;
    }

    // Submitting stays true (no reset to false) on success — the parent
    // unmounts this modal and re-fetches the catalog immediately, same
    // pattern as WholesaleLegalAcceptModal.jsx.
    onAccepted();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.55)] p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wsl-estimate-disclaimer-heading"
        className="flex max-h-[92vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-2xl bg-torays-surface p-6 shadow-xl"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck size={20} className="text-torays-navy" aria-hidden="true" />
          <h1 id="wsl-estimate-disclaimer-heading" className="font-heading text-xl font-bold text-torays-text">
            {t("estimateDisclaimerAccept.heading")}
          </h1>
        </div>
        <p className="text-sm text-torays-text-secondary">{t("estimateDisclaimerAccept.subheading")}</p>

        <div className="rounded-lg border border-torays-line p-3">
          <a
            href="/wholesale/legal#estimate_disclaimer"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-torays-navy underline decoration-torays-line hover:text-torays-red"
          >
            {t("estimateDisclaimerAccept.readLink")}
          </a>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex min-h-11 items-start gap-2.5 text-sm text-torays-text-secondary">
            <input
              type="checkbox"
              checked={accepted}
              onChange={() => setAccepted((prev) => !prev)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-torays-navy"
            />
            <span>{t("estimateDisclaimerAccept.checkboxLabel")}</span>
          </label>

          {errorMessage && (
            <p role="alert" className="text-xs text-torays-red">
              {errorMessage}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              {...wholesaleHoverProps(onLogout)}
              className="wsp-btn wsp-btn-ghost"
            >
              <LogOut size={16} aria-hidden="true" />
              {t("estimateDisclaimerAccept.logout")}
            </button>
            <button type="submit" disabled={!canSubmit} className="wsp-btn wsp-btn-primary disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? t("estimateDisclaimerAccept.accepting") : t("estimateDisclaimerAccept.accept")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
