import { useState } from "react";
import { MessageCircle, Music2, Youtube, Instagram, Globe, Share2, Check } from "lucide-react";
import { siteConfig } from "../config/site.config.js";
import { buildWhatsAppLink } from "../lib/whatsapp.js";
import { useSEO } from "../lib/seo.js";
import { Logo } from "../components/ui/Logo.jsx";

/**
 * "Link in bio" page for the NFC keychains and social profiles — one short,
 * own-domain URL (toraysboost.com/links) instead of a paid third-party
 * link page. WhatsApp goes first, same as every other CTA on the site.
 */
export const LINKS = [
  { id: "whatsapp", label: "WhatsApp — Get a repair quote", href: buildWhatsAppLink(), Icon: MessageCircle, primary: true },
  { id: "tiktok", label: "TikTok", href: siteConfig.social.tiktok, Icon: Music2 },
  { id: "youtube", label: "YouTube", href: siteConfig.social.youtube, Icon: Youtube },
  { id: "instagram", label: "Instagram", href: siteConfig.social.instagram, Icon: Instagram },
  { id: "website", label: "Website — toraysboost.com", href: siteConfig.url, Icon: Globe },
].filter((l) => l.href);

/** The page always shares its own public URL, never the address bar (which may carry NFC/query noise). */
export const SHARE_URL = `${siteConfig.url}/links`;

/**
 * Native share sheet on phones (WhatsApp, Instagram, SMS…); on desktops
 * without it, copy the link instead. Returns "shared", "copied" or "cancelled".
 */
export async function shareLinksPage(nav = typeof navigator !== "undefined" ? navigator : undefined) {
  const data = { title: siteConfig.shortName, text: `${siteConfig.shortName} — repairs & socials`, url: SHARE_URL };
  if (nav?.share) {
    try {
      await nav.share(data);
      return "shared";
    } catch (err) {
      if (err?.name === "AbortError") return "cancelled";
    }
  }
  if (nav?.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(SHARE_URL);
      return "copied";
    } catch {
      /* nothing else to try */
    }
  }
  return "cancelled";
}

export function Links() {
  const [copied, setCopied] = useState(false);
  const onShare = async () => {
    if ((await shareLinksPage()) === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  useSEO({
    title: "Links",
    description: "Torays Boost — WhatsApp, TikTok, YouTube, Instagram and website. Microsoldering & electronics repair in Miami, FL.",
    path: "/links",
  });

  return (
    <main className="flex min-h-screen justify-center bg-torays-bg px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <Logo size="lg" />
          <h1 className="mt-4 font-heading text-2xl font-bold text-torays-navy">{siteConfig.shortName}</h1>
          <p className="mt-1 text-sm text-torays-text-secondary">
            Microsoldering &amp; electronics repair — PS5, Xbox, iPhone, iPad, MacBook
          </p>
          <p className="mt-0.5 text-xs text-torays-text-muted">{siteConfig.address.line1} · Ships nationwide</p>
        </div>

        <ul className="mt-8 flex flex-col gap-3">
          {LINKS.map(({ id, label, href, Icon, primary }) => (
            <li key={id}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                data-link={id}
                className={
                  primary
                    ? "flex items-center gap-3 rounded-2xl bg-quote-wa px-5 py-4 font-semibold text-white shadow-sm transition hover:bg-quote-wa-hover"
                    : "flex items-center gap-3 rounded-2xl border border-torays-line bg-torays-surface px-5 py-4 font-semibold text-torays-navy shadow-sm transition hover:border-torays-navy/30 hover:shadow-glow-navy"
                }
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="flex-1 text-center">{label}</span>
                <span className="h-5 w-5 shrink-0" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onShare}
          data-share
          className="mx-auto mt-6 flex items-center gap-2 rounded-full border border-torays-line bg-torays-surface px-5 py-2.5 text-sm font-semibold text-torays-navy shadow-sm transition hover:border-torays-navy/30 hover:shadow-glow-navy"
        >
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Share2 className="h-4 w-4" aria-hidden="true" />}
          <span aria-live="polite">{copied ? "Link copied" : "Share this page"}</span>
        </button>

        <p className="mt-10 text-center text-xs text-torays-text-muted">© {siteConfig.businessName}</p>
      </div>
    </main>
  );
}
