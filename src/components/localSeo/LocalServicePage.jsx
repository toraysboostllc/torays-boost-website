import { useState } from "react";
import { useSEO } from "../../lib/seo.js";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import { useLocalSeoText } from "../../i18n/useLocalSeoText.js";
import { Navbar } from "../layout/Navbar.jsx";
import { Footer } from "../layout/Footer.jsx";
import { WhatsAppFloatButton } from "../layout/WhatsAppFloatButton.jsx";
import { RepairRequestModal } from "../repair/RepairRequestModal.jsx";
import { WhatsAppGateModal } from "../repair/WhatsAppGateModal.jsx";
import { HowItWorks } from "../../sections/HowItWorks.jsx";
import { WhyChooseUs } from "../../sections/WhyChooseUs.jsx";
import { LocalHero } from "./LocalHero.jsx";
import { IconInfoGrid } from "./IconInfoGrid.jsx";
import { EstimateExplainer } from "./EstimateExplainer.jsx";
import { ServiceArea } from "./ServiceArea.jsx";
import { LocalFAQ } from "./LocalFAQ.jsx";
import { RelatedServices } from "./RelatedServices.jsx";
import { LocalFinalCTA } from "./LocalFinalCTA.jsx";
import { getLocalSeoPage } from "../../config/localSeo.config.js";
import { buildLocalBusinessJsonLd, buildBreadcrumbJsonLd } from "../../lib/jsonLd.js";

/**
 * Shared shell for the 3 local SEO landing pages (Phone / PS5 / PS5
 * Controller repair in Miami) — one layout, one wizard, one set of
 * section components; only the copy (read via `${tPrefix}.*` keys, from
 * useLocalSeoText — a separate lazy-loaded dictionary, see that file's
 * header comment) and the structural data in localSeo.config.js differ per
 * page. `t` (the main site's useLanguage()) is only used here for the one
 * shared "Home" breadcrumb label — everything else reads through `tLocal`.
 *
 * The wizard modal here is the exact same RepairRequestModal Home uses —
 * `initialSelection` just pre-fills its Device/Problem answers (see
 * useRepairRequest.js), it doesn't fork the component. Every open is a
 * fresh mount (conditional render below), so nothing carries over between
 * repair requests, on this page or Home's.
 */
export function LocalServicePage({ pageKey, tPrefix }) {
  const { t } = useLanguage();
  const { t: tLocal } = useLocalSeoText();
  const page = getLocalSeoPage(pageKey);
  const [repairRequestOpen, setRepairRequestOpen] = useState(false);
  const [whatsappGateOpen, setWhatsappGateOpen] = useState(false);

  const breadcrumbItems = [
    { name: tLocal("localSeo.breadcrumbHome"), path: "/" },
    { name: tLocal(`${tPrefix}.breadcrumbLabel`), path: page.path },
  ];

  useSEO({
    title: tLocal(`${tPrefix}.seo.title`),
    description: tLocal(`${tPrefix}.seo.description`),
    path: page.path,
    jsonLd: [buildLocalBusinessJsonLd(), buildBreadcrumbJsonLd(breadcrumbItems)],
  });

  function openWhatsAppGate() {
    setWhatsappGateOpen(true);
  }

  function startRepairRequestFromGate() {
    setWhatsappGateOpen(false);
    setRepairRequestOpen(true);
  }

  return (
    <>
      <Navbar onWhatsAppClick={openWhatsAppGate} />
      <main>
        <LocalHero
          eyebrow={tLocal(`${tPrefix}.hero.eyebrow`)}
          h1={tLocal(`${tPrefix}.hero.h1`)}
          summary={tLocal(`${tPrefix}.hero.summary`)}
          ctaLabel={tLocal(`${tPrefix}.hero.ctaLabel`)}
          note={tLocal(`${tPrefix}.hero.note`)}
          onOpenRepairRequest={() => setRepairRequestOpen(true)}
          breadcrumbs={breadcrumbItems}
        />

        <IconInfoGrid
          eyebrow={tLocal(`${tPrefix}.services.eyebrow`)}
          title={tLocal(`${tPrefix}.services.title`)}
          items={page.services.map((s) => ({
            id: s.id,
            icon: s.icon,
            label: tLocal(`${tPrefix}.services.items.${s.id}`),
          }))}
        />

        <IconInfoGrid
          eyebrow={tLocal(`${tPrefix}.issues.eyebrow`)}
          title={tLocal(`${tPrefix}.issues.title`)}
          items={page.issues.map((s) => ({
            id: s.id,
            icon: s.icon,
            label: tLocal(`${tPrefix}.issues.items.${s.id}`),
          }))}
        />

        <HowItWorks />
        <EstimateExplainer />
        <WhyChooseUs />
        <ServiceArea />

        <LocalFAQ
          eyebrow={t("faq.eyebrow")}
          title={tLocal(`${tPrefix}.faq.title`)}
          faqIds={page.faqIds}
          tPrefix={tPrefix}
          t={tLocal}
        />

        <RelatedServices
          relatedKeys={page.related}
          title={tLocal(`${tPrefix}.related.title`)}
          note={page.relatedNoteKey ? tLocal(`${tPrefix}.${page.relatedNoteKey}`) : undefined}
        />

        <LocalFinalCTA
          title={tLocal(`${tPrefix}.finalCta.title`)}
          body={tLocal(`${tPrefix}.finalCta.body`)}
          ctaLabel={tLocal(`${tPrefix}.hero.ctaLabel`)}
          onOpenRepairRequest={() => setRepairRequestOpen(true)}
        />
      </main>
      <Footer />
      <WhatsAppFloatButton onClick={openWhatsAppGate} />
      {repairRequestOpen && (
        <RepairRequestModal onClose={() => setRepairRequestOpen(false)} initialSelection={page.wizardSelection} />
      )}
      {whatsappGateOpen && (
        <WhatsAppGateModal onClose={() => setWhatsappGateOpen(false)} onStart={startRepairRequestFromGate} />
      )}
    </>
  );
}
