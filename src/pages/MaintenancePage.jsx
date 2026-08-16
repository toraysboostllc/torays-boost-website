import { MessageCircle } from "lucide-react";
import { Logo } from "../components/ui/Logo.jsx";
import { Button } from "../components/ui/Button.jsx";
import { CircuitBackground } from "../components/ui/CircuitBackground.jsx";
import { useSEO } from "../lib/seo.js";
import { buildContactLink } from "../lib/whatsapp.js";

/**
 * Temporary full-site lock screen — see src/config/maintenance.config.js
 * for the single flag that mounts this instead of the real routes.
 * Renders for every path (App.jsx never reaches <Routes> while the flag
 * is on), so this stays a pure, self-contained page: no router hooks, no
 * Wholesale API calls, no scroll/entrance animation — just the logo,
 * message, and the same WhatsApp link used sitewide.
 */
export function MaintenancePage() {
  useSEO({ title: "Site Maintenance", noindex: true });

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden bg-torays-bg px-5 py-16 text-center">
      <div className="absolute inset-0 bg-torays-gradient" />
      <CircuitBackground opacity={0.6} />

      <Logo size="lg" className="relative" />

      <div className="relative flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-torays-line bg-torays-surface px-6 py-10 shadow-[0_1px_2px_rgba(15,20,36,0.04),0_1px_3px_rgba(15,20,36,0.06)] sm:px-10">
        <h1 className="font-heading text-2xl font-bold text-torays-text sm:text-3xl">
          We’re improving Torays Boost
        </h1>
        <p className="max-w-sm text-torays-text-secondary">
          Our website is currently under maintenance. We’ll be back soon with a better experience.
        </p>
        <Button
          href={buildContactLink()}
          target="_blank"
          rel="noreferrer"
          icon={MessageCircle}
          size="lg"
          className="mt-2 min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-torays-navy/60 focus-visible:ring-offset-2 focus-visible:ring-offset-torays-surface"
        >
          Contact Us on WhatsApp
        </Button>
      </div>
    </div>
  );
}
