/**
 * Vercel Function — revokes the current wholesale session (explicit logout)
 * and clears the ws_session cookie. Leaves ws_device alone — logging out
 * doesn't un-recognize the device, it just ends this session; the shop
 * still needs the code to start a new one.
 */
import { serialize, parse } from "cookie";
import { getEnv, setPrivateHeaders, sha256Hex, revokeSessionByTokenHash, logEvent, clientIp } from "./_lib/wholesaleDb.js";

const SESSION_TOKEN_MAX = 128;

export default async function handler(req, res) {
  setPrivateHeaders(res);

  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed", message: "Method not allowed." });
    return;
  }

  let env;
  try {
    env = getEnv();
  } catch {
    res.status(500).json({ error: "not_configured", message: "Wholesale logout isn't configured on the server yet." });
    return;
  }

  const cookies = parse(req.headers.cookie || "");
  const rawToken = cookies.ws_session || null;
  const token = rawToken && rawToken.length <= SESSION_TOKEN_MAX ? rawToken : null;

  if (token) {
    await revokeSessionByTokenHash(env, sha256Hex(token)).catch(() => {});
    await logEvent(env, { event: "session_revoked", ip: clientIp(req), userAgent: req.headers["user-agent"] || null }).catch(() => {});
  }

  res.setHeader(
    "Set-Cookie",
    serialize("ws_session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    })
  );
  res.status(200).json({ status: "ok" });
}
