import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
import { Logo } from "../components/ui/Logo.jsx";
import { Card } from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";
import { useSEO } from "../lib/seo.js";
import { wholesaleLogin, fetchWholesaleCatalog } from "../lib/wholesaleAuth.js";
import { normalizeShopCode } from "../lib/wholesaleCode.js";
import { WholesaleLocaleProvider, useWholesaleLocale } from "../i18n/WholesaleLocaleContext.jsx";
import { WholesaleLocaleSelector } from "../components/wholesale/WholesaleLocaleSelector.jsx";
import loginCollageBg from "../assets/wholesale-login-collage.webp";

/**
 * Not linked from the public Navbar/Footer on purpose — shop partners get
 * this URL directly from Torays Boost, the same way they get their code.
 *
 * WholesaleLocaleProvider is mounted HERE, not in App.jsx — this page is
 * already its own lazy-loaded route chunk (see App.jsx), so keeping the
 * provider/translations import inside it (rather than in App.jsx, which is
 * part of the main/eager bundle) means zero added bytes for a visitor who
 * never opens /wholesale. Login/auth logic below (handleSubmit,
 * wholesaleLogin, navigate) is completely unchanged — only the locale
 * selector and copy-through-t() are new.
 */
export function WholesaleLogin() {
  return (
    <WholesaleLocaleProvider>
      <WholesaleLoginContent />
    </WholesaleLocaleProvider>
  );
}

function WholesaleLoginContent() {
  const { t } = useWholesaleLocale();
  useSEO({ title: "Shop Login", noindex: true });
  const navigate = useNavigate();

  const [shopName, setShopName] = useState("");
  const [code, setCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | loading | pending | error
  const [message, setMessage] = useState("");
  // Starts true: a device already trusted via a prior "Keep me signed in"
  // login (see wholesale-login.js/wholesaleDb.js's remembered/silent-refresh
  // mechanism) must never see this form flash before being sent straight to
  // the catalog — see the mount effect below. Every device that turns out
  // NOT to have a valid session flips this to false and the form renders
  // normally, exactly as it always has.
  const [checkingSession, setCheckingSession] = useState(true);

  // Runs once on mount only (never on a timer) so this form never opens
  // pre-filled — belt-and-suspenders alongside the anti-autofill attributes
  // below, in case a browser/password manager injects a value before this
  // component finishes mounting. Same technique already proven against this
  // exact problem on DESK's New Shop form (see that repo's "Harden New Shop
  // form against browser/password-manager autofill" commit) — a text field
  // immediately followed by a password field, inside a <form>, is exactly
  // the shape Chrome's/password managers' login heuristic keys on,
  // regardless of this field's own autoComplete value.
  useEffect(() => {
    setShopName("");
    setCode("");
  }, []);

  // Silent session check — "Al regresar al portal desde ese mismo
  // dispositivo, si la sesión continúa válida, llévalo directamente al
  // catálogo sin mostrar el login." A device's session/approval identity
  // lives entirely in HttpOnly cookies (see wholesaleAuth.js's own header —
  // never readable from here), so the only way to know whether one is still
  // valid is to ask the server; fetchWholesaleCatalog() is the SAME call
  // WholesalePrices.jsx already makes, reused rather than duplicated — this
  // is purely a "should I show the form or skip straight past it" check,
  // the real fetch for the catalog itself still happens once more on
  // /wholesale/prices, same as any direct visit there already works today.
  // `ok` (a fully valid session) and `legal_required` (a valid session that
  // still needs one of the legal gates) both mean "do not show the login
  // form" — WholesalePrices.jsx already knows how to render that gate.
  // `auth`/`transient`/anything else means "no valid session" (or unknown
  // status) and falls through to the ordinary form, exactly as before this
  // check existed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchWholesaleCatalog();
      if (cancelled) return;
      if (result.ok || result.kind === "legal_required") {
        navigate("/wholesale/prices", { replace: true });
        return;
      }
      setCheckingSession(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    const result = await wholesaleLogin(shopName.trim(), normalizeShopCode(code), rememberDevice);

    if (result.ok) {
      navigate("/wholesale/prices");
      return;
    }
    if (result.pending) {
      setStatus("pending");
      setMessage(result.message);
      return;
    }
    setStatus("error");
    setMessage(result.message);
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-8 bg-torays-navy bg-cover bg-center bg-no-repeat px-5 py-16"
      style={{ backgroundImage: `url(${loginCollageBg})` }}
    >
      <WholesaleLocaleSelector />

      <div className="rounded-2xl bg-white/90 p-3 shadow-[0_4px_16px_rgba(8,14,30,0.25)] backdrop-blur-sm">
        <Logo size="lg" />
      </div>

      {checkingSession ? (
        // Neutral holding state only — never the form, never a flash of it,
        // while the silent session check above decides whether this device
        // should be sent straight to /wholesale/prices instead.
        <Card className="w-full max-w-sm">
          <p className="text-center text-sm text-torays-text-secondary">{t("login.checkingSession")}</p>
        </Card>
      ) : (
        <Card className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-2">
            <LockKeyhole size={18} className="text-torays-navy" />
            <h1 className="font-heading text-lg font-semibold text-torays-text">{t("login.title")}</h1>
          </div>

          <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-heading font-semibold uppercase tracking-wide text-torays-text-secondary">
                {t("login.shopName")}
              </span>
              <input
                required
                type="text"
                name="wsPortalShopName"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                maxLength={100}
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="rounded-xl border border-torays-line bg-torays-surface-alt px-4 py-3 text-torays-text focus:outline-none focus:ring-2 focus:ring-torays-red/50"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-heading font-semibold uppercase tracking-wide text-torays-text-secondary">
                {t("login.accessCode")}
              </span>
              <input
                required
                type="password"
                name="wsPortalAccessCode"
                autoComplete="new-password"
                data-lpignore="true"
                data-1p-ignore="true"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                maxLength={128}
                value={code}
                onChange={(e) => setCode(normalizeShopCode(e.target.value))}
                className="rounded-xl border border-torays-line bg-torays-surface-alt px-4 py-3 text-torays-text focus:outline-none focus:ring-2 focus:ring-torays-red/50"
              />
            </label>

            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                name="wsPortalRememberDevice"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-torays-line text-torays-red focus:outline-none focus:ring-2 focus:ring-torays-red/50"
              />
              <span className="text-sm text-torays-text">
                {t("login.rememberMe")}
                <span className="mt-0.5 block text-xs text-torays-text-secondary">{t("login.rememberMeWarning")}</span>
              </span>
            </label>

            {status === "error" && <p className="text-sm text-torays-red">{message}</p>}
            {status === "pending" && (
              <p className="text-sm text-torays-navy">{message || t("login.pendingDefault")}</p>
            )}

            <Button type="submit" disabled={status === "loading"} className="mt-1 w-full justify-center">
              {status === "loading" ? t("login.submitting") : t("login.submit")}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
