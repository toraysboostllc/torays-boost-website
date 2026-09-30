/** Pickup hours ([{ day: 0-6, open, close }], 0 = Sunday) as display rows,
 *  Monday first, with the translated day name. */
export function hoursRows(hours, t) {
  const days = t("shop.days");
  return [...(hours || [])]
    .sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7))
    .map((h) => ({ day: Array.isArray(days) ? days[h.day] : String(h.day), range: `${h.open} – ${h.close}` }));
}
