import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
import { Logo } from "../components/ui/Logo.jsx";
import { Card } from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";
import { useSEO } from "../lib/seo.js";
import { wholesaleLogin } from "../lib/wholesaleAuth.js";
import loginCollageBg from "../assets/wholesale-login-collage.webp";

/**
 * Not linked from the public Navbar/Footer on purpose — shop partners get
 * this URL directly from Torays Boost, the same way they get their code.
 */
export function WholesaleLogin() {
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
      <div className="rounded-2xl bg-white/90 p-3 shadow-[0_4px_16px_rgba(8,14,30,0.25)] backdrop-blur-sm">
        <Logo size="lg" />
      </div>

      <Card className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <LockKeyhole size={18} className="text-torays-navy" />
          <h1 className="font-heading text-lg font-semibold text-torays-text">Shop Login</h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-heading font-semibold uppercase tracking-wide text-torays-text-secondary">
              Shop Name
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
              Access Code
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
            <p className="text-sm text-torays-navy">
              {message || "This device needs approval. We'll let you know once it's approved."}
            </p>
          )}

          <Button type="submit" disabled={status === "loading"} className="mt-1 w-full justify-center">
            {status === "loading" ? "Checking…" : "Log In"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
