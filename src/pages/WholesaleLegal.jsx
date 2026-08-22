import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Printer } from "lucide-react";
import { Logo } from "../components/ui/Logo.jsx";
import { useSEO } from "../lib/seo.js";
import { fetchWholesaleLegalDocuments, fetchWholesaleEstimateDisclaimer } from "../lib/wholesaleAuth.js";
import { wholesaleHoverProps } from "../lib/wholesaleSound.js";
import { WholesaleLocaleProvider, useWholesaleLocale } from "../i18n/WholesaleLocaleContext.jsx";
import { WholesaleLocaleSelector } from "../components/wholesale/WholesaleLocaleSelector.jsx";

/**
 * Public, no-login legal reference page for the Torays Boost Pro Legal
 * Bundle (6 documents, EN+ES) — Document 6 (Electronic Consent & Records
 * Disclosure), Section 2: "Every document may be printed or downloaded
 * before or after acceptance, at no charge, from the Portal or from the
 * pre-login legal pages." Fetches from /api/wholesale-legal-documents,
 * which requires no session cookie at all (see that file). The clickwrap
 * modal's own "Read" links point here.
 *
 * content_en/content_es shape (set when an admin calls
 * wholesale_publish_legal_document — see supabase/wholesale-legal-
 * migration.sql): one key per document
 * (access_agreement/pricing_policy/pricing_disclaimer/privacy_security/
 * repair_warranty_terms/econsent_disclosure), each value
 * `{ title: string, body: string }` where body is plain text with blank-
 * line paragraph breaks (rendered with white-space: pre-wrap — never
 * dangerouslySetInnerHTML, this is always plain text, never HTML).
 *
 * Uses the WHOLESALE locale context (EN/ES only, separate from the public
 * site's own LanguageProvider — see WholesaleLocaleContext.jsx's header)
 * because this page is entirely about the wholesale portal's own legal
 * terms; WholesaleLocaleSelector is reused exactly as-is, unstyled wrapper
 * around it, per its own header ("paints its own light pill background ...
 * reads clearly on both [themes] without a variant of its own").
 */
const DOC_KEYS = [
  "access_agreement",
  "pricing_policy",
  "pricing_disclaimer",
  "privacy_security",
  "repair_warranty_terms",
  "econsent_disclosure",
];

export function WholesaleLegal() {
  return (
    <WholesaleLocaleProvider>
      <WholesaleLegalContent />
    </WholesaleLocaleProvider>
  );
}

/** Scopes window.print() to a single document section by hiding every
 *  other [data-legal-doc] section for the duration of the print — no PDF
 *  library, just the browser's own print/"save as PDF" (Document 6,
 *  Section 6). Sections are un-hidden on the 'afterprint' event, which
 *  fires whether the shop actually printed or cancelled the dialog, so a
 *  cancelled print never leaves the page in a broken state. */
function printOnly(targetKey) {
  if (typeof document === "undefined") return;
  document.querySelectorAll("[data-legal-doc]").forEach((el) => {
    el.classList.toggle("ws-legal-print-hide", el.getAttribute("data-legal-doc") !== targetKey);
  });
  window.print();
}

