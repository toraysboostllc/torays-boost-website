/**
 * Minimal in-memory stand-in for the Supabase REST/RPC/Auth endpoints our
 * wholesale-*.js handlers call, so tests exercise the REAL handler code
 * against a fake network boundary instead of a real database. Only
 * supports the exact query shapes our own `_lib` helpers issue — this is
 * not a general PostgREST reimplementation.
 */
export function createFakeSupabase() {
  const db = {
    wholesale_shops: [],
    wholesale_devices: [],
    wholesale_sessions: [],
    wholesale_access_log: [],
    wholesale_categories: [],
    wholesale_services: [],
    profiles: [],
  };
  const authUsers = {}; // token -> user object, for /auth/v1/user
  let idCounter = 1;
  const nextId = () => `id-${idCounter++}`;

  function parseFilters(searchParams) {
    const filters = [];
    for (const [key, value] of searchParams.entries()) {
      if (key === "select" || key === "order" || key === "limit") continue;
      const dot = value.indexOf(".");
      if (dot === -1) continue;
      filters.push({ key, op: value.slice(0, dot), val: value.slice(dot + 1) });
    }
    return filters;
  }

  function rowMatches(row, filters) {
    return filters.every(({ key, op, val }) => {
      const rowVal = row[key];
      if (op === "eq") return String(rowVal) === val;
      if (op === "is") return val === "null" ? rowVal == null : String(rowVal) === val;
      if (op === "gt") return rowVal != null && new Date(rowVal) > new Date(val);
      if (op === "lt") return rowVal != null && new Date(rowVal) < new Date(val);
      return true;
    });
  }

  function jsonResponse(status, body) {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  }

  /** A response with a genuinely empty body — real PostgREST sends this for
   *  PATCH/DELETE with Prefer: return=minimal (status 204), AND for POST with
   *  Prefer: return=minimal (status 201, NOT 204 — POST always answers 201
   *  Created, minimal only strips the body). `.json()` throws on an empty
   *  body here exactly like a real fetch Response would, so tests exercise
   *  the same "no body to parse" handling rest() has to deal with for real. */
  function emptyResponse(status) {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
      text: async () => "",
    };
  }

  async function fakeFetch(url, options = {}) {
    const u = new URL(url);
    const method = (options.method || "GET").toUpperCase();

    if (u.pathname === "/auth/v1/user") {
      const authHeader = (options.headers && options.headers.Authorization) || "";
      const token = authHeader.replace("Bearer ", "");
      const user = authUsers[token];
      return user ? jsonResponse(200, user) : jsonResponse(401, { message: "invalid_token" });
    }

    const m = u.pathname.match(/^\/rest\/v1\/(rpc\/)?([a-zA-Z_]+)$/);
    if (!m) return jsonResponse(404, {});
    const isRpc = Boolean(m[1]);
    const table = m[2];

    if (isRpc) {
      const body = options.body ? JSON.parse(options.body) : {};
      if (table === "wholesale_regenerate_shop_code") {
        const shop = db.wholesale_shops.find((s) => s.id === body.p_shop_id);
        if (shop) {
          shop.code_hash = body.p_code_hash;
          shop.code_regenerated_at = new Date().toISOString();
          shop.failed_attempts = 0;
          shop.locked_until = null;
        }
        db.wholesale_sessions.forEach((s) => {
          if (s.shop_id === body.p_shop_id && !s.revoked_at) s.revoked_at = new Date().toISOString();
        });
        db.wholesale_devices.forEach((d) => {
          if (d.shop_id === body.p_shop_id && (d.status === "pending" || d.status === "approved")) d.status = "revoked";
        });
        db.wholesale_access_log.push({
          id: nextId(),
          shop_id: body.p_shop_id,
          event: "code_regenerated_full_reset",
          created_at: new Date().toISOString(),
        });
        return jsonResponse(200, null);
      }
      return jsonResponse(404, {});
    }

    if (!db[table]) return jsonResponse(404, {});

    if (method === "GET") {
      const filters = parseFilters(u.searchParams);
      let rows = db[table].filter((r) => rowMatches(r, filters));
      const order = u.searchParams.get("order");
      if (order) {
        const [field, dir] = order.split(".");
        rows = [...rows].sort((a, b) => {
          if (a[field] === b[field]) return 0;
          const cmp = a[field] > b[field] ? 1 : -1;
          return dir === "desc" ? -cmp : cmp;
        });
      }
      const limit = u.searchParams.get("limit");
      if (limit) rows = rows.slice(0, Number(limit));
      return jsonResponse(200, rows);
    }

    if (method === "POST") {
      const body = options.body ? JSON.parse(options.body) : {};
      const row = { id: nextId(), created_at: new Date().toISOString(), ...body };
      db[table].push(row);
      const prefer = (options.headers && options.headers.Prefer) || "";
      // Real PostgREST: an insert is ALWAYS 201 Created, whether or not the
      // caller asked for the representation back — Prefer: return=minimal
      // only removes the body, it never changes the status to 204 (that's
      // PATCH/DELETE's status). Getting this exactly right is the whole point:
      // it's what makes this fake able to catch the rest() bug it's here to
      // guard against, instead of masking it like the old (wrong) 204 did.
      return prefer.includes("minimal") ? emptyResponse(201) : jsonResponse(201, [row]);
    }

    if (method === "PATCH") {
      const filters = parseFilters(u.searchParams);
      const body = options.body ? JSON.parse(options.body) : {};
      db[table].filter((r) => rowMatches(r, filters)).forEach((r) => Object.assign(r, body));
      return jsonResponse(204, null);
    }

    if (method === "DELETE") {
      const filters = parseFilters(u.searchParams);
      db[table] = db[table].filter((r) => !rowMatches(r, filters));
      return jsonResponse(204, null);
    }

    return jsonResponse(405, {});
  }

  return {
    db,
    fakeFetch,
    nextId,
    addAuthUser(token, user) {
      authUsers[token] = user;
    },
  };
}

/** Minimal Vercel-style (req, res) mocks. */
export function mockReq({ method = "GET", body = {}, headers = {}, query = {} } = {}) {
  return { method, body, headers, query };
}

export function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.body = obj;
      return this;
    },
    setHeader(key, value) {
      this.headers[key] = value;
    },
  };
}

/** Pulls a cookie's value out of a Set-Cookie header (string or array). */
export function extractCookie(setCookieHeader, name) {
  const list = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader].filter(Boolean);
  for (const entry of list) {
    const m = entry.match(new RegExp(`^${name}=([^;]*)`));
    if (m) return m[1];
  }
  return null;
}
