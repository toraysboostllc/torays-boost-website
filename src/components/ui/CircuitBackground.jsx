/**
 * Original, hand-drawn PCB-trace pattern used as a subtle background motif.
 * Tiled via an SVG <pattern>, kept at low opacity so it never fights content.
 */
export function CircuitBackground({ className = "", opacity = 0.05 }) {
  const patternId = "torays-circuit-pattern";

  return (
    <svg
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      style={{ opacity }}
      aria-hidden="true"
    >
      <defs>
        <pattern id={patternId} width="180" height="180" patternUnits="userSpaceOnUse">
          <path
            d="M0 40H60V90H140V180"
            fill="none"
            stroke="#4A5DB8"
            strokeWidth="1.5"
          />
          <path
            d="M180 130H120V60H20V0"
            fill="none"
            stroke="#4A5DB8"
            strokeWidth="1.5"
          />
          <path d="M60 90H0" fill="none" stroke="#4A5DB8" strokeWidth="1.5" />
          <path d="M100 180V150H150V110" fill="none" stroke="#4A5DB8" strokeWidth="1.5" />
          <path d="M180 20H160V60" fill="none" stroke="#4A5DB8" strokeWidth="1.5" />
          <circle cx="60" cy="90" r="3.5" fill="#DA1F26" />
          <circle cx="140" cy="180" r="3" fill="#4A5DB8" />
          <circle cx="20" cy="0" r="3" fill="#4A5DB8" />
          <circle cx="120" cy="60" r="3.5" fill="#DA1F26" />
          <circle cx="150" cy="110" r="2.5" fill="#4A5DB8" />
          <circle cx="160" cy="60" r="2.5" fill="#4A5DB8" />
          <circle cx="100" cy="150" r="2" fill="none" stroke="#4A5DB8" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
