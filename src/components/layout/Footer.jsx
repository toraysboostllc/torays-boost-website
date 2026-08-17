import { Link } from "react-router-dom";
import { Instagram, Facebook } from "lucide-react";
import { Logo } from "../ui/Logo.jsx";
import { siteConfig } from "../../config/site.config.js";
import { useLanguage } from "../../i18n/LanguageContext.jsx";

const LINK_HREFS = ["#services", "#about", "#how-it-works", "#faq", "#contact"];
const LINK_KEYS = ["nav.services", "nav.about", "nav.howItWorks", "nav.faq", "nav.contact"];

// Descriptive-text internal links to the local SEO landing pages — kept
// as a small, separate footer column rather than folded into LINK_HREFS
// (those are same-page anchors; these are real routes). Ordered by device
// family (phones, then consoles) so related pages sit next to each other.
const LOCAL_PAGE_PATHS = [
  "/phone-repair-miami",
  "/iphone-repair-miami",
  "/ipad-repair-miami",
  "/ps5-repair-miami",
  "/ps5-controller-repair-miami",
  "/xbox-repair-miami",
];
const LOCAL_PAGE_LABEL_KEYS = [
  "footer.localPages.phoneRepair",
  "footer.localPages.iphoneRepair",
  "footer.localPages.ipadRepair",
  "footer.localPages.ps5Repair",
  "footer.localPages.ps5ControllerRepair",
  "footer.localPages.xboxRepair",
];

export function Footer() {
  const { t } = useLanguage();
  const year = new Date().getFullYear();
  const links = LINK_HREFS.map((href, i) => ({ href, label: t(LINK_KEYS[i]) }));
  const localPageLinks = LOCAL_PAGE_PATHS.map((path, i) => ({ path, label: t(LOCAL_PAGE_LABEL_KEYS[i]) }));

  return (
    <footer className="border-t border-torays-line bg-torays-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 sm:px-8">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row">
          <div className="flex flex-col gap-3">
            <Logo />
            <p className="max-w-xs text-sm text-torays-text-secondary">{t("footer.tagline")}</p>
          </div>

          <div className="flex flex-wrap gap-x-10 gap-y-3">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-torays-text-secondary transition-colors hover:text-torays-text"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-heading font-semibold uppercase tracking-wide text-torays-text-muted">
              {t("footer.localPages.heading")}
            </span>
            {localPageLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="text-sm text-torays-text-secondary transition-colors hover:text-torays-text"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {(siteConfig.social.instagram || siteConfig.social.facebook) && (
            <div className="flex gap-4">
              {siteConfig.social.instagram && (
                <a href={siteConfig.social.instagram} target="_blank" rel="noreferrer" aria-label="Instagram">
                  <Instagram size={20} className="text-torays-text-secondary hover:text-torays-red" />
                </a>
              )}
              {siteConfig.social.facebook && (
                <a href={siteConfig.social.facebook} target="_blank" rel="noreferrer" aria-label="Facebook">
                  <Facebook size={20} className="text-torays-text-secondary hover:text-torays-red" />
                </a>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse items-start justify-between gap-4 border-t border-torays-line pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-torays-text-muted">
            © {year} {siteConfig.businessName}. {t("footer.allRightsReserved")}
          </p>
          <div className="flex items-center gap-x-5 gap-y-3 flex-wrap">
            <Link
              to="/privacy"
              className="relative text-xs text-torays-text-muted transition-colors before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] hover:text-torays-text"
            >
              {t("footer.privacyPolicy")}
            </Link>
            <Link
              to="/terms"
              className="relative text-xs text-torays-text-muted transition-colors before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] hover:text-torays-text"
            >
              {t("footer.termsConditions")}
            </Link>
            <Link
              to="/image-credits"
              className="relative text-xs text-torays-text-muted transition-colors before:absolute before:-inset-y-2 before:inset-x-0 before:content-[''] hover:text-torays-text"
            >
              {t("footer.imageCredits")}
            </Link>
            <p className="text-xs text-torays-text-muted">{siteConfig.domain}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
