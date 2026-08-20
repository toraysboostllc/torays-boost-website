import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { shouldPlayTone } from "../src/lib/wholesaleSound.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

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

describe("Sound preference: persisted (localStorage), default ON for new users", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to ENABLED when nothing was ever stored (storage key absent)", async () => {
    vi.stubGlobal("window", createFakeWindow());
    const { isSoundEnabled } = await import("../src/lib/wholesaleSound.js");
    expect(isSoundEnabled()).toBe(true);
  });

  it("reads a previously-saved 'true' preference back on module load — still enabled", async () => {
    vi.stubGlobal("window", createFakeWindow({ torays_wholesale_sound_enabled: "true" }));
    const { isSoundEnabled, SOUND_STORAGE_KEY } = await import("../src/lib/wholesaleSound.js");
    expect(SOUND_STORAGE_KEY).toBe("torays_wholesale_sound_enabled");
    expect(isSoundEnabled()).toBe(true);
  });

  it("reads a previously-saved 'false' preference back on module load — respects the shop's explicit mute", async () => {
    vi.stubGlobal("window", createFakeWindow({ torays_wholesale_sound_enabled: "false" }));
    const { isSoundEnabled } = await import("../src/lib/wholesaleSound.js");
    expect(isSoundEnabled()).toBe(false);
  });

  it("never auto-persists the ON default during initialization — reading the preference must not write anything back to storage", async () => {
    const fakeWindow = createFakeWindow();
    vi.stubGlobal("window", fakeWindow);
    const { isSoundEnabled, SOUND_STORAGE_KEY } = await import("../src/lib/wholesaleSound.js");
    expect(isSoundEnabled()).toBe(true);
    expect(fakeWindow.localStorage.getItem(SOUND_STORAGE_KEY)).toBeNull();
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

  it("zero autoplay on module load — importing the module (the ON-by-default path) never constructs an AudioContext or plays a tone on its own", async () => {
    const fakeWindow = createFakeWindow(); // no stored preference: module loads ON
    const audioCtorSpy = vi.fn(() => ({ state: "suspended", resume: () => Promise.resolve(), createOscillator: vi.fn(), createGain: vi.fn() }));
    fakeWindow.AudioContext = audioCtorSpy;
    vi.stubGlobal("window", fakeWindow);
    const { isSoundEnabled } = await import("../src/lib/wholesaleSound.js");
    expect(isSoundEnabled()).toBe(true); // confirms this really is the ON-by-default path
    expect(audioCtorSpy).not.toHaveBeenCalled(); // yet nothing constructed/played a sound just from import
  });

  it("first user interaction unlocks (resumes) the AudioContext even when it doesn't produce an audible tone — playHoverTone() always attempts resume() on a suspended context", async () => {
    const fakeWindow = createFakeWindow();
    const resumeSpy = vi.fn(() => Promise.resolve());
    fakeWindow.AudioContext = vi.fn(() => ({
      state: "suspended",
      resume: resumeSpy,
      createOscillator: () => ({ type: "", frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }),
      createGain: () => ({ gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() }),
      currentTime: 0,
    }));
    vi.stubGlobal("window", fakeWindow);
    const { isSoundEnabled, playHoverTone } = await import("../src/lib/wholesaleSound.js");
    expect(isSoundEnabled()).toBe(true); // default ON — no need to touch the Sound button first
    playHoverTone(); // simulates the shop's very first hover/focus/tap anywhere in the portal
    expect(resumeSpy).toHaveBeenCalledTimes(1);
  });
});

describe("isPointerHoverCapable / wholesaleHoverProps: shared hover/tap wiring for every wizard control", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("isPointerHoverCapable is false with no window at all (SSR/build-time safety)", async () => {
    const { isPointerHoverCapable } = await import("../src/lib/wholesaleSound.js");
    expect(isPointerHoverCapable()).toBe(false);
  });

  it("isPointerHoverCapable reflects the (hover: hover) and (pointer: fine) media query", async () => {
    const fakeWindow = createFakeWindow();
    fakeWindow.matchMedia = (query) => ({ matches: query === "(hover: hover) and (pointer: fine)" });
    vi.stubGlobal("window", fakeWindow);
    const { isPointerHoverCapable } = await import("../src/lib/wholesaleSound.js");
    expect(isPointerHoverCapable()).toBe(true);
  });

  it("wholesaleHoverProps() with no onActivate returns only onPointerEnter/onFocus — no onClick prop to wire", async () => {
    const { wholesaleHoverProps } = await import("../src/lib/wholesaleSound.js");
    const props = wholesaleHoverProps();
    expect(typeof props.onPointerEnter).toBe("function");
    expect(typeof props.onFocus).toBe("function");
    expect(props.onClick).toBeUndefined();
  });

  it("wholesaleHoverProps(onActivate) always calls onActivate on click, muted or not, hover-capable or not — sound is decorative, never gates the real action", async () => {
    vi.stubGlobal("window", createFakeWindow());
    const { wholesaleHoverProps } = await import("../src/lib/wholesaleSound.js");
    let calls = 0;
    const props = wholesaleHoverProps(() => calls++);
    props.onClick();
    props.onClick();
    expect(calls).toBe(2);
  });

  it("onPointerEnter never throws for a real mouse entry, a touch entry, or a synthetic event with no pointerType at all", async () => {
    vi.stubGlobal("window", createFakeWindow());
    const { wholesaleHoverProps } = await import("../src/lib/wholesaleSound.js");
    const props = wholesaleHoverProps();
    expect(() => props.onPointerEnter({ pointerType: "mouse" })).not.toThrow();
    expect(() => props.onPointerEnter({ pointerType: "touch" })).not.toThrow();
    expect(() => props.onPointerEnter({ pointerType: "pen" })).not.toThrow();
    expect(() => props.onPointerEnter({})).not.toThrow();
    expect(() => props.onFocus()).not.toThrow();
  });

  it("every call returns brand-new plain functions, never a cached/shared handler — this is what lets React's own synthetic-event delegation replace the listener cleanly on every rerender instead of accumulating duplicates", async () => {
    const { wholesaleHoverProps } = await import("../src/lib/wholesaleSound.js");
    const first = wholesaleHoverProps(() => {});
    const second = wholesaleHoverProps(() => {});
    expect(first.onPointerEnter).not.toBe(second.onPointerEnter);
    expect(first.onClick).not.toBe(second.onClick);
  });
});

describe("No manual addEventListener anywhere in the sound-wired wizard files — every hover/click listener goes through JSX props (onPointerEnter/onFocus/onClick), so React owns listener attach/detach and a rerender can never accumulate a duplicate raw DOM listener", () => {
  const files = [
    "src/lib/wholesaleSound.js",
    "src/components/wholesale/EquipmentTypeCard.jsx",
    "src/components/wholesale/WholesaleWizard.jsx",
    "src/components/wholesale/WholesaleResultPanel.jsx",
    "src/components/wholesale/WholesaleLocaleSelector.jsx",
    "src/pages/WholesalePrices.jsx",
  ];

  it.each(files)("%s never calls addEventListener directly", (relPath) => {
    expect(read(relPath)).not.toContain("addEventListener");
  });
});
