/**
 * Original, hand-composed PCB-trace artwork — NOT a repeating tile.
 * Density, stroke weight, and opacity are deliberately uneven: traces
 * cluster and run thicker near the right edge (where the Hero panel
 * sits, so it reads as the traces originate from it) and thin out,
 * fade, and go sparse toward the left. A couple of traces use a
 * gradient stroke so they visibly dissolve rather than just stopping.
 * `opacity` scales the whole piece (call sites keep tuning overall
 * intensity); the per-path variation is what gives it depth.
 */
export function CircuitBackground({ className = "", opacity = 1 }) {
  return (
    <svg
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMaxYMin slice"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      style={{ opacity }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="cbFadeA" x1="100%" y1="0%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#20266F" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#20266F" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="cbFadeB" x1="100%" y1="0%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#333BA0" stopOpacity="0.13" />
          <stop offset="100%" stopColor="#333BA0" stopOpacity="0" />
        </linearGradient>
      </defs>

      <g fill="none" strokeLinecap="round">
        {/* Dense zone — right edge, near/under the Hero panel */}
        <path d="M1200,110 H970 V210 H840" stroke="#20266F" strokeWidth="2.2" opacity="0.12" />
        <path d="M1200,290 H1050 V370 H900 V450" stroke="#333BA0" strokeWidth="1.6" opacity="0.10" />
        <path d="M1160,60 V180 H1080" stroke="#20266F" strokeWidth="1.4" opacity="0.09" />
        <path d="M1150,510 H990 V600" stroke="#20266F" strokeWidth="1.8" opacity="0.11" />
        <path d="M1200,660 H1040" stroke="#DA1F26" strokeWidth="1.4" opacity="0.08" />
        <path d="M1200,740 H1090 V680" stroke="#333BA0" strokeWidth="1.2" opacity="0.08" />

        {/* Traces reaching toward the middle, thinning out */}
        <path d="M840,210 H700 V300" stroke="#20266F" strokeWidth="1.3" opacity="0.07" />
        <path d="M900,450 H760" stroke="#333BA0" strokeWidth="1" opacity="0.06" />
        <path d="M700,150 H460" stroke="url(#cbFadeA)" strokeWidth="1.2" />
        <path d="M650,480 H430 V550" stroke="#333BA0" strokeWidth="0.9" opacity="0.045" />
        <path d="M990,600 H820 V670" stroke="url(#cbFadeB)" strokeWidth="1.1" />

        {/* Sparse zone — left side, nearly dissolved */}
        <path d="M460,150 H240" stroke="url(#cbFadeA)" strokeWidth="0.9" />
        <path d="M350,320 H120" stroke="#20266F" strokeWidth="0.75" opacity="0.035" />
      </g>

      <g stroke="none">
        {/* Vias — concentrated right, thinning left */}
        <circle cx="970" cy="110" r="3.5" fill="#DA1F26" opacity="0.10" />
        <circle cx="840" cy="210" r="3" fill="#20266F" opacity="0.12" />
        <circle cx="1050" cy="290" r="2.5" fill="#333BA0" opacity="0.10" />
        <circle cx="900" cy="450" r="3" fill="#20266F" opacity="0.10" />
        <circle cx="1080" cy="180" r="2" fill="#333BA0" opacity="0.09" />
        <circle cx="990" cy="600" r="2.5" fill="#20266F" opacity="0.09" />
        <circle cx="1040" cy="660" r="2.5" fill="#DA1F26" opacity="0.08" />
        <circle cx="700" cy="300" r="2" fill="#20266F" opacity="0.06" />
        <circle cx="760" cy="450" r="1.75" fill="#333BA0" opacity="0.05" />
        <circle cx="430" cy="550" r="1.5" fill="#333BA0" opacity="0.04" />
        <circle cx="240" cy="150" r="1.5" fill="#20266F" opacity="0.035" />
      </g>
    </svg>
  );
}
