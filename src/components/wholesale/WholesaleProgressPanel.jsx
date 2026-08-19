import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { CircuitBackground } from "../ui/CircuitBackground.jsx";
import { useWholesaleLocale } from "../../i18n/WholesaleLocaleContext.jsx";
import { playChime } from "../../lib/wholesaleSound.js";

const REDUCED_MOTION_DURATION_MS = 500;
const FULL_DURATION_MS = 3000;
// Fraction of the total duration each of the 3 steps occupies — the first
// two are near-instant "confirmed" checkmarks (the equipment/fault were
// already chosen by the time this panel mounts), the third carries the
// actual progress bar fill.
const STEP_BOUNDARIES = [0.12, 0.3, 1];

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The ~3 second "calculating" reveal between the shop finishing Equipo ->
 * Modelo -> Falla and seeing WholesaleResultPanel. Purely a pacing/reveal
 * device over data that is ALREADY real and already in memory (see
 * WholesaleWizard.jsx — the whole active catalog, recommended prices
 * included, was fetched once via the existing /api/wholesale-prices call
 * when the portal loaded). This component never fetches anything and never
 * has an error state of its own: by the time it's mounted, the price it's
 * about to reveal is already known-good. It only ever calls onComplete();
 * it does not render the result itself.
 *
 * Renders inline within the wizard's own content area — never a full-page
 * overlay/modal — so the header, locale selector, and "Cerrar sesión" stay
 * reachable while it runs.
 */
export function WholesaleProgressPanel({ onComplete }) {
  const { t } = useWholesaleLocale();
  const [percent, setPercent] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const reduced = prefersReducedMotion();
    const duration = reduced ? REDUCED_MOTION_DURATION_MS : FULL_DURATION_MS;
    const start = performance.now();
    let frameId;

    function tick(now) {
      const elapsed = now - start;
      const nextPercent = Math.min(100, Math.round((elapsed / duration) * 100));
      setPercent(nextPercent);
      if (elapsed < duration) {
        frameId = requestAnimationFrame(tick);
      } else {
        playChime();
        onCompleteRef.current();
      }
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const fraction = percent / 100;
  const steps = [
    { key: "stepEquipmentConfirmed", done: fraction >= STEP_BOUNDARIES[0] },
    { key: "stepFaultIdentified", done: fraction >= STEP_BOUNDARIES[1] },
    { key: "stepCalculating", done: false }, // never shows a checkmark — it's the active step until completion
  ];

  return (
    <div className="wsp-progress-panel" role="status" aria-live="polite">
      <CircuitBackground className="wsp-progress-circuit" opacity={0.15} />
      <div className="wsp-progress-content">
        <h1 className="wsp-progress-headline">{t("progress.headline")}</h1>

        <div className="wsp-progress-bar-track" aria-hidden="true">
          <div className="wsp-progress-bar-fill" style={{ width: `${percent}%` }} />
        </div>
        <p className="wsp-progress-bar-label">{t("progress.barLabel")}</p>

        <ul className="wsp-progress-steps">
          {steps.map((step, index) => {
            const isActive = !step.done && (index === 0 || steps[index - 1].done);
            const className = [
              "wsp-progress-step",
              step.done && "wsp-progress-step-done",
              isActive && "wsp-progress-step-active",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <li key={step.key} className={className}>
                <span className="wsp-progress-step-icon" aria-hidden="true">
                  {step.done ? <Check size={14} /> : <span className="wsp-progress-step-dot" />}
                </span>
                <span>{t(`progress.${step.key}`)}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
