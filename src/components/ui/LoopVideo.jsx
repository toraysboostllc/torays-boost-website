import { useEffect, useRef, useState } from "react";

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A short, silent, looping illustration clip used like an animated image.
 *
 * - Nothing is downloaded until the clip scrolls near the viewport
 *   (`preload="none"` + IntersectionObserver), so Home's first paint never
 *   pays for it; it pauses again when scrolled away.
 * - Visitors with "reduce motion" turned on get the still poster image
 *   instead, never a moving clip.
 * - Always muted + playsInline, the only combination mobile browsers allow
 *   to autoplay.
 */
export function LoopVideo({ src, poster, alt, className = "" }) {
  const videoRef = useRef(null);
  const [reducedMotion] = useState(prefersReducedMotion);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reducedMotion || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play?.()?.catch?.(() => {});
        } else {
          video.pause?.();
        }
      },
      { rootMargin: "200px 0px" }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [reducedMotion]);

  if (reducedMotion) {
    return <img src={poster} alt={alt} loading="lazy" decoding="async" width="1600" height="900" className={className} />;
  }

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      aria-label={alt}
      role="img"
      width="1600"
      height="900"
      className={className}
    />
  );
}
