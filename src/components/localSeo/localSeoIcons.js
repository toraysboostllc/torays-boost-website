import {
  Battery,
  BatteryCharging,
  Cable,
  CircuitBoard,
  Cpu,
  Droplet,
  Droplets,
  Fan,
  Gamepad2,
  HardDrive,
  Joystick,
  MonitorX,
  Plug,
  PowerOff,
  RotateCcw,
  ScanSearch,
  Smartphone,
  SunDim,
  Tablet,
  TabletSmartphone,
  Thermometer,
  ToggleLeft,
  Tv,
  Wrench,
  Zap,
} from "lucide-react";

/**
 * Icon allow-list for the local SEO pages' service/issue grids
 * (localSeo.config.js), kept separate from src/lib/iconRegistry.js —
 * that registry is imported by Home's Hero/WhyChooseUs, so keeping this
 * set separate avoids growing an unrelated import list. The local SEO
 * pages are eager (bundled into the main chunk, not lazy — see App.jsx's
 * comment for why), so this file rides along in that same main chunk.
 */
export const LOCAL_SEO_ICONS = {
  Battery,
  BatteryCharging,
  Cable,
  CircuitBoard,
  Cpu,
  Droplet,
  Droplets,
  Fan,
  Gamepad2,
  HardDrive,
  Joystick,
  MonitorX,
  Plug,
  PowerOff,
  RotateCcw,
  ScanSearch,
  Smartphone,
  SunDim,
  Tablet,
  TabletSmartphone,
  Thermometer,
  ToggleLeft,
  Tv,
  Wrench,
  Zap,
};
