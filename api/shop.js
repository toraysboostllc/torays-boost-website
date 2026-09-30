/**
 * Vercel Function — the online store (/tienda) API. All logic lives in
 * api/_lib/shop/handler.js; this file only wires production dependencies
 * from environment variables (see .env.example, "Tienda" section).
 *
 * Nothing here can take real money by accident:
 *  - PayPal is SANDBOX unless PAYPAL_ENV=live AND SHOP_LIVE_PAYMENTS_APPROVED=yes.
 *  - Shipping prices are the ones the owner sets in the panel; labels are
 *    bought by hand in Pirate Ship (no carrier API is connected).
 * A missing/invalid piece of config disables only what depends on it
 * (checkout says "not available yet"); the catalog keeps working.
 */
import { createShopHandler } from "./_lib/shop/handler.js";
import { createRestStore, normalizeSupabaseUrl, supabasePasswordAuth } from "./_lib/shop/restStore.js";
import { createPaypalClient, resolvePaypalEnv } from "./_lib/shop/paypal.js";
import { createResendMailer, createOutboxMailer } from "./_lib/shop/mailer.js";

let handler = null;

function build() {
  const e = process.env;
  const url = normalizeSupabaseUrl(e.SUPABASE_URL);
  const serviceKey = e.SUPABASE_SECRET_KEY || e.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  let mode = "sandbox";
  let paypal = null;
  let paypalError = null;
  try {
    mode = resolvePaypalEnv(e);
    if (e.PAYPAL_CLIENT_ID && e.PAYPAL_CLIENT_SECRET) {
      paypal = createPaypalClient({
        mode,
        clientId: e.PAYPAL_CLIENT_ID,
        clientSecret: e.PAYPAL_CLIENT_SECRET,
        webhookId: e.PAYPAL_WEBHOOK_ID || null,
      });
    } else {
      paypalError = "paypal_keys_missing";
    }
  } catch (err) {
    paypalError = err.message; // "live_not_approved"
  }

  return createShopHandler({
    store: createRestStore({ url, serviceKey }),
    config: {
      environment: mode,
      paypal,
      paypalError,
      webhookConfigured: !!e.PAYPAL_WEBHOOK_ID,
      // Without Resend configured, emails are only recorded (panel shows "not sent").
      mailer: e.RESEND_API_KEY && e.SHOP_EMAIL_FROM
        ? createResendMailer({ apiKey: e.RESEND_API_KEY, from: e.SHOP_EMAIL_FROM, replyTo: e.SHOP_EMAIL_REPLY_TO || null })
        : createOutboxMailer(),
      origin: (e.SHOP_PUBLIC_ORIGIN || "https://www.toraysboost.com").replace(/\/+$/, ""),
      adminEmails: String(e.SHOP_ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
      // Sign-in uses the public (anon/publishable) key when provided — the
      // same kind of key DESK signs in with; falls back to the secret key.
      authenticate: (email, password) =>
        supabasePasswordAuth({ url, serviceKey: e.SUPABASE_PUBLISHABLE_KEY || e.SUPABASE_ANON_KEY || serviceKey }, email, password),
      secureCookies: true,
    },
  });
}

export default async function shop(req, res) {
  handler = handler || build();
  if (!handler) {
    res.setHeader("Cache-Control", "private, no-store");
    res.status(500).json({ error: "not_configured" });
    return;
  }
  return handler(req, res);
}
