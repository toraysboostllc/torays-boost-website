import logoSrc from "../../assets/torays-boost-logo.png";

/** Official TORAYS BOOST logo — do not redraw or recolor. */
export function Logo({ className = "" }) {
  return (
    <img
      src={logoSrc}
      alt="Torays Boost"
      className={`h-11 w-auto object-contain sm:h-14 ${className}`}
    />
  );
}
