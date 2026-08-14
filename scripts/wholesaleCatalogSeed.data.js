/**
 * The initial wholesale catalog — plain data, no React, no network calls.
 * The single source of truth, turned into
 * supabase/wholesale-seed-initial-catalog.sql (via generateWholesaleSeedSql.js
 * — that generated .sql file is the only thing actually run, in the
 * Supabase SQL Editor). Also consumed directly by tests/wholesaleCatalogSeed.test.js
 * (shape/value assertions, zero network) and tests/wholesaleSeedSql.test.js
 * (confirms the committed .sql hasn't drifted from this file). Never
 * imported from src/ — this never reaches the browser bundle, keeping
 * every wholesale price out of the frontend.
 *
 * Every category and service is seeded `active: false` on purpose — the
 * owner reviews and activates each one from TORAYS BOOST DESK before any
 * shop can see it.
 */

export const DIAGNOSTIC_DESCRIPTION =
  "The diagnostic fee covers the technician time needed to inspect, test, and identify the fault.";

const ADDON_NOTE = "Add-on price when done together with the TMR Hall Joystick Upgrade.";
const ATA_NOTE = "ATA / Level 3 Repair";

function fixed(amount) {
  return { pricingType: "fixed", fixedPrice: amount };
}
function range(min, max) {
  return { pricingType: "range", priceMin: min, priceMax: max };
}
function svc(slug, name, pricing, notes = null) {
  return { slug, name, notes, ...pricing };
}
function category(slug, name, sortOrder, services, notes = null) {
  return { slug, name, sortOrder, services, notes };
}

