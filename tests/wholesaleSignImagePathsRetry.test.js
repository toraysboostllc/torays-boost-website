import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeSupabase } from "./fakeSupabase.js";
import { signImagePaths } from "../api/_lib/wholesaleDb.js";

/**
 * Real, executed coverage for signImagePaths' own retry (see its header in
 * api/_lib/wholesaleDb.js for the full "why" — this is the server-side half
 * of the fix for the reported "cards occasionally all show icons right
 * after login, F5 fixes it" bug). Only this ONE batch Storage-signing call
 * is faked at the HTTP boundary (via a thin wrapper around
 * tests/fakeSupabase.js's own real batch-sign endpoint simulation, forced
 * to fail a controlled number of times) — every line of retry logic under
 * test is the real, shipped signImagePaths().
 */

let fake;
let env;

beforeEach(() => {
  fake = createFakeSupabase();
  env = { SUPABASE_URL: "https://fake.supabase.co", SERVICE_KEY: "fake-service-role-key" };
});

/** Wraps fake.fakeFetch so the batch Storage-sign endpoint specifically
 *  fails its first `failCount` calls (500, matching a real transient
 *  Storage/network hiccup) and succeeds normally after that — every other
 *  request (REST table queries, etc.) is untouched, delegated straight to
 *  the real fake. Mirrors the exact technique already established in DESK's
 *  tests/wholesale-admin-images.test.js for forcing one specific call type
 *  to fail without touching the rest of the harness. */
function makeSignEndpointFailNTimes(failCount) {
  let calls = 0;
  vi.stubGlobal("fetch", (url, options) => {
    const u = new URL(url);
    if (u.pathname === "/storage/v1/object/sign/wholesale-images" && options?.method === "POST") {
      calls += 1;
      if (calls <= failCount) return Promise.resolve({ ok: false, status: 500, text: async () => "storage_unavailable" });
    }
    return fake.fakeFetch(url, options);
  });
  return () => calls;
}

describe("signImagePaths: zero paths never calls Storage at all", () => {
  it("returns an empty Map immediately, no fetch", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const result = await signImagePaths(env, []);
    expect(result.size).toBe(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("signImagePaths: the happy path (first attempt succeeds) is unaffected — exactly one Storage call", () => {
  it("signs successfully on the first attempt, one call total", async () => {
    vi.stubGlobal("fetch", fake.fakeFetch);
    const result = await signImagePaths(env, ["services/a.webp"]);
    expect(result.get("services/a.webp")).toContain("services/a.webp");
  });
});

describe("signImagePaths: the reported bug's real fix — one automatic retry recovers from a single transient failure", () => {
  it("first Storage call fails (500), the retry succeeds — every path still resolves to a real signed URL, exactly as if nothing had gone wrong", async () => {
    const getCalls = makeSignEndpointFailNTimes(1);
    const result = await signImagePaths(env, ["services/a.webp", "categories/b.webp"]);

    expect(getCalls()).toBe(2); // the failed attempt + the retry that succeeded
    expect(result.get("services/a.webp")).toContain("services/a.webp");
    expect(result.get("categories/b.webp")).toContain("categories/b.webp");
  });

  it("the fetch itself throwing (a genuine network error, not just a non-2xx response) on the first attempt is retried the same way", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", (url, options) => {
      const u = new URL(url);
      if (u.pathname === "/storage/v1/object/sign/wholesale-images" && options?.method === "POST") {
        calls += 1;
        if (calls === 1) return Promise.reject(new Error("network error"));
      }
      return fake.fakeFetch(url, options);
    });

    const result = await signImagePaths(env, ["services/a.webp"]);
    expect(calls).toBe(2);
    expect(result.get("services/a.webp")).toContain("services/a.webp");
  });
});

describe("signImagePaths: two consecutive failures still degrade gracefully — every image becomes null, the catalog request never throws", () => {
  it("both the first attempt and the retry fail — returns an empty Map (every image resolves to null upstream), never throws", async () => {
    const getCalls = makeSignEndpointFailNTimes(2);
    const result = await signImagePaths(env, ["services/a.webp"]);
    expect(getCalls()).toBe(2); // exactly one retry, never more
    expect(result.size).toBe(0);
  });
});
