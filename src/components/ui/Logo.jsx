import logoSrc from "../../assets/torays-boost-logo.png";

const SIZES = {
  sm: "h-8 sm:h-11",
  default: "h-11 sm:h-14",
  lg: "h-16 sm:h-20",
};

/** Official TORAYS BOOST logo — do not redraw or recolor. */
export function Logo({ className = "", size = "default" }) {
  return (
    <img
      src={logoSrc}
      alt="Torays Boost"
      className={`w-auto object-contain ${SIZES[size]} ${className}`}
    />
  );
}
