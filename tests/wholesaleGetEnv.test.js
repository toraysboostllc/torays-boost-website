import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getEnv, normalizeSupabaseUrl } from "../api/_lib/wholesaleDb.js";

const KEYS = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
const originals = {};

beforeEach(() => {
  for (const k of KEYS) {
    originals[k] = process.env[k];
    delete process.env[k];
  }
  process.env.SUPABASE_URL = "https://fake.supabase.co";
});

afterEach(() => {
  for (const k of KEYS) {
    if (originals[k] === undefined) delete process.env[k];
    else process.env[k] = originals[k];
  }
});

describe("getEnv(): SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY priority", () => {
  it("uses SUPABASE_SECRET_KEY when it's the only one present", () => {
    process.env.SUPABASE_SECRET_KEY = "secret-key-value";
    const env = getEnv();
    expect(env.SERVICE_KEY).toBe("secret-key-value");
  });

  it("prefers SUPABASE_SECRET_KEY when both are present", () => {
    process.env.SUPABASE_SECRET_KEY = "secret-key-value";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "legacy-service-role-value";
    const env = getEnv();
    expect(env.SERVICE_KEY).toBe("secret-key-value");
  });

  it("accepts SUPABASE_SERVICE_ROLE_KEY as a fallback when SUPABASE_SECRET_KEY is absent", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "legacy-service-role-value";
    const env = getEnv();
    expect(env.SERVICE_KEY).toBe("legacy-service-role-value");
  });

  it("throws not_configured when neither key is present", () => {
    expect(() => getEnv()).toThrow("not_configured");
  });

  it("still throws not_configured when a key is present but SUPABASE_URL is missing", () => {
    delete process.env.SUPABASE_URL;
    process.env.SUPABASE_SECRET_KEY = "secret-key-value";
    expect(() => getEnv()).toThrow("not_configured");
  });
});

describe("normalizeSupabaseUrl(): validates the bare project origin, independent of getEnv()", () => {
  it("passes a clean bare origin through unchanged", () => {
    expect(normalizeSupabaseUrl("https://fake.supabase.co")).toBe("https://fake.supabase.co");
  });

  it("strips a single trailing slash", () => {
    expect(normalizeSupabaseUrl("https://fake.supabase.co/")).toBe("https://fake.supabase.co");
  });

  it("strips multiple trailing slashes", () => {
    expect(normalizeSupabaseUrl("https://fake.supabase.co///")).toBe("https://fake.supabase.co");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeSupabaseUrl("  https://fake.supabase.co  ")).toBe("https://fake.supabase.co");
  });

  it("rejects a URL ending in /rest/v1 (returns null)", () => {
    expect(normalizeSupabaseUrl("https://fake.supabase.co/rest/v1")).toBeNull();
  });

  it("rejects /rest/v1 with a trailing slash too", () => {
    expect(normalizeSupabaseUrl("https://fake.supabase.co/rest/v1/")).toBeNull();
  });

  it("rejects /rest/v1 case-insensitively", () => {
    expect(normalizeSupabaseUrl("https://fake.supabase.co/REST/V1")).toBeNull();
  });

  it("rejects empty string, non-string, and whitespace-only values", () => {
    expect(normalizeSupabaseUrl("")).toBeNull();
    expect(normalizeSupabaseUrl("   ")).toBeNull();
    expect(normalizeSupabaseUrl(undefined)).toBeNull();
    expect(normalizeSupabaseUrl(null)).toBeNull();
  });
});

describe("getEnv(): SUPABASE_URL normalization end-to-end", () => {
  it("strips a trailing slash before returning it", () => {
    process.env.SUPABASE_URL = "https://fake.supabase.co/";
    process.env.SUPABASE_SECRET_KEY = "secret-key-value";
    expect(getEnv().SUPABASE_URL).toBe("https://fake.supabase.co");
  });

  it("throws not_configured when SUPABASE_URL already includes /rest/v1", () => {
    process.env.SUPABASE_URL = "https://fake.supabase.co/rest/v1";
    process.env.SUPABASE_SECRET_KEY = "secret-key-value";
    expect(() => getEnv()).toThrow("not_configured");
  });

  it("throws not_configured for /rest/v1/ (trailing slash) too", () => {
    process.env.SUPABASE_URL = "https://fake.supabase.co/rest/v1/";
    process.env.SUPABASE_SECRET_KEY = "secret-key-value";
    expect(() => getEnv()).toThrow("not_configured");
  });
});
