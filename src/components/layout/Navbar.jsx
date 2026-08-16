import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Logo } from "../ui/Logo.jsx";
import { WholesalePortalLink } from "./WholesalePortalLink.jsx";
import { WhatsAppCta } from "./WhatsAppCta.jsx";
import { LanguageSwitcher } from "./LanguageSwitcher.jsx";
import { useLanguage } from "../../i18n/LanguageContext.jsx";

const LINK_HREFS = ["#services", "#about", "#how-it-works", "#faq", "#contact"];
const LINK_KEYS = ["nav.services", "nav.about", "nav.howItWorks", "nav.faq", "nav.contact"];

export function Navbar() {
  const { t } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const links = LINK_HREFS.map((href, i) => ({ href, label: t(LINK_KEYS[i]) }));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled ? "bg-torays-bg/90 backdrop-blur border-b border-torays-line" : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 sm:px-8">
        <a href="#top" aria-label={t("nav.home")}>
          <Logo size="lg" />
        </a>

        <div className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-torays-text-secondary transition-colors hover:text-torays-text"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <LanguageSwitcher variant="header" />
          <WholesalePortalLink variant="header" />
          <WhatsAppCta variant="header" />
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="md:hidden text-torays-text"
          aria-label={t("nav.openMenu")}
        >
          <Menu size={26} />
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-torays-bg md:hidden"
          >
            <div className="flex items-center justify-between px-5 py-4">
              <Logo size="lg" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-torays-text"
                aria-label={t("nav.closeMenu")}
              >
                <X size={26} />
              </button>
            </div>
            <div className="flex flex-col gap-6 px-8 py-10">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="text-2xl font-heading font-medium text-torays-text"
                >
                  {link.label}
                </a>
              ))}
              <LanguageSwitcher variant="mobile" className="mt-2" />
              <WholesalePortalLink variant="mobile" onClick={() => setOpen(false)} />
              <WhatsAppCta variant="mobile" onClick={() => setOpen(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