function WholesaleLegalContent() {
  const { t, formatDate } = useWholesaleLocale();
  useSEO({ title: "Torays Boost Pro — Legal Documents", noindex: true });

  const [state, setState] = useState({ status: "loading", doc: null, errorMessage: "" });
  // Fetched independently of the master bundle above, and never blocks this
  // page's own loading/error state — the Estimate Disclaimer is a separate,
  // independently-published document (see wholesale-legal-document-types-
  // migration.sql). A shop that hasn't been shown this document yet (none
  // published) simply gets no extra section, not a page-wide error.
  const [estimateDoc, setEstimateDoc] = useState(null);

  function load() {
    setState({ status: "loading", doc: null, errorMessage: "" });
    fetchWholesaleLegalDocuments().then((result) => {
      if (!result.ok) {
        setState({ status: "error", doc: null, errorMessage: result.message });
        return;
      }
      setState({ status: "ready", doc: result, errorMessage: "" });
    });
    fetchWholesaleEstimateDisclaimer().then((result) => {
      setEstimateDoc(result.ok ? result : null);
    });
  }

  useEffect(() => {
    load();
    // 'afterprint' un-hides every section regardless of which one (if any)
    // printOnly() last scoped to — a single global listener covers every
    // per-document print button on this page.
    function unhideAll() {
      document.querySelectorAll(".ws-legal-print-hide").forEach((el) => el.classList.remove("ws-legal-print-hide"));
    }
    window.addEventListener("afterprint", unhideAll);
    return () => window.removeEventListener("afterprint", unhideAll);
  }, []);

  return (
    <div className="min-h-screen bg-torays-bg print:bg-white">
      <header className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 pt-8 sm:px-8 print:hidden">
        <Link to="/wholesale" aria-label="Torays Boost">
          <Logo size="sm" />
        </Link>
        <WholesaleLocaleSelector />
      </header>

      <main className="pt-8 pb-24">
        <div className="mx-auto flex max-w-3xl flex-col gap-8 px-5 sm:px-8">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-heading font-semibold uppercase tracking-[0.2em] text-torays-red">
              Torays Boost Pro
            </span>
            <h1 className="font-heading text-3xl font-bold text-torays-text sm:text-4xl">{t("legal.pageTitle")}</h1>
            <p className="text-sm text-torays-text-secondary sm:text-base">{t("legal.pageSubtitle")}</p>
          </div>

          {/* Internal-draft notice — stays visible on every published
              version until an admin publishes a version that is no longer
              a draft. Reuses only existing theme tokens (torays-red border
              accent, torays-surface-alt background) — no new colors. */}
          <div className="rounded-lg border-l-4 border-torays-red bg-torays-surface-alt px-4 py-3 text-sm text-torays-text-secondary">
            {t("legal.draftBanner")}
          </div>

          {state.status === "loading" && <p className="text-sm text-torays-text-secondary">{t("legal.loading")}</p>}

          {state.status === "error" && (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-torays-text-secondary">{state.errorMessage || t("legal.errorLoading")}</p>
              <button
                type="button"
                {...wholesaleHoverProps(load)}
                className="rounded-md border border-torays-line px-4 py-2 text-sm font-semibold text-torays-navy hover:text-torays-red"
              >
                {t("legal.retry")}
              </button>
            </div>
          )}

          {state.status === "ready" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-torays-line pb-4 text-xs text-torays-text-muted print:hidden">
                <span>
                  {t("legal.version")}: {state.doc.version}
                  {state.doc.published_at ? ` — ${t("legal.publishedAt")}: ${formatDate(state.doc.published_at)}` : ""}
                </span>
                <button
                  type="button"
                  {...wholesaleHoverProps(() => window.print())}
                  className="inline-flex items-center gap-2 rounded-md border border-torays-line px-3 py-1.5 font-semibold text-torays-navy hover:text-torays-red"
                >
                  <Printer size={14} aria-hidden="true" />
                  {t("legal.printAll")}
                </button>
              </div>

              <div className="flex flex-col gap-10">
                {DOC_KEYS.map((key) => {
                  const en = state.doc.content_en?.[key];
                  const es = state.doc.content_es?.[key];
                  const active = t("legal.docNames")[key] || key;
                  return (
                    <LegalDocSection
                      key={key}
                      docKey={key}
                      fallbackTitle={active}
                      contentEn={en}
                      contentEs={es}
                      onPrint={() => printOnly(key)}
                    />
                  );
                })}
                {/* Estimate Disclaimer — a separate, independently-published
                    document (see wholesale-legal-document-types-migration.sql),
                    not one of the 6 sections above. Its content_en/content_es
                    are genuinely {body: "..."} objects (unlike the master
                    bundle's plain-string sections above), so LegalDocSection's
                    existing doc?.body read works correctly here without
                    modification. Renders nothing at all when nothing has been
                    published for this type yet — never an empty section. */}
                {estimateDoc && (
                  <LegalDocSection
                    docKey="estimate_disclaimer"
                    fallbackTitle={t("legal.estimateDisclaimerTitle")}
                    contentEn={estimateDoc.content_en}
                    contentEs={estimateDoc.content_es}
                    onPrint={() => printOnly("estimate_disclaimer")}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function LegalDocSection({ docKey, fallbackTitle, contentEn, contentEs, onPrint }) {
  const { t, language } = useWholesaleLocale();
  const doc = language === "es" ? contentEs : contentEn;
  const title = doc?.title || fallbackTitle;
  const body = typeof doc?.body === "string" ? doc.body : "";

  return (
    <section id={docKey} data-legal-doc={docKey} className="scroll-mt-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-xl font-semibold text-torays-text sm:text-2xl">{title}</h2>
        <button
          type="button"
          {...wholesaleHoverProps(onPrint)}
          className="inline-flex items-center gap-2 rounded-md border border-torays-line px-3 py-1 text-xs font-semibold text-torays-navy hover:text-torays-red print:hidden"
        >
          <Printer size={13} aria-hidden="true" />
          {t("legal.printOne")}
        </button>
      </div>
      {body ? (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-torays-text-secondary sm:text-base">{body}</p>
      ) : (
        <p className="mt-3 text-sm text-torays-text-muted">{t("legal.notPublishedYet")}</p>
      )}
    </section>
  );
}
