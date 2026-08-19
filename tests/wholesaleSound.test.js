import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { shouldPlayTone } from "../src/lib/wholesaleSound.js";

/**
 * This project's test environment has no `window`/DOM global at all (see
 * every other *.test.js file's "no jsdom" note, confirmed directly: a
 * top-level `typeof window` here is "undefined"). wholesaleSound.js already
 * degrades gracefully in that environment (every window-touching function
 * checks `typeof window === "undefined"` first) — which is exactly what
 * lets these tests stub a minimal fake `window` via vi.stubGlobal() and
 * vi.resetModules() + a fresh dynamic import to exercise the real
 * persistence/AudioContext code paths, one fake "browser" per test. No real
 * AudioContext exists to construct, so actual oscillator playback is
 * verified visually in the browser, not here — same constraint every other
 * Web-API-dependent file in this project already works under.
 */

function createFakeWindow(initialStorage = {}) {
  const store = { ...initialStorage };
  return {
    localStorage: {
      getItem: (key) => (key in store ? store[key] : null),
      setItem: (key, value) => {
        store[key] = String(value);
      },
      removeItem: (key) => {
        delete store[key];
      },
    },
    AudioContext: undefined,
    webkitAudioContext: undefined,
  };
}

describe("shouldPlayTone: the pure gate every actual tone-play goes through", () => {
  it("never plays when sound is muted, even if the context is running and debounce has elapsed", () => {
    expect(
      shouldPlayTone({ soundEnabled: false, contextState: "running", now: 10000, lastPlayedAt: 0, debounceMs: 180 })
    ).toBe(false);
  });

  it("never plays before a real user gesture has unlocked the AudioContext — contextState must be exactly 'running'", () => {
    expect(
      shouldPlayTone({ soundEnabled: true, contextState: "suspended", now: 10000, lastPlayedAt: 0, debounceMs: 180 })
    ).toBe(false);
    expect(
      shouldPlayTone({ soundEnabled: true, contextState: undefined, now: 10000, lastPlayedAt: 0, debounceMs: 180 })
    ).toBe(false);
    expect(
      shouldPlayTone({ soundEnabled: true, contextState: "closed", now: 10000, lastPlayedAt: 0, debounceMs: 180 })
    ).toBe(false);
  });

  it("debounces — refuses a second play within debounceMs of the last one, even with sound enabled and context running", () => {
    expect(
      shouldPlayTone({ soundEnabled: true, contextState: "running", now: 1100, lastPlayedAt: 1000, debounceMs: 180 })
    ).toBe(false); // only 100ms elapsed
  });

  it("allows a play once every gate passes: enabled, running, and enough time has elapsed since the last tone", () => {
    expect(
      shouldPlayTone({ soundEnabled: true, contextState: "running", now: 1300, lastPlayedAt: 1000, debounceMs: 180 })
    ).toBe(true); // 300ms elapsed > 180ms debounce
  });

  it("the very first tone ever (lastPlayedAt sentinel = 0) is allowed — a real Date.now() value is always far past the debounce window from epoch zero", () => {
    expect(
      shouldPlayTone({ soundEnabled: true, contextState: "running", now: Date.now(), lastPlayedAt: 0, debounceMs: 180 })
    ).toBe(true);
  });
});

describe("Sound preference: persisted (localStorage), default OFF (opt-in)", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to disabled when nothing was ever stored", async () => {
    vi.stubGlobal("window", createFakeWindow());
    const { isSoundEnabled } = await import("../src/lib/wholesaleSound.js");
    expect(isSoundEnabled()).toBe(false);
  });

  it("reads a previously-saved 'true' preference back on module load", async () => {
    vi.stubGlobal("window", createFakeWindow({ torays_wholesale_sound_enabled: "true" }));
    const { isSoundEnabled, SOUND_STORAGE_KEY } = await import("../src/lib/wholesaleSound.js");
    expect(SOUND_STORAGE_KEY).toBe("torays_wholesale_sound_enabled");
    expect(isSoundEnabled()).toBe(true);
  });

  it("setSoundEnabled(true/false) both flips the in-memory flag AND writes the new value to localStorage", async () => {
    const fakeWindow = createFakeWindow();
    vi.stubGlobal("window", fakeWindow);
    const { isSoundEnabled, setSoundEnabled, SOUND_STORAGE_KEY } = await import("../src/lib/wholesaleSound.js");

    setSoundEnabled(true);
    expect(isSoundEnabled()).toBe(true);
    expect(fakeWindow.localStorage.getItem(SOUND_STORAGE_KEY)).toBe("true");

    setSoundEnabled(false);
    expect(isSoundEnabled()).toBe(false);
    expect(fakeWindow.localStorage.getItem(SOUND_STORAGE_KEY)).toBe("false");
  });

  it("notifies subscribers on every change; unsubscribing actually stops future notifications", async () => {
    vi.stubGlobal("window", createFakeWindow());
    const { setSoundEnabled, subscribeSoundEnabled } = await import("../src/lib/wholesaleSound.js");
    const calls = [];
    const unsubscribe = subscribeSoundEnabled((next) => calls.push(next));
    setSoundEnabled(true);
    setSoundEnabled(false);
    expect(calls).toEqual([true, false]);
    unsubscribe();
    setSoundEnabled(true);
    expect(calls).toEqual([true, false]); // no third call after unsubscribing
  });
});

describe("playHoverTone / playChime / primeAudioContext: never throw, mute is always respected", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("all three are safe no-ops with a browser that has no AudioContext constructor at all", async () => {
    vi.stubGlobal("window", createFakeWindow());
    const { playHoverTone, playChime, primeAudioContext } = await import("../src/lib/wholesaleSound.js");
    expect(() => playHoverTone()).not.toThrow();
    expect(() => playChime()).not.toThrow();
    expect(() => primeAudioContext()).not.toThrow();
  });

  it("all three are safe no-ops with zero window at all (SSR/build-time safety, no stubGlobal)", async () => {
    const { playHoverTone, playChime, primeAudioContext } = await import("../src/lib/wholesaleSound.js");
    expect(() => playHoverTone()).not.toThrow();
    expect(() => playChime()).not.toThrow();
    expect(() => primeAudioContext()).not.toThrow();
  });

  it("playChime() never plays while muted, even with a real AudioContext constructor available", async () => {
    const fakeWindow = createFakeWindow();
    const audioCtorSpy = vi.fn();
    fakeWindow.AudioContext = audioCtorSpy;
    vi.stubGlobal("window", fakeWindow);
    const { setSoundEnabled, playChime } = await import("../src/lib/wholesaleSound.js");
    setSoundEnabled(false);
    playChime();
    expect(audioCtorSpy).not.toHaveBeenCalled(); // muted: never even constructs a context
  });
});
