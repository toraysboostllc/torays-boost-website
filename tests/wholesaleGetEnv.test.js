import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getEnv } from "../api/_lib/wholesaleDb.js";

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
