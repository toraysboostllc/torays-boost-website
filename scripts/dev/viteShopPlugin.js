/**
 * Vite plugin, `vite dev` ONLY (apply: "serve" — never part of `vite build`
 * or of anything Vercel deploys). Serves /api/shop from the real handler
 * with the local dev backend (scripts/dev/shopDev.js), plus the in-memory
 * photo bucket at /__shop_dev/*. PGlite only boots on the first request,
 * so `npm run dev` for the rest of the site pays nothing for it.
 */
export function shopDevPlugin() {
  let shopPromise = null;
  const getShop = () => {
    shopPromise = shopPromise || import("./shopDev.js").then((m) => m.createDevShop());
    return shopPromise;
  };

  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    });
  }

  function vercelRes(res) {
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (obj) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(obj));
    };
    res.send = (text) => res.end(text);
    return res;
  }

  return {
    name: "torays-shop-dev-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, "http://localhost");
        try {
          if (url.pathname === "/api/shop") {
            const { handler } = await getShop();
            const raw = req.method === "POST" ? (await readBody(req)).toString("utf8") : "";
            req.query = Object.fromEntries(url.searchParams);
            req.body = raw ? JSON.parse(raw) : {};
            await handler(req, vercelRes(res));
            return;
          }
          if (url.pathname.startsWith("/__shop_dev/upload/") && req.method === "PUT") {
            const { store } = await getShop();
            const path = url.pathname.slice("/__shop_dev/upload/".length);
            store.files.set(path, { type: req.headers["content-type"] || "application/octet-stream", body: await readBody(req) });
            vercelRes(res).status(200).json({ Key: path });
            return;
          }
          // Local-only "outbox": every email the store WOULD have sent, rendered
          // exactly as the customer would see it. Nothing is really sent.
          if (url.pathname === "/__shop_dev/outbox") {
            const { mailer } = await getShop();
            const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
            const items = [...mailer.sent]
              .reverse()
              .map(
                (m, i) => `<section style="margin:0 0 28px"><p style="font:14px system-ui;margin:0 0 6px"><b>#${mailer.sent.length - i}</b> · Para: ${esc(m.to)} · Asunto: <b>${esc(m.subject)}</b></p>
<iframe style="width:100%;max-width:640px;height:560px;border:1px solid #ccd;border-radius:10px;background:#fff" srcdoc="${esc(m.html)}"></iframe></section>`
              )
              .join("");
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(`<!doctype html><meta charset="utf-8"><title>Correos simulados</title><body style="margin:0;padding:20px;background:#EDF1F9">
<p style="font:600 14px system-ui;background:#fff3cd;border:1px dashed #b58a00;padding:10px 12px;border-radius:10px;max-width:640px">SIMULADO — desarrollo local. Estos correos NO se enviaron a nadie. Con Resend conectado se envían de verdad.</p>
${items || '<p style="font:14px system-ui">Todavía no hay correos.</p>'}</body>`);
            return;
          }
          if (url.pathname.startsWith("/__shop_dev/img/")) {
            const { store } = await getShop();
            const file = store.files.get(url.pathname.slice("/__shop_dev/img/".length));
            if (!file) {
              res.statusCode = 404;
              res.end();
              return;
            }
            res.setHeader("Content-Type", file.type);
            res.end(file.body);
            return;
          }
        } catch (err) {
          console.error("[shop dev]", err);
          vercelRes(res).status(500).json({ error: "dev_server_error" });
          return;
        }
        next();
      });
    },
  };
}
