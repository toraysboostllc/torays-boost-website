/**
 * Tiny, generated-tone sound engine for the wholesale pricing wizard — Web
 * Audio API only, no audio files downloaded. Two sounds: a very short soft
 * "tick" on first hover/focus/select of a card, and a slightly longer soft
 * two-note chime when the ~3s progress bar finishes. Both are decorative —
 * every piece of information they might reinforce (a card being focused, a
 * price being ready) is already fully conveyed visually, so muting sound
 * entirely never hides anything.
 *
 * Browser autoplay policy: an AudioContext starts "suspended" until a real
 * user gesture resumes it. This module never works around that — playTone()
 * simply no-ops (never throws) whenever the context isn't already "running",
 * so sound is physically incapable of firing before the shop has interacted
 * with the page at least once, exactly as required.
 *
 * The pure decision logic (mute state, debounce) is split into
 * shouldPlayTone() specifically so it's unit-testable without a real
 * AudioContext/jsdom audio shim — this repo has no browser test environment
 * (see every other *.test.js file's own header), so the actual oscillator
 * playback is verified visually in the browser during implementation, same
 * as every other Web API this project can't unit-test directly (camera,
 * image compression, etc).
 */

export const SOUND_STORAGE_KEY = "torays_wholesale_sound_enabled";
const HOVER_DEBOUNCE_MS = 180;

let enabled = readStoredPreference();
let lastPlayedAt = 0;
const listeners = new Set();

function readStoredPreference() {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(SOUND_STORAGE_KEY);
    // Default OFF (opt-in) — a professional B2B tool used repeatedly by shop
    // staff should never make noise on its own the very first time it loads.
    return raw === "true";
  } catch {
    return false;
  }
}

function persist(next) {
  try {
    window.localStorage.setItem(SOUND_STORAGE_KEY, next ? "true" : "false");
  } catch {
    // localStorage unavailable — the choice still applies this session.
  }
}

export function isSoundEnabled() {
  return enabled;
}

export function setSoundEnabled(next) {
  enabled = Boolean(next);
  persist(enabled);
  listeners.forEach((fn) => fn(enabled));
}

/** For the toggle button only — other callers just read isSoundEnabled() at
 *  the moment they're about to play a tone; they don't need to re-render
 *  when the preference changes. */
export function subscribeSoundEnabled(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Pure decision of whether a tone should actually fire — no audio, no
 * globals, fully unit-testable. `contextState` mirrors AudioContext.state
 * ("suspended" | "running" | "closed" | undefined-if-no-context).
 */
export function shouldPlayTone({ soundEnabled, contextState, now, lastPlayedAt: last, debounceMs = HOVER_DEBOUNCE_MS }) {
  if (!soundEnabled) return false;
  if (contextState !== "running") return false;
  if (now - last < debounceMs) return false;
  return true;
}

let audioCtx = null;
function getAudioContext() {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

function tone(ctx, { frequency, startOffset = 0, durationMs, gainPeak }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  const start = ctx.currentTime + startOffset;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(gainPeak, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + durationMs / 1000);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + durationMs / 1000 + 0.02);
}

/** Very short, soft tick — first hover/focus of a card, or a tap-to-select
 *  on touch devices. Debounced (see shouldPlayTone) so sweeping the mouse
 *  across several cards quickly never turns into a chattering machine-gun. */
export function playHoverTone() {
  // Muted: never even construct/touch an AudioContext — nothing to unlock,
  // nothing to play. Checked first, before getAudioContext(), on purpose.
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  const now = Date.now();
  if (!shouldPlayTone({ soundEnabled: true, contextState: ctx?.state, now, lastPlayedAt })) {
    // Still worth a resume() attempt: if this WAS triggered by a real
    // gesture (e.g. the shop just tapped a card), this unlocks the context
    // for every subsequent call — resume() on an already-running or
    // not-yet-existing context is always a safe no-op, never throws.
    ctx?.resume().catch(() => {});
    return;
  }
  lastPlayedAt = now;
  tone(ctx, { frequency: 880, durationMs: 70, gainPeak: 0.045 });
}

/** Soft ascending two-note chime — the ~3s progress bar's completion. Not
 *  gated by the hover debounce (it's a one-shot triggered by a discrete
 *  event, not a repeatable pointer interaction), but still fully respects
 *  the mute preference and the same "context must already be running"
 *  autoplay-safety gate. */
export function playChime() {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state !== "running") {
    ctx.resume().catch(() => {});
    return;
  }
  tone(ctx, { frequency: 660, durationMs: 180, gainPeak: 0.05 });
  tone(ctx, { frequency: 990, startOffset: 0.11, durationMs: 200, gainPeak: 0.05 });
}

/** Called from a real click/keydown handler (the sound toggle button is the
 *  guaranteed one) to attempt unlocking the AudioContext as early as
 *  possible in the session — resume() only succeeds when called from within
 *  a genuine user-gesture callstack, so this is a no-op (never throws)
 *  everywhere else it might accidentally be invoked. */
export function primeAudioContext() {
  getAudioContext()?.resume().catch(() => {});
}

/** True only on devices that support a real mouse hover — shared by every
 *  hoverable control in the wizard (equipment/model cards, fault list,
 *  price tiers, Back/language/primary buttons) so a touch device never gets
 *  a false "hover" tone from a tap or a scroll; it gets one on tap/select
 *  instead (see wholesaleHoverProps below). Re-checked at call time rather
 *  than cached, matching the CSS (hover: hover) gate this mirrors. */
export function isPointerHoverCapable() {
  return typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
}

/**
 * Shared onPointerEnter/onFocus/onClick wiring for every hoverable control
 * in the wizard — one implementation instead of a hand-rolled copy per
 * component. `onPointerEnter` only plays for a real mouse pointer:
 * `event.pointerType` is "touch"/"pen" for a tap, so a touch tap or a scroll
 * gesture never reaches playHoverTone() through this path at all — pointer
 * events fire once per real entry (never per movement), so this alone
 * already satisfies "once on enter, not while the pointer stays over, not
 * per movement". `onFocus` always plays (keyboard navigation has no hover
 * concept of its own — same behavior every other control here already had).
 * When `onActivate` is given, the returned `onClick` plays once on
 * tap/select ONLY on a device that can never hover in the first place, so a
 * single interaction never plays the tone twice regardless of input method,
 * then calls the real handler. Every returned handler is a fresh plain
 * function per call — never a manually-attached DOM listener — so React's
 * own synthetic-event delegation is what prevents duplicate listeners after
 * a rerender, exactly as it already does for every other JSX event prop in
 * this codebase.
 */
export function wholesaleHoverProps(onActivate) {
  const props = {
    onPointerEnter(event) {
      if (event?.pointerType && event.pointerType !== "mouse") return;
      playHoverTone();
    },
    onFocus() {
      playHoverTone();
    },
  };
  if (onActivate) {
    props.onClick = (...args) => {
      if (!isPointerHoverCapable()) playHoverTone();
      onActivate(...args);
    };
  }
  return props;
}
