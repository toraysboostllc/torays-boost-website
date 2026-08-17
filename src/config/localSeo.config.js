/**
 * Structural data (route paths, icon names, wizard preselection, FAQ/related
 * ordering) for the 3 local SEO landing pages — Phone, PS5, and PS5
 * Controller repair in Miami/Kendall. Every piece of visible copy lives in
 * translations.js, keyed by the ids below; this file only says what exists
 * and how it's wired, never what it says.
 *
 * `wizardSelection` values are real ids from repairRequest.config.js's own
 * catalog (iphone / ps5 / controllers + the "stick-drift" problem) —
 * useRepairRequest() validates them against that catalog at runtime, so a
 * typo here would fail safely (blank selection) rather than break the
 * wizard.
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
    related: ["ps5RepairMiami", "ps5ControllerRepairMiami"],
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
    related: ["ps5ControllerRepairMiami", "phoneRepairMiami"],
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
};

export function getLocalSeoPage(key) {
  return LOCAL_SEO_PAGES[key] || null;
}
