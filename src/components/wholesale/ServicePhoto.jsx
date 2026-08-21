import { useEffect, useState } from "react";

/**
 * Small, optional per-service photo — used in the Falla list (thumbnail to
 * the left of the service name) and the Precio listo result panel (larger,
 * above its description). `image` is exactly what /api/wholesale-prices
 * already returns per service ({ url, alt_text } | null — see
 * toClientService in api/_lib/wholesaleDb.js); this component never fetches
 * or signs anything itself, and never assumes a specific service, name, or
 * slug — any service with a photo gets one here, grouped or direct_services
 * alike.
 *
 * Renders nothing at all when the service has no photo (never a placeholder
 * icon/box): most services don't have one yet, and reserving visual space
 * for a missing photo would misalign every list item around it, unlike
 * EquipmentTypeCard's top-level grid cards which always show SOMETHING in a
 * fixed-size photo slot.
 *
 * Same onError-tracks-the-failed-URL pattern as EquipmentTypeCard.jsx: if
 * the signed URL's 5-minute TTL (see IMAGE_SIGN_TTL_SECONDS in
 * api/_lib/wholesaleDb.js) expires while this screen is open, or the object
 * 404s, this quietly stops rendering the <img> instead of showing the
 * browser's broken-image icon — keyed by URL value (not a bare boolean) so
 * a fresh catalog fetch with a NEW signed URL gets a real chance to load
 * again instead of staying stuck failed forever.
 */
export function ServicePhoto({ image, alt, size, className }) {
  const url = image?.url || null;
  const [failedUrl, setFailedUrl] = useState(null);
  useEffect(() => {
    setFailedUrl(null);
  }, [url]);

  if (!url || url === failedUrl) return null;

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      width={size}
      height={size}
      className={className}
      onError={() => setFailedUrl(url)}
    />
  );
}
