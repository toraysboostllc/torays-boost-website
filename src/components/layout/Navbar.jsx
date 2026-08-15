import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Logo } from "../ui/Logo.jsx";
import { Button } from "../ui/Button.jsx";
import { WholesalePortalLink } from "./WholesalePortalLink.jsx";
import { buildContactLink } from "../../lib/whatsapp.js";

const LINKS = [
  { href: "#services", label: "Services" },
  { href: "#about", label: "About" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#faq", label: "FAQ" },
  { href: "#contact", label: "Contact" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

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
        <a href="#top" aria-label="Torays Boost home">
          <Logo size="lg" />
        </a>

        <div className="hidden md:flex items-center gap-8">
          {LINKS.map((link) => (
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
          <WholesalePortalLink variant="header" />
          <Button href={buildContactLink()} target="_blank" rel="noreferrer" size="md">
            WhatsApp
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="md:hidden text-torays-text"
          aria-label="Open menu"
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
                aria-label="Close menu"
              >
                <X size={26} />
              </button>
            </div>
            <div className="flex flex-col gap-6 px-8 py-10">
              {LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="text-2xl font-heading font-medium text-torays-text"
                >
                  {link.label}
                </a>
              ))}
              <WholesalePortalLink variant="mobile" className="mt-2" onClick={() => setOpen(false)} />
              <Button
                href={buildContactLink()}
                target="_blank"
                rel="noreferrer"
                size="lg"
                className="mt-2 w-full"
              >
                WhatsApp
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
