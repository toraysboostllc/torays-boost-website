import { useState } from "react";
import { LogOut, ShieldCheck } from "lucide-react";
import { useWholesaleLocale } from "../../i18n/WholesaleLocaleContext.jsx";
import { acceptWholesaleLegalTerms } from "../../lib/wholesaleAuth.js";
import { wholesaleHoverProps } from "../../lib/wholesaleSound.js";

const DOC_KEYS = [
  "access_agreement",
  "pricing_policy",
  "pricing_disclaimer",
  "privacy_security",
  "repair_warranty_terms",
  "econsent_disclosure",
];

/** The 5 required checkboxes, in display order. `key` matches both this
 *  component's own state object and the wire-shape key
 *  api/wholesale-accept-legal.js expects inside `checkboxes` — kept
 *  identical everywhere on purpose so there is never a silent rename
 *  between what the shop checked and what gets sent. */
const CHECKBOXES = [
  { key: "confirmsAuthority", labelKey: "legalAccept.checkboxAuthority" },
  { key: "acceptsTermsPrivacy", labelKey: "legalAccept.checkboxTermsPrivacy" },
  { key: "understandsTiersOptional", labelKey: "legalAccept.checkboxTiersOptional" },
  { key: "understandsIndependentPricing", labelKey: "legalAccept.checkboxIndependentPricing" },
  { key: "acceptsConfidentiality", labelKey: "legalAccept.checkboxConfidentiality" },
];

const INITIAL_CHECKBOXES = {
  confirmsAuthority: false,
  acceptsTermsPrivacy: false,
  understandsTiersOptional: false,
  understandsIndependentPricing: false,
  acceptsConfidentiality: false,
};

/**
 * Blocking clickwrap gate — mounted by WholesalePrices.jsx in place of the
 * wizard whenever /api/wholesale-prices answers legal_acceptance_required
 * (see wholesaleAuth.js's fetchWholesaleCatalog, kind: "legal_required").
 *
 * By design, the ONLY controls on this modal are the 5 checkboxes + 2 text
 * fields + Accept and Enter (gated) + Logout (always available, calls the
 * SAME handleLogout the rest of the portal already uses — passed in as
 * `onLogout`, never reimplemented here) — no backdrop click-to-dismiss, no
 * Escape-key handler, no visible X, and no "skip"/"continue without
 * accepting" control of any kind. A Shop that does not want to accept can
 * only leave via Logout, which is always enabled regardless of the form's
 * validity — see Document 6 (Electronic Consent & Records Disclosure),
 * Section 5: "A Shop that does not wish to transact electronically may
 * decline at the acceptance screen. In that case, it will not have access
 * to the Portal's wholesale pricing."
 *
 * Every "Read" link opens /wholesale/legal (the public, no-login page) in a
 * new tab, scrolled to that document's own anchor — a plain, always-visible
 * list, never a collapsed accordion that could make a document look
 * optional to open before accepting.
 */
export function WholesaleLegalAcceptModal({ legalDocumentId, onAccepted, onLogout }) {
  const { t, language } = useWholesaleLocale();

  const [representativeName, setRepresentativeName] = useState("");
  const [representativeTitle, setRepresentativeTitle] = useState("");
  const [checkboxes, setCheckboxes] = useState(INITIAL_CHECKBOXES);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const allChecked = Object.values(checkboxes).every(Boolean);
  const canSubmit = allChecked && representativeName.trim().length > 0 && representativeTitle.trim().length > 0 && !submitting;

  function toggleCheckbox(key) {
    setCheckboxes((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorMessage("");

    const result = await acceptWholesaleLegalTerms({
      legalDocumentId,
      representativeName: representativeName.trim(),
      representativeTitle: representativeTitle.trim(),
      checkboxes,
      locale: language,
    });

    if (!result.ok) {
      setSubmitting(false);
      if (result.error === "all_boxes_required") {
        setErrorMessage(t("legalAccept.errorAllBoxes"));
      } else if (result.error === "document_superseded") {
        setErrorMessage(t("legalAccept.errorSuperseded"));
      } else {
        setErrorMessage(result.message || t("legalAccept.errorGeneric"));
      }
      return;
    }

    // Submitting stays true (no reset to false) on success — the parent
    // unmounts this modal and re-fetches the catalog immediately, so there
    // is no intermediate "form re-enabled" flash before that happens.
    onAccepted();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.55)] p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wsl-accept-heading"
        className="flex max-h-[92vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-2xl bg-torays-surface p-6 shadow-xl"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck size={20} className="text-torays-navy" aria-hidden="true" />
          <h1 id="wsl-accept-heading" className="font-heading text-xl font-bold text-torays-text">
            {t("legalAccept.heading")}
          </h1>
        </div>
        <p className="text-sm text-torays-text-secondary">{t("legalAccept.subheading")}</p>

        <div className="rounded-lg border border-torays-line p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-torays-text-muted">
            {t("legalAccept.readDocuments")}
          </p>
          <ul className="flex flex-col gap-1.5">
            {DOC_KEYS.map((key) => (
              <li key={key} className="flex items-center justify-between gap-3 text-sm text-torays-text-secondary">
                <span>{t("legal.docNames")[key]}</span>
                <a
                  href={`/wholesale/legal#${key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 font-semibold text-torays-navy underline decoration-torays-line hover:text-torays-red"
                >
                  {t("legalAccept.readLink")}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex flex-1 flex-col gap-1 text-sm text-torays-text">
              {t("legalAccept.nameLabel")}
              <input
                type="text"
                required
                value={representativeName}
                onChange={(e) => setRepresentativeName(e.target.value)}
                maxLength={200}
                className="min-h-11 rounded-md border border-torays-line bg-torays-bg px-3 py-2 text-sm text-torays-text outline-none focus:border-torays-navy"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm text-torays-text">
              {t("legalAccept.titleLabel")}
              <input
                type="text"
                required
                value={representativeTitle}
                onChange={(e) => setRepresentativeTitle(e.target.value)}
                maxLength={200}
                className="min-h-11 rounded-md border border-torays-line bg-torays-bg px-3 py-2 text-sm text-torays-text outline-none focus:border-torays-navy"
              />
            </label>
          </div>

          <div className="flex flex-col gap-2.5">
            {CHECKBOXES.map((cb) => (
              <label key={cb.key} className="flex min-h-11 items-start gap-2.5 text-sm text-torays-text-secondary">
                <input
                  type="checkbox"
                  checked={checkboxes[cb.key]}
                  onChange={() => toggleCheckbox(cb.key)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-torays-navy"
                />
                <span>{t(cb.labelKey)}</span>
              </label>
            ))}
          </div>

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
              {t("legalAccept.logout")}
            </button>
            <button type="submit" disabled={!canSubmit} className="wsp-btn wsp-btn-primary disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? t("legalAccept.accepting") : t("legalAccept.accept")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
