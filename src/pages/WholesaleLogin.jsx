import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
import { Logo } from "../components/ui/Logo.jsx";
import { Card } from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";
import { useSEO } from "../lib/seo.js";
import { wholesaleLogin } from "../lib/wholesaleAuth.js";
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
  const [status, setStatus] = useState("idle"); // idle | loading | pending | error
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    const result = await wholesaleLogin(shopName.trim(), code.trim());

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

      <Card className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <LockKeyhole size={18} className="text-torays-navy" />
          <h1 className="font-heading text-lg font-semibold text-torays-text">{t("login.title")}</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-heading font-semibold uppercase tracking-wide text-torays-text-secondary">
              {t("login.shopName")}
            </span>
            <input
              required
              type="text"
              autoComplete="off"
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
              autoComplete="off"
              maxLength={128}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="rounded-xl border border-torays-line bg-torays-surface-alt px-4 py-3 text-torays-text focus:outline-none focus:ring-2 focus:ring-torays-red/50"
            />
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
    </div>
  );
}
