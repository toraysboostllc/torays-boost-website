/**
 * Client-side mirror of api/_lib/wholesaleDb.js's normalizeShopCode() — same
 * trim().toUpperCase() transform, applied to the Shop Login form's access
 * code field (both live, as the shop types, and again right before the
 * request is sent) so what actually reaches the server already matches what
 * the server itself normalizes to before comparing against the stored hash.
 * The two repos share no code, so this is a deliberate duplicate of the
 * server-side helper, not an import — must stay byte-for-byte identical to it.
 */
export function normalizeShopCode(raw) {
  return typeof raw === "string" ? raw.trim().toUpperCase() : "";
}
