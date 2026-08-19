import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useWholesaleLocale } from "../../i18n/WholesaleLocaleContext.jsx";
import { isSoundEnabled, setSoundEnabled, subscribeSoundEnabled, primeAudioContext } from "../../lib/wholesaleSound.js";

/**
 * Accessible mute/unmute control for the wizard's short hover/chime tones.
 * A real click on this button is also the most reliable place to attempt
 * unlocking the AudioContext (see primeAudioContext) — clicking a button is
 * unambiguously the kind of gesture every browser's autoplay policy honors.
 */
export function WholesaleSoundToggle() {
  const { t } = useWholesaleLocale();
  const [enabled, setEnabled] = useState(isSoundEnabled);

  useEffect(() => subscribeSoundEnabled(setEnabled), []);

  function handleClick() {
    const next = !enabled;
    setSoundEnabled(next);
    if (next) primeAudioContext();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="wsp-sound-toggle"
      aria-pressed={enabled}
      aria-label={enabled ? t("audio.muteLabel") : t("audio.unmuteLabel")}
      title={t("audio.label")}
    >
      {enabled ? <Volume2 size={15} aria-hidden="true" /> : <VolumeX size={15} aria-hidden="true" />}
      <span className="wsp-sound-toggle-text">{t("audio.label")}</span>
    </button>
  );
}