export const WHOLESALE_CATALOG_SEED = [
  category("iphone-7-11", "iPhone 7 / 8 / X / XR / XS / XS Max / 11 / 11 Pro / 11 Pro Max", 1, [
    svc("iphone-7-11__no-power", "No Power", range(70, 90)),
    svc("iphone-7-11__boot-loop", "Boot Loop", range(70, 90)),
    svc("iphone-7-11__no-charge-board", "No Charge – Board Repair", range(70, 90)),
    svc("iphone-7-11__no-wifi-bt-board", "No Wi-Fi / Bluetooth – Board Repair", fixed(80)),
    svc("iphone-7-11__save-data-recovery", "Save Phone + Data Recovery", fixed(180)),
  ]),
  category("iphone-12-14", "iPhone 12 / 13 / 14", 2, [
    svc("iphone-12-14__no-power", "No Power", range(90, 120)),
    svc("iphone-12-14__boot-loop", "Boot Loop", fixed(100)),
    svc("iphone-12-14__no-charge-board", "No Charge – Board Repair", fixed(100)),
    svc("iphone-12-14__no-wifi-bt-board", "No Wi-Fi / Bluetooth – Board Repair", fixed(100)),
    svc("iphone-12-14__save-data-recovery", "Save Phone + Data Recovery", fixed(180)),
  ]),
  category(
    "iphone-15-17",
    "iPhone 15 / 16 / 17",
    3,
    [
      svc("iphone-15-17__no-power", "No Power", fixed(150)),
      svc("iphone-15-17__boot-loop", "Boot Loop", fixed(150)),
      svc("iphone-15-17__no-charge-board", "No Charge – Board Repair", fixed(150)),
      svc("iphone-15-17__no-wifi-bt-board", "No Wi-Fi / Bluetooth – Board Repair", fixed(160)),
      svc("iphone-15-17__save-data-recovery", "Save Phone + Data Recovery", range(200, 250)),
    ],
    ATA_NOTE // category-level — applies to the whole line, not repeated per service
  ),
  category("ipad-7-8-9", "iPad 7th / 8th / 9th Generation", 4, [
    svc("ipad-7-8-9__charging-port", "Charging Port Replacement", fixed(55)),
    svc("ipad-7-8-9__charging-ic", "Charging IC Replacement", fixed(60)),
    svc("ipad-7-8-9__backlight", "Backlight Repair", fixed(50)),
  ]),
  category("ipad-10", "iPad 10th Generation", 5, [
    svc("ipad-10__charging-port", "Charging Port Replacement", fixed(75)),
    svc("ipad-10__no-power", "No Power", range(90, 120)),
    svc("ipad-10__no-wifi-bt-board", "No Wi-Fi / Bluetooth – Board Repair", fixed(100)),
    svc("ipad-10__backlight", "Backlight Repair", fixed(75)),
  ]),
  category("ipad-11", "iPad 11th Generation", 6, [
    svc("ipad-11__charging-ic-no-charge", "Charging IC / No Charge (IC-caused)", fixed(150)),
    svc(
      "ipad-11__no-power",
      "No Power",
      fixed(90),
      "Applies when diagnostics confirm the fault is NOT the Charging IC. If the Charging IC is the cause, the price is $150."
    ),
    svc("ipad-11__no-wifi-bt-board", "No Wi-Fi / Bluetooth – Board Repair", fixed(100)),
  ]),
  category('ipad-pro-11-123', 'iPad Pro 11" — 1st, 2nd & 3rd Generation', 7, [
    svc("ipad-pro-11-123__no-power", "No Power", fixed(85)),
    svc("ipad-pro-11-123__boot-loop", "Boot Loop", fixed(85)),
    svc("ipad-pro-11-123__no-charge-board", "No Charge – Board Repair", fixed(85)),
    svc("ipad-pro-11-123__no-wifi-bt-board", "No Wi-Fi / Bluetooth – Board Repair", fixed(95)),
    svc("ipad-pro-11-123__save-data-recovery", "Save Device + Data Recovery", fixed(165)),
  ]),
  category('ipad-pro-129-123', 'iPad Pro 12.9" — 1st, 2nd & 3rd Generation', 8, [
    svc("ipad-pro-129-123__no-power", "No Power", fixed(85)),
    svc("ipad-pro-129-123__boot-loop", "Boot Loop", fixed(85)),
    svc("ipad-pro-129-123__no-charge-board", "No Charge – Board Repair", fixed(85)),
    svc("ipad-pro-129-123__no-wifi-bt-board", "No Wi-Fi / Bluetooth – Board Repair", fixed(95)),
    svc("ipad-pro-129-123__save-data-recovery", "Save Device + Data Recovery", fixed(165)),
  ]),
  category('ipad-pro-11-4plus', 'iPad Pro 11" — 4th Generation & Newer', 9, [
    svc("ipad-pro-11-4plus__no-power", "No Power", fixed(100)),
    svc("ipad-pro-11-4plus__boot-loop", "Boot Loop", fixed(100)),
    svc("ipad-pro-11-4plus__no-charge-board", "No Charge – Board Repair", fixed(100)),
    svc("ipad-pro-11-4plus__no-wifi-bt-board", "No Wi-Fi / Bluetooth – Board Repair", fixed(110)),
    svc("ipad-pro-11-4plus__save-data-recovery", "Save Device + Data Recovery", fixed(180)),
  ]),
  category('ipad-pro-129-4plus', 'iPad Pro 12.9" — 4th Generation & Newer', 10, [
    svc("ipad-pro-129-4plus__no-power", "No Power", fixed(100)),
    svc("ipad-pro-129-4plus__boot-loop", "Boot Loop", fixed(100)),
    svc("ipad-pro-129-4plus__no-charge-board", "No Charge – Board Repair", fixed(100)),
    svc("ipad-pro-129-4plus__no-wifi-bt-board", "No Wi-Fi / Bluetooth – Board Repair", fixed(110)),
    svc("ipad-pro-129-4plus__save-data-recovery", "Save Device + Data Recovery", fixed(180)),
  ]),
  category("macbook-air", "MacBook Air", 11, [svc("macbook-air__board-repair", "Board Repair", range(100, 120))]),
  category("macbook-pro", "MacBook Pro", 12, [svc("macbook-pro__board-repair", "Board Repair", range(120, 180))]),
  category("ps5", "PlayStation 5", 13, [
    svc("ps5__hdmi-board-level", "HDMI Repair – Board Level", fixed(80)),
    svc(
      "ps5__hdmi-board-only",
      "HDMI Replacement – Board Only",
      fixed(45),
      "Customer provides the motherboard only. No guarantee of full functionality after installation because the console was not disassembled by Torays Boost and other damages cannot be verified."
    ),
    svc("ps5__no-power-board", "No Power – Board Repair", range(120, 150)),
    svc("ps5__no-wifi-bt-board", "No Wi-Fi / Bluetooth – Board Repair", fixed(130)),
  ]),
  category("xbox-series-x", "Xbox Series X", 14, [
    svc("xbox-series-x__hdmi-board-level", "HDMI Repair – Board Level", fixed(90)),
    svc("xbox-series-x__no-power-board", "No Power – Board Repair", range(120, 150)),
    svc("xbox-series-x__no-wifi-bt-board", "No Wi-Fi / Bluetooth – Board Repair", fixed(130)),
  ]),
  category("switch", "Nintendo Switch / Switch OLED", 15, [
    svc("switch__charging-port", "Charging Port Replacement", fixed(65)),
    svc("switch__charging-ic", "Charging IC Replacement", fixed(65)),
    svc("switch__no-power-board", "No Power – Board Repair", range(70, 90)),
    svc("switch__no-wifi-bt-board", "No Wi-Fi / Bluetooth – Board Repair", fixed(80)),
  ]),
  category("ps5-dualsense", "PlayStation 5 DualSense", 16, [
    svc("ps5-dualsense__battery", "Battery Replacement", fixed(20)),
    svc("ps5-dualsense__tmr-pair", "TMR Hall Joystick Upgrade – Pair", fixed(25)),
    svc("ps5-dualsense__thumbstick-cap-addon", "Thumbstick Cap Replacement (add-on with TMR)", fixed(5), ADDON_NOTE),
    svc("ps5-dualsense__tmr-plus-caps", "TMR + New Thumbstick Caps (bundle)", fixed(30)),
  ]),
  category("ps5-dualsense-edge", "PlayStation 5 DualSense Edge", 17, [
    svc("ps5-dualsense-edge__battery", "Battery Replacement", fixed(20)),
    svc("ps5-dualsense-edge__tmr-modules", "TMR Hall Joystick Upgrade – Modules", fixed(45)),
    svc("ps5-dualsense-edge__thumbstick-cap-addon", "Thumbstick Cap Replacement (add-on with TMR)", fixed(5), ADDON_NOTE),
    svc("ps5-dualsense-edge__tmr-plus-caps", "TMR + New Thumbstick Caps (bundle)", fixed(50)),
  ]),
  category("xbox-controller", "Xbox Series X/S Controller", 18, [
    svc(
      "xbox-controller__battery-service",
      "Rechargeable Battery Pack / Battery Terminal Service",
      fixed(20),
      "Standard Xbox controller uses AA batteries or a rechargeable battery pack — not an internal battery."
    ),
    svc("xbox-controller__tmr-pair", "TMR Hall Joystick Upgrade – Pair", fixed(25)),
    svc("xbox-controller__thumbstick-cap-addon", "Thumbstick Cap Replacement (add-on with TMR)", fixed(5), ADDON_NOTE),
    svc("xbox-controller__tmr-plus-caps", "TMR + New Thumbstick Caps (bundle)", fixed(30)),
  ]),
  category("xbox-elite-2", "Xbox Elite Series 2 Controller", 19, [
    svc("xbox-elite-2__internal-battery", "Internal Battery Replacement", fixed(20)),
    svc("xbox-elite-2__tmr-pair", "TMR Hall Joystick Upgrade – Pair", fixed(45)),
    svc("xbox-elite-2__thumbstick-cap-addon", "Thumbstick Cap Replacement (add-on with TMR)", fixed(5), ADDON_NOTE),
    svc("xbox-elite-2__tmr-plus-caps", "TMR + New Thumbstick Caps (bundle)", fixed(50)),
  ]),
  // Diagnostic-only categories — no services yet, prices pending. Kept
  // here (not skipped) so they exist in DESK ready for the owner to fill
  // in, per the request: "Servicios y precios de reparación pendientes."
  category("laptops-normal", "Laptops (Standard)", 20, []),
  category("laptops-gamer", "Gaming Laptops", 21, []),
];
