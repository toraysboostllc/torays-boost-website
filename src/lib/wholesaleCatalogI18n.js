/**
 * Display-only Spanish names for the equipment types / categories (models) /
 * services the wholesale catalog returns — every one of those rows is
 * stored, and stays stored, in English (see
 * scripts/wholesaleCatalogSeed.data.js, the single source of truth for what
 * DESK actually writes to wholesale_equipment_types/wholesale_categories/
 * wholesale_services.name). This file NEVER writes back to the database and
 * is never imported by anything that persists data — it only changes what a
 * Spanish-language shop sees on screen, exactly the "localiza el nombre
 * presentado, sin cambiar el valor guardado" requirement.
 *
 * Keyed by the EXACT English name string the server returns, not by
 * id/slug — so a lookup miss (an admin-renamed service, or a brand-new one
 * not yet added here) degrades safely to the original English name, never a
 * blank or a crash. Reused across every screen that shows a catalog name:
 * EquipmentTypeCard (Equipo/Modelo cards), the Falla list, and the result
 * breadcrumb.
 */
const CATALOG_NAME_ES = {
  // Equipment types (src: wholesale-navigation-migration.sql's 7-row seed)
  "Gaming Laptops": "Laptops Gamer",
  "Video Consoles": "Consolas de Videojuegos",
  Controllers: "Controles",

  // Categories / models (src: scripts/wholesaleCatalogSeed.data.js)
  "iPad 7th / 8th / 9th Generation": "iPad 7.ª / 8.ª / 9.ª Generación",
  "iPad 10th Generation": "iPad 10.ª Generación",
  "iPad 11th Generation": "iPad 11.ª Generación",
  'iPad Pro 11" — 1st, 2nd & 3rd Generation': 'iPad Pro 11" — 1.ª, 2.ª y 3.ª Generación',
  'iPad Pro 12.9" — 1st, 2nd & 3rd Generation': 'iPad Pro 12.9" — 1.ª, 2.ª y 3.ª Generación',
  'iPad Pro 11" — 4th Generation & Newer': 'iPad Pro 11" — 4.ª Generación en Adelante',
  'iPad Pro 12.9" — 4th Generation & Newer': 'iPad Pro 12.9" — 4.ª Generación en Adelante',
  "Xbox Series X/S Controller": "Control Xbox Series X/S",
  "Xbox Elite Series 2 Controller": "Control Xbox Elite Series 2",
  "Laptops (Standard)": "Laptops (Estándar)",

  // Services (src: scripts/wholesaleCatalogSeed.data.js — every distinct
  // service name across all 21 categories; several categories reuse the
  // exact same name, e.g. "No Power" on 6 different device lines, so one
  // entry here covers all of them)
  "No Power": "Sin Encendido",
  "Boot Loop": "Bucle de Reinicio",
  "No Charge – Board Repair": "Sin Carga – Reparación de Placa",
  "No Wi-Fi / Bluetooth – Board Repair": "Sin Wi-Fi / Bluetooth – Reparación de Placa",
  "Save Phone + Data Recovery": "Rescate del Teléfono + Recuperación de Datos",
  "Charging Port Replacement": "Reemplazo del Puerto de Carga",
  "Charging IC Replacement": "Reemplazo del IC de Carga",
  "Backlight Repair": "Reparación de Retroiluminación",
  "Charging IC / No Charge (IC-caused)": "IC de Carga / Sin Carga (causado por el IC)",
  "Save Device + Data Recovery": "Rescate del Equipo + Recuperación de Datos",
  "Board Repair": "Reparación de Placa",
  "HDMI Repair – Board Level": "Reparación de HDMI – Nivel de Placa",
  "HDMI Replacement – Board Only": "Reemplazo de HDMI – Solo Placa",
  "No Power – Board Repair": "Sin Encendido – Reparación de Placa",
  "Battery Replacement": "Reemplazo de Batería",
  "TMR Hall Joystick Upgrade – Pair": "Mejora de Joystick Hall TMR – Par",
  "Thumbstick Cap Replacement (add-on with TMR)": "Reemplazo de Capuchón de Joystick (adicional con TMR)",
  "TMR + New Thumbstick Caps (bundle)": "TMR + Capuchones de Joystick Nuevos (paquete)",
  "TMR Hall Joystick Upgrade – Modules": "Mejora de Joystick Hall TMR – Módulos",
  "Rechargeable Battery Pack / Battery Terminal Service": "Batería Recargable / Servicio de Terminal de Batería",
  "Internal Battery Replacement": "Reemplazo de Batería Interna",
};

/** Returns `name` translated for `language` — English is always the raw,
 *  stored value returned unchanged. Never throws on a missing/null name. */
export function translateCatalogLabel(name, language) {
  if (typeof name !== "string" || !name) return name;
  if (language !== "es") return name;
  return CATALOG_NAME_ES[name] ?? name;
}

/** Same 3-tier precedence EquipmentTypeCard.jsx already established for
 *  equipment types (see its own header comment): a real, DESK-editable
 *  `service.name_es` (wholesale_services.name_es — see
 *  wholesale-catalog-architecture-fix-migration.sql) wins when present and
 *  we're in Spanish; else this file's legacy hardcoded CATALOG_NAME_ES
 *  dictionary (kept only for the pre-existing seed services that already
 *  have an entry there and haven't had name_es filled in yet); else the raw
 *  English `service.name`. Every caller that renders a service's display
 *  name (the Falla list, the result breadcrumb) goes through this — never
 *  translateCatalogLabel(service.name, ...) directly, which would silently
 *  ignore a name DESK actually typed in. */
export function translateServiceName(service, language) {
  if (language === "es" && typeof service?.name_es === "string" && service.name_es.trim()) {
    return service.name_es.trim();
  }
  return translateCatalogLabel(service?.name, language);
}

/** The optional per-service description DESK can write (description_en /
 *  description_es — same migration as name_es above). Prefers the
 *  language-matched field; falls back to English when only that one is
 *  filled in (never a blank block when SOME description exists); returns
 *  `null` — never an empty string — when neither is set, so callers can use
 *  a plain truthiness check to decide whether to render anything at all. */
export function resolveServiceDescription(service, language) {
  const es = typeof service?.description_es === "string" ? service.description_es.trim() : "";
  const en = typeof service?.description_en === "string" ? service.description_en.trim() : "";
  if (language === "es" && es) return es;
  if (en) return en;
  if (es) return es;
  return null;
}
