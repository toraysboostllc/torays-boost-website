import { Link } from "react-router-dom";
import { ShoppingCart, ImageOff, ShieldCheck, UserRound } from "lucide-react";
import { Logo } from "../ui/Logo.jsx";
import { LanguageSwitcher } from "../layout/LanguageSwitcher.jsx";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import { siteConfig } from "../../config/site.config.js";
import { useCart } from "../../lib/shopCart.js";

export const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-torays-navy/50 focus-visible:ring-offset-2 focus-visible:ring-offset-torays-bg";

export const BTN = {
  primary: `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-torays-red px-5 py-2.5 font-heading font-semibold text-white transition-colors hover:bg-torays-red-dark disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`,
  dark: `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-torays-navy px-5 py-2.5 font-heading font-semibold text-white transition-colors hover:bg-torays-navy-dark disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`,
  ghost: `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-torays-line bg-torays-surface px-5 py-2.5 font-heading font-medium text-torays-text transition-colors hover:border-torays-navy/40 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`,
};

export const INPUT = `min-h-11 w-full rounded-xl border border-torays-line bg-torays-surface px-3 py-2.5 text-sm text-torays-text placeholder:text-torays-text-muted ${FOCUS}`;
export const PANEL = "rounded-2xl border border-torays-line bg-torays-surface p-4 md:p-5";

/** Photo or a neutral placeholder — never a broken <img>. */
export function ProductImage({ src, alt, className = "", iconSize = 32 }) {
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-torays-surface-alt text-torays-text-muted ${className}`} aria-hidden="true">
        <ImageOff size={iconSize} />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" className={`object-cover ${className}`} />;
}

export function StockLabel({ stock, className = "" }) {
  const { t } = useLanguage();
  if (stock <= 0) return <span className={`text-xs font-medium text-torays-text-muted ${className}`}>{t("shop.soldOut")}</span>;
  if (stock <= 3) return <span className={`text-xs font-semibold text-torays-red-dark ${className}`}>{stock === 1 ? t("shop.lastOne") : t("shop.onlyLeft", { n: stock })}</span>;
  return <span className={`text-xs font-medium text-quote-wa ${className}`}>● {t("shop.inStock")}</span>;
}

export function ShopHeader({ admin = false }) {
  const { t } = useLanguage();
  const { count } = useCart();
  return (
    <header className="sticky top-0 z-40 border-b border-torays-line bg-torays-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 md:px-8">
        <Link to="/" aria-label={t("nav.home")} className={`shrink-0 rounded-lg ${FOCUS}`}>
          <Logo size="sm" />
        </Link>
        <Link
          to={admin ? "/tienda/admin" : "/tienda"}
          className={`truncate rounded-lg font-heading text-base font-semibold text-torays-navy md:text-lg ${FOCUS}`}
        >
          {admin ? t("shop.admin.title") : t("shop.title")}
        </Link>
        <div className="ml-auto flex items-center gap-1 md:gap-3">
          <LanguageSwitcher variant="header" className="hidden sm:inline-flex" />
          {!admin && (
            <Link
              to="/tienda/cuenta"
              aria-label={t("shop.account.title")}
              className={`flex h-11 w-11 items-center justify-center rounded-xl border border-torays-line bg-torays-surface text-torays-text ${FOCUS}`}
            >
              <UserRound size={20} />
            </Link>
          )}
          {!admin && (
            <Link
              to="/tienda/checkout"
              aria-label={`${t("shop.cart")} (${count})`}
              className={`relative flex h-11 w-11 items-center justify-center rounded-xl border border-torays-line bg-torays-surface text-torays-text ${FOCUS}`}
            >
              <ShoppingCart size={20} />
              {count > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-torays-red px-1 text-[11px] font-bold text-white">
                  {count}
                </span>
              )}
            </Link>
          )}
        </div>
      </div>
      <div className="flex justify-center border-t border-torays-line py-1 sm:hidden">
        <LanguageSwitcher variant="header" />
      </div>
    </header>
  );
}

export function ShopFooter() {
  return (
    <footer className="mt-12 border-t border-torays-line bg-torays-surface">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-6 text-center text-xs text-torays-text-muted md:flex-row md:justify-between md:px-8">
        <span>
          © {new Date().getFullYear()} {siteConfig.businessName} · Miami, FL
        </span>
        <span className="flex items-center gap-4">
          <Link to="/privacy" className="hover:text-torays-text">Privacy</Link>
          <Link to="/terms" className="hover:text-torays-text">Terms</Link>
          <span className="inline-flex items-center gap-1">
            <ShieldCheck size={14} /> PayPal
          </span>
        </span>
      </div>
    </footer>
  );
}

export function ShopShell({ children, admin = false }) {
  return (
    <div className="min-h-screen bg-torays-bg">
      <ShopHeader admin={admin} />
      <main className="mx-auto max-w-6xl px-4 pb-10 pt-5 md:px-8 md:pt-8">{children}</main>
      <ShopFooter />
    </div>
  );
}
