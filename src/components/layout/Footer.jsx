import { Instagram, Facebook } from "lucide-react";
import { Logo } from "../ui/Logo.jsx";
import { siteConfig } from "../../config/site.config.js";

const LINKS = [
  { href: "#services", label: "Services" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#faq", label: "FAQ" },
  { href: "#contact", label: "Contact" },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-torays-line bg-torays-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 sm:px-8">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row">
          <div className="flex flex-col gap-3">
            <Logo />
            <p className="max-w-xs text-sm text-torays-text-secondary">
              Professional microsoldering and board-level electronics repair.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-10 gap-y-3">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-torays-text-secondary transition-colors hover:text-torays-text"
              >
                {link.label}
              </a>
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
            © {year} {siteConfig.businessName}. All rights reserved.
          </p>
          <p className="text-xs text-torays-text-muted">{siteConfig.domain}</p>
        </div>
      </div>
    </footer>
  );
}
