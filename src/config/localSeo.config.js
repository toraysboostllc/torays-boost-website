/**
 * Structural data (route paths, icon names, wizard preselection, FAQ/related
 * ordering) for the local SEO landing pages — Phone, PS5, PS5 Controller,
 * iPhone, iPad, and Xbox repair in Miami/Kendall. Every piece of visible
 * copy lives in translations.js, keyed by the ids below; this file only
 * says what exists and how it's wired, never what it says.
 *
 * `wizardSelection` values are real ids from repairRequest.config.js's own
 * catalog (iphone / ipad / ps5 / xbox / controllers + the "stick-drift"
 * problem) — useRepairRequest() validates them against that catalog at
 * runtime, so a typo here would fail safely (blank selection) rather than
 * break the wizard.
 *
 * Xbox note: the catalog has no separate Series X / Series S entries —
 * only one generic "xbox" category (no `brands`, free-text model step).
 * Preselecting that single category is the safe, neutral entry point
 * (never implies Series X over Series S); the visitor types their exact
 * model in the next step, same mechanism already used for PS5/Controllers.
 */
export const LOCAL_SEO_PAGES = {
  phoneRepairMiami: {
    path: "/phone-repair-miami",
    wizardSelection: { categoryId: "iphone" },
    services: [
      { id: "screen", icon: "Smartphone" },
      { id: "chargingPort", icon: "Plug" },
      { id: "noPower", icon: "PowerOff" },
      { id: "bootLoop", icon: "RotateCcw" },
      { id: "waterDamage", icon: "Droplet" },
      { id: "motherboard", icon: "CircuitBoard" },
      { id: "microsoldering", icon: "Cpu" },
      { id: "dataRecovery", icon: "HardDrive" },
    ],
    issues: [
      { id: "crackedScreen", icon: "Smartphone" },
      { id: "wontCharge", icon: "BatteryCharging" },
      { id: "wontTurnOn", icon: "PowerOff" },
      { id: "liquidExposure", icon: "Droplets" },
      { id: "complexDiagnosis", icon: "ScanSearch" },
    ],
    faqIds: ["wontTurnOn", "chargingPort", "microsoldering", "estimateCommitment", "approval"],
    related: ["iphoneRepairMiami", "ps5RepairMiami", "ps5ControllerRepairMiami"],
  },
  ps5RepairMiami: {
    path: "/ps5-repair-miami",
    wizardSelection: { categoryId: "ps5" },
    // Renders as a highlighted line above the related-links row, pointing
    // to the Controller page with the exact phrasing requested — a plain
    // related-link entry alone wouldn't carry that specific wording.
    relatedNoteKey: "relatedControllerNote",
    services: [
      { id: "hdmiPort", icon: "Cable" },
      { id: "noDisplay", icon: "MonitorX" },
      { id: "hdmiCircuit", icon: "CircuitBoard" },
      { id: "unexpectedShutdown", icon: "Zap" },
      { id: "overheating", icon: "Thermometer" },
      { id: "fanCleaning", icon: "Fan" },
      { id: "noPower", icon: "PowerOff" },
      { id: "motherboardDiagnostics", icon: "Cpu" },
    ],
    issues: [
      { id: "noImage", icon: "Tv" },
      { id: "shutsOffRandomly", icon: "Zap" },
      { id: "wontPowerOn", icon: "PowerOff" },
      { id: "runsHot", icon: "Thermometer" },
    ],
    faqIds: ["hdmiPort", "unexpectedShutdown", "noDisplay", "wontPowerOn", "estimateAuthorization"],
    related: ["ps5ControllerRepairMiami", "phoneRepairMiami", "xboxRepairMiami"],
  },
  ps5ControllerRepairMiami: {
    path: "/ps5-controller-repair-miami",
    wizardSelection: { categoryId: "controllers", problemId: "stick-drift" },
    services: [
      { id: "stickDrift", icon: "Joystick" },
      { id: "joystickReplacement", icon: "Gamepad2" },
      { id: "tmrJoystick", icon: "CircuitBoard" },
      { id: "dualSenseRepair", icon: "Gamepad2" },
      { id: "dualSenseEdge", icon: "Gamepad2" },
      { id: "buttonsNotResponding", icon: "ToggleLeft" },
      { id: "chargingProblems", icon: "BatteryCharging" },
      { id: "batteryReplacement", icon: "Battery" },
      { id: "damagedTriggers", icon: "Wrench" },
      { id: "boardDiagnostics", icon: "ScanSearch" },
    ],
    issues: [
      { id: "sticksDriftOnTheirOwn", icon: "Joystick" },
      { id: "buttonsUnresponsive", icon: "ToggleLeft" },
      { id: "wontHoldCharge", icon: "BatteryCharging" },
      { id: "loosePulls", icon: "Wrench" },
    ],
    faqIds: ["stickDrift", "tmrJoystick", "dualSenseEdge", "driftWarranty", "estimateAuthorization"],
    related: ["ps5RepairMiami"],
  },
  iphoneRepairMiami: {
    path: "/iphone-repair-miami",
    wizardSelection: { categoryId: "iphone" },
    services: [
      { id: "screenLcd", icon: "Smartphone" },
      { id: "chargingPort", icon: "Plug" },
      { id: "notCharging", icon: "BatteryCharging" },
      { id: "noPower", icon: "PowerOff" },
      { id: "bootLoop", icon: "RotateCcw" },
      { id: "liquidDamage", icon: "Droplet" },
      { id: "motherboard", icon: "CircuitBoard" },
      { id: "microsoldering", icon: "Cpu" },
      { id: "dataRecovery", icon: "HardDrive" },
    ],
    issues: [
      { id: "crackedOrDeadScreen", icon: "Smartphone" },
      { id: "wontChargeOrDetectCable", icon: "BatteryCharging" },
      { id: "stuckOnLogo", icon: "RotateCcw" },
      { id: "exposedToLiquid", icon: "Droplets" },
      { id: "complexBoardIssue", icon: "ScanSearch" },
    ],
    faqIds: ["screenRepair", "chargingPort", "noPower", "microsoldering", "estimateAuthorization"],
    related: ["phoneRepairMiami", "ipadRepairMiami"],
  },
  ipadRepairMiami: {
    path: "/ipad-repair-miami",
    wizardSelection: { categoryId: "ipad" },
    services: [
      { id: "screenLcd", icon: "Tablet" },
      { id: "digitizer", icon: "TabletSmartphone" },
      { id: "crackedGlass", icon: "Tablet" },
      { id: "chargingPort", icon: "Plug" },
      { id: "notCharging", icon: "BatteryCharging" },
      { id: "noPower", icon: "PowerOff" },
      { id: "backlight", icon: "SunDim" },
      { id: "chargingIcDiagnostics", icon: "CircuitBoard" },
      { id: "motherboard", icon: "CircuitBoard" },
      { id: "microsoldering", icon: "Cpu" },
      { id: "liquidDamage", icon: "Droplet" },
      { id: "dataRecovery", icon: "HardDrive" },
    ],
    issues: [
      { id: "crackedScreenOrGlass", icon: "Tablet" },
      { id: "wontCharge", icon: "BatteryCharging" },
      { id: "wontTurnOn", icon: "PowerOff" },
      { id: "dimOrNoDisplay", icon: "SunDim" },
      { id: "exposedToLiquid", icon: "Droplets" },
    ],
    faqIds: ["lcdVsDigitizer", "chargingPort", "backlight", "noPower", "approval"],
    related: ["iphoneRepairMiami"],
  },
  xboxRepairMiami: {
    path: "/xbox-repair-miami",
    // Single generic "xbox" category — see the file header note on why
    // this is the safe, neutral entry point for both Series X and S.
    wizardSelection: { categoryId: "xbox" },
    services: [
      { id: "hdmiPort", icon: "Cable" },
      { id: "noDisplay", icon: "MonitorX" },
      { id: "hdmiCircuit", icon: "CircuitBoard" },
      { id: "unexpectedShutdown", icon: "Zap" },
      { id: "overheatingCleaning", icon: "Thermometer" },
      { id: "noPower", icon: "PowerOff" },
      { id: "motherboardDiagnostics", icon: "Cpu" },
      { id: "boardLevelRepair", icon: "CircuitBoard" },
    ],
    issues: [
      { id: "noImageOnScreen", icon: "Tv" },
      { id: "shutsOffUnexpectedly", icon: "Zap" },
      { id: "wontPowerOn", icon: "PowerOff" },
      { id: "overheatsQuickly", icon: "Thermometer" },
    ],
    faqIds: ["seriesXAndS", "hdmiPort", "noDisplay", "unexpectedShutdown", "noPower", "estimateAuthorization"],
    related: ["ps5RepairMiami"],
  },
};

export function getLocalSeoPage(key) {
  return LOCAL_SEO_PAGES[key] || null;
}
