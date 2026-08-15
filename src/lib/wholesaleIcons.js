import { Cpu, Gamepad, Gamepad2, Laptop, Smartphone, Tablet, Wrench } from "lucide-react";

/**
 * Presentational-only icon fallback for Equipment Type / category cards that
 * have no cover photo yet (or whose signed URL failed to resolve). Ported
 * from the same slug-matching switch already approved and in production in
 * TORAYS BOOST DESK's own Wholesale module — this is a small, pure mapping
 * function with no business logic, so duplicating it here (rather than
 * importing across repos, which isn't possible anyway) is the correct move.
 */
export function wholesaleEquipmentIcon(entity) {
  const key = (entity?.slug || entity?.name || "").toLowerCase();
  if (key.includes("microsold")) return Cpu;
  if (key.includes("controller")) return Gamepad;
  if (key.includes("ipad")) return Tablet;
  if (key.includes("iphone")) return Smartphone;
  if (key.includes("macbook") || key.includes("laptop")) return Laptop;
  if (key.includes("video") || key.includes("console")) return Gamepad2;
  return Wrench;
}
